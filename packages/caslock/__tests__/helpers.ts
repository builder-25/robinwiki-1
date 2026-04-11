import { vi } from 'vitest'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

export const widgets = pgTable('widgets', {
  lookupKey: text('lookup_key').primaryKey(),
  state: text('state').notNull(),
  lockedBy: text('locked_by'),
  lockedAt: timestamp('locked_at'),
  updatedAt: timestamp('updated_at').notNull(),
  payload: text('payload'),
})

const dialect = new PgDialect()

export function renderSql(query: SQL): { sql: string; params: unknown[] } {
  const built = dialect.sqlToQuery(query)
  return { sql: built.sql, params: built.params as unknown[] }
}

export interface MockDbCall {
  query: SQL
  rendered: { sql: string; params: unknown[] }
}

export function makeMockDb(responses: unknown[] = []) {
  const calls: MockDbCall[] = []
  let idx = 0
  const execute = vi.fn(async (q: SQL) => {
    calls.push({ query: q, rendered: renderSql(q) })
    const res = idx < responses.length ? responses[idx] : []
    idx += 1
    return res as never
  })
  const db = { execute } as unknown as import('drizzle-orm/node-postgres').NodePgDatabase<any>
  return { db, execute, calls }
}

export function rowResult(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows
}
