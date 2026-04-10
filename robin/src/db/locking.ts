import { sql } from 'drizzle-orm'
import { entries, fragments, threads, people, edges } from './schema.js'
import type { DB } from './client.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'locking' })

// ─── Constants ───

export const LOCK_TTL_SECONDS = 30

// ─── Table registry (dynamic table dispatch) ───

const TABLE_MAP = {
  entries,
  fragments,
  threads,
  people,
} as const

type DomainTableName = keyof typeof TABLE_MAP

// ─── acquireLock ───

/**
 * Atomic CAS lock acquisition. Sets state to LINKING with lockedBy/lockedAt.
 * Succeeds if the row is in `fromState` OR has an expired LINKING lock (>30s).
 * Returns the updated row on success, null if lock is already held.
 */
export async function acquireLock(
  db: DB,
  tableName: DomainTableName,
  lookupKey: string,
  lockedBy: string,
  fromState: string
): Promise<Record<string, unknown> | null> {
  const table = TABLE_MAP[tableName]

  // Use raw SQL for the UPDATE ... FROM subquery to capture previous lockedBy
  const result = await db.execute(
    sql`UPDATE ${table}
        SET state = 'LINKING',
            locked_by = ${lockedBy},
            locked_at = NOW(),
            updated_at = NOW()
        FROM (SELECT locked_by AS prev_locked_by
              FROM ${table}
              WHERE lookup_key = ${lookupKey}) AS old
        WHERE ${table}.lookup_key = ${lookupKey}
          AND (${table}.state = ${fromState}
               OR (${table}.state = 'LINKING'
                   AND ${table}.locked_at < NOW() - INTERVAL '${sql.raw(String(LOCK_TTL_SECONDS))} seconds'))
        RETURNING ${table}.*, old.prev_locked_by`
  )

  if (!result || result.length === 0) {
    return null
  }

  const row = result[0] as Record<string, unknown>

  // Detect stolen lock: prev_locked_by was set and differs from new lockedBy
  if (row.prev_locked_by && row.prev_locked_by !== lockedBy) {
    log.warn({ lookupKey, prevLockedBy: row.prev_locked_by }, 'stole expired lock')
  }

  // Normalize snake_case result to camelCase for consistency with Drizzle select
  return normalizeRow(row)
}

// ─── releaseLock ───

/**
 * Clears lock fields and sets state to the target state (RESOLVED or DIRTY).
 */
export async function releaseLock(
  db: DB,
  tableName: DomainTableName,
  lookupKey: string,
  targetState: string
): Promise<void> {
  const table = TABLE_MAP[tableName]

  await db.execute(
    sql`UPDATE ${table}
        SET state = ${targetState},
            locked_by = NULL,
            locked_at = NULL,
            updated_at = NOW()
        WHERE lookup_key = ${lookupKey}`
  )
}

// ─── canRebuildThread ───

/**
 * Returns false when any fragment linked to the thread (via FRAGMENT_IN_THREAD edges)
 * is in PENDING or LINKING state. Returns true otherwise (all RESOLVED/DIRTY, or no fragments).
 */
export async function canRebuildThread(db: DB, threadLookupKey: string): Promise<boolean> {
  // Count fragments linked to this thread that are in a blocking state
  const result = await db.execute(
    sql`SELECT COUNT(*) AS cnt
        FROM ${edges} e
        JOIN ${fragments} f ON f.lookup_key = e.src_id
        WHERE e.dst_id = ${threadLookupKey}
          AND e.edge_type = 'FRAGMENT_IN_THREAD'
          AND f.state IN ('PENDING', 'LINKING')
        LIMIT 1`
  )

  const count = Number(result[0]?.cnt ?? 0)
  return count === 0
}

// ─── Helpers ───

function toDate(v: unknown): Date | null {
  if (v == null) return null
  if (v instanceof Date) return v
  return new Date(v as string | number)
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    lookupKey: row.lookup_key,
    userId: row.user_id,
    slug: row.slug,
    state: row.state,
    repoPath: row.repo_path,
    frontmatterHash: row.frontmatter_hash,
    bodyHash: row.body_hash,
    contentHash: row.content_hash,
    lockedBy: row.locked_by,
    lockedAt: toDate(row.locked_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    // Keep any extra columns (table-specific)
    title: row.title,
    content: row.content,
    type: row.type,
    source: row.source,
    vaultId: row.vault_id,
    name: row.name,
    tags: row.tags,
    entryId: row.entry_id,
    prompt: row.prompt,
    relationship: row.relationship,
    sections: row.sections,
    lastRebuiltAt: toDate(row.last_rebuilt_at),
  }
}
