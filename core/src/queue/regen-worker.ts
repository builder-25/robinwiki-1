import type { JobResult, RegenJob, RegenBatchJob } from '@robin/queue'
import { eq, and, isNull, lt, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { wikis, edges, fragments } from '../db/schema.js'
import { regenerateWiki } from '../lib/regen.js'
import { producer } from './producer.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'regen-worker' })

/** Max wikis to process in a single batch job */
const BATCH_LIMIT = 5

/** Wikis older than this many hours are candidates for batch regen */
const STALE_HOURS = 24

export async function processRegenJob(job: RegenJob): Promise<JobResult> {
  log.info({ jobId: job.jobId, wikiKey: job.objectKey }, 'processing regen job')

  try {
    const result = await regenerateWiki(db, job.objectKey)
    log.info(
      { jobId: job.jobId, wikiKey: job.objectKey, fragmentCount: result.fragmentCount },
      'regen job completed'
    )
    return {
      jobId: job.jobId,
      success: true,
      processedAt: new Date().toISOString(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ jobId: job.jobId, wikiKey: job.objectKey, error: message }, 'regen job failed')
    return {
      jobId: job.jobId,
      success: false,
      error: message,
      processedAt: new Date().toISOString(),
    }
  }
}

export async function processRegenBatchJob(job: RegenBatchJob): Promise<JobResult> {
  log.info({ jobId: job.jobId }, 'processing regen batch job')

  try {
    // Count unfiled fragments (fragments with embedding but no FRAGMENT_IN_WIKI edge)
    const [unfiledCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fragments)
      .where(
        and(
          isNull(fragments.deletedAt),
          sql`${fragments.embedding} IS NOT NULL`,
          sql`${fragments.lookupKey} NOT IN (
            SELECT src_id FROM edges
            WHERE edge_type = 'FRAGMENT_IN_WIKI' AND deleted_at IS NULL
          )`
        )
      )

    const hasUnfiled = (unfiledCount?.count ?? 0) > 0

    // Find regen-eligible wikis:
    // 1. regenerate=true wikis (existing logic)
    // 2. ALL regenerate=true wikis if there are unfiled fragments
    //    (mechanism #1 in regenerateWiki will classify unfiled fragments before generating content)
    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000)

    let wikiKeysToRegen: string[]

    if (hasUnfiled) {
      // When unfiled fragments exist, regen all non-deleted wikis with regenerate=true
      // (mechanism #1 in regenerateWiki will classify unfiled fragments before generating)
      const allWikis = await db
        .select({ lookupKey: wikis.lookupKey })
        .from(wikis)
        .where(and(isNull(wikis.deletedAt), eq(wikis.regenerate, true)))
        .limit(BATCH_LIMIT)
      wikiKeysToRegen = allWikis.map(w => w.lookupKey)
    } else {
      // No unfiled fragments -- only regen stale wikis that have existing fragments
      const staleWikis = await db
        .select({ lookupKey: wikis.lookupKey })
        .from(wikis)
        .where(
          and(
            isNull(wikis.deletedAt),
            eq(wikis.regenerate, true),
            lt(wikis.lastRebuiltAt, cutoff)
          )
        )
        .limit(BATCH_LIMIT)

      const toRegen: string[] = []
      for (const wiki of staleWikis) {
        const [hasEdge] = await db
          .select({ count: sql<number>`count(*)` })
          .from(edges)
          .where(
            and(
              eq(edges.dstId, wiki.lookupKey),
              eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
              isNull(edges.deletedAt)
            )
          )
        if (hasEdge && hasEdge.count > 0) toRegen.push(wiki.lookupKey)
      }
      wikiKeysToRegen = toRegen
    }

    // Enqueue individual regen jobs (not inline -- each regen runs classifyUnfiledFragments)
    let enqueued = 0
    for (const wikiKey of wikiKeysToRegen) {
      try {
        await producer.enqueueRegen({
          type: 'regen',
          jobId: crypto.randomUUID(),
          objectKey: wikiKey,
          objectType: 'wiki',
          triggeredBy: 'scheduler',
          enqueuedAt: new Date().toISOString(),
        })
        enqueued++
      } catch (err) {
        log.warn({ wikiKey, err }, 'batch regen: failed to enqueue regen job')
      }
    }

    log.info({ jobId: job.jobId, enqueued, hasUnfiled, total: wikiKeysToRegen.length }, 'regen batch completed')

    return { jobId: job.jobId, success: true, processedAt: new Date().toISOString() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ jobId: job.jobId, error: message }, 'regen batch job failed')
    return {
      jobId: job.jobId,
      success: false,
      error: message,
      processedAt: new Date().toISOString(),
    }
  }
}
