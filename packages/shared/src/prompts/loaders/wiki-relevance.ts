import { z } from 'zod'
import { loadSpec, renderTemplate } from '../loader.js'
import { wikiRelevanceSchema } from '../specs/wiki-relevance.schema.js'
import type { PromptResult } from '../types.js'

const inputSchema = z.object({
  wikiName: z.string(),
  threadType: z.string(),
  threadDescription: z.string(),
  threadSummary: z.string().optional(),
  fragmentContent: z.string(),
})

export function loadWikiRelevanceSpec(vars: {
  wikiName: string
  threadType: string
  threadDescription: string
  threadSummary?: string
  fragmentContent: string
}): PromptResult {
  const validated = inputSchema.parse(vars)
  const spec = loadSpec('wiki-relevance.yaml')
  const user = renderTemplate(spec.template, validated)
  return {
    system: spec.system_message,
    user,
    meta: {
      temperature: spec.temperature,
      outputSchema: wikiRelevanceSchema,
    },
  }
}
