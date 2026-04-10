import { z } from 'zod'

// ── Shared field schemas ────────────────────────────────────────────────────

export const lookupKeySchema = z.string().min(1)

export const objectStateSchema = z.enum(['PENDING', 'RESOLVED', 'LINKING', 'DIRTY'])

// ── Pagination ──────────────────────────────────────────────────────────────

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// ── Standard response shapes ────────────────────────────────────────────────

export const errorResponseSchema = z.object({
  error: z.string(),
  fields: z.any().optional(),
})

export const okResponseSchema = z.object({ ok: z.literal(true) })

export const queuedResponseSchema = z.object({
  status: z.literal('queued'),
  jobId: z.string(),
})
