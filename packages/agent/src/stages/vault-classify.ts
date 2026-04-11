import { loadVaultClassificationSpec } from '@robin/shared'
import type { StageResult, VaultClassifyDeps, VaultClassifyResult } from './types.js'

/**
 * Vault classification stage.
 * If user pre-selected a vault, returns immediately. Otherwise uses LLM to
 * pick the best vault, falling back to the default vault when confidence is low.
 */
export async function vaultClassify(
  deps: VaultClassifyDeps,
  input: { content: string; userSelectedVaultId: string | null }
): Promise<StageResult<VaultClassifyResult>> {
  const start = performance.now()

  if (input.userSelectedVaultId) {
    return {
      data: {
        vaultId: input.userSelectedVaultId,
        vaultName: '',
        confidence: 1.0,
        wasUserSelected: true,
      },
      durationMs: performance.now() - start,
    }
  }

  const vaults = await deps.listVaults()
  const vaultsJson = JSON.stringify(vaults)
  const spec = loadVaultClassificationSpec({ content: input.content, vaults: vaultsJson })
  const result = await deps.llmCall(spec.system, spec.user)

  const vaultId =
    result.confidence < deps.confidenceThreshold ? deps.fallbackVaultId : result.vaultKey
  const vaultName = result.confidence < deps.confidenceThreshold ? '' : result.vaultName

  return {
    data: {
      vaultId,
      vaultName,
      confidence: result.confidence,
      wasUserSelected: false,
    },
    durationMs: performance.now() - start,
  }
}
