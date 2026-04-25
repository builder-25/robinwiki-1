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

vi.mock('../db/audit.js', () => ({
  emitAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

import { wikisRoutes } from '../routes/wikis.js'

// ── Helpers ──────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono()
  app.route('/wikis', wikisRoutes)
  return app
}

const now = new Date()

function makeWiki(overrides: Record<string, unknown> = {}) {
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

describe('PUT /wikis/:id — DB update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('syncs name change to DB', async () => {
    const existing = makeWiki()
    const updated = makeWiki({ name: 'New Name', slug: 'new-name', updatedAt: new Date() })

    mockDbSelect.mockReturnValue(selectChainMock([existing]))
    mockDbUpdate.mockReturnValue(updateChainMock([updated]))

    const app = createApp()
    const res = await app.request('/wikis/thread01TEST', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })

    expect(res.status).toBe(200)
    expect(mockDbUpdate).toHaveBeenCalled()
  })

  it('marks wiki PENDING when prompt changes', async () => {
    const existing = makeWiki()
    const updated = makeWiki({ prompt: 'new prompt', state: 'PENDING', updatedAt: new Date() })

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
    const setArg = updateChain.set.mock.calls[0][0]
    expect(setArg.state).toBe('PENDING')
  })

  it('does NOT change state when only name changes', async () => {
    const existing = makeWiki()
    const updated = makeWiki({ name: 'Renamed', slug: 'renamed', updatedAt: new Date() })

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
})
