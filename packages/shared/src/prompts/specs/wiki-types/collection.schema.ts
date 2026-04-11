import { z } from 'zod'

export const collectionWikiSchema = z.object({
  markdown: z.string(),
})

export type CollectionWikiOutput = z.infer<typeof collectionWikiSchema>
