import { z } from 'zod'

// ── Response schemas ────────────────────────────────────────────────────────

export const groupResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  icon: z.string(),
  color: z.string(),
  description: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  wikiCount: z.number().default(0),
})

export const groupListResponseSchema = z.object({
  groups: z.array(groupResponseSchema),
})

export const groupDetailResponseSchema = groupResponseSchema

export const groupWikiResponseSchema = z.object({
  groupId: z.string(),
  wikiId: z.string(),
  addedAt: z.coerce.date(),
})

export const groupWikisListResponseSchema = z.object({
  wikis: z.array(
    z.object({
      lookupKey: z.string(),
      slug: z.string(),
      name: z.string(),
      type: z.string(),
      fragmentCount: z.number(),
    })
  ),
})

// ── Request schemas ─────────────────────────────────────────────────────────

export const createGroupBodySchema = z.object({
  name: z.string().min(1, 'name is required'),
  slug: z.string().min(1, 'slug is required'),
  icon: z.string().default(''),
  color: z.string().default(''),
  description: z.string().default(''),
})

export const updateGroupBodySchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
})

export const addWikiToGroupBodySchema = z.object({
  wikiId: z.string().min(1, 'wikiId is required'),
})
