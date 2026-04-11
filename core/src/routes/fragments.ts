import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { makeLookupKey, generateSlug } from '@robin/shared'
import { resolveFragmentSlug } from '../db/slug.js'
import { computeContentHash, findDuplicateFragment } from '../db/dedup.js'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { fragments, entries } from '../db/schema.js'
import { validationHook } from '../lib/validation.js'
import {
  fragmentResponseSchema,
  fragmentWithContentResponseSchema,
  fragmentListResponseSchema,
  createFragmentBodySchema,
  updateFragmentBodySchema,
  fragmentListQuerySchema,
} from '../schemas/fragments.schema.js'

const fragmentsRouter = new Hono()
fragmentsRouter.use('*', sessionMiddleware)

// GET /fragments — list fragments (metadata only)
fragmentsRouter.get('/', async (c) => {
  const query = fragmentListQuerySchema.safeParse({ limit: c.req.query('limit') })
  const limit = query.success ? query.data.limit : 50

  const rows = await db
    .select()
    .from(fragments)
    .orderBy(desc(fragments.updatedAt))
    .limit(limit)

  return c.json(
    fragmentListResponseSchema.parse({ fragments: rows.map((r) => ({ ...r, id: r.lookupKey })) })
  )
})

// GET /fragments/:id — get fragment metadata (content lives in DB only post-M2)
fragmentsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')

  const [fragment] = await db.select().from(fragments).where(eq(fragments.lookupKey, id))
  if (!fragment) return c.json({ error: 'Not found' }, 404)

  return c.json(
    fragmentWithContentResponseSchema.parse({ ...fragment, id: fragment.lookupKey, content: '' })
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

  return c.json(fragmentResponseSchema.parse({ ...fragment, id: fragment.lookupKey }))
})

// PUT /fragments/:id/thread — move fragment to a thread (or unfile)
// TODO(phase-5): rewrite to use edges table (FRAGMENT_IN_WIKI edge)
fragmentsRouter.put('/:id/thread', async (c) => {
  return c.json({ error: 'Not implemented — use edges table' }, 501)
})

// GET /fragments/:id/links — outgoing connections from this fragment
// TODO(phase-5): rewrite to use edges table
fragmentsRouter.get('/:id/links', async (c) => {
  return c.json({ links: [] })
})

// GET /fragments/:id/backlinks — incoming connections to this fragment
// TODO(phase-5): rewrite to use edges table
fragmentsRouter.get('/:id/backlinks', async (c) => {
  return c.json({ backlinks: [] })
})

export { fragmentsRouter as fragmentsRoutes }
