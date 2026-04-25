# 97 — Failure Injection (OpenRouter Unreachable)

## What it proves
Booting core with a deliberately-invalid `OPENROUTER_API_KEY` produces the structured failure trail #150 added: `embedText` logs `[embeddings] request failed status=...`, the boot probe (`probeEmbeddingsOrRefuseWorkers`) classifies the result as `unreachable`, and `core/src/index.ts` emits the fatal "refusing to start ingest workers" log line containing the operator-action URL `https://openrouter.ai/settings/privacy`. The HTTP server (`/health`) stays up so non-ingest traffic keeps working, and `startWorkers()` is NOT invoked — the absence of the `'ingest workers started'` log line is the structural assertion that workers refused to launch.

This plan deliberately disrupts the running stack: it kills any core on `:3000`, boots a temporary core process with the bogus key, runs assertions against `/tmp/uat-97-boot.log`, then kills that core. Restoration of the production-style stack is left to the operator (see `## Notes`).

## Prerequisites
- Core checked out on a commit that includes #150 / #156 (`probeEmbeddingsOrRefuseWorkers` in `core/src/bootstrap/check-openrouter-key.ts`, fatal-with-URL log in `core/src/index.ts`).
- Postgres + Redis running and reachable via `core/.env`. Existing DB state is fine — this plan does not touch data.
- `INITIAL_USERNAME` / `INITIAL_PASSWORD` set in `core/.env` (only used to verify `/health` semantics, not for sign-in).
- No other agent is using port 3000 — this plan owns it for the duration.

## Fixture identity this plan references
- Boot log artifact: `/tmp/uat-97-boot.log` (overwritten each run).
- Bogus key: `sk-or-v1-uat-bogus-key` — a syntactically-plausible but non-existent OpenRouter key. NOT empty-string; an empty key triggers the `'no-key'` probe branch which lets workers start anyway, defeating the test.

---

## Test Steps

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "${PROJECT_ROOT:-/home/me/apps/robin}"
source core/.env 2>/dev/null || true

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp /tmp/uat-cookies-97-XXXXXX.txt)
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  ⊘ $1"; }

echo "97 — Failure Injection (OpenRouter Unreachable)"
echo ""

BOOT_LOG=/tmp/uat-97-boot.log
: > "$BOOT_LOG"

# ── 0. Free port 3000 ────────────────────────────────────────
# This plan owns :3000 for its run. Any existing tsx-watch'd core
# process must die before we boot the bogus-key variant, otherwise
# our log assertions will be against the wrong process.
# Kill the tsx watch wrappers AND any node process serving src/index.ts.
# tsx-watch spawns a plain `node` worker whose argv is `node ... src/index.ts`
# — `tsx watch` only matches the parent wrapper, not the worker holding :3000.
pkill -9 -f 'tsx watch.*src/index' 2>/dev/null || true
pkill -9 -f 'node.*src/index\.ts' 2>/dev/null || true
sleep 3

if ss -tlnp 2>/dev/null | grep -q ':3000 '; then
  fail "0. port 3000 still bound after pkill — cannot proceed"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 1
else
  pass "0. port 3000 free; ready to boot bogus-key core"
fi

# ── 1. Boot core with deliberately-invalid OpenRouter key ────
# `sk-or-v1-uat-bogus-key` is syntactically valid (so the probe
# attempts a real HTTP call) but non-existent (so OpenRouter
# returns a 4xx). That drives `probeEmbeddingsOrRefuseWorkers`
# into the `'unreachable'` branch — the exact path #150 added.
#
# Empty-string would route to `'no-key'` and workers would START
# anyway. Don't change this key without re-reading
# core/src/bootstrap/check-openrouter-key.ts.
OPENROUTER_API_KEY=sk-or-v1-uat-bogus-key \
  setsid nohup pnpm --filter @robin/core dev \
  > "$BOOT_LOG" 2>&1 < /dev/null &
BOOT_PID=$!
disown $BOOT_PID 2>/dev/null || true

pass "1. spawned core with bogus key (pid=$BOOT_PID, log=$BOOT_LOG)"

# ── 2. Wait up to 90s for /health to respond ─────────────────
# The probe runs early in boot. Once it finishes (success or
# `unreachable`), the HTTP server is mounted and /health goes
# live. /health is the unauthenticated probe in core/src/index.ts.
HEALTH_OK=0
for i in $(seq 1 45); do
  sleep 2
  if curl -sf "$SERVER_URL/health" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
done

if [ "$HEALTH_OK" = "1" ]; then
  pass "2. /health responded within 90s — HTTP server stayed up despite probe failure"
else
  fail "2. /health never responded within 90s — boot may have crashed"
  echo "    last 30 log lines:"
  tail -30 "$BOOT_LOG" | sed 's/^/    /'
  # Kill the tsx watch wrappers AND any node process serving src/index.ts.
# tsx-watch spawns a plain `node` worker whose argv is `node ... src/index.ts`
# — `tsx watch` only matches the parent wrapper, not the worker holding :3000.
pkill -9 -f 'tsx watch.*src/index' 2>/dev/null || true
pkill -9 -f 'node.*src/index\.ts' 2>/dev/null || true
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 1
fi

# ── 3. /health returns 200 + JSON ────────────────────────────
# Beyond reachability, the body must parse as JSON with a status
# field — confirms the route handler ran, not just a TCP accept.
HEALTH_BODY=$(curl -s "$SERVER_URL/health")
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/health")

if [ "$HEALTH_CODE" = "200" ]; then
  pass "3a. /health returns 200"
else
  fail "3a. /health returned $HEALTH_CODE (expected 200)"
fi

if echo "$HEALTH_BODY" | jq -e '.status' >/dev/null 2>&1; then
  pass "3b. /health body has .status field"
else
  fail "3b. /health body did not parse as JSON with .status"
fi

# ── 4. Boot log carries the structured failure trail ─────────
# Three independent log lines, each from a different layer:
#   4a. embedText (packages/agent/src/embeddings.ts) — request-level
#   4b. core/src/index.ts — fatal probe-classification line
#   4c. same fatal line — must include the operator-action URL
# All three must appear. Missing any one means the observability
# story #150 wired is broken at that layer.
#
# The probe issues an `embedText('ping', …)` call internally;
# OpenRouter returns 4xx for the bogus key, so embedText logs
# its `[embeddings] request failed status=` line first, then the
# probe maps that to `unreachable` and core/src/index.ts emits
# the fatal log with the privacy-page URL.

# Give the probe a few extra seconds to finish if /health came up
# before the probe wrote its line (the probe is `await`ed before
# startWorkers() so this is belt-and-suspenders).
sleep 5

if grep -q '\[embeddings\] request failed status=' "$BOOT_LOG"; then
  pass "4a. embedText logged structured request failure"
else
  fail "4a. boot log missing '[embeddings] request failed status=' line"
fi

if grep -q 'refusing to start ingest workers' "$BOOT_LOG"; then
  pass "4b. probe classified result as unreachable; fatal log emitted"
else
  fail "4b. boot log missing 'refusing to start ingest workers' line"
fi

if grep -q 'openrouter.ai/settings/privacy' "$BOOT_LOG"; then
  pass "4c. fatal log includes operator-action URL (openrouter.ai/settings/privacy)"
else
  fail "4c. boot log missing operator-action URL — operator has no remediation hint"
fi

# ── 5. Ingest workers did NOT start ──────────────────────────
# `startWorkers()` in core/src/queue/worker.ts logs the literal
# string 'ingest workers started' once when it runs. On the
# unreachable branch, core/src/index.ts skips the `startWorkers()`
# call entirely. Absence of that line is therefore the strongest
# structural signal that workers refused to launch.
#
# We do NOT probe BullBoard's internal /admin/queues/api/queues/...
# JSON shape — that's an undocumented bull-board-hono surface and
# brittle across versions. The log-absence assertion is the
# contract #150 actually wired.
if grep -q 'ingest workers started' "$BOOT_LOG"; then
  fail "5a. boot log contains 'ingest workers started' — startWorkers() ran despite unreachable probe"
else
  pass "5a. boot log lacks 'ingest workers started' — startWorkers() correctly skipped"
fi

# Negative pair: when workers DO start, individual workers each log
# a `${name} completed` line on the first job. None should appear
# here. If any do, a worker started despite the gate.
if grep -qE '(extraction|link|regen|provision) completed' "$BOOT_LOG"; then
  fail "5b. boot log contains worker-completion lines — a worker fired a job"
else
  pass "5b. boot log free of worker-completion lines (no worker fired a job)"
fi

# ── 6. Cleanup: kill the bogus-key core ──────────────────────
# Leave the system in a clean stoppable state. Restoring the
# production-style stack (real key + workers running) is the
# operator's next step — see ## Notes.
# Kill the tsx watch wrappers AND any node process serving src/index.ts.
# tsx-watch spawns a plain `node` worker whose argv is `node ... src/index.ts`
# — `tsx watch` only matches the parent wrapper, not the worker holding :3000.
pkill -9 -f 'tsx watch.*src/index' 2>/dev/null || true
pkill -9 -f 'node.*src/index\.ts' 2>/dev/null || true
sleep 3

if ss -tlnp 2>/dev/null | grep -q ':3000 '; then
  fail "6. port 3000 still bound after cleanup — bogus-key core may be leaked"
else
  pass "6. bogus-key core killed; port 3000 free"
fi

echo ""
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```

---

## Pass/Fail Summary

| # | Assertion | Source |
|---|-----------|--------|
| 0 | Port 3000 freed before injection boot | prerequisite |
| 1 | Bogus-key core spawned with `sk-or-v1-uat-bogus-key` | `core/src/bootstrap/check-openrouter-key.ts` |
| 2 | `/health` responds within 90s — HTTP server stays up | `core/src/index.ts:107` |
| 3 | `/health` returns 200 + JSON `.status` | `core/src/index.ts:107` |
| 4 | Boot log contains: `[embeddings] request failed status=`, `refusing to start ingest workers`, `openrouter.ai/settings/privacy` | `packages/agent/src/embeddings.ts`, `core/src/index.ts:199-206` |
| 5 | Boot log lacks `ingest workers started` and any `(extraction\|link\|regen\|provision) completed` line — `startWorkers()` was skipped | `core/src/queue/worker.ts:584` |
| 6 | Bogus-key core killed; port 3000 free | cleanup |

---

## Notes

- **This plan disrupts the stack on purpose.** Run it LAST in any sequence (`22 → 99 → 98 → 97`). After it exits, `:3000` is free and no core process is running. The operator restarts the production-style stack manually — UAT does not auto-boot it because the right configuration (real key, real env) is environment-specific and not the plan's concern.
- **Why the bogus key is a real-looking string, not empty.** `probeEmbeddingsOrRefuseWorkers` returns `'no-key'` when `OPENROUTER_API_KEY` is unset (loaded via `loadOpenRouterConfig` → throws `NoOpenRouterKeyError`). On `'no-key'`, `core/src/index.ts:208-216` calls `startWorkers()` anyway with a warn-level log. Only `'unreachable'` (key present, HTTP request fails) gates workers off — that's the path this plan tests.
- **The fatal-log substring `openrouter.ai/settings/privacy` is brittle to log-format changes.** It comes from the message argument in `core/src/index.ts:199-206`. If that copy is reworded, update assertion 4c. The substring is stable because it's the literal URL the operator needs to visit — changing it would itself be a regression of #150's intent.
- **`/health` (not `/api/health`).** The route is mounted at `/health` directly off `core/src/index.ts:107`. There is no `/api/health` alias. Don't introduce one — the other plans (`01-server-boot.md`, `99-endpoint-sweep.md`) all key off `/health`.
- **No BullBoard probing.** The original sketch suggested asserting on `/admin/queues/api/queues/extraction-queue`'s `workerCount`. That's an internal `bull-board-hono` surface with no contract — it's omitted in favor of the boot-log assertion at step 5, which keys off `core/src/queue/worker.ts:584`'s literal `'ingest workers started'` log line. If a future change moves the gate without updating that log, this plan fails noisily — which is what we want.
- **Restoration after this plan.** The operator runs `pnpm --filter @robin/core dev` (or whatever the harness uses) to bring core back up with the real key. This plan does NOT do that — booting the production-style stack with the right env is environment-specific and outside UAT's scope. The system is left in a clean stoppable state at exit.
- **Storage is Postgres-only for every surface this plan touches.** No filesystem markdown, no git-backed store — the failure path tested here is "embedding endpoint is unreachable, do not silently fill the DB with null-embedded rows."
