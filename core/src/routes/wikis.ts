import { Hono } from 'hono'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { generateSlug, makeLookupKey } from '@robin/shared'
import { NoOpenRouterKeyError } from '@robin/agent'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { wikis, edges, wikiTypes, fragments, people, auditLog } from '../db/schema.js'
import { resolveWikiSlug } from '../db/slug.js'
import { logger } from '../lib/logger.js'
import { validationHook } from '../lib/validation.js'
import { nanoid24 } from '../lib/id.js'
import { regenerateWiki } from '../lib/regen.js'
import {
  threadResponseSchema,
  threadListResponseSchema,
  wikiDetailResponseSchema,
  updateThreadBodySchema,
  publishWikiResponseSchema,
  bouncerModeBodySchema,
  bouncerModeResponseSchema,
  toggleRegenerateBodySchema,
  toggleRegenerateResponseSchema,
  spawnWikiBodySchema,
  spawnWikiResponseSchema,
} from '../schemas/wikis.schema.js'
import { emitAuditEvent } from '../db/audit.js'
import { timelineQuerySchema } from '../schemas/audit.schema.js'

const log = logger.child({ component: 'wikis' })

/** Prepare a thread row for schema parsing (add id alias + computed defaults) */
function prepareThread(
  t: typeof wikis.$inferSelect & {
    noteCount?: number
    lastUpdated?: string
    shortDescriptor?: string
    descriptor?: string
  }
) {
  return {
    ...t,
    id: t.lookupKey,
    noteCount: t.noteCount ?? 0,
    lastUpdated: t.lastUpdated ?? t.updatedAt.toISOString(),
    shortDescriptor: t.shortDescriptor ?? '',
    descriptor: t.descriptor ?? '',
  }
}

const wikisRouter = new Hono()
wikisRouter.use('*', sessionMiddleware)

// GET /wikis — cross-vault wiki listing with fragment counts + descriptors
wikisRouter.get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
  const offset = Number(c.req.query('offset') ?? 0)

  const rows = await db
    .select({
      wiki: wikis,
      fragmentCount: sql<number>`count(${edges.id})::int`,
      shortDescriptor: wikiTypes.shortDescriptor,
      descriptor: wikiTypes.descriptor,
    })
    .from(wikis)
    .leftJoin(wikiTypes, eq(wikis.type, wikiTypes.slug))
    .leftJoin(
      edges,
      and(
        eq(edges.dstId, wikis.lookupKey),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
        isNull(edges.deletedAt)
      )
    )
    .where(isNull(wikis.deletedAt))
    .groupBy(wikis.lookupKey, wikiTypes.shortDescriptor, wikiTypes.descriptor)
    .orderBy(sql`${wikis.updatedAt} DESC`)
    .limit(limit)
    .offset(offset)

  return c.json(
    threadListResponseSchema.parse({
      wikis: rows.map((r) =>
        threadResponseSchema.parse(
          prepareThread({
            ...r.wiki,
            noteCount: r.fragmentCount,
            shortDescriptor: r.shortDescriptor ?? '',
            descriptor: r.descriptor ?? '',
          })
        )
      ),
    })
  )
})

// GET /wikis/:id — wiki detail with member fragments and aggregated people
wikisRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [thread] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!thread) return c.json({ error: 'Not found' }, 404)

  // Member fragments via FRAGMENT_IN_WIKI edges
  const fragEdges = await db
    .select({ srcId: edges.srcId })
    .from(edges)
    .where(
      and(
        eq(edges.dstId, id),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
        isNull(edges.deletedAt)
      )
    )
  const fragKeys = fragEdges.map((e) => e.srcId)

  const frags =
    fragKeys.length > 0
      ? await db
          .select({
            lookupKey: fragments.lookupKey,
            slug: fragments.slug,
            title: fragments.title,
            content: fragments.content,
          })
          .from(fragments)
          .where(inArray(fragments.lookupKey, fragKeys))
      : []

  // Aggregated people: FRAGMENT_MENTIONS_PERSON edges from those fragments
  const personEdges =
    fragKeys.length > 0
      ? await db
          .select({ dstId: edges.dstId })
          .from(edges)
          .where(
            and(
              inArray(edges.srcId, fragKeys),
              eq(edges.edgeType, 'FRAGMENT_MENTIONS_PERSON'),
              isNull(edges.deletedAt)
            )
          )
      : []
  const personKeys = [...new Set(personEdges.map((e) => e.dstId))]

  const peopleRows =
    personKeys.length > 0
      ? await db
          .select({ lookupKey: people.lookupKey, name: people.name })
          .from(people)
          .where(inArray(people.lookupKey, personKeys))
      : []

  return c.json(
    wikiDetailResponseSchema.parse({
      ...prepareThread(thread),
      wikiContent: thread.content ?? '',
      fragments: frags.map((f) => ({
        id: f.lookupKey,
        slug: f.slug,
        title: f.title,
        snippet: (f.content ?? '').slice(0, 200),
      })),
      people: peopleRows.map((p) => ({
        id: p.lookupKey,
        name: p.name,
      })),
    })
  )
})

// GET /wikis/:id/timeline — audit events related to this wiki and its fragments
wikisRouter.get('/:id/timeline', async (c) => {
  const id = c.req.param('id')
  const query = timelineQuerySchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })
  const params = query.success ? query.data : { limit: 50, offset: 0 }

  const [wiki] = await db.select({ lookupKey: wikis.lookupKey }).from(wikis).where(eq(wikis.lookupKey, id))
  if (!wiki) return c.json({ error: 'Not found' }, 404)

  const fragmentEdges = await db
    .select({ srcId: edges.srcId })
    .from(edges)
    .where(
      and(
        eq(edges.dstId, id),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
        isNull(edges.deletedAt)
      )
    )

  const relatedIds = [id, ...fragmentEdges.map(e => e.srcId)]

  const events = await db
    .select()
    .from(auditLog)
    .where(inArray(auditLog.entityId, relatedIds))
    .orderBy(sql`${auditLog.createdAt} DESC`)
    .limit(params.limit)
    .offset(params.offset)

  return c.json({
    events: events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
  })
})

// PUT /wikis/:id — update thread
wikisRouter.put('/:id', zValidator('json', updateThreadBodySchema, validationHook), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const [existing] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name != null) {
    updates.name = body.name
    updates.slug = generateSlug(body.name)
  }
  if (body.type != null) updates.type = body.type
  if (body.prompt != null) {
    updates.prompt = body.prompt
    // Prompt change affects wiki generation — mark PENDING so regen rebuilds with new prompt
    if (body.prompt !== existing.prompt) updates.state = 'PENDING'
  }

  const [thread] = await db
    .update(wikis)
    .set(updates)
    .where(eq(wikis.lookupKey, id))
    .returning()

  await emitAuditEvent(db, {
    entityType: 'wiki',
    entityId: id,
    eventType: 'edited',
    source: 'api',
    summary: `Wiki edited: ${thread.name}`,
    detail: { wikiKey: id, changedFields: Object.keys(updates).filter(k => k !== 'updatedAt') },
  })

  return c.json(threadResponseSchema.parse(prepareThread(thread)))
})

// POST /wikis/:id/publish — publish wiki with stable nanoid slug
wikisRouter.post('/:id/publish', async (c) => {
  const id = c.req.param('id')
  const [wiki] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!wiki) return c.json({ error: 'Not found' }, 404)

  if (!wiki.content) {
    return c.json({ error: 'Cannot publish a wiki with no content' }, 400)
  }

  const slug = wiki.publishedSlug ?? nanoid24()
  const [updated] = await db
    .update(wikis)
    .set({
      published: true,
      publishedSlug: slug,
      publishedAt: wiki.publishedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(wikis.lookupKey, id))
    .returning()

  await emitAuditEvent(db, {
    entityType: 'wiki',
    entityId: id,
    eventType: 'published',
    source: 'api',
    summary: `Wiki published: ${wiki.name}`,
    detail: { wikiKey: id, publishedSlug: slug },
  })

  return c.json(publishWikiResponseSchema.parse(updated))
})

// POST /wikis/:id/unpublish — unpublish wiki (preserves slug for re-publish)
wikisRouter.post('/:id/unpublish', async (c) => {
  const id = c.req.param('id')
  const [wiki] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!wiki) return c.json({ error: 'Not found' }, 404)

  const [updated] = await db
    .update(wikis)
    .set({ published: false, updatedAt: new Date() })
    .where(eq(wikis.lookupKey, id))
    .returning()

  await emitAuditEvent(db, {
    entityType: 'wiki',
    entityId: id,
    eventType: 'unpublished',
    source: 'api',
    summary: `Wiki unpublished: ${wiki.name}`,
    detail: { wikiKey: id },
  })

  return c.json(publishWikiResponseSchema.parse(updated))
})

// POST /wikis/:id/regenerate — on-demand wiki regen
wikisRouter.post('/:id/regenerate', async (c) => {
  const id = c.req.param('id')
  const [wiki] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!wiki) return c.json({ error: 'Not found' }, 404)

  if (!wiki.regenerate) {
    return c.json({ error: 'Regeneration is disabled for this wiki' }, 400)
  }

  try {
    const result = await regenerateWiki(db, id)
    log.info({ wikiKey: id, ...result }, 'wiki regenerated via on-demand endpoint')
    return c.json({ ok: true, lookupKey: id, fragmentCount: result.fragmentCount })
  } catch (err) {
    if (err instanceof NoOpenRouterKeyError) {
      return c.json({ error: 'OpenRouter API key not configured' }, 500)
    }
    const message = err instanceof Error ? err.message : String(err)
    log.error({ wikiKey: id, error: message }, 'wiki regen failed')
    return c.json({ error: 'Regeneration failed', detail: message }, 500)
  }
})

// PATCH /wikis/:id/regenerate — toggle regenerate boolean
wikisRouter.patch(
  '/:id/regenerate',
  zValidator('json', toggleRegenerateBodySchema, validationHook),
  async (c) => {
    const id = c.req.param('id')
    const { regenerate } = c.req.valid('json')

    const [wiki] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
    if (!wiki) return c.json({ error: 'Not found' }, 404)

    const [updated] = await db
      .update(wikis)
      .set({ regenerate, updatedAt: new Date() })
      .where(eq(wikis.lookupKey, id))
      .returning()

    return c.json(
      toggleRegenerateResponseSchema.parse({
        id,
        regenerate: updated.regenerate,
      })
    )
  }
)

// PATCH /wikis/:id/bouncer — toggle bouncer mode (auto/review)
wikisRouter.patch('/:id/bouncer', zValidator('json', bouncerModeBodySchema, validationHook), async (c) => {
  const id = c.req.param('id')
  const { mode } = c.req.valid('json')

  const [wiki] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!wiki) return c.json({ error: 'Not found' }, 404)

  await db
    .update(wikis)
    .set({ bouncerMode: mode, updatedAt: new Date() })
    .where(eq(wikis.lookupKey, id))

  await emitAuditEvent(db, {
    entityType: 'wiki',
    entityId: id,
    eventType: 'edited',
    source: 'api',
    summary: `Wiki bouncer mode set to ${mode}`,
    detail: { wikiKey: id, changedFields: ['bouncerMode'] },
  })

  return c.json(bouncerModeResponseSchema.parse({ id, bouncerMode: mode }))
})

// POST /wikis/:id/spawn — create a related child wiki with a WIKI_RELATED_TO_WIKI edge
wikisRouter.post(
  '/:id/spawn',
  zValidator('json', spawnWikiBodySchema, validationHook),
  async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')

    const [parent] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
    if (!parent) return c.json({ error: 'Not found' }, 404)

    const newWikiKey = makeLookupKey('wiki')
    const slug = await resolveWikiSlug(db, generateSlug(body.name))
    const type = body.type ?? parent.type

    await db.insert(wikis).values({
      lookupKey: newWikiKey,
      slug,
      name: body.name,
      type,
      state: 'PENDING',
      prompt: '',
    })

    // Create WIKI_RELATED_TO_WIKI edge from parent to child
    await db
      .insert(edges)
      .values({
        id: crypto.randomUUID(),
        srcType: 'wiki',
        srcId: parent.lookupKey,
        dstType: 'wiki',
        dstId: newWikiKey,
        edgeType: 'WIKI_RELATED_TO_WIKI',
      })
      .onConflictDoNothing()

    return c.json(
      spawnWikiResponseSchema.parse({
        lookupKey: newWikiKey,
        slug,
        name: body.name,
        type,
        parentKey: parent.lookupKey,
        fragmentCount: 0,
      })
    )
  }
)

// POST /wikis/:targetId/merge — merge source thread into target
wikisRouter.post('/:targetId/merge', async (c) => {
  return c.json({ error: 'Not implemented — thread merge needs edges table rewrite' }, 501)
})

export { wikisRouter as wikisRoutes, prepareThread }
