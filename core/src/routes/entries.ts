import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { sessionMiddleware } from '../middleware/session.js'
import { producer } from '../queue/producer.js'
import { db } from '../db/client.js'
import { entries as entriesTable, fragments, vaults } from '../db/schema.js'
import { makeLookupKey, parseLookupKey, generateSlug } from '@robin/shared'
import { resolveEntrySlug } from '../db/slug.js'
import { computeContentHash, findDuplicateEntry } from '../db/dedup.js'
import type { ExtractionJob } from '@robin/queue'
import { validationHook } from '../lib/validation.js'
import {
  entryResponseSchema,
  entryCreatedResponseSchema,
  entryListResponseSchema,
  createEntryBodySchema,
  entryListQuerySchema,
} from '../schemas/entries.schema.js'
import { fragmentListResponseSchema } from '../schemas/fragments.schema.js'
import { emitAuditEvent } from '../db/audit.js'

const entries = new Hono()
entries.use('*', sessionMiddleware)

// POST /entries — accept raw input, persist entry row, enqueue extraction job
entries.post('/', zValidator('json', createEntryBodySchema, validationHook), async (c) => {
  const { content, title, source, type, vaultId } = c.req.valid('json')

  /** @gate — validate vaultId exists */
  if (vaultId) {
    const [vault] = await db.select({ id: vaults.id }).from(vaults).where(eq(vaults.id, vaultId))
    if (!vault) return c.json({ error: 'Vault not found' }, 404)
  }

  // Content-level dedup: reject if identical content already exists
  const hash = computeContentHash(content)
  const existing = await findDuplicateEntry(db, hash)
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
  const slug = await resolveEntrySlug(db, generateSlug(title ?? content.slice(0, 80)))

  // Persist entry row — pure DB, no git write-through
  const [entry] = await db
    .insert(entriesTable)
    .values({
      lookupKey: entryKey,
      slug,
      vaultId: vaultId ?? null,
      title: title ?? content.slice(0, 80),
      content,
      dedupHash: hash,
      type,
      source,
      ingestStatus: 'pending',
    })
    .returning()

  // Enqueue extraction job directly (no legacy WriteJob path)
  const job: ExtractionJob = {
    type: 'extraction',
    jobId: entryUlid,
    entryKey,
    content,
    source,
    vaultId: vaultId ?? null,
    enqueuedAt: new Date().toISOString(),
  }

  await producer.enqueueExtraction(job)

  await emitAuditEvent(db, {
    entityType: 'raw_source',
    entityId: entryKey,
    eventType: 'ingested',
    source: 'api',
    summary: `Entry ingested: ${(title ?? content.slice(0, 80)).slice(0, 80)}`,
    detail: { entryKey, source: source ?? 'api', vaultId: vaultId ?? null },
  })

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

// GET /entries — list entries
entries.get('/', async (c) => {
  const query = entryListQuerySchema.safeParse({ limit: c.req.query('limit') })
  const limit = query.success ? query.data.limit : 50
  const rows = await db
    .select()
    .from(entriesTable)
    .orderBy(desc(entriesTable.createdAt))
    .limit(limit)
  return c.json(
    entryListResponseSchema.parse({ entries: rows.map((r) => ({ ...r, id: r.lookupKey })) })
  )
})

// GET /entries/:id — get entry by id
entries.get('/:id', async (c) => {
  const id = c.req.param('id')

  const [entry] = await db.select().from(entriesTable).where(eq(entriesTable.lookupKey, id))
  if (!entry) return c.json({ error: 'Not found' }, 404)

  return c.json(entryResponseSchema.parse({ ...entry, id: entry.lookupKey }))
})

// GET /entries/:id/fragments — get all fragments derived from an entry
entries.get('/:id/fragments', async (c) => {
  const id = c.req.param('id')

  const [entry] = await db.select().from(entriesTable).where(eq(entriesTable.lookupKey, id))
  if (!entry) return c.json({ error: 'Not found' }, 404)

  const rows = await db
    .select()
    .from(fragments)
    .where(eq(fragments.entryId, id))
    .orderBy(desc(fragments.createdAt))

  return c.json(
    fragmentListResponseSchema.parse({ fragments: rows.map((r) => ({ ...r, id: r.lookupKey })) })
  )
})

export { entries }
