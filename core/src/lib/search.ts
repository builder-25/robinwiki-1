import { sql } from 'drizzle-orm'
import { embedText, type EmbedConfig } from '@robin/agent'
import type { DB } from '../db/client.js'
import { fragments, wikis, people } from '../db/schema.js'

export interface SearchResult {
  id: string
  type: 'fragment' | 'wiki' | 'person'
  title: string
  snippet: string
  score: number
}

type SearchTable = 'fragment' | 'wiki' | 'person'

// Reciprocal Rank Fusion: score = sum(1 / (k + rank)) across all lists
function rrfFuse(lists: SearchResult[][], k = 60): SearchResult[] {
  const scores = new Map<string, { result: SearchResult; score: number }>()

  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank]
      const key = `${item.type}:${item.id}`
      const existing = scores.get(key)
      const rrfScore = 1 / (k + rank + 1)
      if (existing) {
        existing.score += rrfScore
      } else {
        scores.set(key, { result: item, score: rrfScore })
      }
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ result, score }) => ({ ...result, score }))
}

function snippet(text: string | null | undefined, len = 200): string {
  if (!text) return ''
  return text.length > len ? text.slice(0, len) : text
}

// Table metadata for building queries
const tableMeta = {
  fragment: {
    table: fragments,
    idCol: fragments.lookupKey,
    titleCol: fragments.title,
    contentCol: fragments.content,
    searchVectorCol: fragments.searchVector,
    embeddingCol: fragments.embedding,
    deletedAtCol: fragments.deletedAt,
  },
  wiki: {
    table: wikis,
    idCol: wikis.lookupKey,
    titleCol: wikis.name,
    contentCol: wikis.content,
    searchVectorCol: wikis.searchVector,
    embeddingCol: wikis.embedding,
    deletedAtCol: wikis.deletedAt,
  },
  person: {
    table: people,
    idCol: people.lookupKey,
    titleCol: people.name,
    contentCol: people.content,
    searchVectorCol: people.searchVector,
    embeddingCol: people.embedding,
    deletedAtCol: people.deletedAt,
  },
} as const

async function bm25SearchTable(
  database: DB,
  query: string,
  tableType: SearchTable,
  limit: number
): Promise<SearchResult[]> {
  const meta = tableMeta[tableType]
  const tsQuery = sql`plainto_tsquery('english', ${query})`

  const rows = await database
    .select({
      id: meta.idCol,
      title: meta.titleCol,
      content: meta.contentCol,
      score: sql<number>`ts_rank(${meta.searchVectorCol}, ${tsQuery})`,
    })
    .from(meta.table)
    .where(
      sql`${meta.deletedAtCol} IS NULL AND ${meta.searchVectorCol} @@ ${tsQuery}`
    )
    .orderBy(sql`ts_rank(${meta.searchVectorCol}, ${tsQuery}) DESC`)
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    type: tableType,
    title: r.title ?? '',
    snippet: snippet(r.content),
    score: Number(r.score ?? 0),
  }))
}

async function bm25Search(
  database: DB,
  query: string,
  opts: { limit?: number; tables?: SearchTable[] } = {}
): Promise<SearchResult[]> {
  const limit = opts.limit ?? 20
  const tables = opts.tables ?? ['fragment', 'wiki', 'person']

  const results = await Promise.all(
    tables.map((t) => bm25SearchTable(database, query, t, limit))
  )

  return results
    .flat()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

async function vectorSearchTable(
  database: DB,
  queryEmbedding: number[],
  tableType: SearchTable,
  limit: number
): Promise<SearchResult[]> {
  const meta = tableMeta[tableType]
  const vecLiteral = JSON.stringify(queryEmbedding)

  const rows = await database
    .select({
      id: meta.idCol,
      title: meta.titleCol,
      content: meta.contentCol,
      distance: sql<number>`${meta.embeddingCol} <=> ${sql.raw(`'${vecLiteral}'::vector`)}`,
    })
    .from(meta.table)
    .where(
      sql`${meta.deletedAtCol} IS NULL AND ${meta.embeddingCol} IS NOT NULL`
    )
    .orderBy(sql`${meta.embeddingCol} <=> ${sql.raw(`'${vecLiteral}'::vector`)}`)
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    type: tableType,
    title: r.title ?? '',
    snippet: snippet(r.content),
    score: 1 - Number(r.distance ?? 1) / 2,
  }))
}

async function vectorSearch(
  database: DB,
  queryEmbedding: number[],
  opts: { limit?: number; tables?: SearchTable[] } = {}
): Promise<SearchResult[]> {
  const limit = opts.limit ?? 20
  const tables = opts.tables ?? ['fragment', 'wiki', 'person']

  const results = await Promise.all(
    tables.map((t) => vectorSearchTable(database, queryEmbedding, t, limit))
  )

  return results
    .flat()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export async function hybridSearch(
  database: DB,
  query: string,
  opts: {
    limit?: number
    tables?: SearchTable[]
    mode?: 'hybrid' | 'bm25' | 'vector'
    embedConfig?: EmbedConfig
  } = {}
): Promise<SearchResult[]> {
  const limit = opts.limit ?? 20
  const tables = opts.tables ?? ['fragment', 'wiki', 'person']
  const mode = opts.mode ?? 'hybrid'

  const lists: SearchResult[][] = []

  if (mode === 'bm25' || mode === 'hybrid') {
    lists.push(await bm25Search(database, query, { limit, tables }))
  }

  if (mode === 'vector' || mode === 'hybrid') {
    if (opts.embedConfig) {
      const vec = await embedText(query, opts.embedConfig)
      if (vec) {
        lists.push(await vectorSearch(database, vec, { limit, tables }))
      }
    }
  }

  if (lists.length === 0) return []
  if (lists.length === 1) return lists[0].slice(0, limit)

  return rrfFuse(lists).slice(0, limit)
}
