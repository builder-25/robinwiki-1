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

describe('CasLock contention', () => {
  it('returns null and emits contended when acquire matches no rows', async () => {
    const { db } = makeMockDb([rowResult([])])
    const lock = makeLock(db)
    const onContended = vi.fn()
    const onAcquired = vi.fn()
    lock.on('contended', onContended)
    lock.on('acquired', onAcquired)

    const result = await lock.acquire({
      key: 'k-busy',
      fromState: 'PENDING',
      toState: 'LINKING',
      lockedBy: 'worker-2',
    })

    expect(result).toBeNull()
    expect(onContended).toHaveBeenCalledWith({ key: 'k-busy', fromState: 'PENDING' })
    expect(onAcquired).not.toHaveBeenCalled()
  })

  it('handles { rows: [] } shape from node-postgres', async () => {
    const { db } = makeMockDb([{ rows: [] }])
    const lock = makeLock(db)
    const onContended = vi.fn()
    lock.on('contended', onContended)

    const result = await lock.acquire({
      key: 'k-busy',
      fromState: 'PENDING',
      toState: 'LINKING',
      lockedBy: 'worker-3',
    })

    expect(result).toBeNull()
    expect(onContended).toHaveBeenCalledOnce()
  })

  it('handles { rows: [...] } success shape from node-postgres', async () => {
    const { db } = makeMockDb([
      {
        rows: [
          {
            lookup_key: 'k-ok',
            state: 'LINKING',
            locked_by: 'worker-3',
            locked_at: new Date(),
            updated_at: new Date(),
            prev_locked_by: null,
          },
        ],
      },
    ])
    const lock = makeLock(db)

    const result = await lock.acquire({
      key: 'k-ok',
      fromState: 'PENDING',
      toState: 'LINKING',
      lockedBy: 'worker-3',
    })

    expect(result).not.toBeNull()
    expect(result?.__lockMeta.key).toBe('k-ok')
  })
})
