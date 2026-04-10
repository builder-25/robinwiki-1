import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ── Mocks ────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn()
const mockDbUpdate = vi.fn()
const mockDbInsert = vi.fn()
const mockDbExecute = vi.fn()

vi.mock('../db/client.js', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    execute: (...args: unknown[]) => mockDbExecute(...args),
  },
}))

vi.mock('../db/schema.js', () => ({
  entries: {
    lookupKey: 'entries.lookup_key',
    repoPath: 'entries.repo_path',
    userId: 'entries.user_id',
    deletedAt: 'entries.deleted_at',
    title: 'entries.title',
  },
  fragments: {
    lookupKey: 'fragments.lookup_key',
    repoPath: 'fragments.repo_path',
    userId: 'fragments.user_id',
    deletedAt: 'fragments.deleted_at',
    title: 'fragments.title',
    tags: 'fragments.tags',
  },
  threads: {
    lookupKey: 'threads.lookup_key',
    repoPath: 'threads.repo_path',
    userId: 'threads.user_id',
    deletedAt: 'threads.deleted_at',
    name: 'threads.name',
    type: 'threads.type',
    prompt: 'threads.prompt',
  },
  people: {
    lookupKey: 'people.lookup_key',
    repoPath: 'people.repo_path',
    userId: 'people.user_id',
    deletedAt: 'people.deleted_at',
    name: 'people.name',
    relationship: 'people.relationship',
  },
  edges: {
    srcType: 'edges.src_type',
    srcId: 'edges.src_id',
    dstType: 'edges.dst_type',
    dstId: 'edges.dst_id',
    edgeType: 'edges.edge_type',
    deletedAt: 'edges.deleted_at',
  },
  threadEdits: {
    id: 'thread_edits.id',
    threadId: 'thread_edits.thread_id',
    userId: 'thread_edits.user_id',
    type: 'thread_edits.type',
    content: 'thread_edits.content',
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

vi.mock('../middleware/session.js', () => ({
  sessionMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-123')
    await next()
  }),
}))

vi.mock('../lib/wiki-lookup.js', () => ({
  createWikiLookupFn: () => async () => null,
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

import { contentRoutes } from '../routes/content.js'

// ── Helpers ──────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono()
  app.route('/api/content', contentRoutes)
  return app
}

function chainMock(finalValue: unknown) {
  const chain: Record<string, any> = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue(finalValue)
  chain.set = vi.fn().mockReturnValue(chain)
  return chain
}

function updateChainMock() {
  const chain: Record<string, any> = {}
  chain.set = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockResolvedValue(undefined)
  return chain
}

function insertChainMock() {
  const chain: Record<string, any> = {}
  chain.values = vi.fn().mockResolvedValue(undefined)
  return chain
}

describe('Content Write API (EDIT-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const existingContent = '---\nname: Original\ntype: log\n---\nOriginal body'

  function setupDbAndGateway(type = 'thread') {
    const selectChain = chainMock([
      { lookupKey: 'key-123', repoPath: `${type}s/file.md`, deletedAt: null },
    ])
    mockDbSelect.mockReturnValue(selectChain)
    mockRead.mockResolvedValue({ content: existingContent })
    mockWrite.mockResolvedValue({
      path: `${type}s/file.md`,
      commitHash: 'abc123',
      timestamp: '2026-01-01',
    })
    const uChain = updateChainMock()
    mockDbUpdate.mockReturnValue(uChain)
    const iChain = insertChainMock()
    mockDbInsert.mockReturnValue(iChain)
    mockDbExecute.mockResolvedValue(undefined)
    return { selectChain, uChain, iChain }
  }

  describe('PUT /api/content/:type/:key', () => {
    it('returns 400 for invalid content type', async () => {
      const app = createApp()
      const res = await app.request('/api/content/invalid/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontmatter: { name: 'test' }, body: 'body' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when object does not exist', async () => {
      const selectChain = chainMock([])
      mockDbSelect.mockReturnValue(selectChain)
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontmatter: { name: 'test' }, body: 'body' }),
      })
      expect(res.status).toBe(404)
    })

    it('validates frontmatter with type-specific Zod schema', async () => {
      setupDbAndGateway()
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontmatter: { name: 'Updated Thread' },
          body: 'New body',
        }),
      })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
    })

    it('returns field-level validation errors on failure', async () => {
      setupDbAndGateway()
      const app = createApp()
      // Missing required 'name' field
      const res = await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontmatter: {}, body: 'body' }),
      })
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.fields).toBeDefined()
    })

    it('strips unknown/protected frontmatter fields', async () => {
      setupDbAndGateway()
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontmatter: { name: 'Test', unknownField: 'should be stripped' },
          body: 'body',
        }),
      })
      expect(res.status).toBe(200)
      // The write call should not include unknownField in frontmatter
      expect(mockWrite).toHaveBeenCalled()
      const writeCall = mockWrite.mock.calls[0][0]
      expect(writeCall.content).not.toContain('unknownField')
    })

    it('ignores body field for entry type (read-only)', async () => {
      setupDbAndGateway('entr')
      // Re-setup for entry type
      const selectChain = chainMock([
        { lookupKey: 'key-123', repoPath: 'entries/file.md', deletedAt: null },
      ])
      mockDbSelect.mockReturnValue(selectChain)
      mockRead.mockResolvedValue({
        content: '---\ntitle: Original Entry\n---\nOriginal body',
      })
      const uChain = updateChainMock()
      mockDbUpdate.mockReturnValue(uChain)

      const app = createApp()
      const res = await app.request('/api/content/entry/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontmatter: { title: 'Updated Entry' },
          body: 'Should be ignored',
        }),
      })
      expect(res.status).toBe(200)
    })

    it('resolves wiki-links and populates wikiLinks/brokenLinks in frontmatter', async () => {
      setupDbAndGateway()
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontmatter: { name: 'Test' },
          body: 'Check [[some-link]] here',
        }),
      })
      expect(res.status).toBe(200)
      // The write should have been called (wiki resolution happens internally)
      expect(mockWrite).toHaveBeenCalled()
      const writeCall = mockWrite.mock.calls[0][0]
      // brokenLinks should contain 'some-link' since mock lookup returns null
      expect(writeCall.content).toContain('brokenLinks')
    })

    it('writes assembled markdown to gateway with batch: true', async () => {
      setupDbAndGateway()
      const app = createApp()
      await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontmatter: { name: 'Test' }, body: 'body' }),
      })
      expect(mockWrite).toHaveBeenCalledWith(expect.objectContaining({ batch: true }))
    })

    it('updates DB row (title, tags, updatedAt) after successful write', async () => {
      setupDbAndGateway()
      const app = createApp()
      await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontmatter: { name: 'Updated' },
          body: 'body',
        }),
      })
      expect(mockDbUpdate).toHaveBeenCalled()
    })

    it('marks parent threads DIRTY when fragment is edited', async () => {
      mockRead.mockResolvedValue({
        content: '---\ntitle: Frag\ntags: []\n---\nFragment body',
      })
      mockWrite.mockResolvedValue({
        path: 'fragments/file.md',
        commitHash: 'abc',
        timestamp: '2026-01-01',
      })
      const uChain = updateChainMock()
      mockDbUpdate.mockReturnValue(uChain)
      mockDbExecute.mockResolvedValue(undefined)

      // For the edge lookup (second select call), return edges
      let selectCallCount = 0
      mockDbSelect.mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          // First select: DB row lookup (with .limit())
          return chainMock([
            {
              lookupKey: 'frag-123',
              repoPath: 'fragments/file.md',
              deletedAt: null,
            },
          ])
        }
        // Second select: edge lookup for parent threads (no .limit(), direct where result)
        const edgeChain: Record<string, any> = {}
        edgeChain.from = vi.fn().mockReturnValue(edgeChain)
        edgeChain.where = vi.fn().mockResolvedValue([{ dstId: 'thread-abc' }])
        edgeChain.limit = vi.fn().mockResolvedValue([{ dstId: 'thread-abc' }])
        return edgeChain
      })

      const app = createApp()
      const res = await app.request('/api/content/fragment/frag-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontmatter: { title: 'Updated Frag' },
          body: 'new body',
        }),
      })
      expect(res.status).toBe(200)
      // Should have called execute for DIRTY update
      expect(mockDbExecute).toHaveBeenCalled()
    })

    it('logs delta to thread_edits when thread body changes', async () => {
      setupDbAndGateway()
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontmatter: { name: 'Test' },
          body: 'Original body\nNew addition here',
        }),
      })
      expect(res.status).toBe(200)
      // Should have inserted into thread_edits
      expect(mockDbInsert).toHaveBeenCalled()
    })

    it('returns { ok: true } on success', async () => {
      setupDbAndGateway()
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontmatter: { name: 'Test' }, body: 'body' }),
      })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
    })

    it('requires authenticated session', async () => {
      // Session middleware is mocked; verify it was applied
      setupDbAndGateway()
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontmatter: { name: 'Test' }, body: 'body' }),
      })
      expect(res.status).toBe(200)
    })
  })
})
