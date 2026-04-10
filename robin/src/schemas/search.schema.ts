import { z } from 'zod'

// ── Query schemas ───────────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'q is required'),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  minScore: z.coerce.number().optional(),
  vaultId: z.string().optional(),
})

// ── Response schemas ────────────────────────────────────────────────────────

export const searchResultSchema = z.object({
  score: z.number(),
  fragmentId: z.string(),
  title: z.string(),
  fragment: z.string(),
  tags: z.array(z.string()),
  vaultId: z.string().nullable().optional(),
  threadId: z.string().nullable().optional(),
})

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
})
