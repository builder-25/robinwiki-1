import { z } from 'zod'
import { okResponseSchema } from './base.schema.js'

// ── Response schemas ────────────────────────────────────────────────────────

export const userProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  mcpEndpointUrl: z.string(),
  apiKeyHint: z.string(),
  onboardedAt: z.string().nullable(),
})

export const userStatsResponseSchema = z.object({
  totalNotes: z.number(),
  totalThreads: z.number(),
  peopleCount: z.number(),
  unthreadedCount: z.number(),
  lastSync: z.string(),
})

export const activityItemSchema = z.object({
  action: z.string(),
  time: z.string(),
})

export const userActivityResponseSchema = z.object({
  activity: z.array(activityItemSchema),
})

export const keypairResponseSchema = z.object({
  algorithm: z.string(),
  publicKey: z.string(),
  privateKey: z.string(),
})

export const mcpEndpointResponseSchema = z.object({
  mcpEndpointUrl: z.string(),
})

export const exportDataResponseSchema = z.object({
  exportedAt: z.string(),
  vaults: z.array(z.any()),
  wikis: z.array(z.any()),
  fragments: z.array(z.any()),
  people: z.array(z.any()),
})

export { okResponseSchema }
