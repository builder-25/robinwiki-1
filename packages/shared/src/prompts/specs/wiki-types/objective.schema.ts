import { z } from 'zod'

export const objectiveWikiSchema = z.object({
  markdown: z.string(),
})

export type ObjectiveWikiOutput = z.infer<typeof objectiveWikiSchema>
