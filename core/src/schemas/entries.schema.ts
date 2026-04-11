import { z } from 'zod'
import { lookupKeySchema, objectStateSchema, paginationQuerySchema } from './base.schema.js'

// ── Response schemas ────────────────────────────────────────────────────────

export const entryResponseSchema = z.object({
  id: lookupKeySchema,
  lookupKey: lookupKeySchema,
  slug: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.string(),
  source: z.string(),
  vaultId: z.string().nullable(),
  state: objectStateSchema,
  ingestStatus: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const entryCreatedResponseSchema = entryResponseSchema.extend({
  jobId: z.string(),
  status: z.enum(['queued', 'duplicate']),
})

export const entryListResponseSchema = z.object({
  entries: z.array(entryResponseSchema),
})

// ── Request schemas ─────────────────────────────────────────────────────────

export const createEntryBodySchema = z.object({
  content: z.string().min(1, 'content is required'),
  title: z.string().optional(),
  source: z.string().default('api'),
  type: z.string().default('thought'),
  vaultId: z.string().optional(),
})

// ── Query schemas ───────────────────────────────────────────────────────────

export const entryListQuerySchema = paginationQuerySchema
