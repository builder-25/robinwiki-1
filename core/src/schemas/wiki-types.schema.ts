import { z } from 'zod'

export const wikiTypeResponseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  shortDescriptor: z.string(),
  descriptor: z.string(),
  prompt: z.string(),
  isDefault: z.boolean(),
  userModified: z.boolean(),
  basedOnVersion: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const wikiTypeListResponseSchema = z.object({
  wikiTypes: z.array(wikiTypeResponseSchema),
})

export const createWikiTypeBodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1),
  shortDescriptor: z.string().min(1),
  descriptor: z.string().min(1),
  prompt: z.string().default(''),
})

export const updateWikiTypeBodySchema = z.object({
  name: z.string().optional(),
  shortDescriptor: z.string().optional(),
  descriptor: z.string().optional(),
  prompt: z.string().optional(),
})

// ─── Enhanced response shapes (Plan 04) ──────────────────────────────────────

export const wikiTypeItemResponseSchema = z.object({
  slug: z.string(),
  displayLabel: z.string(),
  displayDescription: z.string(),
  displayShortDescriptor: z.string(),
  displayOrder: z.number().int(),
  promptYaml: z.string(),
  defaultYaml: z.string(),
  userModified: z.boolean(),
  basedOnVersion: z.number().int(),
  inputVariables: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      required: z.boolean(),
    })
  ),
})

export const wikiTypesListResponseSchema = z.object({
  wikiTypes: z.array(wikiTypeItemResponseSchema),
})

// NOTE: no .max() on promptYaml here. The 32KB byte-length cap is enforced
// inside validatePromptYaml so a too-large body returns { code: 'YAML_TOO_LARGE' }
// with a stable, switchable error code — NOT the zValidator generic
// "Validation failed" shape. Keep .min(1) so an empty body still fails fast
// at the zod layer.
export const putWikiTypePromptBodySchema = z.object({
  promptYaml: z.string().min(1),
})

export const defaultYamlResponseSchema = z.object({
  slug: z.string(),
  yaml: z.string(),
})
