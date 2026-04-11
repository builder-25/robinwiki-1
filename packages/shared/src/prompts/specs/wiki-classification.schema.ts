import { z } from 'zod'

export const wikiClassificationSchema = z.object({
  assignments: z.array(
    z.object({
      wikiKey: z.string(),
      wikiName: z.string(),
      confidence: z.number(),
      reasoning: z.string(),
    })
  ),
  noMatchReason: z.string().optional(),
})

export type WikiClassificationOutput = z.infer<typeof wikiClassificationSchema>
