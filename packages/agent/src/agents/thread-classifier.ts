import { Agent } from '@mastra/core/agent'
import { threadClassificationSchema, type ThreadClassificationOutput } from '@robin/shared'
import { FAST_MODEL } from '@robin/shared'
import { openrouter } from './provider.js'
import { createTypedCaller } from './caller.js'

export const threadClassifierAgent = new Agent({
  id: 'thread-classifier',
  name: 'Marcel',
  instructions: '',
  model: openrouter(FAST_MODEL),
})

export const threadClassifyCall: (
  system: string,
  user: string
) => Promise<ThreadClassificationOutput> = createTypedCaller(
  threadClassifierAgent,
  threadClassificationSchema
)
