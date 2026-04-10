import { z } from 'zod'

// ── Request schemas ─────────────────────────────────────────────────────────

export const syncNotifyFileSchema = z.object({
  path: z.string(),
  operation: z.enum(['add', 'modify', 'delete']),
  content: z.string(),
  frontmatterHash: z.string().optional(),
  bodyHash: z.string().optional(),
  contentHash: z.string().optional(),
})

export const syncNotifyPayloadSchema = z.object({
  userId: z.string().min(1, 'userId required'),
  commitHash: z.string(),
  files: z.array(syncNotifyFileSchema),
})

// ── Response schemas ────────────────────────────────────────────────────────

export const syncAcceptedResponseSchema = z.object({
  status: z.literal('accepted'),
})
