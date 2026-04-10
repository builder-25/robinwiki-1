import { z } from 'zod'
import { lookupKeySchema, objectStateSchema, queuedResponseSchema } from './base.schema.js'

// ── Response schemas ────────────────────────────────────────────────────────

export const personResponseSchema = z.object({
  id: lookupKeySchema,
  lookupKey: lookupKeySchema,
  userId: z.string(),
  slug: z.string(),
  name: z.string(),
  relationship: z.string(),
  sections: z.any(),
  state: objectStateSchema,
  repoPath: z.string(),
  lastRebuiltAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const personWithBacklinksResponseSchema = personResponseSchema.extend({
  backlinkFragmentIds: z.array(z.string()),
  backlinkThreadIds: z.array(z.string()),
})

export const personListResponseSchema = z.object({
  people: z.array(personResponseSchema),
})

export { queuedResponseSchema as personRegenerateResponseSchema }
