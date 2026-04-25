import { eq, and, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { wikis, people, fragments, entries } from '../db/schema.js'

const TABLE_MAP = {
  wiki: wikis,
  person: people,
  fragment: fragments,
  entry: entries,
} as const

/** Priority order for unqualified wiki-link resolution */
const RESOLUTION_PRIORITY = ['wiki', 'person', 'fragment', 'entry'] as const

/**
 * Create a DB-backed wiki-link lookup function.
 * Returns a function matching the signature expected by resolveWikiLinks().
 * Accepts optional db instance for testing.
 */
export function createWikiLookupFn(
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
      const table = TABLE_MAP[type as keyof typeof TABLE_MAP]
      if (!table) return null
      const [row] = await resolvedDb
        .select({ lookupKey: table.lookupKey })
        .from(table)
        .where(and(eq(table.slug, slug), isNull(table.deletedAt)))
        .limit(1)
      return row ? { type, key: row.lookupKey } : null
    }

    for (const t of RESOLUTION_PRIORITY) {
      const table = TABLE_MAP[t as keyof typeof TABLE_MAP]
      if (!table) continue
      const [row] = await resolvedDb
        .select({ lookupKey: table.lookupKey })
        .from(table)
        .where(and(eq(table.slug, slug), isNull(table.deletedAt)))
        .limit(1)
      if (row) return { type: t, key: row.lookupKey }
    }

    return null
  }
}
