import { z } from 'zod'
import { lookupKeySchema, objectStateSchema, paginationQuerySchema } from './base.schema.js'

// ── Response schemas ────────────────────────────────────────────────────────

export const fragmentResponseSchema = z.object({
  id: lookupKeySchema,
  lookupKey: lookupKeySchema,
  userId: z.string(),
  slug: z.string(),
  title: z.string(),
  type: z.string().nullable(),
  tags: z.array(z.string()),
  entryId: z.string().nullable(),
  vaultId: z.string().nullable(),
  state: objectStateSchema,
  repoPath: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const fragmentWithContentResponseSchema = fragmentResponseSchema.extend({
  content: z.string(),
})

export const fragmentListResponseSchema = z.object({
  fragments: z.array(fragmentResponseSchema),
})

// ── Request schemas ─────────────────────────────────────────────────────────

export const createFragmentBodySchema = z.object({
  title: z.string().min(1, 'title is required'),
  content: z.string().optional(),
  entryId: z.string().min(1, 'entryId is required'),
  tags: z.array(z.string()).default([]),
})

export const updateFragmentBodySchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

// ── Query schemas ───────────────────────────────────────────────────────────

export const fragmentListQuerySchema = paginationQuerySchema
