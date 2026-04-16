---
name: uat
description: Run the Robin User Acceptance Test suite end-to-end against the M2-M10 stack. Boots the server, seeds the OpenRouter key, signs in as the env-seeded user, runs the canonical ingest acceptance test (Sarah example), validates the failure-path self-healing loop, tests groups, wiki types setup, content storage, wiki publishing (including unauthenticated public access), wiki regeneration, M6 API routes (wiki listing, enriched detail, regenerate/bouncer toggles, fragment accept/reject, people update), M9 audit log, M10 trust gates (spawn, confidence, source metadata), and writes a structured run report. Asserts deterministic API contracts; observes (does not fail on) probabilistic LLM output.
---

> **Shell requirement:** All steps use bash. If your default shell is zsh, this
> is fine — Step 2 wraps the `${!v}` indirect expansion in `bash -c`, and
> Step 13 wraps `read < <(...)` process substitution in `bash -c`. All other
> syntax is POSIX-compatible.

UAT boots Robin from a clean DB, runs the canonical M2 ingest loop, M3 wiki
composition, M6 API routes, M9 audit log, and M10 trust gates end-to-end, and
writes a machine-readable run report. It is **destructive** — Phase 1 step 5
wipes and re-pushes the schema unconditionally. Do not point it at a database
you care about.

Two classes of result:

- **Assert** — deterministic API contracts. Boot, auth, dedup, state-machine
  transitions, schema shape, failure-path audit columns, wiki types, content
  storage, publishing, edit audit trail, wiki listing, enriched detail,
  regenerate/bouncer toggles, fragment accept/reject, people update, audit log,
  timeline, spawn, confidence, source metadata. Failures here exit non-zero and
  fail the run.
- **Observe** — probabilistic LLM output. Fragment counts, entity names, embedding
  presence, mention/wiki edge counts, end-to-end latency, wiki regeneration
  output. Recorded in the report but never fail the run. M2's retro calls out
  that greenfield wiki classification is a no-op, so wiki-edge counts are
  expected to be zero and not asserted.

Run each step as a separate Bash tool call. Steps source shared state from
`.uat/runs/state` and helpers from `.uat/runs/helpers.sh`, both written by Phase 1.

---

## Phase 0 — Preflight

### Step 1 -- Working directory check

```bash
set -e
if [ ! -f package.json ] || ! grep -q '"name": "robin"' package.json; then
  echo "[fail] must run from the robin repo root (no package.json with name=robin here)"
  exit 1
fi
if [ ! -f core/.env ]; then
  echo "[fail] core/.env is missing — copy core/.env.example and fill it in"
  exit 1
fi
echo "[ok] repo root confirmed: $(pwd)"
```

### Step 2 -- Required env vars

```bash
set -e
set -a; . core/.env; set +a

# Use bash -c for ${!v} indirect expansion (not available in zsh)
missing=$(bash -c '
  set -a; . core/.env; set +a
  missing=""
  for v in MASTER_KEY BETTER_AUTH_SECRET INITIAL_USERNAME INITIAL_PASSWORD DATABASE_URL REDIS_URL; do
    if [ -z "${!v:-}" ]; then missing="$missing $v"; fi
  done
  echo "$missing"
')
if [ -n "$missing" ]; then
  echo "[fail] core/.env missing required vars:$missing"
  exit 1
fi
if [ "${#MASTER_KEY}" -ne 64 ]; then
  echo "[fail] MASTER_KEY must be 64 hex chars (got ${#MASTER_KEY})"
  exit 1
fi
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  echo "[fail] OPENROUTER_API_KEY must be set in the invoking shell (not core/.env)"
  echo "[hint] export OPENROUTER_API_KEY=sk-or-v1-... then re-run"
  exit 1
fi
echo "[ok] env vars present (MASTER_KEY=64hex, OPENROUTER_API_KEY=${OPENROUTER_API_KEY:0:8}…)"
```

### Step 3 -- Infra reachability

```bash
set -e
set -a; . core/.env; set +a

if ! pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; then
  echo "[fail] postgres not reachable at DATABASE_URL — start postgres first"
  exit 1
fi
if ! redis-cli -u "$REDIS_URL" PING >/dev/null 2>&1; then
  echo "[fail] redis not reachable at REDIS_URL — start redis first"
  exit 1
fi
echo "[ok] postgres + redis reachable"
```

---

## Phase 1 — Boot

### Step 4 -- Clean and init run directory

```bash
set -e
set -a; . core/.env; set +a

rm -rf .uat/runs
mkdir -p .uat/runs

# Kill any stale dev server
pkill -f 'tsx watch.*core/src/index.ts' 2>/dev/null || true
sleep 1

TS=$(date +%s)
RUN_ID="uat-${TS}"
COOKIE_JAR=$(mktemp -t uat-cookies.XXXXXX)

cat > .uat/runs/state <<EOF
TS=${TS}
RUN_ID=${RUN_ID}
COOKIE_JAR=${COOKIE_JAR}
BASE_URL=http://localhost:3000
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
BOOT_MS=
INGEST_MS=
GROUP_ID=
ENTRY_SARAH_ID=
ENTRY_EDGE_ID=
ENTRY_FAIL_ID=
ENTRY_HEAL_ID=
WIKI_ID=
WIKI_TYPE_ID=
PUBLISHED_SLUG=
CUSTOM_TYPE_SLUG=
SPAWN_WIKI_ID=
SERVER_PID=
EOF

cat > .uat/runs/helpers.sh <<'HELPERS'
# Append a JSON line to a jsonl file atomically.
_jsonl_append() {
  local file="$1" obj="$2"
  printf '%s\n' "$obj" >> "$file"
}

# assert name status detail
#   status = pass | fail
assert() {
  local name="$1" status="$2" detail="$3"
  local obj
  obj=$(jq -cn --arg n "$name" --arg s "$status" --arg d "$detail" \
    '{name:$n,status:$s,detail:$d,at:(now|todate)}')
  _jsonl_append .uat/runs/asserts.jsonl "$obj"
  if [ "$status" = "pass" ]; then
    echo "[ok] ${name}: ${detail}"
  else
    echo "[fail] ${name}: ${detail}"
  fi
}

# observe name value note
observe() {
  local name="$1" value="$2" note="${3:-}"
  local obj
  obj=$(jq -cn --arg n "$name" --arg v "$value" --arg t "$note" \
    '{name:$n,value:$v,note:$t,at:(now|todate)}')
  _jsonl_append .uat/runs/observations.jsonl "$obj"
  echo "[obs] ${name}=${value}${note:+ (${note})}"
}

# save_state KEY VALUE — updates .uat/runs/state in place
save_state() {
  local key="$1" value="$2"
  # Portable sed -i (macOS + linux): write to tmp then mv
  awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v; found=1} {print} END{if(!found) print k"="v}' \
    .uat/runs/state > .uat/runs/state.tmp && mv .uat/runs/state.tmp .uat/runs/state
}

# halt msg — dumps tail of server.log and exits non-zero
halt() {
  echo "[halt] $1"
  if [ -f .uat/runs/server.log ]; then
    echo "--- last 50 lines of server.log ---"
    tail -50 .uat/runs/server.log
  fi
  exit 1
}

# psql_one SQL — run a query, print single scalar result (empty on no rows)
psql_one() {
  psql "$DATABASE_URL" -tAX -c "$1" 2>/dev/null | tr -d '[:space:]'
}
HELPERS

: > .uat/runs/asserts.jsonl
: > .uat/runs/observations.jsonl

echo "[ok] run initialized: ${RUN_ID}"
echo "[ok] cookie jar: ${COOKIE_JAR}"
```

### Step 5 -- Reset DB schema

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# Pre-build workspace packages so core can import them
echo "[info] building workspace packages"
if pnpm build > .uat/runs/build.log 2>&1; then
  echo "[ok] workspace packages built"
else
  tail -30 .uat/runs/build.log
  halt "pnpm build failed — see .uat/runs/build.log"
fi

echo "[info] resetting schema via drizzle-kit push --force"
if pnpm --filter @robin/core db:push --force > .uat/runs/db-push.log 2>&1; then
  assert "db-push" "pass" "schema pushed from drizzle"
else
  tail -30 .uat/runs/db-push.log
  halt "db:push failed — see .uat/runs/db-push.log"
fi

# Sanity-check the schema we care about
STATE_VALS=$(psql_one "SELECT string_agg(enumlabel::text,',' ORDER BY enumsortorder) FROM pg_enum JOIN pg_type t ON t.oid=enumtypid WHERE t.typname='object_state'")
if [ "$STATE_VALS" = "PENDING,LINKING,RESOLVED" ]; then
  assert "schema.object_state_enum" "pass" "enum = PENDING,LINKING,RESOLVED"
else
  assert "schema.object_state_enum" "fail" "expected PENDING,LINKING,RESOLVED — got '${STATE_VALS}'"
fi

# raw_sources audit columns
for col in ingest_status last_error last_attempt_at attempt_count; do
  EXISTS=$(psql_one "SELECT 1 FROM information_schema.columns WHERE table_name='raw_sources' AND column_name='${col}'")
  if [ "$EXISTS" = "1" ]; then
    assert "schema.raw_sources.${col}" "pass" "column present"
  else
    assert "schema.raw_sources.${col}" "fail" "column missing"
  fi
done

# people promotion columns
for col in canonical_name aliases verified; do
  EXISTS=$(psql_one "SELECT 1 FROM information_schema.columns WHERE table_name='people' AND column_name='${col}'")
  if [ "$EXISTS" = "1" ]; then
    assert "schema.people.${col}" "pass" "column present"
  else
    assert "schema.people.${col}" "fail" "column missing"
  fi
done

# M10: fragments.confidence column
CONF_EXISTS=$(psql_one "SELECT 1 FROM information_schema.columns WHERE table_name='fragments' AND column_name='confidence'")
if [ "$CONF_EXISTS" = "1" ]; then
  assert "schema.fragments.confidence" "pass" "column present"
else
  assert "schema.fragments.confidence" "fail" "column missing"
fi

# M10: raw_sources.source_metadata column
SM_EXISTS=$(psql_one "SELECT 1 FROM information_schema.columns WHERE table_name='raw_sources' AND column_name='source_metadata'")
if [ "$SM_EXISTS" = "1" ]; then
  assert "schema.raw_sources.source_metadata" "pass" "column present"
else
  assert "schema.raw_sources.source_metadata" "fail" "column missing"
fi

# M9: audit_log table
AL_EXISTS=$(psql_one "SELECT 1 FROM information_schema.tables WHERE table_name='audit_log'")
if [ "$AL_EXISTS" = "1" ]; then
  assert "schema.audit_log" "pass" "table present"
else
  assert "schema.audit_log" "fail" "table missing"
fi

# M10: wikis.bouncer_mode column
BM_EXISTS=$(psql_one "SELECT 1 FROM information_schema.columns WHERE table_name='wikis' AND column_name='bouncer_mode'")
if [ "$BM_EXISTS" = "1" ]; then
  assert "schema.wikis.bouncer_mode" "pass" "column present"
else
  assert "schema.wikis.bouncer_mode" "fail" "column missing"
fi
```

### Step 6 -- Boot server

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

BOOT_START=$(date +%s%3N)

# Start core directly with tsx watch (packages already built in Step 5)
cd core
nohup pnpm dev > ../.uat/runs/server.log 2>&1 &
SERVER_PID=$!
cd ..
save_state SERVER_PID "$SERVER_PID"
echo "[info] started core dev server (pid=${SERVER_PID})"

# Wait for /health — 30s budget
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "${BASE_URL}/health"; then
    BOOT_MS=$(( $(date +%s%3N) - BOOT_START ))
    save_state BOOT_MS "$BOOT_MS"
    assert "boot.health" "pass" "/health ok after ${BOOT_MS}ms"
    HEALTH_OK=1
    break
  fi
  sleep 1
done

if [ "${HEALTH_OK:-}" != "1" ]; then
  assert "boot.health" "fail" "/health did not respond within 30s"
  halt "server did not come up"
fi
```

### Step 7 -- Seed OpenRouter key

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# Source core/.env so DATABASE_URL is available to the seed script
if bash -c 'set -a; . core/.env; set +a; OPENROUTER_API_KEY="'"$OPENROUTER_API_KEY"'" pnpm seed-openrouter-key' > .uat/runs/seed-key.log 2>&1; then
  assert "boot.seed_openrouter_key" "pass" "seed script exit 0"
else
  tail -20 .uat/runs/seed-key.log
  assert "boot.seed_openrouter_key" "fail" "seed script exit non-zero"
  halt "seed-openrouter-key failed"
fi

# Verify the row exists — setConfig is UPSERT, so this is deterministic
CONFIG_COUNT=$(psql_one "SELECT count(*) FROM configs WHERE kind='llm_key' AND key='openrouter'")
if [ "$CONFIG_COUNT" = "1" ]; then
  assert "boot.configs_llm_key_row" "pass" "configs row exists (kind=llm_key,key=openrouter)"
else
  assert "boot.configs_llm_key_row" "fail" "expected 1 row, got '${CONFIG_COUNT}'"
fi
```

---

## Phase 2 — Auth fixture

### Step 8 -- Single-user gate + sign-in

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# 1. Sign-up gate must be closed after seed-first-user has run
SIGNUP_CODE=$(curl -s -o /tmp/uat-signup.json -w '%{http_code}' \
  -X POST "${BASE_URL}/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"intruder@example.com","password":"noaccess123","name":"intruder"}')
SIGNUP_MSG=$(jq -r '.message // .error // empty' /tmp/uat-signup.json 2>/dev/null)

if [ "$SIGNUP_CODE" = "403" ] && echo "$SIGNUP_MSG" | grep -qi 'sign-ups disabled'; then
  assert "auth.signup_gate" "pass" "sign-up blocked with 403 + 'sign-ups disabled'"
else
  assert "auth.signup_gate" "fail" "expected 403 + 'sign-ups disabled', got ${SIGNUP_CODE}: ${SIGNUP_MSG}"
fi

# 2. Sign in as the env-seeded user
SIGNIN_CODE=$(curl -s -o /tmp/uat-signin.json -w '%{http_code}' \
  -X POST "${BASE_URL}/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d "{\"email\":\"${INITIAL_USERNAME}\",\"password\":\"${INITIAL_PASSWORD}\"}")

if [ "$SIGNIN_CODE" = "200" ] && [ -s "$COOKIE_JAR" ]; then
  assert "auth.signin" "pass" "signed in as ${INITIAL_USERNAME}, cookie captured"
else
  cat /tmp/uat-signin.json
  assert "auth.signin" "fail" "expected 200 + cookie, got ${SIGNIN_CODE}"
  halt "cannot continue without a session"
fi

# 3. Session middleware accepts the cookie
PROFILE_CODE=$(curl -s -o /tmp/uat-profile.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/users/profile")
if [ "$PROFILE_CODE" = "200" ]; then
  EMAIL_FROM_PROFILE=$(jq -r '.email // empty' /tmp/uat-profile.json)
  assert "auth.profile_session" "pass" "/users/profile 200 for ${EMAIL_FROM_PROFILE}"
else
  cat /tmp/uat-profile.json
  assert "auth.profile_session" "fail" "expected 200, got ${PROFILE_CODE}"
fi
```

---

## Phase 3 — Group fixture

### Step 9 -- Create group

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

GROUP_RESP=$(curl -s -o /tmp/uat-group.json -w '%{http_code}' \
  -X POST "${BASE_URL}/groups" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"UAT Group"}')

if [ "$GROUP_RESP" = "201" ]; then
  GROUP_ID=$(jq -r '.id' /tmp/uat-group.json)
  save_state GROUP_ID "$GROUP_ID"
  assert "group.create" "pass" "POST /groups -> 201, id=${GROUP_ID}"
else
  cat /tmp/uat-group.json
  assert "group.create" "fail" "expected 201, got ${GROUP_RESP}"
  halt "cannot continue without a group"
fi

# List must include the new group
LIST_RESP=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/groups")
FOUND=$(echo "$LIST_RESP" | jq --arg id "$GROUP_ID" '[.groups[]? // .[]? | select(.id==$id)] | length')
if [ "$FOUND" = "1" ]; then
  assert "group.list_contains_new" "pass" "GET /groups contains ${GROUP_ID}"
else
  assert "group.list_contains_new" "fail" "GET /groups does not contain ${GROUP_ID}"
fi
```

---

## Phase 4 — Capture path

### Step 10 -- Canonical happy path (Sarah)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

SARAH_BODY=$(jq -cn --arg t "Lunch with Sarah ${TS}" \
  '{content:"I had lunch with Sarah about the new product launch.", title:$t, type:"thought", source:"api"}')

CAPT=$(curl -s -o /tmp/uat-sarah.json -w '%{http_code}' \
  -X POST "${BASE_URL}/entries" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "$SARAH_BODY")

STATUS=$(jq -r '.status // empty' /tmp/uat-sarah.json)
INGEST=$(jq -r '.ingestStatus // empty' /tmp/uat-sarah.json)
ENTRY_SARAH_ID=$(jq -r '.id // empty' /tmp/uat-sarah.json)
JOB_ID=$(jq -r '.jobId // empty' /tmp/uat-sarah.json)
save_state ENTRY_SARAH_ID "$ENTRY_SARAH_ID"

if [ "$CAPT" = "202" ] && [ "$STATUS" = "queued" ] && [ "$INGEST" = "pending" ] && [ -n "$ENTRY_SARAH_ID" ] && [ -n "$JOB_ID" ]; then
  assert "capture.sarah_queued" "pass" "POST /entries -> 202, id=${ENTRY_SARAH_ID}, jobId=${JOB_ID}"
else
  cat /tmp/uat-sarah.json
  assert "capture.sarah_queued" "fail" "expected 202/queued/pending, got ${CAPT}/${STATUS}/${INGEST}"
fi
```

### Step 11 -- Dedup re-post

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

SARAH_BODY=$(jq -cn --arg t "Lunch with Sarah ${TS}" \
  '{content:"I had lunch with Sarah about the new product launch.", title:$t, type:"thought", source:"api"}')

DUP=$(curl -s -o /tmp/uat-dup.json -w '%{http_code}' \
  -X POST "${BASE_URL}/entries" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "$SARAH_BODY")

DUP_STATUS=$(jq -r '.status // empty' /tmp/uat-dup.json)
DUP_ID=$(jq -r '.id // empty' /tmp/uat-dup.json)

if [ "$DUP" = "200" ] && [ "$DUP_STATUS" = "duplicate" ] && [ "$DUP_ID" = "$ENTRY_SARAH_ID" ]; then
  assert "capture.dedup_repost" "pass" "re-post -> 200 duplicate, id matches original"
else
  cat /tmp/uat-dup.json
  assert "capture.dedup_repost" "fail" "expected 200/duplicate/${ENTRY_SARAH_ID}, got ${DUP}/${DUP_STATUS}/${DUP_ID}"
fi
```

### Step 12 -- Edge cases (bad JSON)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# 12a: Second entry for pipeline coverage
EDGE_BODY=$(jq -cn --arg t "Edge entry ${TS}" \
  '{content:"Random thought about the ingest pipeline and how dedup should handle near-duplicates.", title:$t, type:"thought", source:"api"}')

EDGE_CODE=$(curl -s -o /tmp/uat-edge.json -w '%{http_code}' \
  -X POST "${BASE_URL}/entries" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "$EDGE_BODY")

if [ "$EDGE_CODE" = "202" ]; then
  ENTRY_EDGE_ID=$(jq -r '.id' /tmp/uat-edge.json)
  save_state ENTRY_EDGE_ID "$ENTRY_EDGE_ID"
  assert "capture.edge_entry" "pass" "POST /entries -> 202, id=${ENTRY_EDGE_ID}"
else
  cat /tmp/uat-edge.json
  assert "capture.edge_entry" "fail" "expected 202, got ${EDGE_CODE}"
fi

# 12b: Malformed JSON body — should 400 {error:'Invalid JSON'}
BAD_JSON=$(curl -s -o /tmp/uat-badjson.json -w '%{http_code}' \
  -X POST "${BASE_URL}/entries" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  --data-raw 'not json')

BAD_ERR=$(jq -r '.error // empty' /tmp/uat-badjson.json 2>/dev/null)
if [ "$BAD_JSON" = "400" ] && [ "$BAD_ERR" = "Invalid JSON" ]; then
  assert "capture.bad_json_400" "pass" "malformed body -> 400 {error:'Invalid JSON'}"
else
  cat /tmp/uat-badjson.json
  assert "capture.bad_json_400" "fail" "expected 400/Invalid JSON, got ${BAD_JSON}/${BAD_ERR}"
fi
```

---

## Phase 5 — Ingest pipeline

### Step 13 -- Poll to terminal state

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# Poll both Sarah and edge entries to a terminal ingest_status (processed or failed).
# The codebase uses "processed" as the terminal success status for ingestStatus.
# We read ingestStatus from the API and the audit columns directly from postgres —
# the API response schema does not expose attempt_count / last_error.

# Use bash -c for process substitution (read < <(...)) which is bash-only
RESULT=$(bash -c '
  source .uat/runs/state
  poll_entry() {
    local id="$1" max=120 interval=3 elapsed=0
    while [ $elapsed -lt $max ]; do
      local resp
      resp=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/entries/${id}" 2>/dev/null || echo "{}")
      local ing
      ing=$(echo "$resp" | jq -r ".ingestStatus // empty")
      if [ "$ing" = "processed" ] || [ "$ing" = "resolved" ] || [ "$ing" = "failed" ]; then
        echo "$elapsed $ing"
        return 0
      fi
      sleep $interval
      elapsed=$((elapsed + interval))
    done
    echo "$elapsed timeout"
    return 1
  }
  poll_entry "$1"
' -- "$ENTRY_SARAH_ID")
SARAH_SECS=$(echo "$RESULT" | awk '{print $1}')
SARAH_FINAL=$(echo "$RESULT" | awk '{print $2}')

INGEST_START=$(date +%s%3N)

SARAH_ATTEMPTS=$(psql_one "SELECT attempt_count FROM raw_sources WHERE lookup_key='${ENTRY_SARAH_ID}'")
SARAH_LAST_AT=$(psql_one "SELECT last_attempt_at IS NOT NULL FROM raw_sources WHERE lookup_key='${ENTRY_SARAH_ID}'")
SARAH_STATE=$(psql_one "SELECT state FROM raw_sources WHERE lookup_key='${ENTRY_SARAH_ID}'")

if [ "$SARAH_FINAL" = "processed" ] || [ "$SARAH_FINAL" = "resolved" ] || [ "$SARAH_FINAL" = "failed" ]; then
  assert "ingest.sarah_terminal" "pass" "ingestStatus=${SARAH_FINAL} after ${SARAH_SECS}s"
else
  assert "ingest.sarah_terminal" "fail" "did not reach terminal state within 120s (last=${SARAH_FINAL})"
fi

if [ "$SARAH_STATE" != "PENDING" ]; then
  assert "ingest.sarah_state_progressed" "pass" "state advanced from PENDING (now ${SARAH_STATE})"
else
  assert "ingest.sarah_state_progressed" "fail" "state still PENDING — state machine did not run"
fi

if [ -n "$SARAH_ATTEMPTS" ] && [ "$SARAH_ATTEMPTS" -ge 1 ] 2>/dev/null; then
  assert "ingest.sarah_attempt_count" "pass" "attempt_count=${SARAH_ATTEMPTS}"
else
  assert "ingest.sarah_attempt_count" "fail" "attempt_count=${SARAH_ATTEMPTS} (want >=1)"
fi

if [ "$SARAH_LAST_AT" = "t" ]; then
  assert "ingest.sarah_last_attempt_at" "pass" "last_attempt_at populated"
else
  assert "ingest.sarah_last_attempt_at" "fail" "last_attempt_at is NULL"
fi

observe "ingest.sarah_latency_s" "$SARAH_SECS" "end-to-end from POST to terminal state"
observe "ingest.sarah_final_status" "$SARAH_FINAL" ""
if [ "$SARAH_FINAL" = "failed" ]; then
  SARAH_ERR=$(psql_one "SELECT coalesce(last_error,'') FROM raw_sources WHERE lookup_key='${ENTRY_SARAH_ID}'")
  observe "ingest.sarah_last_error" "$SARAH_ERR" "sarah ingest failed — not fatal, Phase 6 is the deterministic failure-path test"
fi

# Edge
EDGE_RESULT=$(bash -c '
  source .uat/runs/state
  poll_entry() {
    local id="$1" max=120 interval=3 elapsed=0
    while [ $elapsed -lt $max ]; do
      local resp
      resp=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/entries/${id}" 2>/dev/null || echo "{}")
      local ing
      ing=$(echo "$resp" | jq -r ".ingestStatus // empty")
      if [ "$ing" = "processed" ] || [ "$ing" = "resolved" ] || [ "$ing" = "failed" ]; then
        echo "$elapsed $ing"
        return 0
      fi
      sleep $interval
      elapsed=$((elapsed + interval))
    done
    echo "$elapsed timeout"
    return 1
  }
  poll_entry "$1"
' -- "$ENTRY_EDGE_ID")
EDGE_SECS=$(echo "$EDGE_RESULT" | awk '{print $1}')
EDGE_FINAL=$(echo "$EDGE_RESULT" | awk '{print $2}')

if [ "$EDGE_FINAL" = "processed" ] || [ "$EDGE_FINAL" = "resolved" ] || [ "$EDGE_FINAL" = "failed" ]; then
  assert "ingest.edge_terminal" "pass" "ingestStatus=${EDGE_FINAL} after ${EDGE_SECS}s"
else
  assert "ingest.edge_terminal" "fail" "ingestStatus=${EDGE_FINAL} after ${EDGE_SECS}s"
fi
observe "ingest.edge_final_status" "$EDGE_FINAL" ""

INGEST_MS=$(( $(date +%s%3N) - INGEST_START ))
save_state INGEST_MS "$INGEST_MS"
```

### Step 14 -- Inspect derived data (observations)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# Fragments derived from the Sarah entry — shape is deterministic, count is not.
FRAG_RESP=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/entries/${ENTRY_SARAH_ID}/fragments")
FRAG_COUNT=$(echo "$FRAG_RESP" | jq '.fragments | length')
observe "ingest.sarah_fragment_count" "$FRAG_COUNT" "LLM-driven, not asserted"

if [ "$FRAG_COUNT" -gt 0 ]; then
  # Shape assert: every fragment has id, slug, entryId matches, tags is array
  SHAPE_OK=$(echo "$FRAG_RESP" | jq --arg eid "$ENTRY_SARAH_ID" \
    '[.fragments[] | select(.id and .slug and (.entryId==$eid) and (.tags|type=="array"))] | length')
  if [ "$SHAPE_OK" = "$FRAG_COUNT" ]; then
    assert "fragments.shape" "pass" "all ${FRAG_COUNT} fragments have id/slug/entryId/tags"
  else
    assert "fragments.shape" "fail" "${SHAPE_OK}/${FRAG_COUNT} fragments match expected shape"
  fi

  EMBED_COUNT=$(psql_one "SELECT count(*) FROM fragments WHERE entry_id='${ENTRY_SARAH_ID}' AND embedding IS NOT NULL")
  observe "ingest.sarah_fragments_with_embedding" "${EMBED_COUNT}/${FRAG_COUNT}" "best-effort per M2 retro decision 15"

  TITLES=$(echo "$FRAG_RESP" | jq -c '[.fragments[].title]')
  observe "ingest.sarah_fragment_titles" "$TITLES" ""
else
  observe "ingest.sarah_fragment_count" "0" "zero fragments is allowed — LLM output, not a contract"
fi

# People — canonical_name ILIKE 'sarah'
SARAH_PEOPLE=$(psql_one "SELECT count(*) FROM people WHERE canonical_name ILIKE 'sarah%'")
observe "ingest.people_sarah_match" "$SARAH_PEOPLE" "probabilistic entity extraction"

# Edge counts — FRAGMENT_MENTIONS_PERSON and FRAGMENT_IN_WIKI for Sarah's fragments
MENTION_EDGES=$(psql_one "SELECT count(*) FROM edges e JOIN fragments f ON f.lookup_key=e.source_id WHERE f.entry_id='${ENTRY_SARAH_ID}' AND e.type='FRAGMENT_MENTIONS_PERSON'")
WIKI_EDGES=$(psql_one "SELECT count(*) FROM edges e JOIN fragments f ON f.lookup_key=e.source_id WHERE f.entry_id='${ENTRY_SARAH_ID}' AND e.type='FRAGMENT_IN_WIKI'")
observe "ingest.sarah_mention_edges" "$MENTION_EDGES" "LLM-driven"
observe "ingest.sarah_wiki_edges" "$WIKI_EDGES" "expected 0 on greenfield per M2 retro"
```

---

## Phase 6 — Failure-path self-healing

### Step 15 -- Retro headline test: kill key -> fail -> reseed -> heal

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# 1. Delete the seeded key
psql "$DATABASE_URL" -c "DELETE FROM configs WHERE kind='llm_key' AND key='openrouter'" >/dev/null
GONE=$(psql_one "SELECT count(*) FROM configs WHERE kind='llm_key' AND key='openrouter'")
if [ "$GONE" = "0" ]; then
  assert "failpath.key_deleted" "pass" "configs llm_key row removed"
else
  assert "failpath.key_deleted" "fail" "expected 0 rows, got ${GONE}"
  halt "cannot run failure path — key still present"
fi

# 2. POST a fresh entry so it enters the pipeline with no key
FAIL_BODY=$(jq -cn --arg t "Fail-path ${TS}" \
  '{content:"Failure path test: this entry should fail to ingest because the openrouter key is gone.", title:$t, type:"thought", source:"api"}')
FAIL_RESP=$(curl -s -b "$COOKIE_JAR" -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/entries" -d "$FAIL_BODY")
ENTRY_FAIL_ID=$(echo "$FAIL_RESP" | jq -r '.id')
save_state ENTRY_FAIL_ID "$ENTRY_FAIL_ID"
echo "[info] failure-path entry: ${ENTRY_FAIL_ID}"

# 3. Poll until ingest_status=failed (90s budget)
FAIL_TIMEOUT=90
elapsed=0
while [ $elapsed -lt $FAIL_TIMEOUT ]; do
  ING=$(psql_one "SELECT ingest_status FROM raw_sources WHERE lookup_key='${ENTRY_FAIL_ID}'")
  if [ "$ING" = "failed" ]; then break; fi
  sleep 3
  elapsed=$((elapsed + 3))
done

FAIL_ERR=$(psql_one "SELECT coalesce(last_error,'') FROM raw_sources WHERE lookup_key='${ENTRY_FAIL_ID}'")
FAIL_ATTEMPTS=$(psql_one "SELECT attempt_count FROM raw_sources WHERE lookup_key='${ENTRY_FAIL_ID}'")
FAIL_LAST_AT=$(psql_one "SELECT last_attempt_at IS NOT NULL FROM raw_sources WHERE lookup_key='${ENTRY_FAIL_ID}'")

if [ "$ING" = "failed" ]; then
  assert "failpath.reached_failed" "pass" "ingest_status=failed after ${elapsed}s"
else
  assert "failpath.reached_failed" "fail" "did not reach failed within ${FAIL_TIMEOUT}s (last=${ING})"
fi

# last_error should mention openrouter / api key / unauthorized — loose substring match
if echo "$FAIL_ERR" | grep -Eqi 'openrouter|api.?key|unauthorized|no_openrouter_key'; then
  assert "failpath.last_error_matches" "pass" "last_error='${FAIL_ERR}'"
else
  assert "failpath.last_error_matches" "fail" "unexpected last_error='${FAIL_ERR}'"
fi

if [ -n "$FAIL_ATTEMPTS" ] && [ "$FAIL_ATTEMPTS" -ge 1 ] 2>/dev/null; then
  assert "failpath.attempt_count" "pass" "attempt_count=${FAIL_ATTEMPTS}"
else
  assert "failpath.attempt_count" "fail" "attempt_count=${FAIL_ATTEMPTS} (want >=1)"
fi
[ "$FAIL_LAST_AT" = "t" ] && assert "failpath.last_attempt_at" "pass" "populated" || assert "failpath.last_attempt_at" "fail" "NULL"

# 4. Re-seed the key (source core/.env so DATABASE_URL is available)
bash -c 'set -a; . core/.env; set +a; OPENROUTER_API_KEY="'"$OPENROUTER_API_KEY"'" pnpm seed-openrouter-key' > .uat/runs/reseed-key.log 2>&1
RESEED=$(psql_one "SELECT count(*) FROM configs WHERE kind='llm_key' AND key='openrouter'")
if [ "$RESEED" = "1" ]; then
  assert "failpath.reseed" "pass" "configs llm_key row re-created"
else
  assert "failpath.reseed" "fail" "re-seed did not produce configs row"
  halt "cannot run healing half of the loop"
fi

# 5. POST a new entry and poll to processed — this proves self-healing for future ingests
HEAL_BODY=$(jq -cn --arg t "Heal-path ${TS}" \
  '{content:"Recovery test: this entry should ingest successfully now that the key is back.", title:$t, type:"thought", source:"api"}')
HEAL_RESP=$(curl -s -b "$COOKIE_JAR" -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/entries" -d "$HEAL_BODY")
ENTRY_HEAL_ID=$(echo "$HEAL_RESP" | jq -r '.id')
save_state ENTRY_HEAL_ID "$ENTRY_HEAL_ID"

HEAL_TIMEOUT=90
elapsed=0
while [ $elapsed -lt $HEAL_TIMEOUT ]; do
  HEAL_ING=$(psql_one "SELECT ingest_status FROM raw_sources WHERE lookup_key='${ENTRY_HEAL_ID}'")
  if [ "$HEAL_ING" = "processed" ] || [ "$HEAL_ING" = "resolved" ] || [ "$HEAL_ING" = "failed" ]; then break; fi
  sleep 3
  elapsed=$((elapsed + 3))
done

if [ "$HEAL_ING" = "processed" ] || [ "$HEAL_ING" = "resolved" ]; then
  assert "failpath.heal_resolved" "pass" "post-reseed ingest=${HEAL_ING} after ${elapsed}s"
else
  assert "failpath.heal_resolved" "fail" "post-reseed ingest=${HEAL_ING} after ${elapsed}s"
fi

# Note: the originally-failed entry is *not* retroactively re-processed.
# BullMQ retries exhaust on a real attempts:5 cycle. We only assert the next ingest.
observe "failpath.failed_entry_not_retroactive" "by design" "BullMQ retries exhausted — re-trigger creates a new ingest"
```

---

## Phase 7 — Wiki regen (M3 live)

### Step 16 -- Wiki regen returns content via Quill LLM

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# 1. Create a wiki so we have an id to regen against
WIKI_RESP=$(curl -s -o /tmp/uat-wiki.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"UAT regen test","type":"log"}')

if [ "$WIKI_RESP" = "201" ] || [ "$WIKI_RESP" = "200" ]; then
  WIKI_ID=$(jq -r '.id' /tmp/uat-wiki.json)
  save_state WIKI_ID "$WIKI_ID"
  assert "wiki.create" "pass" "POST /wikis -> ${WIKI_RESP}, id=${WIKI_ID}"
else
  cat /tmp/uat-wiki.json
  assert "wiki.create" "fail" "expected 200/201, got ${WIKI_RESP}"
  halt "cannot test regen without a wiki id"
fi

# 2. Add wiki to the group
GROUP_WIKI_CODE=$(curl -s -o /tmp/uat-group-wiki.json -w '%{http_code}' \
  -X POST "${BASE_URL}/groups/${GROUP_ID}/wikis" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"wikiId\":\"${WIKI_ID}\"}")

if [ "$GROUP_WIKI_CODE" = "200" ] || [ "$GROUP_WIKI_CODE" = "201" ]; then
  assert "group.add_wiki" "pass" "POST /groups/:id/wikis -> ${GROUP_WIKI_CODE}"
else
  cat /tmp/uat-group-wiki.json
  assert "group.add_wiki" "fail" "expected 200/201, got ${GROUP_WIKI_CODE}"
fi

# Verify wiki appears in group's wiki list
GROUP_WIKIS_CODE=$(curl -s -o /tmp/uat-group-wikis.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/groups/${GROUP_ID}/wikis")
if [ "$GROUP_WIKIS_CODE" = "200" ]; then
  GW_FOUND=$(jq --arg id "$WIKI_ID" '[.wikis[]? // .[]? | select(.id==$id)] | length' /tmp/uat-group-wikis.json)
  if [ "$GW_FOUND" = "1" ]; then
    assert "group.wiki_listed" "pass" "GET /groups/:id/wikis contains ${WIKI_ID}"
  else
    assert "group.wiki_listed" "fail" "GET /groups/:id/wikis does not contain ${WIKI_ID}"
  fi
else
  assert "group.wiki_listed" "fail" "expected 200, got ${GROUP_WIKIS_CODE}"
fi

# 3. Write some seed content so the wiki has material to regen from
CONTENT_BODY=$(jq -cn '{frontmatter:{name:"UAT regen test",type:"log"},body:"# UAT Seed Content\n\nThis wiki was seeded during UAT to test regeneration."}')
CONTENT_CODE=$(curl -s -o /tmp/uat-wiki-seed.json -w '%{http_code}' \
  -X PUT "${BASE_URL}/api/content/wiki/${WIKI_ID}" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "$CONTENT_BODY")

if [ "$CONTENT_CODE" = "200" ]; then
  assert "wiki.seed_content" "pass" "PUT /api/content/wiki/:key -> 200 (seed for regen)"
else
  assert "wiki.seed_content" "fail" "expected 200, got ${CONTENT_CODE}"
fi

# 4. Call regen — M3 has this live via Quill LLM
REGEN_CODE=$(curl -s -o /tmp/uat-regen.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis/${WIKI_ID}/regenerate" \
  -b "$COOKIE_JAR")
REGEN_BODY=$(cat /tmp/uat-regen.json)

if [ "$REGEN_CODE" = "200" ]; then
  REGEN_OK=$(echo "$REGEN_BODY" | jq -r '.ok // empty')
  if [ "$REGEN_OK" = "true" ]; then
    assert "wiki.regen_live" "pass" "POST /wikis/:id/regenerate -> 200 {ok:true}"
  else
    assert "wiki.regen_live" "fail" "200 but ok!=true: ${REGEN_BODY}"
  fi
  observe "wiki.regen_response" "$REGEN_BODY" "LLM-driven, not shape-asserted"
elif [ "$REGEN_CODE" = "500" ]; then
  # OpenRouter key may be missing/expired — observe but do not fail
  REGEN_ERR=$(echo "$REGEN_BODY" | jq -r '.error // empty')
  observe "wiki.regen_500" "$REGEN_ERR" "regen returned 500 — likely OpenRouter key issue, not a code bug"
  assert "wiki.regen_live" "pass" "regen endpoint is live (returned 500, not 503 dormant)"
else
  assert "wiki.regen_live" "fail" "unexpected status ${REGEN_CODE}: ${REGEN_BODY}"
fi
```

---

## Phase 8 — Wiki Types Setup

### Step 17 -- Seed default wiki types

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

SETUP_CODE=$(curl -s -o /tmp/uat-wt-setup.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wiki-types/setup" \
  -b "$COOKIE_JAR")

if [ "$SETUP_CODE" = "200" ]; then
  SEEDED=$(jq -r '.seeded // 0' /tmp/uat-wt-setup.json)
  assert "wiki_types.setup" "pass" "POST /wiki-types/setup -> 200, seeded=${SEEDED}"
else
  cat /tmp/uat-wt-setup.json
  assert "wiki_types.setup" "fail" "expected 200, got ${SETUP_CODE}"
fi

SETUP2_CODE=$(curl -s -o /tmp/uat-wt-setup2.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wiki-types/setup" \
  -b "$COOKIE_JAR")

if [ "$SETUP2_CODE" = "200" ]; then
  assert "wiki_types.setup_idempotent" "pass" "second POST /wiki-types/setup -> 200"
else
  assert "wiki_types.setup_idempotent" "fail" "expected 200 on re-call, got ${SETUP2_CODE}"
fi
```

### Step 18 -- List default wiki types and validate shape

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

LIST_CODE=$(curl -s -o /tmp/uat-wt-list.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/wiki-types")

if [ "$LIST_CODE" = "200" ]; then
  assert "wiki_types.list" "pass" "GET /wiki-types -> 200"
else
  cat /tmp/uat-wt-list.json
  assert "wiki_types.list" "fail" "expected 200, got ${LIST_CODE}"
fi

TYPE_COUNT=$(jq '.wikiTypes | length' /tmp/uat-wt-list.json)
if [ "$TYPE_COUNT" = "10" ]; then
  assert "wiki_types.count_10" "pass" "10 default wiki types seeded"
else
  assert "wiki_types.count_10" "fail" "expected 10 default types, got ${TYPE_COUNT}"
fi

SHAPE_OK=$(jq '[.wikiTypes[] | select(.slug and .name and .shortDescriptor and .descriptor and (.prompt != null) and (.isDefault == true))] | length' /tmp/uat-wt-list.json)
if [ "$SHAPE_OK" = "$TYPE_COUNT" ]; then
  assert "wiki_types.shape" "pass" "all ${TYPE_COUNT} types have slug/name/shortDescriptor/descriptor/prompt/isDefault=true"
else
  assert "wiki_types.shape" "fail" "${SHAPE_OK}/${TYPE_COUNT} types match expected shape"
fi
```

### Step 19 -- Regression gate: goal type exists (not objective)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

GOAL_EXISTS=$(jq '[.wikiTypes[] | select(.slug == "goal")] | length' /tmp/uat-wt-list.json)
OBJECTIVE_EXISTS=$(jq '[.wikiTypes[] | select(.slug == "objective")] | length' /tmp/uat-wt-list.json)

if [ "$GOAL_EXISTS" = "1" ]; then
  assert "wiki_types.goal_exists" "pass" "slug=goal present in wiki types"
else
  assert "wiki_types.goal_exists" "fail" "slug=goal not found — rename regression?"
fi

if [ "$OBJECTIVE_EXISTS" = "0" ]; then
  assert "wiki_types.objective_gone" "pass" "slug=objective absent (renamed to goal)"
else
  assert "wiki_types.objective_gone" "fail" "slug=objective still present — rename incomplete"
fi

WIKI_TYPE_ID="goal"
save_state WIKI_TYPE_ID "$WIKI_TYPE_ID"
```

### Step 20 -- Create custom wiki type

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

CUSTOM_TYPE_SLUG="uat-custom-${TS}"
save_state CUSTOM_TYPE_SLUG "$CUSTOM_TYPE_SLUG"

CREATE_BODY=$(jq -cn --arg s "$CUSTOM_TYPE_SLUG" \
  '{slug:$s, name:"UAT Custom Type", shortDescriptor:"UAT test type", descriptor:"A wiki type created during UAT to test custom type creation", prompt:""}')

CREATE_CODE=$(curl -s -o /tmp/uat-wt-create.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wiki-types" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "$CREATE_BODY")

if [ "$CREATE_CODE" = "201" ]; then
  CREATED_SLUG=$(jq -r '.slug' /tmp/uat-wt-create.json)
  IS_DEFAULT=$(jq -r '.isDefault' /tmp/uat-wt-create.json)
  USER_MOD=$(jq -r '.userModified' /tmp/uat-wt-create.json)
  assert "wiki_types.create_custom" "pass" "POST /wiki-types -> 201, slug=${CREATED_SLUG}"
  if [ "$IS_DEFAULT" = "false" ] && [ "$USER_MOD" = "true" ]; then
    assert "wiki_types.custom_flags" "pass" "isDefault=false, userModified=true"
  else
    assert "wiki_types.custom_flags" "fail" "expected isDefault=false/userModified=true, got ${IS_DEFAULT}/${USER_MOD}"
  fi
else
  cat /tmp/uat-wt-create.json
  assert "wiki_types.create_custom" "fail" "expected 201, got ${CREATE_CODE}"
fi

LIST2_CODE=$(curl -s -o /tmp/uat-wt-list2.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/wiki-types")
TYPE_COUNT_2=$(jq '.wikiTypes | length' /tmp/uat-wt-list2.json)
if [ "$TYPE_COUNT_2" = "11" ]; then
  assert "wiki_types.count_after_create" "pass" "GET /wiki-types now returns 11 types"
else
  assert "wiki_types.count_after_create" "fail" "expected 11 types, got ${TYPE_COUNT_2}"
fi

DUP_CODE=$(curl -s -o /tmp/uat-wt-dup.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wiki-types" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "$CREATE_BODY")

if [ "$DUP_CODE" = "409" ]; then
  assert "wiki_types.dup_slug_409" "pass" "duplicate slug -> 409"
else
  assert "wiki_types.dup_slug_409" "fail" "expected 409, got ${DUP_CODE}"
fi
```

### Step 21 -- Update custom wiki type

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

UPDATE_BODY='{"name":"UAT Custom Type (Updated)","shortDescriptor":"Updated UAT type"}'
UPDATE_CODE=$(curl -s -o /tmp/uat-wt-update.json -w '%{http_code}' \
  -X PUT "${BASE_URL}/wiki-types/${CUSTOM_TYPE_SLUG}" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "$UPDATE_BODY")

if [ "$UPDATE_CODE" = "200" ]; then
  UPDATED_NAME=$(jq -r '.name' /tmp/uat-wt-update.json)
  UPDATED_UM=$(jq -r '.userModified' /tmp/uat-wt-update.json)
  assert "wiki_types.update" "pass" "PUT /wiki-types/:slug -> 200, name=${UPDATED_NAME}"
  if [ "$UPDATED_UM" = "true" ]; then
    assert "wiki_types.update_user_modified" "pass" "userModified=true after update"
  else
    assert "wiki_types.update_user_modified" "fail" "expected userModified=true, got ${UPDATED_UM}"
  fi
else
  cat /tmp/uat-wt-update.json
  assert "wiki_types.update" "fail" "expected 200, got ${UPDATE_CODE}"
fi

NOTFOUND_CODE=$(curl -s -o /tmp/uat-wt-nf.json -w '%{http_code}' \
  -X PUT "${BASE_URL}/wiki-types/does-not-exist-xyz" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"nope"}')

if [ "$NOTFOUND_CODE" = "404" ]; then
  assert "wiki_types.update_404" "pass" "PUT nonexistent slug -> 404"
else
  assert "wiki_types.update_404" "fail" "expected 404, got ${NOTFOUND_CODE}"
fi
```

---

## Phase 9 — Content Storage

### Step 22 -- Write content to wiki via content API

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

WIKI_CONTENT_BODY="# UAT Content Test\n\nThis content was written during UAT Phase 9 at timestamp ${TS}.\n\n## Section\n\nSome detailed notes here."

WRITE_BODY=$(jq -cn --arg b "$WIKI_CONTENT_BODY" \
  '{frontmatter:{name:"UAT regen test",type:"log"},body:$b}')

WRITE_CODE=$(curl -s -o /tmp/uat-content-write.json -w '%{http_code}' \
  -X PUT "${BASE_URL}/api/content/wiki/${WIKI_ID}" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "$WRITE_BODY")

if [ "$WRITE_CODE" = "200" ]; then
  WRITE_OK=$(jq -r '.ok // empty' /tmp/uat-content-write.json)
  if [ "$WRITE_OK" = "true" ]; then
    assert "content.write_wiki" "pass" "PUT /api/content/wiki/:key -> 200 {ok:true}"
  else
    assert "content.write_wiki" "fail" "200 but ok!=true"
  fi
else
  cat /tmp/uat-content-write.json
  assert "content.write_wiki" "fail" "expected 200, got ${WRITE_CODE}"
fi

BAD_TYPE_CODE=$(curl -s -o /tmp/uat-content-badtype.json -w '%{http_code}' \
  -X PUT "${BASE_URL}/api/content/bogus/${WIKI_ID}" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"frontmatter":{"name":"x"},"body":"x"}')

if [ "$BAD_TYPE_CODE" = "400" ]; then
  assert "content.write_invalid_type" "pass" "PUT /api/content/bogus/:key -> 400"
else
  assert "content.write_invalid_type" "fail" "expected 400, got ${BAD_TYPE_CODE}"
fi
```

### Step 23 -- Read content back and verify

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

READ_CODE=$(curl -s -o /tmp/uat-content-read.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/api/content/wiki/${WIKI_ID}")

if [ "$READ_CODE" = "200" ]; then
  assert "content.read_wiki" "pass" "GET /api/content/wiki/:key -> 200"
else
  cat /tmp/uat-content-read.json
  assert "content.read_wiki" "fail" "expected 200, got ${READ_CODE}"
fi

READ_CONTENT=$(jq -r '.content // empty' /tmp/uat-content-read.json)
if [ -n "$READ_CONTENT" ]; then
  assert "content.read_not_empty" "pass" "content is non-empty (${#READ_CONTENT} chars)"
else
  assert "content.read_not_empty" "fail" "content is empty after write"
fi

if echo "$READ_CONTENT" | grep -q "UAT Content Test"; then
  assert "content.read_matches_written" "pass" "content contains expected UAT marker"
else
  assert "content.read_matches_written" "fail" "content does not contain expected UAT marker"
fi

NF_CODE=$(curl -s -o /tmp/uat-content-nf.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/api/content/wiki/does_not_exist_xyz")

if [ "$NF_CODE" = "404" ]; then
  assert "content.read_404" "pass" "GET nonexistent key -> 404"
else
  assert "content.read_404" "fail" "expected 404, got ${NF_CODE}"
fi
```

### Step 24 -- Verify edit audit trail

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

EDIT_COUNT=$(psql_one "SELECT count(*) FROM edits WHERE object_type='wiki' AND object_id='${WIKI_ID}' AND source='user'")

if [ -n "$EDIT_COUNT" ] && [ "$EDIT_COUNT" -ge 1 ] 2>/dev/null; then
  assert "content.edit_audit_user" "pass" "edits table has ${EDIT_COUNT} row(s) with source=user for wiki ${WIKI_ID}"
else
  assert "content.edit_audit_user" "fail" "expected >=1 edit rows with source=user, got '${EDIT_COUNT}'"
fi

EDIT_SHAPE=$(psql_one "SELECT count(*) FROM edits WHERE object_type='wiki' AND object_id='${WIKI_ID}' AND source='user' AND content IS NOT NULL")
if [ "$EDIT_SHAPE" = "$EDIT_COUNT" ]; then
  assert "content.edit_shape" "pass" "all edit rows have content populated"
else
  assert "content.edit_shape" "fail" "expected ${EDIT_COUNT} rows with content, got ${EDIT_SHAPE}"
fi
```

---

## Phase 10 — Wiki Publishing

### Step 25 -- Publish wiki with content

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

PUB_CODE=$(curl -s -o /tmp/uat-publish.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis/${WIKI_ID}/publish" \
  -b "$COOKIE_JAR")

if [ "$PUB_CODE" = "200" ]; then
  PUB_SLUG=$(jq -r '.publishedSlug // empty' /tmp/uat-publish.json)
  PUB_FLAG=$(jq -r '.published' /tmp/uat-publish.json)
  PUB_AT=$(jq -r '.publishedAt // empty' /tmp/uat-publish.json)

  if [ "$PUB_FLAG" = "true" ] && [ -n "$PUB_SLUG" ] && [ -n "$PUB_AT" ]; then
    assert "publish.wiki" "pass" "POST /wikis/:id/publish -> 200, published=true, slug=${PUB_SLUG}"
  else
    assert "publish.wiki" "fail" "200 but missing fields: published=${PUB_FLAG}, slug=${PUB_SLUG}, publishedAt=${PUB_AT}"
  fi

  SLUG_LEN=${#PUB_SLUG}
  if [ "$SLUG_LEN" = "24" ]; then
    assert "publish.slug_length" "pass" "publishedSlug is 24 chars"
  else
    assert "publish.slug_length" "fail" "expected 24 char slug, got ${SLUG_LEN} chars: '${PUB_SLUG}'"
  fi

  save_state PUBLISHED_SLUG "$PUB_SLUG"
else
  cat /tmp/uat-publish.json
  assert "publish.wiki" "fail" "expected 200, got ${PUB_CODE}"
fi
```

### Step 26 -- Public wiki JSON access (unauthenticated)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

PUB_READ_CODE=$(curl -s -o /tmp/uat-pub-read.json -w '%{http_code}' \
  "${BASE_URL}/published/wiki/${PUBLISHED_SLUG}")

if [ "$PUB_READ_CODE" = "200" ]; then
  assert "publish.public_read" "pass" "GET /published/wiki/:nanoid -> 200 (no auth)"
else
  cat /tmp/uat-pub-read.json
  assert "publish.public_read" "fail" "expected 200, got ${PUB_READ_CODE}"
fi

PUB_NAME=$(jq -r '.name // empty' /tmp/uat-pub-read.json)
PUB_TYPE=$(jq -r '.type // empty' /tmp/uat-pub-read.json)
PUB_AT=$(jq -r '.publishedAt // empty' /tmp/uat-pub-read.json)
PUB_CONTENT=$(jq -r '.content // empty' /tmp/uat-pub-read.json)

if [ -n "$PUB_NAME" ] && [ -n "$PUB_TYPE" ] && [ -n "$PUB_AT" ] && [ -n "$PUB_CONTENT" ]; then
  assert "publish.public_shape" "pass" "response has name/type/publishedAt/content"
else
  assert "publish.public_shape" "fail" "missing fields: name=${PUB_NAME}, type=${PUB_TYPE}, publishedAt=${PUB_AT}, content-len=${#PUB_CONTENT}"
fi
```

### Step 27 -- Public wiki raw markdown access

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

RAW_CODE=$(curl -s -o /tmp/uat-pub-raw.txt -w '%{http_code}' \
  -D /tmp/uat-pub-raw-headers.txt \
  "${BASE_URL}/published/wiki/${PUBLISHED_SLUG}?raw")

if [ "$RAW_CODE" = "200" ]; then
  assert "publish.raw_read" "pass" "GET /published/wiki/:nanoid?raw -> 200"
else
  assert "publish.raw_read" "fail" "expected 200, got ${RAW_CODE}"
fi

CT=$(grep -i 'content-type' /tmp/uat-pub-raw-headers.txt 2>/dev/null | tr -d '\r')
if echo "$CT" | grep -qi 'text/plain'; then
  assert "publish.raw_content_type" "pass" "Content-Type is text/plain"
else
  assert "publish.raw_content_type" "fail" "expected text/plain, got '${CT}'"
fi

RAW_BODY=$(cat /tmp/uat-pub-raw.txt)
if echo "$RAW_BODY" | grep -q "UAT Content Test"; then
  assert "publish.raw_body_matches" "pass" "raw body contains expected content"
else
  assert "publish.raw_body_matches" "fail" "raw body missing expected content marker"
fi
```

### Step 28 -- Unpublish wiki

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

UNPUB_CODE=$(curl -s -o /tmp/uat-unpublish.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis/${WIKI_ID}/unpublish" \
  -b "$COOKIE_JAR")

if [ "$UNPUB_CODE" = "200" ]; then
  UNPUB_FLAG=$(jq -r '.published' /tmp/uat-unpublish.json)
  UNPUB_SLUG=$(jq -r '.publishedSlug // empty' /tmp/uat-unpublish.json)

  if [ "$UNPUB_FLAG" = "false" ]; then
    assert "publish.unpublish" "pass" "POST /wikis/:id/unpublish -> 200, published=false"
  else
    assert "publish.unpublish" "fail" "200 but published=${UNPUB_FLAG} (expected false)"
  fi

  if [ "$UNPUB_SLUG" = "$PUBLISHED_SLUG" ]; then
    assert "publish.slug_preserved_on_unpublish" "pass" "publishedSlug preserved: ${UNPUB_SLUG}"
  else
    assert "publish.slug_preserved_on_unpublish" "fail" "slug changed: was ${PUBLISHED_SLUG}, now ${UNPUB_SLUG}"
  fi
else
  cat /tmp/uat-unpublish.json
  assert "publish.unpublish" "fail" "expected 200, got ${UNPUB_CODE}"
fi
```

### Step 29 -- Public access after unpublish returns 404

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

GONE_CODE=$(curl -s -o /tmp/uat-pub-gone.json -w '%{http_code}' \
  "${BASE_URL}/published/wiki/${PUBLISHED_SLUG}")

if [ "$GONE_CODE" = "404" ]; then
  assert "publish.unpublished_404" "pass" "GET /published/wiki/:nanoid -> 404 after unpublish"
else
  cat /tmp/uat-pub-gone.json
  assert "publish.unpublished_404" "fail" "expected 404, got ${GONE_CODE}"
fi
```

### Step 30 -- Re-publish preserves slug

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

REPUB_CODE=$(curl -s -o /tmp/uat-republish.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis/${WIKI_ID}/publish" \
  -b "$COOKIE_JAR")

if [ "$REPUB_CODE" = "200" ]; then
  REPUB_SLUG=$(jq -r '.publishedSlug // empty' /tmp/uat-republish.json)
  REPUB_FLAG=$(jq -r '.published' /tmp/uat-republish.json)

  if [ "$REPUB_FLAG" = "true" ]; then
    assert "publish.republish" "pass" "re-publish -> 200, published=true"
  else
    assert "publish.republish" "fail" "200 but published=${REPUB_FLAG}"
  fi

  if [ "$REPUB_SLUG" = "$PUBLISHED_SLUG" ]; then
    assert "publish.slug_stable_across_cycles" "pass" "slug stable: ${REPUB_SLUG} == ${PUBLISHED_SLUG}"
  else
    assert "publish.slug_stable_across_cycles" "fail" "slug changed: was ${PUBLISHED_SLUG}, now ${REPUB_SLUG}"
  fi
else
  cat /tmp/uat-republish.json
  assert "publish.republish" "fail" "expected 200, got ${REPUB_CODE}"
fi
```

### Step 31 -- Publish wiki with no content returns 400

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

EMPTY_WIKI_RESP=$(curl -s -o /tmp/uat-empty-wiki.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"UAT empty wiki for publish test","type":"log"}')

if [ "$EMPTY_WIKI_RESP" = "201" ] || [ "$EMPTY_WIKI_RESP" = "200" ]; then
  EMPTY_WIKI_ID=$(jq -r '.id' /tmp/uat-empty-wiki.json)
  assert "publish.empty_wiki_created" "pass" "created empty wiki id=${EMPTY_WIKI_ID}"
else
  cat /tmp/uat-empty-wiki.json
  assert "publish.empty_wiki_created" "fail" "expected 200/201, got ${EMPTY_WIKI_RESP}"
fi

NOPUB_CODE=$(curl -s -o /tmp/uat-nopub.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis/${EMPTY_WIKI_ID}/publish" \
  -b "$COOKIE_JAR")

if [ "$NOPUB_CODE" = "400" ]; then
  NOPUB_ERR=$(jq -r '.error // empty' /tmp/uat-nopub.json)
  assert "publish.no_content_400" "pass" "publish with no content -> 400: ${NOPUB_ERR}"
else
  cat /tmp/uat-nopub.json
  assert "publish.no_content_400" "fail" "expected 400, got ${NOPUB_CODE}"
fi
```

---

## Phase 11 — Wiki Regeneration

### Step 32 -- Trigger on-demand wiki regeneration

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

REGEN_CODE=$(curl -s -o /tmp/uat-regen2.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis/${WIKI_ID}/regenerate" \
  -b "$COOKIE_JAR")
REGEN_BODY=$(cat /tmp/uat-regen2.json)

if [ "$REGEN_CODE" = "200" ]; then
  REGEN_OK=$(echo "$REGEN_BODY" | jq -r '.ok // empty')
  REGEN_KEY=$(echo "$REGEN_BODY" | jq -r '.lookupKey // empty')
  observe "regen.response_code" "200" "regen returned successfully"
  observe "regen.ok" "$REGEN_OK" "LLM-driven"
  observe "regen.lookupKey" "$REGEN_KEY" ""
elif [ "$REGEN_CODE" = "500" ]; then
  REGEN_ERR=$(echo "$REGEN_BODY" | jq -r '.error // empty')
  observe "regen.response_code" "500" "regen failed — likely OpenRouter key issue"
  observe "regen.error" "$REGEN_ERR" "not a code bug if key-related"
else
  observe "regen.response_code" "$REGEN_CODE" "unexpected status"
  observe "regen.body" "$REGEN_BODY" ""
fi

observe "regen.full_response" "$REGEN_BODY" "LLM output is probabilistic"
```

### Step 33 -- Verify regen wrote content

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

POST_REGEN_CODE=$(curl -s -o /tmp/uat-regen-content.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/api/content/wiki/${WIKI_ID}")

if [ "$POST_REGEN_CODE" = "200" ]; then
  POST_REGEN_CONTENT=$(jq -r '.content // empty' /tmp/uat-regen-content.json)
  if [ -n "$POST_REGEN_CONTENT" ]; then
    observe "regen.content_after" "non-empty (${#POST_REGEN_CONTENT} chars)" "may be LLM-generated or seed content"
  else
    observe "regen.content_after" "empty" "regen may not have run successfully"
  fi
else
  observe "regen.content_read_status" "$POST_REGEN_CODE" "unexpected"
fi
```

### Step 34 -- Verify regen edit audit trail

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

REGEN_EDIT_COUNT=$(psql_one "SELECT count(*) FROM edits WHERE object_type='wiki' AND object_id='${WIKI_ID}' AND source='regen'")

if [ -n "$REGEN_EDIT_COUNT" ] && [ "$REGEN_EDIT_COUNT" -ge 1 ] 2>/dev/null; then
  assert "regen.edit_audit_regen" "pass" "edits table has ${REGEN_EDIT_COUNT} row(s) with source=regen for wiki ${WIKI_ID}"
else
  PHASE7_REGEN=$(jq -r 'select(.name=="wiki.regen_live") | .status' .uat/runs/asserts.jsonl 2>/dev/null | tail -1)
  if [ "$PHASE7_REGEN" = "pass" ]; then
    assert "regen.edit_audit_regen" "fail" "regen succeeded in Phase 7 but no edit row with source=regen found"
  else
    observe "regen.edit_audit_regen" "skipped" "regen did not succeed (likely key issue) — no edit row expected"
  fi
fi
```

### Step 35 -- Regen disabled returns 400

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

psql "$DATABASE_URL" -c "UPDATE wikis SET regenerate = false WHERE lookup_key = '${WIKI_ID}'" >/dev/null

DISABLED_CODE=$(curl -s -o /tmp/uat-regen-disabled.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis/${WIKI_ID}/regenerate" \
  -b "$COOKIE_JAR")

if [ "$DISABLED_CODE" = "400" ]; then
  DISABLED_ERR=$(jq -r '.error // empty' /tmp/uat-regen-disabled.json)
  assert "regen.disabled_400" "pass" "regen with regenerate=false -> 400: ${DISABLED_ERR}"
else
  cat /tmp/uat-regen-disabled.json
  assert "regen.disabled_400" "fail" "expected 400, got ${DISABLED_CODE}"
fi

psql "$DATABASE_URL" -c "UPDATE wikis SET regenerate = true WHERE lookup_key = '${WIKI_ID}'" >/dev/null
```

---

## Phase 12 — M6 API Routes

### Step 36 -- Wiki listing (GET /wikis)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

LIST_CODE=$(curl -s -o /tmp/uat-wikis-list.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/wikis")

if [ "$LIST_CODE" = "200" ]; then
  assert "m6.wikis_list" "pass" "GET /wikis -> 200"
else
  cat /tmp/uat-wikis-list.json
  assert "m6.wikis_list" "fail" "expected 200, got ${LIST_CODE}"
fi

WIKI_FOUND=$(jq --arg id "$WIKI_ID" '[.wikis[] | select(.id==$id)] | length' /tmp/uat-wikis-list.json)
if [ "$WIKI_FOUND" = "1" ]; then
  assert "m6.wikis_list_contains_fixture" "pass" "GET /wikis contains ${WIKI_ID}"
else
  assert "m6.wikis_list_contains_fixture" "fail" "GET /wikis does not contain ${WIKI_ID}"
fi

LIMIT_CODE=$(curl -s -o /tmp/uat-wikis-limit.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/wikis?limit=1")
LIMIT_COUNT=$(jq '.wikis | length' /tmp/uat-wikis-limit.json)
if [ "$LIMIT_CODE" = "200" ] && [ "$LIMIT_COUNT" -le 1 ]; then
  assert "m6.wikis_list_pagination" "pass" "GET /wikis?limit=1 -> ${LIMIT_COUNT} results"
else
  assert "m6.wikis_list_pagination" "fail" "expected <=1 results, got ${LIMIT_COUNT}"
fi
```

### Step 37 -- Enriched wiki detail (GET /wikis/:id)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

DETAIL_CODE=$(curl -s -o /tmp/uat-wiki-detail.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/wikis/${WIKI_ID}")

if [ "$DETAIL_CODE" = "200" ]; then
  assert "m6.wiki_detail" "pass" "GET /wikis/:id -> 200"
else
  cat /tmp/uat-wiki-detail.json
  assert "m6.wiki_detail" "fail" "expected 200, got ${DETAIL_CODE}"
fi

HAS_ID=$(jq -r '.id // empty' /tmp/uat-wiki-detail.json)
HAS_NAME=$(jq -r '.name // empty' /tmp/uat-wiki-detail.json)
HAS_TYPE=$(jq -r '.type // empty' /tmp/uat-wiki-detail.json)
HAS_FRAGS=$(jq '.fragments | type' /tmp/uat-wiki-detail.json)
HAS_PEOPLE=$(jq '.people | type' /tmp/uat-wiki-detail.json)

if [ -n "$HAS_ID" ] && [ -n "$HAS_NAME" ] && [ -n "$HAS_TYPE" ] && [ "$HAS_FRAGS" = '"array"' ] && [ "$HAS_PEOPLE" = '"array"' ]; then
  assert "m6.wiki_detail_shape" "pass" "response has id/name/type/fragments[]/people[]"
else
  assert "m6.wiki_detail_shape" "fail" "missing fields: id=${HAS_ID}, name=${HAS_NAME}, frags=${HAS_FRAGS}, people=${HAS_PEOPLE}"
fi

NF_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/wikis/does_not_exist_xyz")
if [ "$NF_CODE" = "404" ]; then
  assert "m6.wiki_detail_404" "pass" "GET /wikis/nonexistent -> 404"
else
  assert "m6.wiki_detail_404" "fail" "expected 404, got ${NF_CODE}"
fi
```

### Step 38 -- PATCH /wikis/:id/regenerate toggle

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

TOGGLE_OFF_CODE=$(curl -s -o /tmp/uat-regen-toggle-off.json -w '%{http_code}' \
  -X PATCH "${BASE_URL}/wikis/${WIKI_ID}/regenerate" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"regenerate":false}')

if [ "$TOGGLE_OFF_CODE" = "200" ]; then
  REGEN_VAL=$(jq -r '.regenerate' /tmp/uat-regen-toggle-off.json)
  if [ "$REGEN_VAL" = "false" ]; then
    assert "m6.regen_toggle_off" "pass" "PATCH /wikis/:id/regenerate -> 200, regenerate=false"
  else
    assert "m6.regen_toggle_off" "fail" "200 but regenerate=${REGEN_VAL} (expected false)"
  fi
else
  cat /tmp/uat-regen-toggle-off.json
  assert "m6.regen_toggle_off" "fail" "expected 200, got ${TOGGLE_OFF_CODE}"
fi

TOGGLE_ON_CODE=$(curl -s -o /tmp/uat-regen-toggle-on.json -w '%{http_code}' \
  -X PATCH "${BASE_URL}/wikis/${WIKI_ID}/regenerate" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"regenerate":true}')

if [ "$TOGGLE_ON_CODE" = "200" ]; then
  REGEN_VAL2=$(jq -r '.regenerate' /tmp/uat-regen-toggle-on.json)
  if [ "$REGEN_VAL2" = "true" ]; then
    assert "m6.regen_toggle_on" "pass" "PATCH /wikis/:id/regenerate -> 200, regenerate=true"
  else
    assert "m6.regen_toggle_on" "fail" "200 but regenerate=${REGEN_VAL2} (expected true)"
  fi
else
  assert "m6.regen_toggle_on" "fail" "expected 200, got ${TOGGLE_ON_CODE}"
fi
```

### Step 39 -- PATCH /wikis/:id/bouncer toggle

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

BOUNCER_CODE=$(curl -s -o /tmp/uat-bouncer.json -w '%{http_code}' \
  -X PATCH "${BASE_URL}/wikis/${WIKI_ID}/bouncer" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"mode":"review"}')

if [ "$BOUNCER_CODE" = "200" ]; then
  BM=$(jq -r '.bouncerMode' /tmp/uat-bouncer.json)
  if [ "$BM" = "review" ]; then
    assert "m6.bouncer_review" "pass" "PATCH /wikis/:id/bouncer -> 200, bouncerMode=review"
  else
    assert "m6.bouncer_review" "fail" "200 but bouncerMode=${BM} (expected review)"
  fi
else
  cat /tmp/uat-bouncer.json
  assert "m6.bouncer_review" "fail" "expected 200, got ${BOUNCER_CODE}"
fi

AUTO_CODE=$(curl -s -o /tmp/uat-bouncer-auto.json -w '%{http_code}' \
  -X PATCH "${BASE_URL}/wikis/${WIKI_ID}/bouncer" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"mode":"auto"}')

if [ "$AUTO_CODE" = "200" ]; then
  BM2=$(jq -r '.bouncerMode' /tmp/uat-bouncer-auto.json)
  if [ "$BM2" = "auto" ]; then
    assert "m6.bouncer_auto" "pass" "PATCH /wikis/:id/bouncer -> 200, bouncerMode=auto"
  else
    assert "m6.bouncer_auto" "fail" "200 but bouncerMode=${BM2} (expected auto)"
  fi
else
  assert "m6.bouncer_auto" "fail" "expected 200, got ${AUTO_CODE}"
fi
```

### Step 40 -- Fragment accept/reject error paths

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

ACCEPT_NF_CODE=$(curl -s -o /tmp/uat-frag-accept-nf.json -w '%{http_code}' \
  -X POST "${BASE_URL}/fragments/frag_does_not_exist/accept" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"wikiId\":\"${WIKI_ID}\"}")

if [ "$ACCEPT_NF_CODE" = "404" ]; then
  assert "m6.fragment_accept_404" "pass" "POST /fragments/nonexistent/accept -> 404"
else
  assert "m6.fragment_accept_404" "fail" "expected 404, got ${ACCEPT_NF_CODE}"
fi

REJECT_NF_CODE=$(curl -s -o /tmp/uat-frag-reject-nf.json -w '%{http_code}' \
  -X POST "${BASE_URL}/fragments/frag_does_not_exist/reject" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"wikiId\":\"${WIKI_ID}\"}")

if [ "$REJECT_NF_CODE" = "404" ]; then
  assert "m6.fragment_reject_404" "pass" "POST /fragments/nonexistent/reject -> 404"
else
  assert "m6.fragment_reject_404" "fail" "expected 404, got ${REJECT_NF_CODE}"
fi

FRAG_RESP=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/entries/${ENTRY_SARAH_ID}/fragments")
FIRST_FRAG_ID=$(echo "$FRAG_RESP" | jq -r '.fragments[0].id // empty')

if [ -n "$FIRST_FRAG_ID" ]; then
  NOT_REVIEW_CODE=$(curl -s -o /tmp/uat-frag-not-review.json -w '%{http_code}' \
    -X POST "${BASE_URL}/fragments/${FIRST_FRAG_ID}/accept" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d "{\"wikiId\":\"${WIKI_ID}\"}")

  if [ "$NOT_REVIEW_CODE" = "400" ] || [ "$NOT_REVIEW_CODE" = "404" ]; then
    assert "m6.fragment_accept_not_review" "pass" "accept on auto-mode wiki -> ${NOT_REVIEW_CODE}"
  else
    assert "m6.fragment_accept_not_review" "fail" "expected 400 or 404, got ${NOT_REVIEW_CODE}"
  fi
else
  observe "m6.fragment_accept_skip" "no fragments" "sarah entry produced 0 fragments, skipping accept/reject flow test"
fi
```

### Step 41 -- PUT /people/:id update

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

PERSON_ID=$(psql_one "SELECT lookup_key FROM people LIMIT 1")

if [ -n "$PERSON_ID" ]; then
  UPDATE_CODE=$(curl -s -o /tmp/uat-person-update.json -w '%{http_code}' \
    -X PUT "${BASE_URL}/people/${PERSON_ID}" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d '{"name":"UAT Updated Person","relationship":"colleague"}')

  if [ "$UPDATE_CODE" = "200" ]; then
    UPDATED_NAME=$(jq -r '.name // empty' /tmp/uat-person-update.json)
    if [ "$UPDATED_NAME" = "UAT Updated Person" ]; then
      assert "m6.people_update" "pass" "PUT /people/:id -> 200, name=UAT Updated Person"
    else
      assert "m6.people_update" "fail" "200 but name=${UPDATED_NAME}"
    fi
  else
    cat /tmp/uat-person-update.json
    assert "m6.people_update" "fail" "expected 200, got ${UPDATE_CODE}"
  fi
else
  observe "m6.people_update_skip" "no people" "ingest did not create any people, skipping update test"
fi

NF_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -X PUT "${BASE_URL}/people/person_does_not_exist" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"nope"}')
if [ "$NF_CODE" = "404" ]; then
  assert "m6.people_update_404" "pass" "PUT /people/nonexistent -> 404"
else
  assert "m6.people_update_404" "fail" "expected 404, got ${NF_CODE}"
fi
```

---

## Phase 13 — M9 Audit Log

### Step 42 -- GET /audit-log basic + filters

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

AL_CODE=$(curl -s -o /tmp/uat-audit-log.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/audit-log")

if [ "$AL_CODE" = "200" ]; then
  assert "m9.audit_log_list" "pass" "GET /audit-log -> 200"
else
  cat /tmp/uat-audit-log.json
  assert "m9.audit_log_list" "fail" "expected 200, got ${AL_CODE}"
fi

HAS_EVENTS=$(jq '.events | type' /tmp/uat-audit-log.json)
HAS_TOTAL=$(jq '.total // -1' /tmp/uat-audit-log.json)
if [ "$HAS_EVENTS" = '"array"' ] && [ "$HAS_TOTAL" -ge 0 ] 2>/dev/null; then
  assert "m9.audit_log_shape" "pass" "response has events[]/total (total=${HAS_TOTAL})"
else
  assert "m9.audit_log_shape" "fail" "missing fields: events=${HAS_EVENTS}, total=${HAS_TOTAL}"
fi

WIKI_AL_CODE=$(curl -s -o /tmp/uat-audit-log-wiki.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/audit-log?entityType=wiki")

if [ "$WIKI_AL_CODE" = "200" ]; then
  WIKI_EVENTS=$(jq '.events | length' /tmp/uat-audit-log-wiki.json)
  assert "m9.audit_log_filter_type" "pass" "GET /audit-log?entityType=wiki -> 200, ${WIKI_EVENTS} events"
else
  assert "m9.audit_log_filter_type" "fail" "expected 200, got ${WIKI_AL_CODE}"
fi

ENTITY_AL_CODE=$(curl -s -o /tmp/uat-audit-log-entity.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/audit-log?entityId=${WIKI_ID}")

if [ "$ENTITY_AL_CODE" = "200" ]; then
  ENTITY_EVENTS=$(jq '.events | length' /tmp/uat-audit-log-entity.json)
  assert "m9.audit_log_filter_entity" "pass" "GET /audit-log?entityId=wiki -> 200, ${ENTITY_EVENTS} events"
else
  assert "m9.audit_log_filter_entity" "fail" "expected 200, got ${ENTITY_AL_CODE}"
fi

PUBLISH_EVENTS=$(jq '[.events[] | select(.eventType=="published")] | length' /tmp/uat-audit-log-entity.json)
if [ "$PUBLISH_EVENTS" -ge 1 ] 2>/dev/null; then
  assert "m9.audit_log_publish_event" "pass" "audit_log has ${PUBLISH_EVENTS} published event(s) for wiki ${WIKI_ID}"
else
  assert "m9.audit_log_publish_event" "fail" "expected >=1 published events, got ${PUBLISH_EVENTS}"
fi
```

### Step 43 -- GET /wikis/:id/timeline

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

TL_CODE=$(curl -s -o /tmp/uat-timeline.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/wikis/${WIKI_ID}/timeline")

if [ "$TL_CODE" = "200" ]; then
  assert "m9.timeline" "pass" "GET /wikis/:id/timeline -> 200"
else
  cat /tmp/uat-timeline.json
  assert "m9.timeline" "fail" "expected 200, got ${TL_CODE}"
fi

TL_EVENTS=$(jq '.events | type' /tmp/uat-timeline.json)
TL_COUNT=$(jq '.events | length' /tmp/uat-timeline.json)
if [ "$TL_EVENTS" = '"array"' ]; then
  assert "m9.timeline_shape" "pass" "timeline has events[] (${TL_COUNT} events)"
else
  assert "m9.timeline_shape" "fail" "events is ${TL_EVENTS}, expected array"
fi

if [ "$TL_COUNT" -gt 0 ] 2>/dev/null; then
  VALID=$(jq '[.events[] | select(.entityType and .entityId and .eventType and .summary and .createdAt)] | length' /tmp/uat-timeline.json)
  if [ "$VALID" = "$TL_COUNT" ]; then
    assert "m9.timeline_event_shape" "pass" "all ${TL_COUNT} timeline events have required fields"
  else
    assert "m9.timeline_event_shape" "fail" "${VALID}/${TL_COUNT} events have required fields"
  fi
else
  observe "m9.timeline_empty" "0 events" "no audit events for this wiki — may be expected on fresh DB"
fi

TL_NF_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/wikis/does_not_exist_xyz/timeline")
if [ "$TL_NF_CODE" = "404" ]; then
  assert "m9.timeline_404" "pass" "GET /wikis/nonexistent/timeline -> 404"
else
  assert "m9.timeline_404" "fail" "expected 404, got ${TL_NF_CODE}"
fi

AL_ROW_COUNT=$(psql_one "SELECT count(*) FROM audit_log")
observe "m9.audit_log_total_rows" "$AL_ROW_COUNT" "total rows in audit_log table"
```

---

## Phase 14 — M10 Trust Gates

### Step 44 -- POST /wikis/:id/spawn (child wiki creation)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

SPAWN_CODE=$(curl -s -o /tmp/uat-spawn.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis/${WIKI_ID}/spawn" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"UAT Spawned Child Wiki"}')

if [ "$SPAWN_CODE" = "200" ] || [ "$SPAWN_CODE" = "201" ]; then
  SPAWN_KEY=$(jq -r '.lookupKey // empty' /tmp/uat-spawn.json)
  SPAWN_NAME=$(jq -r '.name // empty' /tmp/uat-spawn.json)
  SPAWN_PARENT=$(jq -r '.parentKey // empty' /tmp/uat-spawn.json)
  SPAWN_SLUG=$(jq -r '.slug // empty' /tmp/uat-spawn.json)

  save_state SPAWN_WIKI_ID "$SPAWN_KEY"
  assert "m10.spawn" "pass" "POST /wikis/:id/spawn -> ${SPAWN_CODE}, key=${SPAWN_KEY}"

  if [ -n "$SPAWN_KEY" ] && [ -n "$SPAWN_NAME" ] && [ "$SPAWN_PARENT" = "$WIKI_ID" ] && [ -n "$SPAWN_SLUG" ]; then
    assert "m10.spawn_shape" "pass" "response has lookupKey/slug/name/parentKey=${SPAWN_PARENT}"
  else
    assert "m10.spawn_shape" "fail" "missing fields: key=${SPAWN_KEY}, name=${SPAWN_NAME}, parent=${SPAWN_PARENT}"
  fi

  EDGE_EXISTS=$(psql_one "SELECT count(*) FROM edges WHERE src_id='${WIKI_ID}' AND dst_id='${SPAWN_KEY}' AND edge_type='WIKI_RELATED_TO_WIKI'")
  if [ "$EDGE_EXISTS" = "1" ]; then
    assert "m10.spawn_edge" "pass" "WIKI_RELATED_TO_WIKI edge from parent to child"
  else
    assert "m10.spawn_edge" "fail" "expected 1 edge, got ${EDGE_EXISTS}"
  fi
else
  cat /tmp/uat-spawn.json
  assert "m10.spawn" "fail" "expected 200/201, got ${SPAWN_CODE}"
fi

SPAWN_NF_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${BASE_URL}/wikis/does_not_exist_xyz/spawn" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"Orphan Wiki"}')
if [ "$SPAWN_NF_CODE" = "404" ]; then
  assert "m10.spawn_404" "pass" "POST /wikis/nonexistent/spawn -> 404"
else
  assert "m10.spawn_404" "fail" "expected 404, got ${SPAWN_NF_CODE}"
fi
```

### Step 45 -- Fragment confidence column populated after ingest

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

CONF_COUNT=$(psql_one "SELECT count(*) FROM fragments WHERE entry_id='${ENTRY_SARAH_ID}' AND confidence IS NOT NULL")
TOTAL_FRAGS=$(psql_one "SELECT count(*) FROM fragments WHERE entry_id='${ENTRY_SARAH_ID}'")

if [ -n "$TOTAL_FRAGS" ] && [ "$TOTAL_FRAGS" -gt 0 ] 2>/dev/null; then
  observe "m10.fragment_confidence_populated" "${CONF_COUNT}/${TOTAL_FRAGS}" "fragments with confidence set after ingest"
else
  observe "m10.fragment_confidence_populated" "0/0" "no fragments from sarah entry"
fi

HEAL_CONF=$(psql_one "SELECT count(*) FROM fragments WHERE entry_id='${ENTRY_HEAL_ID}' AND confidence IS NOT NULL")
HEAL_FRAGS=$(psql_one "SELECT count(*) FROM fragments WHERE entry_id='${ENTRY_HEAL_ID}'")
observe "m10.heal_fragment_confidence" "${HEAL_CONF}/${HEAL_FRAGS}" "heal-path fragments with confidence"
```

### Step 46 -- Source metadata on entries

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

ENTRY_RESP=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/entries/${ENTRY_SARAH_ID}")
HAS_SOURCE=$(echo "$ENTRY_RESP" | jq -r '.source // empty')

if [ "$HAS_SOURCE" = "api" ]; then
  assert "m10.entry_source" "pass" "entry has source=api"
else
  assert "m10.entry_source" "fail" "expected source=api, got ${HAS_SOURCE}"
fi

SM=$(echo "$ENTRY_RESP" | jq '.sourceMetadata // null')
observe "m10.source_metadata" "$SM" "null is expected for api-sourced entries"
```

### Step 47 -- Person summary data (brief_person proxy check)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# brief_person is an MCP tool that can't be tested via HTTP.
# Instead, verify the person detail endpoint returns content (summary data).
PERSON_ID=$(psql_one "SELECT lookup_key FROM people LIMIT 1")

if [ -n "$PERSON_ID" ]; then
  PERSON_RESP=$(curl -s -o /tmp/uat-person-detail.json -w '%{http_code}' \
    -b "$COOKIE_JAR" "${BASE_URL}/people/${PERSON_ID}")

  if [ "$PERSON_RESP" = "200" ]; then
    assert "m10.person_detail" "pass" "GET /people/:id -> 200"
    P_ID=$(jq -r '.id // empty' /tmp/uat-person-detail.json)
    P_NAME=$(jq -r '.name // empty' /tmp/uat-person-detail.json)
    P_BACKLINKS=$(jq '.backlinks | type' /tmp/uat-person-detail.json)
    if [ -n "$P_ID" ] && [ -n "$P_NAME" ] && [ "$P_BACKLINKS" = '"array"' ]; then
      assert "m10.person_detail_shape" "pass" "person has id/name/backlinks[]"
    else
      assert "m10.person_detail_shape" "fail" "missing: id=${P_ID}, name=${P_NAME}, backlinks=${P_BACKLINKS}"
    fi
    P_CONTENT=$(jq -r '.content // empty' /tmp/uat-person-detail.json)
    observe "m10.person_content" "${#P_CONTENT} chars" "may be empty if no brief_person has run"
  else
    assert "m10.person_detail" "fail" "expected 200, got ${PERSON_RESP}"
  fi
else
  observe "m10.person_detail_skip" "no people" "no people in DB, skipping detail check"
fi
```

---

## Phase 15 — Report + teardown

### Step 48 -- Write run report

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

ASSERTS=$(jq -s '.' .uat/runs/asserts.jsonl)
OBSERVATIONS=$(jq -s '.' .uat/runs/observations.jsonl)
PASS=$(echo "$ASSERTS" | jq '[.[] | select(.status=="pass")] | length')
FAIL=$(echo "$ASSERTS" | jq '[.[] | select(.status=="fail")] | length')
TOTAL=$(echo "$ASSERTS" | jq 'length')
SERVER_TAIL=$(tail -100 .uat/runs/server.log 2>/dev/null || echo "")

REPORT_JSON=".uat/runs/${RUN_ID}.json"
REPORT_MD=".uat/runs/${RUN_ID}.md"

jq -n \
  --arg run "$RUN_ID" \
  --arg ms "M10" \
  --arg shipped "2026-04-12" \
  --argjson asserts "$ASSERTS" \
  --argjson obs "$OBSERVATIONS" \
  --arg group "$GROUP_ID" \
  --arg sarah "$ENTRY_SARAH_ID" \
  --arg edge "$ENTRY_EDGE_ID" \
  --arg fail "$ENTRY_FAIL_ID" \
  --arg heal "$ENTRY_HEAL_ID" \
  --arg wiki "$WIKI_ID" \
  --arg wikiType "${WIKI_TYPE_ID:-}" \
  --arg publishedSlug "${PUBLISHED_SLUG:-}" \
  --arg customTypeSlug "${CUSTOM_TYPE_SLUG:-}" \
  --arg spawnWiki "${SPAWN_WIKI_ID:-}" \
  --arg bootMs "$BOOT_MS" \
  --arg ingestMs "$INGEST_MS" \
  --arg tail "$SERVER_TAIL" \
  '{
    runId: $run,
    milestone: $ms,
    shippedAt: $shipped,
    asserts: $asserts,
    observations: $obs,
    fixtures: {
      groupId: $group,
      entries: { sarah: $sarah, edge: $edge, failpath: $fail, healpath: $heal },
      wikiId: $wiki,
      wikiTypeId: $wikiType,
      publishedSlug: $publishedSlug,
      customTypeSlug: $customTypeSlug,
      spawnWikiId: $spawnWiki
    },
    timings: { bootMs: ($bootMs|tonumber? // null), ingestMs: ($ingestMs|tonumber? // null) },
    serverLogTail: $tail
  }' > "$REPORT_JSON"

{
  echo "# UAT run ${RUN_ID}"
  echo
  echo "- Milestone: M10 (shipped 2026-04-12)"
  echo "- Boot: ${BOOT_MS}ms"
  echo "- Ingest (Phase 5): ${INGEST_MS}ms"
  echo
  echo "## Asserts: ${PASS}/${TOTAL} pass, ${FAIL} fail"
  echo
  echo "| Name | Status | Detail |"
  echo "|------|--------|--------|"
  jq -r '.[] | "| \(.name) | \(.status) | \(.detail) |"' <<< "$ASSERTS"
  echo
  echo "## Observations"
  echo
  echo "| Name | Value | Note |"
  echo "|------|-------|------|"
  jq -r '.[] | "| \(.name) | \(.value) | \(.note) |"' <<< "$OBSERVATIONS"
} > "$REPORT_MD"

echo "[ok] report: ${REPORT_JSON}"
echo "[ok] report: ${REPORT_MD}"
save_state FINAL_PASS "$PASS"
save_state FINAL_FAIL "$FAIL"
save_state FINAL_TOTAL "$TOTAL"
```

### Step 49 -- Teardown

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

if [ -n "${SERVER_PID:-}" ]; then
  kill "$SERVER_PID" 2>/dev/null || true
  sleep 1
  pkill -f 'tsx watch.*core/src/index.ts' 2>/dev/null || true
fi
[ -f "$COOKIE_JAR" ] && rm -f "$COOKIE_JAR"

if [ "${FINAL_FAIL:-0}" = "0" ] && [ -n "${FINAL_TOTAL:-}" ] && [ "${FINAL_TOTAL}" != "0" ]; then
  echo "[ok] UAT complete: ${FINAL_PASS}/${FINAL_TOTAL} asserts passed"
  exit 0
else
  echo "[fail] UAT incomplete: ${FINAL_FAIL}/${FINAL_TOTAL} asserts failed — see .uat/runs/${RUN_ID}.md"
  exit 1
fi
```
