export { regenerateWiki, THREAD_WIKI_TYPES, stripFrontmatter } from './wiki.js'
export type { WikiType } from './wiki.js'
export { jaccardSimilarity, dedupBatch } from './dedup.js'
export { stripWikiDelimiters, resolveWikiLinks as resolveWikiLinksFromNotes } from './wikilink.js'
export {
  assembleEntryFrontmatter,
  assembleFragmentFrontmatter,
  assembleThreadFrontmatter,
  assemblePersonFrontmatter,
} from './frontmatter.js'
export type {
  EntryFrontmatterInput,
  FragmentFrontmatterInput,
  ThreadFrontmatterInput,
  PersonFrontmatterInput,
  WikiLinkRef,
} from './frontmatter.js'
export { synthesizePersonBody } from './person-body.js'
export type { SynthesizePersonBodyInput } from './person-body.js'

// ── Stage-runner orchestrators (new pipeline) ───────────────────────────
export { runExtraction, runLinking } from './stages/index.js'
export { entityExtract, resolvePerson } from './stages/entity-extract.js'
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
  EntityExtractDeps,
  EntityExtractResult,
  ResolutionConfig,
  KnownPerson,
} from './stages/types.js'
export { DEFAULT_RESOLUTION_CONFIG } from './stages/types.js'

// ── Regen processing (delegated from server) ─────────────────────────────
export { processRegenJob } from './regen/processor.js'
export type { RegenDeps } from './regen/types.js'

// ── Mastra agent callers ─────────────────────────────────────────────────
export {
  vaultClassifyCall,
  fragmentCall,
  entityExtractCall,
  threadClassifyCall,
  fragScoreCall,
  wikiGenerateCall,
  personSynthesizeCall,
} from './agents/index.js'

// ── OpenRouter provider ──────────────────────────────────────────────────
export { openRouterModel, openRouterCall } from './provider.js'
