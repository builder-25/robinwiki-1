import { z } from 'zod'
import { wikiInfoboxSchema, wikiCitationDeclarationSchema } from '../../../schemas/sidecar.js'

export const decisionWikiSchema = z.object({
  markdown: z.string(),
  infobox: wikiInfoboxSchema.nullable().default(null),
  citations: z.array(wikiCitationDeclarationSchema).default([]),
})

export type DecisionWikiOutput = z.infer<typeof decisionWikiSchema>
