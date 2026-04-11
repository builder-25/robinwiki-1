import { eq, and, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { wikis, people, fragments, entries } from '../db/schema.js'
import { logger } from './logger.js'

const log = logger.child({ component: 'wiki-lookup' })

/**
 * Table config for each content type, mapping to the drizzle table and key columns.
 */
const TABLE_MAP = {
  thread: wikis,
  person: people,
  fragment: fragments,
  entry: entries,
} as const

/** Priority order for unqualified wiki-link resolution */
const RESOLUTION_PRIORITY = ['wiki', 'person', 'fragment', 'entry'] as const

/**
 * Create a DB-backed wiki-link lookup function scoped to a user.
 * Returns a function matching the signature expected by resolveWikiLinks().
 * Accepts optional db instance for testing.
 */
export function createWikiLookupFn(
  userId: string,
  db?: PostgresJsDatabase<Record<string, unknown>>
): (slug: string, type?: string) => Promise<{ type: string; key: string } | null> {
  const getDb = async () => {
    if (db) return db
    const { db: defaultDb } = await import('../db/client.js')
    return defaultDb
  }
  return async (slug: string, type?: string): Promise<{ type: string; key: string } | null> => {
    const resolvedDb = await getDb()
    if (type) {
      // Qualified lookup — single table
      const table = TABLE_MAP[type as keyof typeof TABLE_MAP]
      if (!table) return null
      const [row] = await resolvedDb
        .select({ lookupKey: table.lookupKey })
        .from(table)
        .where(and(eq(table.slug, slug), eq(table.userId, userId), isNull(table.deletedAt)))
        .limit(1)
      return row ? { type, key: row.lookupKey } : null
    }

    // Unqualified lookup — try in priority order
    for (const t of RESOLUTION_PRIORITY) {
      const table = TABLE_MAP[t]
      const [row] = await resolvedDb
        .select({ lookupKey: table.lookupKey })
        .from(table)
        .where(and(eq(table.slug, slug), eq(table.userId, userId), isNull(table.deletedAt)))
        .limit(1)
      if (row) return { type: t, key: row.lookupKey }
    }

    return null
  }
}
