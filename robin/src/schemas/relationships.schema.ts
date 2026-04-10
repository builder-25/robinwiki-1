import { z } from 'zod'

// ── Response schemas ────────────────────────────────────────────────────────

export const relationshipItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  edgeType: z.string(),
})

export const relationshipsResponseSchema = z.object({
  relationships: z.record(z.array(relationshipItemSchema)),
})
