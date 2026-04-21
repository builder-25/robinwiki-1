import { z } from 'zod'
import { wikiInfoboxSchema, wikiCitationDeclarationSchema } from '../../../schemas/sidecar.js'

export const agentWikiSchema = z.object({
  markdown: z.string(),
  infobox: wikiInfoboxSchema.nullable().default(null),
  citations: z.array(wikiCitationDeclarationSchema).default([]),
})

export type AgentWikiOutput = z.infer<typeof agentWikiSchema>
