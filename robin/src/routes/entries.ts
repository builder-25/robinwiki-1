import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { sessionMiddleware } from '../middleware/session.js'
import { producer } from '../queue/producer.js'
import { spawnWriteWorker } from '../queue/worker.js'
import { db } from '../db/client.js'
import { entries as entriesTable, fragments, vaults } from '../db/schema.js'
import { gatewayClient } from '../gateway/client.js'
import { makeLookupKey, parseLookupKey, generateSlug } from '@robin/shared'
import { resolveEntrySlug } from '../db/slug.js'
import { computeContentHash, findDuplicateEntry } from '../db/dedup.js'
import type { WriteJob } from '@robin/queue'
import { logger } from '../lib/logger.js'
import { validationHook } from '../lib/validation.js'
import {
  entryResponseSchema,
  entryCreatedResponseSchema,
  entryListResponseSchema,
  createEntryBodySchema,
  entryListQuerySchema,
} from '../schemas/entries.schema.js'
import { fragmentListResponseSchema } from '../schemas/fragments.schema.js'

const log = logger.child({ component: 'entries' })

const entries = new Hono()
entries.use('*', sessionMiddleware)

// POST /entries — accept raw input, persist entry row, enqueue write job
entries.post('/', zValidator('json', createEntryBodySchema, validationHook), async (c) => {
  const userId = c.get('userId') as string
  const { content, title, source, type, vaultId } = c.req.valid('json')

  /** @gate — validate vaultId exists and belongs to user */
  if (vaultId) {
    const [vault] = await db
      .select({ id: vaults.id })
      .from(vaults)
      .where(and(eq(vaults.id, vaultId), eq(vaults.userId, userId)))
    if (!vault) return c.json({ error: 'Vault not found' }, 404)
  }

  // Content-level dedup: reject if identical content already exists for this user
  const hash = computeContentHash(content)
  const existing = await findDuplicateEntry(db, userId, hash)
  if (existing) {
    return c.json(
      entryCreatedResponseSchema.parse({
        ...existing,
        id: existing.lookupKey,
        jobId: parseLookupKey(existing.lookupKey).ulid,
        status: 'duplicate',
      }),
      200
    )
  }

  const entryKey = makeLookupKey('entry')
  const { ulid: entryUlid } = parseLookupKey(entryKey)
  const slug = await resolveEntrySlug(db, userId, generateSlug(title ?? content.slice(0, 80)))
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]

  // Write verbatim note to git
  const noteFilePath = `var/raw/${dateStr}-${slug}.${entryKey}.md`
  const noteContent = `---
created_at: ${now.toISOString()}
source: ${source}
entry_id: ${entryKey}
---

${content}`

  let noteWriteOk = false
  try {
    await gatewayClient.write({
      userId,
      path: noteFilePath,
      content: noteContent,
      message: `note: raw entry ${entryUlid.slice(0, 8)}`,
      branch: 'main',
    })
    noteWriteOk = true
  } catch (err) {
    log.error({ err }, 'note write failed')
  }

  // Persist entry row — using lookupKey as PK now
  const [entry] = await db
    .insert(entriesTable)
    .values({
      lookupKey: entryKey,
      userId,
      slug,
      vaultId: vaultId ?? null,
      title: title ?? content.slice(0, 80),
      content,
      dedupHash: hash,
      type,
      source,
      repoPath: noteWriteOk ? noteFilePath : '',
    })
    .returning()

  const job: WriteJob = {
    type: 'write',
    jobId: entryUlid,
    userId,
    enqueuedAt: new Date().toISOString(),
    payload: {
      userId,
      rawEntry: {
        content,
        source: source as 'api' | 'mcp' | 'web',
        metadata: vaultId ? { vaultId } : undefined,
      },
      jobId: entryUlid,
      enqueuedAt: new Date().toISOString(),
      entryId: entryKey,
      noteFilePath,
    },
  }

  await producer.enqueueWrite(userId, job)
  // Ensure worker is running for this user (no-op if already running)
  spawnWriteWorker(userId)

  return c.json(
    entryCreatedResponseSchema.parse({
      ...entry,
      id: entry.lookupKey,
      jobId: entryUlid,
      status: 'queued',
    }),
    202
  )
})

// GET /entries — list user's entries
entries.get('/', async (c) => {
  const userId = c.get('userId') as string
  const query = entryListQuerySchema.safeParse({ limit: c.req.query('limit') })
  const limit = query.success ? query.data.limit : 50
  const rows = await db
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.userId, userId))
    .orderBy(desc(entriesTable.createdAt))
    .limit(limit)
  return c.json(
    entryListResponseSchema.parse({ entries: rows.map((r) => ({ ...r, id: r.lookupKey })) })
  )
})

// GET /entries/:id — get entry by id
entries.get('/:id', async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')

  const [entry] = await db.select().from(entriesTable).where(eq(entriesTable.lookupKey, id))
  if (!entry || entry.userId !== userId) return c.json({ error: 'Not found' }, 404)

  return c.json(entryResponseSchema.parse({ ...entry, id: entry.lookupKey }))
})

// GET /entries/:id/fragments — get all fragments derived from an entry
entries.get('/:id/fragments', async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')

  const [entry] = await db.select().from(entriesTable).where(eq(entriesTable.lookupKey, id))
  if (!entry || entry.userId !== userId) return c.json({ error: 'Not found' }, 404)

  const rows = await db
    .select()
    .from(fragments)
    .where(and(eq(fragments.userId, userId), eq(fragments.entryId, id)))
    .orderBy(desc(fragments.createdAt))

  return c.json(
    fragmentListResponseSchema.parse({ fragments: rows.map((r) => ({ ...r, id: r.lookupKey })) })
  )
})

export { entries }
