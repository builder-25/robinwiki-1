import { loadThreadClassificationSpec } from '@robin/shared'
import type { StageResult, ThreadClassifyDeps, ThreadClassifyResult } from './types.js'

const THRESHOLD = Number(process.env.THREAD_CLASSIFY_THRESHOLD) || 0.7

/**
 * Thread classification stage.
 * Finds top-10 candidate threads via hybrid search, loads their metadata,
 * then sends all candidates in a single batch LLM call. Marcel sees all
 * threads at once and returns assignments with confidence scores.
 */
export async function threadClassify(
  deps: ThreadClassifyDeps,
  input: {
    userId: string
    fragmentContent: string
    fragmentKey: string
    vaultId: string
    jobId: string
    entryKey: string
  }
): Promise<StageResult<ThreadClassifyResult>> {
  const start = performance.now()

  // Search for top 10 candidate threads
  const candidates = await deps.searchCandidates(input.userId, input.fragmentContent, 10)

  if (candidates.length === 0) {
    await deps.emitEvent({
      entryKey: input.entryKey,
      jobId: input.jobId,
      stage: 'thread-classify',
      status: 'completed',
      fragmentKey: input.fragmentKey,
      metadata: { candidateCount: 0, matchedCount: 0, threshold: THRESHOLD },
    })
    return { data: { threadEdges: [] }, durationMs: performance.now() - start }
  }

  // Load thread metadata for all candidates
  const threadKeys = candidates.map((c) => c.threadKey)
  const threads = await deps.loadThreads(threadKeys)

  // Build threads JSON for the prompt
  const threadsJson = JSON.stringify(
    threads.map((t) => ({
      key: t.lookupKey,
      name: t.name,
      threadType: t.type,
      description: t.prompt ?? '',
    }))
  )

  // Single batch LLM call — Marcel sees all candidates at once
  const spec = loadThreadClassificationSpec({
    content: input.fragmentContent,
    threads: threadsJson,
  })
  const result = await deps.llmCall(spec.system, spec.user)

  // Filter assignments by confidence threshold
  const threadEdges = result.assignments
    .filter((a) => a.confidence >= THRESHOLD)
    .map((a) => ({ threadKey: a.threadKey, score: a.confidence }))

  await deps.emitEvent({
    entryKey: input.entryKey,
    jobId: input.jobId,
    stage: 'thread-classify',
    status: 'completed',
    fragmentKey: input.fragmentKey,
    metadata: {
      candidateCount: candidates.length,
      matchedCount: threadEdges.length,
      threshold: THRESHOLD,
    },
  })

  return {
    data: { threadEdges },
    durationMs: performance.now() - start,
  }
}
