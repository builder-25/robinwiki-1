import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { generateSlug } from '@robin/shared'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { wikis } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import { validationHook } from '../lib/validation.js'
import {
  threadResponseSchema,
  threadWithWikiResponseSchema,
  updateThreadBodySchema,
} from '../schemas/wikis.schema.js'

const log = logger.child({ component: 'wikis' })

/** Prepare a thread row for schema parsing (add id alias + computed defaults) */
function prepareThread(
  t: typeof wikis.$inferSelect & { noteCount?: number; lastUpdated?: string }
) {
  return {
    ...t,
    id: t.lookupKey,
    noteCount: t.noteCount ?? 0,
    lastUpdated: t.lastUpdated ?? t.updatedAt.toISOString(),
  }
}

const wikisRouter = new Hono()
wikisRouter.use('*', sessionMiddleware)

// GET /wikis/:id — get single thread (wiki body lives in DB now)
wikisRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [thread] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!thread) return c.json({ error: 'Not found' }, 404)

  return c.json(threadWithWikiResponseSchema.parse({ ...prepareThread(thread), wikiContent: '' }))
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

  return c.json(threadResponseSchema.parse(prepareThread(thread)))
})

// POST /wikis/:id/regenerate — manual wiki regen
// TODO(M3): regen worker is dormant in M2. Restore when regen pipeline lands.
wikisRouter.post('/:id/regenerate', async (c) => {
  log.warn('wiki regen requested but disabled in M2')
  return c.json({ error: 'Wiki regen disabled in M2 — will be restored in M3' }, 503)
})

// POST /wikis/:targetId/merge — merge source thread into target
wikisRouter.post('/:targetId/merge', async (c) => {
  return c.json({ error: 'Not implemented — thread merge needs edges table rewrite' }, 501)
})

export { wikisRouter as wikisRoutes, prepareThread }
