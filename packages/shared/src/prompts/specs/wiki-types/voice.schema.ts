import { z } from 'zod'

export const voiceWikiSchema = z.object({
  markdown: z.string(),
})

export type VoiceWikiOutput = z.infer<typeof voiceWikiSchema>
