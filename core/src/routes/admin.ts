import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import type { LinkJob } from '@robin/queue'
import { db } from '../db/client.js'
import { fragments, entries } from '../db/schema.js'
import { producer } from '../queue/producer.js'
import { logger } from '../lib/logger.js'
import {
  retryStuckDryRunResponseSchema,
  retryStuckResponseSchema,
} from '../schemas/admin.schema.js'

const log = logger.child({ component: 'admin' })

export const adminRoutes = new Hono()

/**
 * POST /admin/retry-stuck
 *
 * Finds PENDING fragments older than ?minutes (default 5) and re-enqueues
 * their link jobs. No auth — intended for curl from the dev machine.
 *
 * Query params:
 *   minutes  — age threshold (default 5)
 *   dryRun   — if "true", returns what would be re-enqueued without doing it
 */
adminRoutes.post('/retry-stuck', async (c) => {
  const minutes = Number(c.req.query('minutes') ?? '5')
  const dryRun = c.req.query('dryRun') === 'true'

  const stuckFragments = (await db.execute(
    sql`SELECT f.lookup_key, f.entry_id, e.vault_id, e.content
        FROM ${fragments} f
        JOIN ${entries} e ON e.lookup_key = f.entry_id
        WHERE f.state = 'PENDING'
          AND f.locked_by IS NULL
          AND f.updated_at < NOW() - INTERVAL '${sql.raw(String(minutes))} minutes'
        ORDER BY f.updated_at ASC`
  )) as Array<{
    lookup_key: string
    entry_id: string
    vault_id: string | null
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
      vaultId: row.vault_id ?? '',
      fragmentContent: row.content ?? '',
      enqueuedAt: new Date().toISOString(),
    }
    await producer.enqueueLink(linkJob)
    enqueued++
  }

  log.info({ enqueued, errors: errors.length, minutes }, 'retry-stuck completed')
  return c.json(retryStuckResponseSchema.parse({ enqueued, errors, minutes }))
})
