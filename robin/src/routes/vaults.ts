import { Hono } from 'hono'
import { eq, ne, and, sql } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import {
  makeLookupKey,
  generateSlug,
  checkSlugCollision,
  parseLookupKey,
  composeFilename,
  TYPE_TO_DIR,
} from '@robin/shared'
import type { ReclassifyJob } from '@robin/queue'
import { nanoid } from '../lib/id.js'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { vaults, threads, edges } from '../db/schema.js'
import { gatewayClient } from '../gateway/client.js'
import { producer } from '../queue/producer.js'
import { logger } from '../lib/logger.js'
import { validationHook } from '../lib/validation.js'
import { threadResponseSchema } from '../schemas/threads.schema.js'
import { prepareThread } from './threads.js'
import {
  vaultResponseSchema,
  vaultListResponseSchema,
  createVaultBodySchema,
  updateVaultBodySchema,
  updateVaultProfileBodySchema,
} from '../schemas/vaults.schema.js'
import { createThreadBodySchema } from '../schemas/threads.schema.js'

const log = logger.child({ component: 'vaults' })

const vaultsRouter = new Hono()
vaultsRouter.use('*', sessionMiddleware)

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// GET /vaults — list user's vaults with counts
// TODO(phase-5): update counts to use entries.vaultId and edges for threads/fragments
vaultsRouter.get('/', async (c) => {
  const userId = c.get('userId') as string
  const rows = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.userId, userId), ne(vaults.type, 'system')))

  return c.json(
    vaultListResponseSchema.parse({
      vaults: rows.map((v) => ({ ...v, threadCount: 0, noteCount: 0 })),
    })
  )
})

// GET /vaults/:id
vaultsRouter.get('/:id', async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')
  const [vault] = await db.select().from(vaults).where(eq(vaults.id, id))
  if (!vault || vault.userId !== userId) return c.json({ error: 'Not found' }, 404)

  return c.json(vaultResponseSchema.parse({ ...vault, threadCount: 0, noteCount: 0 }))
})

// POST /vaults — create vault
vaultsRouter.post('/', zValidator('json', createVaultBodySchema, validationHook), async (c) => {
  const userId = c.get('userId') as string
  const { name, icon, description, color } = c.req.valid('json')

  const id = nanoid()
  const slug = slugify(name)
  const [vault] = await db
    .insert(vaults)
    .values({
      id,
      userId,
      name,
      slug,
      icon: icon ?? '',
      description: description ?? '',
      color: color ?? '',
    })
    .returning()

  return c.json(vaultResponseSchema.parse({ ...vault, threadCount: 0, noteCount: 0 }), 201)
})

// PUT /vaults/:id — update vault
vaultsRouter.put('/:id', zValidator('json', updateVaultBodySchema, validationHook), async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const [existing] = await db.select().from(vaults).where(eq(vaults.id, id))
  if (!existing || existing.userId !== userId) return c.json({ error: 'Not found' }, 404)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name != null) {
    updates.name = body.name
    updates.slug = slugify(body.name)
  }
  if (body.icon != null) updates.icon = body.icon
  if (body.description != null) updates.description = body.description
  if (body.profile != null) updates.profile = body.profile
  if (body.color != null) updates.color = body.color

  const [vault] = await db.update(vaults).set(updates).where(eq(vaults.id, id)).returning()
  return c.json(vaultResponseSchema.parse({ ...vault, threadCount: 0, noteCount: 0 }))
})

// PUT /vaults/:id/profile — update vault profile text
vaultsRouter.put('/:id/profile', zValidator('json', updateVaultProfileBodySchema, validationHook), async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')
  const { profile } = c.req.valid('json')

  const [existing] = await db.select().from(vaults).where(eq(vaults.id, id))
  if (!existing || existing.userId !== userId) return c.json({ error: 'Not found' }, 404)

  const [vault] = await db
    .update(vaults)
    .set({ profile, updatedAt: new Date() })
    .where(eq(vaults.id, id))
    .returning()

  return c.json(vaultResponseSchema.parse({ ...vault, threadCount: 0, noteCount: 0 }))
})

// GET /vaults/:vaultId/threads -- list threads in a vault
vaultsRouter.get('/:vaultId/threads', async (c) => {
  const userId = c.get('userId') as string
  const vaultId = c.req.param('vaultId')

  const rows = await db
    .select()
    .from(threads)
    .where(and(eq(threads.userId, userId), eq(threads.vaultId, vaultId)))

  return c.json({ threads: rows.map((r) => threadResponseSchema.parse(prepareThread(r))) })
})

// POST /vaults/:vaultId/threads -- create thread
vaultsRouter.post('/:vaultId/threads', zValidator('json', createThreadBodySchema, validationHook), async (c) => {
  const userId = c.get('userId') as string
  const vaultId = c.req.param('vaultId')
  const [vault] = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.id, vaultId), eq(vaults.userId, userId)))
  if (!vault) return c.json({ error: 'Vault not found' }, 404)

  const { name, type, prompt } = c.req.valid('json')

  const lookupKey = makeLookupKey('thread')
  const slug = await checkSlugCollision(generateSlug(name), async (s) => {
    const [existing] = await db
      .select({ slug: threads.slug })
      .from(threads)
      .where(and(eq(threads.userId, userId), eq(threads.slug, s)))
    return !!existing
  })
  const [thread] = await db
    .insert(threads)
    .values({
      lookupKey,
      userId,
      name,
      slug,
      type,
      prompt: prompt ?? '',
      vaultId,
      state: 'RESOLVED',
    })
    .returning()

  // Write initial thread note to git (threads are notes, same as fragments/entries)
  const { type: keyType, ulid } = parseLookupKey(lookupKey)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const repoPath = `${TYPE_TO_DIR[keyType]}/${composeFilename({ date: today, slug, type: keyType, ulid })}`
  const fm = [
    '---',
    `type: ${JSON.stringify(type)}`,
    'state: RESOLVED',
    `vaultId: ${JSON.stringify(vaultId)}`,
    `name: ${JSON.stringify(name)}`,
    `prompt: ${JSON.stringify(prompt ?? '')}`,
    'fragmentKeys: []',
    'fragmentCount: 0',
    '---',
    '',
  ].join('\n')
  try {
    await gatewayClient.write({
      userId,
      path: repoPath,
      content: fm,
      message: `add(${ulid.slice(0, 8)}): ${name}`,
      branch: 'main',
    })
    await db.update(threads).set({ repoPath }).where(eq(threads.lookupKey, lookupKey))
  } catch (err) {
    log.error({ err, threadKey: lookupKey }, 'gateway write failed for thread — DB record created without git file')
  }

  // Create THREAD_IN_VAULT edge for the knowledge graph
  await db.insert(edges).values({
    id: nanoid(),
    userId,
    srcType: 'thread',
    srcId: thread.lookupKey,
    dstType: 'vault',
    dstId: vaultId,
    edgeType: 'THREAD_IN_VAULT',
  })

  // Enqueue reclassify job to evaluate existing fragments against the new thread
  const reclassifyJob: ReclassifyJob = {
    type: 'reclassify',
    jobId: crypto.randomUUID(),
    userId,
    threadKey: thread.lookupKey,
    vaultId,
    enqueuedAt: new Date().toISOString(),
  }
  await producer.enqueueReclassify(userId, reclassifyJob)
  log.info({ threadKey: thread.lookupKey }, 'enqueued reclassify job for new thread')

  return c.json(threadResponseSchema.parse(prepareThread(thread)), 201)
})

export { vaultsRouter as vaultsRoutes }
