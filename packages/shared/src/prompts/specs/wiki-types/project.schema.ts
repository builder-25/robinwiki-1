import { z } from 'zod'
import { wikiInfoboxSchema, wikiCitationDeclarationSchema } from '../../../schemas/sidecar.js'

export const projectWikiSchema = z.object({
  markdown: z.string(),
  infobox: wikiInfoboxSchema.nullable().default(null),
  citations: z.array(wikiCitationDeclarationSchema).default([]),
})

export type ProjectWikiOutput = z.infer<typeof projectWikiSchema>
