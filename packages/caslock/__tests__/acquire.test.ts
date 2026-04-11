import { describe, it, expect, vi } from 'vitest'
import { CasLock } from '../src/cas-lock.js'
import { widgets, makeMockDb, rowResult } from './helpers.js'

function makeLock(db: ReturnType<typeof makeMockDb>['db']) {
  return new CasLock({
    db,
    table: widgets,
    keyColumn: 'lookup_key',
    stateColumn: 'state',
    lockedByColumn: 'locked_by',
    lockedAtColumn: 'locked_at',
    lockTtlMs: 30_000,
  })
}

describe('CasLock.acquire', () => {
  it('returns a LockedRow on success and emits acquired', async () => {
    const lockedAt = new Date('2026-01-01T00:00:00Z')
    const { db, execute, calls } = makeMockDb([
      rowResult([
        {
          lookup_key: 'k1',
          state: 'LINKING',
          locked_by: 'worker-1',
          locked_at: lockedAt,
          updated_at: lockedAt,
          payload: 'hello',
          prev_locked_by: null,
        },
      ]),
    ])
    const lock = makeLock(db)
    const onAcquired = vi.fn()
    lock.on('acquired', onAcquired)

    const result = await lock.acquire({
      key: 'k1',
      fromState: 'PENDING',
      toState: 'LINKING',
      lockedBy: 'worker-1',
    })

    expect(execute).toHaveBeenCalledOnce()
    expect(result).not.toBeNull()
    expect(result?.__lockMeta).toEqual({
      key: 'k1',
      lockedBy: 'worker-1',
      lockedAt,
      acquiredAt: expect.any(Date),
    })
    expect((result as Record<string, unknown>).payload).toBe('hello')
    expect((result as Record<string, unknown>).prev_locked_by).toBeUndefined()
    expect(onAcquired).toHaveBeenCalledWith({
      key: 'k1',
      lockedBy: 'worker-1',
      fromState: 'PENDING',
      toState: 'LINKING',
    })

    const sql = calls[0].rendered.sql
    expect(sql).toContain('UPDATE "widgets"')
    expect(sql).toContain('"state"')
    expect(sql).toContain('"locked_by"')
    expect(sql).toContain('"locked_at"')
    expect(sql).toContain('NOW() - INTERVAL')
    expect(sql).toContain("'30 seconds'")
    expect(sql.toLowerCase()).toContain('returning')
    expect(calls[0].rendered.params).toContain('LINKING')
    expect(calls[0].rendered.params).toContain('worker-1')
    expect(calls[0].rendered.params).toContain('k1')
    expect(calls[0].rendered.params).toContain('PENDING')
  })

  it('emits stolen and returns row when prev_locked_by differs', async () => {
    const { db } = makeMockDb([
      rowResult([
        {
          lookup_key: 'k2',
          state: 'LINKING',
          locked_by: 'worker-new',
          locked_at: new Date(),
          updated_at: new Date(),
          prev_locked_by: 'worker-dead',
        },
      ]),
    ])
    const lock = makeLock(db)
    const onStolen = vi.fn()
    lock.on('stolen', onStolen)

    const result = await lock.acquire({
      key: 'k2',
      fromState: 'PENDING',
      toState: 'LINKING',
      lockedBy: 'worker-new',
    })

    expect(result).not.toBeNull()
    expect(onStolen).toHaveBeenCalledWith({
      key: 'k2',
      prevLockedBy: 'worker-dead',
      lockedBy: 'worker-new',
    })
  })

  it('does not emit stolen when prev_locked_by equals current lockedBy', async () => {
    const { db } = makeMockDb([
      rowResult([
        {
          lookup_key: 'k3',
          state: 'LINKING',
          locked_by: 'worker-1',
          locked_at: new Date(),
          updated_at: new Date(),
          prev_locked_by: 'worker-1',
        },
      ]),
    ])
    const lock = makeLock(db)
    const onStolen = vi.fn()
    lock.on('stolen', onStolen)

    await lock.acquire({
      key: 'k3',
      fromState: 'PENDING',
      toState: 'LINKING',
      lockedBy: 'worker-1',
    })

    expect(onStolen).not.toHaveBeenCalled()
  })

  it('emits error and rethrows when db.execute rejects', async () => {
    const { db, execute } = makeMockDb()
    execute.mockRejectedValueOnce(new Error('boom'))
    const lock = makeLock(db)
    const onError = vi.fn()
    lock.on('error', onError)

    await expect(
      lock.acquire({
        key: 'k4',
        fromState: 'PENDING',
        toState: 'LINKING',
        lockedBy: 'worker-1',
      })
    ).rejects.toThrow('boom')

    expect(onError).toHaveBeenCalled()
  })
})
