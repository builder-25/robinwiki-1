import { Hono } from 'hono'
import { and, eq, sql } from 'drizzle-orm'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { fragments } from '../db/schema.js'
import { searchQuerySchema, searchResponseSchema } from '../schemas/search.schema.js'

const search = new Hono()
search.use('*', sessionMiddleware)

// GET /search — Postgres-backed full-text search over fragments
// TODO(phase-5): score with hybrid BM25 + pgvector reranking
search.get('/', async (c) => {
  const parsed = searchQuerySchema.safeParse({
    q: c.req.query('q'),
    limit: c.req.query('limit'),
    minScore: c.req.query('minScore'),
    vaultId: c.req.query('vaultId'),
  })
  if (!parsed.success)
    return c.json({ error: 'Validation failed', fields: parsed.error.flatten() }, 400)

  const { q, limit, vaultId } = parsed.data

  const tsQuery = sql`plainto_tsquery('english', ${q})`
  const conditions = [sql`${fragments.searchVector} @@ ${tsQuery}`]
  if (vaultId) conditions.push(eq(fragments.vaultId, vaultId))

  const rows = await db
    .select({
      lookupKey: fragments.lookupKey,
      title: fragments.title,
      tags: fragments.tags,
      vaultId: fragments.vaultId,
      score: sql<number>`ts_rank(${fragments.searchVector}, ${tsQuery})`,
    })
    .from(fragments)
    .where(and(...conditions))
    .orderBy(sql`ts_rank(${fragments.searchVector}, ${tsQuery}) DESC`)
    .limit(limit)

  const enriched = rows.map((r) => ({
    score: Number(r.score ?? 0),
    fragmentId: r.lookupKey,
    title: r.title,
    fragment: '',
    tags: r.tags,
    vaultId: r.vaultId ?? undefined,
    threadId: undefined,
  }))

  return c.json(searchResponseSchema.parse({ results: enriched }))
})

export { search }
