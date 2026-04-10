import { Hono } from 'hono'
import { and, eq, isNull, inArray } from 'drizzle-orm'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { edges, entries, fragments, threads, vaults, people } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import { graphResponseSchema } from '../schemas/graph.schema.js'

const log = logger.child({ component: 'graph' })

const EDGE_TYPE_MAP: Record<string, string> = {
  ENTRY_HAS_FRAGMENT: 'filing',
  FRAGMENT_IN_THREAD: 'filing',
  FRAGMENT_MENTIONS_PERSON: 'mention',
  FRAGMENT_RELATED_TO_FRAGMENT: 'wikilink',
  ENTRY_IN_VAULT: 'filing',
}

const graphRouter = new Hono()
graphRouter.use('*', sessionMiddleware)

// GET /graph — build graph nodes and edges from the edges table
graphRouter.get('/', async (c) => {
  const userId = c.get('userId') as string
  const vaultId = c.req.query('vaultId')

  // 1. Query all edges for the user
  let edgeRows = await db
    .select()
    .from(edges)
    .where(and(eq(edges.userId, userId), isNull(edges.deletedAt)))

  // 2. If vaultId filter, find entries/fragments in that vault, then filter edges
  if (vaultId) {
    const vaultEntryKeys = await db
      .select({ key: entries.lookupKey })
      .from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.vaultId, vaultId)))

    const vaultFragmentKeys = await db
      .select({ key: fragments.lookupKey })
      .from(fragments)
      .where(
        and(
          eq(fragments.userId, userId),
          inArray(
            fragments.entryId,
            vaultEntryKeys.map((e) => e.key)
          )
        )
      )

    const vaultKeySet = new Set([
      ...vaultEntryKeys.map((e) => e.key),
      ...vaultFragmentKeys.map((f) => f.key),
      vaultId,
    ])

    edgeRows = edgeRows.filter((e) => vaultKeySet.has(e.srcId) || vaultKeySet.has(e.dstId))
  }

  if (edgeRows.length === 0) {
    return c.json({ nodes: [], edges: [] })
  }

  // 3. Collect unique node identifiers
  // DB stores "frag" as edge src/dst type; normalize to "fragment" for API consistency
  const normalizeType = (t: string) => (t === 'frag' ? 'fragment' : t)
  const nodeSet = new Map<string, { type: string; id: string; edgeCount: number }>()
  for (const e of edgeRows) {
    const srcType = normalizeType(e.srcType)
    const dstType = normalizeType(e.dstType)
    const srcKey = `${srcType}:${e.srcId}`
    const dstKey = `${dstType}:${e.dstId}`
    if (!nodeSet.has(srcKey)) nodeSet.set(srcKey, { type: srcType, id: e.srcId, edgeCount: 0 })
    if (!nodeSet.has(dstKey)) nodeSet.set(dstKey, { type: dstType, id: e.dstId, edgeCount: 0 })
    const srcNode = nodeSet.get(srcKey)
    if (srcNode) srcNode.edgeCount++
    const dstNode = nodeSet.get(dstKey)
    if (dstNode) dstNode.edgeCount++
  }

  // 4. Batch-resolve labels
  const idsByType: Record<string, string[]> = {}
  for (const n of nodeSet.values()) {
    if (!idsByType[n.type]) idsByType[n.type] = []
    idsByType[n.type].push(n.id)
  }

  const labelMap: Record<string, { label: string; vaultId: string }> = {}

  if (idsByType.entry?.length) {
    const rows = await db
      .select({
        key: entries.lookupKey,
        title: entries.title,
        vaultId: entries.vaultId,
      })
      .from(entries)
      .where(inArray(entries.lookupKey, idsByType.entry))
    for (const r of rows)
      labelMap[`entry:${r.key}`] = {
        label: r.title || 'Untitled Entry',
        vaultId: r.vaultId ?? '',
      }
  }
  if (idsByType.fragment?.length) {
    const rows = await db
      .select({
        key: fragments.lookupKey,
        title: fragments.title,
        entryId: fragments.entryId,
      })
      .from(fragments)
      .where(inArray(fragments.lookupKey, idsByType.fragment))
    // For fragment vaultId, look up via entry
    const entryIds = [...new Set(rows.map((r) => r.entryId).filter((id): id is string => id !== null))]
    const entryVaults: Record<string, string> = {}
    if (entryIds.length) {
      const entryRows = await db
        .select({ key: entries.lookupKey, vaultId: entries.vaultId })
        .from(entries)
        .where(inArray(entries.lookupKey, entryIds))
      for (const e of entryRows) entryVaults[e.key] = e.vaultId ?? ''
    }
    for (const r of rows)
      labelMap[`fragment:${r.key}`] = {
        label: r.title || 'Untitled Fragment',
        vaultId: entryVaults[r.entryId] ?? '',
      }
  }
  if (idsByType.thread?.length) {
    const rows = await db
      .select({ key: threads.lookupKey, name: threads.name })
      .from(threads)
      .where(inArray(threads.lookupKey, idsByType.thread))
    for (const r of rows) labelMap[`thread:${r.key}`] = { label: r.name, vaultId: '' }
  }
  if (idsByType.vault?.length) {
    const rows = await db
      .select({ id: vaults.id, name: vaults.name })
      .from(vaults)
      .where(inArray(vaults.id, idsByType.vault))
    for (const r of rows) labelMap[`vault:${r.id}`] = { label: r.name, vaultId: r.id }
  }
  if (idsByType.person?.length) {
    const rows = await db
      .select({ key: people.lookupKey, name: people.name })
      .from(people)
      .where(inArray(people.lookupKey, idsByType.person))
    for (const r of rows) labelMap[`person:${r.key}`] = { label: r.name, vaultId: '' }
  }

  // 5. Build nodes array
  const nodes = [...nodeSet.entries()].map(([key, n]) => {
    const resolved = labelMap[key]
    return {
      id: n.id,
      label: resolved?.label ?? n.id,
      type: n.type as 'thread' | 'fragment' | 'person' | 'entry' | 'vault',
      vaultId: resolved?.vaultId ?? '',
      size: n.edgeCount,
    }
  })

  // 6. Build edges array
  const graphEdges = edgeRows.map((e) => ({
    source: e.srcId,
    target: e.dstId,
    edgeType: (EDGE_TYPE_MAP[e.edgeType] ?? 'filing') as 'filing' | 'wikilink' | 'mention',
  }))

  log.debug({ nodeCount: nodes.length, edgeCount: graphEdges.length }, 'built graph')
  return c.json(graphResponseSchema.parse({ nodes, edges: graphEdges }))
})

export { graphRouter as graphRoutes }
