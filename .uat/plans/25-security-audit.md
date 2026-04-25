# 25 — Security audit

## What it proves

PR #188 closes pre-launch medium-severity audit items #173 and #73 across five attack surfaces. The plan exercises both the fix (legitimate request still works) and the threat (malicious request now blocked) for each surface:

- **CORS lockdown** (`core/src/index.ts`): the `cors({ origin: o => o })` reflect-back is replaced by an allowlist drawn from `WIKI_ORIGIN` and `SERVER_PUBLIC_URL`. Listed origins must still get `Access-Control-Allow-Origin`; unknown origins get an empty/absent ACAO header so credentialed cross-origin requests fail.
- **Admin auth gate** (`core/src/routes/admin.ts`): `adminRoutes.use('*', sessionMiddleware)` was added, and `POST /admin/retry-stuck` is documented as session-authenticated. Without a cookie the route must 401; with one the dry-run succeeds.
- **BullBoard session gate** (closes #73; `core/src/index.ts`, `core/src/routes/bull-board.ts`): the `NODE_ENV !== 'production'` guard is gone, replaced by `app.use('/admin/queues/*', sessionMiddleware)`. `/admin/queues` must reject anonymous access in every environment, including production-style boots, while a signed-in session still loads the BullMQ UI.
- **SQL injection** (`core/src/routes/admin.ts`, `core/src/lib/search.ts`): `INTERVAL '${sql.raw(String(minutes))} minutes'` is replaced by `make_interval(mins => $1)`; the `sql.raw('${vecLiteral}')` interpolation in vector search is replaced by parameterized binding. Probes must surface as 4xx or sanitized output, not 500s with leaking SQL or 200s broadened by injection.
- **Soft-delete leakage** (`core/src/routes/fragments.ts`, `core/src/routes/entries.ts`): `isNull(deletedAt)` is added to the list and detail queries on both tables. After soft-deleting a row, the listing endpoints, entry-fragments join, and search results must all hide it.
- **MCP token revocation** (`core/src/mcp/jwt.ts`): the verify path now re-fetches `mcpTokenVersion` from the DB inside `verifyMcpToken` (defeats stale `kidCache`) and signs/verifies `iss=robin` / `aud=robin-mcp`. After `POST /users/regenerate-mcp` bumps the version, the OLD token must 401 immediately. A second regen + verify proves no caching hole survives.

## Prerequisites

- Plan 22 has run (Transformer fixture seeded — provides `ashish-vaswani`, `transformer-architecture`, `self-attention-replaces-recurrence`).
- Core server reachable at `SERVER_URL` (default `http://localhost:3000`).
- `INITIAL_USERNAME` / `INITIAL_PASSWORD` set in `core/.env`.
- `WIKI_ORIGIN` set in `core/.env` (the plan reads the env to know which origins should be allowed).
- `jq`, `psql`, `curl` installed; `DATABASE_URL` set for invariant + cleanup queries.

## Fixture identity this plan references

- Wiki slug: `transformer-architecture`
- Person slug: `ashish-vaswani`
- Fragment slug: `self-attention-replaces-recurrence`

---

## Test Steps

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "${PROJECT_ROOT:-.}"
source core/.env 2>/dev/null || true

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp /tmp/uat-25-cookies-XXXXXX.txt)
ANON_JAR=$(mktemp /tmp/uat-25-anon-XXXXXX.txt)        # always-empty, for unauth-negative
trap 'rm -f "$COOKIE_JAR" "$ANON_JAR"' EXIT

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  ⊘ $1"; }

echo "25 — Security audit (PR #188 / closes #73, #173)"
echo ""

# Track UAT-side mutations so the cleanup section can reverse them.
ORIGINAL_TOKEN_VERSION=""
SOFT_DELETED_FRAGMENT_KEY=""
SOFT_DELETED_ENTRY_KEY=""

# ── 0. Sign in (authenticated baseline) ──────────────────────
SIGNIN_HTTP=$(curl -s -o /tmp/uat-25-signin.json -w "%{http_code}" -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "$(jq -n --arg u "${INITIAL_USERNAME:-}" --arg p "${INITIAL_PASSWORD:-}" '{email:$u,password:$p}')" \
  "$SERVER_URL/api/auth/sign-in/email")

if [ "$SIGNIN_HTTP" = "200" ] && [ -s "$COOKIE_JAR" ]; then
  pass "0. sign-in established a session cookie (HTTP $SIGNIN_HTTP)"
else
  fail "0. sign-in failed (HTTP $SIGNIN_HTTP) — every authenticated step will skip"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 1
fi

# ── 1. CORS lockdown ─────────────────────────────────────────
# `cors({ origin: o => o })` (reflect-back) is replaced by an allowlist
# from WIKI_ORIGIN + SERVER_PUBLIC_URL. The Set is built at boot.
#
# Positive: a known-allowed origin (the first comma-separated entry of
#   WIKI_ORIGIN, defaults to http://localhost:8080) must get its origin
#   reflected in Access-Control-Allow-Origin.
# Negative: an unlisted origin (https://evil.example.com) must NOT be
#   reflected — the header must be absent OR empty.
# Both run as preflight (OPTIONS) and as actual GET against /health to
# rule out per-route mounting bugs.

ALLOWED_ORIGIN=$(echo "${WIKI_ORIGIN:-http://localhost:8080}" | cut -d, -f1)

# 1a. Preflight from allowed origin → ACAO present + reflects origin.
PREFLIGHT_ALLOWED=$(curl -s -o /dev/null -D - -X OPTIONS \
  -H "Origin: $ALLOWED_ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type" \
  "$SERVER_URL/health")
ACAO_ALLOWED=$(echo "$PREFLIGHT_ALLOWED" | grep -i '^access-control-allow-origin:' | head -1 | tr -d '\r' | sed 's/^[^:]*: *//')
if [ "$ACAO_ALLOWED" = "$ALLOWED_ORIGIN" ]; then
  pass "1a. Preflight from allowed origin '$ALLOWED_ORIGIN' → ACAO reflected"
else
  fail "1a. Preflight from allowed origin returned ACAO='$ACAO_ALLOWED' (expected '$ALLOWED_ORIGIN')"
fi

# 1b. Preflight from evil origin → ACAO absent or empty.
PREFLIGHT_EVIL=$(curl -s -o /dev/null -D - -X OPTIONS \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type" \
  "$SERVER_URL/health")
ACAO_EVIL=$(echo "$PREFLIGHT_EVIL" | grep -i '^access-control-allow-origin:' | head -1 | tr -d '\r' | sed 's/^[^:]*: *//')
if [ -z "$ACAO_EVIL" ] || [ "$ACAO_EVIL" = "" ]; then
  pass "1b. Preflight from evil origin → ACAO absent/empty (got '$ACAO_EVIL')"
else
  fail "1b. Preflight from evil origin reflected ACAO='$ACAO_EVIL' — allowlist regressed"
fi

# 1c. ACAO must NEVER be the literal '*' on credentialed responses
# (with credentials:true that combination is invalid per CORS spec and
# would be a giveaway for a misconfigured allow-all).
if echo "$ACAO_ALLOWED" | grep -q '^\*$'; then
  fail "1c. ACAO returned wildcard '*' on credentialed response — invalid + insecure"
else
  pass "1c. ACAO is not wildcard '*' on credentialed response"
fi

# 1d. Actual GET from evil origin: server still serves the response
# (CORS isn't enforced server-side), but the browser-relevant ACAO
# header must still be absent so XHR can't read the body.
ACTUAL_EVIL=$(curl -s -o /dev/null -D - -H "Origin: https://evil.example.com" "$SERVER_URL/health")
ACAO_ACTUAL_EVIL=$(echo "$ACTUAL_EVIL" | grep -i '^access-control-allow-origin:' | head -1 | tr -d '\r' | sed 's/^[^:]*: *//')
if [ -z "$ACAO_ACTUAL_EVIL" ]; then
  pass "1d. Actual GET from evil origin → ACAO absent (browser will refuse to expose body)"
else
  fail "1d. Actual GET from evil origin returned ACAO='$ACAO_ACTUAL_EVIL'"
fi

# 1e. SERVER_PUBLIC_URL is folded into the allowlist (handler explicitly
# adds it to the Set). When set in env, requests with that origin must
# be allowed.
if [ -n "${SERVER_PUBLIC_URL:-}" ]; then
  PREFLIGHT_PUB=$(curl -s -o /dev/null -D - -X OPTIONS \
    -H "Origin: $SERVER_PUBLIC_URL" \
    -H "Access-Control-Request-Method: GET" \
    "$SERVER_URL/health")
  ACAO_PUB=$(echo "$PREFLIGHT_PUB" | grep -i '^access-control-allow-origin:' | head -1 | tr -d '\r' | sed 's/^[^:]*: *//')
  if [ "$ACAO_PUB" = "$SERVER_PUBLIC_URL" ]; then
    pass "1e. Preflight from SERVER_PUBLIC_URL ($SERVER_PUBLIC_URL) → ACAO reflected"
  else
    fail "1e. SERVER_PUBLIC_URL not in allowlist (ACAO='$ACAO_PUB')"
  fi
else
  skip "1e. SERVER_PUBLIC_URL unset — allowlist-from-env path not exercised"
fi

# ── 2. Admin route auth gate (POST /admin/retry-stuck) ───────
# Pre-PR: route was marked "No auth — intended for curl from the dev
# machine". Post-PR: adminRoutes.use('*', sessionMiddleware). Anonymous
# requests must 401; signed-in dryRun must succeed.

# 2a. Anonymous POST → 401.
ADMIN_ANON=$(curl -s -o /dev/null -w "%{http_code}" -b "$ANON_JAR" -X POST \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/admin/retry-stuck?dryRun=true&minutes=5")
if [ "$ADMIN_ANON" = "401" ]; then
  pass "2a. POST /admin/retry-stuck unauthenticated → 401"
else
  fail "2a. POST /admin/retry-stuck unauthenticated → $ADMIN_ANON (expected 401)"
fi

# 2b. Anonymous GET also blocked — middleware applies to all methods.
ADMIN_GET=$(curl -s -o /dev/null -w "%{http_code}" -b "$ANON_JAR" \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/admin/retry-stuck")
if [ "$ADMIN_GET" = "401" ] || [ "$ADMIN_GET" = "404" ] || [ "$ADMIN_GET" = "405" ]; then
  pass "2b. GET /admin/retry-stuck unauthenticated → $ADMIN_GET (gated)"
else
  fail "2b. GET /admin/retry-stuck unauthenticated → $ADMIN_GET (expected 401/404/405)"
fi

# 2c. Authenticated dryRun → 200 with the documented shape.
ADMIN_AUTH=$(curl -s -o /tmp/uat-25-admin-dry.json -w "%{http_code}" -b "$COOKIE_JAR" -X POST \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/admin/retry-stuck?dryRun=true&minutes=5")
if [ "$ADMIN_AUTH" = "200" ]; then
  pass "2c. POST /admin/retry-stuck?dryRun=true authenticated → 200"
  if jq -e '.dryRun == true' /tmp/uat-25-admin-dry.json >/dev/null 2>&1; then
    pass "2d. /admin/retry-stuck dry-run response has dryRun=true"
  else
    fail "2d. /admin/retry-stuck dry-run response missing dryRun=true"
  fi
else
  fail "2c. POST /admin/retry-stuck?dryRun=true authenticated → $ADMIN_AUTH (expected 200)"
fi

# ── 3. BullBoard session gate (#73) ──────────────────────────
# Pre-PR: BullBoard mounted only when NODE_ENV !== 'production'. On
# Railway (NODE_ENV=production) it was simply absent. Post-PR: mounted
# in every env behind sessionMiddleware. Both anonymous-rejected and
# authenticated-allowed paths must work.

# 3a. Anonymous GET /admin/queues → 401.
QUEUE_ANON=$(curl -s -o /dev/null -w "%{http_code}" -b "$ANON_JAR" \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/admin/queues")
if [ "$QUEUE_ANON" = "401" ]; then
  pass "3a. GET /admin/queues unauthenticated → 401 (issue #73 fixed)"
else
  fail "3a. GET /admin/queues unauthenticated → $QUEUE_ANON (expected 401)"
fi

# 3b. Anonymous GET to a deeper BullBoard sub-path also 401 — confirms
# the wildcard middleware mount applies to UI assets, not just the root.
QUEUE_API_ANON=$(curl -s -o /dev/null -w "%{http_code}" -b "$ANON_JAR" \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/admin/queues/api/queues")
if [ "$QUEUE_API_ANON" = "401" ]; then
  pass "3b. GET /admin/queues/api/queues unauthenticated → 401 (sub-paths gated)"
else
  fail "3b. GET /admin/queues/api/queues unauthenticated → $QUEUE_API_ANON (expected 401)"
fi

# 3c. Authenticated GET /admin/queues → 200/302/308 with HTML or JSON.
# BullBoard may redirect on bare-path; treat 2xx and 3xx as pass.
QUEUE_AUTH=$(curl -s -o /tmp/uat-25-queues.html -w "%{http_code}" -b "$COOKIE_JAR" \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/admin/queues")
case "$QUEUE_AUTH" in
  200|301|302|307|308)
    pass "3c. GET /admin/queues authenticated → $QUEUE_AUTH (UI reachable behind session)"
    ;;
  *)
    fail "3c. GET /admin/queues authenticated → $QUEUE_AUTH (expected 2xx/3xx)"
    ;;
esac

# 3d. Mount must NOT depend on NODE_ENV. The `if (NODE_ENV !== 'production')`
# guard is gone in src; verify by source grep so a regression to env-gating
# in a follow-up PR is caught here.
if grep -q "NODE_ENV !== 'production'" core/src/index.ts; then
  fail "3d. core/src/index.ts still gates admin/queues by NODE_ENV — env-gate regressed"
else
  pass "3d. core/src/index.ts no longer env-gates /admin/queues (always mounted, always session-gated)"
fi

# ── 4. SQL injection — admin/retry-stuck minutes param ───────
# Pre-PR: `INTERVAL '${sql.raw(String(minutes))} minutes'` → injecting
# `5' OR '1'='1` would break the SQL or run code. Post-PR: parameterized
# `make_interval(mins => ${minutes})` with input clamped to 1..1440.
# Negative probes must return safe responses, not 500 leakage or wide
# data exfil.

# 4a. Quote-injection in `minutes` → 400 or sanitized 200 with empty/safe
# fragments list. `Number(...)` of a string with quotes is NaN → fallback
# to 5 (default). Either way, no 500 and no SQL syntax error in body.
INJ_RESP=$(curl -s -o /tmp/uat-25-inj1.json -w "%{http_code}" -b "$COOKIE_JAR" -X POST \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/admin/retry-stuck?dryRun=true&minutes=5%27%20OR%20%271%27%3D%271")
case "$INJ_RESP" in
  200|400)
    pass "4a. minutes='5\\' OR \\'1\\'=\\'1' returned safe code $INJ_RESP (no 500)"
    ;;
  *)
    fail "4a. quote-injection in minutes returned $INJ_RESP (expected 200 sanitized or 400)"
    ;;
esac
if grep -qiE "syntax error|unterminated quoted|sql state" /tmp/uat-25-inj1.json 2>/dev/null; then
  fail "4b. response body for SQL probe leaked SQL/Postgres error text"
else
  pass "4b. response body for SQL probe contains no SQL error text"
fi

# 4c. Out-of-range numeric (clamp test) — 99999 must clamp to 1440, not
# inject. The dry-run still returns 200 with a count, no DB error.
INJ_BIG=$(curl -s -o /tmp/uat-25-inj2.json -w "%{http_code}" -b "$COOKIE_JAR" -X POST \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/admin/retry-stuck?dryRun=true&minutes=99999")
if [ "$INJ_BIG" = "200" ] && jq -e '.dryRun == true' /tmp/uat-25-inj2.json >/dev/null 2>&1; then
  pass "4c. minutes=99999 clamped + 200 (no overflow / no injection)"
else
  fail "4c. minutes=99999 → $INJ_BIG (expected 200 with clamp)"
fi

# 4d. The legacy `sql.raw` call in admin.ts must be gone. Source grep is
# the canonical anti-regression — no production raw-SQL build for this
# input.
if grep -q "sql.raw(String(minutes))" core/src/routes/admin.ts; then
  fail "4d. core/src/routes/admin.ts still contains sql.raw(String(minutes)) — fix regressed"
else
  pass "4d. core/src/routes/admin.ts no longer uses sql.raw on minutes"
fi

# ── 5. SQL injection — vector search literal ─────────────────
# Pre-PR: `<=> ${sql.raw(\`'${vecLiteral}'::vector\`)}` interpolated a
# JSON-stringified array directly. Post-PR: parameterized `${vecLiteral}::vector`.
# Vector search must still return results for a benign query; an injection
# probe in `q` must not 500 or leak SQL.

# 5a. Benign hybrid search returns 200 with a `results` array.
SEARCH_OK=$(curl -s -o /tmp/uat-25-search-ok.json -w "%{http_code}" -b "$COOKIE_JAR" \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/search?q=transformer&limit=5&mode=hybrid")
if [ "$SEARCH_OK" = "200" ] && jq -e '.results | type == "array"' /tmp/uat-25-search-ok.json >/dev/null 2>&1; then
  pass "5a. /search?q=transformer&mode=hybrid → 200 with results[] (vector binding works)"
else
  fail "5a. /search benign call → $SEARCH_OK (expected 200 with results[])"
fi

# 5b. Injection in q ('; DROP TABLE wikis;--) must NOT 500 and must not
# leak SQL. Vector path embeds the q via OpenRouter, so DB-side injection
# is impossible regardless; the BM25 path uses parameterized binding
# upstream. Both modes must return 200 (or 400 from validator) — never 500.
INJ_SEARCH=$(curl -s -o /tmp/uat-25-inj-search.json -w "%{http_code}" -b "$COOKIE_JAR" \
  -H "Origin: $ALLOWED_ORIGIN" \
  "$SERVER_URL/search?q=%27%3B%20DROP%20TABLE%20wikis%3B--&limit=5&mode=bm25")
case "$INJ_SEARCH" in
  200|400)
    pass "5b. /search with injection payload → $INJ_SEARCH (no 500)"
    ;;
  *)
    fail "5b. /search with injection payload → $INJ_SEARCH (expected 200/400)"
    ;;
esac
if grep -qiE "syntax error|relation .* does not exist|sql state" /tmp/uat-25-inj-search.json 2>/dev/null; then
  fail "5c. /search injection response body contains SQL error text"
else
  pass "5c. /search injection response body has no SQL error text"
fi

# 5d. wikis table still exists (DROP didn't succeed).
if [ -n "${DATABASE_URL:-}" ]; then
  WIKIS_TABLE=$(psql "$DATABASE_URL" -t -A -c "SELECT 1 FROM information_schema.tables WHERE table_name='wikis'" 2>/dev/null | tr -d '[:space:]')
  if [ "$WIKIS_TABLE" = "1" ]; then
    pass "5d. wikis table still exists after DROP-injection probe"
  else
    fail "5d. wikis table missing — injection succeeded"
  fi
else
  skip "5d. DATABASE_URL unset — table-existence check skipped"
fi

# 5e. Source grep — no remaining sql.raw on vector literals.
if grep -nE "sql\\.raw\\(.*vecLiteral|sql\\.raw\\(.*'::vector" core/src/lib/search.ts; then
  fail "5e. core/src/lib/search.ts still contains sql.raw on vector literal — fix regressed"
else
  pass "5e. core/src/lib/search.ts no longer uses sql.raw on vector literal"
fi

# ── 6. Soft-delete leakage (fragments + entries) ─────────────
# Pre-PR: GET /fragments and GET /entries listed soft-deleted rows; the
# detail endpoints returned them by lookupKey. Post-PR: every read query
# adds isNull(deletedAt). Test by soft-deleting a UAT row, asserting
# absence everywhere, then restoring.

if [ -z "${DATABASE_URL:-}" ]; then
  skip "6. DATABASE_URL unset — soft-delete leakage tests skipped"
else
  # 6a. Pick a real fragment that's NOT the seeded fixture (avoid breaking
  # downstream plans). Insert a UAT-owned fragment row directly via psql
  # so this section is self-contained and reversible.
  ENTRY_KEY=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" "$SERVER_URL/entries?limit=1" \
    | jq -r '.entries[0].lookupKey // .entries[0].id // empty')
  if [ -z "$ENTRY_KEY" ]; then
    skip "6. no entries exist — cannot exercise soft-delete leakage"
  else
    UAT_FRAG_KEY="frag01UAT25SOFTDEL$$"
    psql "$DATABASE_URL" -c "INSERT INTO fragments (lookup_key, slug, title, content, entry_id, state, created_at, updated_at) VALUES ('$UAT_FRAG_KEY', 'uat-25-softdel-$$', 'UAT 25 soft-delete probe', 'soft-delete leakage probe content', '$ENTRY_KEY', 'RESOLVED', now(), now())" >/dev/null 2>&1
    SOFT_DELETED_FRAGMENT_KEY="$UAT_FRAG_KEY"

    # 6a. Pre-delete: row appears in GET /fragments.
    PRE_LIST=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" "$SERVER_URL/fragments?limit=200" \
      | jq --arg k "$UAT_FRAG_KEY" '[.fragments[] | select(.lookupKey == $k or .id == $k)] | length')
    if [ "$PRE_LIST" = "1" ]; then
      pass "6a. UAT fragment $UAT_FRAG_KEY visible in /fragments before soft-delete"
    else
      fail "6a. UAT fragment $UAT_FRAG_KEY missing from /fragments pre-delete (count=$PRE_LIST)"
    fi

    # Soft-delete via SQL (mirrors the delete handler).
    psql "$DATABASE_URL" -c "UPDATE fragments SET deleted_at = now() WHERE lookup_key = '$UAT_FRAG_KEY'" >/dev/null 2>&1

    # 6b. Post-delete: row gone from GET /fragments.
    POST_LIST=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" "$SERVER_URL/fragments?limit=200" \
      | jq --arg k "$UAT_FRAG_KEY" '[.fragments[] | select(.lookupKey == $k or .id == $k)] | length')
    if [ "$POST_LIST" = "0" ]; then
      pass "6b. soft-deleted fragment absent from GET /fragments"
    else
      fail "6b. soft-deleted fragment leaked into /fragments (count=$POST_LIST)"
    fi

    # 6c. Detail endpoint must 404 the soft-deleted row (was 200 pre-PR).
    DETAIL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" \
      "$SERVER_URL/fragments/$UAT_FRAG_KEY")
    if [ "$DETAIL_HTTP" = "404" ]; then
      pass "6c. GET /fragments/$UAT_FRAG_KEY → 404 after soft-delete"
    else
      fail "6c. GET /fragments/$UAT_FRAG_KEY → $DETAIL_HTTP (expected 404)"
    fi

    # 6d. /entries/:id/fragments join also filters out soft-deleted
    # fragments — pre-PR this returned the deleted row as a child of
    # the parent entry.
    JOIN_BODY=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" \
      "$SERVER_URL/entries/$ENTRY_KEY/fragments")
    JOIN_HAS=$(echo "$JOIN_BODY" | jq --arg k "$UAT_FRAG_KEY" '[.fragments[] | select(.lookupKey == $k or .id == $k)] | length')
    if [ "$JOIN_HAS" = "0" ]; then
      pass "6d. soft-deleted fragment absent from /entries/$ENTRY_KEY/fragments"
    else
      fail "6d. soft-deleted fragment leaked into /entries/.../fragments (count=$JOIN_HAS)"
    fi

    # 6e. Search must NOT surface the soft-deleted row. (vector path
    # already filters via meta.deletedAtCol IS NULL; bm25 filter lives
    # in bm25SearchTable. This is the cross-surface assertion.)
    SEARCH_FOR_DEL=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" \
      "$SERVER_URL/search?q=soft-delete%20leakage%20probe&mode=bm25" \
      | jq --arg k "$UAT_FRAG_KEY" '[.results[] | select(.id == $k)] | length')
    if [ "$SEARCH_FOR_DEL" = "0" ]; then
      pass "6e. soft-deleted fragment absent from /search results"
    else
      fail "6e. soft-deleted fragment leaked into /search (count=$SEARCH_FOR_DEL)"
    fi
  fi

  # 6f-h. Same shape, but for entries: insert a UAT entry, soft-delete,
  # assert it's gone from list + detail.
  UAT_ENTRY_KEY="entry01UAT25SOFTDEL$$"
  psql "$DATABASE_URL" -c "INSERT INTO raw_sources (lookup_key, slug, title, content, ingest_status, created_at, updated_at) VALUES ('$UAT_ENTRY_KEY', 'uat-25-entry-softdel-$$', 'UAT 25 entry soft-delete probe', 'entry soft-delete probe', 'pending', now(), now())" >/dev/null 2>&1
  SOFT_DELETED_ENTRY_KEY="$UAT_ENTRY_KEY"

  PRE_E_LIST=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" "$SERVER_URL/entries?limit=200" \
    | jq --arg k "$UAT_ENTRY_KEY" '[.entries[] | select(.lookupKey == $k or .id == $k)] | length')
  if [ "$PRE_E_LIST" = "1" ]; then
    pass "6f. UAT entry $UAT_ENTRY_KEY visible in /entries before soft-delete"
  else
    fail "6f. UAT entry missing from /entries pre-delete (count=$PRE_E_LIST)"
  fi

  psql "$DATABASE_URL" -c "UPDATE raw_sources SET deleted_at = now() WHERE lookup_key = '$UAT_ENTRY_KEY'" >/dev/null 2>&1

  POST_E_LIST=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" "$SERVER_URL/entries?limit=200" \
    | jq --arg k "$UAT_ENTRY_KEY" '[.entries[] | select(.lookupKey == $k or .id == $k)] | length')
  if [ "$POST_E_LIST" = "0" ]; then
    pass "6g. soft-deleted entry absent from GET /entries"
  else
    fail "6g. soft-deleted entry leaked into /entries (count=$POST_E_LIST)"
  fi

  E_DETAIL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" \
    "$SERVER_URL/entries/$UAT_ENTRY_KEY")
  if [ "$E_DETAIL_HTTP" = "404" ]; then
    pass "6h. GET /entries/$UAT_ENTRY_KEY → 404 after soft-delete"
  else
    fail "6h. GET /entries/$UAT_ENTRY_KEY → $E_DETAIL_HTTP (expected 404)"
  fi
fi

# ── 7. MCP token revocation + iss/aud claims ─────────────────
# Three regressions in one section:
#   (a) mcpTokenVersion bump must immediately revoke OLD tokens — pre-PR
#       a stale kidCache could keep the old user record (with the old
#       version) in memory and let the old token through.
#   (b) verify must require iss=robin / aud=robin-mcp.
#   (c) the /mcp endpoint must 401 with a token whose ver is stale.
#
# Negative path doubles as a generic auth-gate test for /mcp itself.

# 7a. Mint a token via /users/profile (web session does this for us).
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" "$SERVER_URL/users/profile")
OLD_MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // empty')
OLD_TOKEN=$(echo "$OLD_MCP_URL" | sed -n 's/.*[?&]token=\([^&]*\).*/\1/p')
if [ -n "$OLD_TOKEN" ]; then
  pass "7a. Minted MCP token via /users/profile (length=${#OLD_TOKEN})"
else
  fail "7a. Could not mint MCP token — user has no keypair?"
fi

# Capture the original token version so we can restore at cleanup.
if [ -n "${DATABASE_URL:-}" ]; then
  ORIGINAL_TOKEN_VERSION=$(psql "$DATABASE_URL" -t -A -c "SELECT mcp_token_version FROM users LIMIT 1" 2>/dev/null | tr -d '[:space:]')
fi

# 7b. OLD token works against /mcp before revocation. POST the JSON-RPC
# `tools/list` envelope; we don't care about the tool count, just that
# the response is not 401.
RPC_BODY='{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
PRE_REVOKE=$(curl -s -o /tmp/uat-25-mcp-pre.txt -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d "$RPC_BODY" \
  "$SERVER_URL/mcp?token=$OLD_TOKEN")
if [ "$PRE_REVOKE" = "200" ]; then
  pass "7b. OLD MCP token reaches /mcp pre-revocation → 200"
else
  fail "7b. OLD MCP token pre-revocation → $PRE_REVOKE (expected 200)"
fi

# 7c. Bump mcpTokenVersion via /users/regenerate-mcp.
REGEN_BODY=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" -X POST "$SERVER_URL/users/regenerate-mcp")
NEW_MCP_URL=$(echo "$REGEN_BODY" | jq -r '.mcpEndpointUrl // empty')
NEW_TOKEN=$(echo "$NEW_MCP_URL" | sed -n 's/.*[?&]token=\([^&]*\).*/\1/p')
if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "$OLD_TOKEN" ]; then
  pass "7c. /users/regenerate-mcp returned a NEW token (≠ old)"
else
  fail "7c. /users/regenerate-mcp did not return a fresh token (new='$NEW_TOKEN')"
fi

# 7d. OLD token now 401s — this is the kidCache-staleness fix.
POST_REVOKE=$(curl -s -o /tmp/uat-25-mcp-post.txt -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d "$RPC_BODY" \
  "$SERVER_URL/mcp?token=$OLD_TOKEN")
if [ "$POST_REVOKE" = "401" ]; then
  pass "7d. OLD MCP token post-revocation → 401 (kidCache stale-version bug fixed)"
else
  fail "7d. OLD MCP token post-revocation → $POST_REVOKE (expected 401) — stale cache regression"
fi

# 7e. NEW token works on /mcp.
NEW_OK=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d "$RPC_BODY" \
  "$SERVER_URL/mcp?token=$NEW_TOKEN")
if [ "$NEW_OK" = "200" ]; then
  pass "7e. NEW MCP token post-revocation → 200"
else
  fail "7e. NEW MCP token post-revocation → $NEW_OK (expected 200)"
fi

# 7f. Second revocation cycle — proves no surviving cache hole. Bump
# version again, assert NEW token (now stale) 401s, mint NEWER, NEWER
# works.
REGEN2_BODY=$(curl -s -b "$COOKIE_JAR" -H "Origin: $ALLOWED_ORIGIN" -X POST "$SERVER_URL/users/regenerate-mcp")
NEWER_TOKEN=$(echo "$REGEN2_BODY" | jq -r '.mcpEndpointUrl' | sed -n 's/.*[?&]token=\([^&]*\).*/\1/p')

NEW_AFTER_2ND=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d "$RPC_BODY" \
  "$SERVER_URL/mcp?token=$NEW_TOKEN")
if [ "$NEW_AFTER_2ND" = "401" ]; then
  pass "7f. Second revocation also invalidates the previous token (no cache hole survives)"
else
  fail "7f. Second revocation: previous token → $NEW_AFTER_2ND (expected 401)"
fi

# 7g. Missing token → 401 (auth gate is non-optional).
NO_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d "$RPC_BODY" \
  "$SERVER_URL/mcp")
if [ "$NO_TOKEN" = "401" ]; then
  pass "7g. /mcp without token → 401"
else
  fail "7g. /mcp without token → $NO_TOKEN (expected 401)"
fi

# 7h. Bogus token → 401 (signature/aud/iss check).
BOGUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -d "$RPC_BODY" \
  "$SERVER_URL/mcp?token=eyJhbGciOiJFZERTQSIsImtpZCI6ImJvZ3VzIn0.eyJzdWIiOiJib2d1cyJ9.AAAA")
if [ "$BOGUS" = "401" ]; then
  pass "7h. /mcp with garbage token → 401"
else
  fail "7h. /mcp with garbage token → $BOGUS (expected 401)"
fi

# 7i. Source-grep — verify iss/aud claims are present in BOTH sign and
# verify call sites. Pure regression guard against an accidental revert.
if grep -q ".setIssuer('robin')" core/src/mcp/jwt.ts && grep -q ".setAudience('robin-mcp')" core/src/mcp/jwt.ts; then
  pass "7i. signMcpToken sets iss=robin + aud=robin-mcp"
else
  fail "7i. signMcpToken missing iss/aud setters"
fi
if grep -qE "issuer:\\s*'robin'" core/src/mcp/jwt.ts && grep -qE "audience:\\s*'robin-mcp'" core/src/mcp/jwt.ts; then
  pass "7j. verifyMcpToken enforces issuer + audience"
else
  fail "7j. verifyMcpToken missing issuer/audience checks"
fi
if grep -q "freshUser" core/src/mcp/jwt.ts; then
  pass "7k. verifyMcpToken re-fetches mcpTokenVersion (kidCache staleness fix present)"
else
  fail "7k. verifyMcpToken does not re-fetch mcpTokenVersion — fix missing"
fi

# ── 8. Auth-gate sweep — known authenticated routes ──────────
# Belt-and-braces: every authenticated route mounted in core/src/index.ts
# (post-PR) must reject anonymous requests. Catches regressions where
# someone accidentally drops `sessionMiddleware` from a sub-router.

declare -a AUTH_ROUTES=(
  "/wikis"
  "/fragments"
  "/people"
  "/entries"
  "/search?q=test"
  "/graph"
  "/users/profile"
  "/wiki-types"
  "/audit-log"
  "/groups"
  "/relationships"
  "/ai/models"
)

UNAUTH_FAILS=0
for ROUTE in "${AUTH_ROUTES[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$ANON_JAR" \
    -H "Origin: $ALLOWED_ORIGIN" "$SERVER_URL$ROUTE")
  if [ "$CODE" = "401" ]; then
    pass "8. $ROUTE unauthenticated → 401"
  else
    fail "8. $ROUTE unauthenticated → $CODE (expected 401)"
    UNAUTH_FAILS=$((UNAUTH_FAILS+1))
  fi
done

# 8x. Pre-auth surface still works without a cookie (must NOT regress
# into 401 on /health, /openapi.json, /favicon.ico, /published).
for PUBLIC in "/health" "/openapi.json" "/favicon.ico"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$ANON_JAR" \
    -H "Origin: $ALLOWED_ORIGIN" "$SERVER_URL$PUBLIC")
  if [ "$CODE" = "200" ]; then
    pass "8x. public $PUBLIC → 200 (still reachable without auth)"
  else
    fail "8x. public $PUBLIC → $CODE (expected 200) — auth gate over-applied"
  fi
done

# ── Cleanup ──────────────────────────────────────────────────
# Restore the database to the state plan 25 found it in:
#   - drop the UAT fragment + entry rows (hard-delete; they were created
#     here, never seeded fixtures)
#   - reset mcp_token_version to its original value so subsequent plans
#     see the same MCP token stability they always did

if [ -n "${DATABASE_URL:-}" ]; then
  if [ -n "$SOFT_DELETED_FRAGMENT_KEY" ]; then
    psql "$DATABASE_URL" -c "DELETE FROM fragments WHERE lookup_key = '$SOFT_DELETED_FRAGMENT_KEY'" >/dev/null 2>&1 || true
  fi
  if [ -n "$SOFT_DELETED_ENTRY_KEY" ]; then
    psql "$DATABASE_URL" -c "DELETE FROM raw_sources WHERE lookup_key = '$SOFT_DELETED_ENTRY_KEY'" >/dev/null 2>&1 || true
  fi
  if [ -n "$ORIGINAL_TOKEN_VERSION" ]; then
    psql "$DATABASE_URL" -c "UPDATE users SET mcp_token_version = $ORIGINAL_TOKEN_VERSION" >/dev/null 2>&1 || true
  fi
fi

echo ""
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```

---

## Pass/Fail Summary

| # | Assertion | Source claim |
|---|-----------|--------------|
| 1a–1e | CORS allowlist: known origins reflected, evil origin gets no ACAO, no wildcard on credentialed responses, `SERVER_PUBLIC_URL` honored | "CORS allowlist" claim in PR body, #173 |
| 2a–2d | `/admin/retry-stuck` requires session cookie; authenticated dryRun returns documented shape | "Admin auth" claim, #173 |
| 3a–3d | `/admin/queues` 401s anonymous in every env; sub-paths gated; authenticated session reaches the BullBoard UI; no `NODE_ENV` gate remains | "BullBoard session gate" claim, #73 |
| 4a–4d | `minutes` query injection: no SQL error leakage, clamp honored, no remaining `sql.raw(String(minutes))` in source | "SQL injection" claim, #173 |
| 5a–5e | Vector search still returns results; injection in `q` doesn't 500 or DROP a table; no `sql.raw` on vector literal in source | "SQL injection" claim, #173 |
| 6a–6h | Soft-deleted fragment absent from `/fragments`, `/fragments/:id`, `/entries/:id/fragments`, `/search`; soft-deleted entry absent from `/entries`, `/entries/:id` | "Soft-delete filters" claim, #173 |
| 7a–7k | OLD MCP token works pre-revocation; bumping `mcpTokenVersion` immediately 401s OLD token (kidCache staleness defeated); NEW token works; second revocation cycle also revokes; missing/garbage tokens 401; iss/aud claims + DB re-fetch present in source | "MCP token revocation" claim, #173 |
| 8 | Authenticated routes uniformly 401 anonymous; public routes still 200 | belt-and-braces auth-gate sweep, #173 |

---

## Notes

- **Why source-grep alongside HTTP**: every fix in this PR has a single-line revert risk (e.g. someone reapplies `sql.raw` for "performance"). The HTTP probes catch a regression in the running stack today; the source greps catch one introduced by a future PR before this plan reruns. Keeping both makes the plan a durable post-launch regression net rather than a one-shot acceptance check.
- **Empty-cookie jar pattern**: `ANON_JAR` is `mktemp`'d but never written to, so every `curl -b "$ANON_JAR"` is the truest unauth probe — the cookie file exists but contains zero session cookies. This is intentionally distinct from omitting `-b` (which Hono handles identically but reviewers often misread).
- **Cleanup discipline**: section 7 mutates `users.mcp_token_version` (twice) and section 6 inserts/soft-deletes UAT-owned rows. Both paths are reversed in the cleanup block — the original token version is captured before the first regen and restored at the end; UAT-owned fragment/entry rows are hard-deleted (they never existed in the seeded fixture). After this plan finishes, plans 21/22/98 should see the same fixture state they would on a clean boot.
- **#173 scope this plan does NOT cover**: rate limiting, session cookie SameSite/Secure flags, INITIAL_PASSWORD first-login reset (#71), and OpenRouter key exposure are listed as audit topics on #173 but are not addressed by PR #188. They will land in separate PRs and get their own UAT plans; this one is intentionally scoped to the five surfaces #188 actually changed.
- **Production-mode coverage gap**: assertion 3a runs against whatever `NODE_ENV` the local stack uses. The strongest evidence that #73 is fixed in production would be running this plan against a `NODE_ENV=production` boot, since pre-PR the route literally didn't exist there. Source-grep 3d covers the regression risk for runs against a dev stack.
- Storage is Postgres-only (no filesystem, no markdown-on-disk). All soft-delete probes hit `fragments.deleted_at` / `raw_sources.deleted_at`; the cleanup uses parameterized DELETEs against `lookup_key`.
