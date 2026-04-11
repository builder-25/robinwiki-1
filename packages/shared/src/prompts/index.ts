// Core infrastructure
export { PromptSpecSchema } from './schema.js'
export type { PromptSpec } from './schema.js'
export type { PromptResult } from './types.js'
export { loadSpec, renderTemplate } from './loader.js'

// Model constants (stay in code per CONTEXT.md decision)
export * from './models.js'

// Schemas
export { vaultClassificationSchema } from './specs/vault-classification.schema.js'
export type { VaultClassificationOutput } from './specs/vault-classification.schema.js'
export { fragmentationSchema } from './specs/fragmentation.schema.js'
export type { FragmentationOutput } from './specs/fragmentation.schema.js'
export { peopleExtractionSchema } from './specs/people-extraction.schema.js'
export type { PeopleExtractionOutput } from './specs/people-extraction.schema.js'
export { wikiClassificationSchema } from './specs/wiki-classification.schema.js'
export type { WikiClassificationOutput } from './specs/wiki-classification.schema.js'
export { wikiRelevanceSchema } from './specs/wiki-relevance.schema.js'
export type { WikiRelevanceOutput } from './specs/wiki-relevance.schema.js'
export { fragmentRelevanceSchema } from './specs/fragment-relevance.schema.js'
export type { FragmentRelevanceOutput } from './specs/fragment-relevance.schema.js'

// Loader functions — standalone
export * from './loaders/vault-classification.js'
export * from './loaders/wiki-classification.js'
export * from './loaders/people-extraction.js'
export * from './loaders/fragmentation.js'
export * from './loaders/wiki-relevance.js'
export * from './loaders/fragment-relevance.js'

// Loader functions — parameterized
export { loadWikiGenerationSpec } from './loaders/wiki-generation.js'
export { loadPersonSummarySpec } from './loaders/person-summary.js'
export { personSummaryInputSchema } from './specs/person-summary/person-summary.schema.js'
