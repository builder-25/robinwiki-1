import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CasLock } from '../src/cas-lock.js'
import { widgets, makeMockDb, rowResult } from './helpers.js'

function makeLock(db: ReturnType<typeof makeMockDb>['db'], lockTtlMs = 30_000) {
  return new CasLock({
    db,
    table: widgets,
    keyColumn: 'lookup_key',
    stateColumn: 'state',
    lockedByColumn: 'locked_by',
    lockedAtColumn: 'locked_at',
    lockTtlMs,
  })
}

function acquireRow() {
  return rowResult([
    {
      lookup_key: 'k1',
      state: 'LINKING',
      locked_by: 'worker-1',
      locked_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
      prev_locked_by: null,
    },
  ])
}

function renewRow() {
  return rowResult([{ locked_at: new Date('2026-01-01T00:00:30Z') }])
}

describe('CasLock.using auto-renew', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renews at 80% of lockTtlMs and emits renewed', async () => {
    const ttl = 1000
    // sequence: acquire, renew, renew, release
    const { db, execute } = makeMockDb([acquireRow(), renewRow(), renewRow(), []])
    const lock = makeLock(db, ttl)
    const renewed: unknown[] = []
    lock.on('renewed', (e) => renewed.push(e))

    let resolveRoutine!: (v: string) => void
    const routinePromise = new Promise<string>((resolve) => {
      resolveRoutine = resolve
    })

    const usingPromise = lock.using(
      {
        key: 'k1',
        fromState: 'PENDING',
        toState: 'LINKING',
        successState: 'RESOLVED',
        failureState: 'PENDING',
        lockedBy: 'worker-1',
        autoRenew: true,
      },
      () => routinePromise
    )

    // wait for acquire microtask
    await vi.advanceTimersByTimeAsync(0)
    expect(execute).toHaveBeenCalledTimes(1)

    // first renew at 800ms
    await vi.advanceTimersByTimeAsync(800)
    expect(execute).toHaveBeenCalledTimes(2)
    expect(renewed).toHaveLength(1)

    // second renew at 1600ms
    await vi.advanceTimersByTimeAsync(800)
    expect(execute).toHaveBeenCalledTimes(3)
    expect(renewed).toHaveLength(2)

    resolveRoutine('done')
    const result = await usingPromise
    expect(result).toBe('done')
    // release call also fired
    expect(execute).toHaveBeenCalledTimes(4)
  })

  it('clears renew timer on routine throw', async () => {
    const ttl = 1000
    const { db, execute } = makeMockDb([acquireRow(), renewRow(), []])
    const lock = makeLock(db, ttl)

    const usingPromise = lock.using(
      {
        key: 'k1',
        fromState: 'PENDING',
        toState: 'LINKING',
        successState: 'RESOLVED',
        failureState: 'PENDING',
        lockedBy: 'worker-1',
        autoRenew: true,
      },
      async () => {
        throw new Error('boom')
      }
    )

    await expect(usingPromise).rejects.toThrow('boom')

    const callsAfterFailure = execute.mock.calls.length
    // advancing past several intervals must not fire any more execute calls
    await vi.advanceTimersByTimeAsync(5000)
    expect(execute.mock.calls.length).toBe(callsAfterFailure)
  })

  it('emits renewFailed when renew finds no row', async () => {
    const ttl = 1000
    // acquire, renew (returns empty), release
    const { db } = makeMockDb([acquireRow(), rowResult([]), []])
    const lock = makeLock(db, ttl)
    const failures: unknown[] = []
    lock.on('renewFailed', (e) => failures.push(e))

    let resolveRoutine!: () => void
    const routinePromise = new Promise<void>((resolve) => {
      resolveRoutine = resolve
    })

    const usingPromise = lock.using(
      {
        key: 'k1',
        fromState: 'PENDING',
        toState: 'LINKING',
        successState: 'RESOLVED',
        failureState: 'PENDING',
        lockedBy: 'worker-1',
        autoRenew: true,
      },
      () => routinePromise
    )

    await vi.advanceTimersByTimeAsync(800)
    expect(failures).toHaveLength(1)
    expect((failures[0] as { key: string }).key).toBe('k1')

    resolveRoutine()
    await usingPromise
  })
})
