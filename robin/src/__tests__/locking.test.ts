import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import type postgres from 'postgres'
import { makeLookupKey, ObjectType } from '@robin/shared'
import { entries, fragments, threads, edges } from '../db/schema.js'
import {
  ensureTestDatabase,
  pushTestSchema,
  getTestDb,
  cleanupTestDb,
  createTestUser,
  createTestVault,
  clearTestData,
} from './test-setup.js'
import { acquireLock, releaseLock, canRebuildThread, LOCK_TTL_SECONDS } from '../db/locking.js'

let db: ReturnType<typeof getTestDb>['db']
let sqlConn: ReturnType<typeof postgres>
let testUserId: string
let testVaultId: string

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

afterEach(async () => {
  await clearTestData(db)
})

// ─── acquireLock ───

describe('acquireLock', () => {
  it('acquires lock on RESOLVED entry, sets state=LINKING with lockedBy and lockedAt', async () => {
    const key = makeLookupKey(ObjectType.ENTRY)
    await db.insert(entries).values({
      lookupKey: key,
      userId: testUserId,
      slug: `entry-${Date.now()}`,
      title: 'Lock Test',
      content: '',
      state: 'RESOLVED',
      vaultId: testVaultId,
    })

    const result = await acquireLock(db, 'entries', key, 'worker-1', 'RESOLVED')

    expect(result).not.toBeNull()
    expect(result?.state).toBe('LINKING')
    expect(result?.lockedBy).toBe('worker-1')
    expect(result?.lockedAt).toBeInstanceOf(Date)
  })

  it('returns null when entry is already LINKING (lock not expired)', async () => {
    const key = makeLookupKey(ObjectType.ENTRY)
    await db.insert(entries).values({
      lookupKey: key,
      userId: testUserId,
      slug: `entry-${Date.now()}`,
      title: 'Lock Test',
      content: '',
      state: 'RESOLVED',
      vaultId: testVaultId,
    })

    // First acquire succeeds
    await acquireLock(db, 'entries', key, 'worker-1', 'RESOLVED')

    // Second acquire should fail (lock is fresh)
    const result = await acquireLock(db, 'entries', key, 'worker-2', 'RESOLVED')
    expect(result).toBeNull()
  })

  it('steals expired lock (lockedAt older than 30s)', async () => {
    const key = makeLookupKey(ObjectType.ENTRY)
    await db.insert(entries).values({
      lookupKey: key,
      userId: testUserId,
      slug: `entry-${Date.now()}`,
      title: 'Lock Test',
      content: '',
      state: 'LINKING',
      lockedBy: 'dead-worker',
      lockedAt: new Date(Date.now() - 60_000), // 60s ago
      vaultId: testVaultId,
    })

    const result = await acquireLock(db, 'entries', key, 'worker-2', 'RESOLVED')

    expect(result).not.toBeNull()
    expect(result?.state).toBe('LINKING')
    expect(result?.lockedBy).toBe('worker-2')
  })

  it('works on fragments table', async () => {
    const entryKey = makeLookupKey(ObjectType.ENTRY)
    await db.insert(entries).values({
      lookupKey: entryKey,
      userId: testUserId,
      slug: `entry-${Date.now()}`,
      title: 'Parent',
      content: '',
      state: 'RESOLVED',
      vaultId: testVaultId,
    })

    const fragKey = makeLookupKey(ObjectType.FRAGMENT)
    await db.insert(fragments).values({
      lookupKey: fragKey,
      userId: testUserId,
      slug: `frag-${Date.now()}`,
      title: 'Frag Lock Test',
      state: 'RESOLVED',
      entryId: entryKey,
    })

    const result = await acquireLock(db, 'fragments', fragKey, 'worker-1', 'RESOLVED')
    expect(result).not.toBeNull()
    expect(result?.state).toBe('LINKING')
  })

  it('works on threads table', async () => {
    const key = makeLookupKey(ObjectType.THREAD)
    await db.insert(threads).values({
      lookupKey: key,
      userId: testUserId,
      slug: `thread-${Date.now()}`,
      name: 'Thread Lock Test',
      state: 'RESOLVED',
    })

    const result = await acquireLock(db, 'threads', key, 'worker-1', 'RESOLVED')
    expect(result).not.toBeNull()
    expect(result?.state).toBe('LINKING')
  })
})

// ─── releaseLock ───

describe('releaseLock', () => {
  it('releases lock and sets state to RESOLVED', async () => {
    const key = makeLookupKey(ObjectType.ENTRY)
    await db.insert(entries).values({
      lookupKey: key,
      userId: testUserId,
      slug: `entry-${Date.now()}`,
      title: 'Release Test',
      content: '',
      state: 'RESOLVED',
      vaultId: testVaultId,
    })

    await acquireLock(db, 'entries', key, 'worker-1', 'RESOLVED')
    await releaseLock(db, 'entries', key, 'RESOLVED')

    const [row] = await db.select().from(entries).where(eq(entries.lookupKey, key))
    expect(row.state).toBe('RESOLVED')
    expect(row.lockedBy).toBeNull()
    expect(row.lockedAt).toBeNull()
  })

  it('releases lock and sets state to DIRTY', async () => {
    const key = makeLookupKey(ObjectType.ENTRY)
    await db.insert(entries).values({
      lookupKey: key,
      userId: testUserId,
      slug: `entry-${Date.now()}`,
      title: 'Release Dirty Test',
      content: '',
      state: 'RESOLVED',
      vaultId: testVaultId,
    })

    await acquireLock(db, 'entries', key, 'worker-1', 'RESOLVED')
    await releaseLock(db, 'entries', key, 'DIRTY')

    const [row] = await db.select().from(entries).where(eq(entries.lookupKey, key))
    expect(row.state).toBe('DIRTY')
    expect(row.lockedBy).toBeNull()
    expect(row.lockedAt).toBeNull()
  })
})

// ─── canRebuildThread ───

describe('canRebuildThread', () => {
  it('returns false when a linked fragment is PENDING', async () => {
    const entryKey = makeLookupKey(ObjectType.ENTRY)
    await db.insert(entries).values({
      lookupKey: entryKey,
      userId: testUserId,
      slug: `entry-${Date.now()}`,
      title: 'Parent',
      content: '',
      vaultId: testVaultId,
    })

    const threadKey = makeLookupKey(ObjectType.THREAD)
    await db.insert(threads).values({
      lookupKey: threadKey,
      userId: testUserId,
      slug: `thread-${Date.now()}`,
      name: 'Rebuild Test',
      state: 'RESOLVED',
    })

    const fragKey = makeLookupKey(ObjectType.FRAGMENT)
    await db.insert(fragments).values({
      lookupKey: fragKey,
      userId: testUserId,
      slug: `frag-${Date.now()}`,
      title: 'Pending Frag',
      state: 'PENDING',
      entryId: entryKey,
    })

    await db.insert(edges).values({
      id: crypto.randomUUID(),
      userId: testUserId,
      srcType: 'frag',
      srcId: fragKey,
      dstType: 'thread',
      dstId: threadKey,
      edgeType: 'FRAGMENT_IN_THREAD',
    })

    const result = await canRebuildThread(db, threadKey)
    expect(result).toBe(false)
  })

  it('returns false when a linked fragment is LINKING', async () => {
    const entryKey = makeLookupKey(ObjectType.ENTRY)
    await db.insert(entries).values({
      lookupKey: entryKey,
      userId: testUserId,
      slug: `entry-${Date.now()}`,
      title: 'Parent',
      content: '',
      vaultId: testVaultId,
    })

    const threadKey = makeLookupKey(ObjectType.THREAD)
    await db.insert(threads).values({
      lookupKey: threadKey,
      userId: testUserId,
      slug: `thread-${Date.now()}`,
      name: 'Rebuild Test',
      state: 'RESOLVED',
    })

    const fragKey = makeLookupKey(ObjectType.FRAGMENT)
    await db.insert(fragments).values({
      lookupKey: fragKey,
      userId: testUserId,
      slug: `frag-${Date.now()}`,
      title: 'Linking Frag',
      state: 'LINKING',
      lockedBy: 'worker-1',
      lockedAt: new Date(),
      entryId: entryKey,
    })

    await db.insert(edges).values({
      id: crypto.randomUUID(),
      userId: testUserId,
      srcType: 'frag',
      srcId: fragKey,
      dstType: 'thread',
      dstId: threadKey,
      edgeType: 'FRAGMENT_IN_THREAD',
    })

    const result = await canRebuildThread(db, threadKey)
    expect(result).toBe(false)
  })

  it('returns true when all linked fragments are RESOLVED or DIRTY', async () => {
    const entryKey = makeLookupKey(ObjectType.ENTRY)
    await db.insert(entries).values({
      lookupKey: entryKey,
      userId: testUserId,
      slug: `entry-${Date.now()}`,
      title: 'Parent',
      content: '',
      vaultId: testVaultId,
    })

    const threadKey = makeLookupKey(ObjectType.THREAD)
    await db.insert(threads).values({
      lookupKey: threadKey,
      userId: testUserId,
      slug: `thread-${Date.now()}`,
      name: 'Rebuild Test',
      state: 'RESOLVED',
    })

    const fragKey1 = makeLookupKey(ObjectType.FRAGMENT)
    await db.insert(fragments).values({
      lookupKey: fragKey1,
      userId: testUserId,
      slug: `frag-resolved-${Date.now()}`,
      title: 'Resolved Frag',
      state: 'RESOLVED',
      entryId: entryKey,
    })

    const fragKey2 = makeLookupKey(ObjectType.FRAGMENT)
    await db.insert(fragments).values({
      lookupKey: fragKey2,
      userId: testUserId,
      slug: `frag-dirty-${Date.now()}`,
      title: 'Dirty Frag',
      state: 'DIRTY',
      entryId: entryKey,
    })

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
    ])

    const result = await canRebuildThread(db, threadKey)
    expect(result).toBe(true)
  })

  it('returns true when thread has no linked fragments', async () => {
    const threadKey = makeLookupKey(ObjectType.THREAD)
    await db.insert(threads).values({
      lookupKey: threadKey,
      userId: testUserId,
      slug: `thread-${Date.now()}`,
      name: 'Empty Thread',
      state: 'RESOLVED',
    })

    const result = await canRebuildThread(db, threadKey)
    expect(result).toBe(true)
  })
})

// ─── LOCK_TTL_SECONDS constant ───

describe('LOCK_TTL_SECONDS', () => {
  it('exports TTL constant of 30', () => {
    expect(LOCK_TTL_SECONDS).toBe(30)
  })
})
