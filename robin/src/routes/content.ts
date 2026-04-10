import { Hono } from 'hono'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { diffLines } from 'diff'
import { parseFrontmatter, assembleFrontmatter } from '../lib/frontmatter.js'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { entries, fragments, threads, people, edges, threadEdits } from '../db/schema.js'
import { gatewayClient } from '../gateway/client.js'
import { VALID_TYPES, WRITE_SCHEMAS, type ContentType } from '../lib/content-schemas.js'
import {
  contentRawResponseSchema,
  contentStructuredResponseSchema,
} from '../schemas/content.schema.js'
import { okResponseSchema } from '../schemas/base.schema.js'
import { createWikiLookupFn } from '../lib/wiki-lookup.js'
import { parseWikiLinks, resolveWikiLinks } from '@robin/shared'
import { logger } from '../lib/logger.js'
import { nanoid } from '../lib/id.js'

const log = logger.child({ component: 'content' })

const contentRoutes = new Hono()
contentRoutes.use('*', sessionMiddleware)

// ── Table map for DB lookups ─────────────────────────────────────────────

const TABLE_MAP = {
  fragment: fragments,
  entry: entries,
  thread: threads,
  person: people,
} as const

// ── Helpers ──────────────────────────────────────────────────────────────

function isValidType(type: string): type is ContentType {
  return (VALID_TYPES as readonly string[]).includes(type)
}

// ── GET /:type/:key ─────────────────────────────────────────────────────

contentRoutes.get('/:type/:key', async (c) => {
  const type = c.req.param('type')
  const key = c.req.param('key')
  const userId = c.get('userId') as string

  if (!isValidType(type)) {
    return c.json(
      {
        error: `Invalid content type: ${type}. Valid types: ${VALID_TYPES.join(', ')}`,
      },
      400
    )
  }

  const table = TABLE_MAP[type]
  const [row] = await db
    .select({
      lookupKey: table.lookupKey,
      repoPath: table.repoPath,
      deletedAt: table.deletedAt,
    })
    .from(table)
    .where(and(eq(table.lookupKey, key), eq(table.userId, userId)))
    .limit(1)

  if (!row || row.deletedAt) {
    return c.json({ error: 'Not found' }, 404)
  }

  if (!row.repoPath) {
    return c.json({ error: 'Content not available' }, 404)
  }

  const file = await gatewayClient.read(userId, row.repoPath)
  const raw = file.content
  const format = c.req.query('format')

  if (format === 'structured') {
    const { frontmatter, body } = parseFrontmatter(raw)
    // Apply defaults for common fields
    frontmatter.wikiLinks = frontmatter.wikiLinks ?? []
    frontmatter.brokenLinks = frontmatter.brokenLinks ?? []
    frontmatter.tags = frontmatter.tags ?? []
    return c.json(contentStructuredResponseSchema.parse({ frontmatter, body, raw }))
  }

  return c.json(contentRawResponseSchema.parse({ content: raw }))
})

// ── PUT /:type/:key ─────────────────────────────────────────────────────

contentRoutes.put('/:type/:key', async (c) => {
  const type = c.req.param('type') as string
  const key = c.req.param('key')
  const userId = c.get('userId') as string

  if (!isValidType(type)) {
    return c.json(
      {
        error: `Invalid content type: ${type}. Valid types: ${VALID_TYPES.join(', ')}`,
      },
      400
    )
  }

  const table = TABLE_MAP[type]
  const [row] = await db
    .select({
      lookupKey: table.lookupKey,
      repoPath: table.repoPath,
      deletedAt: table.deletedAt,
    })
    .from(table)
    .where(and(eq(table.lookupKey, key), eq(table.userId, userId)))
    .limit(1)

  if (!row || row.deletedAt) {
    return c.json({ error: 'Not found' }, 404)
  }

  if (!row.repoPath) {
    return c.json({ error: 'Content not available' }, 404)
  }

  // Parse and validate request body
  let rawBody: unknown
  try {
    rawBody = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const schema = WRITE_SCHEMAS[type]
  const parsed = schema.safeParse(rawBody)

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', fields: parsed.error.flatten() }, 400)
  }

  const data = parsed.data as {
    frontmatter: Record<string, unknown>
    body?: string
  }
  const body = type === 'entry' ? '' : (data.body ?? '')

  // Read current content for diff (thread edits) and for base frontmatter
  const currentFile = await gatewayClient.read(userId, row.repoPath)
  const current = parseFrontmatter(currentFile.content)

  // Resolve wiki-links from body
  if (body) {
    const wikiParsed = parseWikiLinks(body)
    const lookupFn = createWikiLookupFn(userId)
    const wikiResult = await resolveWikiLinks(wikiParsed, lookupFn)
    data.frontmatter.wikiLinks = wikiResult.resolved
    data.frontmatter.brokenLinks = wikiResult.broken
  } else {
    data.frontmatter.wikiLinks = []
    data.frontmatter.brokenLinks = []
  }

  // Merge frontmatter: start with existing, overlay user edits
  const mergedFm = { ...current.frontmatter, ...data.frontmatter }

  // Assemble markdown
  const assembled = assembleFrontmatter(mergedFm, body || current.body)

  // Write to gateway
  await gatewayClient.write({
    userId,
    path: row.repoPath,
    content: assembled,
    message: 'content: update via API',
    branch: 'main',
    batch: true,
  })

  // Update DB row
  const now = new Date()
  if (type === 'fragment') {
    await db
      .update(fragments)
      .set({
        title: data.frontmatter.title as string,
        tags: (data.frontmatter.tags as string[]) ?? [],
        updatedAt: now,
      })
      .where(eq(fragments.lookupKey, key))

    // Mark parent threads DIRTY
    // Find threads connected to this fragment via edges
    const threadEdgeRows = await db
      .select({ dstId: edges.dstId })
      .from(edges)
      .where(
        and(
          eq(edges.srcType, 'frag'),
          eq(edges.srcId, key),
          eq(edges.dstType, 'thread'),
          eq(edges.edgeType, 'FRAGMENT_IN_THREAD'),
          isNull(edges.deletedAt)
        )
      )

    if (threadEdgeRows.length > 0) {
      const threadKeys = threadEdgeRows.map((r) => r.dstId)
      await db.execute(
        sql`UPDATE threads SET state = 'DIRTY', updated_at = NOW()
            WHERE lookup_key = ANY(ARRAY[${sql.join(
              threadKeys.map((k) => sql`${k}`),
              sql`, `
            )}])`
      )
      log.info({ fragmentKey: key, threadCount: threadKeys.length }, 'marked parent threads DIRTY')
    }
  } else if (type === 'entry') {
    await db
      .update(entries)
      .set({
        title: data.frontmatter.title as string,
        updatedAt: now,
      })
      .where(eq(entries.lookupKey, key))
  } else if (type === 'thread') {
    await db
      .update(threads)
      .set({
        name: data.frontmatter.name as string,
        type: (data.frontmatter.type as string) ?? 'log',
        prompt: (data.frontmatter.prompt as string) ?? '',
        updatedAt: now,
      })
      .where(eq(threads.lookupKey, key))

    // Log thread body edit delta
    if (body && current.body !== body) {
      const changes = diffLines(current.body, body)
      const additions = changes
        .filter((c) => c.added)
        .map((c) => c.value.trim())
        .filter((v) => v.length > 0)

      if (additions.length > 0) {
        await db.insert(threadEdits).values({
          id: nanoid(),
          threadId: key,
          userId,
          type: 'addition',
          content: additions.join('\n'),
        })
        log.info({ threadKey: key, additionCount: additions.length }, 'logged thread edit delta')
      }
    }
  } else if (type === 'person') {
    await db
      .update(people)
      .set({
        name: data.frontmatter.name as string,
        relationship: (data.frontmatter.relationship as string) ?? '',
        updatedAt: now,
      })
      .where(eq(people.lookupKey, key))
  }

  return c.json(okResponseSchema.parse({ ok: true }))
})

export { contentRoutes }
