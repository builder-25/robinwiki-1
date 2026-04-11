import { describe, it, expect, vi } from 'vitest'
import { CasLock, type LockedRow } from '../src/cas-lock.js'
import { widgets, makeMockDb } from './helpers.js'

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

function makeFakeLock(): LockedRow<unknown> {
  return {
    lookup_key: 'k1',
    state: 'LINKING',
    locked_by: 'worker-1',
    locked_at: new Date(),
    payload: 'x',
    __lockMeta: {
      key: 'k1',
      lockedBy: 'worker-1',
      lockedAt: new Date(),
      acquiredAt: new Date(),
    },
  } as LockedRow<unknown>
}

describe('CasLock.release', () => {
  it('writes target state, clears lock fields, emits released', async () => {
    const { db, execute, calls } = makeMockDb([[]])
    const lock = makeLock(db)
    const onReleased = vi.fn()
    lock.on('released', onReleased)

    await lock.release(makeFakeLock(), { toState: 'RESOLVED' })

    expect(execute).toHaveBeenCalledOnce()
    const sql = calls[0].rendered.sql
    expect(sql).toContain('UPDATE "widgets"')
    expect(sql).toContain('"state"')
    expect(sql).toContain('"locked_by" = NULL')
    expect(sql).toContain('"locked_at" = NULL')
    expect(sql).toContain('updated_at = NOW()')
    expect(calls[0].rendered.params).toContain('RESOLVED')
    expect(calls[0].rendered.params).toContain('k1')
    expect(onReleased).toHaveBeenCalledWith({ key: 'k1', toState: 'RESOLVED' })
  })

  it('emits error and rethrows on db failure', async () => {
    const { db, execute } = makeMockDb()
    execute.mockRejectedValueOnce(new Error('db down'))
    const lock = makeLock(db)
    const onError = vi.fn()
    lock.on('error', onError)

    await expect(lock.release(makeFakeLock(), { toState: 'RESOLVED' })).rejects.toThrow('db down')
    expect(onError).toHaveBeenCalled()
  })
})
