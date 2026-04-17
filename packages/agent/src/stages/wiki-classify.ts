import { loadWikiClassificationSpec } from '@robin/shared'
import type { StageResult, WikiClassifyDeps, WikiClassifyResult } from './types.js'

const THRESHOLD = Number(process.env.THREAD_CLASSIFY_THRESHOLD) || 0.7

/**
 * Wiki classification stage.
 * Finds top-10 candidate wikis via hybrid search, loads their metadata,
 * then sends all candidates in a single batch LLM call. In greenfield (no
 * existing wikis) this returns an empty wikiEdges array without failing.
 */
export async function wikiClassify(
  deps: WikiClassifyDeps,
  input: {
    fragmentContent: string
    fragmentKey: string
    jobId: string
    entryKey: string
  }
): Promise<StageResult<WikiClassifyResult>> {
  const start = performance.now()

  const candidates = await deps.searchCandidates(input.fragmentContent, 10)

  if (candidates.length === 0) {
    await deps.emitEvent({
      entryKey: input.entryKey,
      jobId: input.jobId,
      stage: 'wiki-classify',
      status: 'completed',
      fragmentKey: input.fragmentKey,
      metadata: { candidateCount: 0, matchedCount: 0, threshold: THRESHOLD },
    })
    return { data: { wikiEdges: [] }, durationMs: performance.now() - start }
  }

  const wikiKeys = candidates.map((c) => c.wikiKey)
  const wikis = await deps.loadThreads(wikiKeys)

  const wikisJson = JSON.stringify(
    wikis.map((t) => ({
      key: t.lookupKey,
      name: t.name,
      threadType: t.type,
      description: t.prompt ?? '',
    }))
  )

  const spec = loadWikiClassificationSpec({
    content: input.fragmentContent,
    wikis: wikisJson,
  })
  const result = await deps.llmCall(spec.system, spec.user)

  const wikiEdges = result.assignments
    .filter((a) => a.confidence >= THRESHOLD)
    .map((a) => ({ wikiKey: a.wikiKey, score: a.confidence }))

  await deps.emitEvent({
    entryKey: input.entryKey,
    jobId: input.jobId,
    stage: 'wiki-classify',
    status: 'completed',
    fragmentKey: input.fragmentKey,
    metadata: {
      candidateCount: candidates.length,
      matchedCount: wikiEdges.length,
      threshold: THRESHOLD,
    },
  })

  return {
    data: { wikiEdges },
    durationMs: performance.now() - start,
  }
}
