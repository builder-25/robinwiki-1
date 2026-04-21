# 08 — Wiki CRUD

## What it proves
Full lifecycle: create, list, get, update, soft delete.

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "${PROJECT_ROOT:-.}"
source core/.env 2>/dev/null || true

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp /tmp/uat-cookies-XXXXXX.txt)
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "08 — Wiki CRUD"
echo ""

# Sign in
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"$INITIAL_USERNAME\",\"password\":\"$INITIAL_PASSWORD\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null

# 1. Create
CREATE=$(curl -s -w "\n%{http_code}" -X POST \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"name":"UAT Test Wiki","type":"log","prompt":"test prompt"}' \
  "$SERVER_URL/wikis")
CREATE_HTTP=$(echo "$CREATE" | tail -1)
CREATE_BODY=$(echo "$CREATE" | sed '$d')
WIKI_ID=$(echo "$CREATE_BODY" | jq -r '.lookupKey // .id // ""')

if [ "$CREATE_HTTP" = "201" ] && [ -n "$WIKI_ID" ]; then
  pass "POST /wikis → 201, id=$WIKI_ID"
else
  fail "POST /wikis → HTTP $CREATE_HTTP (id=$WIKI_ID)"
fi

# 2. List
LIST_HTTP=$(curl -s -o /tmp/uat-wikis-list.json -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wikis")
if [ "$LIST_HTTP" = "200" ]; then
  WIKI_COUNT=$(jq '.wikis | length' /tmp/uat-wikis-list.json 2>/dev/null || echo "0")
  FOUND=$(jq --arg id "$WIKI_ID" '.wikis[] | select(.lookupKey == $id or .id == $id) | .name' /tmp/uat-wikis-list.json 2>/dev/null)
  if [ -n "$FOUND" ]; then
    pass "GET /wikis → 200, created wiki found ($WIKI_COUNT total)"
  else
    fail "GET /wikis → 200 but created wiki not in list"
  fi
else
  fail "GET /wikis → HTTP $LIST_HTTP"
fi

# 3. Get detail
DETAIL_HTTP=$(curl -s -o /tmp/uat-wiki-detail.json -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wikis/$WIKI_ID")
if [ "$DETAIL_HTTP" = "200" ]; then
  HAS_FIELDS=$(jq 'has("name") and has("type") and has("state")' /tmp/uat-wiki-detail.json 2>/dev/null)
  NAME_LEN=$(jq -r '.name | length' /tmp/uat-wiki-detail.json 2>/dev/null || echo 0)
  HAS_WIKI_CONTENT=$(jq 'has("wikiContent")' /tmp/uat-wiki-detail.json 2>/dev/null)
  [ "$HAS_FIELDS" = "true" ] && pass "GET /wikis/:id → 200, fields present" || fail "GET /wikis/:id missing fields"
  [ "$NAME_LEN" -gt 0 ] 2>/dev/null && pass "wiki name non-empty" || fail "wiki name is empty"
  [ "$HAS_WIKI_CONTENT" = "true" ] && pass "detail has wikiContent field" || fail "detail missing wikiContent field"
else
  fail "GET /wikis/:id → HTTP $DETAIL_HTTP"
fi

# 4. Update
UPDATE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PUT \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"name":"UAT Test Wiki Updated"}' \
  "$SERVER_URL/wikis/$WIKI_ID")
[ "$UPDATE_HTTP" = "200" ] && pass "PUT /wikis/:id → 200" || fail "PUT /wikis/:id → HTTP $UPDATE_HTTP"

# Verify update
UPDATED_NAME=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/wikis/$WIKI_ID" | jq -r '.name')
[ "$UPDATED_NAME" = "UAT Test Wiki Updated" ] && pass "name updated correctly" || fail "name not updated: $UPDATED_NAME"

# 5. Delete
DELETE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE \
  -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wikis/$WIKI_ID")
if [ "$DELETE_HTTP" = "204" ] || [ "$DELETE_HTTP" = "200" ]; then
  pass "DELETE /wikis/:id → $DELETE_HTTP"
else
  fail "DELETE /wikis/:id → HTTP $DELETE_HTTP"
fi

# 6. Verify deleted
GONE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wikis/$WIKI_ID")
[ "$GONE_HTTP" = "404" ] && pass "deleted wiki returns 404" || fail "deleted wiki returned $GONE_HTTP (expected 404)"

echo ""
echo "$PASS passed, $FAIL failed"
```
