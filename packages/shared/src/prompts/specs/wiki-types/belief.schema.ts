import { z } from 'zod'

export const beliefWikiSchema = z.object({
  markdown: z.string(),
})

export type BeliefWikiOutput = z.infer<typeof beliefWikiSchema>
