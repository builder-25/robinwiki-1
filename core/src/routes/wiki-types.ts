import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { wikiTypes } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import { validationHook } from '../lib/validation.js'
import { seedWikiTypes } from '../bootstrap/seed-wiki-types.js'
import {
  wikiTypeResponseSchema,
  wikiTypeListResponseSchema,
  createWikiTypeBodySchema,
  updateWikiTypeBodySchema,
} from '../schemas/wiki-types.schema.js'
import { emitAuditEvent } from '../db/audit.js'

const log = logger.child({ component: 'wiki-types' })

const wikiTypesRouter = new Hono()
wikiTypesRouter.use('*', sessionMiddleware)

// POST /wiki-types/setup -- seed defaults from YAML configs (idempotent)
wikiTypesRouter.post('/setup', async (c) => {
  try {
    const result = await seedWikiTypes()

    await emitAuditEvent(db, {
      entityType: 'wiki_type',
      entityId: 'system',
      eventType: 'seeded',
      source: 'system',
      summary: 'Wiki types seeded',
      detail: { result },
    })

    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ err }, 'wiki-types setup failed')
    return c.json({ error: message }, 500)
  }
})

// GET /wiki-types -- list all wiki types
wikiTypesRouter.get('/', async (c) => {
  const rows = await db.select().from(wikiTypes).orderBy(wikiTypes.name)
  return c.json(wikiTypeListResponseSchema.parse({ wikiTypes: rows }))
})

// GET /wiki-types/:slug -- get single wiki type
wikiTypesRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const [row] = await db.select().from(wikiTypes).where(eq(wikiTypes.slug, slug))
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(wikiTypeResponseSchema.parse(row))
})

// PUT /wiki-types/:slug -- update a wiki type (sets userModified = true)
wikiTypesRouter.put(
  '/:slug',
  zValidator('json', updateWikiTypeBodySchema, validationHook),
  async (c) => {
    const slug = c.req.param('slug')
    const body = c.req.valid('json')

    const [existing] = await db.select().from(wikiTypes).where(eq(wikiTypes.slug, slug))
    if (!existing) return c.json({ error: 'Not found' }, 404)

    const updates: Record<string, unknown> = {
      userModified: true,
      updatedAt: new Date(),
    }
    if (body.name != null) updates.name = body.name
    if (body.shortDescriptor != null) updates.shortDescriptor = body.shortDescriptor
    if (body.descriptor != null) updates.descriptor = body.descriptor
    if (body.prompt != null) updates.prompt = body.prompt

    const [updated] = await db
      .update(wikiTypes)
      .set(updates)
      .where(eq(wikiTypes.slug, slug))
      .returning()

    await emitAuditEvent(db, {
      entityType: 'wiki_type',
      entityId: slug,
      eventType: 'edited',
      source: 'api',
      summary: `Wiki type updated: ${slug}`,
      detail: { slug, changedFields: Object.keys(updates).filter(k => k !== 'updatedAt' && k !== 'userModified') },
    })

    return c.json(wikiTypeResponseSchema.parse(updated))
  }
)

// POST /wiki-types -- create a new user-defined wiki type
wikiTypesRouter.post(
  '/',
  zValidator('json', createWikiTypeBodySchema, validationHook),
  async (c) => {
    const body = c.req.valid('json')

    // Check for conflict with existing slug
    const [existing] = await db.select().from(wikiTypes).where(eq(wikiTypes.slug, body.slug))
    if (existing) {
      return c.json({ error: `Wiki type "${body.slug}" already exists` }, 409)
    }

    const [created] = await db
      .insert(wikiTypes)
      .values({
        slug: body.slug,
        name: body.name,
        shortDescriptor: body.shortDescriptor,
        descriptor: body.descriptor,
        prompt: body.prompt,
        isDefault: false,
        userModified: true,
      })
      .returning()

    await emitAuditEvent(db, {
      entityType: 'wiki_type',
      entityId: body.slug,
      eventType: 'created',
      source: 'api',
      summary: `Wiki type created: ${body.name}`,
      detail: { slug: body.slug, name: body.name },
    })

    return c.json(wikiTypeResponseSchema.parse(created), 201)
  }
)

export { wikiTypesRouter as wikiTypesRoutes }
