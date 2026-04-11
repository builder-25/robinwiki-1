import { z } from 'zod'

export const wikiRelevanceSchema = z.object({
  score: z.number(),
  reasoning: z.string(),
})

export type WikiRelevanceOutput = z.infer<typeof wikiRelevanceSchema>
