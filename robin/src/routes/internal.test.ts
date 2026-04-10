import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockEnqueueSyncJob = vi.fn().mockResolvedValue('job-id-1')

vi.mock('../queue/producer.js', () => ({
  producer: {
    enqueueSyncJob: (...args: unknown[]) => mockEnqueueSyncJob(...args),
  },
}))

// ── Import under test (after mocks) ────────────────────────────────────────

const { internalRoutes } = await import('./internal.js')

// ── Helpers ─────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-hmac-secret'

function sign(body: string): string {
  return createHmac('sha256', TEST_SECRET).update(body).digest('hex')
}

function makeSyncPayload(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    commitHash: 'abc123',
    files: [
      {
        path: 'fragments/20260308-hello.frag01ABC.md',
        operation: 'add',
        content: '---\nthreadKeys: []\n---\nHello world',
        frontmatterHash: 'xx:0000000000000001',
        bodyHash: 'xx:0000000000000002',
        contentHash: 'xx:0000000000000003',
      },
    ],
    ...overrides,
  }
}

async function postSyncNotify(body: string, signature?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature !== undefined) {
    headers['X-Signature'] = signature
  }
  return internalRoutes.request('/sync-notify', {
    method: 'POST',
    headers,
    body,
  })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /internal/sync-notify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GATEWAY_HMAC_SECRET', TEST_SECRET)
  })

  it('returns 202 and enqueues SyncJob with valid HMAC', async () => {
    const payload = makeSyncPayload()
    const body = JSON.stringify(payload)
    const sig = sign(body)

    const res = await postSyncNotify(body, sig)

    expect(res.status).toBe(202)
    const json = await res.json()
    expect(json).toEqual({ status: 'accepted' })
    expect(mockEnqueueSyncJob).toHaveBeenCalledOnce()
    expect(mockEnqueueSyncJob).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        type: 'sync',
        userId: 'user-1',
        commitHash: 'abc123',
        files: payload.files,
      })
    )
  })

  it('returns 401 with missing signature', async () => {
    const body = JSON.stringify(makeSyncPayload())

    const res = await postSyncNotify(body)

    expect(res.status).toBe(401)
    expect(mockEnqueueSyncJob).not.toHaveBeenCalled()
  })

  it('returns 401 with invalid signature', async () => {
    const body = JSON.stringify(makeSyncPayload())

    const res = await postSyncNotify(body, 'bad-signature')

    expect(res.status).toBe(401)
    expect(mockEnqueueSyncJob).not.toHaveBeenCalled()
  })

  it('returns 400 with missing userId', async () => {
    const payload = makeSyncPayload({ userId: '' })
    const body = JSON.stringify(payload)
    const sig = sign(body)

    const res = await postSyncNotify(body, sig)

    expect(res.status).toBe(400)
    expect(mockEnqueueSyncJob).not.toHaveBeenCalled()
  })

  it('enqueued SyncJob includes all fields from webhook payload', async () => {
    const payload = makeSyncPayload()
    const body = JSON.stringify(payload)
    const sig = sign(body)

    await postSyncNotify(body, sig)

    const enqueuedJob = mockEnqueueSyncJob.mock.calls[0][1]
    expect(enqueuedJob.type).toBe('sync')
    expect(enqueuedJob.userId).toBe('user-1')
    expect(enqueuedJob.commitHash).toBe('abc123')
    expect(enqueuedJob.files).toHaveLength(1)
    expect(enqueuedJob.files[0].content).toBe('---\nthreadKeys: []\n---\nHello world')
    expect(enqueuedJob.files[0].frontmatterHash).toBe('xx:0000000000000001')
    expect(enqueuedJob.files[0].bodyHash).toBe('xx:0000000000000002')
    expect(enqueuedJob.files[0].contentHash).toBe('xx:0000000000000003')
    expect(enqueuedJob.jobId).toBeTruthy()
    expect(enqueuedJob.enqueuedAt).toBeTruthy()
  })
})
