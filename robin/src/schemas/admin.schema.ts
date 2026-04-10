import { z } from 'zod'

// ── Response schemas ────────────────────────────────────────────────────────

export const retryStuckDryRunResponseSchema = z.object({
  dryRun: z.literal(true),
  count: z.number(),
  fragments: z.array(
    z.object({
      fragmentKey: z.string(),
      userId: z.string(),
      entryKey: z.string(),
    })
  ),
})

export const retryStuckResponseSchema = z.object({
  enqueued: z.number(),
  errors: z.array(
    z.object({
      fragmentKey: z.string(),
      error: z.string(),
    })
  ),
  minutes: z.number(),
})
