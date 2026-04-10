import { Agent } from '@mastra/core/agent'
import { fragmentRelevanceSchema, type FragmentRelevanceOutput } from '@robin/shared'
import { FAST_MODEL } from '@robin/shared'
import { openrouter } from './provider.js'
import { createTypedCaller } from './caller.js'

export const fragScorerAgent = new Agent({
  id: 'frag-scorer',
  name: 'Judge',
  instructions: '',
  model: openrouter(FAST_MODEL),
})

export const fragScoreCall: (system: string, user: string) => Promise<FragmentRelevanceOutput> =
  createTypedCaller(fragScorerAgent, fragmentRelevanceSchema)
