// ── Dedup ────────────────────────────────────────────────────────────────
export { jaccardSimilarity, dedupBatch } from './dedup.js'

// ── Stage-runner orchestrators ───────────────────────────────────────────
export { runExtraction, runLinking } from './stages/index.js'
export { entityExtract, resolvePerson } from './stages/entity-extract.js'
export { persist, matchMentionsToFragments } from './stages/persist.js'
export type { ResolveResult } from './stages/entity-extract.js'
export type {
  ExtractionOrchestratorDeps,
  LinkingOrchestratorDeps,
  ExtractionResult,
  LinkingResult,
} from './stages/index.js'
export type {
  ExtractionInput,
  LinkingInput,
  VaultClassifyDeps,
  FragmentDeps,
  WikiClassifyDeps,
  FragRelateDeps,
  PersistDeps,
  PersistResult,
  EntityExtractDeps,
  EntityExtractResult,
  ResolutionConfig,
  KnownPerson,
  FragmentResult,
  EmitEvent,
} from './stages/types.js'
export { DEFAULT_RESOLUTION_CONFIG } from './stages/types.js'

// ── OpenRouter + embeddings ──────────────────────────────────────────────
export type { OpenRouterConfig } from './openrouter-config.js'
export { NoOpenRouterKeyError } from './openrouter-config.js'
export { embedText } from './embeddings.js'
export type { EmbedConfig } from './embeddings.js'

// ── Mastra agent factory + caller helpers ────────────────────────────────
export { createIngestAgents } from './agent-factory.js'
export type { IngestAgents } from './agent-factory.js'
export {
  createTypedCaller,
  createStringCaller,
  AGENT_RETRY_CONFIG,
  AGENT_MODEL_SETTINGS,
} from './agents/caller.js'
