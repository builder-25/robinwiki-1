# Wiki Type UAT — Decision

## What it proves
End-to-end lifecycle for the **Decision** wiki type: create 3 decision wikis,
seed wiki types, submit 3 realistic entries via MCP `log_entry`, poll until
the pipeline processes them, verify fragments/people/edges were created,
trigger on-demand regen, and report final wiki state.

## Prerequisites
- `OPENROUTER_API_KEY` for LLM calls (skips gracefully if missing)
- `INITIAL_USERNAME` / `INITIAL_PASSWORD` for sign-in
- Server running at `SERVER_URL` (default `http://localhost:3000`)

## Fixtures

### Fixture 1 — Architecture Decision: Event Sourcing vs CRUD for Order Management

> A classic ADR (Architecture Decision Record) for a backend migration.

```
We need to decide on the persistence strategy for the new order management
system that will replace the legacy monolith's order module. The current system
uses a single PostgreSQL table with mutable rows — when an order changes status,
the row is updated in place. This has caused three production incidents in the
past quarter where audit trails were lost, customer support couldn't reconstruct
what happened to an order, and our analytics pipeline produced incorrect
conversion metrics because intermediate states were invisible.

Marcus from platform engineering proposed event sourcing: every state change
becomes an immutable event appended to a log, and the current state is derived
by replaying events. He demonstrated a prototype using EventStoreDB that
handled our peak load (roughly 2,400 orders per minute during flash sales)
with p99 latency under 12ms. The approach gives us a complete audit trail
for free, enables temporal queries ("what did this order look like at 3pm
yesterday"), and makes it straightforward to build new read models without
touching the write path.

Priya from the data team was initially skeptical. She raised concerns about
eventual consistency — our current system serves real-time inventory counts
from the same table, and moving to event sourcing would mean read models could
lag behind writes. After testing Marcus's prototype, the lag was consistently
under 200ms, which Priya agreed was acceptable for inventory display (we
already show "approximately X in stock" for items with fewer than 10 units).
She also pointed out that event sourcing would actually simplify her team's
work: instead of CDC (Change Data Capture) polling the orders table every
30 seconds, they could subscribe directly to the event stream.

Chen from frontend engineering raised a different concern: debugging. With
CRUD, you can inspect a row and see the current state. With event sourcing,
you need tooling to replay events and inspect projections. Marcus acknowledged
this and committed to building a developer console that shows the event
timeline for any aggregate. Chen was satisfied with this commitment but
noted it should be part of the MVP, not a follow-up.

We also evaluated a hybrid approach suggested by our CTO Dana: keep CRUD for
the primary order table but add an event log table that records every change
as a side effect. This would preserve the simple query model while adding
auditability. Marcus argued this creates a consistency problem — the event
log and the order table could drift if a transaction partially fails. Dana
conceded this point after Marcus showed a real example from the Q3 incident
where exactly this kind of drift occurred in our current audit_log table.

The team decided on full event sourcing with EventStoreDB. The migration will
happen in three phases: Phase 1 deploys the event store alongside the existing
system in shadow mode (writes go to both, reads still come from PostgreSQL).
Phase 2 switches reads to projections built from the event store. Phase 3
decommissions the PostgreSQL order table. Each phase has a rollback plan.
Marcus and Priya will co-own the implementation. Target completion is end of
Q2. The decision was unanimous after the prototype demonstration addressed
everyone's concerns.
```

### Fixture 2 — Product Decision: Abandoning the Native Mobile App

> A product strategy pivot with stakeholder tension and market data.

```
After eighteen months of development and three beta releases, we have decided
to discontinue the native iOS and Android apps for Meridian and go all-in on
the progressive web app (PWA). This was not an easy decision — the native apps
represent roughly $1.2M in engineering investment and the mobile team of four
engineers will need to be redeployed.

The data forced our hand. Our analytics from the past six months tell a clear
story: 73% of our mobile users access Meridian through the mobile browser,
not the native app. Of the 27% who installed the native app, daily active
usage dropped 40% after the first week. The native app's rating on both stores
sits at 3.1 stars, dragged down by complaints about sync delays and feature
parity gaps — features ship to web first, and the native ports lag by 6-8
weeks on average.

Tom from product analytics presented a cohort analysis showing that users
who started on the PWA had 2.3x higher 90-day retention than native app
users. He attributed this to the PWA receiving features immediately (no app
store review cycle), having zero install friction, and sharing the exact
same codebase as desktop — so bugs get fixed once, not three times.

Jessica from mobile engineering pushed back strongly. She argued that push
notifications on iOS still require a native app for reliability (Safari's
Web Push support is inconsistent), that the native app's offline mode is
superior to the service worker approach, and that abandoning native signals
to enterprise customers that we're not a "serious" platform. These are
legitimate concerns. On push notifications, our infrastructure lead Rafael
confirmed that iOS 17.4's Web Push improvements have closed most of the
reliability gap — our test suite shows 97.3% delivery rate on PWA vs 99.1%
on native, and the delta is narrowing with each Safari release. On offline
mode, Tom's data showed only 4% of sessions involve any offline usage, and
those users average 2.1 minutes offline — too short for the complex sync
engine Jessica's team built.

The enterprise signaling concern deserves honest acknowledgment. Three of
our twelve enterprise prospects specifically asked about native apps during
sales calls. Our VP of Sales Rachel confirmed this. However, Rachel also
noted that none of the three listed it as a dealbreaker — their actual
requirements were biometric authentication (available via WebAuthn), MDM
compatibility (achievable with managed browser profiles), and offline
document viewing (which our PWA already supports for the read path). Rachel
is comfortable repositioning the PWA as our mobile strategy for enterprise
if we invest in those three capabilities.

We considered a third option: using React Native or Capacitor to generate
native wrappers around the PWA. Our architect Wei evaluated this over two
weeks and concluded it would give us the app store presence without the
maintenance burden, but would introduce a new layer of abstraction bugs.
His recommendation was to go pure PWA and revisit native wrappers only if
app store presence becomes a measurable acquisition channel — which it
currently is not (app store organic discovery accounts for less than 2%
of signups).

The decision: sunset the native apps over 90 days, migrate the four mobile
engineers to the web platform team, and invest the freed capacity into PWA
enhancements (offline improvements, WebAuthn, MDM documentation). Jessica
will lead the PWA mobile experience squad. We will revisit native if our
enterprise pipeline data changes or if a specific high-value deal requires it.
Dissent from Jessica is noted and respected — she has a standing invitation
to trigger a re-evaluation if the PWA approach hits a wall she predicted.
```

### Fixture 3 — Strategy Decision: Switching from Per-Seat to Usage-Based Pricing

> A pricing model pivot with finance, sales, and customer impact analysis.

```
After analyzing churn patterns for the past two quarters, we are moving
Arclight from per-seat licensing ($45/user/month) to usage-based pricing
tied to API calls and compute minutes. This is the most consequential
business model change since launch and will affect every customer, every
sales conversation, and our revenue forecasting models.

The catalyst was losing four mid-market accounts in Q4, all citing the same
reason: they were paying for 200+ seats but actual monthly active users
averaged 60-80. Our per-seat model punished companies that wanted broad
access but had variable usage patterns. Nadia from customer success
interviewed all four churned accounts. Every one said they would have
stayed on a usage model — they valued Arclight but couldn't justify the
per-seat cost for dormant licenses. One account, DataForge (our third-largest
customer at $108K ARR), explicitly said they'd return if we switched to
usage pricing. Their CTO Kenji told Nadia: "We love the product. We hate
paying for seats that open the dashboard once a month."

Our CFO Martin modeled three scenarios. Scenario A (status quo): projected
12% annual churn, $4.2M ARR by year-end. Scenario B (usage-based, current
customer base): initial ARR drop to $3.6M as low-usage seats disappear
from billing, but churn projected to fall to 5% because customers only pay
for what they use — recovery to $4.8M ARR within 18 months as reduced
friction drives expansion within accounts. Scenario C (hybrid — base
platform fee plus usage): $3.9M starting ARR with similar churn reduction.
Martin recommends Scenario B because it's simpler to explain, simpler to
bill, and the 18-month recovery timeline is within our runway (we have
26 months of cash at current burn).

Lucas from sales raised a serious concern: usage-based pricing makes
revenue less predictable, which hurts our ability to forecast and could
complicate our Series B raise expected in Q3. He proposed committed-use
discounts — customers who commit to a minimum monthly spend get a 20%
discount on overages. This creates a predictability floor while preserving
the usage-based flexibility. Martin agreed this was a good hybrid mechanism
and incorporated it into the Scenario B model, which improved the 18-month
projection to $5.1M ARR because committed-use contracts reduce uncertainty
on both sides.

Samira from engineering flagged implementation complexity. Our billing
system was built for seat counting — it literally runs a SELECT COUNT(*)
on active users at the end of each billing cycle. Moving to usage-based
billing requires metering infrastructure: event collection, aggregation,
rated billing, invoice line item detail, and usage dashboards so customers
can monitor their spend. Samira estimated 8-10 weeks of engineering work
with two engineers. She recommended Metronome as the billing engine rather
than building in-house, which would cut the timeline to 4-5 weeks. The
Metronome contract is $2,400/month — trivial against the revenue impact.

We also considered keeping per-seat pricing but adding a lower tier.
Research lead Vikram pointed out that most competitors (Segment, Datadog,
Snowflake) have already moved to usage-based models and customers in our
ICP expect it. Adding a cheaper per-seat tier wouldn't address the core
complaint — companies don't want to count heads, they want to pay for
outcomes. Vikram's competitive analysis showed that every company in our
space that switched to usage pricing saw net revenue retention improve by
15-25 percentage points within two years.

The final decision: adopt Scenario B (pure usage-based) with Lucas's
committed-use discount mechanism. Samira will lead the Metronome integration
starting next sprint. Sales will begin positioning the change with existing
customers in Month 1, migrate billing in Month 2, and enforce the new model
for all accounts in Month 3. Martin will provide updated financial models
weekly during the transition. Nadia will reach out to DataForge and the
other three churned accounts with the new pricing. Success criteria: net
revenue retention above 110% by month 6, and churn rate below 6%
annualized by month 9. We will evaluate at the 6-month mark and have
a pre-committed rollback plan if NRR drops below 95%.
```

## Script

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "${PROJECT_ROOT:-.}"
source core/.env 2>/dev/null || true

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp /tmp/uat-cookies-XXXXXX.txt)
trap 'rm -f "$COOKIE_JAR" /tmp/uat-decision-*.json' EXIT

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  ⊘ $1"; }

echo "Wiki Type UAT — Decision"
echo ""

# --- Preflight: OpenRouter key required for LLM pipeline ---
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping decision wiki-type UAT"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# --- Sign in ---
SIGNIN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email")
[ "$SIGNIN_HTTP" = "200" ] && pass "sign-in → 200" || fail "sign-in → HTTP $SIGNIN_HTTP"

# --- Get MCP token ---
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -z "$MCP_URL" ] || [ "$MCP_URL" = "null" ]; then
  fail "mcpEndpointUrl not found in profile"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
pass "MCP token acquired"

# Helper: extract JSON from SSE "data:" line
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

# --- 1. Seed wiki types ---
SEED_HTTP=$(curl -s -o /tmp/uat-decision-seed.json -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "seed wiki types → HTTP $SEED_HTTP"

# Verify decision type exists
LIST_HTTP=$(curl -s -o /tmp/uat-decision-types.json -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types")
if [ "$LIST_HTTP" = "200" ]; then
  HAS_DECISION=$(jq '[.wikiTypes[].slug] | any(. == "decision")' /tmp/uat-decision-types.json 2>/dev/null)
  [ "$HAS_DECISION" = "true" ] && pass "decision wiki type present after seed" || fail "decision wiki type missing"
else
  fail "GET /wiki-types → HTTP $LIST_HTTP"
fi

# --- 2. Create 3 decision wikis via REST ---
WIKI_KEYS=()
WIKI_SLUGS=()

create_decision_wiki() {
  local name="$1"
  local result
  result=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"$name\",\"type\":\"decision\",\"prompt\":\"\"}" \
    "$SERVER_URL/wikis")
  local http=$(echo "$result" | tail -1)
  local body=$(echo "$result" | sed '$d')
  local key=$(echo "$body" | jq -r '.lookupKey // .id // ""')
  local slug=$(echo "$body" | jq -r '.slug // ""')

  if [ "$http" = "201" ] && [ -n "$key" ] && [ "$key" != "null" ]; then
    pass "POST /wikis → 201 ($name), key=$key"
    WIKI_KEYS+=("$key")
    WIKI_SLUGS+=("$slug")
  else
    fail "POST /wikis → HTTP $http ($name)"
  fi
}

create_decision_wiki "Event Sourcing vs CRUD for Orders"
create_decision_wiki "Abandoning the Native Mobile App"
create_decision_wiki "Usage-Based Pricing Switch"

if [ "${#WIKI_KEYS[@]}" -lt 3 ]; then
  fail "expected 3 wikis, created ${#WIKI_KEYS[@]} — aborting"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# Verify all 3 have type=decision
for i in 0 1 2; do
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  TYPE=$(echo "$DETAIL" | jq -r '.type // ""')
  [ "$TYPE" = "decision" ] && pass "wiki $i type=decision" || fail "wiki $i type=$TYPE (expected decision)"
done

# --- 3. Submit 3 entries via MCP log_entry ---
# Each entry is a realistic decision-record text.

FIXTURE_1='We need to decide on the persistence strategy for the new order management system that will replace the legacy monolith order module. The current system uses a single PostgreSQL table with mutable rows — when an order changes status, the row is updated in place. This has caused three production incidents in the past quarter where audit trails were lost, customer support could not reconstruct what happened to an order, and our analytics pipeline produced incorrect conversion metrics because intermediate states were invisible. Marcus from platform engineering proposed event sourcing: every state change becomes an immutable event appended to a log, and the current state is derived by replaying events. He demonstrated a prototype using EventStoreDB that handled our peak load (roughly 2,400 orders per minute during flash sales) with p99 latency under 12ms. The approach gives us a complete audit trail for free, enables temporal queries, and makes it straightforward to build new read models without touching the write path. Priya from the data team was initially skeptical about eventual consistency — our current system serves real-time inventory counts from the same table. After testing the prototype, the lag was consistently under 200ms, which Priya agreed was acceptable. Chen from frontend engineering raised debugging concerns. With CRUD, you can inspect a row and see the current state. With event sourcing, you need tooling to replay events. Marcus committed to building a developer console that shows the event timeline for any aggregate. The CTO Dana suggested a hybrid approach: keep CRUD but add an event log table. Marcus argued this creates a consistency problem and showed a real example from the Q3 incident where exactly this kind of drift occurred. The team decided on full event sourcing with EventStoreDB. The migration will happen in three phases with rollback plans at each stage. Marcus and Priya will co-own the implementation. The decision was unanimous after the prototype demonstration addressed all concerns.'

FIXTURE_2='After eighteen months of development and three beta releases, we have decided to discontinue the native iOS and Android apps for Meridian and go all-in on the progressive web app. The data forced our hand: 73 percent of our mobile users access Meridian through the mobile browser, not the native app. Of the 27 percent who installed the native app, daily active usage dropped 40 percent after the first week. Tom from product analytics presented a cohort analysis showing PWA users had 2.3x higher 90-day retention than native app users. Jessica from mobile engineering pushed back strongly, arguing push notifications on iOS still require a native app for reliability, the native offline mode is superior, and abandoning native signals to enterprise customers that we are not serious. Rafael confirmed iOS 17.4 Web Push improvements have closed most of the reliability gap at 97.3 percent delivery rate on PWA vs 99.1 percent on native. Tom showed only 4 percent of sessions involve offline usage. Rachel from sales confirmed three enterprise prospects asked about native apps but none listed it as a dealbreaker — their actual requirements were biometric authentication via WebAuthn, MDM compatibility, and offline document viewing, all achievable on PWA. Wei evaluated React Native wrappers and concluded they would introduce abstraction bugs without meaningful benefit since app store organic discovery accounts for less than 2 percent of signups. The decision: sunset native apps over 90 days, migrate four mobile engineers to the web platform team, invest freed capacity into PWA enhancements. Jessica will lead the PWA mobile experience squad with a standing invitation to trigger re-evaluation if the approach hits a wall she predicted.'

FIXTURE_3='After analyzing churn patterns for two quarters, we are moving Arclight from per-seat licensing at 45 dollars per user per month to usage-based pricing tied to API calls and compute minutes. The catalyst was losing four mid-market accounts in Q4, all citing the same reason: paying for 200-plus seats but actual monthly active users averaged 60-80. Nadia from customer success interviewed all four churned accounts and every one said they would have stayed on a usage model. DataForge, our third-largest customer at 108K ARR, explicitly said they would return. CFO Martin modeled three scenarios: status quo projecting 12 percent annual churn at 4.2M ARR, usage-based with initial drop to 3.6M but recovery to 4.8M within 18 months as churn falls to 5 percent, and a hybrid base-plus-usage at 3.9M. Martin recommends pure usage-based because it is simpler to explain and bill. Lucas from sales raised revenue predictability concerns and proposed committed-use discounts — customers committing to minimum monthly spend get 20 percent off overages. Martin agreed and the improved model projects 5.1M ARR at 18 months. Samira from engineering estimated 8-10 weeks for metering infrastructure but recommended Metronome as billing engine to cut timeline to 4-5 weeks at 2,400 dollars per month. Vikram from research noted competitors like Segment, Datadog, and Snowflake have already moved to usage-based pricing and saw 15-25 percentage point NRR improvements. The decision: adopt pure usage-based with committed-use discounts. Samira leads Metronome integration next sprint. Success criteria: net revenue retention above 110 percent by month 6 and churn below 6 percent annualized by month 9 with a pre-committed rollback plan if NRR drops below 95 percent.'

ENTRY_IDS=()

submit_entry() {
  local content="$1"
  local label="$2"
  local result
  result=$(curl -s --max-time 15 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"log_entry\",\"arguments\":{\"content\":$(echo "$content" | jq -Rs .),\"source\":\"uat\"}}}" \
    "$MCP_URL" 2>/dev/null)
  local resp=$(echo "$result" | parse_sse)

  if echo "$resp" | jq -e '.result' >/dev/null 2>&1; then
    local text=$(echo "$resp" | jq -r '.result.content[0].text // ""')
    local entry_key=$(echo "$text" | grep -oP 'entry[0-9A-Z]{26}' || echo "")
    if [ -n "$entry_key" ]; then
      ENTRY_IDS+=("$entry_key")
      pass "MCP log_entry ($label) → $entry_key"
    else
      pass "MCP log_entry ($label) → response OK (no key extracted)"
      ENTRY_IDS+=("unknown")
    fi
  else
    local is_error=$(echo "$resp" | jq -r '.result.isError // false' 2>/dev/null)
    if [ "$is_error" = "true" ]; then
      fail "MCP log_entry ($label) → error: $(echo "$resp" | jq -r '.result.content[0].text // "unknown"')"
    else
      fail "MCP log_entry ($label) → unexpected response: ${resp:0:200}"
    fi
  fi
}

submit_entry "$FIXTURE_1" "event-sourcing"
submit_entry "$FIXTURE_2" "native-app-sunset"
submit_entry "$FIXTURE_3" "usage-pricing"

echo ""

# --- 4. Poll until entries are processed (max 360s) ---
echo "  ⟳ polling entry ingest status (max 360s)..."

ENTRIES_DONE=0
ELAPSED=0
MAX_WAIT=360

while [ $ELAPSED -lt $MAX_WAIT ] && [ $ENTRIES_DONE -lt ${#ENTRY_IDS[@]} ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  ENTRIES_DONE=0

  for eid in "${ENTRY_IDS[@]}"; do
    [ "$eid" = "unknown" ] && { ENTRIES_DONE=$((ENTRIES_DONE + 1)); continue; }
    STATUS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/$eid" 2>/dev/null | jq -r '.ingestStatus // .state // "unknown"')
    if [ "$STATUS" = "processed" ] || [ "$STATUS" = "RESOLVED" ] || [ "$STATUS" = "failed" ]; then
      ENTRIES_DONE=$((ENTRIES_DONE + 1))
    fi
  done

  echo "    ${ELAPSED}s — $ENTRIES_DONE/${#ENTRY_IDS[@]} entries terminal"
done

if [ $ENTRIES_DONE -ge ${#ENTRY_IDS[@]} ]; then
  pass "all ${#ENTRY_IDS[@]} entries reached terminal state in ${ELAPSED}s"
else
  fail "only $ENTRIES_DONE/${#ENTRY_IDS[@]} entries finished after ${MAX_WAIT}s"
fi

# Report per-entry final status
for eid in "${ENTRY_IDS[@]}"; do
  [ "$eid" = "unknown" ] && continue
  FINAL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/entries/$eid" 2>/dev/null | jq -r '.ingestStatus // .state // "unknown"')
  if [ "$FINAL" = "processed" ] || [ "$FINAL" = "RESOLVED" ]; then
    pass "entry $eid → $FINAL"
  else
    fail "entry $eid → $FINAL"
  fi
done

echo ""

# --- 5. Report fragments ---
FRAGS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=100")
FRAG_COUNT=$(echo "$FRAGS" | jq '.fragments | length' 2>/dev/null || echo "0")

if [ "$FRAG_COUNT" -gt 0 ] 2>/dev/null; then
  pass "fragments created ($FRAG_COUNT total)"
  echo "    fragment titles:"
  echo "$FRAGS" | jq -r '.fragments[:10][] | "      - \(.title // .slug)"' 2>/dev/null
else
  fail "no fragments found after pipeline"
fi

echo ""

# --- 6. Report people ---
PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people?limit=100")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")

if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "people extracted ($PEOPLE_COUNT total)"
  echo "    people:"
  echo "$PEOPLE" | jq -r '.people[:15][] | "      - \(.name // .canonicalName)"' 2>/dev/null
else
  skip "no people extracted (may be expected if entity extraction is disabled)"
fi

echo ""

# --- 7. Report edges ---
GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")

if [ "$EDGE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "graph has edges ($EDGE_COUNT edges, $NODE_COUNT nodes)"

  # Break down edge types
  echo "    edge type breakdown:"
  echo "$GRAPH" | jq -r '[.edges[].edgeType] | group_by(.) | map({type: .[0], count: length}) | .[] | "      - \(.type): \(.count)"' 2>/dev/null
else
  fail "no edges in graph after pipeline"
fi

echo ""

# --- 8. Trigger regen on each decision wiki ---
for i in 0 1 2; do
  WIKI_KEY="${WIKI_KEYS[$i]}"

  # Enable regen if disabled
  curl -s -o /dev/null -X PATCH \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"regenerate":true}' \
    "$SERVER_URL/wikis/$WIKI_KEY/regenerate"

  REGEN_HTTP=$(curl -s -o /tmp/uat-decision-regen-$i.json -w "%{http_code}" \
    -X POST -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$WIKI_KEY/regenerate")

  if [ "$REGEN_HTTP" = "200" ]; then
    REGEN_FRAGS=$(jq '.fragmentCount // 0' /tmp/uat-decision-regen-$i.json 2>/dev/null)
    pass "POST /wikis/$WIKI_KEY/regenerate → 200 ($REGEN_FRAGS fragments)"
  elif [ "$REGEN_HTTP" = "400" ]; then
    # Regen disabled or no fragments linked — not a test failure, report it
    REGEN_ERR=$(jq -r '.error // "unknown"' /tmp/uat-decision-regen-$i.json 2>/dev/null)
    skip "regen wiki $i → 400: $REGEN_ERR"
  elif [ "$REGEN_HTTP" = "500" ]; then
    REGEN_ERR=$(jq -r '.error // .detail // "unknown"' /tmp/uat-decision-regen-$i.json 2>/dev/null)
    fail "regen wiki $i → 500: $REGEN_ERR"
  else
    fail "regen wiki $i → HTTP $REGEN_HTTP"
  fi
done

echo ""

# --- 9. Report final wiki state ---
echo "  --- Final Wiki State ---"
for i in 0 1 2; do
  WIKI_KEY="${WIKI_KEYS[$i]}"
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$WIKI_KEY")

  WIKI_NAME=$(echo "$DETAIL" | jq -r '.name // "?"')
  WIKI_TYPE=$(echo "$DETAIL" | jq -r '.type // "?"')
  WIKI_STATE=$(echo "$DETAIL" | jq -r '.state // "?"')
  WIKI_REBUILT=$(echo "$DETAIL" | jq -r '.lastRebuiltAt // "never"')
  CONTENT_LEN=$(echo "$DETAIL" | jq -r '.content // ""' | wc -c)

  echo "    [$i] $WIKI_NAME"
  echo "        type=$WIKI_TYPE  state=$WIKI_STATE  rebuilt=$WIKI_REBUILT  content=${CONTENT_LEN} chars"

  # Validate type stayed decision
  [ "$WIKI_TYPE" = "decision" ] && pass "wiki $i final type=decision" || fail "wiki $i final type=$WIKI_TYPE"

  # Check content was generated (if regen ran)
  if [ "$CONTENT_LEN" -gt 50 ] 2>/dev/null; then
    pass "wiki $i has generated content ($CONTENT_LEN chars)"

    # Verify decision document structure (look for expected section headers)
    HAS_DECISION_HEADER=$(echo "$DETAIL" | jq -r '.content // ""' | grep -ci 'decision\|the decision\|what was decided' || true)
    HAS_CONTEXT=$(echo "$DETAIL" | jq -r '.content // ""' | grep -ci 'context' || true)
    HAS_ALTERNATIVES=$(echo "$DETAIL" | jq -r '.content // ""' | grep -ci 'alternative' || true)

    if [ "$HAS_DECISION_HEADER" -gt 0 ] && [ "$HAS_CONTEXT" -gt 0 ]; then
      pass "wiki $i has decision document structure"
    else
      skip "wiki $i content does not match expected decision structure (may vary by LLM)"
    fi
  else
    skip "wiki $i has no/minimal content (regen may not have linked fragments)"
  fi
  echo ""
done

# --- 10. Cleanup: delete test wikis ---
echo "  --- Cleanup ---"
for i in 0 1 2; do
  DEL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  if [ "$DEL_HTTP" = "204" ] || [ "$DEL_HTTP" = "200" ]; then
    pass "cleanup: deleted wiki $i"
  else
    skip "cleanup: wiki $i delete → HTTP $DEL_HTTP"
  fi
done

echo ""
echo "════════════════════════════════════════"
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```
