import { z } from 'zod'

export const skillWikiSchema = z.object({
  markdown: z.string(),
})

export type SkillWikiOutput = z.infer<typeof skillWikiSchema>
