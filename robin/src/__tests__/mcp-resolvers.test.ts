import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { resolveSlug, stripFrontmatter } from '../mcp/resolvers.js'

// ─── stripFrontmatter ───

describe('stripFrontmatter', () => {
  it('removes YAML frontmatter', () => {
    const input = '---\ntitle: Hello\ntags: [a]\n---\nBody content here'
    expect(stripFrontmatter(input)).toBe('Body content here')
  })

  it('returns content unchanged when no frontmatter', () => {
    const input = 'Just plain text'
    expect(stripFrontmatter(input)).toBe('Just plain text')
  })

  it('handles empty body after frontmatter', () => {
    const input = '---\ntitle: Hello\n---\n'
    expect(stripFrontmatter(input)).toBe('')
  })

  it('handles Windows-style line endings', () => {
    const input = '---\r\ntitle: Hello\r\n---\r\nBody'
    expect(stripFrontmatter(input)).toBe('Body')
  })
})

// ─── resolveSlug ───

describe('resolveSlug', () => {
  const candidates = [
    { slug: 'ai-infrastructure', name: 'AI Infrastructure & Startups' },
    { slug: 'weekly-review', name: 'Weekly Review' },
    { slug: 'project-robin', name: 'Project Robin Notes' },
  ]

  it('returns exact slug match', () => {
    const result = resolveSlug('ai-infrastructure', candidates)
    expect(result).toEqual({ match: candidates[0] })
  })

  it('returns exact match case-insensitively', () => {
    const result = resolveSlug('AI-Infrastructure', candidates)
    // lowercased input matches slug 'ai-infrastructure'
    expect(result).toEqual({ match: candidates[0] })
  })

  it('returns fuzzy match above threshold', () => {
    const result = resolveSlug('ai-infra', candidates)
    expect('match' in result).toBe(true)
    if ('match' in result) {
      expect(result.match.slug).toBe('ai-infrastructure')
    }
  })

  it('returns fuzzy match on name field', () => {
    const result = resolveSlug('weekly review', candidates)
    expect('match' in result).toBe(true)
    if ('match' in result) {
      expect(result.match.slug).toBe('weekly-review')
    }
  })

  it('returns error with suggestions for no match', () => {
    const result = resolveSlug('zzz-nonexistent-topic', candidates)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('No match found')
      expect(result.suggestions).toHaveLength(3)
    }
  })

  it('returns empty suggestions for empty candidates', () => {
    const result = resolveSlug('anything', [])
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.suggestions).toEqual([])
    }
  })
})

// ─── Resolver integration tests (real DB, mocked gateway) ───

import type postgres from 'postgres'
import type { McpResolverDeps } from '../mcp/resolvers.js'
import { listThreads, getThread, getFragment, getPerson } from '../mcp/resolvers.js'
import { makeLookupKey, ObjectType } from '@robin/shared'
import { entries, fragments, threads, people, edges } from '../db/schema.js'
import {
  ensureTestDatabase,
  pushTestSchema,
  getTestDb,
  cleanupTestDb,
  createTestUser,
  createTestVault,
  clearTestData,
} from './test-setup.js'

function mockGateway(readResults: Record<string, string> = {}): McpResolverDeps['gatewayClient'] {
  return {
    read: async (_userId: string, path: string) => {
      const content = readResults[path]
      if (content === undefined) throw new Error(`Not found: ${path}`)
      return { path, content, commitHash: 'abc123' }
    },
    provision: async () => ({ status: 'ok', userId: '' }),
    write: async () => ({ path: '', commitHash: '', timestamp: '' }),
    search: async () => ({ results: [], count: 0 }),
    reindex: async () => ({ status: 'ok' }),
    batchWrite: async () => ({ commitHash: '', fileCount: 0, timestamp: '' }),
  } as McpResolverDeps['gatewayClient']
}

describe('MCP resolvers (real DB)', () => {
  let db: ReturnType<typeof getTestDb>['db']
  let sqlConn: ReturnType<typeof postgres>
  let testUserId: string

  // Reusable keys
  let entryKey: string
  let threadKey: string
  let fragKey1: string
  let fragKey2: string
  let personKey1: string
  let personKey2: string

  beforeAll(async () => {
    await ensureTestDatabase()
    pushTestSchema()
    const conn = getTestDb()
    db = conn.db
    sqlConn = conn.sql
    testUserId = await createTestUser(db)
    await createTestVault(db)
  }, 60_000)

  afterAll(async () => {
    await cleanupTestDb(sqlConn)
  })

  beforeEach(async () => {
    await clearTestData(db)

    // Seed test data
    entryKey = makeLookupKey(ObjectType.ENTRY)
    threadKey = makeLookupKey(ObjectType.THREAD)
    fragKey1 = makeLookupKey(ObjectType.FRAGMENT)
    fragKey2 = makeLookupKey(ObjectType.FRAGMENT)
    personKey1 = makeLookupKey(ObjectType.PERSON)
    personKey2 = makeLookupKey(ObjectType.PERSON)

    await db.insert(entries).values({
      lookupKey: entryKey,
      userId: testUserId,
      slug: 'mcp-test-entry',
      state: 'RESOLVED',
      repoPath: 'entries/mcp-test-entry.md',
      title: 'MCP Test Entry',
      content: 'Some content',
    })

    await db.insert(threads).values({
      lookupKey: threadKey,
      userId: testUserId,
      slug: 'ai-infrastructure',
      name: 'AI Infrastructure & Startups',
      type: 'log',
      state: 'RESOLVED',
      repoPath: 'threads/ai-infrastructure.md',
      lastRebuiltAt: new Date('2025-06-01'),
    })

    await db.insert(fragments).values([
      {
        lookupKey: fragKey1,
        userId: testUserId,
        slug: 'vector-db-note',
        title: 'Vector DB Note',
        type: 'observation',
        tags: ['ai', 'databases'],
        repoPath: 'fragments/vector-db-note.md',
        entryId: entryKey,
        state: 'RESOLVED',
      },
      {
        lookupKey: fragKey2,
        userId: testUserId,
        slug: 'startup-pivot',
        title: 'Startup Pivot Discussion',
        type: 'observation',
        tags: ['startups'],
        repoPath: 'fragments/startup-pivot.md',
        entryId: entryKey,
        state: 'RESOLVED',
      },
    ])

    await db.insert(people).values([
      {
        lookupKey: personKey1,
        userId: testUserId,
        slug: 'david-chen',
        name: 'David Chen',
        relationship: 'colleague',
        sections: { aliases: ['Dave', 'D. Chen'] },
        repoPath: 'people/david-chen.md',
        state: 'RESOLVED',
      },
      {
        lookupKey: personKey2,
        userId: testUserId,
        slug: 'sarah-jones',
        name: 'Sarah Jones',
        relationship: 'friend',
        sections: { aliases: [] },
        repoPath: 'people/sarah-jones.md',
        state: 'RESOLVED',
      },
    ])

    // Edges: both fragments in thread, frag1 mentions person1
    await db.insert(edges).values([
      {
        id: crypto.randomUUID(),
        userId: testUserId,
        srcType: 'frag',
        srcId: fragKey1,
        dstType: 'thread',
        dstId: threadKey,
        edgeType: 'FRAGMENT_IN_THREAD',
      },
      {
        id: crypto.randomUUID(),
        userId: testUserId,
        srcType: 'frag',
        srcId: fragKey2,
        dstType: 'thread',
        dstId: threadKey,
        edgeType: 'FRAGMENT_IN_THREAD',
      },
      {
        id: crypto.randomUUID(),
        userId: testUserId,
        srcType: 'frag',
        srcId: fragKey1,
        dstType: 'person',
        dstId: personKey1,
        edgeType: 'FRAGMENT_MENTIONS_PERSON',
      },
    ])
  })

  // ─── listThreads ───

  describe('listThreads', () => {
    it('returns threads with correct fragment counts from edge joins', async () => {
      const gw = mockGateway({
        'threads/ai-infrastructure.md': '---\ntitle: AI\n---\nWiki body about AI infra.',
      })

      const result = await listThreads({ db, gatewayClient: gw }, testUserId)

      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('ai-infrastructure')
      expect(result[0].name).toBe('AI Infrastructure & Startups')
      expect(result[0].fragmentCount).toBe(2)
      expect(result[0].wikiPreview).toBe('Wiki body about AI infra.')
      expect(result[0].lastRebuiltAt).toBe('2025-06-01T00:00:00.000Z')
    })

    it('returns empty array for user with no threads', async () => {
      const gw = mockGateway()
      const result = await listThreads({ db, gatewayClient: gw }, 'nonexistent-user')
      expect(result).toEqual([])
    })

    it('excludes soft-deleted threads', async () => {
      await db
        .update(threads)
        .set({ deletedAt: new Date() })
        .where(eq(threads.lookupKey, threadKey))

      const gw = mockGateway()
      const result = await listThreads({ db, gatewayClient: gw }, testUserId)
      expect(result).toEqual([])
    })

    it('excludes soft-deleted edges from fragment count', async () => {
      // Soft-delete one edge
      await db.update(edges).set({ deletedAt: new Date() }).where(eq(edges.srcId, fragKey2))

      const gw = mockGateway({
        'threads/ai-infrastructure.md': '---\n---\nBody.',
      })
      const result = await listThreads({ db, gatewayClient: gw }, testUserId)
      expect(result[0].fragmentCount).toBe(1)
    })

    it('returns empty preview when gateway read fails', async () => {
      const gw = mockGateway({}) // no content → throws
      const result = await listThreads({ db, gatewayClient: gw }, testUserId)
      expect(result[0].wikiPreview).toBe('')
    })
  })

  // ─── getThread ───

  describe('getThread', () => {
    it('resolves exact slug and returns wiki body + linked fragments', async () => {
      const gw = mockGateway({
        'threads/ai-infrastructure.md': '---\ntitle: AI\n---\nFull wiki body.',
        'fragments/vector-db-note.md': '---\ntitle: VDB\n---\nVector DB snippet content.',
        'fragments/startup-pivot.md': '---\ntitle: Pivot\n---\nStartup pivot snippet.',
      })

      const result = await getThread({ db, gatewayClient: gw }, testUserId, 'ai-infrastructure')

      expect('thread' in result).toBe(true)
      if ('thread' in result) {
        expect(result.thread.slug).toBe('ai-infrastructure')
        expect(result.thread.state).toBe('RESOLVED')
        expect(result.wikiBody).toBe('Full wiki body.')
        expect(result.fragments).toHaveLength(2)

        const slugs = result.fragments.map((f) => f.slug).sort()
        expect(slugs).toEqual(['startup-pivot', 'vector-db-note'])
      }
    })

    it('resolves fuzzy slug match', async () => {
      const gw = mockGateway({
        'threads/ai-infrastructure.md': '---\n---\nBody.',
        'fragments/vector-db-note.md': '---\n---\nSnippet.',
        'fragments/startup-pivot.md': '---\n---\nSnippet.',
      })

      const result = await getThread({ db, gatewayClient: gw }, testUserId, 'ai-infra')
      expect('thread' in result).toBe(true)
      if ('thread' in result) {
        expect(result.thread.slug).toBe('ai-infrastructure')
      }
    })

    it('returns error for no match', async () => {
      const gw = mockGateway()
      const result = await getThread({ db, gatewayClient: gw }, testUserId, 'zzz-nonexistent')
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.suggestions).toContain('ai-infrastructure')
      }
    })

    it('excludes soft-deleted fragment edges', async () => {
      await db.update(edges).set({ deletedAt: new Date() }).where(eq(edges.srcId, fragKey2))

      const gw = mockGateway({
        'threads/ai-infrastructure.md': '---\n---\nBody.',
        'fragments/vector-db-note.md': '---\n---\nSnippet.',
      })

      const result = await getThread({ db, gatewayClient: gw }, testUserId, 'ai-infrastructure')
      expect('thread' in result).toBe(true)
      if ('thread' in result) {
        expect(result.fragments).toHaveLength(1)
        expect(result.fragments[0].slug).toBe('vector-db-note')
      }
    })
  })

  // ─── getFragment ───

  describe('getFragment', () => {
    it('resolves exact slug and returns content + frontmatter', async () => {
      const gw = mockGateway({
        'fragments/vector-db-note.md':
          '---\ntitle: Vector DB Note\ntags: [ai, databases]\n---\nContent about vector DBs.',
      })

      const result = await getFragment({ db, gatewayClient: gw }, testUserId, 'vector-db-note')

      expect('slug' in result).toBe(true)
      if ('slug' in result) {
        expect(result.slug).toBe('vector-db-note')
        expect(result.title).toBe('Vector DB Note')
        expect(result.tags).toEqual(['ai', 'databases'])
        expect(result.content).toBe('Content about vector DBs.')
        expect(result.frontmatter).toContain('title: Vector DB Note')
      }
    })

    it('resolves fuzzy slug match', async () => {
      const gw = mockGateway({
        'fragments/vector-db-note.md': '---\n---\nContent.',
      })

      const result = await getFragment({ db, gatewayClient: gw }, testUserId, 'vector-db')
      expect('slug' in result).toBe(true)
      if ('slug' in result) {
        expect(result.slug).toBe('vector-db-note')
      }
    })

    it('returns error for unknown slug', async () => {
      const gw = mockGateway()
      const result = await getFragment({ db, gatewayClient: gw }, testUserId, 'zzz-missing')
      expect('error' in result).toBe(true)
    })

    it('excludes soft-deleted fragments', async () => {
      await db
        .update(fragments)
        .set({ deletedAt: new Date() })
        .where(eq(fragments.lookupKey, fragKey1))

      const gw = mockGateway()
      const result = await getFragment({ db, gatewayClient: gw }, testUserId, 'vector-db-note')
      expect('error' in result).toBe(true)
    })
  })

  // ─── getPerson ───

  describe('getPerson', () => {
    it('resolves exact name and returns body + linked fragments', async () => {
      const gw = mockGateway({
        'people/david-chen.md': '---\nname: David Chen\n---\nPerson body about David.',
        'fragments/vector-db-note.md': '---\ntitle: VDB\n---\nHad lunch with David.',
      })

      const result = await getPerson({ db, gatewayClient: gw }, testUserId, 'David Chen')

      expect('person' in result).toBe(true)
      if ('person' in result) {
        expect(result.person.name).toBe('David Chen')
        expect(result.person.slug).toBe('david-chen')
        expect(result.person.aliases).toEqual(['Dave', 'D. Chen'])
        expect(result.person.relationship).toBe('colleague')
        expect(result.body).toBe('Person body about David.')
        expect(result.fragments).toHaveLength(1)
        expect(result.fragments[0].slug).toBe('vector-db-note')
      }
    })

    it('resolves alias match', async () => {
      const gw = mockGateway({
        'people/david-chen.md': '---\n---\nBody.',
        'fragments/vector-db-note.md': '---\n---\nSnippet.',
      })

      const result = await getPerson({ db, gatewayClient: gw }, testUserId, 'Dave')
      expect('person' in result).toBe(true)
      if ('person' in result) {
        expect(result.person.name).toBe('David Chen')
      }
    })

    it('resolves fuzzy name match', async () => {
      const gw = mockGateway({
        'people/david-chen.md': '---\n---\nBody.',
        'fragments/vector-db-note.md': '---\n---\nSnippet.',
      })

      const result = await getPerson({ db, gatewayClient: gw }, testUserId, 'david')
      expect('person' in result).toBe(true)
      if ('person' in result) {
        expect(result.person.name).toBe('David Chen')
      }
    })

    it('returns error with suggestions for no match', async () => {
      const gw = mockGateway()
      const result = await getPerson({ db, gatewayClient: gw }, testUserId, 'Zzz Nonexistent')
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.suggestions).toContain('David Chen')
      }
    })

    it('excludes soft-deleted people', async () => {
      await db.update(people).set({ deletedAt: new Date() }).where(eq(people.lookupKey, personKey1))

      const gw = mockGateway()
      const result = await getPerson({ db, gatewayClient: gw }, testUserId, 'David Chen')
      expect('error' in result).toBe(true)
    })

    it('excludes soft-deleted mention edges from fragment list', async () => {
      // Soft-delete the mention edge
      await db.update(edges).set({ deletedAt: new Date() }).where(eq(edges.dstId, personKey1))

      const gw = mockGateway({
        'people/david-chen.md': '---\n---\nBody.',
      })

      const result = await getPerson({ db, gatewayClient: gw }, testUserId, 'David Chen')
      expect('person' in result).toBe(true)
      if ('person' in result) {
        expect(result.fragments).toHaveLength(0)
      }
    })
  })
})
