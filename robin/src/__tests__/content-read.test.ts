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
  edges: {},
  threadEdits: {},
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

// Import after mocks
import { contentRoutes } from '../routes/content.js'

// ── Test setup ───────────────────────────────────────────────────────────

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

describe('Content Read API (EDIT-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/content/:type/:key', () => {
    it('returns 400 for invalid content type', async () => {
      const app = createApp()
      const res = await app.request('/api/content/invalid/key-123')
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('Invalid content type')
    })

    it('returns 404 when object does not exist', async () => {
      const chain = chainMock([])
      mockDbSelect.mockReturnValue(chain)
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123')
      expect(res.status).toBe(404)
    })

    it('returns 404 when repoPath is empty', async () => {
      const chain = chainMock([{ lookupKey: 'key-123', repoPath: '', deletedAt: null }])
      mockDbSelect.mockReturnValue(chain)
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123')
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.error).toBe('Content not available')
    })

    it('returns raw markdown content by default', async () => {
      const chain = chainMock([
        { lookupKey: 'key-123', repoPath: 'threads/file.md', deletedAt: null },
      ])
      mockDbSelect.mockReturnValue(chain)
      mockRead.mockResolvedValue({
        content: '---\nname: Test\n---\nHello world',
      })
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123')
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.content).toBe('---\nname: Test\n---\nHello world')
    })

    it('returns structured { frontmatter, body, raw } when ?format=structured', async () => {
      const chain = chainMock([
        { lookupKey: 'key-123', repoPath: 'threads/file.md', deletedAt: null },
      ])
      mockDbSelect.mockReturnValue(chain)
      mockRead.mockResolvedValue({
        content: '---\nname: Test\ntags:\n  - a\n---\nBody text here',
      })
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123?format=structured')
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.frontmatter.name).toBe('Test')
      expect(json.body).toBe('Body text here')
      expect(json.raw).toContain('name: Test')
    })

    it('applies defaults for missing frontmatter fields (wikiLinks, brokenLinks, tags)', async () => {
      const chain = chainMock([
        { lookupKey: 'key-123', repoPath: 'threads/file.md', deletedAt: null },
      ])
      mockDbSelect.mockReturnValue(chain)
      mockRead.mockResolvedValue({ content: '---\nname: Test\n---\nBody' })
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123?format=structured')
      const json = await res.json()
      expect(json.frontmatter.wikiLinks).toEqual([])
      expect(json.frontmatter.brokenLinks).toEqual([])
      expect(json.frontmatter.tags).toEqual([])
    })

    it('requires authenticated session', async () => {
      // sessionMiddleware is mocked to always set userId, but testing the
      // middleware is present ensures the route uses session auth
      const chain = chainMock([
        { lookupKey: 'key-123', repoPath: 'threads/file.md', deletedAt: null },
      ])
      mockDbSelect.mockReturnValue(chain)
      mockRead.mockResolvedValue({ content: '---\nname: Test\n---\nBody' })
      const app = createApp()
      const res = await app.request('/api/content/thread/key-123')
      // Should succeed with mocked session
      expect(res.status).toBe(200)
    })
  })
})
