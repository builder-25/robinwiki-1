import { Agent } from '@mastra/core/agent'
import { peopleExtractionSchema, type PeopleExtractionOutput } from '@robin/shared'
import { DEFAULT_MODEL } from '@robin/shared'
import { openrouter } from './provider.js'
import { createTypedCaller } from './caller.js'

export const entityExtractorAgent = new Agent({
  id: 'entity-extractor',
  name: 'EntityExtractor',
  instructions: '',
  model: openrouter(DEFAULT_MODEL),
})

export const entityExtractCall: (system: string, user: string) => Promise<PeopleExtractionOutput> =
  createTypedCaller(entityExtractorAgent, peopleExtractionSchema)
