# 10 — People CRUD

## What it proves
People list, get, update, soft delete.

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

echo "10 — People CRUD"
echo ""

# Sign in
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"$INITIAL_USERNAME\",\"password\":\"$INITIAL_PASSWORD\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null

# 1. List people
LIST_HTTP=$(curl -s -o /tmp/uat-people.json -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people")
[ "$LIST_HTTP" = "200" ] && pass "GET /people → 200" || fail "GET /people → HTTP $LIST_HTTP"

# Check if any people exist to test get/update/delete
PEOPLE_COUNT=$(jq '.people | length' /tmp/uat-people.json 2>/dev/null || echo "0")
echo "  people count: $PEOPLE_COUNT"

if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  PERSON_ID=$(jq -r '.people[0].lookupKey // .people[0].id' /tmp/uat-people.json)

  # 2. Get detail
  DETAIL_HTTP=$(curl -s -o /tmp/uat-person.json -w "%{http_code}" \
    -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/people/$PERSON_ID")
  if [ "$DETAIL_HTTP" = "200" ]; then
    HAS_NAME=$(jq 'has("name")' /tmp/uat-person.json 2>/dev/null)
    NAME_LEN=$(jq -r '.name | length' /tmp/uat-person.json 2>/dev/null || echo 0)
    HAS_CONTENT=$(jq 'has("content")' /tmp/uat-person.json 2>/dev/null)
    [ "$HAS_NAME" = "true" ] && pass "GET /people/:id → 200, has name" || fail "detail missing name"
    [ "$NAME_LEN" -gt 0 ] 2>/dev/null && pass "person name non-empty" || fail "person name is empty"
    [ "$HAS_CONTENT" = "true" ] && pass "detail has content field" || fail "detail missing content field"
  else
    fail "GET /people/:id → HTTP $DETAIL_HTTP"
  fi

  # 3. Update
  UPDATE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"name":"UAT Updated Person"}' \
    "$SERVER_URL/people/$PERSON_ID")
  [ "$UPDATE_HTTP" = "200" ] && pass "PUT /people/:id → 200" || fail "PUT → HTTP $UPDATE_HTTP"

  # 4. Delete
  DELETE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/people/$PERSON_ID")
  if [ "$DELETE_HTTP" = "204" ] || [ "$DELETE_HTTP" = "200" ]; then
    pass "DELETE /people/:id → $DELETE_HTTP"
  else
    fail "DELETE → HTTP $DELETE_HTTP"
  fi

  # 5. Verify gone
  GONE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/people/$PERSON_ID")
  [ "$GONE_HTTP" = "404" ] && pass "deleted person returns 404" || fail "deleted person returned $GONE_HTTP"
else
  echo "  ⊘ no people to test get/update/delete (pipeline hasn't extracted any)"
  pass "list endpoint works (empty is valid)"
fi

echo ""
echo "$PASS passed, $FAIL failed"
```
