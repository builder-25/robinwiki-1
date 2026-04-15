import { Hono } from 'hono'
import { eq, ne, and } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import {
  makeLookupKey,
  generateSlug,
  checkSlugCollision,
} from '@robin/shared'
import type { ReclassifyJob } from '@robin/queue'
import { nanoid } from '../lib/id.js'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { vaults, wikis, edges, wikiTypes } from '../db/schema.js'
import { producer } from '../queue/producer.js'
import { logger } from '../lib/logger.js'
import { validationHook } from '../lib/validation.js'
import { threadResponseSchema } from '../schemas/wikis.schema.js'
import { prepareThread } from './wikis.js'
import {
  vaultResponseSchema,
  vaultListResponseSchema,
  createVaultBodySchema,
  updateVaultBodySchema,
  updateVaultProfileBodySchema,
} from '../schemas/vaults.schema.js'
import { createThreadBodySchema } from '../schemas/wikis.schema.js'
import { emitAuditEvent } from '../db/audit.js'

const log = logger.child({ component: 'vaults' })

const vaultsRouter = new Hono()
vaultsRouter.use('*', sessionMiddleware)

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// GET /vaults — list vaults with counts
// TODO(phase-5): update counts to use entries.vaultId and edges for wikis/fragments
vaultsRouter.get('/', async (c) => {
  const rows = await db.select().from(vaults).where(ne(vaults.type, 'system'))

  return c.json(
    vaultListResponseSchema.parse({
      vaults: rows.map((v) => ({ ...v, threadCount: 0, noteCount: 0 })),
    })
  )
})

// GET /vaults/:id
vaultsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [vault] = await db.select().from(vaults).where(eq(vaults.id, id))
  if (!vault) return c.json({ error: 'Not found' }, 404)

  return c.json(vaultResponseSchema.parse({ ...vault, threadCount: 0, noteCount: 0 }))
})

// POST /vaults — create vault
vaultsRouter.post('/', zValidator('json', createVaultBodySchema, validationHook), async (c) => {
  const { name, icon, description, color } = c.req.valid('json')

  const id = nanoid()
  const slug = slugify(name)
  const [vault] = await db
    .insert(vaults)
    .values({
      id,
      name,
      slug,
      icon: icon ?? '',
      description: description ?? '',
      color: color ?? '',
    })
    .returning()

  await emitAuditEvent(db, {
    entityType: 'vault',
    entityId: id,
    eventType: 'created',
    source: 'api',
    summary: `Vault created: ${name}`,
    detail: { vaultId: id },
  })

  return c.json(vaultResponseSchema.parse({ ...vault, threadCount: 0, noteCount: 0 }), 201)
})

// PUT /vaults/:id — update vault
vaultsRouter.put('/:id', zValidator('json', updateVaultBodySchema, validationHook), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const [existing] = await db.select().from(vaults).where(eq(vaults.id, id))
  if (!existing) return c.json({ error: 'Not found' }, 404)

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

  await emitAuditEvent(db, {
    entityType: 'vault',
    entityId: id,
    eventType: 'edited',
    source: 'api',
    summary: `Vault updated: ${vault.name}`,
    detail: { vaultId: id, changedFields: Object.keys(updates).filter(k => k !== 'updatedAt') },
  })

  return c.json(vaultResponseSchema.parse({ ...vault, threadCount: 0, noteCount: 0 }))
})

// PUT /vaults/:id/profile — update vault profile text
vaultsRouter.put('/:id/profile', zValidator('json', updateVaultProfileBodySchema, validationHook), async (c) => {
  const id = c.req.param('id')
  const { profile } = c.req.valid('json')

  const [existing] = await db.select().from(vaults).where(eq(vaults.id, id))
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const [vault] = await db
    .update(vaults)
    .set({ profile, updatedAt: new Date() })
    .where(eq(vaults.id, id))
    .returning()

  return c.json(vaultResponseSchema.parse({ ...vault, threadCount: 0, noteCount: 0 }))
})

// GET /vaults/:vaultId/wikis — list wikis in a vault
vaultsRouter.get('/:vaultId/wikis', async (c) => {
  const vaultId = c.req.param('vaultId')

  const rows = await db
    .select({
      wiki: wikis,
      shortDescriptor: wikiTypes.shortDescriptor,
      descriptor: wikiTypes.descriptor,
    })
    .from(wikis)
    .leftJoin(wikiTypes, eq(wikis.type, wikiTypes.slug))
    .where(eq(wikis.vaultId, vaultId))

  return c.json({
    wikis: rows.map((r) =>
      threadResponseSchema.parse(
        prepareThread({
          ...r.wiki,
          shortDescriptor: r.shortDescriptor ?? '',
          descriptor: r.descriptor ?? '',
        })
      )
    ),
  })
})

// POST /vaults/:vaultId/wikis — create thread
vaultsRouter.post('/:vaultId/wikis', zValidator('json', createThreadBodySchema, validationHook), async (c) => {
  const vaultId = c.req.param('vaultId')
  const [vault] = await db.select().from(vaults).where(eq(vaults.id, vaultId))
  if (!vault) return c.json({ error: 'Vault not found' }, 404)

  const { name, type, prompt } = c.req.valid('json')

  const lookupKey = makeLookupKey('wiki')
  const slug = await checkSlugCollision(generateSlug(name), async (s) => {
    const [existing] = await db
      .select({ slug: wikis.slug })
      .from(wikis)
      .where(eq(wikis.slug, s))
    return !!existing
  })
  const [thread] = await db
    .insert(wikis)
    .values({
      lookupKey,
      name,
      slug,
      type,
      prompt: prompt ?? '',
      vaultId,
      state: 'RESOLVED',
    })
    .returning()

  // Create THREAD_IN_VAULT edge for the knowledge graph
  await db.insert(edges).values({
    id: nanoid(),
    srcType: 'wiki',
    srcId: thread.lookupKey,
    dstType: 'vault',
    dstId: vaultId,
    edgeType: 'THREAD_IN_VAULT',
  })

  // Enqueue reclassify job to evaluate existing fragments against the new thread
  const reclassifyJob: ReclassifyJob = {
    type: 'reclassify',
    jobId: crypto.randomUUID(),
    wikiKey: thread.lookupKey,
    vaultId,
    enqueuedAt: new Date().toISOString(),
  }
  await producer.enqueueReclassify(reclassifyJob)
  log.info({ wikiKey: thread.lookupKey }, 'enqueued reclassify job for new thread')

  await emitAuditEvent(db, {
    entityType: 'wiki',
    entityId: thread.lookupKey,
    eventType: 'created',
    source: 'api',
    summary: `Wiki created: ${name}`,
    detail: { wikiKey: thread.lookupKey, type, vaultId },
  })

  return c.json(threadResponseSchema.parse(prepareThread(thread)), 201)
})

export { vaultsRouter as vaultsRoutes }
