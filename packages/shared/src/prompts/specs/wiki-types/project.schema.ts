import { z } from 'zod'

export const projectWikiSchema = z.object({
  markdown: z.string(),
})

export type ProjectWikiOutput = z.infer<typeof projectWikiSchema>
