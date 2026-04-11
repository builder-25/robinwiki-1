import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ── Mocks ────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn()
const mockDbUpdate = vi.fn()

vi.mock('../db/client.js', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}))

vi.mock('../db/schema.js', () => ({
  wikis: {
    lookupKey: 'wikis.lookup_key',
    userId: 'wikis.user_id',
    slug: 'wikis.slug',
    name: 'wikis.name',
    type: 'wikis.type',
    prompt: 'wikis.prompt',
    state: 'wikis.state',
    repoPath: 'wikis.repo_path',
    vaultId: 'wikis.vault_id',
    lastRebuiltAt: 'wikis.last_rebuilt_at',
    createdAt: 'wikis.created_at',
    updatedAt: 'wikis.updated_at',
  },
}))

const mockRead = vi.fn()
const mockWrite = vi.fn()
vi.mock('../gateway/client.js', () => ({
  gatewayClient: {
    read: (...args: unknown[]) => mockRead(...args),
    write: (...args: unknown[]) => mockWrite(...args),
  },
}))

vi.mock('../queue/producer.js', () => ({
  producer: { enqueueRegenJob: vi.fn() },
}))

vi.mock('../middleware/session.js', () => ({
  sessionMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-123')
    await next()
  }),
}))

vi.mock('../lib/logger.js', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

import { wikisRoutes } from '../routes/wikis.js'

// ── Helpers ──────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono()
  app.route('/wikis', wikisRoutes)
  return app
}

const now = new Date()

function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    lookupKey: 'thread01TEST',
    userId: 'test-user-123',
    slug: 'engineering-log',
    name: 'Engineering Log',
    type: 'log',
    prompt: 'Summarize engineering work',
    state: 'RESOLVED',
    repoPath: 'wikis/20260323-engineering-log.thread01TEST.md',
    vaultId: 'vault-1',
    lastRebuiltAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function selectChainMock(rows: unknown[]) {
  const chain: Record<string, any> = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockResolvedValue(rows)
  return chain
}

function updateChainMock(returning: unknown[]) {
  const chain: Record<string, any> = {}
  chain.set = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue(returning)
  return chain
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('PUT /wikis/:id — git sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRead.mockResolvedValue({
      content: '---\ntype: "log"\nstate: RESOLVED\nname: "Engineering Log"\nprompt: "Summarize engineering work"\nfragmentKeys: []\nfragmentCount: 0\n---\nWiki body content here.',
    })
    mockWrite.mockResolvedValue({ path: 'ok', commitHash: 'abc', timestamp: '2026-01-01' })
  })

  it('syncs name change to git frontmatter', async () => {
    const existing = makeThread()
    const updated = makeThread({ name: 'New Name', slug: 'new-name', updatedAt: new Date() })

    mockDbSelect.mockReturnValue(selectChainMock([existing]))
    mockDbUpdate.mockReturnValue(updateChainMock([updated]))

    const app = createApp()
    const res = await app.request('/wikis/thread01TEST', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })

    expect(res.status).toBe(200)
    expect(mockWrite).toHaveBeenCalledTimes(1)
    const writeCall = mockWrite.mock.calls[0][0]
    expect(writeCall.content).toContain('name: New Name')
    expect(writeCall.content).toContain('Wiki body content here.')
    expect(writeCall.path).toBe('wikis/20260323-engineering-log.thread01TEST.md')
  })

  it('marks thread DIRTY when prompt changes', async () => {
    const existing = makeThread()
    const updated = makeThread({ prompt: 'new prompt', state: 'DIRTY', updatedAt: new Date() })

    mockDbSelect.mockReturnValue(selectChainMock([existing]))
    const updateChain = updateChainMock([updated])
    mockDbUpdate.mockReturnValue(updateChain)

    const app = createApp()
    const res = await app.request('/wikis/thread01TEST', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'new prompt' }),
    })

    expect(res.status).toBe(200)
    // Verify the set() call included state: 'DIRTY'
    const setArg = updateChain.set.mock.calls[0][0]
    expect(setArg.state).toBe('DIRTY')
  })

  it('does NOT mark DIRTY when only name changes', async () => {
    const existing = makeThread()
    const updated = makeThread({ name: 'Renamed', slug: 'renamed', updatedAt: new Date() })

    mockDbSelect.mockReturnValue(selectChainMock([existing]))
    const updateChain = updateChainMock([updated])
    mockDbUpdate.mockReturnValue(updateChain)

    const app = createApp()
    await app.request('/wikis/thread01TEST', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed' }),
    })

    const setArg = updateChain.set.mock.calls[0][0]
    expect(setArg.state).toBeUndefined()
  })

  it('skips git write when repoPath is empty', async () => {
    const existing = makeThread({ repoPath: '' })
    const updated = makeThread({ repoPath: '', name: 'New', updatedAt: new Date() })

    mockDbSelect.mockReturnValue(selectChainMock([existing]))
    mockDbUpdate.mockReturnValue(updateChainMock([updated]))

    const app = createApp()
    const res = await app.request('/wikis/thread01TEST', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    })

    expect(res.status).toBe(200)
    expect(mockRead).not.toHaveBeenCalled()
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('returns 200 even when gateway write fails (fail-open)', async () => {
    const existing = makeThread()
    const updated = makeThread({ name: 'X', updatedAt: new Date() })

    mockDbSelect.mockReturnValue(selectChainMock([existing]))
    mockDbUpdate.mockReturnValue(updateChainMock([updated]))
    mockWrite.mockRejectedValue(new Error('gateway down'))

    const app = createApp()
    const res = await app.request('/wikis/thread01TEST', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    })

    expect(res.status).toBe(200)
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(1)
  })
})
