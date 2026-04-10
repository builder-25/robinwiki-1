import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { configNotes } from '../db/schema.js'
import { validationHook } from '../lib/validation.js'
import {
  configNoteResponseSchema,
  configNoteListResponseSchema,
  updateConfigNoteBodySchema,
} from '../schemas/robin.schema.js'

const robinRouter = new Hono()
robinRouter.use('*', sessionMiddleware)

// GET /robin/config — list all config notes for user
robinRouter.get('/config', async (c) => {
  const userId = c.get('userId') as string
  const rows = await db.select().from(configNotes).where(eq(configNotes.userId, userId))
  return c.json(configNoteListResponseSchema.parse({ configNotes: rows }))
})

// GET /robin/config/:key — get config note by key
robinRouter.get('/config/:key', async (c) => {
  const userId = c.get('userId') as string
  const key = c.req.param('key')

  const [note] = await db
    .select()
    .from(configNotes)
    .where(and(eq(configNotes.userId, userId), eq(configNotes.key, key)))

  if (!note) return c.json({ error: 'Not found' }, 404)
  return c.json(configNoteResponseSchema.parse(note))
})

// PUT /robin/config/:key — update config note content and/or frontmatter
robinRouter.put('/config/:key', zValidator('json', updateConfigNoteBodySchema, validationHook), async (c) => {
  const userId = c.get('userId') as string
  const key = c.req.param('key')
  const { content, frontmatter } = c.req.valid('json')

  const [note] = await db
    .select()
    .from(configNotes)
    .where(and(eq(configNotes.userId, userId), eq(configNotes.key, key)))

  if (!note) return c.json({ error: 'Not found' }, 404)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (content != null) updates.content = content
  if (frontmatter != null) updates.frontmatter = frontmatter

  const [updated] = await db
    .update(configNotes)
    .set(updates)
    .where(and(eq(configNotes.userId, userId), eq(configNotes.key, key)))
    .returning()

  return c.json(configNoteResponseSchema.parse(updated))
})

export { robinRouter as robinRoutes }
