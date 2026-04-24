import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Module-level mocks ─────────────────────────────────────────────────────

const embedTextMock = vi.fn()
const takeLastEmbedFailureMock = vi.fn()
vi.mock('@robin/agent', () => ({
  embedText: (...args: unknown[]) => embedTextMock(...args),
  takeLastEmbedFailure: () => takeLastEmbedFailureMock(),
}))

const loadOpenRouterConfigMock = vi.fn()
vi.mock('../lib/openrouter-config.js', () => ({
  loadOpenRouterConfig: () => loadOpenRouterConfigMock(),
}))

// Captured DB writes so tests can assert on them. The drizzle chain stubs
// below push into these arrays in order.
const selectReturns: Array<Array<Record<string, unknown>>> = []
const updateCapture: Array<{ set: Record<string, unknown> }> = []

vi.mock('../db/client.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () =>
              Promise.resolve(selectReturns.shift() ?? []),
          }),
        }),
      }),
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updateCapture.push({ set: v })
        return { where: () => Promise.resolve() }
      },
    }),
  },
}))

vi.mock('../db/schema.js', () => ({
  fragments: {
    lookupKey: 'lookupKey',
    content: 'content',
    embedding: 'embedding',
    embeddingAttemptCount: 'embedding_attempt_count',
    embeddingLastAttemptAt: 'embedding_last_attempt_at',
    deletedAt: 'deleted_at',
  },
}))

const { processEmbeddingRetryJob } = await import('./embedding-retry-worker.js')

// ── Helpers ────────────────────────────────────────────────────────────────

function baseJob() {
  return {
    type: 'embedding-retry' as const,
    jobId: 'job-1',
    triggeredBy: 'scheduler' as const,
    enqueuedAt: new Date().toISOString(),
  }
}

beforeEach(() => {
  embedTextMock.mockReset()
  takeLastEmbedFailureMock.mockReset()
  loadOpenRouterConfigMock.mockReset()
  selectReturns.length = 0
  updateCapture.length = 0
  loadOpenRouterConfigMock.mockResolvedValue({
    apiKey: 'k',
    models: { extraction: 'x', classification: 'y', wikiGeneration: 'z', embedding: 'e' },
  })
})

// ── Cases ──────────────────────────────────────────────────────────────────

describe('processEmbeddingRetryJob — issue #151', () => {
  it('persists the embedding when embedText succeeds', async () => {
    selectReturns.push([
      { lookupKey: 'frag1', content: 'hello', attemptCount: 0 },
    ])
    embedTextMock.mockResolvedValueOnce([0.1, 0.2, 0.3])
    const res = await processEmbeddingRetryJob(baseJob())
    expect(res.success).toBe(true)
    expect(updateCapture).toHaveLength(1)
    expect(updateCapture[0].set.embedding).toEqual([0.1, 0.2, 0.3])
    expect(updateCapture[0].set.embeddingLastAttemptAt).toBeInstanceOf(Date)
  })

  it('bumps attempt_count without persisting when embedText returns null', async () => {
    selectReturns.push([
      { lookupKey: 'frag1', content: 'hello', attemptCount: 2 },
    ])
    embedTextMock.mockResolvedValueOnce(null)
    takeLastEmbedFailureMock.mockReturnValueOnce({
      kind: 'http',
      status: 429,
      body: 'rate limited',
    })
    const res = await processEmbeddingRetryJob(baseJob())
    expect(res.success).toBe(true)
    expect(updateCapture).toHaveLength(1)
    expect(updateCapture[0].set.embeddingAttemptCount).toBe(3)
    expect(updateCapture[0].set.embedding).toBeUndefined()
    expect(updateCapture[0].set.embeddingLastAttemptAt).toBeInstanceOf(Date)
  })

  it('no-ops when OpenRouter config is unavailable', async () => {
    loadOpenRouterConfigMock.mockRejectedValueOnce(new Error('no key'))
    const res = await processEmbeddingRetryJob(baseJob())
    expect(res.success).toBe(true)
    expect(embedTextMock).not.toHaveBeenCalled()
    expect(updateCapture).toHaveLength(0)
  })

  it('processes multiple rows per invocation', async () => {
    selectReturns.push([
      { lookupKey: 'frag1', content: 'a', attemptCount: 0 },
      { lookupKey: 'frag2', content: 'b', attemptCount: 1 },
    ])
    embedTextMock
      .mockResolvedValueOnce([1, 2, 3])
      .mockResolvedValueOnce(null)
    takeLastEmbedFailureMock.mockReturnValueOnce({ kind: 'threw', message: 'timeout' })

    const res = await processEmbeddingRetryJob(baseJob())
    expect(res.success).toBe(true)
    expect(embedTextMock).toHaveBeenCalledTimes(2)
    expect(updateCapture).toHaveLength(2)
    expect(updateCapture[0].set.embedding).toEqual([1, 2, 3])
    expect(updateCapture[1].set.embeddingAttemptCount).toBe(2)
  })
})
