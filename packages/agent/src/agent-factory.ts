import { Agent } from '@mastra/core/agent'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { OpenRouterConfig } from './openrouter-config.js'

export interface IngestAgents {
  vaultClassifier: Agent
  fragmenter: Agent
  entityExtractor: Agent
  wikiClassifier: Agent
  fragScorer: Agent
}

/**
 * Builds a fresh set of Mastra agents for a single ingest run.
 * Called once per job — not module-level. The config is sourced from
 * the `configs` table (encrypted via the crypto envelope) by core.
 */
export function createIngestAgents(config: OpenRouterConfig): IngestAgents {
  const openrouter = createOpenRouter({ apiKey: config.apiKey })
  const model = openrouter(config.chatModel)

  return {
    vaultClassifier: new Agent({
      id: 'vault-classifier',
      name: 'VaultClassifier',
      instructions: '',
      model,
    }),
    fragmenter: new Agent({
      id: 'fragmenter',
      name: 'Fragmenter',
      instructions: '',
      model,
    }),
    entityExtractor: new Agent({
      id: 'entity-extractor',
      name: 'EntityExtractor',
      instructions: '',
      model,
    }),
    wikiClassifier: new Agent({
      id: 'wiki-classifier',
      name: 'Marcel',
      instructions: '',
      model,
    }),
    fragScorer: new Agent({
      id: 'frag-scorer',
      name: 'Judge',
      instructions: '',
      model,
    }),
  }
}
