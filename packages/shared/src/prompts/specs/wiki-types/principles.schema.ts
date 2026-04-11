import { z } from 'zod'

export const principlesWikiSchema = z.object({
  markdown: z.string(),
})

export type PrinciplesWikiOutput = z.infer<typeof principlesWikiSchema>
