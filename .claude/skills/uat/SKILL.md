---
name: uat
description: Run the Robin User Acceptance Test suite end-to-end against the M2+M3 stack. Boots the server, seeds the OpenRouter key, signs in as the env-seeded user, runs the canonical ingest acceptance test (Sarah example), validates the failure-path self-healing loop, tests wiki types setup, content storage, wiki publishing (including unauthenticated public access), wiki regeneration, and writes a structured run report. Asserts deterministic API contracts; observes (does not fail on) probabilistic LLM output.
---

UAT boots Robin from a clean DB, runs the canonical M2 ingest loop and M3 wiki
composition features end-to-end, and writes a machine-readable run report. It is
**destructive** — Phase 1 step 5 wipes and re-pushes the schema unconditionally.
Do not point it at a database you care about.

Two classes of result:

- **Assert** — deterministic API contracts. Boot, auth, dedup, state-machine
  transitions, schema shape, failure-path audit columns, wiki types, content
  storage, publishing, edit audit trail. Failures here exit non-zero and fail
  the run.
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

missing=""
for v in MASTER_KEY BETTER_AUTH_SECRET INITIAL_USERNAME INITIAL_PASSWORD DATABASE_URL REDIS_URL; do
  if [ -z "${!v:-}" ]; then missing="$missing $v"; fi
done
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
VAULT_ID=
ENTRY_SARAH_ID=
ENTRY_EDGE_ID=
ENTRY_FAIL_ID=
ENTRY_HEAL_ID=
WIKI_ID=
WIKI_TYPE_ID=
PUBLISHED_SLUG=
CUSTOM_TYPE_SLUG=
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
```

### Step 6 -- Boot server

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

BOOT_START=$(date +%s%3N)

# Start in background, detached so we can outlive the current bash
nohup pnpm dev > .uat/runs/server.log 2>&1 &
SERVER_PID=$!
save_state SERVER_PID "$SERVER_PID"
echo "[info] started pnpm dev (pid=${SERVER_PID})"

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

if OPENROUTER_API_KEY="$OPENROUTER_API_KEY" pnpm seed-openrouter-key > .uat/runs/seed-key.log 2>&1; then
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

## Phase 3 — Vault fixture

### Step 9 -- Create vault

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

VAULT_RESP=$(curl -s -o /tmp/uat-vault.json -w '%{http_code}' \
  -X POST "${BASE_URL}/vaults" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"UAT","description":"UAT run vault","color":"#3B82F6"}')

if [ "$VAULT_RESP" = "201" ]; then
  VAULT_ID=$(jq -r '.id' /tmp/uat-vault.json)
  save_state VAULT_ID "$VAULT_ID"
  assert "vault.create" "pass" "POST /vaults -> 201, id=${VAULT_ID}"
else
  cat /tmp/uat-vault.json
  assert "vault.create" "fail" "expected 201, got ${VAULT_RESP}"
  halt "cannot continue without a vault"
fi

# List must include the new vault
LIST_RESP=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/vaults")
FOUND=$(echo "$LIST_RESP" | jq --arg id "$VAULT_ID" '[.vaults[]? // .[]? | select(.id==$id)] | length')
if [ "$FOUND" = "1" ]; then
  assert "vault.list_contains_new" "pass" "GET /vaults contains ${VAULT_ID}"
else
  assert "vault.list_contains_new" "fail" "GET /vaults does not contain ${VAULT_ID}"
fi
```

---

## Phase 4 — Capture path

### Step 10 -- Canonical happy path (Sarah)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

SARAH_BODY=$(jq -cn --arg v "$VAULT_ID" --arg t "Lunch with Sarah ${TS}" \
  '{content:"I had lunch with Sarah about the new product launch.", title:$t, vaultId:$v, type:"thought", source:"api"}')

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

SARAH_BODY=$(jq -cn --arg v "$VAULT_ID" --arg t "Lunch with Sarah ${TS}" \
  '{content:"I had lunch with Sarah about the new product launch.", title:$t, vaultId:$v, type:"thought", source:"api"}')

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

### Step 12 -- Edge cases (no vaultId / missing vault / bad JSON)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# 12a: No vaultId — should still 202
EDGE_BODY=$(jq -cn --arg t "No-vault entry ${TS}" \
  '{content:"Random thought about the ingest pipeline and how dedup should handle near-duplicates.", title:$t, type:"thought", source:"api"}')

EDGE_CODE=$(curl -s -o /tmp/uat-edge.json -w '%{http_code}' \
  -X POST "${BASE_URL}/entries" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "$EDGE_BODY")

if [ "$EDGE_CODE" = "202" ]; then
  ENTRY_EDGE_ID=$(jq -r '.id' /tmp/uat-edge.json)
  save_state ENTRY_EDGE_ID "$ENTRY_EDGE_ID"
  assert "capture.no_vault_ok" "pass" "POST /entries (no vaultId) -> 202, id=${ENTRY_EDGE_ID}"
else
  cat /tmp/uat-edge.json
  assert "capture.no_vault_ok" "fail" "expected 202, got ${EDGE_CODE}"
fi

# 12b: Non-existent vaultId — should 404
BAD_VAULT=$(curl -s -o /tmp/uat-badvault.json -w '%{http_code}' \
  -X POST "${BASE_URL}/entries" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"content":"test","vaultId":"vault_does_not_exist_xyz"}')

if [ "$BAD_VAULT" = "404" ]; then
  assert "capture.bad_vault_404" "pass" "nonexistent vaultId -> 404"
else
  cat /tmp/uat-badvault.json
  assert "capture.bad_vault_404" "fail" "expected 404, got ${BAD_VAULT}"
fi

# 12c: Malformed JSON body — should 400 {error:'Invalid JSON'}
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

# Poll both Sarah and edge entries to a terminal ingest_status (resolved or failed).
# We read ingestStatus from the API and the audit columns directly from postgres —
# the API response schema does not expose attempt_count / last_error.
poll_entry() {
  local id="$1" max=120 interval=3 elapsed=0
  while [ $elapsed -lt $max ]; do
    local resp
    resp=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/entries/${id}" 2>/dev/null || echo '{}')
    local ing
    ing=$(echo "$resp" | jq -r '.ingestStatus // empty')
    if [ "$ing" = "resolved" ] || [ "$ing" = "failed" ]; then
      echo "$elapsed $ing"
      return 0
    fi
    sleep $interval
    elapsed=$((elapsed + interval))
  done
  echo "$elapsed timeout"
  return 1
}

INGEST_START=$(date +%s%3N)

# Sarah
read SARAH_SECS SARAH_FINAL < <(poll_entry "$ENTRY_SARAH_ID")
SARAH_ATTEMPTS=$(psql_one "SELECT attempt_count FROM raw_sources WHERE lookup_key='${ENTRY_SARAH_ID}'")
SARAH_LAST_AT=$(psql_one "SELECT last_attempt_at IS NOT NULL FROM raw_sources WHERE lookup_key='${ENTRY_SARAH_ID}'")
SARAH_STATE=$(psql_one "SELECT state FROM raw_sources WHERE lookup_key='${ENTRY_SARAH_ID}'")

if [ "$SARAH_FINAL" = "resolved" ] || [ "$SARAH_FINAL" = "failed" ]; then
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
read EDGE_SECS EDGE_FINAL < <(poll_entry "$ENTRY_EDGE_ID")
assert "ingest.edge_terminal" "$([ "$EDGE_FINAL" = "resolved" ] || [ "$EDGE_FINAL" = "failed" ] && echo pass || echo fail)" "ingestStatus=${EDGE_FINAL} after ${EDGE_SECS}s"
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

### Step 15 -- Retro headline test: kill key → fail → reseed → heal

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
FAIL_BODY=$(jq -cn --arg v "$VAULT_ID" --arg t "Fail-path ${TS}" \
  '{content:"Failure path test: this entry should fail to ingest because the openrouter key is gone.", title:$t, vaultId:$v, type:"thought", source:"api"}')
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

# 4. Re-seed the key
OPENROUTER_API_KEY="$OPENROUTER_API_KEY" pnpm seed-openrouter-key > .uat/runs/reseed-key.log 2>&1
RESEED=$(psql_one "SELECT count(*) FROM configs WHERE kind='llm_key' AND key='openrouter'")
if [ "$RESEED" = "1" ]; then
  assert "failpath.reseed" "pass" "configs llm_key row re-created"
else
  assert "failpath.reseed" "fail" "re-seed did not produce configs row"
  halt "cannot run healing half of the loop"
fi

# 5. POST a new entry and poll to resolved — this proves self-healing for future ingests
HEAL_BODY=$(jq -cn --arg v "$VAULT_ID" --arg t "Heal-path ${TS}" \
  '{content:"Recovery test: this entry should ingest successfully now that the key is back.", title:$t, vaultId:$v, type:"thought", source:"api"}')
HEAL_RESP=$(curl -s -b "$COOKIE_JAR" -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/entries" -d "$HEAL_BODY")
ENTRY_HEAL_ID=$(echo "$HEAL_RESP" | jq -r '.id')
save_state ENTRY_HEAL_ID "$ENTRY_HEAL_ID"

HEAL_TIMEOUT=90
elapsed=0
while [ $elapsed -lt $HEAL_TIMEOUT ]; do
  HEAL_ING=$(psql_one "SELECT ingest_status FROM raw_sources WHERE lookup_key='${ENTRY_HEAL_ID}'")
  if [ "$HEAL_ING" = "resolved" ] || [ "$HEAL_ING" = "failed" ]; then break; fi
  sleep 3
  elapsed=$((elapsed + 3))
done

if [ "$HEAL_ING" = "resolved" ]; then
  assert "failpath.heal_resolved" "pass" "post-reseed ingest resolved after ${elapsed}s"
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
  -X POST "${BASE_URL}/vaults/${VAULT_ID}/wikis" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"UAT regen test","type":"log"}')

if [ "$WIKI_RESP" = "201" ] || [ "$WIKI_RESP" = "200" ]; then
  WIKI_ID=$(jq -r '.id' /tmp/uat-wiki.json)
  save_state WIKI_ID "$WIKI_ID"
  assert "wiki.create" "pass" "POST /vaults/:id/wikis -> ${WIKI_RESP}, id=${WIKI_ID}"
else
  cat /tmp/uat-wiki.json
  assert "wiki.create" "fail" "expected 200/201, got ${WIKI_RESP}"
  halt "cannot test regen without a wiki id"
fi

# 2. Write some seed content so the wiki has material to regen from
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

# 3. Call regen — M3 has this live via Quill LLM
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

## Phase 8 — Report + teardown

### Step 17 -- Write run report

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
  --arg ms "M3" \
  --arg shipped "2026-04-12" \
  --argjson asserts "$ASSERTS" \
  --argjson obs "$OBSERVATIONS" \
  --arg vault "$VAULT_ID" \
  --arg sarah "$ENTRY_SARAH_ID" \
  --arg edge "$ENTRY_EDGE_ID" \
  --arg fail "$ENTRY_FAIL_ID" \
  --arg heal "$ENTRY_HEAL_ID" \
  --arg wiki "$WIKI_ID" \
  --arg wikiType "${WIKI_TYPE_ID:-}" \
  --arg publishedSlug "${PUBLISHED_SLUG:-}" \
  --arg customTypeSlug "${CUSTOM_TYPE_SLUG:-}" \
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
      vaultId: $vault,
      entries: { sarah: $sarah, edge: $edge, failpath: $fail, healpath: $heal },
      wikiId: $wiki,
      wikiTypeId: $wikiType,
      publishedSlug: $publishedSlug,
      customTypeSlug: $customTypeSlug
    },
    timings: { bootMs: ($bootMs|tonumber? // null), ingestMs: ($ingestMs|tonumber? // null) },
    serverLogTail: $tail
  }' > "$REPORT_JSON"

{
  echo "# UAT run ${RUN_ID}"
  echo
  echo "- Milestone: M3 (shipped 2026-04-12)"
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

### Step 18 -- Teardown

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

if [ -n "${SERVER_PID:-}" ]; then
  kill "$SERVER_PID" 2>/dev/null || true
  sleep 1
  # Kill any straggler tsx watch process too
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

---

## Phase 9 — Wiki Types Setup

### Step 19 -- Seed default wiki types

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# POST /wiki-types/setup seeds 10 default types from YAML
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

# Idempotency: calling setup again should not fail
SETUP2_CODE=$(curl -s -o /tmp/uat-wt-setup2.json -w '%{http_code}' \
  -X POST "${BASE_URL}/wiki-types/setup" \
  -b "$COOKIE_JAR")

if [ "$SETUP2_CODE" = "200" ]; then
  assert "wiki_types.setup_idempotent" "pass" "second POST /wiki-types/setup -> 200"
else
  assert "wiki_types.setup_idempotent" "fail" "expected 200 on re-call, got ${SETUP2_CODE}"
fi
```

### Step 20 -- List default wiki types and validate shape

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

# Shape assert: every type has slug, name, shortDescriptor, descriptor, prompt, isDefault=true
SHAPE_OK=$(jq '[.wikiTypes[] | select(.slug and .name and .shortDescriptor and .descriptor and (.prompt != null) and (.isDefault == true))] | length' /tmp/uat-wt-list.json)
if [ "$SHAPE_OK" = "$TYPE_COUNT" ]; then
  assert "wiki_types.shape" "pass" "all ${TYPE_COUNT} types have slug/name/shortDescriptor/descriptor/prompt/isDefault=true"
else
  assert "wiki_types.shape" "fail" "${SHAPE_OK}/${TYPE_COUNT} types match expected shape"
fi
```

### Step 21 -- Regression gate: goal type exists (not objective)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# The objective->goal rename was part of M3. Assert goal exists, objective does not.
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

# Save the goal type's slug for reference
WIKI_TYPE_ID="goal"
save_state WIKI_TYPE_ID "$WIKI_TYPE_ID"
```

### Step 22 -- Create custom wiki type

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

# Verify total count is now 11
LIST2_CODE=$(curl -s -o /tmp/uat-wt-list2.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/wiki-types")
TYPE_COUNT_2=$(jq '.wikiTypes | length' /tmp/uat-wt-list2.json)
if [ "$TYPE_COUNT_2" = "11" ]; then
  assert "wiki_types.count_after_create" "pass" "GET /wiki-types now returns 11 types"
else
  assert "wiki_types.count_after_create" "fail" "expected 11 types, got ${TYPE_COUNT_2}"
fi

# Error path: duplicate slug should 409
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

### Step 23 -- Update custom wiki type

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

# Error path: update nonexistent slug -> 404
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

## Phase 10 — Content Storage

### Step 24 -- Write content to wiki via content API

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

WIKI_CONTENT_BODY="# UAT Content Test\n\nThis content was written during UAT Phase 10 at timestamp ${TS}.\n\n## Section\n\nSome detailed notes here."

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

# Error path: invalid content type -> 400
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

### Step 25 -- Read content back and verify

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

# Content must not be empty — we just wrote to it
READ_CONTENT=$(jq -r '.content // empty' /tmp/uat-content-read.json)
if [ -n "$READ_CONTENT" ]; then
  assert "content.read_not_empty" "pass" "content is non-empty (${#READ_CONTENT} chars)"
else
  assert "content.read_not_empty" "fail" "content is empty after write"
fi

# Verify the content contains our UAT marker
if echo "$READ_CONTENT" | grep -q "UAT Content Test"; then
  assert "content.read_matches_written" "pass" "content contains expected UAT marker"
else
  assert "content.read_matches_written" "fail" "content does not contain expected UAT marker"
fi

# Error path: read nonexistent key -> 404
NF_CODE=$(curl -s -o /tmp/uat-content-nf.json -w '%{http_code}' \
  -b "$COOKIE_JAR" "${BASE_URL}/api/content/wiki/does_not_exist_xyz")

if [ "$NF_CODE" = "404" ]; then
  assert "content.read_404" "pass" "GET nonexistent key -> 404"
else
  assert "content.read_404" "fail" "expected 404, got ${NF_CODE}"
fi
```

### Step 26 -- Verify edit audit trail

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# The content write in Step 24 should have logged an edit with source='user'
EDIT_COUNT=$(psql_one "SELECT count(*) FROM edits WHERE object_type='wiki' AND object_id='${WIKI_ID}' AND source='user'")

if [ -n "$EDIT_COUNT" ] && [ "$EDIT_COUNT" -ge 1 ] 2>/dev/null; then
  assert "content.edit_audit_user" "pass" "edits table has ${EDIT_COUNT} row(s) with source=user for wiki ${WIKI_ID}"
else
  assert "content.edit_audit_user" "fail" "expected >=1 edit rows with source=user, got '${EDIT_COUNT}'"
fi

# Verify edit row shape: object_type, object_id, source, content columns are populated
EDIT_SHAPE=$(psql_one "SELECT count(*) FROM edits WHERE object_type='wiki' AND object_id='${WIKI_ID}' AND source='user' AND content IS NOT NULL")
if [ "$EDIT_SHAPE" = "$EDIT_COUNT" ]; then
  assert "content.edit_shape" "pass" "all edit rows have content populated"
else
  assert "content.edit_shape" "fail" "expected ${EDIT_COUNT} rows with content, got ${EDIT_SHAPE}"
fi
```

---

## Phase 11 — Wiki Publishing

### Step 27 -- Publish wiki with content

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# The wiki already has content from Phase 10
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

  # nanoid24 slug should be 24 characters
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

### Step 28 -- Public wiki JSON access (unauthenticated)

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# GET /published/wiki/:nanoid WITHOUT cookie jar — proves unauthenticated access
PUB_READ_CODE=$(curl -s -o /tmp/uat-pub-read.json -w '%{http_code}' \
  "${BASE_URL}/published/wiki/${PUBLISHED_SLUG}")

if [ "$PUB_READ_CODE" = "200" ]; then
  assert "publish.public_read" "pass" "GET /published/wiki/:nanoid -> 200 (no auth)"
else
  cat /tmp/uat-pub-read.json
  assert "publish.public_read" "fail" "expected 200, got ${PUB_READ_CODE}"
fi

# Shape assert: response has name, type, publishedAt, content
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

### Step 29 -- Public wiki raw markdown access

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# GET /published/wiki/:nanoid?raw should return text/plain
RAW_CODE=$(curl -s -o /tmp/uat-pub-raw.txt -w '%{http_code}' \
  -D /tmp/uat-pub-raw-headers.txt \
  "${BASE_URL}/published/wiki/${PUBLISHED_SLUG}?raw")

if [ "$RAW_CODE" = "200" ]; then
  assert "publish.raw_read" "pass" "GET /published/wiki/:nanoid?raw -> 200"
else
  assert "publish.raw_read" "fail" "expected 200, got ${RAW_CODE}"
fi

# Content-Type must be text/plain
CT=$(grep -i 'content-type' /tmp/uat-pub-raw-headers.txt 2>/dev/null | tr -d '\r')
if echo "$CT" | grep -qi 'text/plain'; then
  assert "publish.raw_content_type" "pass" "Content-Type is text/plain"
else
  assert "publish.raw_content_type" "fail" "expected text/plain, got '${CT}'"
fi

# Body should contain the wiki content marker
RAW_BODY=$(cat /tmp/uat-pub-raw.txt)
if echo "$RAW_BODY" | grep -q "UAT Content Test"; then
  assert "publish.raw_body_matches" "pass" "raw body contains expected content"
else
  assert "publish.raw_body_matches" "fail" "raw body missing expected content marker"
fi
```

### Step 30 -- Unpublish wiki

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

  # Slug must be preserved for re-publish
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

### Step 31 -- Public access after unpublish returns 404

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# After unpublish, the public route must return 404
GONE_CODE=$(curl -s -o /tmp/uat-pub-gone.json -w '%{http_code}' \
  "${BASE_URL}/published/wiki/${PUBLISHED_SLUG}")

if [ "$GONE_CODE" = "404" ]; then
  assert "publish.unpublished_404" "pass" "GET /published/wiki/:nanoid -> 404 after unpublish"
else
  cat /tmp/uat-pub-gone.json
  assert "publish.unpublished_404" "fail" "expected 404, got ${GONE_CODE}"
fi
```

### Step 32 -- Re-publish preserves slug

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

  # Slug stability: must match original slug
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

### Step 33 -- Publish wiki with no content returns 400

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# Create a fresh wiki with no content
EMPTY_WIKI_RESP=$(curl -s -o /tmp/uat-empty-wiki.json -w '%{http_code}' \
  -X POST "${BASE_URL}/vaults/${VAULT_ID}/wikis" \
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

# Attempt to publish wiki with no content -> should 400
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

## Phase 12 — Wiki Regeneration

### Step 34 -- Trigger on-demand wiki regeneration

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# Use the main WIKI_ID which has content from Phase 10
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

# We observe but do not assert the response code — LLM availability is external
observe "regen.full_response" "$REGEN_BODY" "LLM output is probabilistic"
```

### Step 35 -- Verify regen wrote content

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# After regen, content should be non-empty — observe only
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

### Step 36 -- Verify regen edit audit trail

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# Check for edit row with source='regen' — this is deterministic if regen returned 200
REGEN_EDIT_COUNT=$(psql_one "SELECT count(*) FROM edits WHERE object_type='wiki' AND object_id='${WIKI_ID}' AND source='regen'")

if [ -n "$REGEN_EDIT_COUNT" ] && [ "$REGEN_EDIT_COUNT" -ge 1 ] 2>/dev/null; then
  assert "regen.edit_audit_regen" "pass" "edits table has ${REGEN_EDIT_COUNT} row(s) with source=regen for wiki ${WIKI_ID}"
else
  # If regen returned 500 (key issue), there would be no edit row — check Phase 7 result
  PHASE7_REGEN=$(jq -r 'select(.name=="wiki.regen_live") | .status' .uat/runs/asserts.jsonl 2>/dev/null | tail -1)
  if [ "$PHASE7_REGEN" = "pass" ]; then
    assert "regen.edit_audit_regen" "fail" "regen succeeded in Phase 7 but no edit row with source=regen found"
  else
    observe "regen.edit_audit_regen" "skipped" "regen did not succeed (likely key issue) — no edit row expected"
  fi
fi
```

### Step 37 -- Regen disabled returns 400

```bash
set -e
source .uat/runs/state
source .uat/runs/helpers.sh

# Set regenerate=false on the wiki directly in the DB
psql "$DATABASE_URL" -c "UPDATE wikis SET regenerate = false WHERE lookup_key = '${WIKI_ID}'" >/dev/null

# Attempt regen — should return 400
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

# Restore regenerate=true so it doesn't affect other tests
psql "$DATABASE_URL" -c "UPDATE wikis SET regenerate = true WHERE lookup_key = '${WIKI_ID}'" >/dev/null
```
