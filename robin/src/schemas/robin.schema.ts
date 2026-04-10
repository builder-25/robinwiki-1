import { z } from 'zod'

// ── Response schemas ────────────────────────────────────────────────────────

export const configNoteResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  key: z.string(),
  title: z.string(),
  content: z.string(),
  frontmatter: z.any(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const configNoteListResponseSchema = z.object({
  configNotes: z.array(configNoteResponseSchema),
})

// ── Request schemas ─────────────────────────────────────────────────────────

export const updateConfigNoteBodySchema = z.object({
  content: z.string().optional(),
  frontmatter: z.record(z.unknown()).optional(),
})
