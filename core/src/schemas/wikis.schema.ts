import { z } from 'zod'
import { lookupKeySchema, objectStateSchema, queuedResponseSchema } from './base.schema.js'

// ── Response schemas ────────────────────────────────────────────────────────

export const threadResponseSchema = z.object({
  id: lookupKeySchema,
  lookupKey: lookupKeySchema,
  slug: z.string(),
  name: z.string(),
  type: z.string(),
  prompt: z.string(),
  state: objectStateSchema,
  vaultId: z.string().nullable(),
  lastRebuiltAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  noteCount: z.number().default(0),
  lastUpdated: z.string(),
  shortDescriptor: z.string().default(''),
  descriptor: z.string().default(''),
})

export const threadWithWikiResponseSchema = threadResponseSchema.extend({
  wikiContent: z.string(),
})

export const threadListResponseSchema = z.object({
  wikis: z.array(threadResponseSchema),
})

// ── Request schemas ─────────────────────────────────────────────────────────

export const createThreadBodySchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: z.string().default('log'),
  prompt: z.string().optional(),
})

export const updateThreadBodySchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  prompt: z.string().optional(),
})

export { queuedResponseSchema as threadRegenerateResponseSchema }

// ── Publish schemas ────────────────────────────────────────────────────────

export const publishWikiResponseSchema = z.object({
  published: z.boolean(),
  publishedSlug: z.string().nullable(),
  publishedAt: z.coerce.date().nullable(),
  regenerate: z.boolean(),
})

export const publicWikiResponseSchema = z.object({
  name: z.string(),
  type: z.string(),
  publishedAt: z.coerce.date(),
  content: z.string(),
})
