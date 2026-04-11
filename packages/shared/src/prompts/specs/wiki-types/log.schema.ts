import { z } from 'zod'

export const logWikiSchema = z.object({
  markdown: z.string(),
})

export type LogWikiOutput = z.infer<typeof logWikiSchema>
