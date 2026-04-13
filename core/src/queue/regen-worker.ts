import type { JobResult, RegenJob, RegenBatchJob } from '@robin/queue'
import { eq, and, isNull, lt, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { wikis, edges } from '../db/schema.js'
import { regenerateWiki } from '../lib/regen.js'
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
    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000)

    // Find wikis with lastRebuiltAt older than the cutoff that have linked fragments
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

    // Filter to wikis that actually have fragments linked since last rebuild
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
      if (hasEdge && hasEdge.count > 0) {
        toRegen.push(wiki.lookupKey)
      }
    }

    let succeeded = 0
    let failed = 0
    for (const wikiKey of toRegen) {
      try {
        await regenerateWiki(db, wikiKey)
        succeeded++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log.warn({ wikiKey, error: message }, 'batch regen failed for wiki')
        failed++
      }
    }

    log.info({ jobId: job.jobId, succeeded, failed, total: toRegen.length }, 'regen batch completed')

    return {
      jobId: job.jobId,
      success: failed === 0,
      processedAt: new Date().toISOString(),
    }
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
