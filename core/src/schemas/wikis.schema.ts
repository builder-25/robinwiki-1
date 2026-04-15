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

export const wikiDetailResponseSchema = threadResponseSchema.extend({
  wikiContent: z.string(),
  fragments: z.array(
    z.object({
      id: lookupKeySchema,
      slug: z.string(),
      title: z.string(),
      snippet: z.string(),
    })
  ),
  people: z.array(
    z.object({
      id: lookupKeySchema,
      name: z.string(),
    })
  ),
})

export const threadListResponseSchema = z.object({
  wikis: z.array(threadResponseSchema),
})

// ── Request schemas ─────────────────────────────────────────────────────────

export const createThreadBodySchema = z.object({
  name: z.string().min(3, 'name must be at least 3 characters'),
  type: z.string().default('log'),
  prompt: z.string().optional(),
})

export const updateThreadBodySchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  prompt: z.string().optional(),
})

export { queuedResponseSchema as threadRegenerateResponseSchema }

// ── Bouncer mode schemas ──────────────────────────────────────────────────

export const bouncerModeBodySchema = z.object({
  mode: z.enum(['auto', 'review']),
})

export const bouncerModeResponseSchema = z.object({
  id: lookupKeySchema,
  bouncerMode: z.enum(['auto', 'review']),
})

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

// ── Spawn schemas ────────────────────────────────────────────────────

export const spawnWikiBodySchema = z.object({
  name: z.string().min(3, 'name must be at least 3 characters'),
  type: z.string().optional(),
})

export const spawnWikiResponseSchema = z.object({
  lookupKey: lookupKeySchema,
  slug: z.string(),
  name: z.string(),
  type: z.string(),
  parentKey: lookupKeySchema,
  fragmentCount: z.number(),
})

// ── Regenerate toggle schemas ─────────────────────────────────────────────

export const toggleRegenerateBodySchema = z.object({
  regenerate: z.boolean(),
})

export const toggleRegenerateResponseSchema = z.object({
  id: lookupKeySchema,
  regenerate: z.boolean(),
})
