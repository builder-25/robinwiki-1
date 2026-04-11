# @robin/caslock

Compare-and-set row locking for Postgres tables, built on Drizzle.

`CasLock` turns a domain row into a short-lived lock by mutating its `state`
column atomically. It is designed for the "linker" pattern: a worker picks up
a row in `PENDING`, flips it to `LINKING` while it is busy, then writes the
final state (`RESOLVED` or back to `PENDING`) when it finishes. Crashes are
recovered automatically by a TTL — any other worker can steal a stale lock
once the TTL has elapsed.

## When to use this

Reach for CAS row-state locking when:

- You already have a row per work item with a `state` column.
- You want crash recovery without a separate lock table.
- You want to fail-open: if the worker dies, the row eventually becomes
  available again.
- Backpressure is naturally bounded by row count, not by a lock service.

## Alternatives

| Approach                              | When it fits                                        | Why CAS lock differs                                                            |
| ------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pg_advisory_xact_lock`               | Short critical sections inside one transaction.     | Dies with the transaction; no audit trail of who held the lock.                 |
| `SELECT ... FOR UPDATE SKIP LOCKED`   | Worker pools draining a queue table.                | No TTL, no row-state visibility, no recovery if the holder hangs without dying. |
| Redis/Redlock                         | Cross-service mutexes, no Postgres row.             | Adds infra; CAS keeps lock state in the same row as the data it guards.        |
| No locks, optimistic concurrency      | Read-mostly workloads, version-numbered writes.     | Doesn't fit "exactly one worker may run this stage at a time".                  |

## Schema requirements

The target table must expose four columns (names are configurable):

| Column           | Type                          | Purpose                          |
| ---------------- | ----------------------------- | -------------------------------- |
| key column       | unique (`text` or similar)    | Identifies the row to lock.      |
| state column     | `text` / enum                 | Holds the CAS state.             |
| locked_by column | `text NULL`                   | Worker identity holding the lock.|
| locked_at column | `timestamp NULL`              | Timestamp set on acquire/renew.  |

The table must also have an `updated_at timestamp` column. CasLock writes
`updated_at = NOW()` on every state mutation.

## Install

```sh
pnpm add @robin/caslock
```

`drizzle-orm` must already be installed by the host application — it is a
peer dependency.

## Usage

```ts
import { CasLock } from '@robin/caslock'
import { db } from './db/client'
import { fragments } from './db/schema'

const fragmentLock = new CasLock({
  db,
  table: fragments,
  keyColumn: 'lookup_key',
  stateColumn: 'state',
  lockedByColumn: 'locked_by',
  lockedAtColumn: 'locked_at',
  lockTtlMs: 30_000,
})

fragmentLock.on('stolen', ({ key, prevLockedBy }) => {
  log.warn({ key, prevLockedBy }, 'stole expired fragment lock')
})

await fragmentLock.using(
  {
    key: fragmentKey,
    fromState: 'PENDING',
    toState: 'LINKING',
    successState: 'RESOLVED',
    failureState: 'PENDING',
    lockedBy: workerId,
    autoRenew: true,
  },
  async (locked) => {
    // locked is a LockedRow<Fragment> — full row plus __lockMeta.
    await runLinker(locked)
  }
)
```

If a competing worker already holds the lock, `using()` rejects with
`Error('CasLock contended: <key>')`. Catch it at the call site if you want
to back off and retry; let it propagate to mark the job as failed.

## API

### `new CasLock(config)`

```ts
interface CasLockConfig<TTable extends PgTable> {
  db: NodePgDatabase<any>
  table: TTable
  keyColumn: string
  stateColumn: string
  lockedByColumn: string
  lockedAtColumn: string
  lockTtlMs: number
}
```

The TTL controls two things: how long after a crash the row stays
"unreachable", and how often `using({ autoRenew: true })` renews. The renew
interval is 80% of `lockTtlMs`.

### `acquire({ key, fromState, toState, lockedBy })`

Atomic CAS update. Returns the locked row or `null` on contention.
Succeeds when the current state equals `fromState`, **or** when the current
state equals `toState` but `locked_at` is older than the TTL (stale lock
recovery — emits `stolen`).

### `release(lock, { toState })`

Clears `locked_by` / `locked_at` and writes the new state. Always emits
`released`.

### `renew(lock)`

Refreshes `locked_at` only if the calling worker still owns the lock.
Returns `false` if the lock was stolen (and emits `renewFailed`).

### `using(params, routine)`

Sandwich helper. Acquires, runs `routine`, releases with `successState` on
success or `failureState` on throw, and rethrows. With `autoRenew: true`,
runs `renew()` on a timer at 80% of `lockTtlMs` for the duration of the
routine.

## Events

`CasLock` extends `EventEmitter`. All events are best-effort — they don't
affect control flow except `error`, which is also raised by callbacks.

| Event         | Payload                                          | When                                            |
| ------------- | ------------------------------------------------ | ----------------------------------------------- |
| `acquired`    | `{ key, lockedBy, fromState, toState }`          | After every successful `acquire()`.             |
| `stolen`      | `{ key, prevLockedBy, lockedBy }`                | When acquire takes over an expired lock.        |
| `contended`   | `{ key, fromState }`                             | When acquire returns `null`.                    |
| `released`    | `{ key, toState }`                               | After every successful `release()`.             |
| `renewed`     | `{ key, newExpiresAt }`                          | After every successful `renew()`.               |
| `renewFailed` | `{ key, reason }`                                | When renew sees the lock is gone or DB errors.  |
| `error`       | `Error`                                          | DB error during acquire/release.                |

## Failure modes

See `docs/state-machine.md` for the full state diagram. The short version:

- **Worker crash mid-routine** — the row stays in `toState` with stale
  `locked_at`. The next worker that runs `acquire()` after `lockTtlMs`
  recovers it and emits `stolen`.
- **TTL expiry while running** — same as crash. Auto-renew exists exactly
  to prevent this for long-running routines.
- **Contention** — `acquire()` returns `null` and emits `contended`. The
  caller decides whether to retry, defer, or skip.
- **Renew failure** — emits `renewFailed`. The routine keeps running. Its
  next DB write that depends on the lock will fail and surface the loss.
