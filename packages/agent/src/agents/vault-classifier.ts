import { Agent } from '@mastra/core/agent'
import { vaultClassificationSchema, type VaultClassificationOutput } from '@robin/shared'
import { FAST_MODEL } from '@robin/shared'
import { openrouter } from './provider.js'
import { createTypedCaller } from './caller.js'

export const vaultClassifierAgent = new Agent({
  id: 'vault-classifier',
  name: 'VaultClassifier',
  instructions: '',
  model: openrouter(FAST_MODEL),
})

export const vaultClassifyCall: (
  system: string,
  user: string
) => Promise<VaultClassificationOutput> = createTypedCaller(
  vaultClassifierAgent,
  vaultClassificationSchema
)
