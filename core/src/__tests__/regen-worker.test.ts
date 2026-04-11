import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the modules before importing the worker
vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
  },
}))

vi.mock('../db/schema.js', () => ({
  entries: { lookupKey: 'lookup_key' },
  wikis: { lookupKey: 'lookup_key' },
  people: { lookupKey: 'lookup_key' },
  edges: { srcId: 'src_id' },
  fragments: { lookupKey: 'lookup_key' },
  users: { id: 'id' },
  vaults: { id: 'id' },
  configNotes: { key: 'key' },
  objectStateEnum: {},
  processedJobs: {},
  pipelineEvents: {},
  auditLog: {},
  sessions: {},
  accounts: {},
  verifications: {},
  apiKeys: {},
}))

vi.mock('../db/locking.js', () => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  canRebuildThread: vi.fn(),
}))

vi.mock('../gateway/client.js', () => ({
  gatewayClient: {
    batchWrite: vi.fn(),
    read: vi.fn(),
  },
}))

vi.mock('../services/llm.js', () => ({
  anthropicCall: vi.fn(),
}))

vi.mock('../queue/producer.js', () => ({
  producer: {
    enqueueRegenJob: vi.fn(),
  },
}))

vi.mock('@robin/agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@robin/agent')>()
  return {
    ...actual,
    regenerateWiki: vi.fn(),
    assembleThreadFrontmatter: vi.fn(),
    assemblePersonFrontmatter: vi.fn(),
    synthesizePersonBody: vi.fn(),
  }
})

vi.mock('@robin/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@robin/shared')>()
  return {
    ...actual,
    DEFAULT_MODEL: 'test-model',
    FAST_MODEL: 'test-fast-model',
  }
})

import { processRegenJob, processRegenBatchJob } from '../queue/regen-worker.js'
import { db } from '../db/client.js'
import { acquireLock, releaseLock, canRebuildThread } from '../db/locking.js'
import { producer } from '../queue/producer.js'
import { regenerateWiki } from '@robin/agent'
import type { RegenJob, RegenBatchJob } from '@robin/queue'

describe('processRegenJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips thread regen when canRebuildThread returns false', async () => {
    const job: RegenJob = {
      type: 'regen',
      jobId: 'regen-1',
      userId: 'user-1',
      objectKey: 'thread-key-1',
      objectType: 'wiki',
      triggeredBy: 'scheduler',
      enqueuedAt: new Date().toISOString(),
    }

    vi.mocked(acquireLock).mockResolvedValue({ lookupKey: 'thread-key-1' })
    vi.mocked(canRebuildThread).mockResolvedValue(false)
    vi.mocked(releaseLock).mockResolvedValue(undefined)

    const result = await processRegenJob(job)
    expect(result.success).toBe(true)
    expect(result.error).toContain('blocked')
    expect(regenerateWiki).not.toHaveBeenCalled()
    expect(releaseLock).toHaveBeenCalled()
  })

  it('skips when lock cannot be acquired', async () => {
    const job: RegenJob = {
      type: 'regen',
      jobId: 'regen-2',
      userId: 'user-1',
      objectKey: 'thread-key-1',
      objectType: 'wiki',
      triggeredBy: 'manual',
      enqueuedAt: new Date().toISOString(),
    }

    vi.mocked(acquireLock).mockResolvedValue(null)

    const result = await processRegenJob(job)
    expect(result.success).toBe(true)
    expect(result.error).toContain('lock')
  })
})

describe('processRegenBatchJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scans DIRTY wikis and people and enqueues regen jobs', async () => {
    const job: RegenBatchJob = {
      type: 'regen-batch',
      jobId: 'batch-1',
      triggeredBy: 'scheduler',
      enqueuedAt: new Date().toISOString(),
    }

    // Mock dirty wikis query
    vi.mocked(db.execute).mockResolvedValueOnce([
      { lookup_key: 'thread-1', user_id: 'user-1', type: 'wiki' },
      { lookup_key: 'thread-2', user_id: 'user-2', type: 'wiki' },
    ] as any)

    // Mock dirty people query
    vi.mocked(db.execute).mockResolvedValueOnce([
      { lookup_key: 'person-1', user_id: 'user-1', type: 'person' },
    ] as any)

    vi.mocked(producer.enqueueRegenJob).mockResolvedValue('queued')

    const result = await processRegenBatchJob(job)
    expect(result.success).toBe(true)
    expect(producer.enqueueRegenJob).toHaveBeenCalledTimes(3)
  })

  it('returns success with 0 enqueued when nothing is dirty', async () => {
    const job: RegenBatchJob = {
      type: 'regen-batch',
      jobId: 'batch-2',
      triggeredBy: 'scheduler',
      enqueuedAt: new Date().toISOString(),
    }

    vi.mocked(db.execute).mockResolvedValueOnce([] as any)
    vi.mocked(db.execute).mockResolvedValueOnce([] as any)

    const result = await processRegenBatchJob(job)
    expect(result.success).toBe(true)
    expect(producer.enqueueRegenJob).not.toHaveBeenCalled()
  })
})
