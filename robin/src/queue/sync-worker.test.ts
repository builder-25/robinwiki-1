import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SyncJob, JobResult } from '@robin/queue'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockUpsertObject = vi.fn()
const mockGetObjectByKey = vi.fn()
const mockSyncEdgesFromFrontmatter = vi.fn()
const mockCascadeDirtyDownstream = vi.fn()
const mockSoftDeleteObject = vi.fn()

vi.mock('../db/sync.js', () => ({
  upsertObject: (...args: unknown[]) => mockUpsertObject(...args),
  getObjectByKey: (...args: unknown[]) => mockGetObjectByKey(...args),
  syncEdgesFromFrontmatter: (...args: unknown[]) => mockSyncEdgesFromFrontmatter(...args),
  cascadeDirtyDownstream: (...args: unknown[]) => mockCascadeDirtyDownstream(...args),
  softDeleteObject: (...args: unknown[]) => mockSoftDeleteObject(...args),
}))

const mockEmitPipelineEvent = vi.fn().mockResolvedValue(undefined)
vi.mock('../db/pipeline-events.js', () => ({
  emitPipelineEvent: (...args: unknown[]) => mockEmitPipelineEvent(...args),
}))

const mockDb = {} // placeholder DB

vi.mock('../db/client.js', () => ({
  db: {},
}))

// ── Import under test ──────────────────────────────────────────────────────

const { processSyncJob } = await import('./sync-worker.js')

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    type: 'sync',
    jobId: 'sync-job-1',
    userId: 'user-1',
    commitHash: 'abc123',
    enqueuedAt: new Date().toISOString(),
    files: [],
    ...overrides,
  }
}

function makeFile(overrides: Record<string, unknown> = {}) {
  return {
    path: 'fragments/20260308-hello-world.frag01HZY3Q9R3ABCDEFGHIJKLMNOP.md',
    operation: 'add' as const,
    content:
      '---\nthreadKeys: ["thread01AAA"]\npersonKeys: ["person01BBB"]\nentryKey: "entry01CCC"\n---\nHello world body content',
    frontmatterHash: 'xx:0000000000000001',
    bodyHash: 'xx:0000000000000002',
    contentHash: 'xx:0000000000000003',
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('processSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetObjectByKey.mockResolvedValue(null)
    mockUpsertObject.mockResolvedValue(undefined)
    mockSyncEdgesFromFrontmatter.mockResolvedValue(undefined)
    mockCascadeDirtyDownstream.mockResolvedValue(undefined)
    mockSoftDeleteObject.mockResolvedValue(undefined)
  })

  it('upserts new fragment with correct lookupKey, type, hashes, repoPath', async () => {
    const file = makeFile()
    const job = makeJob({ files: [file] })

    const result = await processSyncJob(job)

    expect(result.success).toBe(true)
    expect(mockUpsertObject).toHaveBeenCalledOnce()
    expect(mockUpsertObject).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        lookupKey: 'frag01HZY3Q9R3ABCDEFGHIJKLMNOP',
        userId: 'user-1',
        type: 'frag',
        slug: 'hello-world',
        repoPath: 'fragments/20260308-hello-world.frag01HZY3Q9R3ABCDEFGHIJKLMNOP.md',
        frontmatterHash: 'xx:0000000000000001',
        bodyHash: 'xx:0000000000000002',
        contentHash: 'xx:0000000000000003',
      })
    )
  })

  it('skips file when content_hash matches existing object', async () => {
    mockGetObjectByKey.mockResolvedValueOnce({
      lookupKey: 'frag01HZY3Q9R3ABCDEFGHIJKLMNOP',
      contentHash: 'xx:0000000000000003',
      bodyHash: 'xx:0000000000000002',
      state: 'RESOLVED',
    })
    const file = makeFile()
    const job = makeJob({ files: [file] })

    const result = await processSyncJob(job)

    expect(result.success).toBe(true)
    expect(mockUpsertObject).not.toHaveBeenCalled()
    expect(mockSyncEdgesFromFrontmatter).not.toHaveBeenCalled()
  })

  it('cascades DIRTY to downstream when body_hash changes on fragment', async () => {
    mockGetObjectByKey.mockResolvedValueOnce({
      lookupKey: 'frag01HZY3Q9R3ABCDEFGHIJKLMNOP',
      contentHash: 'xx:old-content-hash',
      bodyHash: 'xx:old-body-hash',
      state: 'RESOLVED',
    })
    const file = makeFile()
    const job = makeJob({ files: [file] })

    await processSyncJob(job)

    expect(mockCascadeDirtyDownstream).toHaveBeenCalledOnce()
    expect(mockCascadeDirtyDownstream).toHaveBeenCalledWith(
      expect.anything(),
      'frag01HZY3Q9R3ABCDEFGHIJKLMNOP'
    )
  })

  it('does NOT cascade DIRTY on frontmatter-only change (body_hash same)', async () => {
    mockGetObjectByKey.mockResolvedValueOnce({
      lookupKey: 'frag01HZY3Q9R3ABCDEFGHIJKLMNOP',
      contentHash: 'xx:old-content-hash',
      bodyHash: 'xx:0000000000000002', // same as incoming
      state: 'RESOLVED',
    })
    const file = makeFile()
    const job = makeJob({ files: [file] })

    await processSyncJob(job)

    expect(mockUpsertObject).toHaveBeenCalledOnce()
    expect(mockSyncEdgesFromFrontmatter).toHaveBeenCalledOnce()
    expect(mockCascadeDirtyDownstream).not.toHaveBeenCalled()
  })

  it('soft-deletes object and edges on file deletion', async () => {
    const file = makeFile({ operation: 'delete' })
    const job = makeJob({ files: [file] })

    await processSyncJob(job)

    expect(mockSoftDeleteObject).toHaveBeenCalledOnce()
    expect(mockSoftDeleteObject).toHaveBeenCalledWith(
      expect.anything(),
      'frag01HZY3Q9R3ABCDEFGHIJKLMNOP'
    )
    expect(mockUpsertObject).not.toHaveBeenCalled()
  })

  it('skips malformed filename and logs pipeline_event', async () => {
    const file = makeFile({ path: 'fragments/bad-filename.md' })
    const job = makeJob({ files: [file] })

    const result = await processSyncJob(job)

    expect(result.success).toBe(true)
    expect(mockUpsertObject).not.toHaveBeenCalled()
    expect(mockEmitPipelineEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        stage: 'sync',
        status: 'failed',
      })
    )
  })

  it('syncs edges from frontmatter after upsert', async () => {
    const file = makeFile()
    const job = makeJob({ files: [file] })

    await processSyncJob(job)

    expect(mockSyncEdgesFromFrontmatter).toHaveBeenCalledOnce()
    expect(mockSyncEdgesFromFrontmatter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-1',
        lookupKey: 'frag01HZY3Q9R3ABCDEFGHIJKLMNOP',
        type: 'frag',
      })
    )
  })

  it('processes all files even if one fails (resilient iteration)', async () => {
    const goodFile = makeFile()
    const badFile = makeFile({
      path: 'fragments/20260308-second.frag01ZZZZZZZZZZZZZZZZZZZZZZZZ.md',
    })

    // First file upsert throws, second should still be processed
    mockUpsertObject.mockRejectedValueOnce(new Error('DB error'))
    mockUpsertObject.mockResolvedValueOnce(undefined)

    const job = makeJob({ files: [goodFile, badFile] })

    const result = await processSyncJob(job)

    // Should have attempted both upserts
    expect(mockUpsertObject).toHaveBeenCalledTimes(2)
    // Pipeline event logged for the failure
    expect(mockEmitPipelineEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        stage: 'sync',
        status: 'failed',
      })
    )
  })
})
