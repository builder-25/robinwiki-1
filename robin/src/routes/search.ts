import { Hono } from 'hono'
import { eq, and, inArray } from 'drizzle-orm'
import { sessionMiddleware } from '../middleware/session.js'
import { gatewayClient } from '../gateway/client.js'
import { db } from '../db/client.js'
import { fragments } from '../db/schema.js'
import { searchQuerySchema, searchResponseSchema } from '../schemas/search.schema.js'

const search = new Hono()
search.use('*', sessionMiddleware)

// TODO(phase-5): rewrite search to use edges for thread scoping (vault scoping done via gateway-level repoPaths filter)
search.get('/', async (c) => {
  const userId = c.get('userId') as string
  const parsed = searchQuerySchema.safeParse({
    q: c.req.query('q'),
    limit: c.req.query('limit'),
    minScore: c.req.query('minScore'),
    vaultId: c.req.query('vaultId'),
  })
  if (!parsed.success)
    return c.json({ error: 'Validation failed', fields: parsed.error.flatten() }, 400)

  const { q, limit, minScore, vaultId } = parsed.data

  // Resolve vaultId to repoPaths for gateway-level vault scoping (D-02)
  let repoPaths: string[] | undefined
  if (vaultId) {
    const vaultFragments = await db
      .select({ repoPath: fragments.repoPath })
      .from(fragments)
      .where(and(eq(fragments.userId, userId), eq(fragments.vaultId, vaultId)))
    repoPaths = vaultFragments.map((f) => f.repoPath).filter(Boolean) as string[]
  }

  // Get search results from gateway (BM25 + vector), filtered to vault scope if specified
  const gatewayResults = await gatewayClient.search(userId, q, limit, minScore, repoPaths)

  // Extract file paths from results to join with fragment metadata
  const resultPaths = (gatewayResults.results ?? []).map((r: { path: string }) => r.path)

  if (resultPaths.length === 0) {
    return c.json(searchResponseSchema.parse({ results: [] }))
  }

  // Look up fragment metadata for matching paths only
  const allFragments = await db
    .select()
    .from(fragments)
    .where(and(eq(fragments.userId, userId), inArray(fragments.repoPath, resultPaths)))

  const enriched = (gatewayResults.results ?? [])
    .map((r: { path: string; score: number; fragment?: string }) => {
      const frag = allFragments.find((f) => f.repoPath === r.path)
      if (!frag) return null
      return {
        score: r.score,
        fragmentId: frag.lookupKey,
        title: frag.title,
        fragment: r.fragment ?? '',
        tags: frag.tags,
        vaultId: undefined, // TODO(phase-5): resolve via parent entry
        threadId: undefined, // TODO(phase-5): resolve via edges
      }
    })
    .filter(Boolean)

  return c.json(searchResponseSchema.parse({ results: enriched }))
})

export { search }
