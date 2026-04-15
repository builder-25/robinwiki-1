import { z } from 'zod'

// POST /users/preferences/ai body
export const saveAiPreferencesBodySchema = z.object({
  openRouterKey: z.string().min(1),
})

// GET /users/preferences/ai response
export const aiPreferencesResponseSchema = z.object({
  hasOpenRouterKey: z.boolean(),
  modelPreference: z.string().nullable(),
})

// PUT /users/prompts body -- each field is an optional string override
export const savePromptsBodySchema = z.object({
  extraction: z.string().optional(),
  wikiClassify: z.string().optional(),
  wikiGeneration: z.string().optional(),
})

// GET /users/prompts response
export const promptsResponseSchema = z.object({
  extraction: z.string().nullable(),
  wikiClassify: z.string().nullable(),
  wikiGeneration: z.string().nullable(),
})
