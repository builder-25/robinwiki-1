import { Hono } from 'hono'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { searchQuerySchema, searchResponseSchema } from '../schemas/search.schema.js'
import { hybridSearch } from '../lib/search.js'
import { loadOpenRouterConfigFromDb } from '../lib/openrouter-config.js'

const search = new Hono()
search.use('*', sessionMiddleware)

// GET /search — hybrid BM25 + pgvector search across fragments, wikis, people
search.get('/', async (c) => {
  const parsed = searchQuerySchema.safeParse({
    q: c.req.query('q'),
    limit: c.req.query('limit'),
    tables: c.req.query('tables'),
    mode: c.req.query('mode'),
    vaultId: c.req.query('vaultId'),
  })
  if (!parsed.success)
    return c.json({ error: 'Validation failed', fields: parsed.error.flatten() }, 400)

  const { q, limit, tables, mode } = parsed.data

  let embedConfig: { apiKey: string; model: string } | undefined
  if (mode === 'hybrid' || mode === 'vector') {
    try {
      const orConfig = await loadOpenRouterConfigFromDb(db)
      embedConfig = { apiKey: orConfig.apiKey, model: orConfig.embeddingModel }
    } catch {
      // No OpenRouter key configured — fall back to BM25 only
    }
  }

  const results = await hybridSearch(db, q, { limit, tables, mode, embedConfig })

  return c.json(searchResponseSchema.parse({ results }))
})

export { search }
