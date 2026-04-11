import { z } from 'zod'
import { loadSpec, renderTemplate } from '../loader.js'
import { wikiClassificationSchema } from '../specs/wiki-classification.schema.js'
import type { PromptResult } from '../types.js'

const inputSchema = z.object({
  content: z.string(),
  wikis: z.string(),
  fragmentContext: z.string().optional(),
})

export function loadWikiClassificationSpec(vars: {
  content: string
  wikis: string
  fragmentContext?: string
}): PromptResult {
  const validated = inputSchema.parse(vars)
  const spec = loadSpec('wiki-classification.yaml')
  const user = renderTemplate(spec.template, validated)
  return {
    system: spec.system_message,
    user,
    meta: {
      temperature: spec.temperature,
      outputSchema: wikiClassificationSchema,
    },
  }
}
