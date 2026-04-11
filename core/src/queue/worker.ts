/***********************************************************************
 * @module queue/worker
 *
 * @summary Central job dispatch and processing for the Robin
 * ingestion pipeline. Routes jobs to type-specific processors.
 *
 * @remarks
 * Jobs arrive via BullMQ queues (one per-user write queue, plus shared
 * provision and scheduler queues). The dispatcher ({@link processJob})
 * routes by `job.type` to the appropriate processor.
 *
 * Each processor builds an `OrchestratorDeps` object that adapts our
 * concrete DB/gateway/queue to the pure interfaces `@robin/agent` expects.
 *
 * | Type         | Processor                       | Purpose                           |
 * |--------------|---------------------------------|-----------------------------------|
 * | extraction   | {@link processExtractionJob}     | AI-driven entry → fragment split  |
 * | write        | {@link processWriteJob}          | Legacy write path (wraps extract) |
 * | link         | {@link processLinkJob}           | Thread classify + frag relate     |
 * | reclassify   | {@link processReclassifyJob}     | Re-score frags for a new thread   |
 * | sync         | `processSyncJob`                 | Git → DB reconciliation           |
 * | regen        | `processRegenJob`                | Single thread wiki regen          |
 * | regen-batch  | `processRegenBatchJob`           | Batch wiki regen (scheduler)      |
 *
 * @see {@link startWorkers} — lifecycle entry point called from `index.ts`
 * @see {@link spawnWriteWorker} — per-user worker spawner (idempotent)
 * @see {@link processProvisionJob} — new-user onboarding
 *
 * @privateRemarks
 * **Deps duplication:** `processExtractionJob` and `processWriteJob`
 * build near-identical deps. Intentional — write jobs are the legacy
 * path being migrated. Once all callers use `enqueueExtraction`,
 * `processWriteJob` disappears and so does the duplication.
 ***********************************************************************/

import {
  BullMQWorker,
  createRedisConnection,
  QUEUE_NAMES,
  type WriteJob,
  type ProvisionJob,
  type ExtractionJob,
  type LinkJob,
  type ReclassifyJob,
  type SyncJob,
  type RegenJob,
  type RegenBatchJob,
  type RobinJob,
  type JobResult,
} from '@robin/queue'
import {
  runExtraction,
  runLinking,
  DEFAULT_RESOLUTION_CONFIG,
  vaultClassifyCall,
  fragmentCall,
  entityExtractCall,
  threadClassifyCall,
  fragScoreCall,
} from '@robin/agent'
import type { ExtractionOrchestratorDeps, LinkingOrchestratorDeps } from '@robin/agent'
import { loadWikiClassificationSpec, makeLookupKey } from '@robin/shared'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  users,
  wikis,
  vaults,
  fragments,
  entries,
  edges,
  people,
} from '../db/schema.js'
import { resolveFragmentSlug } from '../db/slug.js'
import { computeContentHash } from '../db/dedup.js'
import { acquireLock, releaseLock } from '../db/locking.js'
import { emitPipelineEvent } from '../db/pipeline-events.js'
import { gatewayClient } from '../gateway/client.js'
import { generateKeypair } from '../keypair.js'
import { createWikiLookupFn } from '../lib/wiki-lookup.js'
import { processSyncJob } from './sync-worker.js'
import { processRegenJob, processRegenBatchJob } from './regen-worker.js'
import { setupRegenScheduler } from './scheduler.js'
import { producer } from './producer.js'
import { nanoid } from '../lib/id.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'worker' })

const connection = createRedisConnection()
const bullWorker = new BullMQWorker(connection)

/***********************************************************************
 * ## Pipeline event helper
 *
 * @internal Bound wrapper — processors call this without passing `db`.
 ***********************************************************************/

/**
 * Thin wrapper around {@link emitPipelineEvent} that binds the
 * module-level `db` instance.
 *
 * @param event - Pipeline event to emit (stage, status, metadata)
 */
function emitEvent(event: {
  entryKey: string
  jobId: string
  stage: string
  status: 'started' | 'completed' | 'failed'
  fragmentKey?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  return emitPipelineEvent(db as any, event)
}

/***********************************************************************
 * ## Extraction Job Processor
 *
 * @remarks The primary AI pipeline. Takes raw entry content and splits
 * it into structured fragments via {@link runExtraction}.
 *
 * @see {@link runExtraction} — orchestrator from `@robin/agent`
 * @see {@link ExtractionOrchestratorDeps} — dep interface we satisfy
 ***********************************************************************/

/**
 * Process an extraction job through the full AI ingestion pipeline.
 *
 * @remarks
 * Builds {@link ExtractionOrchestratorDeps} by adapting concrete
 * implementations (Drizzle DB, gateway client, BullMQ producer) to
 * the pure interfaces expected by `runExtraction`.
 *
 * **Flow:** vault classify → fragment split → entity extract →
 * persist → enqueue link jobs per fragment.
 *
 * @param job - Extraction job with userId, content, entryKey
 * @returns {@link JobResult} with success status and timing
 */
async function processExtractionJob(job: ExtractionJob): Promise<JobResult> {
  log.info({ jobId: job.jobId, userId: job.userId }, 'processing extraction job')
  const t0 = performance.now()

  /** @step 1 — Resolve fallback vault (inbox) for low-confidence classify */
  const [defaultVault] = await db
    .select({ id: vaults.id })
    .from(vaults)
    .where(and(eq(vaults.userId, job.userId), eq(vaults.type, 'inbox')))

  const fallbackVaultId = defaultVault?.id ?? ''

  /** @step 2 — Build orchestrator deps from concrete implementations */
  const deps: ExtractionOrchestratorDeps = {
    acquireLock,
    releaseLock,
    emitEvent,
    db,
    vaultClassifyDeps: {
      listUserVaults: async (userId: string) => {
        const rows = await db
          .select({ id: vaults.id, name: vaults.name, slug: vaults.slug })
          .from(vaults)
          .where(eq(vaults.userId, userId))
        return rows
      },
      llmCall: vaultClassifyCall,
      confidenceThreshold: Number.parseFloat(process.env.VAULT_CONFIDENCE_THRESHOLD ?? '0.5'),
      fallbackVaultId,
    },
    fragmentDeps: {
      llmCall: fragmentCall,
      emitEvent,
    },
    entityExtractDeps: {
      loadUserPeople: async (userId: string) => {
        const rows = await db
          .select({
            lookupKey: people.lookupKey,
            name: people.name,
            sections: people.sections,
          })
          .from(people)
          .where(eq(people.userId, userId))
        return rows.map((r) => ({
          lookupKey: r.lookupKey,
          canonicalName: r.name,
          aliases: ((r.sections as any)?.aliases as string[]) ?? [],
        }))
      },
      llmCall: entityExtractCall,
      emitEvent,
      config: DEFAULT_RESOLUTION_CONFIG,
      makePeopleKey: () => makeLookupKey('person'),
    },
    persistDeps: {
      batchWrite: async (req) => {
        const result = await gatewayClient.batchWrite(req)
        return { commitHash: result.commitHash }
      },
      insertEntry: async (entry) => {
        await db
          .insert(entries)
          .values(entry as any)
          .onConflictDoUpdate({
            target: entries.lookupKey,
            set: {
              slug: (entry as any).slug,
              title: (entry as any).title,
              state: (entry as any).state,
              repoPath: (entry as any).repoPath,
              updatedAt: new Date(),
            },
          })
      },
      insertFragment: async (fragment) => {
        const f = fragment as any
        f.slug = await resolveFragmentSlug(db, job.userId, f.slug)
        if (f.content) f.dedupHash = computeContentHash(f.content)
        await db.insert(fragments).values(f)
      },
      insertEdge: async (edge) => {
        await db
          .insert(edges)
          .values({
            id: crypto.randomUUID(),
            userId: job.userId,
            ...edge,
          } as any)
          .onConflictDoNothing()
      },
      insertPerson: async (person) => {
        await db
          .insert(people)
          .values(person as any)
          .onConflictDoUpdate({
            target: [people.userId, people.slug],
            set: {
              name: (person as any).name,
              sections: (person as any).sections,
              repoPath: (person as any).repoPath,
              updatedAt: new Date(),
            },
          })
      },
      loadPersonByKey: async (key) => {
        const rows = await db.select().from(people).where(eq(people.lookupKey, key))
        if (rows.length === 0) return null
        const r = rows[0]
        return {
          lookupKey: r.lookupKey,
          slug: r.slug,
          repoPath: r.repoPath ?? '',
          name: r.name,
          sections: r.sections as Record<string, unknown>,
        }
      },
      emitEvent,
      lookupFn: createWikiLookupFn(job.userId),
    },
    enqueueLinkJob: async (userId, linkJobData) => {
      const linkJob: LinkJob = {
        type: 'link',
        jobId: crypto.randomUUID(),
        userId,
        fragmentKey: linkJobData.fragmentKey,
        entryKey: linkJobData.entryKey,
        vaultId: linkJobData.vaultId,
        fragmentContent: linkJobData.fragmentContent ?? '',
        enqueuedAt: new Date().toISOString(),
      }
      await producer.enqueueLinkJob(userId, linkJob)
    },
  }

  /** @step 3 — Run the extraction orchestrator */
  const input = {
    userId: job.userId,
    content: job.content,
    entryKey: job.entryKey,
    userSelectedVaultId: job.userSelectedVaultId,
    source: job.source,
    jobId: job.jobId,
  }

  await runExtraction(deps, input)

  const elapsed = (performance.now() - t0).toFixed(0)
  log.info({ jobId: job.jobId, ms: Number(elapsed) }, 'extraction job completed')

  return {
    jobId: job.jobId,
    success: true,
    processedAt: new Date().toISOString(),
  }
}

/***********************************************************************
 * ## Link Job Processor
 *
 * @remarks Phase 2 of the pipeline: classify fragments into wikis
 * and discover related fragments via vector similarity + LLM scoring.
 *
 * @see {@link runLinking} — orchestrator from `@robin/agent`
 * @see {@link LinkingOrchestratorDeps} — dep interface we satisfy
 ***********************************************************************/

/**
 * Process a link job: classify fragment into wikis and find related fragments.
 *
 * @remarks
 * Builds {@link LinkingOrchestratorDeps} with gateway search for vector
 * candidates, thread classification via LLM, and fragment scoring via LLM.
 *
 * **Flow:** thread classify (LLM) → fragment relate (vector + LLM score)
 * → persist edges → update frontmatter → mark wikis DIRTY.
 *
 * @param job - Link job with fragmentKey, entryKey, fragmentContent
 * @returns {@link JobResult} with success status and timing
 */
async function processLinkJob(job: LinkJob): Promise<JobResult> {
  log.info({ jobId: job.jobId, userId: job.userId }, 'processing link job')
  const t0 = performance.now()

  const fragmentContent = job.fragmentContent ?? ''

  /** @step 1 — Build linking orchestrator deps */
  const deps: LinkingOrchestratorDeps = {
    acquireLock,
    releaseLock,
    emitEvent,
    db,
    threadClassifyDeps: {
      searchCandidates: async (userId, content, limit) => {
        const searchResult = await gatewayClient.search(userId, content, limit)
        const threadRows = await db
          .select({ lookupKey: wikis.lookupKey, name: wikis.name })
          .from(wikis)
          .where(eq(wikis.userId, userId))
        return threadRows.map((t) => ({
          wikiKey: t.lookupKey,
          score: searchResult.results?.find((r) => r.path?.includes(t.lookupKey))?.score ?? 0,
        }))
      },
      loadThreads: async (wikiKeys) => {
        if (wikiKeys.length === 0) return []
        const rows = await db
          .select({
            lookupKey: wikis.lookupKey,
            name: wikis.name,
            type: wikis.type,
            prompt: wikis.prompt,
          })
          .from(wikis)
          .where(
            sql`${wikis.lookupKey} = ANY(ARRAY[${sql.join(
              wikiKeys.map((k) => sql`${k}`),
              sql`, `
            )}])`
          )
        return rows
      },
      llmCall: threadClassifyCall,
      emitEvent,
    },
    fragRelateDeps: {
      vectorSearch: async (userId, content, limit) => {
        const searchResult = await gatewayClient.search(userId, content, limit, 0.01)
        return (searchResult.results ?? []).map((r) => ({
          fragmentKey: r.path?.split('/')?.pop()?.replace('.md', '') ?? '',
          score: r.score ?? 0,
        }))
      },
      loadFragmentContent: async (fragmentKey) => {
        const [row] = await db
          .select({ repoPath: fragments.repoPath })
          .from(fragments)
          .where(eq(fragments.lookupKey, fragmentKey))
        if (!row?.repoPath) return null
        try {
          const file = await gatewayClient.read(job.userId, row.repoPath)
          return file.content
        } catch {
          return null
        }
      },
      llmCall: fragScoreCall,
      emitEvent,
    },
    insertEdge: async (edge) => {
      await db
        .insert(edges)
        .values({
          id: crypto.randomUUID(),
          userId: job.userId,
          ...edge,
        } as any)
        .onConflictDoNothing()
    },
    transitionWiki: async (wikiKey, targetState) => {
      await db.execute(
        sql`UPDATE ${wikis} SET state = ${targetState}, updated_at = NOW()
            WHERE lookup_key = ${wikiKey}
            AND state IN ('RESOLVED', 'DIRTY')`
      )
    },
    updateFragmentFrontmatter: async (userId, fragmentKey, wikiKeys, relatedFragmentKeys) => {
      /** @fallback — frontmatter update is best-effort */
      try {
        const [fragRow] = await db
          .select({ repoPath: fragments.repoPath })
          .from(fragments)
          .where(eq(fragments.lookupKey, fragmentKey))
        if (!fragRow?.repoPath) return

        const fileContent = await gatewayClient.read(userId, fragRow.repoPath)
        let updated = fileContent.content
        updated = updated.replace(/status: PENDING/, `status: RESOLVED`)
        updated = updated.replace(
          /wikiKeys: \[.*?\]/,
          `wikiKeys: [${wikiKeys.map((k) => `"${k}"`).join(', ')}]`
        )
        updated = updated.replace(
          /relatedFragmentKeys: \[.*?\]/,
          `relatedFragmentKeys: [${relatedFragmentKeys.map((k) => `"${k}"`).join(', ')}]`
        )
        if (updated === fileContent.content) return
        await gatewayClient.write({
          userId,
          path: fragRow.repoPath,
          content: updated,
          message: `link: update ${fragmentKey} frontmatter`,
          branch: 'main',
        })
      } catch (err) {
        log.warn({ fragmentKey, err }, 'failed to update frontmatter')
      }
    },
  }

  /** @step 2 — Run the linking orchestrator */
  const input: import('@robin/agent').LinkingInput = {
    userId: job.userId,
    fragmentKey: job.fragmentKey,
    fragmentContent,
    entryKey: job.entryKey,
    vaultId: job.vaultId,
    jobId: job.jobId,
  }

  await runLinking(deps, input)

  const elapsed = (performance.now() - t0).toFixed(0)
  log.info({ jobId: job.jobId, ms: Number(elapsed) }, 'link job completed')

  return {
    jobId: job.jobId,
    success: true,
    processedAt: new Date().toISOString(),
  }
}

/***********************************************************************
 * ## Reclassify Job Processor
 *
 * @remarks Triggered when a new thread is created. Re-scores existing
 * fragments against the new thread via vector search + LLM classification.
 * Fragments above threshold get `FRAGMENT_IN_WIKI` edges.
 *
 * @see {@link threadClassifyCall} — LLM classification call
 ***********************************************************************/

/**
 * Re-evaluate existing fragments for a newly-created thread.
 *
 * @remarks
 * Uses hybrid search (gateway vector search + LLM classification) to
 * find fragments that belong to the new thread but were classified
 * before it existed. Threshold: 0.7 confidence.
 *
 * @param job - Reclassify job with wikiKey and userId
 * @returns {@link JobResult} with success status and reclassified count
 */
async function processReclassifyJob(job: ReclassifyJob): Promise<JobResult> {
  log.info({ jobId: job.jobId, userId: job.userId }, 'processing reclassify job')
  const t0 = performance.now()

  /** @step 1 — Load the target thread */
  const [thread] = await db.select().from(wikis).where(eq(wikis.lookupKey, job.wikiKey))

  /** @gate — thread not found → abort */
  if (!thread) {
    log.warn({ jobId: job.jobId, wikiKey: job.wikiKey }, 'reclassify: thread not found')
    return {
      jobId: job.jobId,
      success: false,
      error: 'thread not found',
      processedAt: new Date().toISOString(),
    }
  }

  /** @step 2 — Search for candidate fragments via vector similarity */
  const searchQuery = `${thread.name} ${thread.prompt}`.trim()
  const searchResult = await gatewayClient.search(job.userId, searchQuery, 20)

  let reclassifiedCount = 0
  const RECLASSIFY_THRESHOLD = 0.7

  /** @step 3 — Score each candidate against the thread via LLM */
  for (const candidate of searchResult.results ?? []) {
    if (!candidate.path) continue
    try {
      const fileContent = await gatewayClient.read(job.userId, candidate.path)
      const spec = loadWikiClassificationSpec({
        content: fileContent.content,
        wikis: JSON.stringify([
          {
            key: thread.lookupKey,
            name: thread.name,
            type: thread.type,
            prompt: thread.prompt,
          },
        ]),
      })
      const result = await threadClassifyCall(spec.system, spec.user)
      const score = result.assignments.length > 0 ? result.assignments[0].confidence : 0

      /** @gate — score above threshold → create edge */
      if (score >= RECLASSIFY_THRESHOLD) {
        const fragLookupKey = candidate.path.split('/').pop()?.replace('.md', '') ?? ''
        await db.insert(edges).values({
          id: crypto.randomUUID(),
          userId: job.userId,
          srcType: 'frag',
          srcId: fragLookupKey,
          dstType: 'wiki',
          dstId: thread.lookupKey,
          edgeType: 'FRAGMENT_IN_WIKI',
          attrs: { score },
        })
        reclassifiedCount++
      }
    } catch (err) {
      /** @fallback — individual candidate failure is non-fatal */
      log.warn({ path: candidate.path, err }, 'reclassify: failed to evaluate candidate')
    }
  }

  /** @step 4 — Mark thread DIRTY if any fragments were reclassified */
  if (reclassifiedCount > 0) {
    await db.execute(
      sql`UPDATE ${wikis} SET state = 'DIRTY', updated_at = NOW()
          WHERE lookup_key = ${job.wikiKey}`
    )
  }

  const elapsed = (performance.now() - t0).toFixed(0)
  log.info({ jobId: job.jobId, ms: Number(elapsed), reclassifiedCount }, 'reclassify job completed')

  return {
    jobId: job.jobId,
    success: true,
    processedAt: new Date().toISOString(),
  }
}

/***********************************************************************
 * ## Write Job Processor (Legacy)
 *
 * @deprecated Will be removed once all callers migrate to
 * `enqueueExtraction`. Exists only for backwards compatibility.
 *
 * @remarks Wraps {@link runExtraction} with a provisioning guard.
 * If the user's git repo isn't provisioned yet, the job throws and
 * BullMQ auto-retries — buying time for the provision job to complete.
 *
 * @see {@link processExtractionJob} — the non-legacy equivalent
 ***********************************************************************/

/**
 * Process a legacy write job by delegating to the extraction pipeline.
 *
 * @deprecated Use extraction jobs directly via `enqueueExtraction`.
 *
 * @param job - Write job with userId and payload containing rawEntry
 * @returns {@link JobResult} with success status and timing
 * @throws Error if user not provisioned (BullMQ retries automatically)
 */
async function processWriteJob(job: WriteJob): Promise<JobResult> {
  const { userId, payload } = job
  log.debug({ jobId: job.jobId, userId }, 'processing write job')

  /** @gate — user not provisioned → throw (BullMQ retries) */
  const [provCheck] = await db
    .select({ publicKey: users.publicKey })
    .from(users)
    .where(eq(users.id, userId))
  if (!provCheck?.publicKey) {
    throw new Error(`user ${userId} not yet provisioned, will retry`)
  }

  const t0 = performance.now()

  /** @step 1 — Extract input from legacy write payload */
  const entryKey = payload.entryId ?? job.jobId
  const content = payload.rawEntry?.content ?? ''
  const source = payload.rawEntry?.source ?? 'api'
  const userSelectedVaultId = payload.rawEntry?.metadata?.vaultId as string | undefined

  /** @step 2 — Resolve fallback vault (same as extraction processor) */
  const [defaultVault] = await db
    .select({ id: vaults.id })
    .from(vaults)
    .where(and(eq(vaults.userId, userId), eq(vaults.type, 'inbox')))
  const fallbackVaultId = defaultVault?.id ?? ''

  /** @step 3 — Build extraction deps (mirrors processExtractionJob) */
  const deps: ExtractionOrchestratorDeps = {
    acquireLock,
    releaseLock,
    emitEvent,
    db,
    vaultClassifyDeps: {
      listUserVaults: async (uid: string) => {
        const rows = await db
          .select({ id: vaults.id, name: vaults.name, slug: vaults.slug })
          .from(vaults)
          .where(eq(vaults.userId, uid))
        return rows
      },
      llmCall: vaultClassifyCall,
      confidenceThreshold: Number.parseFloat(process.env.VAULT_CONFIDENCE_THRESHOLD ?? '0.5'),
      fallbackVaultId,
    },
    fragmentDeps: {
      llmCall: fragmentCall,
      emitEvent,
    },
    entityExtractDeps: {
      loadUserPeople: async (uid: string) => {
        const rows = await db
          .select({
            lookupKey: people.lookupKey,
            name: people.name,
            sections: people.sections,
          })
          .from(people)
          .where(eq(people.userId, uid))
        return rows.map((r) => ({
          lookupKey: r.lookupKey,
          canonicalName: r.name,
          aliases: ((r.sections as any)?.aliases as string[]) ?? [],
        }))
      },
      llmCall: entityExtractCall,
      emitEvent,
      config: DEFAULT_RESOLUTION_CONFIG,
      makePeopleKey: () => makeLookupKey('person'),
    },
    persistDeps: {
      batchWrite: async (req) => {
        const result = await gatewayClient.batchWrite(req)
        return { commitHash: result.commitHash }
      },
      insertEntry: async (entry) => {
        await db
          .insert(entries)
          .values(entry as any)
          .onConflictDoUpdate({
            target: entries.lookupKey,
            set: {
              slug: (entry as any).slug,
              title: (entry as any).title,
              state: (entry as any).state,
              repoPath: (entry as any).repoPath,
              updatedAt: new Date(),
            },
          })
      },
      insertFragment: async (fragment) => {
        const f = fragment as any
        f.slug = await resolveFragmentSlug(db, job.userId, f.slug)
        if (f.content) f.dedupHash = computeContentHash(f.content)
        await db.insert(fragments).values(f)
      },
      insertEdge: async (edge) => {
        await db
          .insert(edges)
          .values({ id: crypto.randomUUID(), userId, ...edge } as any)
          .onConflictDoNothing()
      },
      insertPerson: async (person) => {
        await db
          .insert(people)
          .values(person as any)
          .onConflictDoUpdate({
            target: [people.userId, people.slug],
            set: {
              name: (person as any).name,
              sections: (person as any).sections,
              repoPath: (person as any).repoPath,
              updatedAt: new Date(),
            },
          })
      },
      loadPersonByKey: async (key) => {
        const rows = await db.select().from(people).where(eq(people.lookupKey, key))
        if (rows.length === 0) return null
        const r = rows[0]
        return {
          lookupKey: r.lookupKey,
          slug: r.slug,
          repoPath: r.repoPath ?? '',
          name: r.name,
          sections: r.sections as Record<string, unknown>,
        }
      },
      emitEvent,
      lookupFn: createWikiLookupFn(userId),
    },
    enqueueLinkJob: async (uid, linkJobData) => {
      const linkJob: LinkJob = {
        type: 'link',
        jobId: crypto.randomUUID(),
        userId: uid,
        fragmentKey: linkJobData.fragmentKey,
        entryKey: linkJobData.entryKey,
        vaultId: linkJobData.vaultId,
        fragmentContent: linkJobData.fragmentContent ?? '',
        enqueuedAt: new Date().toISOString(),
      }
      await producer.enqueueLinkJob(uid, linkJob)
    },
  }

  /** @step 4 — Delegate to extraction orchestrator */
  await runExtraction(deps, {
    userId,
    content,
    entryKey,
    userSelectedVaultId,
    source,
    jobId: job.jobId,
  })

  const elapsed = (performance.now() - t0).toFixed(0)
  log.info({ jobId: job.jobId, ms: Number(elapsed) }, 'write job completed')

  return {
    jobId: job.jobId,
    success: true,
    processedAt: new Date().toISOString(),
  }
}

/***********************************************************************
 * ## Job Dispatcher
 *
 * @remarks Routes incoming jobs by type to the appropriate processor.
 * Sync and regen jobs delegate to their own worker modules.
 *
 * @see {@link processSyncJob} — `sync-worker.ts`
 * @see {@link processRegenJob} — `regen-worker.ts`
 ***********************************************************************/

/**
 * Central job dispatcher. Routes by `job.type` to the correct processor.
 *
 * @param job - Any {@link RobinJob} variant
 * @returns {@link JobResult} from the matched processor
 * @throws Error for unknown job types
 */
async function processJob(job: RobinJob): Promise<JobResult> {
  switch (job.type) {
    case 'extraction':
      return processExtractionJob(job)
    case 'link':
      return processLinkJob(job)
    case 'reclassify':
      return processReclassifyJob(job)
    case 'sync':
      return processSyncJob(job)
    case 'regen':
      return processRegenJob(job)
    case 'regen-batch':
      return processRegenBatchJob(job)
    case 'write':
      return processWriteJob(job)
    default:
      throw new Error(`Unknown job type: ${(job as any).type}`)
  }
}

/***********************************************************************
 * ## Vault & Config Bootstrapping
 *
 * @remarks First-run setup for new users. Both functions are idempotent
 * — safe to call on every provision.
 *
 * @see {@link processProvisionJob} — orchestrates these calls
 * @see {@link CONFIG_NOTE_BOOTSTRAPS} — seed data from `@robin/shared`
 ***********************************************************************/

/**
 * Create default vaults for a new user if none exist.
 *
 * @remarks
 * Creates two vaults:
 * - **Robin** (`system`) — holds system configuration
 * - **User inbox** (`inbox`) — default destination for new entries
 *
 * @param userId   - User to bootstrap
 * @param userName - User's display name (falls back to `"My Notes"`)
 */
async function bootstrapDefaultVaults(userId: string, userName: string | null) {
  /** @gate — user already has vaults → skip */
  const existing = await db.select({ id: vaults.id }).from(vaults).where(eq(vaults.userId, userId))
  if (existing.length > 0) {
    log.debug({ userId, count: existing.length }, 'user already has vaults, skipping bootstrap')
    return
  }

  /** @step 1 — Generate vault IDs and derive slug from user name */
  const robinId = makeLookupKey('vault')
  const defaultId = makeLookupKey('vault')
  const defaultName = userName?.trim() || 'My Notes'
  const defaultSlug = defaultName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  /** @step 2 — Insert system + inbox vaults */
  await db.insert(vaults).values([
    {
      id: robinId,
      userId,
      name: 'Robin',
      slug: 'robin',
      icon: 'PiRobotDuotone',
      description: 'System configuration and settings',
      type: 'system',
    },
    {
      id: defaultId,
      userId,
      name: defaultName,
      slug: defaultSlug,
      icon: 'PiTrayDuotone',
      description: 'Default vault for new entries',
      type: 'inbox',
    },
  ])

  log.info({ userId, robinId, defaultId }, 'bootstrapped vaults')
}

/***********************************************************************
 * ## Provision Job Processor
 *
 * @remarks New-user onboarding: vaults → keypair →
 * git repo via gateway → persist keys. Fully idempotent — safe to
 * re-run on failed attempts.
 *
 * @see {@link bootstrapDefaultVaults} — vault creation
 * @see {@link generateKeypair} — SSH keypair generation
 * @see {@link gatewayClient.provision} — git repo provisioning
 ***********************************************************************/

/**
 * Provision a new user: vaults, keypair, and git repo.
 *
 * @param job - {@link ProvisionJob} with userId
 * @returns {@link JobResult} with success/failure status
 * @throws Error on keypair generation or gateway failure (BullMQ retries)
 */
export async function processProvisionJob(job: ProvisionJob): Promise<JobResult> {
  const { userId, jobId } = job
  log.info({ jobId, userId }, 'processing provision job')

  /** @step 1 — Load user record */
  const [user] = await db.select().from(users).where(eq(users.id, userId))

  /** @gate — user not found → abort */
  if (!user) {
    log.error({ userId }, 'provision: user not found')
    return {
      jobId,
      success: false,
      error: 'user not found',
      processedAt: new Date().toISOString(),
    }
  }

  /** @step 2 — Bootstrap vaults */
  await bootstrapDefaultVaults(userId, user.name)

  try {
    /** @step 3 — Generate keypair if missing */
    let publicKey = user.publicKey ?? ''
    let encryptedPrivateKey = user.encryptedPrivateKey ?? ''

    if (!publicKey || !encryptedPrivateKey) {
      const keySecret = process.env.KEY_ENCRYPTION_SECRET
      if (!keySecret) throw new Error('KEY_ENCRYPTION_SECRET is not set')
      const keys = generateKeypair(keySecret)
      publicKey = keys.publicKey
      encryptedPrivateKey = keys.encryptedPrivateKey
      log.info({ userId, pubkeyLen: publicKey.length }, 'generated keypair')
    }

    /** @step 4 — Provision git repo via gateway (idempotent) */
    await gatewayClient.provision(userId, publicKey)
    log.info({ userId }, 'gateway provisioned')

    /** @step 5 — Persist keys to DB (only after gateway succeeds) */
    await db.update(users).set({ publicKey, encryptedPrivateKey }).where(eq(users.id, userId))
    log.debug({ userId }, 'provision: DB updated')

    return { jobId, success: true, processedAt: new Date().toISOString() }
  } catch (err) {
    log.error({ userId, err }, 'provision failed')
    throw err
  }
}

/***********************************************************************
 * ## Scheduler Worker
 *
 * @remarks Runs {@link processRegenBatchJob} on a cron schedule.
 * Dedicated BullMQ worker with `concurrency: 1` ensures only one
 * regen batch runs at a time.
 *
 * @see {@link setupRegenScheduler} — cron configuration
 * @see {@link QUEUE_NAMES.scheduler} — queue name
 ***********************************************************************/

function startSchedulerWorker(): void {
  import('@robin/queue')
    .then(({ Worker: BullWorker }) => {
      const schedulerQueue = producer.getQueue(QUEUE_NAMES.scheduler)
      const schedulerWorker = new BullWorker(
        QUEUE_NAMES.scheduler,
        async (bullJob) => processRegenBatchJob(bullJob.data),
        { connection, concurrency: 1, autorun: true }
      )
      schedulerWorker.on('completed', (job) => {
        log.info({ jobId: job.id }, 'scheduler job completed')
      })
      schedulerWorker.on('failed', (job, err) => {
        log.error({ jobId: job?.id, err }, 'scheduler job failed')
      })
      setupRegenScheduler(schedulerQueue).catch((err) =>
        log.error({ err }, 'failed to set up regen scheduler')
      )
      log.info('scheduler worker started')
    })
    .catch((err) => log.error({ err }, 'scheduler worker failed to start'))
}

/***********************************************************************
 * ## Worker Lifecycle
 *
 * @remarks {@link startWorkers} is the main entry point called from
 * `index.ts`. Spins up provision worker, scheduler worker, and one
 * per-user write worker for every existing user.
 *
 * @see {@link spawnWriteWorker} — on-demand worker for new users
 ***********************************************************************/

/**
 * Start all background workers: provision, scheduler, and per-user write workers.
 *
 * @remarks Called once at server startup from `index.ts`.
 */
export function startWorkers() {
  /** @step 1 — Start shared provision worker */
  const provisionWorker = bullWorker.startProvisionWorker(processProvisionJob)
  provisionWorker.on('completed', (job) => {
    log.info({ jobId: job.id }, 'provision job completed')
  })
  provisionWorker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, 'provision job failed')
  })

  /** @step 2 — Start scheduler worker for regen-batch jobs */
  startSchedulerWorker()

  /** @step 3 — Spawn per-user write workers for all existing users */
  db.select({ id: users.id })
    .from(users)
    .then((rows) => {
      for (const { id } of rows) {
        spawnWriteWorker(id)
      }
      log.info({ count: rows.length }, 'started write workers')
    })
    .catch((err) => log.error({ err }, 'failed to load users for workers'))
}

const activeWriteWorkers = new Map<string, ReturnType<typeof bullWorker.startWriteWorker>>()

/**
 * Spawn a dedicated write worker for a user (idempotent).
 *
 * @remarks
 * Each user gets their own BullMQ worker so jobs for one user don't
 * block another. Tracked in `activeWriteWorkers`, auto-cleaned on close.
 *
 * @param userId - User to spawn a write worker for
 *
 * @see {@link processJob} — dispatcher used as the worker's processor
 */
export function spawnWriteWorker(userId: string): void {
  /** @gate — already running → no-op */
  if (activeWriteWorkers.has(userId)) return

  const worker = bullWorker.startWriteWorker(userId, processJob as any)
  activeWriteWorkers.set(userId, worker)

  worker.on('completed', (job) => {
    log.info({ userId, jobId: job.id }, 'job completed')
  })

  worker.on('failed', (job, err) => {
    log.error({ userId, jobId: job?.id, err }, 'job failed')
  })

  worker.on('closed', () => {
    activeWriteWorkers.delete(userId)
  })
}
