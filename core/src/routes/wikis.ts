import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { generateSlug } from '@robin/shared'
import type { RegenJob } from '@robin/queue'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { wikis } from '../db/schema.js'
import { gatewayClient } from '../gateway/client.js'
import { producer } from '../queue/producer.js'
import { logger } from '../lib/logger.js'
import { validationHook } from '../lib/validation.js'
import { parseFrontmatter, assembleFrontmatter } from '../lib/frontmatter.js'
import {
  threadResponseSchema,
  threadWithWikiResponseSchema,
  updateThreadBodySchema,
} from '../schemas/wikis.schema.js'
import { queuedResponseSchema } from '../schemas/base.schema.js'

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

// GET /wikis/:id -- get single thread (includes wiki content from git)
wikisRouter.get('/:id', async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')
  const [thread] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!thread || thread.userId !== userId) return c.json({ error: 'Not found' }, 404)

  let wikiContent = ''
  if (!thread.repoPath) {
    log.debug({ wikiKey: id }, 'thread has no repoPath, skipping wiki read')
  } else {
    try {
      const file = await gatewayClient.read(userId, thread.repoPath)
      // Strip YAML frontmatter, return just the body
      const raw = file.content
      if (raw.startsWith('---')) {
        const end = raw.indexOf('\n---', 3)
        if (end !== -1) wikiContent = raw.slice(end + 4).trim()
      } else {
        wikiContent = raw
      }
    } catch (err) {
      log.warn(
        {
          wikiKey: id,
          repoPath: thread.repoPath,
          err: err instanceof Error ? err.message : String(err),
        },
        'failed to read thread wiki from gateway'
      )
    }
  }

  return c.json(threadWithWikiResponseSchema.parse({ ...prepareThread(thread), wikiContent }))
})

// PUT /wikis/:id -- update thread
wikisRouter.put('/:id', zValidator('json', updateThreadBodySchema, validationHook), async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const [existing] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!existing || existing.userId !== userId) return c.json({ error: 'Not found' }, 404)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name != null) {
    updates.name = body.name
    updates.slug = generateSlug(body.name)
  }
  if (body.type != null) updates.type = body.type
  if (body.prompt != null) {
    updates.prompt = body.prompt
    // Prompt change affects wiki generation — mark DIRTY so regen rebuilds with new prompt
    if (body.prompt !== existing.prompt) updates.state = 'DIRTY'
  }

  const [thread] = await db
    .update(wikis)
    .set(updates)
    .where(eq(wikis.lookupKey, id))
    .returning()

  // Sync metadata changes to git frontmatter (wikis are notes, same as fragments)
  if (existing.repoPath) {
    try {
      const file = await gatewayClient.read(userId, existing.repoPath)
      const { frontmatter: fm, body: existingBody } = parseFrontmatter(file.content)
      if (body.name != null) fm.name = body.name
      if (body.type != null) fm.type = body.type
      if (body.prompt != null) fm.prompt = body.prompt
      const content = assembleFrontmatter(fm, existingBody)
      await gatewayClient.write({
        userId,
        path: existing.repoPath,
        content,
        message: `update: ${thread.name}`,
        branch: 'main',
      })
    } catch (err) {
      log.error({ err, wikiKey: id }, 'failed to sync thread metadata to git')
    }
  }

  return c.json(threadResponseSchema.parse(prepareThread(thread)))
})

// POST /wikis/:id/regenerate -- manually trigger thread wiki regen
wikisRouter.post('/:id/regenerate', async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')
  const [thread] = await db.select().from(wikis).where(eq(wikis.lookupKey, id))
  if (!thread || thread.userId !== userId) return c.json({ error: 'Not found' }, 404)

  // Force thread to DIRTY so the regen processor can acquire the lock
  if (thread.state !== 'DIRTY') {
    await db
      .update(wikis)
      .set({ state: 'DIRTY', updatedAt: new Date() })
      .where(eq(wikis.lookupKey, id))
  }

  const jobId = crypto.randomUUID()
  const regenJob: RegenJob = {
    type: 'regen',
    jobId,
    userId,
    objectKey: thread.lookupKey,
    objectType: 'wiki',
    triggeredBy: 'manual',
    enqueuedAt: new Date().toISOString(),
  }
  await producer.enqueueRegenJob(userId, regenJob)
  log.info(
    { wikiKey: thread.lookupKey, previousState: thread.state },
    'enqueued manual regen job'
  )

  return c.json(queuedResponseSchema.parse({ status: 'queued', jobId }), 202)
})

// POST /wikis/:targetId/merge -- merge source thread into target
wikisRouter.post('/:targetId/merge', async (c) => {
  return c.json({ error: 'Not implemented -- thread merge needs edges table rewrite' }, 501)
})

export { wikisRouter as wikisRoutes, prepareThread }
