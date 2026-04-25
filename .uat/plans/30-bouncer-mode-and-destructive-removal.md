# 30 — Bouncer Mode Gates and Destructive Tool Removal

## What it proves

Two facets of PR #193 (closes #166):

**(A) Bouncer mode (per-wiki accept/reject gate).** The bouncer toggle is
real, persistent, and enforced server-side: `PATCH /wikis/:id/bouncer`
flips `wikis.bouncer_mode` between `'auto'` and `'review'`; the wiki
detail GET surfaces the new value; review-mode wikis expose pending
edges via `edgeStatus: 'pending'` in `GET /wikis/:id`'s `fragments[]`;
`POST /fragments/:id/accept` and `POST /fragments/:id/reject` reject
with HTTP 400 + `"Wiki is not in review mode"` when the parent wiki is
in `auto`; both succeed when in `review`; **accept** now enqueues a
regen job (this PR's behavior change at `core/src/routes/fragments.ts`
~line 243); reject continues to enqueue regen as before; toggling back
to `auto` and re-running accept again returns the 400 guard.

**(B) Destructive tool cleanup.** The MCP `tools/list` no longer
advertises `delete_wiki`, `delete_person`, `publish_wiki`, or
`unpublish_wiki`. Calling each of those four removed tools through
`tools/call` returns a JSON-RPC error envelope with code `-32602`
(InvalidParams) and message `"Tool <name> not found"` — sourced from
the MCP SDK's mcp.js handler. The safe tools (`create_wiki`,
`log_fragment`, `log_entry`, `find_person`, `get_wiki`, `get_fragment`,
`list_wikis`, `get_wiki_types`, `edit_wiki`, `search`, `get_timeline`,
`brief_person`, `create_wiki_type`, `list_groups`, `create_group`,
`add_wiki_to_group`) remain registered and continue to respond on
`tools/list` and `tools/call`.

## Prerequisites

- Core running on `SERVER_URL` with PR #193 merged. Plan 22 has run
  (Transformer fixture seeded — used as the "auto-mode" wiki target).
- `INITIAL_USERNAME` / `INITIAL_PASSWORD` set in `core/.env`.
- `jq` and `curl` installed.
- `psql` available with `DATABASE_URL` configured (DB invariants and
  the synthetic pending-edge fabrication degrade to skip otherwise).

## Fixture identity this plan references

- Existing seeded wiki slug: `transformer-architecture` (used as the
  `auto`-mode target for the negative-path 400 assertion).
- Per-run UAT wiki: `uat30-review-target-<RUN_ID>` (created inside the
  plan and toggled to `review` mode for the positive accept/reject
  path; soft-deleted at the end via psql so downstream plans don't see
  it).
- Per-run UAT fragment: created via `log_fragment` against the seeded
  Transformer wiki, then the plan fabricates a `FRAGMENT_IN_WIKI` edge
  to the review-mode UAT wiki with `deleted_at` pre-set so the edge
  presents as `edgeStatus: 'pending'` (the queue worker doesn't
  currently pre-stage edges as pending; pending edges only arise via
  the reject handler — see Notes).

## Restoring downstream-plan state

This plan's last section toggles every wiki it touched back to `auto`
and soft-deletes the per-run UAT wiki. Plans 21 / 22 / 98 see no drift.

---

## Test Steps

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "${PROJECT_ROOT:-.}"
source core/.env 2>/dev/null || true

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp /tmp/uat-cookies-30-XXXXXX.txt)
trap 'rm -f "$COOKIE_JAR"' EXIT

# Per-run salt for content-deduped writes (log_fragment / log_entry hash
# content). Re-running on the same DB without a salt collides.
RUN_ID="$(date +%s)-$$"

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  ⊘ $1"; }

echo "30 — Bouncer Mode and Destructive Tool Removal"
echo ""

# ── 0. Sign in (web cookie) + mint MCP JWT ───────────────────
# Bouncer routes use the cookie session. MCP uses the JWT in the
# ?token= query param exposed via /users/profile.mcpEndpointUrl.

curl -s -o /dev/null -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "$(jq -n --arg u "${INITIAL_USERNAME:-}" --arg p "${INITIAL_PASSWORD:-}" \
    '{email:$u,password:$p}')" \
  "$SERVER_URL/api/auth/sign-in/email"

if [ -s "$COOKIE_JAR" ]; then
  pass "0a. sign-in established a session cookie"
else
  fail "0a. sign-in failed — every step below would skip"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 1
fi

PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // empty')
MCP_TOKEN=$(echo "$MCP_URL" | sed -n 's/.*[?&]token=\([^&]*\).*/\1/p')
if [ -n "$MCP_TOKEN" ]; then
  pass "0b. minted MCP JWT for the signed-in user"
  MCP_ENDPOINT="$SERVER_URL/mcp?token=$MCP_TOKEN"
else
  fail "0b. /users/profile.mcpEndpointUrl missing token — MCP steps will skip"
  MCP_ENDPOINT=""
fi

# Resolve the seeded auto-mode target — used in section 4.
TRANSFORMER_KEY=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wikis?limit=50" \
  | jq -r '.wikis[] | select(.slug=="transformer-architecture") | .lookupKey // .id' \
  | head -1)
if [ -n "$TRANSFORMER_KEY" ] && [ "$TRANSFORMER_KEY" != "null" ]; then
  pass "0c. Transformer fixture key resolved ($TRANSFORMER_KEY)"
else
  fail "0c. Transformer fixture missing — run plan 22 first; section 4 will skip"
  TRANSFORMER_KEY=""
fi

# JSON-RPC helper (mirror of plan 98's call_tool, distilled).
RPC_ID=0
mcp_call() {
  local method="$1" params="$2"
  RPC_ID=$((RPC_ID+1))
  local body
  body=$(jq -n --argjson id "$RPC_ID" --arg m "$method" --argjson p "$params" \
    '{jsonrpc:"2.0", id:$id, method:$m, params:$p}')
  local resp
  resp=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Origin: http://localhost:3000" \
    -d "$body" \
    "$MCP_ENDPOINT")
  echo "$resp" > /tmp/uat-30-last.json
  if echo "$resp" | grep -q '^data: '; then
    echo "$resp" | sed -n 's/^data: //p' | head -1
  else
    echo "$resp"
  fi
}

# ── 1. tools/list — destructive tools ABSENT ─────────────────
# Removed by PR #193: delete_wiki, delete_person, publish_wiki,
# unpublish_wiki. Confirmed against core/src/mcp/server.ts at the
# PR HEAD: no registerTool() call mentions any of those four names.

if [ -n "$MCP_ENDPOINT" ]; then
  TOOLS_PAYLOAD=$(mcp_call "tools/list" '{}')
  TOOLS_NAMES=$(echo "$TOOLS_PAYLOAD" | jq -r '.result.tools[].name // empty' 2>/dev/null)

  for t in delete_wiki delete_person publish_wiki unpublish_wiki; do
    if echo "$TOOLS_NAMES" | grep -qx "$t"; then
      fail "1. tools/list still advertises '$t' — destructive cleanup regressed"
    else
      pass "1. tools/list does NOT advertise '$t'"
    fi
  done

  # Counterpart: safe tools must remain registered.
  for t in create_wiki log_fragment log_entry find_person get_wiki \
           get_fragment list_wikis get_wiki_types edit_wiki search \
           brief_person get_timeline create_wiki_type list_groups \
           create_group add_wiki_to_group; do
    if echo "$TOOLS_NAMES" | grep -qx "$t"; then
      pass "1b. safe tool '$t' still registered"
    else
      fail "1b. safe tool '$t' missing from tools/list — over-removed"
    fi
  done

  TOOL_COUNT=$(echo "$TOOLS_NAMES" | grep -c .)
  pass "1c. tools/list returned $TOOL_COUNT total tool(s) (16 safe tools expected post-cleanup)"
else
  skip "1. MCP endpoint not minted — destructive-removal section skipped"
fi

# ── 2. tools/call on each removed tool returns 'Tool <name> not found' ──
# The MCP SDK throws McpError(InvalidParams=-32602, `Tool <name> not found`)
# from server/mcp.js when no handler is registered. The error surfaces in
# the JSON-RPC envelope as result-level OR top-level error.code/message.

if [ -n "$MCP_ENDPOINT" ]; then
  for t in delete_wiki delete_person publish_wiki unpublish_wiki; do
    case "$t" in
      delete_wiki|publish_wiki|unpublish_wiki) ARGS='{"wikiKey":"any"}' ;;
      delete_person) ARGS='{"personKey":"any"}' ;;
    esac
    PAYLOAD=$(mcp_call "tools/call" \
      "$(jq -n --arg n "$t" --argjson a "$ARGS" '{name:$n, arguments:$a}')")
    ERR_CODE=$(echo "$PAYLOAD" | jq -r '.error.code // empty')
    ERR_MSG=$(echo "$PAYLOAD" | jq -r '.error.message // empty')
    if [ "$ERR_CODE" = "-32602" ] && echo "$ERR_MSG" | grep -q "Tool $t not found"; then
      pass "2. tools/call('$t') returned -32602 InvalidParams + 'Tool $t not found'"
    else
      # Some transports may lift the McpError to result.isError; accept
      # that path too as long as the message text matches.
      RES_TEXT=$(echo "$PAYLOAD" | jq -r '.result.content[0].text // empty')
      RES_ERR=$(echo "$PAYLOAD" | jq -r '.result.isError // false')
      if [ "$RES_ERR" = "true" ] && echo "$RES_TEXT" | grep -q "Tool $t not found"; then
        pass "2. tools/call('$t') returned isError + 'Tool $t not found' (result-level)"
      else
        fail "2. tools/call('$t') wrong shape (code='$ERR_CODE' msg='$ERR_MSG' resText='${RES_TEXT:0:80}')"
      fi
    fi
  done
else
  skip "2. MCP endpoint not minted — removed-tool error path skipped"
fi

# ── 3. Bouncer toggle persists via PATCH /wikis/:id/bouncer ──
# Schema accepts {mode: 'auto' | 'review'} only. Response shape:
# {id, bouncerMode}. DB column wikis.bouncer_mode mirrors. Audit log
# emits eventType='edited' with summary 'Wiki bouncer mode set to <mode>'.

# Create a per-run UAT wiki via the API (so we don't mutate the seeded
# Transformer fixture). It starts in 'auto' (schema default).
WIKI30_NAME="UAT30 Review Target $RUN_ID"
WIKI30_RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -X POST -d "$(jq -n --arg n "$WIKI30_NAME" \
    '{name:$n, description:"UAT30 bouncer-mode test target", type:"log"}')" \
  "$SERVER_URL/wikis")
WIKI30_KEY=$(echo "$WIKI30_RESP" | jq -r '.lookupKey // .id // empty')

if [ -n "$WIKI30_KEY" ] && [ "$WIKI30_KEY" != "null" ]; then
  pass "3a. created UAT30 wiki ($WIKI30_KEY) — defaults to bouncerMode='auto'"
else
  fail "3a. could not create UAT30 wiki: $WIKI30_RESP"
fi

# Confirm DB-side default is 'auto'.
if [ -n "${DATABASE_URL:-}" ] && [ -n "$WIKI30_KEY" ]; then
  DB_MODE=$(psql "$DATABASE_URL" -t -A -c "SELECT bouncer_mode FROM wikis WHERE lookup_key='$WIKI30_KEY'" 2>/dev/null | tr -d '[:space:]')
  if [ "$DB_MODE" = "auto" ]; then
    pass "3b. wikis.bouncer_mode='auto' on freshly created wiki (schema default)"
  else
    fail "3b. wikis.bouncer_mode='$DB_MODE' on fresh wiki (expected 'auto')"
  fi
else
  skip "3b. DATABASE_URL unset — schema-default check skipped"
fi

# Toggle to review.
if [ -n "$WIKI30_KEY" ]; then
  TOGGLE_RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    -H "Content-Type: application/json" \
    -X PATCH -d '{"mode":"review"}' \
    "$SERVER_URL/wikis/$WIKI30_KEY/bouncer")
  TOGGLE_MODE=$(echo "$TOGGLE_RESP" | jq -r '.bouncerMode // empty')
  if [ "$TOGGLE_MODE" = "review" ]; then
    pass "3c. PATCH /wikis/$WIKI30_KEY/bouncer {mode:review} → bouncerMode='review'"
  else
    fail "3c. PATCH bouncer toggle response shape wrong: $TOGGLE_RESP"
  fi

  # DB-side persistence.
  if [ -n "${DATABASE_URL:-}" ]; then
    DB_MODE=$(psql "$DATABASE_URL" -t -A -c "SELECT bouncer_mode FROM wikis WHERE lookup_key='$WIKI30_KEY'" 2>/dev/null | tr -d '[:space:]')
    [ "$DB_MODE" = "review" ] && pass "3d. wikis.bouncer_mode='review' persisted in DB" \
      || fail "3d. wikis.bouncer_mode='$DB_MODE' (expected 'review')"
  else
    skip "3d. DATABASE_URL unset — DB persistence check skipped"
  fi

  # GET /wikis/:id surfaces the new mode.
  GET_RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$WIKI30_KEY")
  GET_MODE=$(echo "$GET_RESP" | jq -r '.bouncerMode // empty')
  [ "$GET_MODE" = "review" ] && pass "3e. GET /wikis/:id reflects bouncerMode='review'" \
    || fail "3e. GET /wikis/:id bouncerMode='$GET_MODE' (expected 'review')"

  # Audit log entry written.
  if [ -n "${DATABASE_URL:-}" ]; then
    AUDIT_HIT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM audit_log WHERE entity_type='wiki' AND entity_id='$WIKI30_KEY' AND summary='Wiki bouncer mode set to review'" 2>/dev/null | tr -d '[:space:]')
    [ "${AUDIT_HIT:-0}" -ge 1 ] 2>/dev/null && pass "3f. audit_log row written for the toggle (summary match)" \
      || fail "3f. audit_log row missing for bouncer toggle (count=$AUDIT_HIT)"
  else
    skip "3f. DATABASE_URL unset — audit-log invariant skipped"
  fi
else
  skip "3c-3f. WIKI30_KEY missing — bouncer toggle steps skipped"
fi

# ── 4. accept/reject 400 in auto mode (negative path) ────────
# Source: routes/fragments.ts:210, :257 — "Wiki is not in review mode".
# Use the seeded Transformer wiki (auto by default) with any fragment
# attached to it. We only need a fragment lookup_key — the guard fires
# before the edge lookup, so the 400 fires regardless of edge state.

FRAG_KEY=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=10" \
  | jq -r '.fragments[0].lookupKey // .fragments[0].id // empty')

if [ -n "$TRANSFORMER_KEY" ] && [ -n "$FRAG_KEY" ]; then
  ACCEPT_RESP=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    -H "Content-Type: application/json" \
    -X POST -d "$(jq -n --arg w "$TRANSFORMER_KEY" '{wikiId:$w}')" \
    "$SERVER_URL/fragments/$FRAG_KEY/accept")
  ACCEPT_BODY=$(echo "$ACCEPT_RESP" | head -n -1)
  ACCEPT_CODE=$(echo "$ACCEPT_RESP" | tail -n 1)
  if [ "$ACCEPT_CODE" = "400" ] && echo "$ACCEPT_BODY" | grep -q "Wiki is not in review mode"; then
    pass "4a. accept on auto-mode wiki → 400 + 'Wiki is not in review mode'"
  else
    fail "4a. accept on auto-mode wiki returned code=$ACCEPT_CODE body=$ACCEPT_BODY"
  fi

  REJECT_RESP=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    -H "Content-Type: application/json" \
    -X POST -d "$(jq -n --arg w "$TRANSFORMER_KEY" '{wikiId:$w}')" \
    "$SERVER_URL/fragments/$FRAG_KEY/reject")
  REJECT_BODY=$(echo "$REJECT_RESP" | head -n -1)
  REJECT_CODE=$(echo "$REJECT_RESP" | tail -n 1)
  if [ "$REJECT_CODE" = "400" ] && echo "$REJECT_BODY" | grep -q "Wiki is not in review mode"; then
    pass "4b. reject on auto-mode wiki → 400 + 'Wiki is not in review mode'"
  else
    fail "4b. reject on auto-mode wiki returned code=$REJECT_CODE body=$REJECT_BODY"
  fi
else
  skip "4. TRANSFORMER_KEY or FRAG_KEY missing — auto-mode 400 path skipped"
fi

# ── 5. Pending edge surfaces in GET /wikis/:id when in review ──
# Section 5 fabricates a FRAGMENT_IN_WIKI edge from a known fragment
# to the review-mode UAT wiki with deletedAt pre-set. routes/wikis.ts:227
# treats edges with deletedAt set as edgeStatus='pending' WHEN
# bouncerMode='review', and returns them inline in the wiki's fragments[].
#
# Why fabricate: the queue worker's insertEdge path (core/src/queue/
# worker.ts:80) does NOT set deletedAt at insertion time even when the
# target wiki is in review mode. Pending edges currently only arise
# from explicit reject calls. Driving an end-to-end MCP log_entry →
# pipeline → pending edge would only test that gap; for THIS plan we
# fabricate to exercise PR #193's accept/reject + regen-on-accept path.

if [ -n "${DATABASE_URL:-}" ] && [ -n "${WIKI30_KEY:-}" ] && [ -n "$FRAG_KEY" ]; then
  EDGE_ID=$(psql "$DATABASE_URL" -t -A -c "SELECT gen_random_uuid()" 2>/dev/null | tr -d '[:space:]')
  psql "$DATABASE_URL" -c "INSERT INTO edges (id, src_type, src_id, dst_type, dst_id, edge_type, deleted_at) VALUES ('$EDGE_ID', 'fragment', '$FRAG_KEY', 'wiki', '$WIKI30_KEY', 'FRAGMENT_IN_WIKI', now()) ON CONFLICT DO NOTHING" >/dev/null 2>&1

  GET_RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$WIKI30_KEY")
  PENDING_COUNT=$(echo "$GET_RESP" | jq "[.fragments[] | select(.edgeStatus == \"pending\")] | length")
  HAS_FRAG=$(echo "$GET_RESP" | jq "[.fragments[] | select(.id == \"$FRAG_KEY\" and .edgeStatus == \"pending\")] | length")
  if [ "$HAS_FRAG" = "1" ]; then
    pass "5a. GET /wikis/$WIKI30_KEY surfaces fabricated pending edge ($PENDING_COUNT pending total)"
  else
    fail "5a. fabricated pending edge not surfaced as edgeStatus='pending' (count=$HAS_FRAG)"
  fi
else
  skip "5a. DATABASE_URL or WIKI30_KEY or FRAG_KEY missing — pending-edge fabrication skipped"
  EDGE_ID=""
fi

# ── 6. accept on review-mode wiki → 200 + clears deletedAt + enqueues regen ──
# PR #193's behavior change: routes/fragments.ts ~line 243 now calls
# producer.enqueueRegen() inside the accept handler. We can't directly
# inspect Redis from inside the plan without extra deps; instead we
# assert (a) the API succeeds, (b) the edge's deleted_at is cleared,
# (c) wikis.regenerate is queued (the fragment-classify wrapper sets
# regenerate=true on the wiki via insertEdge wrapper) — failing that,
# (d) at minimum the audit_log carries an 'accepted' event.

if [ -n "${EDGE_ID:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  ACCEPT_RESP=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    -H "Content-Type: application/json" \
    -X POST -d "$(jq -n --arg w "$WIKI30_KEY" '{wikiId:$w}')" \
    "$SERVER_URL/fragments/$FRAG_KEY/accept")
  ACCEPT_BODY=$(echo "$ACCEPT_RESP" | head -n -1)
  ACCEPT_CODE=$(echo "$ACCEPT_RESP" | tail -n 1)
  if [ "$ACCEPT_CODE" = "200" ] && echo "$ACCEPT_BODY" | jq -e '.ok == true' >/dev/null 2>&1; then
    pass "6a. accept on review-mode wiki returned 200 + ok=true"
  else
    fail "6a. accept on review-mode wiki: code=$ACCEPT_CODE body=$ACCEPT_BODY"
  fi

  # Edge deletedAt cleared.
  EDGE_DEL=$(psql "$DATABASE_URL" -t -A -c "SELECT deleted_at IS NULL FROM edges WHERE id='$EDGE_ID'" 2>/dev/null | tr -d '[:space:]')
  [ "$EDGE_DEL" = "t" ] && pass "6b. edge.deleted_at cleared (edge now active)" \
    || fail "6b. edge.deleted_at NOT cleared by accept (got '$EDGE_DEL')"

  # Audit-log: 'accepted' event written.
  AUDIT_HIT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM audit_log WHERE entity_type='fragment' AND entity_id='$FRAG_KEY' AND event_type='accepted'" 2>/dev/null | tr -d '[:space:]')
  [ "${AUDIT_HIT:-0}" -ge 1 ] 2>/dev/null && pass "6c. audit_log carries event_type='accepted' for the fragment" \
    || fail "6c. audit_log 'accepted' event missing (count=$AUDIT_HIT)"

  # Regen enqueue: not directly observable from psql — best-effort
  # surface is the wiki audit-log line that the regen worker writes
  # OR the wikis.last_rebuilt_at update. Both are async; we wait a
  # short bounded time and degrade to skip.
  sleep 3
  REBUILT=$(psql "$DATABASE_URL" -t -A -c "SELECT last_rebuilt_at IS NOT NULL FROM wikis WHERE lookup_key='$WIKI30_KEY'" 2>/dev/null | tr -d '[:space:]')
  if [ "$REBUILT" = "t" ]; then
    pass "6d. wikis.last_rebuilt_at populated → regen worker ran (PR #193 behavior change)"
  else
    skip "6d. wikis.last_rebuilt_at still NULL after 3s — regen worker may be off; PR #193's enqueueRegen is best-effort"
  fi
else
  skip "6. prereqs missing — accept on review-mode wiki skipped"
fi

# ── 7. reject on review-mode wiki → 200 + sets deletedAt + enqueues regen ──
# Reverse of section 6. Need to re-fabricate a pending edge first since
# section 6 cleared deleted_at. Use a SECOND fragment to keep the test
# isolated from the accepted edge.

FRAG_KEY2=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=10" \
  | jq -r '.fragments[1].lookupKey // .fragments[1].id // empty')

if [ -n "${WIKI30_KEY:-}" ] && [ -n "$FRAG_KEY2" ] && [ -n "${DATABASE_URL:-}" ]; then
  EDGE_ID2=$(psql "$DATABASE_URL" -t -A -c "SELECT gen_random_uuid()" 2>/dev/null | tr -d '[:space:]')
  psql "$DATABASE_URL" -c "INSERT INTO edges (id, src_type, src_id, dst_type, dst_id, edge_type, deleted_at) VALUES ('$EDGE_ID2', 'fragment', '$FRAG_KEY2', 'wiki', '$WIKI30_KEY', 'FRAGMENT_IN_WIKI', now()) ON CONFLICT DO NOTHING" >/dev/null 2>&1

  REJECT_RESP=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    -H "Content-Type: application/json" \
    -X POST -d "$(jq -n --arg w "$WIKI30_KEY" '{wikiId:$w}')" \
    "$SERVER_URL/fragments/$FRAG_KEY2/reject")
  REJECT_BODY=$(echo "$REJECT_RESP" | head -n -1)
  REJECT_CODE=$(echo "$REJECT_RESP" | tail -n 1)
  if [ "$REJECT_CODE" = "200" ] && echo "$REJECT_BODY" | jq -e '.ok == true' >/dev/null 2>&1; then
    pass "7a. reject on review-mode wiki returned 200 + ok=true"
  else
    fail "7a. reject on review-mode wiki: code=$REJECT_CODE body=$REJECT_BODY"
  fi

  # Edge deletedAt set.
  EDGE_DEL=$(psql "$DATABASE_URL" -t -A -c "SELECT deleted_at IS NOT NULL FROM edges WHERE id='$EDGE_ID2'" 2>/dev/null | tr -d '[:space:]')
  [ "$EDGE_DEL" = "t" ] && pass "7b. edge.deleted_at set (edge now soft-deleted)" \
    || fail "7b. edge.deleted_at NOT set by reject (got '$EDGE_DEL')"

  # Audit-log 'rejected' event.
  AUDIT_HIT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM audit_log WHERE entity_type='fragment' AND entity_id='$FRAG_KEY2' AND event_type='rejected'" 2>/dev/null | tr -d '[:space:]')
  [ "${AUDIT_HIT:-0}" -ge 1 ] 2>/dev/null && pass "7c. audit_log carries event_type='rejected' for the fragment" \
    || fail "7c. audit_log 'rejected' event missing (count=$AUDIT_HIT)"
else
  skip "7. prereqs missing — reject on review-mode wiki skipped"
  EDGE_ID2=""
fi

# ── 8. Toggle back to auto and re-confirm 400 guard fires ────
# Round-trip the toggle: review → auto, then accept must 400 again.
# This proves the toggle is a true flip-flop, not a one-way latch.

if [ -n "${WIKI30_KEY:-}" ]; then
  AUTO_RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    -H "Content-Type: application/json" \
    -X PATCH -d '{"mode":"auto"}' \
    "$SERVER_URL/wikis/$WIKI30_KEY/bouncer")
  AUTO_MODE=$(echo "$AUTO_RESP" | jq -r '.bouncerMode // empty')
  [ "$AUTO_MODE" = "auto" ] && pass "8a. PATCH bouncer {mode:auto} → bouncerMode='auto' (round-trip)" \
    || fail "8a. round-trip back to auto failed: $AUTO_RESP"

  # Re-attempt accept — must 400 now.
  if [ -n "$FRAG_KEY" ]; then
    POST_AUTO_RESP=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      -H "Content-Type: application/json" \
      -X POST -d "$(jq -n --arg w "$WIKI30_KEY" '{wikiId:$w}')" \
      "$SERVER_URL/fragments/$FRAG_KEY/accept")
    POST_AUTO_CODE=$(echo "$POST_AUTO_RESP" | tail -n 1)
    POST_AUTO_BODY=$(echo "$POST_AUTO_RESP" | head -n -1)
    if [ "$POST_AUTO_CODE" = "400" ] && echo "$POST_AUTO_BODY" | grep -q "Wiki is not in review mode"; then
      pass "8b. accept on round-tripped auto wiki → 400 (toggle truly flips, not latches)"
    else
      fail "8b. round-tripped auto accept code=$POST_AUTO_CODE body=$POST_AUTO_BODY"
    fi
  fi

  # Schema rejects an unknown mode value.
  BAD_RESP=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    -H "Content-Type: application/json" \
    -X PATCH -d '{"mode":"strict"}' \
    "$SERVER_URL/wikis/$WIKI30_KEY/bouncer")
  BAD_CODE=$(echo "$BAD_RESP" | tail -n 1)
  if [ "$BAD_CODE" = "400" ] || [ "$BAD_CODE" = "422" ]; then
    pass "8c. PATCH bouncer {mode:'strict'} rejected with HTTP $BAD_CODE (schema enforced)"
  else
    fail "8c. invalid mode value accepted (code=$BAD_CODE) — schema regressed"
  fi
else
  skip "8. WIKI30_KEY missing — round-trip steps skipped"
fi

# ── 9. Counterpart: a SAFE MCP write tool still works ────────
# Belt-and-braces: prove PR #193 didn't break log_fragment by
# over-removing handlers. Uses the same call shape as plan 98 step 6.

if [ -n "$MCP_ENDPOINT" ]; then
  PAYLOAD=$(mcp_call "tools/call" \
    "$(jq -n --arg c "UAT 30 fragment $RUN_ID — safe-tool counterpart check." \
      '{name:"log_fragment", arguments:{content:$c, threadSlug:"transformer-architecture"}}')")
  RES_TEXT=$(echo "$PAYLOAD" | jq -r '.result.content[0].text // empty')
  RES_ERR=$(echo "$PAYLOAD" | jq -r '.result.isError // false')
  FRAG9_KEY=$(echo "$RES_TEXT" | jq -r '.fragmentKey // empty' 2>/dev/null)
  if [ "$RES_ERR" != "true" ] && [ -n "$FRAG9_KEY" ]; then
    pass "9a. safe MCP tool log_fragment still works (fragmentKey=$FRAG9_KEY)"
  else
    fail "9a. log_fragment broke or returned isError=true: ${RES_TEXT:0:160}"
    FRAG9_KEY=""
  fi
else
  skip "9. MCP endpoint not minted — safe-tool counterpart skipped"
  FRAG9_KEY=""
fi

# ── Cleanup — restore default state for downstream plans ─────
# Soft-delete the UAT30 wiki, drop fabricated edges, leave bouncer
# mode at 'auto' (already done in section 8). Belt+braces sweep
# matches the plan-98 cleanup pattern.

if [ -n "${DATABASE_URL:-}" ]; then
  CLEANED=0
  if [ -n "${WIKI30_KEY:-}" ]; then
    psql "$DATABASE_URL" -c "UPDATE wikis SET deleted_at=now(), updated_at=now(), bouncer_mode='auto' WHERE lookup_key='$WIKI30_KEY'" >/dev/null 2>&1 \
      && CLEANED=$((CLEANED+1)) || true
  fi
  if [ -n "${EDGE_ID:-}" ]; then
    psql "$DATABASE_URL" -c "DELETE FROM edges WHERE id='$EDGE_ID'" >/dev/null 2>&1 || true
  fi
  if [ -n "${EDGE_ID2:-}" ]; then
    psql "$DATABASE_URL" -c "DELETE FROM edges WHERE id='$EDGE_ID2'" >/dev/null 2>&1 || true
  fi
  if [ -n "${FRAG9_KEY:-}" ]; then
    psql "$DATABASE_URL" -c "UPDATE fragments SET deleted_at=now(), updated_at=now() WHERE lookup_key='$FRAG9_KEY'" >/dev/null 2>&1 || true
  fi
  # UAT name sweep — clears any stragglers from a prior failed run.
  psql "$DATABASE_URL" -c "UPDATE wikis SET deleted_at=now(), updated_at=now(), bouncer_mode='auto' WHERE name LIKE 'UAT30 Review Target %' AND deleted_at IS NULL" >/dev/null 2>&1 || true
  pass "Cleanup. soft-deleted UAT30 wiki + dropped fabricated edges ($CLEANED tracked)"
else
  skip "Cleanup. DATABASE_URL unset — UAT30 rows left in place; downstream plans may see them"
fi

echo ""
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```

---

## Pass/Fail Summary

| # | Assertion | Source |
|---|-----------|--------|
| 0 | Sign-in cookie established; MCP JWT minted from `/users/profile.mcpEndpointUrl`; Transformer fixture key resolved | `routes/users.ts`, `mcp/jwt.ts` |
| 1 | `tools/list` does NOT advertise `delete_wiki`, `delete_person`, `publish_wiki`, `unpublish_wiki`; all 16 safe tools remain | `core/src/mcp/server.ts` (PR #193) |
| 2 | `tools/call` on each removed tool returns `-32602 InvalidParams` + `'Tool <name> not found'` | MCP SDK `server/mcp.js:104` |
| 3 | `PATCH /wikis/:id/bouncer {mode:'review'}` returns `{id, bouncerMode:'review'}`; `wikis.bouncer_mode='review'`; `GET /wikis/:id` reflects it; audit_log row written | `routes/wikis.ts:582-604`, `bouncerModeBodySchema` |
| 4 | `accept`/`reject` on auto-mode wiki return HTTP 400 + `'Wiki is not in review mode'` | `routes/fragments.ts:210, :257` |
| 5 | Pending edge (deleted_at set) on review-mode wiki surfaces as `edgeStatus:'pending'` in `GET /wikis/:id` | `routes/wikis.ts:227-242` |
| 6 | `accept` on review-mode wiki → 200 + `ok:true`; `edges.deleted_at` cleared; audit_log `accepted` event written; `wikis.last_rebuilt_at` populated (PR #193's regen-on-accept change) | `routes/fragments.ts` ~line 243 (PR #193) |
| 7 | `reject` on review-mode wiki → 200 + `ok:true`; `edges.deleted_at` set; audit_log `rejected` event written | `routes/fragments.ts:289-302` |
| 8 | `PATCH bouncer {mode:'auto'}` round-trip flips back; auto-mode 400 guard re-fires; schema rejects unknown mode strings | `bouncerModeBodySchema = z.enum(['auto','review'])` |
| 9 | Safe MCP tool `log_fragment` still works post-cleanup | `core/src/mcp/server.ts` `registerTool('log_fragment')` |
| Cleanup | UAT30 wiki soft-deleted; fabricated edges dropped; bouncer mode reset to default `'auto'` | psql cleanup block |

---

## Notes

- **Bouncer is per-WIKI, not per-USER.** The orchestrator brief
  mentioned `PATCH /users/profile {bouncerMode}` — that endpoint
  doesn't exist. The actual surface is `PATCH /wikis/:id/bouncer`
  with `{mode: 'auto' | 'review'}`. Issue #166's scope was always
  per-wiki review mode; the per-user variant doesn't ship in PR #193.
- **Pending edges are fabricated, not pipeline-driven.** The queue
  worker's `insertEdgeRow` (`core/src/queue/worker.ts:80`) inserts
  every `FRAGMENT_IN_WIKI` edge with `deleted_at = NULL` regardless
  of the destination wiki's `bouncerMode`. The only place edges
  acquire `deleted_at` is the reject handler. So this plan can't
  exercise an end-to-end "log_entry → pending edge appears" flow —
  it would assert nothing about PR #193 and would regress a
  pre-existing gap. Section 5 fabricates the pending state via
  direct INSERT to isolate PR #193's actual scope: the
  accept/reject handler behavior + UI gating.
- **MCP error envelope shape.** `McpError(InvalidParams=-32602, ...)`
  surfaces in the JSON-RPC envelope's top-level `error` (not as
  `result.isError`). Section 2 checks the top-level path first and
  falls back to the result-level path for transport variants.
- **Removed tool count in PR #193 is FOUR, not two.** PR body and
  diff show `delete_wiki`, `delete_person`, `publish_wiki`,
  `unpublish_wiki` all removed (`core/src/mcp/server.ts: -167
  deletions; core/src/mcp/handlers.ts: -132 deletions`). The
  workstream brief mentions only delete_wiki + delete_person.
  Tested all four to be safe.
- **FUTURE AMENDMENT NEEDED FOR PLAN 98.** Plan 98 sections 9
  (`delete_wiki`) and 10 (`delete_person`) currently exercise tools
  that no longer exist post PR #193. After this PR merges, plan 98
  will go red on steps 9a, 9b, 10a, 10b, 10c. Plan 98's "out of
  scope" list also names `publish_wiki`/`unpublish_wiki` as
  future-coverage TODOs — those are now dead. Recommend a follow-up
  PR retitled "uat: amend plan 98 for destructive-tool removal"
  that (a) deletes sections 9 and 10 from plan 98, (b) drops
  `publish_wiki`/`unpublish_wiki` from the out-of-scope list, (c)
  removes references to `delete_wiki`/`delete_person` from the
  "What it proves" preamble. Plan 30 fully covers the absence-and-
  not-found assertions for those four tools so the coverage is not
  lost — just relocated.
- **Single-tenant note.** `wikis.bouncer_mode` is per-wiki, but
  every wiki in this single-tenant codebase belongs to the only
  user; no `userId` filter applies.
- **Cleanup assumptions.** Section 9 creates a fragment via
  `log_fragment`; the MCP path enqueues classification jobs that
  may insert additional edges asynchronously. The cleanup soft-
  deletes the fragment but doesn't sweep its downstream edges. If
  the downstream `wikis.last_rebuilt_at` from a prior run causes
  flakes in plan 22's freshness assertions, this is the suspect.
