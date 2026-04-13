import { Hono } from 'hono'
import { eq, ne, and, inArray, desc, isNull } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { generateSlug, loadWikiGenerationSpec } from '@robin/shared'
import type { WikiType } from '@robin/shared'
import { createIngestAgents, createStringCaller, NoOpenRouterKeyError, embedText } from '@robin/agent'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { wikis, edges, fragments, edits } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import { validationHook } from '../lib/validation.js'
import { nanoid24, nanoid } from '../lib/id.js'
import { loadOpenRouterConfigFromDb } from '../lib/openrouter-config.js'
import {
  threadResponseSchema,
  threadWithWikiResponseSchema,
  updateThreadBodySchema,
  publishWikiResponseSchema,
} from '../schemas/wikis.schema.js'

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

  const previousContent = wiki.content

  try {
    const orConfig = await loadOpenRouterConfigFromDb(db)
    const agents = createIngestAgents(orConfig)
    const callLlm = createStringCaller(agents.wikiClassifier)

    // Gather linked fragments via FRAGMENT_IN_WIKI edges
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

    const fragmentKeys = fragmentEdges.map((e) => e.srcId)
    let fragmentsText = ''
    let fragmentCount = 0

    if (fragmentKeys.length > 0) {
      const fragRows = await db
        .select({ title: fragments.title, content: fragments.content })
        .from(fragments)
        .where(and(inArray(fragments.lookupKey, fragmentKeys), isNull(fragments.deletedAt)))

      fragmentCount = fragRows.length
      fragmentsText = fragRows
        .map((f) => `### ${f.title}\n${f.content}`)
        .join('\n\n')
    }

    // Gather recent user edits for the {{edits}} template variable
    const userEdits = await db
      .select({ content: edits.content })
      .from(edits)
      .where(
        and(
          eq(edits.objectType, 'wiki'),
          eq(edits.objectId, id),
          eq(edits.source, 'user')
        )
      )
      .orderBy(desc(edits.timestamp))
      .limit(10)

    const editsSummary = userEdits.length > 0
      ? userEdits.map((e) => e.content).join('\n---\n')
      : undefined

    // Gather related wikis for cross-linking context
    const otherWikis = await db
      .select({ name: wikis.name, slug: wikis.slug, type: wikis.type })
      .from(wikis)
      .where(and(ne(wikis.lookupKey, id), isNull(wikis.deletedAt)))
      .limit(20)

    const relatedWikisText = otherWikis.length > 0
      ? otherWikis.map((w) => `- ${w.slug} (${w.type}): ${w.name}`).join('\n')
      : undefined

    // Load prompt spec and call LLM
    const spec = loadWikiGenerationSpec(wiki.type as WikiType, {
      fragments: fragmentsText,
      title: wiki.name,
      date: new Date().toISOString().split('T')[0],
      count: fragmentCount,
      existingWiki: previousContent || undefined,
      edits: editsSummary,
      relatedWikis: relatedWikisText,
    })

    const markdown = await callLlm(spec.system, spec.user)

    // Update wiki content and log edit
    const now = new Date()
    const [updated] = await db
      .update(wikis)
      .set({ content: markdown, lastRebuiltAt: now, updatedAt: now })
      .where(eq(wikis.lookupKey, id))
      .returning()

    // Compute and store embedding for the new content
    const vec = await embedText(markdown, {
      apiKey: orConfig.apiKey,
      model: orConfig.embeddingModel,
    })
    if (vec) {
      await db.update(wikis).set({ embedding: vec }).where(eq(wikis.lookupKey, id))
    }

    await db.insert(edits).values({
      id: nanoid(),
      objectType: 'wiki',
      objectId: id,
      type: 'addition',
      content: previousContent,
      source: 'regen',
      diff: '',
    })

    log.info({ wikiKey: id, fragmentCount, hasEmbedding: !!vec }, 'wiki regenerated via Quill')

    return c.json({ ok: true, lookupKey: updated.lookupKey, lastRebuiltAt: updated.lastRebuiltAt })
  } catch (err) {
    if (err instanceof NoOpenRouterKeyError) {
      return c.json({ error: 'OpenRouter API key not configured' }, 500)
    }
    const message = err instanceof Error ? err.message : String(err)
    log.error({ wikiKey: id, error: message }, 'wiki regen failed')
    return c.json({ error: 'Regeneration failed', detail: message }, 500)
  }
})

// POST /wikis/:targetId/merge — merge source thread into target
wikisRouter.post('/:targetId/merge', async (c) => {
  return c.json({ error: 'Not implemented — thread merge needs edges table rewrite' }, 501)
})

export { wikisRouter as wikisRoutes, prepareThread }
