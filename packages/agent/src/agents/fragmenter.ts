import { Agent } from '@mastra/core/agent'
import { fragmentationSchema, type FragmentationOutput } from '@robin/shared'
import { FRAGMENT_MODEL } from '@robin/shared'
import { openrouter } from './provider.js'
import { createTypedCaller } from './caller.js'

export const fragmenterAgent = new Agent({
  id: 'fragmenter',
  name: 'Fragmenter',
  instructions: '',
  model: openrouter(FRAGMENT_MODEL),
})

export const fragmentCall: (system: string, user: string) => Promise<FragmentationOutput> =
  createTypedCaller(fragmenterAgent, fragmentationSchema)
