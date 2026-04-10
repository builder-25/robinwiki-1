import { Agent } from '@mastra/core/agent'
import { DEFAULT_MODEL } from '@robin/shared'
import { openrouter } from './provider.js'
import { createStringCaller } from './caller.js'

export const wikiGeneratorAgent = new Agent({
  id: 'wiki-generator',
  name: 'WikiGenerator',
  instructions: '',
  model: openrouter(DEFAULT_MODEL),
})

export const wikiGenerateCall = createStringCaller(wikiGeneratorAgent)
