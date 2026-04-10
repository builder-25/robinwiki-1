import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { handleLogEntry, type McpServerDeps } from '../mcp/handlers.js'
import { entries as entriesTable, vaults } from '../db/schema.js'
import type { WriteJob } from '@robin/queue'
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
      batchWrite: vi.fn(),
    } as unknown as McpServerDeps['gatewayClient'],
    spawnWriteWorker: vi.fn(),
    resolveDefaultVaultId: vi.fn().mockResolvedValue(testVaultId),
    ...overrides,
  }
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
})

// ─── Tests ───

describe('handleLogEntry', () => {
  it('inserts entry row in PENDING state before enqueuing write job', async () => {
    const deps = makeDeps()
    const result = await handleLogEntry(deps, { content: 'Hello world' }, testUserId)

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('Entry queued: entry')

    // Verify entry row exists in DB
    const rows = await db.select().from(entriesTable).where(eq(entriesTable.userId, testUserId))
    expect(rows).toHaveLength(1)
    expect(rows[0].state).toBe('PENDING')
    expect(rows[0].content).toBe('Hello world')
    expect(rows[0].source).toBe('mcp')
    expect(rows[0].type).toBe('thought')
    expect(rows[0].title).toBe('Hello world')
    expect(rows[0].vaultId).toBe(testVaultId)

    // Verify enqueue was called after insert
    expect(deps.producer.enqueueWrite).toHaveBeenCalledTimes(1)
    const job = (deps.producer.enqueueWrite as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as WriteJob
    expect(job.payload.entryId).toBe(rows[0].lookupKey)
    expect(job.payload.rawEntry.content).toBe('Hello world')
    expect(job.payload.rawEntry.source).toBe('mcp')
  })

  it('writes verbatim note to git before inserting entry', async () => {
    const deps = makeDeps()
    await handleLogEntry(deps, { content: 'My note content' }, testUserId)

    expect(deps.gatewayClient.write).toHaveBeenCalledTimes(1)
    const writeCall = (deps.gatewayClient.write as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(writeCall.userId).toBe(testUserId)
    expect(writeCall.path).toMatch(/^var\/raw\/\d{4}-\d{2}-\d{2}-my-note-content\.entry.+\.md$/)
    expect(writeCall.content).toContain('My note content')
    expect(writeCall.content).toContain('source: mcp')
    expect(writeCall.branch).toBe('main')

    // Entry repoPath should reflect the note path
    const rows = await db.select().from(entriesTable).where(eq(entriesTable.userId, testUserId))
    expect(rows[0].repoPath).toMatch(/^var\/raw\//)
  })

  it('sets repoPath to empty string when git write fails (best-effort)', async () => {
    const deps = makeDeps({
      gatewayClient: {
        write: vi.fn().mockRejectedValue(new Error('gateway down')),
      } as unknown as McpServerDeps['gatewayClient'],
    })

    const result = await handleLogEntry(deps, { content: 'Content here' }, testUserId)

    expect(result.isError).toBeUndefined()
    const rows = await db.select().from(entriesTable).where(eq(entriesTable.userId, testUserId))
    expect(rows[0].repoPath).toBe('')

    // Job should still be enqueued
    expect(deps.producer.enqueueWrite).toHaveBeenCalledTimes(1)
    const job = (deps.producer.enqueueWrite as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as WriteJob
    expect(job.payload.noteFilePath).toBeUndefined()
  })

  it('includes noteFilePath in job payload when git write succeeds', async () => {
    const deps = makeDeps()
    await handleLogEntry(deps, { content: 'A note' }, testUserId)

    const job = (deps.producer.enqueueWrite as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as WriteJob
    expect(job.payload.noteFilePath).toMatch(/^var\/raw\//)
  })

  it('sets title from first 80 chars of content', async () => {
    const longContent = 'A'.repeat(100) + ' trailing text'
    const deps = makeDeps()
    await handleLogEntry(deps, { content: longContent }, testUserId)

    const rows = await db.select().from(entriesTable).where(eq(entriesTable.userId, testUserId))
    expect(rows[0].title).toBe('A'.repeat(80))
  })

  it('trims whitespace from content', async () => {
    const deps = makeDeps()
    await handleLogEntry(deps, { content: '  spaced content  ' }, testUserId)

    const rows = await db.select().from(entriesTable).where(eq(entriesTable.userId, testUserId))
    expect(rows[0].content).toBe('spaced content')
  })

  it('returns error for empty content', async () => {
    const deps = makeDeps()
    const result = await handleLogEntry(deps, { content: '' }, testUserId)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('content is required')
    expect(deps.producer.enqueueWrite).not.toHaveBeenCalled()
  })

  it('returns error for whitespace-only content', async () => {
    const deps = makeDeps()
    const result = await handleLogEntry(deps, { content: '   \n\t  ' }, testUserId)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('content is required')
  })

  it('returns error when userId is undefined', async () => {
    const deps = makeDeps()
    const result = await handleLogEntry(deps, { content: 'Hello' }, undefined)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not authenticated')
    expect(deps.producer.enqueueWrite).not.toHaveBeenCalled()
  })

  it('respects source parameter override', async () => {
    const deps = makeDeps()
    await handleLogEntry(deps, { content: 'From web', source: 'web' }, testUserId)

    const rows = await db.select().from(entriesTable).where(eq(entriesTable.userId, testUserId))
    expect(rows[0].source).toBe('web')

    const job = (deps.producer.enqueueWrite as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as WriteJob
    expect(job.payload.rawEntry.source).toBe('web')
  })

  it('defaults source to mcp when not specified', async () => {
    const deps = makeDeps()
    await handleLogEntry(deps, { content: 'No source' }, testUserId)

    const rows = await db.select().from(entriesTable).where(eq(entriesTable.userId, testUserId))
    expect(rows[0].source).toBe('mcp')
  })

  it('sets vaultId to null when no default vault exists', async () => {
    const deps = makeDeps({
      resolveDefaultVaultId: vi.fn().mockResolvedValue(null),
    })
    await handleLogEntry(deps, { content: 'No vault' }, testUserId)

    const rows = await db.select().from(entriesTable).where(eq(entriesTable.userId, testUserId))
    expect(rows[0].vaultId).toBeNull()
  })

  it('spawns write worker for the user', async () => {
    const deps = makeDeps()
    await handleLogEntry(deps, { content: 'Hello' }, testUserId)

    expect(deps.spawnWriteWorker).toHaveBeenCalledWith(testUserId)
  })

  it('disambiguates slug when a collision exists', async () => {
    // Insert an entry that will claim the slug 'hello'
    await db.insert(entriesTable).values({
      lookupKey: 'conflict-key',
      userId: testUserId,
      slug: 'hello',
      title: 'Hello',
      content: 'Hello',
      type: 'thought',
      source: 'mcp',
      repoPath: '',
    })

    // A second entry with the same content should get slug 'hello-2'
    const deps = makeDeps()
    const result = await handleLogEntry(deps, { content: 'Hello' }, testUserId)

    expect(result.isError).toBeUndefined()

    const rows = await db
      .select()
      .from(entriesTable)
      .where(eq(entriesTable.userId, testUserId))
    const slugs = rows.map((r) => r.slug).sort()
    expect(slugs).toContain('hello')
    expect(slugs).toContain('hello-2')
  })
})
