import { Agent } from '@mastra/core/agent'
import { DEFAULT_MODEL } from '@robin/shared'
import { openrouter } from './provider.js'
import { createStringCaller } from './caller.js'

export const personSynthesizerAgent = new Agent({
  id: 'person-synthesizer',
  name: 'PersonSynthesizer',
  instructions: '',
  model: openrouter(DEFAULT_MODEL),
})

export const personSynthesizeCall = createStringCaller(personSynthesizerAgent)
