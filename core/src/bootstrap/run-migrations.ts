import { readFileSync } from 'node:fs'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from '../db/client.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'migrations' })

/**
 * Run pending Drizzle migrations. Idempotent -- safe to call on every boot.
 * Logs which migrations were applied (or "no pending migrations" if none).
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = new URL('../../drizzle/migrations', import.meta.url).pathname

  // Read the journal to know which migrations exist on disk
  let journalEntries: { tag: string }[] = []
  try {
    const journalPath = new URL('../../drizzle/migrations/meta/_journal.json', import.meta.url)
      .pathname
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
    journalEntries = journal.entries ?? []
  } catch {
    log.warn('could not read migration journal — assuming first run')
  }

  // Count already-applied migrations before running
  let appliedBefore = 0
  try {
    const rows = await db.execute<{ created_at: number }>(
      /* sql */ `SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at`
    )
    appliedBefore = Array.isArray(rows) ? rows.length : 0
  } catch {
    // Table doesn't exist yet — first run, zero applied
    appliedBefore = 0
  }

  // Run Drizzle migrate (applies any pending, skips already-applied)
  await migrate(db, { migrationsFolder })

  // Count applied after
  let appliedAfter = 0
  try {
    const rows = await db.execute<{ created_at: number }>(
      /* sql */ `SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at`
    )
    appliedAfter = Array.isArray(rows) ? rows.length : 0
  } catch {
    appliedAfter = appliedBefore
  }

  const newCount = appliedAfter - appliedBefore
  if (newCount > 0) {
    // Log each newly applied migration by tag
    const newTags = journalEntries.slice(appliedBefore, appliedAfter)
    for (const entry of newTags) {
      log.info({ tag: entry.tag, appliedAt: new Date().toISOString() }, 'migration applied')
    }
    log.info({ count: newCount }, `${newCount} migration(s) applied`)
  } else {
    log.info('no pending migrations')
  }
}
