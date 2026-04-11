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

function acquireRow(extra: Record<string, unknown> = {}) {
  return rowResult([
    {
      lookup_key: 'k1',
      state: 'LINKING',
      locked_by: 'worker-1',
      locked_at: new Date(),
      updated_at: new Date(),
      prev_locked_by: null,
      ...extra,
    },
  ])
}

describe('CasLock.using', () => {
  it('runs routine, releases with successState on success', async () => {
    const { db, execute } = makeMockDb([acquireRow(), []])
    const lock = makeLock(db)
    const released: unknown[] = []
    lock.on('released', (e) => released.push(e))

    const routine = vi.fn(async (locked: { __lockMeta: { key: string } }) => {
      expect(locked.__lockMeta.key).toBe('k1')
      return 'done'
    })

    const result = await lock.using(
      {
        key: 'k1',
        fromState: 'PENDING',
        toState: 'LINKING',
        successState: 'RESOLVED',
        failureState: 'PENDING',
        lockedBy: 'worker-1',
      },
      routine
    )

    expect(result).toBe('done')
    expect(routine).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledTimes(2)
    expect(released).toEqual([{ key: 'k1', toState: 'RESOLVED' }])
  })

  it('releases with failureState and rethrows on routine throw', async () => {
    const { db, execute } = makeMockDb([acquireRow(), []])
    const lock = makeLock(db)
    const released: unknown[] = []
    lock.on('released', (e) => released.push(e))

    await expect(
      lock.using(
        {
          key: 'k1',
          fromState: 'PENDING',
          toState: 'LINKING',
          successState: 'RESOLVED',
          failureState: 'PENDING',
          lockedBy: 'worker-1',
        },
        async () => {
          throw new Error('routine failed')
        }
      )
    ).rejects.toThrow('routine failed')

    expect(execute).toHaveBeenCalledTimes(2)
    expect(released).toEqual([{ key: 'k1', toState: 'PENDING' }])
  })

  it('throws "CasLock contended" when acquire returns null', async () => {
    const { db } = makeMockDb([rowResult([])])
    const lock = makeLock(db)
    const routine = vi.fn()

    await expect(
      lock.using(
        {
          key: 'kZ',
          fromState: 'PENDING',
          toState: 'LINKING',
          successState: 'RESOLVED',
          failureState: 'PENDING',
          lockedBy: 'worker-1',
        },
        routine
      )
    ).rejects.toThrow('CasLock contended: kZ')

    expect(routine).not.toHaveBeenCalled()
  })
})
