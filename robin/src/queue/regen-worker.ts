/**
 * Regen worker: delegates single-object regen to @robin/agent,
 * keeps batch orchestration (no LLM) in the server.
 */

import type { RegenJob, RegenBatchJob, JobResult } from '@robin/queue'
import { processRegenJob as agentProcessRegenJob } from '@robin/agent'
import type { RegenDeps } from '@robin/agent'
import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { threads, people, edges, fragments } from '../db/schema.js'
import { acquireLock, releaseLock, canRebuildThread } from '../db/locking.js'
import { gatewayClient } from '../gateway/client.js'
import { producer } from './producer.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'regen' })

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip YAML frontmatter (--- ... ---) and return just the body */
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return raw
  return raw.slice(end + 4).trim()
}

/** Read fragment body content from gateway, falling back to empty string */
async function readFragmentBody(userId: string, repoPath: string): Promise<string> {
  try {
    const { content } = await gatewayClient.read(userId, repoPath)
    return stripFrontmatter(content)
  } catch {
    return ''
  }
}

/** Query fragment keys + repo_paths linked via edges, then read bodies from gateway */
async function loadLinkedFragments(
  userId: string,
  objectKey: string,
  edgeType: string
): Promise<Array<{ lookupKey: string; content: string }>> {
  const fragRows = await db.execute(
    sql`SELECT f.lookup_key, f.repo_path
        FROM ${edges} e
        JOIN ${fragments} f ON f.lookup_key = e.src_id
        WHERE e.dst_id = ${objectKey}
          AND e.edge_type = ${edgeType}
          AND e.deleted_at IS NULL
        ORDER BY f.created_at ASC`
  )

  const results: Array<{ lookupKey: string; content: string }> = []
  for (const r of fragRows as any[]) {
    const content = r.repo_path ? await readFragmentBody(userId, r.repo_path) : ''
    results.push({ lookupKey: r.lookup_key, content })
  }
  return results
}

// ── Build deps for agent regen processor ─────────────────────────────────

function buildRegenDeps(userId: string): RegenDeps {
  return {
    loadThread: async (key) => {
      const rows = await db.execute(sql`SELECT * FROM threads WHERE lookup_key = ${key}`)
      const row = rows[0] as any
      if (!row) return null
      return {
        lookupKey: row.lookup_key,
        name: row.name,
        type: row.type ?? 'log',
        slug: row.slug,
        repoPath: row.repo_path || `threads/${row.slug}.md`,
        prompt: row.prompt ?? '',
        vaultId: row.vault_id ?? null,
      }
    },

    loadFragmentContents: (threadKey) =>
      loadLinkedFragments(userId, threadKey, 'FRAGMENT_IN_THREAD'),

    loadPersonWithFragments: async (personKey) => {
      const personRows = await db.execute(sql`SELECT * FROM people WHERE lookup_key = ${personKey}`)
      const row = personRows[0] as any
      if (!row) return null

      const frags = await loadLinkedFragments(userId, personKey, 'FRAGMENT_MENTIONS_PERSON')

      return {
        person: {
          lookupKey: row.lookup_key,
          name: row.name,
          slug: row.slug,
          repoPath: row.repo_path || `people/${row.slug}.md`,
          sections: row.sections ?? {},
        },
        fragments: frags,
      }
    },

    acquireLock: async (table, key, jobId, fromState) => {
      const result = await acquireLock(db, table as any, key, jobId, fromState)
      return result != null
    },

    releaseLock: (table, key, toState) => releaseLock(db, table as any, key, toState),

    canRebuildThread: (threadKey) => canRebuildThread(db, threadKey),

    batchWrite: async (req) => {
      await gatewayClient.batchWrite(req)
    },

    updateAfterRegen: async (table, key, repoPath) => {
      const tableName = table === 'threads' ? threads : people
      await db.execute(
        sql`UPDATE ${tableName}
            SET last_rebuilt_at = NOW(), state = 'RESOLVED', locked_by = NULL, locked_at = NULL, repo_path = ${repoPath}, updated_at = NOW()
            WHERE lookup_key = ${key}`
      )
    },
  }
}

export async function processRegenJob(job: RegenJob): Promise<JobResult> {
  log.info(
    { jobId: job.jobId, objectType: job.objectType, objectKey: job.objectKey },
    'processing regen job'
  )
  const t0 = performance.now()
  const deps = buildRegenDeps(job.userId)
  const result = await agentProcessRegenJob(deps, job)
  const ms = (performance.now() - t0).toFixed(0)
  log.info({ jobId: job.jobId, ms: Number(ms) }, 'regen job completed')
  return result
}

export async function processRegenBatchJob(job: RegenBatchJob): Promise<JobResult> {
  log.info('processing batch regen scan')
  const t0 = performance.now()

  // Query all DIRTY threads
  const dirtyThreads = (await db.execute(
    sql`SELECT lookup_key, user_id FROM threads WHERE state = 'DIRTY'`
  )) as any[]

  // Query all DIRTY people
  const dirtyPeople = (await db.execute(
    sql`SELECT lookup_key, user_id FROM people WHERE state = 'DIRTY'`
  )) as any[]

  let enqueued = 0

  for (const row of dirtyThreads) {
    const regenJob: RegenJob = {
      type: 'regen',
      jobId: `regen-thread-${row.lookup_key}-${Date.now()}`,
      userId: row.user_id,
      objectKey: row.lookup_key,
      objectType: 'thread',
      triggeredBy: 'scheduler',
      enqueuedAt: new Date().toISOString(),
    }
    await producer.enqueueRegenJob(row.user_id, regenJob)
    enqueued++
  }

  for (const row of dirtyPeople) {
    const regenJob: RegenJob = {
      type: 'regen',
      jobId: `regen-person-${row.lookup_key}-${Date.now()}`,
      userId: row.user_id,
      objectKey: row.lookup_key,
      objectType: 'person',
      triggeredBy: 'scheduler',
      enqueuedAt: new Date().toISOString(),
    }
    await producer.enqueueRegenJob(row.user_id, regenJob)
    enqueued++
  }

  const elapsed = (performance.now() - t0).toFixed(0)
  log.info({ ms: Number(elapsed), enqueued }, 'batch regen scan completed')

  return {
    jobId: job.jobId,
    success: true,
    processedAt: new Date().toISOString(),
  }
}
