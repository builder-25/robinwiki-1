import { z } from 'zod'

export const systemStatusResponseSchema = z.object({
  initialized: z.boolean(),
  version: z.string(),
  instanceId: z.string(),
  onboarded: z.boolean(),
  createdAt: z.string().nullable(),
})
