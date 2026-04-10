import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProvisionJob } from '@robin/queue'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

const mockInsert = vi.fn()
const mockValues = vi.fn()

vi.mock('../db/client.js', () => ({
  db: {
    select: () => ({ from: mockFrom }),
    update: () => ({ set: mockSet }),
    insert: () => ({ values: mockValues }),
  },
}))

mockFrom.mockReturnValue({ where: mockWhere })
mockSet.mockReturnValue({ where: mockUpdateWhere })
mockUpdateWhere.mockResolvedValue(undefined)

vi.mock('../db/schema.js', () => ({
  users: {
    id: 'id',
    publicKey: 'public_key',
    encryptedPrivateKey: 'encrypted_private_key',
  },
  entries: {},
  files: {},
  threads: {},
  vaults: { id: 'id', userId: 'user_id' },
  fragments: {},
  edges: {},
  people: {},
  connections: {},
  configNotes: { key: 'key', userId: 'user_id' },
}))

const mockProvision = vi.fn().mockResolvedValue({ status: 'ok', userId: 'u1' })
vi.mock('../gateway/client.js', () => ({
  gatewayClient: { provision: (...args: unknown[]) => mockProvision(...args) },
}))

const mockGenerateKeypair = vi.fn().mockReturnValue({
  publicKey: 'deadbeef',
  encryptedPrivateKey: 'base64secret',
})
vi.mock('../keypair.js', () => ({
  generateKeypair: (...args: unknown[]) => mockGenerateKeypair(...args),
}))

vi.stubEnv('KEY_ENCRYPTION_SECRET', 'test-secret-32chars!!!!!!!!!!!')

// ── Import under test (after mocks) ────────────────────────────────────────

const { processProvisionJob } = await import('../queue/worker')

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeJob(userId = 'u1'): ProvisionJob {
  return {
    type: 'provision',
    jobId: `provision-${userId}`,
    userId,
    enqueuedAt: new Date().toISOString(),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('processProvisionJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdateWhere.mockResolvedValue(undefined)
    mockValues.mockResolvedValue(undefined)
    // Default: all subsequent where() calls return empty arrays (bootstrapDefaultVaults, bootstrapConfigNotes)
    mockWhere.mockResolvedValue([])
    mockProvision.mockResolvedValue({ status: 'ok', userId: 'u1' })
    mockGenerateKeypair.mockReturnValue({
      publicKey: 'deadbeef',
      encryptedPrivateKey: 'base64secret',
    })
  })

  it('returns failure when user not found', async () => {
    mockWhere.mockResolvedValueOnce([])

    const result = await processProvisionJob(makeJob('missing'))

    expect(result.success).toBe(false)
    expect(result.error).toBe('user not found')
    expect(mockGenerateKeypair).not.toHaveBeenCalled()
    expect(mockProvision).not.toHaveBeenCalled()
  })

  it('skips keygen if user already has a keypair but still provisions gateway', async () => {
    mockWhere.mockResolvedValueOnce([
      {
        id: 'u1',
        publicKey: 'existing-pk',
        encryptedPrivateKey: 'existing-epk',
      },
    ])

    const result = await processProvisionJob(makeJob())

    expect(result.success).toBe(true)
    expect(mockGenerateKeypair).not.toHaveBeenCalled()
    expect(mockProvision).toHaveBeenCalledWith('u1', 'existing-pk')
  })

  it('generates keypair, writes DB, and provisions gateway for new user', async () => {
    mockWhere.mockResolvedValueOnce([{ id: 'u1', publicKey: '', encryptedPrivateKey: '' }])

    const result = await processProvisionJob(makeJob())

    expect(result.success).toBe(true)
    expect(mockGenerateKeypair).toHaveBeenCalledOnce()
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: 'deadbeef',
        encryptedPrivateKey: 'base64secret',
      })
    )
    expect(mockProvision).toHaveBeenCalledWith('u1', 'deadbeef')
  })

  it('provisions user with null keypair columns', async () => {
    mockWhere.mockResolvedValueOnce([{ id: 'u1', publicKey: null, encryptedPrivateKey: null }])

    const result = await processProvisionJob(makeJob())

    expect(result.success).toBe(true)
    expect(mockGenerateKeypair).toHaveBeenCalledOnce()
    expect(mockProvision).toHaveBeenCalledWith('u1', 'deadbeef')
  })

  it('propagates gateway errors (so BullMQ retries)', async () => {
    mockWhere.mockResolvedValueOnce([{ id: 'u1', publicKey: '', encryptedPrivateKey: '' }])
    mockProvision.mockRejectedValueOnce(new Error('gateway down'))

    await expect(processProvisionJob(makeJob())).rejects.toThrow('gateway down')
  })
})
