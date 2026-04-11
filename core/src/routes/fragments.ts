import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { makeLookupKey, parseLookupKey, generateSlug } from '@robin/shared'
import { resolveFragmentSlug } from '../db/slug.js'
import { computeContentHash, findDuplicateFragment } from '../db/dedup.js'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { fragments, entries } from '../db/schema.js'
import { gatewayClient } from '../gateway/client.js'
import { logger } from '../lib/logger.js'
import { validationHook } from '../lib/validation.js'
import {
  fragmentResponseSchema,
  fragmentWithContentResponseSchema,
  fragmentListResponseSchema,
  createFragmentBodySchema,
  updateFragmentBodySchema,
  fragmentListQuerySchema,
} from '../schemas/fragments.schema.js'

const log = logger.child({ component: 'fragments' })

const fragmentsRouter = new Hono()
fragmentsRouter.use('*', sessionMiddleware)

// GET /fragments — list fragments (metadata only)
// TODO(phase-5): rewrite with new schema columns (no vaultId/threadId on fragments)
fragmentsRouter.get('/', async (c) => {
  const userId = c.get('userId') as string
  const query = fragmentListQuerySchema.safeParse({ limit: c.req.query('limit') })
  const limit = query.success ? query.data.limit : 50

  const rows = await db
    .select()
    .from(fragments)
    .where(eq(fragments.userId, userId))
    .orderBy(desc(fragments.updatedAt))
    .limit(limit)

  return c.json(
    fragmentListResponseSchema.parse({ fragments: rows.map((r) => ({ ...r, id: r.lookupKey })) })
  )
})

// GET /fragments/:id — get fragment with content from gateway
// TODO(phase-5): update to use lookupKey, read content via repoPath
fragmentsRouter.get('/:id', async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')

  const [fragment] = await db.select().from(fragments).where(eq(fragments.lookupKey, id))
  if (!fragment || fragment.userId !== userId) return c.json({ error: 'Not found' }, 404)

  let content = ''
  if (fragment.repoPath) {
    try {
      const result = await gatewayClient.read(userId, fragment.repoPath)
      content = result.content
    } catch {
      // File might not exist yet
    }
  }

  return c.json(
    fragmentWithContentResponseSchema.parse({ ...fragment, id: fragment.lookupKey, content })
  )
})

// POST /fragments — create fragment
// TODO(phase-5): rewrite with new schema (lookupKey, entryId required, no vaultId/threadId)
fragmentsRouter.post('/', zValidator('json', createFragmentBodySchema, validationHook), async (c) => {
  const userId = c.get('userId') as string
  const { title, content, entryId, tags } = c.req.valid('json')

  /** @gate — verify entryId belongs to the authenticated user */
  const [parentEntry] = await db
    .select({ userId: entries.userId, vaultId: entries.vaultId })
    .from(entries)
    .where(eq(entries.lookupKey, entryId))
  if (!parentEntry || parentEntry.userId !== userId)
    return c.json({ error: 'Entry not found' }, 404)

  // Content-level dedup: reject if identical content already exists for this user
  if (content) {
    const hash = computeContentHash(content)
    const existing = await findDuplicateFragment(db, userId, hash)
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
  const { ulid } = parseLookupKey(fragKey)
  const date = new Date().toISOString().split('T')[0]
  const slug = await resolveFragmentSlug(db, userId, generateSlug(title))
  const repoPath = `fragments/${date}-${slug}.${fragKey}.md`

  // Write content to gateway
  let gatewayWriteOk = false
  if (content) {
    try {
      await gatewayClient.write({
        userId,
        path: repoPath,
        content,
        message: `add(${ulid.slice(0, 8)}): ${title}`,
        branch: 'main',
      })
      gatewayWriteOk = true
    } catch (err) {
      log.error({ err }, 'gateway write failed')
    }
  }

  const [fragment] = await db
    .insert(fragments)
    .values({
      lookupKey: fragKey,
      userId,
      slug,
      entryId,
      title,
      vaultId: parentEntry.vaultId,
      dedupHash: content ? computeContentHash(content) : null,
      repoPath: gatewayWriteOk ? repoPath : '',
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
// TODO(phase-5): rewrite with new schema columns
fragmentsRouter.put('/:id', zValidator('json', updateFragmentBodySchema, validationHook), async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const [existing] = await db.select().from(fragments).where(eq(fragments.lookupKey, id))
  if (!existing || existing.userId !== userId) return c.json({ error: 'Not found' }, 404)

  // If content changed, write to gateway
  if (body.content != null && existing.repoPath) {
    try {
      await gatewayClient.write({
        userId,
        path: existing.repoPath,
        content: body.content,
        message: `update: ${existing.title}`,
        branch: 'main',
      })
    } catch (err) {
      log.error({ err }, 'gateway write failed')
    }
  }

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
