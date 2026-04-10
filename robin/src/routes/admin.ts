import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import type { LinkJob } from '@robin/queue'
import { db } from '../db/client.js'
import { fragments, entries } from '../db/schema.js'
import { gatewayClient } from '../gateway/client.js'
import { producer } from '../queue/producer.js'
import { logger } from '../lib/logger.js'
import {
  retryStuckDryRunResponseSchema,
  retryStuckResponseSchema,
} from '../schemas/admin.schema.js'

const log = logger.child({ component: 'admin' })

export const adminRoutes = new Hono()

/** Strip YAML frontmatter (--- ... ---) and return just the body */
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return raw
  return raw.slice(end + 4).trim()
}

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
    sql`SELECT f.lookup_key, f.user_id, f.entry_id, f.repo_path, e.vault_id
        FROM ${fragments} f
        JOIN ${entries} e ON e.lookup_key = f.entry_id
        WHERE f.state = 'PENDING'
          AND f.locked_by IS NULL
          AND f.updated_at < NOW() - INTERVAL '${sql.raw(String(minutes))} minutes'
        ORDER BY f.updated_at ASC`
  )) as any[]

  if (dryRun) {
    return c.json(
      retryStuckDryRunResponseSchema.parse({
        dryRun: true,
        count: stuckFragments.length,
        fragments: stuckFragments.map((r) => ({
          fragmentKey: r.lookup_key,
          userId: r.user_id,
          entryKey: r.entry_id,
        })),
      })
    )
  }

  let enqueued = 0
  const errors: Array<{ fragmentKey: string; error: string }> = []

  for (const row of stuckFragments) {
    // Read fragment content from git via gateway
    let fragmentContent = ''
    if (row.repo_path) {
      try {
        const { content } = await gatewayClient.read(row.user_id, row.repo_path)
        fragmentContent = stripFrontmatter(content)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push({ fragmentKey: row.lookup_key, error: msg })
        log.warn({ fragmentKey: row.lookup_key, err: msg }, 'failed to read fragment from gateway')
        continue
      }
    }

    const linkJob: LinkJob = {
      type: 'link',
      jobId: crypto.randomUUID(),
      userId: row.user_id,
      fragmentKey: row.lookup_key,
      entryKey: row.entry_id,
      vaultId: row.vault_id ?? '',
      fragmentContent,
      enqueuedAt: new Date().toISOString(),
    }
    await producer.enqueueLinkJob(row.user_id, linkJob)
    enqueued++
  }

  log.info({ enqueued, errors: errors.length, minutes }, 'retry-stuck completed')
  return c.json(retryStuckResponseSchema.parse({ enqueued, errors, minutes }))
})
