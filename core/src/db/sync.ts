import { eq, or, sql, and, inArray } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { entries, fragments, wikis, people, edges } from './schema.js'
import { canTransition, type ObjectState, type ObjectType } from '@robin/shared'

// ── Table dispatch ──────────────────────────────────────────────────────────

const TABLE_MAP: Record<
  string,
  typeof entries | typeof fragments | typeof wikis | typeof people
> = {
  entry: entries,
  frag: fragments,
  thread: wikis,
  person: people,
}

// ── upsertObject ────────────────────────────────────────────────────────────

interface UpsertObjectParams {
  lookupKey: string
  userId: string
  type: string
  slug: string
  repoPath: string
  state?: string
  frontmatterHash?: string
  bodyHash?: string
  contentHash?: string
  entryId?: string
}

export async function upsertObject(
  db: PostgresJsDatabase,
  params: UpsertObjectParams
): Promise<void> {
  const table = TABLE_MAP[params.type]
  if (!table) throw new Error(`Unknown object type: ${params.type}`)

  const now = new Date()
  const baseValues: Record<string, unknown> = {
    lookupKey: params.lookupKey,
    userId: params.userId,
    slug: params.slug,
    repoPath: params.repoPath,
    frontmatterHash: params.frontmatterHash ?? null,
    bodyHash: params.bodyHash ?? null,
    contentHash: params.contentHash ?? null,
    updatedAt: now,
  }

  // Type-specific required fields — dynamic table dispatch requires type widening
  const values = baseValues as Record<string, any>
  if (params.type === 'frag') {
    values.title = params.slug
    values.entryId = params.entryId ?? params.lookupKey
  } else if (params.type === 'entry') {
    values.title = params.slug
  } else if (params.type === 'wiki') {
    values.name = params.slug
  } else if (params.type === 'person') {
    values.name = params.slug
  }

  await db
    .insert(table)
    .values(values as any)
    .onConflictDoUpdate({
      target: (table as any).lookupKey,
      set: {
        slug: params.slug,
        repoPath: params.repoPath,
        frontmatterHash: params.frontmatterHash ?? null,
        bodyHash: params.bodyHash ?? null,
        contentHash: params.contentHash ?? null,
        updatedAt: now,
      } as any,
    })
}

// ── getObjectByKey ──────────────────────────────────────────────────────────

export async function getObjectByKey(
  db: PostgresJsDatabase,
  lookupKey: string
): Promise<{
  lookupKey: string
  contentHash: string | null
  bodyHash: string | null
  state: string
} | null> {
  // Determine type from key prefix
  const typeMap: Record<
    string,
    typeof entries | typeof fragments | typeof wikis | typeof people
  > = {
    entry: entries,
    frag: fragments,
    thread: wikis,
    person: people,
  }

  for (const [prefix, table] of Object.entries(typeMap)) {
    if (lookupKey.startsWith(prefix)) {
      const rows = await db
        .select({
          lookupKey: table.lookupKey,
          contentHash: table.contentHash,
          bodyHash: table.bodyHash,
          state: table.state,
          deletedAt: table.deletedAt,
        })
        .from(table)
        .where(eq(table.lookupKey, lookupKey))

      if (rows.length === 0 || rows[0].deletedAt !== null) return null
      return {
        lookupKey: rows[0].lookupKey,
        contentHash: rows[0].contentHash,
        bodyHash: rows[0].bodyHash,
        state: rows[0].state,
      }
    }
  }
  return null
}

// ── syncEdgesFromFrontmatter ────────────────────────────────────────────────

interface SyncEdgesParams {
  userId: string
  lookupKey: string
  type: string
  frontmatter: Record<string, unknown>
}

export async function syncEdgesFromFrontmatter(
  db: PostgresJsDatabase,
  params: SyncEdgesParams
): Promise<void> {
  // Delete only the edge types that this sync will recreate (scoped by source)
  const edgeTypesToSync =
    params.type === 'frag'
      ? ['FRAGMENT_IN_WIKI', 'FRAGMENT_MENTIONS_PERSON', 'FRAGMENT_IN_VAULT']
      : params.type === 'entry'
        ? ['ENTRY_IN_VAULT']
        : params.type === 'wiki'
          ? ['THREAD_IN_VAULT']
          : []

  if (edgeTypesToSync.length > 0) {
    await db
      .delete(edges)
      .where(and(eq(edges.srcId, params.lookupKey), inArray(edges.edgeType, edgeTypesToSync)))
  }

  const edgesToInsert: Array<Record<string, unknown>> = []

  if (params.type === 'frag') {
    // wikiKeys -> FRAGMENT_IN_WIKI edges
    const wikiKeys = (params.frontmatter.wikiKeys as string[]) ?? []
    for (const wikiKey of wikiKeys) {
      edgesToInsert.push({
        id: crypto.randomUUID(),
        userId: params.userId,
        srcType: 'frag',
        srcId: params.lookupKey,
        dstType: 'wiki',
        dstId: wikiKey,
        edgeType: 'FRAGMENT_IN_WIKI',
      })
    }

    // personKeys -> FRAGMENT_MENTIONS_PERSON edges
    const personKeys = (params.frontmatter.personKeys as string[]) ?? []
    for (const personKey of personKeys) {
      edgesToInsert.push({
        id: crypto.randomUUID(),
        userId: params.userId,
        srcType: 'frag',
        srcId: params.lookupKey,
        dstType: 'person',
        dstId: personKey,
        edgeType: 'FRAGMENT_MENTIONS_PERSON',
      })
    }

    // entryKey -> ENTRY_HAS_FRAGMENT (reversed: entry is src)
    const entryKey = params.frontmatter.entryKey as string | undefined
    if (entryKey) {
      edgesToInsert.push({
        id: crypto.randomUUID(),
        userId: params.userId,
        srcType: 'entry',
        srcId: entryKey,
        dstType: 'frag',
        dstId: params.lookupKey,
        edgeType: 'ENTRY_HAS_FRAGMENT',
      })
    }

    // vaultId -> FRAGMENT_IN_VAULT edge
    const fragVaultId = params.frontmatter.vaultId as string | undefined
    if (fragVaultId) {
      edgesToInsert.push({
        id: crypto.randomUUID(),
        userId: params.userId,
        srcType: 'frag',
        srcId: params.lookupKey,
        dstType: 'vault',
        dstId: fragVaultId,
        edgeType: 'FRAGMENT_IN_VAULT',
      })
    }
  } else if (params.type === 'entry') {
    // vaultId -> ENTRY_IN_VAULT edge
    const vaultId = params.frontmatter.vaultId as string | undefined
    if (vaultId) {
      edgesToInsert.push({
        id: crypto.randomUUID(),
        userId: params.userId,
        srcType: 'entry',
        srcId: params.lookupKey,
        dstType: 'vault',
        dstId: vaultId,
        edgeType: 'ENTRY_IN_VAULT',
      })
    }
  } else if (params.type === 'wiki') {
    // vaultId -> THREAD_IN_VAULT edge
    const threadVaultId = params.frontmatter.vaultId as string | undefined
    if (threadVaultId) {
      edgesToInsert.push({
        id: crypto.randomUUID(),
        userId: params.userId,
        srcType: 'wiki',
        srcId: params.lookupKey,
        dstType: 'vault',
        dstId: threadVaultId,
        edgeType: 'THREAD_IN_VAULT',
      })
    }
  }

  if (edgesToInsert.length > 0) {
    await db
      .insert(edges)
      .values(edgesToInsert as any)
      .onConflictDoNothing()
  }
}

// ── cascadeDirtyDownstream ──────────────────────────────────────────────────

export async function cascadeDirtyDownstream(
  db: PostgresJsDatabase,
  fragmentKey: string
): Promise<void> {
  // Find wikis connected to this fragment
  const wikiEdges = await db
    .select({ dstId: edges.dstId })
    .from(edges)
    .where(
      sql`${edges.srcId} = ${fragmentKey} AND ${edges.edgeType} = 'FRAGMENT_IN_WIKI' AND ${edges.deletedAt} IS NULL`
    )

  for (const edge of wikiEdges) {
    const [thread] = await db
      .select({ lookupKey: wikis.lookupKey, state: wikis.state })
      .from(wikis)
      .where(eq(wikis.lookupKey, edge.dstId))
    if (!thread) continue

    if (
      canTransition('wiki' as ObjectType, thread.state as ObjectState, 'DIRTY' as ObjectState)
    ) {
      await db
        .update(wikis)
        .set({ state: 'DIRTY', updatedAt: new Date() } as any)
        .where(eq(wikis.lookupKey, edge.dstId))
    }
  }

  // Find people connected to this fragment
  const personEdges = await db
    .select({ dstId: edges.dstId })
    .from(edges)
    .where(
      sql`${edges.srcId} = ${fragmentKey} AND ${edges.edgeType} = 'FRAGMENT_MENTIONS_PERSON' AND ${edges.deletedAt} IS NULL`
    )

  for (const edge of personEdges) {
    const [person] = await db
      .select({ lookupKey: people.lookupKey, state: people.state })
      .from(people)
      .where(eq(people.lookupKey, edge.dstId))
    if (!person) continue

    if (
      canTransition('person' as ObjectType, person.state as ObjectState, 'DIRTY' as ObjectState)
    ) {
      await db
        .update(people)
        .set({ state: 'DIRTY', updatedAt: new Date() } as any)
        .where(eq(people.lookupKey, edge.dstId))
    }
  }
}

// ── softDeleteObject ────────────────────────────────────────────────────────

export async function softDeleteObject(db: PostgresJsDatabase, lookupKey: string): Promise<void> {
  const now = new Date()

  // Determine table from key prefix
  for (const [prefix, table] of Object.entries(TABLE_MAP)) {
    if (lookupKey.startsWith(prefix)) {
      await db
        .update(table)
        .set({ deletedAt: now, updatedAt: now } as any)
        .where(eq(table.lookupKey, lookupKey))
      break
    }
  }

  // Soft-delete edges where this key is src or dst
  await db
    .update(edges)
    .set({ deletedAt: now } as any)
    .where(or(eq(edges.srcId, lookupKey), eq(edges.dstId, lookupKey)))
}
