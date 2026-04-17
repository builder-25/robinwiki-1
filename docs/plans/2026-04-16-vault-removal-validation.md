# Vault Removal Validation Plan

**Date:** 2026-04-16
**Prerequisite:** Merge PR #54 (remove vaults, add groups)

## Validation steps

Run each step sequentially. All require the dev server running against the UAT database.

### Step 1: Run migration against dev database

```bash
# Reset and push schema (destructive — UAT database only)
set -a; . core/.env; set +a
pnpm --filter @robin/core db:push --force
```

Verify groups and group_wikis tables exist:
```bash
psql $DATABASE_URL -c "\d groups"
psql $DATABASE_URL -c "\d group_wikis"
```

Verify vaults table is gone:
```bash
psql $DATABASE_URL -c "\d vaults" 2>&1 | grep -q "not exist" && echo "PASS: vaults table removed"
```

Verify vaultId columns dropped:
```bash
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='wikis' AND column_name='vault_id'" | grep -q vault_id && echo "FAIL" || echo "PASS: vault_id removed from wikis"
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='raw_sources' AND column_name='vault_id'" | grep -q vault_id && echo "FAIL" || echo "PASS: vault_id removed from raw_sources"
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='fragments' AND column_name='vault_id'" | grep -q vault_id && echo "FAIL" || echo "PASS: vault_id removed from fragments"
```

### Step 2: Boot server and seed

```bash
pnpm dev &
sleep 10
curl -sf http://localhost:3000/health && echo "PASS: server healthy"

# Seed first user + OpenRouter key
set -a; . core/.env; set +a
OPENROUTER_API_KEY=$OPENROUTER_API_KEY pnpm seed-openrouter-key

# Sign in
COOKIE_JAR=$(mktemp)
curl -s -c $COOKIE_JAR -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$INITIAL_USERNAME\",\"password\":\"$INITIAL_PASSWORD\"}"
```

### Step 3: Verify entry ingestion without vault

```bash
# POST entry with NO vaultId — should 202
curl -s -o /tmp/val-entry.json -w '%{http_code}' \
  -X POST http://localhost:3000/entries \
  -H "Content-Type: application/json" \
  -b $COOKIE_JAR \
  -d '{"content":"Testing ingestion without vault assignment.","title":"No-vault test","type":"thought","source":"api"}'

# Should be 202
cat /tmp/val-entry.json | jq '{status,ingestStatus,id}'

# Poll until processed (60s budget)
ENTRY_ID=$(jq -r '.id' /tmp/val-entry.json)
for i in $(seq 1 20); do
  STATUS=$(curl -s -b $COOKIE_JAR http://localhost:3000/entries/$ENTRY_ID | jq -r '.ingestStatus')
  echo "[$i] ingestStatus=$STATUS"
  [ "$STATUS" = "processed" ] || [ "$STATUS" = "failed" ] && break
  sleep 3
done
echo "RESULT: ingestStatus=$STATUS"
```

### Step 4: Create a group, add wikis, list group wikis

```bash
# Create a group
curl -s -o /tmp/val-group.json -w '%{http_code}' \
  -X POST http://localhost:3000/groups \
  -H "Content-Type: application/json" \
  -b $COOKIE_JAR \
  -d '{"name":"Test Group","description":"Validation group"}'

GROUP_ID=$(jq -r '.id' /tmp/val-group.json)
echo "Group created: $GROUP_ID"

# Create a wiki
curl -s -o /tmp/val-wiki.json -w '%{http_code}' \
  -X POST http://localhost:3000/wikis \
  -H "Content-Type: application/json" \
  -b $COOKIE_JAR \
  -d '{"name":"Test Wiki","type":"log"}'

WIKI_ID=$(jq -r '.id' /tmp/val-wiki.json)
echo "Wiki created: $WIKI_ID"

# Add wiki to group
curl -s -o /tmp/val-add.json -w '%{http_code}' \
  -X POST http://localhost:3000/groups/$GROUP_ID/wikis \
  -H "Content-Type: application/json" \
  -b $COOKIE_JAR \
  -d "{\"wikiId\":\"$WIKI_ID\"}"

echo "Add result: $(cat /tmp/val-add.json)"

# List group wikis
curl -s -b $COOKIE_JAR http://localhost:3000/groups/$GROUP_ID/wikis | jq '.wikis | length'
echo "PASS if wiki count = 1"

# List groups (should show wiki count)
curl -s -b $COOKIE_JAR http://localhost:3000/groups | jq '.groups[] | {name, wikiCount}'
```

### Step 5: Confirm wiki deletion cascades remove group_wikis memberships

```bash
# Create a second wiki and add to group
curl -s -o /tmp/val-wiki2.json \
  -X POST http://localhost:3000/wikis \
  -H "Content-Type: application/json" \
  -b $COOKIE_JAR \
  -d '{"name":"Delete Test Wiki","type":"belief"}'

WIKI2_ID=$(jq -r '.id' /tmp/val-wiki2.json)

curl -s -X POST http://localhost:3000/groups/$GROUP_ID/wikis \
  -H "Content-Type: application/json" \
  -b $COOKIE_JAR \
  -d "{\"wikiId\":\"$WIKI2_ID\"}"

# Verify 2 wikis in group
COUNT_BEFORE=$(curl -s -b $COOKIE_JAR http://localhost:3000/groups/$GROUP_ID/wikis | jq '.wikis | length')
echo "Before delete: $COUNT_BEFORE wikis"

# Delete the wiki
curl -s -o /dev/null -w '%{http_code}' \
  -X DELETE http://localhost:3000/wikis/$WIKI2_ID \
  -b $COOKIE_JAR
echo "Delete wiki: should be 204"

# Verify membership removed
COUNT_AFTER=$(curl -s -b $COOKIE_JAR http://localhost:3000/groups/$GROUP_ID/wikis | jq '.wikis | length')
echo "After delete: $COUNT_AFTER wikis"
echo "PASS if count went from 2 to 1"

# Verify via direct DB
psql $DATABASE_URL -tAX -c "SELECT count(*) FROM group_wikis WHERE wiki_id='$WIKI2_ID'"
echo "PASS if 0 rows for deleted wiki"
```

### Step 6: Confirm group deletion does not delete wikis

```bash
# Create another group and add the original wiki
curl -s -o /tmp/val-group2.json \
  -X POST http://localhost:3000/groups \
  -H "Content-Type: application/json" \
  -b $COOKIE_JAR \
  -d '{"name":"Disposable Group","description":"Will be deleted"}'

GROUP2_ID=$(jq -r '.id' /tmp/val-group2.json)

curl -s -X POST http://localhost:3000/groups/$GROUP2_ID/wikis \
  -H "Content-Type: application/json" \
  -b $COOKIE_JAR \
  -d "{\"wikiId\":\"$WIKI_ID\"}"

# Delete the group
curl -s -o /dev/null -w '%{http_code}' \
  -X DELETE http://localhost:3000/groups/$GROUP2_ID \
  -b $COOKIE_JAR
echo "Delete group: should be 204 or 200"

# Verify wiki still exists
WIKI_CHECK=$(curl -s -b $COOKIE_JAR http://localhost:3000/wikis/$WIKI_ID | jq -r '.id // empty')
[ "$WIKI_CHECK" = "$WIKI_ID" ] && echo "PASS: wiki survived group deletion" || echo "FAIL: wiki was deleted"

# Verify group is gone
GROUP_CHECK=$(curl -s -o /dev/null -w '%{http_code}' -b $COOKIE_JAR http://localhost:3000/groups/$GROUP2_ID)
[ "$GROUP_CHECK" = "404" ] && echo "PASS: group is gone" || echo "FAIL: group still exists ($GROUP_CHECK)"

# Verify membership row is gone
psql $DATABASE_URL -tAX -c "SELECT count(*) FROM group_wikis WHERE group_id='$GROUP2_ID'"
echo "PASS if 0 rows for deleted group"
```

### Teardown

```bash
pkill -f 'tsx watch' 2>/dev/null || true
rm -f $COOKIE_JAR
echo "Done"
```
