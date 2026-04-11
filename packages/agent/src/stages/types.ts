import type {
  PeopleExtractionOutput,
  VaultClassificationOutput,
  FragmentationOutput,
  WikiClassificationOutput,
  FragmentRelevanceOutput,
} from '@robin/shared'

// ── Stage Result ─────────────────────────────────────────────────────────────

export interface StageResult<T> {
  data: T
  durationMs: number
}

// ── Stage Inputs ─────────────────────────────────────────────────────────────

export interface ExtractionInput {
  userId: string
  content: string
  entryKey: string
  userSelectedVaultId: string | null
  source: string
  jobId: string
}

export interface LinkingInput {
  userId: string
  fragmentKey: string
  fragmentContent: string
  entryKey: string
  vaultId: string
  jobId: string
}

// ── Event Emitter ────────────────────────────────────────────────────────────

export type EmitEvent = (event: {
  entryKey: string
  jobId: string
  stage: string
  status: 'started' | 'completed' | 'failed'
  fragmentKey?: string
  metadata?: Record<string, unknown>
}) => Promise<void>

// ── Per-Stage Dependencies ───────────────────────────────────────────────────

export interface VaultClassifyDeps {
  listUserVaults: (userId: string) => Promise<Array<{ id: string; name: string; slug: string }>>
  llmCall: (system: string, user: string) => Promise<VaultClassificationOutput>
  confidenceThreshold: number
  fallbackVaultId: string
}

export interface VaultClassifyResult {
  vaultId: string
  vaultName: string
  confidence: number
  wasUserSelected: boolean
}

export interface FragmentDeps {
  llmCall: (system: string, user: string) => Promise<FragmentationOutput>
  emitEvent: EmitEvent
}

export interface FragmentResult {
  content: string
  type: string
  confidence: number
  sourceSpan: string
  suggestedSlug: string
  title: string
  tags: string[]
  wikiLinks: string[]
}

// ── Linking Stage Dependencies ──────────────────────────────────────────────

export interface ThreadInfo {
  lookupKey: string
  name: string
  type: string | null
  prompt: string | null
}

export interface WikiClassifyDeps {
  searchCandidates: (
    userId: string,
    content: string,
    limit: number
  ) => Promise<Array<{ wikiKey: string; score: number }>>
  loadThreads: (wikiKeys: string[]) => Promise<ThreadInfo[]>
  llmCall: (system: string, user: string) => Promise<WikiClassificationOutput>
  emitEvent: EmitEvent
}

export interface WikiClassifyResult {
  wikiEdges: Array<{ wikiKey: string; score: number }>
}

export interface FragRelateDeps {
  vectorSearch: (
    userId: string,
    content: string,
    limit: number
  ) => Promise<Array<{ fragmentKey: string; score: number }>>
  loadFragmentContent: (fragmentKey: string) => Promise<string | null>
  llmCall: (system: string, user: string) => Promise<FragmentRelevanceOutput>
  emitEvent: EmitEvent
}

export interface FragRelateResult {
  relatedEdges: Array<{ fragmentKey: string; score: number }>
}

export interface PersistDeps {
  batchWrite: (req: {
    userId: string
    files: Array<{ path: string; content: string }>
    message: string
    branch: string
  }) => Promise<{ commitHash: string }>
  insertEntry: (entry: Record<string, unknown>) => Promise<void>
  insertFragment: (fragment: Record<string, unknown>) => Promise<void>
  insertEdge: (edge: Record<string, unknown>) => Promise<void>
  insertPerson: (person: Record<string, unknown>) => Promise<void>
  loadPersonByKey: (key: string) => Promise<{
    lookupKey: string
    slug: string
    repoPath: string
    name: string
    sections: Record<string, unknown>
  } | null>
  emitEvent: EmitEvent
  /** DB-backed wiki-link lookup function. If not provided, falls back to empty arrays. */
  lookupFn?: (slug: string, type?: string) => Promise<{ type: string; key: string } | null>
}

export interface PersistResult {
  entryKey: string
  fragmentKeys: string[]
  commitHash: string
}

// ── Entity Extraction ───────────────────────────────────────────────────────

export interface ResolutionConfig {
  scoreFloor: number
  ratioThreshold: number
  canonicalWeight: number
  aliasWeight: number
}

export const DEFAULT_RESOLUTION_CONFIG: ResolutionConfig = {
  scoreFloor: 60,
  ratioThreshold: 1.5,
  canonicalWeight: 5,
  aliasWeight: 4,
}

export interface KnownPerson {
  lookupKey: string
  canonicalName: string
  aliases: string[]
}

export interface EntityExtractDeps {
  loadUserPeople: (userId: string) => Promise<KnownPerson[]>
  llmCall: (system: string, user: string) => Promise<PeopleExtractionOutput>
  emitEvent: EmitEvent
  config: ResolutionConfig
  makePeopleKey: () => string
}

export interface EntityExtractResult {
  peopleMap: Map<string, string>
  newAliases: Map<string, string[]>
  extractions: PeopleExtractionOutput['people']
  newPeople: Array<{ personKey: string; canonicalName: string; verified: boolean }>
}
