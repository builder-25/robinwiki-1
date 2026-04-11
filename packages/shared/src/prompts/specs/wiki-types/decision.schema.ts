import { z } from 'zod'

export const decisionWikiSchema = z.object({
  markdown: z.string(),
})

export type DecisionWikiOutput = z.infer<typeof decisionWikiSchema>
