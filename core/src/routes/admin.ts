import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import type { LinkJob } from '@robin/queue'
import { db } from '../db/client.js'
import { fragments, entries } from '../db/schema.js'
import { producer } from '../queue/producer.js'
import { logger } from '../lib/logger.js'
import { sessionMiddleware } from '../middleware/session.js'
import {
  retryStuckDryRunResponseSchema,
  retryStuckResponseSchema,
} from '../schemas/admin.schema.js'

const log = logger.child({ component: 'admin' })

export const adminRoutes = new Hono()
adminRoutes.use('*', sessionMiddleware)

/**
 * POST /admin/retry-stuck
 *
 * Finds PENDING fragments older than ?minutes (default 5) and re-enqueues
 * their link jobs. Session-authenticated.
 *
 * Query params:
 *   minutes  — age threshold (default 5, clamped 1-1440)
 *   dryRun   — if "true", returns what would be re-enqueued without doing it
 */
adminRoutes.post('/retry-stuck', async (c) => {
  const minutes = Math.max(1, Math.min(1440, Number(c.req.query('minutes') ?? '5') || 5))
  const dryRun = c.req.query('dryRun') === 'true'

  const stuckFragments = (await db.execute(
    sql`SELECT f.lookup_key, f.entry_id, e.content
        FROM ${fragments} f
        JOIN ${entries} e ON e.lookup_key = f.entry_id
        WHERE f.state = 'PENDING'
          AND f.locked_by IS NULL
          AND f.updated_at < NOW() - make_interval(mins => ${minutes})
        ORDER BY f.updated_at ASC`
  )) as Array<{
    lookup_key: string
    entry_id: string
    content: string
  }>

  if (dryRun) {
    return c.json(
      retryStuckDryRunResponseSchema.parse({
        dryRun: true,
        count: stuckFragments.length,
        fragments: stuckFragments.map((r) => ({
          fragmentKey: r.lookup_key,
          entryKey: r.entry_id,
        })),
      })
    )
  }

  let enqueued = 0
  const errors: Array<{ fragmentKey: string; error: string }> = []

  for (const row of stuckFragments) {
    const linkJob: LinkJob = {
      type: 'link',
      jobId: crypto.randomUUID(),
      fragmentKey: row.lookup_key,
      entryKey: row.entry_id,
      fragmentContent: row.content ?? '',
      enqueuedAt: new Date().toISOString(),
    }
    await producer.enqueueLink(linkJob)
    enqueued++
  }

  log.info({ enqueued, errors: errors.length, minutes }, 'retry-stuck completed')
  return c.json(retryStuckResponseSchema.parse({ enqueued, errors, minutes }))
})
