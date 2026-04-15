import { Hono } from 'hono'
import { eq, isNull, inArray } from 'drizzle-orm'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { edges, entries, fragments, wikis, vaults, people } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import { graphResponseSchema } from '../schemas/graph.schema.js'

const log = logger.child({ component: 'graph' })

const EDGE_TYPE_MAP: Record<string, string> = {
  ENTRY_HAS_FRAGMENT: 'filing',
  FRAGMENT_IN_WIKI: 'filing',
  FRAGMENT_MENTIONS_PERSON: 'mention',
  FRAGMENT_RELATED_TO_FRAGMENT: 'wikilink',
  ENTRY_IN_VAULT: 'filing',
  WIKI_RELATED_TO_WIKI: 'wikilink',
}

const graphRouter = new Hono()
graphRouter.use('*', sessionMiddleware)

// GET /graph — build graph nodes and edges from the edges table
graphRouter.get('/', async (c) => {
  const vaultId = c.req.query('vaultId')
  const wikiId = c.req.query('wikiId')

  // 1. Query all edges
  let edgeRows = await db.select().from(edges).where(isNull(edges.deletedAt))

  // 2a. If wikiId filter, return only subgraph for that wiki (its fragments + their people)
  if (wikiId) {
    // Find FRAGMENT_IN_WIKI edges for this wiki
    const wikiFragEdges = edgeRows.filter(
      (e) => e.edgeType === 'FRAGMENT_IN_WIKI' && e.dstId === wikiId
    )
    const fragIds = new Set(wikiFragEdges.map((e) => e.srcId))

    // Include: wiki-fragment edges + any edges from those fragments (e.g. mentions)
    edgeRows = edgeRows.filter(
      (e) =>
        (e.edgeType === 'FRAGMENT_IN_WIKI' && e.dstId === wikiId) ||
        (fragIds.has(e.srcId) && e.srcId !== wikiId)
    )
  }

  // 2b. If vaultId filter, find entries/fragments in that vault, then filter edges
  if (vaultId && !wikiId) {
    const vaultEntryKeys = await db
      .select({ key: entries.lookupKey })
      .from(entries)
      .where(eq(entries.vaultId, vaultId))

    const vaultFragmentKeys = await db
      .select({ key: fragments.lookupKey })
      .from(fragments)
      .where(
        inArray(
          fragments.entryId,
          vaultEntryKeys.map((e) => e.key)
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

  const labelMap: Record<string, { label: string; vaultId: string; snippet: string }> = {}

  if (idsByType.entry?.length) {
    const rows = await db
      .select({
        key: entries.lookupKey,
        title: entries.title,
        vaultId: entries.vaultId,
        content: entries.content,
      })
      .from(entries)
      .where(inArray(entries.lookupKey, idsByType.entry))
    for (const r of rows)
      labelMap[`entry:${r.key}`] = {
        label: r.title || 'Untitled Entry',
        vaultId: r.vaultId ?? '',
        snippet: (r.content ?? '').slice(0, 100),
      }
  }
  if (idsByType.fragment?.length) {
    const rows = await db
      .select({
        key: fragments.lookupKey,
        title: fragments.title,
        entryId: fragments.entryId,
        content: fragments.content,
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
        snippet: (r.content ?? '').slice(0, 100),
      }
  }
  if (idsByType.thread?.length) {
    const rows = await db
      .select({ key: wikis.lookupKey, name: wikis.name, content: wikis.content })
      .from(wikis)
      .where(inArray(wikis.lookupKey, idsByType.thread))
    for (const r of rows)
      labelMap[`thread:${r.key}`] = {
        label: r.name,
        vaultId: '',
        snippet: (r.content ?? '').slice(0, 100),
      }
  }
  if (idsByType.wiki?.length) {
    const rows = await db
      .select({ key: wikis.lookupKey, name: wikis.name, content: wikis.content })
      .from(wikis)
      .where(inArray(wikis.lookupKey, idsByType.wiki))
    for (const r of rows)
      labelMap[`wiki:${r.key}`] = {
        label: r.name,
        vaultId: '',
        snippet: (r.content ?? '').slice(0, 100),
      }
  }
  if (idsByType.vault?.length) {
    const rows = await db
      .select({ id: vaults.id, name: vaults.name })
      .from(vaults)
      .where(inArray(vaults.id, idsByType.vault))
    for (const r of rows)
      labelMap[`vault:${r.id}`] = { label: r.name, vaultId: r.id, snippet: '' }
  }
  if (idsByType.person?.length) {
    const rows = await db
      .select({ key: people.lookupKey, name: people.name, content: people.content })
      .from(people)
      .where(inArray(people.lookupKey, idsByType.person))
    for (const r of rows)
      labelMap[`person:${r.key}`] = {
        label: r.name,
        vaultId: '',
        snippet: (r.content ?? '').slice(0, 100),
      }
  }

  // 5. Build nodes array
  const nodes = [...nodeSet.entries()].map(([key, n]) => {
    const resolved = labelMap[key]
    return {
      id: n.id,
      label: resolved?.label ?? n.id,
      type: n.type as 'wiki' | 'fragment' | 'person' | 'entry' | 'vault',
      vaultId: resolved?.vaultId ?? '',
      size: n.edgeCount,
      snippet: resolved?.snippet ?? '',
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
