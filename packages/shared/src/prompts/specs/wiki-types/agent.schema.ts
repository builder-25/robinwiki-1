import { z } from 'zod'

export const agentWikiSchema = z.object({
  markdown: z.string(),
})

export type AgentWikiOutput = z.infer<typeof agentWikiSchema>
