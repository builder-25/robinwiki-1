import { Hono } from 'hono'
import { eq, and, desc, isNull, inArray } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { makeLookupKey, generateSlug } from '@robin/shared'
import { resolveFragmentSlug } from '../db/slug.js'
import { computeContentHash, findDuplicateFragment } from '../db/dedup.js'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { fragments, entries, edges, wikis, people } from '../db/schema.js'
import { validationHook } from '../lib/validation.js'
import {
  fragmentResponseSchema,
  fragmentWithContentResponseSchema,
  fragmentDetailResponseSchema,
  fragmentListResponseSchema,
  createFragmentBodySchema,
  updateFragmentBodySchema,
  fragmentListQuerySchema,
  fragmentReviewBodySchema,
} from '../schemas/fragments.schema.js'
import { emitAuditEvent } from '../db/audit.js'

const fragmentsRouter = new Hono()
fragmentsRouter.use('*', sessionMiddleware)

// GET /fragments — list fragments (metadata only, no content)
fragmentsRouter.get('/', async (c) => {
  const query = fragmentListQuerySchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    vaultId: c.req.query('vaultId'),
  })
  const limit = query.success ? query.data.limit : 50
  const offset = query.success ? query.data.offset : 0
  const vaultId = query.success ? query.data.vaultId : undefined

  const condition = vaultId ? eq(fragments.vaultId, vaultId) : undefined
  const rows = await db
    .select()
    .from(fragments)
    .where(condition)
    .orderBy(desc(fragments.updatedAt))
    .limit(limit)
    .offset(offset)

  return c.json(
    fragmentListResponseSchema.parse({ fragments: rows.map((r) => ({ ...r, id: r.lookupKey })) })
  )
})

// GET /fragments/:id — detail with content and backlinks
fragmentsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')

  const [fragment] = await db.select().from(fragments).where(eq(fragments.lookupKey, id))
  if (!fragment) return c.json({ error: 'Not found' }, 404)

  // Resolve backlinks: edges where this fragment is srcId
  const outEdges = await db
    .select()
    .from(edges)
    .where(and(eq(edges.srcId, id), isNull(edges.deletedAt)))

  // Batch-resolve destination names
  const backlinks: { id: string; name: string; type: string }[] = []
  const dstByType: Record<string, string[]> = {}
  for (const e of outEdges) {
    const t = e.dstType === 'frag' ? 'fragment' : e.dstType
    if (!dstByType[t]) dstByType[t] = []
    dstByType[t].push(e.dstId)
  }

  if (dstByType.wiki?.length) {
    const rows = await db
      .select({ key: wikis.lookupKey, name: wikis.name })
      .from(wikis)
      .where(inArray(wikis.lookupKey, dstByType.wiki))
    for (const r of rows) backlinks.push({ id: r.key, name: r.name, type: 'wiki' })
  }
  if (dstByType.person?.length) {
    const rows = await db
      .select({ key: people.lookupKey, name: people.name })
      .from(people)
      .where(inArray(people.lookupKey, dstByType.person))
    for (const r of rows) backlinks.push({ id: r.key, name: r.name, type: 'person' })
  }
  if (dstByType.fragment?.length) {
    const rows = await db
      .select({ key: fragments.lookupKey, title: fragments.title })
      .from(fragments)
      .where(inArray(fragments.lookupKey, dstByType.fragment))
    for (const r of rows) backlinks.push({ id: r.key, name: r.title, type: 'fragment' })
  }

  return c.json(
    fragmentDetailResponseSchema.parse({
      ...fragment,
      id: fragment.lookupKey,
      content: fragment.content ?? '',
      backlinks,
    })
  )
})

// POST /fragments — create fragment
fragmentsRouter.post('/', zValidator('json', createFragmentBodySchema, validationHook), async (c) => {
  const { title, content, entryId, tags } = c.req.valid('json')

  /** @gate — verify entryId exists */
  const [parentEntry] = await db
    .select({ vaultId: entries.vaultId })
    .from(entries)
    .where(eq(entries.lookupKey, entryId))
  if (!parentEntry) return c.json({ error: 'Entry not found' }, 404)

  // Content-level dedup: reject if identical content already exists
  if (content) {
    const hash = computeContentHash(content)
    const existing = await findDuplicateFragment(db, hash)
    if (existing) {
      return c.json(
        fragmentWithContentResponseSchema.parse({
          ...existing,
          id: existing.lookupKey,
          content,
        }),
        200
      )
    }
  }

  const fragKey = makeLookupKey('frag')
  const slug = await resolveFragmentSlug(db, generateSlug(title))

  const [fragment] = await db
    .insert(fragments)
    .values({
      lookupKey: fragKey,
      slug,
      entryId,
      title,
      vaultId: parentEntry.vaultId,
      dedupHash: content ? computeContentHash(content) : null,
      tags,
    })
    .returning()

  await emitAuditEvent(db, {
    entityType: 'fragment',
    entityId: fragKey,
    eventType: 'created',
    source: 'api',
    summary: `Fragment created: ${title}`,
    detail: { fragmentKey: fragKey, entryId, vaultId: parentEntry.vaultId },
  })

  return c.json(
    fragmentWithContentResponseSchema.parse({
      ...fragment,
      id: fragment.lookupKey,
      content: content ?? '',
    }),
    201
  )
})

// PUT /fragments/:id — update fragment
fragmentsRouter.put('/:id', zValidator('json', updateFragmentBodySchema, validationHook), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const [existing] = await db.select().from(fragments).where(eq(fragments.lookupKey, id))
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.title != null) updates.title = body.title
  if (body.content != null) updates.dedupHash = computeContentHash(body.content)
  if (body.tags != null) updates.tags = body.tags

  const [fragment] = await db
    .update(fragments)
    .set(updates)
    .where(eq(fragments.lookupKey, id))
    .returning()

  await emitAuditEvent(db, {
    entityType: 'fragment',
    entityId: id,
    eventType: 'edited',
    source: 'api',
    summary: 'Fragment updated',
    detail: { fragmentKey: id, changedFields: Object.keys(updates).filter(k => k !== 'updatedAt') },
  })

  return c.json(fragmentResponseSchema.parse({ ...fragment, id: fragment.lookupKey }))
})

// POST /fragments/:id/accept — accept fragment into a review-mode wiki
fragmentsRouter.post('/:id/accept', zValidator('json', fragmentReviewBodySchema, validationHook), async (c) => {
  const id = c.req.param('id')
  const { wikiId } = c.req.valid('json')

  // Verify fragment exists
  const [fragment] = await db.select().from(fragments).where(eq(fragments.lookupKey, id))
  if (!fragment) return c.json({ error: 'Fragment not found' }, 404)

  // Verify wiki exists and is in review mode
  const [wiki] = await db.select().from(wikis).where(eq(wikis.lookupKey, wikiId))
  if (!wiki) return c.json({ error: 'Wiki not found' }, 404)
  if (wiki.bouncerMode !== 'review') {
    return c.json({ error: 'Wiki is not in review mode' }, 400)
  }

  // Find the FRAGMENT_IN_WIKI edge
  const [edge] = await db
    .select()
    .from(edges)
    .where(
      and(
        eq(edges.srcId, id),
        eq(edges.dstId, wikiId),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI')
      )
    )
  if (!edge) return c.json({ error: 'No edge between fragment and wiki' }, 404)

  // Accept: clear deletedAt to activate the edge
  await db
    .update(edges)
    .set({ deletedAt: null })
    .where(eq(edges.id, edge.id))

  await emitAuditEvent(db, {
    entityType: 'fragment',
    entityId: id,
    eventType: 'accepted',
    source: 'api',
    summary: `Fragment accepted into ${wiki.name ?? wikiId}`,
    detail: { fragmentKey: id, wikiKey: wikiId },
  })

  return c.json({ ok: true, fragmentId: id, wikiId })
})

// POST /fragments/:id/reject — reject fragment from a review-mode wiki
fragmentsRouter.post('/:id/reject', zValidator('json', fragmentReviewBodySchema, validationHook), async (c) => {
  const id = c.req.param('id')
  const { wikiId } = c.req.valid('json')

  // Verify fragment exists
  const [fragment] = await db.select().from(fragments).where(eq(fragments.lookupKey, id))
  if (!fragment) return c.json({ error: 'Fragment not found' }, 404)

  // Verify wiki exists and is in review mode
  const [wiki] = await db.select().from(wikis).where(eq(wikis.lookupKey, wikiId))
  if (!wiki) return c.json({ error: 'Wiki not found' }, 404)
  if (wiki.bouncerMode !== 'review') {
    return c.json({ error: 'Wiki is not in review mode' }, 400)
  }

  // Find the FRAGMENT_IN_WIKI edge
  const [edge] = await db
    .select()
    .from(edges)
    .where(
      and(
        eq(edges.srcId, id),
        eq(edges.dstId, wikiId),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI')
      )
    )
  if (!edge) return c.json({ error: 'No edge between fragment and wiki' }, 404)

  // Reject: soft-delete the edge
  await db
    .update(edges)
    .set({ deletedAt: new Date() })
    .where(eq(edges.id, edge.id))

  await emitAuditEvent(db, {
    entityType: 'fragment',
    entityId: id,
    eventType: 'rejected',
    source: 'api',
    summary: `Fragment rejected from ${wiki.name ?? wikiId}`,
    detail: { fragmentKey: id, wikiKey: wikiId },
  })

  return c.json({ ok: true, fragmentId: id, wikiId })
})

export { fragmentsRouter as fragmentsRoutes }
