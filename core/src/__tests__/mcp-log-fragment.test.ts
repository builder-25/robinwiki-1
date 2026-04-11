import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { handleLogFragment, type McpServerDeps } from '../mcp/handlers.js'
import {
  fragments as fragmentsTable,
  wikis as threadsTable,
  edges as edgesTable,
  people as peopleTable,
} from '../db/schema.js'
import {
  ensureTestDatabase,
  pushTestSchema,
  getTestDb,
  cleanupTestDb,
  createTestUser,
  createTestVault,
  clearTestData,
} from './test-setup.js'
import type postgres from 'postgres'

// ─── Test Setup ───

let db: ReturnType<typeof getTestDb>['db']
let sqlConn: ReturnType<typeof postgres>
let testUserId: string
let testVaultId: string

const TEST_THREAD_KEY = 'thread01TESTTHREAD000000000001'
const TEST_THREAD_SLUG = 'fitness'

function makeDeps(overrides: Partial<McpServerDeps> = {}): McpServerDeps {
  return {
    db,
    producer: {
      enqueueWrite: vi.fn().mockResolvedValue('job-id'),
      enqueueReindex: vi.fn(),
      enqueueProvision: vi.fn(),
      enqueueExtraction: vi.fn(),
      enqueueLinkJob: vi.fn(),
      enqueueReclassify: vi.fn(),
      enqueueSync: vi.fn(),
    } as unknown as McpServerDeps['producer'],
    gatewayClient: {
      write: vi.fn().mockResolvedValue({ path: '', commitHash: 'abc', timestamp: '' }),
      read: vi.fn(),
      provision: vi.fn(),
      search: vi.fn(),
      reindex: vi.fn(),
      batchWrite: vi.fn().mockResolvedValue({ commitHash: 'abc123' }),
    } as unknown as McpServerDeps['gatewayClient'],
    spawnWriteWorker: vi.fn(),
    resolveDefaultVaultId: vi.fn().mockResolvedValue(testVaultId),
    entityExtractCall: vi.fn().mockResolvedValue({ people: [] }),
    loadUserPeople: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

async function createTestThread() {
  await db
    .insert(threadsTable)
    .values({
      lookupKey: TEST_THREAD_KEY,
      userId: testUserId,
      slug: TEST_THREAD_SLUG,
      name: 'Fitness',
      type: 'log',
      state: 'RESOLVED',
      vaultId: testVaultId,
    } as any)
    .onConflictDoNothing()
}

beforeAll(async () => {
  await ensureTestDatabase()
  pushTestSchema()
  const conn = getTestDb()
  db = conn.db
  sqlConn = conn.sql
  testUserId = await createTestUser(db)
  testVaultId = await createTestVault(db)
}, 60_000)

afterAll(async () => {
  await cleanupTestDb(sqlConn)
})

beforeEach(async () => {
  await clearTestData(db)
  await createTestThread()
})

// ─── Tests ───

describe('handleLogFragment', () => {
  it('inserts fragment in RESOLVED state with correct fields', async () => {
    const deps = makeDeps()
    const result = await handleLogFragment(
      deps,
      { content: 'Did a 5k run today', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.fragmentKey).toMatch(/^frag/)
    expect(parsed.threadSlug).toBe(TEST_THREAD_SLUG)
    expect(parsed.wikiKey).toBe(TEST_THREAD_KEY)

    const rows = await db.select().from(fragmentsTable).where(eq(fragmentsTable.userId, testUserId))
    expect(rows).toHaveLength(1)
    expect(rows[0].state).toBe('RESOLVED')
    expect(rows[0].type).toBe('observation')
    expect(rows[0].title).toBe('Did a 5k run today')
    expect(rows[0].entryId).toBeNull()
  })

  it('writes fragment file to gateway via batchWrite', async () => {
    const deps = makeDeps()
    await handleLogFragment(
      deps,
      { content: 'Morning run notes', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    expect(deps.gatewayClient.batchWrite).toHaveBeenCalledTimes(1)
    const call = (deps.gatewayClient.batchWrite as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.userId).toBe(testUserId)
    expect(call.files[0].path).toMatch(/^fragments\/\d{8}-morning-run-notes-[a-z0-9]+\.frag.+\.md$/)
    expect(call.files[0].content).toContain('Morning run notes')
    expect(call.files[0].content).toContain('status: RESOLVED')
    expect(call.files[0].content).toContain(TEST_THREAD_KEY)
    expect(call.branch).toBe('main')
  })

  it('inserts FRAGMENT_IN_WIKI edge', async () => {
    const deps = makeDeps()
    const result = await handleLogFragment(
      deps,
      { content: 'Leg day', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    const parsed = JSON.parse(result.content[0].text)
    const edgeRows = await db
      .select()
      .from(edgesTable)
      .where(eq(edgesTable.srcId, parsed.fragmentKey))
    expect(edgeRows).toHaveLength(1)
    expect(edgeRows[0].edgeType).toBe('FRAGMENT_IN_WIKI')
    expect(edgeRows[0].dstId).toBe(TEST_THREAD_KEY)
  })

  it('marks thread DIRTY after fragment insert', async () => {
    const deps = makeDeps()
    await handleLogFragment(
      deps,
      { content: 'Recovery session', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    const [thread] = await db
      .select()
      .from(threadsTable)
      .where(eq(threadsTable.lookupKey, TEST_THREAD_KEY))
    expect(thread.state).toBe('DIRTY')
  })

  it('uses provided title when given', async () => {
    const deps = makeDeps()
    await handleLogFragment(
      deps,
      {
        content: 'Details here',
        threadSlug: TEST_THREAD_SLUG,
        title: 'Custom Title',
      },
      testUserId
    )

    const rows = await db.select().from(fragmentsTable).where(eq(fragmentsTable.userId, testUserId))
    expect(rows[0].title).toBe('Custom Title')
  })

  it('derives title from first 80 chars when not provided', async () => {
    const deps = makeDeps()
    const longContent = 'A'.repeat(100) + ' trailing'
    await handleLogFragment(
      deps,
      { content: longContent, threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    const rows = await db.select().from(fragmentsTable).where(eq(fragmentsTable.userId, testUserId))
    expect(rows[0].title).toBe('A'.repeat(80))
  })

  it('persists tags on fragment row', async () => {
    const deps = makeDeps()
    await handleLogFragment(
      deps,
      {
        content: 'Tagged note',
        threadSlug: TEST_THREAD_SLUG,
        tags: ['fitness', 'running'],
      },
      testUserId
    )

    const rows = await db.select().from(fragmentsTable).where(eq(fragmentsTable.userId, testUserId))
    expect(rows[0].tags).toEqual(['fitness', 'running'])
  })

  it('inserts FRAGMENT_MENTIONS_PERSON edges when entity extraction finds people', async () => {
    const personKey = 'person01TESTPERSON00000000001'
    const deps = makeDeps({
      loadUserPeople: vi
        .fn()
        .mockResolvedValue([{ lookupKey: personKey, canonicalName: 'Marcus', aliases: [] }]),
      entityExtractCall: vi.fn().mockResolvedValue({
        people: [{ mention: 'Marcus', inferredName: 'Marcus', matchedKey: personKey }],
      }),
    })

    const result = await handleLogFragment(
      deps,
      { content: 'Marcus helped with form', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    const parsed = JSON.parse(result.content[0].text)
    const edgeRows = await db
      .select()
      .from(edgesTable)
      .where(eq(edgesTable.srcId, parsed.fragmentKey))
    const personEdge = edgeRows.find((e) => e.edgeType === 'FRAGMENT_MENTIONS_PERSON')
    expect(personEdge).toBeDefined()
    expect(personEdge!.dstId).toBe(personKey)
  })

  it('proceeds when entity extraction throws (fail-open)', async () => {
    const deps = makeDeps({
      entityExtractCall: vi.fn().mockRejectedValue(new Error('LLM down')),
    })

    const result = await handleLogFragment(
      deps,
      { content: 'Still works', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    expect(result.isError).toBeUndefined()
    const rows = await db.select().from(fragmentsTable).where(eq(fragmentsTable.userId, testUserId))
    expect(rows).toHaveLength(1)
    expect(rows[0].state).toBe('RESOLVED')
  })

  it('sets repoPath to empty string when gateway write fails', async () => {
    const deps = makeDeps({
      gatewayClient: {
        batchWrite: vi.fn().mockRejectedValue(new Error('gateway down')),
      } as unknown as McpServerDeps['gatewayClient'],
    })

    const result = await handleLogFragment(
      deps,
      { content: 'Content here', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    expect(result.isError).toBeUndefined()
    const rows = await db.select().from(fragmentsTable).where(eq(fragmentsTable.userId, testUserId))
    expect(rows[0].repoPath).toBe('')
  })

  it('returns error when threadSlug not found', async () => {
    const deps = makeDeps()
    const result = await handleLogFragment(
      deps,
      { content: 'Lost fragment', threadSlug: 'nonexistent-thread' },
      testUserId
    )

    expect(result.isError).toBe(true)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.error).toContain('nonexistent-thread')
    expect(parsed.suggestions).toBeDefined()
  })

  it('returns error when userId is undefined', async () => {
    const deps = makeDeps()
    const result = await handleLogFragment(
      deps,
      { content: 'Hello', threadSlug: TEST_THREAD_SLUG },
      undefined
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not authenticated')
  })

  it('returns error when content is empty', async () => {
    const deps = makeDeps()
    const result = await handleLogFragment(
      deps,
      { content: '', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('content is required')
  })

  it('returns error when threadSlug is empty', async () => {
    const deps = makeDeps()
    const result = await handleLogFragment(
      deps,
      { content: 'Some content', threadSlug: '' },
      testUserId
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('threadSlug is required')
  })

  it('inserts new person rows when entity extraction finds unknown people', async () => {
    const deps = makeDeps({
      entityExtractCall: vi.fn().mockResolvedValue({
        people: [{ mention: 'Sarah', inferredName: 'Sarah Connor' }],
      }),
    })

    const result = await handleLogFragment(
      deps,
      { content: 'Trained with Sarah', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    expect(result.isError).toBeUndefined()
    const personRows = await db.select().from(peopleTable).where(eq(peopleTable.userId, testUserId))
    expect(personRows).toHaveLength(1)
    expect(personRows[0].name).toBe('Sarah Connor')
    expect(personRows[0].state).toBe('RESOLVED')
  })

  it('frontmatter omits entryKey field', async () => {
    const deps = makeDeps()
    await handleLogFragment(
      deps,
      { content: 'No entry parent', threadSlug: TEST_THREAD_SLUG },
      testUserId
    )

    const call = (deps.gatewayClient.batchWrite as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.files[0].content).not.toContain('entryKey')
  })
})
