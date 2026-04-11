import type {
  EmitEvent,
  ExtractionInput,
  LinkingInput,
  VaultClassifyDeps,
  FragmentDeps,
  PersistDeps,
  PersistResult,
  WikiClassifyDeps,
  FragRelateDeps,
  FragmentResult,
  EntityExtractDeps,
  EntityExtractResult,
} from './types.js'
import { vaultClassify } from './vault-classify.js'
import { fragment } from './fragment.js'
import { persist } from './persist.js'
import { entityExtract } from './entity-extract.js'
import { wikiClassify } from './wiki-classify.js'
import { fragRelate } from './frag-relate.js'

// ── Orchestrator Dep Types ──────────────────────────────────────────────────

export interface ExtractionOrchestratorDeps {
  vaultClassifyDeps: VaultClassifyDeps
  fragmentDeps: FragmentDeps
  entityExtractDeps: EntityExtractDeps
  persistDeps: PersistDeps
  acquireLock: (
    db: unknown,
    tableName: string,
    lookupKey: string,
    lockedBy: string,
    fromState: string
  ) => Promise<Record<string, unknown> | null>
  releaseLock: (
    db: unknown,
    tableName: string,
    lookupKey: string,
    targetState: string
  ) => Promise<void>
  emitEvent: EmitEvent
  enqueueLinkJob: (
    userId: string,
    job: {
      type: 'link'
      fragmentKey: string
      entryKey: string
      vaultId: string
      fragmentContent: string
    }
  ) => Promise<void>
  db: unknown
}

export interface ExtractionResult {
  entryKey: string
  fragmentKeys: string[]
  personKeys: string[]
  vaultId: string
  commitHash: string
}

export interface LinkingOrchestratorDeps {
  threadClassifyDeps: WikiClassifyDeps
  fragRelateDeps: FragRelateDeps
  acquireLock: (
    db: unknown,
    tableName: string,
    lookupKey: string,
    lockedBy: string,
    fromState: string
  ) => Promise<Record<string, unknown> | null>
  releaseLock: (
    db: unknown,
    tableName: string,
    lookupKey: string,
    targetState: string
  ) => Promise<void>
  emitEvent: EmitEvent
  insertEdge: (edge: Record<string, unknown>) => Promise<void>
  transitionWiki: (wikiKey: string, targetState: string) => Promise<void>
  updateFragmentFrontmatter: (
    userId: string,
    fragmentKey: string,
    wikiKeys: string[],
    relatedFragmentKeys: string[]
  ) => Promise<void>
  db: unknown
}

export interface LinkingResult {
  fragmentKey: string
  wikiEdges: Array<{ wikiKey: string; score: number }>
  relatedEdges: Array<{ fragmentKey: string; score: number }>
}

// ── Extraction Orchestrator ─────────────────────────────────────────────────

/**
 * Extraction orchestrator: vault-classify -> fragment -> persist.
 * Uses CAS sandwich pattern: lock entry PENDING->LINKING, run stages,
 * release to RESOLVED. Fail-open to PENDING on error.
 */
export async function runExtraction(
  deps: ExtractionOrchestratorDeps,
  input: ExtractionInput
): Promise<ExtractionResult> {
  await deps.emitEvent({
    entryKey: input.entryKey,
    jobId: input.jobId,
    stage: 'extraction',
    status: 'started',
  })

  // Sandwich open: acquire lock on entry
  const locked = await deps.acquireLock(deps.db, 'entries', input.entryKey, input.jobId, 'PENDING')
  if (!locked) {
    await deps.emitEvent({
      entryKey: input.entryKey,
      jobId: input.jobId,
      stage: 'extraction',
      status: 'failed',
      metadata: { reason: 'lock_not_acquired' },
    })
    throw new Error(`Could not acquire lock on entry ${input.entryKey}`)
  }

  try {
    // Stage 1: Vault classification
    const vaultResult = await vaultClassify(deps.vaultClassifyDeps, {
      userId: input.userId,
      content: input.content,
      userSelectedVaultId: input.userSelectedVaultId,
    })

    // Stage 2: Fragment + Entity Extract (parallel, entity-extract is fail-open)
    const [fragSettled, entitySettled] = await Promise.allSettled([
      fragment(deps.fragmentDeps, {
        content: input.content,
        entryKey: input.entryKey,
        jobId: input.jobId,
      }),
      entityExtract(deps.entityExtractDeps, {
        content: input.content,
        userId: input.userId,
        entryKey: input.entryKey,
        jobId: input.jobId,
      }),
    ])

    // Fragment is required -- rethrow if rejected
    if (fragSettled.status === 'rejected') throw fragSettled.reason
    const fragResult = fragSettled.value

    // Entity extract is fail-open -- log failure event if rejected
    let entityResult: EntityExtractResult | null = null
    if (entitySettled.status === 'fulfilled') {
      entityResult = entitySettled.value.data
    } else {
      await deps.emitEvent({
        entryKey: input.entryKey,
        jobId: input.jobId,
        stage: 'entity-extract',
        status: 'failed',
        metadata: { error: entitySettled.reason?.message ?? 'unknown' },
      })
    }

    // Stage 3: Persist (with entity extraction results)
    const persistResult = await persist(deps.persistDeps, {
      userId: input.userId,
      entryKey: input.entryKey,
      entryContent: input.content,
      vaultId: vaultResult.data.vaultId,
      source: input.source,
      fragments: fragResult.data.fragments,
      primaryTopic: fragResult.data.primaryTopic,
      jobId: input.jobId,
      peopleMap: entityResult?.peopleMap ?? new Map(),
      newAliases: entityResult?.newAliases ?? new Map(),
      extractions: entityResult?.extractions ?? [],
      newPeople: entityResult?.newPeople ?? [],
      entityExtractionStatus: entityResult ? 'completed' : 'failed',
    })

    // Sandwich close: release lock, entry -> RESOLVED (immutable)
    await deps.releaseLock(deps.db, 'entries', input.entryKey, 'RESOLVED')

    // Enqueue one LinkJob per fragment
    for (let i = 0; i < persistResult.data.fragmentKeys.length; i++) {
      const fragKey = persistResult.data.fragmentKeys[i]
      const fragContent = fragResult.data.fragments[i]?.content ?? ''
      await deps.enqueueLinkJob(input.userId, {
        type: 'link',
        fragmentKey: fragKey,
        entryKey: input.entryKey,
        vaultId: vaultResult.data.vaultId,
        fragmentContent: fragContent,
      })
    }

    await deps.emitEvent({
      entryKey: input.entryKey,
      jobId: input.jobId,
      stage: 'extraction',
      status: 'completed',
      metadata: {
        fragmentCount: persistResult.data.fragmentKeys.length,
        vaultId: vaultResult.data.vaultId,
        commitHash: persistResult.data.commitHash,
      },
    })

    return {
      entryKey: input.entryKey,
      fragmentKeys: persistResult.data.fragmentKeys,
      personKeys: entityResult ? Array.from(entityResult.peopleMap.values()) : [],
      vaultId: vaultResult.data.vaultId,
      commitHash: persistResult.data.commitHash,
    }
  } catch (err) {
    // Fail-open: revert to PENDING for retry
    await deps.releaseLock(deps.db, 'entries', input.entryKey, 'PENDING')
    await deps.emitEvent({
      entryKey: input.entryKey,
      jobId: input.jobId,
      stage: 'extraction',
      status: 'failed',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    })
    throw err
  }
}

// ── Linking Orchestrator ────────────────────────────────────────────────────

/**
 * Linking orchestrator: wiki-classify -> frag-relate -> edge creation.
 * Uses CAS sandwich pattern: lock fragment PENDING->LINKING, run stages,
 * release to RESOLVED. Fail-open to PENDING on error.
 */
export async function runLinking(
  deps: LinkingOrchestratorDeps,
  input: LinkingInput
): Promise<LinkingResult> {
  await deps.emitEvent({
    entryKey: input.entryKey,
    jobId: input.jobId,
    stage: 'linking',
    status: 'started',
    fragmentKey: input.fragmentKey,
  })

  // Sandwich open: acquire lock on fragment
  const locked = await deps.acquireLock(
    deps.db,
    'fragments',
    input.fragmentKey,
    input.jobId,
    'PENDING'
  )
  if (!locked) {
    await deps.emitEvent({
      entryKey: input.entryKey,
      jobId: input.jobId,
      stage: 'linking',
      status: 'failed',
      fragmentKey: input.fragmentKey,
      metadata: { reason: 'lock_not_acquired' },
    })
    throw new Error(`Could not acquire lock on fragment ${input.fragmentKey}`)
  }

  try {
    // Stage 1: Thread classification
    const threadResult = await wikiClassify(deps.threadClassifyDeps, {
      userId: input.userId,
      fragmentContent: input.fragmentContent,
      fragmentKey: input.fragmentKey,
      vaultId: input.vaultId,
      jobId: input.jobId,
      entryKey: input.entryKey,
    })

    // Create FRAGMENT_IN_WIKI edges and set wikis DIRTY
    for (const edge of threadResult.data.wikiEdges) {
      await deps.insertEdge({
        srcType: 'fragment',
        srcId: input.fragmentKey,
        dstType: 'wiki',
        dstId: edge.wikiKey,
        edgeType: 'FRAGMENT_IN_WIKI',
        attrs: { score: edge.score },
      })
      // Idempotent: RESOLVED->DIRTY or DIRTY->DIRTY (just updates updatedAt)
      await deps.transitionWiki(edge.wikiKey, 'DIRTY')
    }

    // Stage 2: Fragment-to-fragment relationships
    const relateResult = await fragRelate(deps.fragRelateDeps, {
      userId: input.userId,
      fragmentContent: input.fragmentContent,
      fragmentKey: input.fragmentKey,
      jobId: input.jobId,
      entryKey: input.entryKey,
    })

    // Create bidirectional FRAGMENT_RELATED_TO_FRAGMENT edges
    for (const edge of relateResult.data.relatedEdges) {
      // A -> B
      await deps.insertEdge({
        srcType: 'fragment',
        srcId: input.fragmentKey,
        dstType: 'fragment',
        dstId: edge.fragmentKey,
        edgeType: 'FRAGMENT_RELATED_TO_FRAGMENT',
        attrs: { score: edge.score },
      })
      // B -> A
      await deps.insertEdge({
        srcType: 'fragment',
        srcId: edge.fragmentKey,
        dstType: 'fragment',
        dstId: input.fragmentKey,
        edgeType: 'FRAGMENT_RELATED_TO_FRAGMENT',
        attrs: { score: edge.score },
      })
    }

    // Sandwich close: release lock, fragment -> RESOLVED
    await deps.releaseLock(deps.db, 'fragments', input.fragmentKey, 'RESOLVED')

    // Update fragment frontmatter in git with thread and relation keys
    const wikiKeys = threadResult.data.wikiEdges.map((e) => e.wikiKey)
    const relatedFragmentKeys = relateResult.data.relatedEdges.map((e) => e.fragmentKey)
    await deps.updateFragmentFrontmatter(
      input.userId,
      input.fragmentKey,
      wikiKeys,
      relatedFragmentKeys
    )

    await deps.emitEvent({
      entryKey: input.entryKey,
      jobId: input.jobId,
      stage: 'linking',
      status: 'completed',
      fragmentKey: input.fragmentKey,
      metadata: {
        wikiEdgeCount: threadResult.data.wikiEdges.length,
        relatedEdgeCount: relateResult.data.relatedEdges.length,
      },
    })

    return {
      fragmentKey: input.fragmentKey,
      wikiEdges: threadResult.data.wikiEdges,
      relatedEdges: relateResult.data.relatedEdges,
    }
  } catch (err) {
    // Fail-open: revert to PENDING for retry
    await deps.releaseLock(deps.db, 'fragments', input.fragmentKey, 'PENDING')
    await deps.emitEvent({
      entryKey: input.entryKey,
      jobId: input.jobId,
      stage: 'linking',
      status: 'failed',
      fragmentKey: input.fragmentKey,
      metadata: { error: err instanceof Error ? err.message : String(err) },
    })
    throw err
  }
}
