# CasLock state machine

## Transitions

```
        acquire(fromState=PENDING, toState=LINKING)
PENDING ─────────────────────────────────────────────► LINKING
   ▲                                                     │
   │                                                     │
   │           release(toState=PENDING)                  │
   │  (failure path — fail-open back to retry queue)     │
   └─────────────────────────────────────────────────────┤
                                                         │
                       release(toState=RESOLVED)         ▼
                          (success path)             RESOLVED
```

`PENDING`, `LINKING`, and `RESOLVED` are example states from the Robin
ingest pipeline. The library doesn't know or care about the names — only
the host application defines them. CasLock just enforces an atomic CAS:
"this row must be in `fromState` (or stale in `toState`) for the update
to take effect."

## Sandwich pattern

The `using()` helper executes the canonical sandwich:

1. `acquire({ fromState, toState })` — flip into the working state.
2. Run the routine. Optionally `renew()` on a timer.
3. `release({ toState: successState | failureState })` — flip into the
   terminal state for this stage.

The shape is the same as a try/finally. The "success" and "failure" final
states are decoupled — failure can route back to `fromState` (retry),
forward to a parking state, or anywhere the host wants. CasLock just runs
the SQL.

## Why two terminal states

Every stage in the Robin pipeline has a happy path and a recoverable
failure path. Successful work moves the row forward. Failed work flips
the row back to its previous state so the worker can pick it up again.
This is fail-open by design: a failure must never strand a row in
`LINKING` forever, because the only way out of `LINKING` is either
`release()` or TTL expiry.

## Failure modes

### Worker crash mid-routine

The routine is running, has flipped the row to `LINKING`, then the worker
process dies. The row stays in `LINKING` with `locked_by = <dead worker>`
and `locked_at` frozen at acquire time.

After `lockTtlMs` has elapsed, any other worker calling `acquire()` will
see that `locked_at < NOW() - INTERVAL '<ttl> seconds'` and successfully
take the lock. The CAS update returns the previous `locked_by`, so
CasLock emits `stolen` and the new worker can log it.

### TTL expiry while running

A long-running routine without `autoRenew` can outlive its own TTL. The
row is now eligible for stealing. Two failure modes follow:

1. Another worker steals the lock and runs the same work twice.
2. The original worker eventually calls `release()`, but the WHERE clause
   in `release()` matches by key only — so it will overwrite whatever the
   thief did.

The fix is `autoRenew: true`. CasLock runs `renew()` at 80% of TTL, which
keeps `locked_at` fresh. `renew()` checks `locked_by = <self>`, so once
the lock has been stolen the renew fails, the host gets a `renewFailed`
event, and the routine's next DB write that depends on the row state
should fail and surface the loss.

### Contention

Two workers race to `acquire()` the same key. Postgres serializes the
two UPDATE statements. The losing UPDATE sees the row already in
`toState` with a fresh `locked_at`, fails the WHERE clause, and returns
zero rows. CasLock emits `contended` and `acquire()` returns `null`.

The caller chooses what to do — back off and retry, requeue with delay,
or skip. CasLock has no opinion.

### Renew DB error

A renew can fail because of a transient DB error or because the lock
was stolen. CasLock emits `renewFailed` with a `reason` string but
deliberately does **not** abort the routine. The routine is the source
of truth for whether its work succeeded. Killing the routine on a
transient renew failure would convert a one-off blip into guaranteed
work loss; letting the routine continue means the worst case is a
double-write that the next stage can deduplicate.
