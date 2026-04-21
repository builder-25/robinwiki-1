# Wiki Type UAT — Objective

## What it proves
End-to-end objective wiki lifecycle: create 3 objective-typed wikis, ingest
realistic OKR/strategic-objective content via MCP `log_entry`, poll until
the pipeline extracts fragments and people, verify edges, trigger wiki
regeneration, and confirm the generated wiki content follows the objective
document structure (The Objective, Key Results, Progress, Course Corrections).

## Prerequisites
- `OPENROUTER_API_KEY` set (LLM calls for extraction + wiki generation)
- Server running at `SERVER_URL` (default `http://localhost:3000`)
- `INITIAL_USERNAME` / `INITIAL_PASSWORD` seeded

## Fixtures

### Fixture 1 — Q3 Revenue Growth Objective (company-level OKR)

> We set the Q3 revenue growth objective in the June leadership offsite after
> reviewing the first half results. Net revenue retention had been hovering at
> 105% for four consecutive quarters, and the board wanted to see us push past
> 115% before the Series C raise. Marcus Huang, our VP of Sales, presented
> analysis showing that our largest accounts were expanding at 12% annualized
> but mid-market accounts were nearly flat. He argued that the biggest lever
> was not new logos but upsell motion within the existing mid-market segment.
>
> The objective we landed on: "Accelerate net revenue retention to fund
> Series C at a position of strength." We defined three key results. KR1:
> increase net revenue retention from 105% to 118% by end of Q3. KR2: grow
> average mid-market account expansion rate from 3% to 10% quarter-over-quarter.
> KR3: close at least 8 upsell deals above $50K ACV within the mid-market
> cohort. Elena Vasquez from Customer Success flagged that churn in the
> mid-market was running at 4% monthly, so any upsell gains would be offset
> unless we simultaneously reduced churn. We added a health metric: keep
> mid-market gross churn below 2% monthly throughout Q3.
>
> By mid-July, the early signals were mixed. Marcus reported that the sales
> team had closed 3 of the 8 target upsell deals, but the average deal size
> was $38K rather than the $50K threshold. Elena's team had reduced churn to
> 2.8% through a dedicated onboarding sprint for the 40 highest-risk accounts.
> NRR had ticked up to 109%, which was progress but well short of the 118%
> target.
>
> In the August check-in, Marcus proposed a course correction: bundle the
> analytics add-on with the core platform at a 20% discount for annual
> commitments. This had worked in enterprise but had never been tested
> mid-market. The CFO, Priya Sharma, was skeptical about margin impact but
> agreed to a 30-day pilot with 15 accounts. By end of August, 11 of the 15
> pilot accounts converted, with an average upsell of $62K. That single
> motion moved the upsell count from 5 to 16 (exceeding KR3) and pushed NRR
> to 114%.
>
> At the Q3 close, final numbers were: NRR 114% (missed the 118% target but
> a 9-point jump from baseline), mid-market expansion rate at 8.5% (short of
> 10% but a near-triple from 3%), upsell deals closed at 16 (doubled the
> target), and mid-market churn at 2.1% (just above the 2% guardrail). The
> board considered this a strong enough trajectory to proceed with Series C
> diligence.
>
> In the post-quarter retro, Marcus and Elena jointly presented the lessons
> learned. The bundling motion was clearly the breakout tactic and should have
> been tested in Q2 rather than waiting until August. Elena emphasized that
> the onboarding sprint, while not directly tied to a key result, was the
> enabling condition for the upsell motion — accounts that went through
> the sprint had 3x higher conversion on the bundle offer. Priya noted
> that the bundle's margin impact was actually positive because annual
> commitments reduced payment processing costs and improved cash flow
> predictability. The CFO team modeled the bundle at scale and projected
> an incremental $2.4M ARR contribution if extended to the full mid-market
> cohort. For Q4, Marcus is proposing we formalize the bundle as a permanent
> SKU, extend the playbook to the SMB segment, and hire two dedicated
> expansion account executives to run the motion full-time. Elena wants
> to make the onboarding sprint a standard part of the customer lifecycle
> rather than a reactive churn-prevention measure.

### Fixture 2 — Platform Reliability Objective (engineering OKR)

> This quarter the engineering leadership — CTO Amara Osei and VP Engineering
> David Chen — set a reliability objective after the April incident review
> revealed that we had 14 Sev-1 incidents in Q2, each costing an average of
> $23K in SLA credits and an estimated 340 engineering hours in firefighting.
> The P99 latency for our core API had crept from 180ms to 420ms over six
> months as feature work took priority over infrastructure.
>
> The objective: "Make the platform rock-solid so customers stop worrying
> about reliability and start trusting us for mission-critical workflows."
> The key results: KR1: reduce Sev-1 incidents from 14/quarter to fewer
> than 3. KR2: bring P99 API latency below 200ms. KR3: achieve 99.95%
> uptime (measured externally by Datadog synthetic monitors). KR4: reduce
> mean time to recovery (MTTR) from 47 minutes to under 15 minutes.
>
> David allocated a dedicated reliability squad of 4 engineers: Tomoko
> Ishikawa (SRE lead), Rashid Al-Farsi (backend), Lin Wei (observability),
> and Jakub Nowak (database). In the first two weeks, Tomoko led a
> dependency audit and discovered that 9 of the 14 Sev-1 incidents traced
> back to two root causes: an unbounded query in the analytics aggregation
> pipeline and a connection pool exhaustion pattern in the payment service.
>
> By mid-quarter, the squad had shipped three changes: (1) query pagination
> with cursor-based limits on the analytics pipeline, reducing its worst-case
> execution from 12 seconds to 180ms; (2) connection pool resizing with
> circuit breakers on the payment service; and (3) structured alerting rules
> in PagerDuty that cut MTTR from 47 to 22 minutes. Sev-1 count for the
> first 6 weeks was 1 incident (a DNS propagation issue outside our control).
>
> Rashid identified a further optimization: moving the heaviest read path
> (dashboard summary) to a materialized view refreshed every 60 seconds. This
> dropped P99 from 420ms to 165ms — overshooting the 200ms target. Lin set up
> a public status page backed by Datadog synthetics showing real-time uptime.
> Through the first 10 weeks, uptime measured 99.97%.
>
> At the end-of-quarter review, final numbers: Sev-1 incidents = 2 (DNS
> issue + one deploy rollback caught in canary — both under 10 minutes), P99
> latency = 165ms, uptime = 99.96%, MTTR = 11 minutes. All four KRs met or
> exceeded. Amara noted that the reliability squad model worked because it
> had dedicated headcount and explicit permission to say no to feature
> requests. David is proposing to make the squad permanent and rotate
> membership quarterly. The SLA credit spend dropped from $322K annualized
> to under $40K projected, which Finance flagged as a material margin
> improvement. Jakub recommended investing next quarter in chaos engineering
> (GameDay exercises) to proactively find failure modes rather than waiting
> for incidents.
>
> In the retrospective, the team identified several structural takeaways.
> First, the root-cause concentration was striking — two bugs caused 64% of
> all Sev-1 incidents, which meant the highest-ROI reliability work was
> targeted debugging rather than broad infrastructure investment. Second,
> the materialized view pattern that Rashid introduced is now being adopted
> by two other teams (billing and reporting) for their own heavy read paths.
> Lin Wei's observability work produced a side benefit: the structured
> alerting rules surfaced 3 near-miss incidents that would have escalated
> to Sev-1 under the old system, effectively preventing future outages.
> Tomoko estimated that the squad's work will save approximately 1,200
> engineering hours per year in incident response alone. David is drafting
> a proposal to rotate one engineer from each product team through the
> reliability squad on a quarterly basis, both to spread knowledge and
> to ensure the squad stays connected to real product workloads. Amara
> wants the chaos engineering initiative to start with a tabletop exercise
> in the first two weeks of next quarter before moving to automated fault
> injection in week four.

### Fixture 3 — Personal Career Growth Objective (individual OKR)

> I set this objective for myself at the start of the year after my skip-level
> with VP Engineering Rosa Martinez. Rosa told me that the gap between my
> current Senior Engineer role and the Staff Engineer promotion wasn't
> technical depth — she said my systems design and code quality were already
> at staff level. The gap was influence: I needed to demonstrate that I could
> drive outcomes beyond my immediate team, mentor others effectively, and
> shape technical direction across the organization.
>
> My objective: "Expand my engineering influence beyond my team to
> demonstrate staff-level impact." I defined four key results. KR1: author
> and get approval for 2 cross-team RFCs that ship to production. KR2:
> mentor 3 engineers and have at least 2 of them complete a stretch project.
> KR3: present at 2 internal tech talks with an average audience rating of
> 4.0+/5.0. KR4: receive "strong" or "exceeds" on the influence dimension
> in the next 360 review.
>
> For KR1, I identified two areas where cross-team alignment was weak: our
> API versioning strategy (which had caused 3 breaking changes in the last
> year) and our approach to feature flags (every team had a different
> implementation). I drafted RFC-0047: Unified API Versioning Strategy in
> February and circulated it to the platform, payments, and growth teams.
> James Okonkwo from the platform team pushed back on my header-based
> versioning proposal, arguing that URL-path versioning was simpler for
> external consumers. We went through two rounds of revision and landed on
> a hybrid approach: URL-path for major versions, header-based for minor.
> The RFC was approved in March and the platform team shipped the versioning
> middleware by end of April.
>
> My second RFC — RFC-0052: Centralized Feature Flag Service — took longer.
> I interviewed 6 team leads to understand their requirements, and the scope
> kept expanding. Nadia Petrov from the data team wanted analytics
> integration, while Leo Chang from mobile needed offline flag evaluation.
> I scoped the RFC to the core service and explicitly deferred those
> extensions to follow-up RFCs. Approved in May, implementation started
> in June with a target ship date of end of Q3.
>
> For KR2, I started mentoring three engineers: Aisha Patel (mid-level,
> backend), Soren Lindqvist (mid-level, frontend), and Maya Torres (junior,
> full-stack). Aisha's stretch project was leading the migration of our
> notification service from polling to WebSockets — she shipped it in April
> with a 60% reduction in notification latency. Soren took on building the
> new design system component library; he's on track to ship v1 by end of
> Q2. Maya's stretch project is smaller scope — building the internal CLI
> tool for database migrations — and she's making steady progress with
> weekly pairing sessions.
>
> For KR3, I gave my first tech talk in March on "Lessons from 3 Years of
> Event-Driven Architecture" to about 45 engineers. The feedback survey
> averaged 4.3/5.0 with comments praising the real-world failure examples.
> My second talk is scheduled for July on the API versioning RFC journey.
>
> Mid-year check-in with Rosa went well. She said the RFC work was exactly
> the kind of influence signal the promotion committee looks for, and the
> mentoring outcomes (especially Aisha's WebSocket migration) demonstrated
> multiplier effect. She flagged one gap: I hadn't yet contributed to
> hiring — she suggested I join the interview panel for the Staff SRE role
> to round out my profile. I've since done 4 technical interviews and
> written detailed scorecards for each. The 360 review cycle is in
> September; I'm cautiously optimistic about KR4 based on the informal
> feedback I've received from peers on the platform and growth teams.

## Script

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "${PROJECT_ROOT:-.}"
source core/.env 2>/dev/null || true

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp /tmp/uat-cookies-XXXXXX.txt)
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  ⊘ $1"; }

echo "Wiki Type UAT — Objective"
echo ""

# Guard: OPENROUTER_API_KEY required for LLM pipeline
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping objective wiki UAT"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── Sign in ───────────────────────────────────────────────────────────
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null

# ── Get MCP token ─────────────────────────────────────────────────────
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -z "$MCP_URL" ] || [ "$MCP_URL" = "null" ]; then
  fail "mcpEndpointUrl not available — cannot run MCP tests"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
pass "MCP token acquired"

# Helper: SSE data-line parser
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

# Helper: MCP JSON-RPC call
mcp_call() {
  local id="$1" method="$2" params="$3"
  curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$id,\"method\":\"$method\",\"params\":$params}" \
    "$MCP_URL" 2>/dev/null | parse_sse
}

# ── MCP initialize ────────────────────────────────────────────────────
INIT_RESP=$(mcp_call 1 "initialize" '{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"uat-objective","version":"1.0"}}')
if echo "$INIT_RESP" | jq -e '.result' >/dev/null 2>&1; then
  pass "MCP initialized"
else
  fail "MCP initialize failed: ${INIT_RESP:0:200}"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── 1. Seed wiki types ────────────────────────────────────────────────
SEED_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "seed wiki types → HTTP $SEED_HTTP"

# Verify objective type exists
OBJ_TYPE_HTTP=$(curl -s -o /tmp/uat-obj-type.json -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/objective")
if [ "$OBJ_TYPE_HTTP" = "200" ]; then
  OBJ_LABEL=$(jq -r '.displayLabel // .name // ""' /tmp/uat-obj-type.json 2>/dev/null)
  pass "objective wiki type exists (label=$OBJ_LABEL)"
else
  fail "GET /wiki-types/objective → HTTP $OBJ_TYPE_HTTP"
fi

# ── 2. Create 3 objective wikis ──────────────────────────────────────
declare -a WIKI_KEYS=()
declare -a WIKI_SLUGS=()
WIKI_NAMES=("Q3 Revenue Growth" "Platform Reliability" "Staff Engineer Promotion")

for i in 0 1 2; do
  CREATE=$(curl -s -w "\n%{http_code}" -X POST -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"${WIKI_NAMES[$i]}\",\"type\":\"objective\"}" \
    "$SERVER_URL/wikis")
  CREATE_HTTP=$(echo "$CREATE" | tail -1)
  CREATE_BODY=$(echo "$CREATE" | sed '$d')
  WK=$(echo "$CREATE_BODY" | jq -r '.lookupKey // .id // ""')
  WS=$(echo "$CREATE_BODY" | jq -r '.slug // ""')

  if [ "$CREATE_HTTP" = "201" ] && [ -n "$WK" ]; then
    WIKI_KEYS+=("$WK")
    WIKI_SLUGS+=("$WS")
    pass "created wiki '${WIKI_NAMES[$i]}' → $WS (type=objective)"
  else
    fail "create wiki '${WIKI_NAMES[$i]}' → HTTP $CREATE_HTTP"
    WIKI_KEYS+=("")
    WIKI_SLUGS+=("")
  fi
done

# Verify all three are type=objective
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  WTYPE=$(echo "$DETAIL" | jq -r '.type // ""')
  [ "$WTYPE" = "objective" ] && pass "'${WIKI_NAMES[$i]}' type confirmed objective" || fail "'${WIKI_NAMES[$i]}' type is $WTYPE (expected objective)"
done

# ── 3. Submit 3 entries via MCP log_entry ─────────────────────────────
# Each fixture maps to one of the wikis above. The pipeline should extract
# fragments and route them. We submit via MCP to test the full ingest path.

read -r -d '' FIXTURE_1 << 'FIXTURE_EOF'
We set the Q3 revenue growth objective in the June leadership offsite after reviewing the first half results. Net revenue retention had been hovering at 105% for four consecutive quarters, and the board wanted to see us push past 115% before the Series C raise. Marcus Huang, our VP of Sales, presented analysis showing that our largest accounts were expanding at 12% annualized but mid-market accounts were nearly flat. He argued that the biggest lever was not new logos but upsell motion within the existing mid-market segment. The objective we landed on: accelerate net revenue retention to fund Series C at a position of strength. We defined three key results. KR1: increase net revenue retention from 105% to 118% by end of Q3. KR2: grow average mid-market account expansion rate from 3% to 10% quarter-over-quarter. KR3: close at least 8 upsell deals above 50K ACV within the mid-market cohort. Elena Vasquez from Customer Success flagged that churn in the mid-market was running at 4% monthly, so any upsell gains would be offset unless we simultaneously reduced churn. We added a health metric: keep mid-market gross churn below 2% monthly throughout Q3. By mid-July, the early signals were mixed. Marcus reported that the sales team had closed 3 of the 8 target upsell deals, but the average deal size was 38K rather than the 50K threshold. Elenas team had reduced churn to 2.8% through a dedicated onboarding sprint for the 40 highest-risk accounts. NRR had ticked up to 109%, which was progress but well short of the 118% target. In the August check-in, Marcus proposed a course correction: bundle the analytics add-on with the core platform at a 20% discount for annual commitments. The CFO Priya Sharma was skeptical about margin impact but agreed to a 30-day pilot with 15 accounts. By end of August, 11 of the 15 pilot accounts converted, with an average upsell of 62K. That single motion moved the upsell count from 5 to 16, exceeding KR3, and pushed NRR to 114%. At the Q3 close, final numbers were: NRR 114% (missed the 118% target but a 9-point jump from baseline), mid-market expansion rate at 8.5% (short of 10% but a near-triple from 3%), upsell deals closed at 16 (doubled the target), and mid-market churn at 2.1%. In the post-quarter retro, Marcus and Elena jointly presented the lessons learned. The bundling motion was clearly the breakout tactic and should have been tested in Q2 rather than waiting until August. Elena emphasized that the onboarding sprint, while not directly tied to a key result, was the enabling condition for the upsell motion as accounts that went through the sprint had 3x higher conversion on the bundle offer. Priya noted that the bundles margin impact was actually positive because annual commitments reduced payment processing costs and improved cash flow predictability. The CFO team modeled the bundle at scale and projected an incremental 2.4M ARR contribution if extended to the full mid-market cohort. For Q4, Marcus is proposing we formalize the bundle as a permanent SKU, extend the playbook to the SMB segment, and hire two dedicated expansion account executives to run the motion full-time. Elena wants to make the onboarding sprint a standard part of the customer lifecycle rather than a reactive churn-prevention measure.
FIXTURE_EOF

read -r -d '' FIXTURE_2 << 'FIXTURE_EOF'
This quarter the engineering leadership set a reliability objective after the April incident review revealed that we had 14 Sev-1 incidents in Q2, each costing an average of 23K in SLA credits and an estimated 340 engineering hours in firefighting. CTO Amara Osei and VP Engineering David Chen led the effort. The P99 latency for our core API had crept from 180ms to 420ms over six months as feature work took priority over infrastructure. The objective: make the platform rock-solid so customers stop worrying about reliability and start trusting us for mission-critical workflows. The key results: KR1 reduce Sev-1 incidents from 14 per quarter to fewer than 3. KR2 bring P99 API latency below 200ms. KR3 achieve 99.95% uptime measured externally by Datadog synthetic monitors. KR4 reduce mean time to recovery from 47 minutes to under 15 minutes. David allocated a dedicated reliability squad of 4 engineers: Tomoko Ishikawa as SRE lead, Rashid Al-Farsi on backend, Lin Wei on observability, and Jakub Nowak on database. In the first two weeks, Tomoko led a dependency audit and discovered that 9 of the 14 Sev-1 incidents traced back to two root causes: an unbounded query in the analytics aggregation pipeline and a connection pool exhaustion pattern in the payment service. By mid-quarter, the squad shipped three changes: query pagination with cursor-based limits reducing worst-case execution from 12 seconds to 180ms, connection pool resizing with circuit breakers on the payment service, and structured alerting rules in PagerDuty that cut MTTR from 47 to 22 minutes. Sev-1 count for the first 6 weeks was 1 incident, a DNS propagation issue outside our control. Rashid identified a further optimization: moving the heaviest read path to a materialized view refreshed every 60 seconds, dropping P99 from 420ms to 165ms. Lin set up a public status page backed by Datadog synthetics showing real-time uptime. Through the first 10 weeks, uptime measured 99.97%. At the end-of-quarter review, final numbers: Sev-1 incidents equals 2 (DNS issue plus one deploy rollback caught in canary, both under 10 minutes), P99 latency equals 165ms, uptime equals 99.96%, MTTR equals 11 minutes. All four KRs met or exceeded. Amara noted that the reliability squad model worked because it had dedicated headcount and explicit permission to say no to feature requests. David is proposing to make the squad permanent and rotate membership quarterly. The SLA credit spend dropped from 322K annualized to under 40K projected, which Finance flagged as a material margin improvement. Jakub recommended investing next quarter in chaos engineering GameDay exercises to proactively find failure modes. In the retrospective, the team identified several structural takeaways. First, the root-cause concentration was striking: two bugs caused 64% of all Sev-1 incidents, which meant the highest-ROI reliability work was targeted debugging rather than broad infrastructure investment. Second, the materialized view pattern that Rashid introduced is now being adopted by two other teams (billing and reporting) for their own heavy read paths. Lin Weis observability work produced a side benefit: the structured alerting rules surfaced 3 near-miss incidents that would have escalated to Sev-1 under the old system, effectively preventing future outages. Tomoko estimated that the squads work will save approximately 1200 engineering hours per year in incident response alone.
FIXTURE_EOF

read -r -d '' FIXTURE_3 << 'FIXTURE_EOF'
I set this career growth objective after my skip-level with VP Engineering Rosa Martinez. Rosa told me that the gap between my current Senior Engineer role and the Staff Engineer promotion was not technical depth but influence: I needed to demonstrate that I could drive outcomes beyond my immediate team, mentor others effectively, and shape technical direction across the organization. My objective: expand my engineering influence beyond my team to demonstrate staff-level impact. I defined four key results. KR1: author and get approval for 2 cross-team RFCs that ship to production. KR2: mentor 3 engineers and have at least 2 of them complete a stretch project. KR3: present at 2 internal tech talks with an average audience rating of 4.0 or higher out of 5.0. KR4: receive strong or exceeds on the influence dimension in the next 360 review. For KR1, I identified two areas where cross-team alignment was weak: our API versioning strategy which had caused 3 breaking changes in the last year, and our approach to feature flags where every team had a different implementation. I drafted RFC-0047 Unified API Versioning Strategy in February and circulated it to the platform, payments, and growth teams. James Okonkwo from the platform team pushed back on my header-based versioning proposal, arguing that URL-path versioning was simpler for external consumers. We went through two rounds of revision and landed on a hybrid approach. The RFC was approved in March and the platform team shipped the versioning middleware by end of April. My second RFC, RFC-0052 Centralized Feature Flag Service, took longer. I interviewed 6 team leads to understand their requirements. Nadia Petrov from the data team wanted analytics integration, while Leo Chang from mobile needed offline flag evaluation. Approved in May, implementation started in June. For KR2, I started mentoring three engineers: Aisha Patel on backend, Soren Lindqvist on frontend, and Maya Torres full-stack. Aishas stretch project was leading the migration of our notification service from polling to WebSockets and she shipped it in April with a 60% reduction in notification latency. Soren took on building the new design system component library. For KR3, I gave my first tech talk in March on Lessons from 3 Years of Event-Driven Architecture to about 45 engineers. The feedback survey averaged 4.3 out of 5.0. My second talk is scheduled for July on the API versioning RFC journey. Mid-year check-in with Rosa went well. She said the RFC work was exactly the kind of influence signal the promotion committee looks for, and the mentoring outcomes especially Aishas WebSocket migration demonstrated multiplier effect. She flagged one gap: I had not yet contributed to hiring. She suggested I join the interview panel for the Staff SRE role to round out my profile. I have since done 4 technical interviews and written detailed scorecards for each. The 360 review cycle is in September and I am cautiously optimistic about KR4 based on the informal feedback I have received from peers on the platform and growth teams. Soren is on track to ship the design system component library v1 by end of Q2. Mayas stretch project is building the internal CLI tool for database migrations and she is making steady progress with weekly pairing sessions. Two of three mentees will have completed stretch projects by end of quarter which meets the KR2 threshold.
FIXTURE_EOF

FIXTURES=("$FIXTURE_1" "$FIXTURE_2" "$FIXTURE_3")
declare -a ENTRY_KEYS=()

for i in 0 1 2; do
  # JSON-escape the fixture content
  ESCAPED=$(echo "${FIXTURES[$i]}" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))')

  CALL_RESP=$(mcp_call $((10+i)) "tools/call" "{\"name\":\"log_entry\",\"arguments\":{\"content\":$ESCAPED,\"source\":\"mcp\"}}")

  if echo "$CALL_RESP" | jq -e '.result' >/dev/null 2>&1; then
    RESULT_TEXT=$(echo "$CALL_RESP" | jq -r '.result.content[0].text // ""')
    # Extract entry key from "Entry queued: entry01ABC..."
    EKEY=$(echo "$RESULT_TEXT" | grep -oP 'entry[0-9A-Z]{26}' || echo "")
    ENTRY_KEYS+=("$EKEY")
    pass "MCP log_entry #$((i+1)) → queued ($EKEY)"
  else
    IS_ERROR=$(echo "$CALL_RESP" | jq -r '.result.isError // false')
    ERROR_TEXT=$(echo "$CALL_RESP" | jq -r '.result.content[0].text // "unknown"' 2>/dev/null)
    fail "MCP log_entry #$((i+1)) failed: $ERROR_TEXT"
    ENTRY_KEYS+=("")
  fi
done

# ── 4. Poll until entries are processed (max 360s) ───────────────────
echo ""
echo "  ⟳ polling entry pipeline (max 360s)..."
ELAPSED=0
MAX_WAIT=360
PROCESSED=0

while [ $ELAPSED -lt $MAX_WAIT ] && [ $PROCESSED -lt 3 ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  PROCESSED=0

  for i in 0 1 2; do
    [ -z "${ENTRY_KEYS[$i]}" ] && continue
    STATUS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/${ENTRY_KEYS[$i]}" 2>/dev/null \
      | jq -r '.ingestStatus // .state // "unknown"')
    [ "$STATUS" = "processed" ] || [ "$STATUS" = "RESOLVED" ] && PROCESSED=$((PROCESSED+1))
  done

  echo "    ${ELAPSED}s — $PROCESSED/3 entries processed"
done

for i in 0 1 2; do
  [ -z "${ENTRY_KEYS[$i]}" ] && continue
  STATUS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/entries/${ENTRY_KEYS[$i]}" | jq -r '.ingestStatus // .state // "unknown"')
  if [ "$STATUS" = "processed" ] || [ "$STATUS" = "RESOLVED" ]; then
    pass "entry #$((i+1)) reached $STATUS"
  else
    fail "entry #$((i+1)) stuck at $STATUS after ${MAX_WAIT}s"
  fi
done

# ── 5. Report fragments ──────────────────────────────────────────────
echo ""
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

# ── 6. Report people extracted ────────────────────────────────────────
PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people?limit=50")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")

if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "people extracted ($PEOPLE_COUNT total)"
  echo "    people names:"
  echo "$PEOPLE" | jq -r '.people[:10][] | "      - \(.name // .canonicalName)"' 2>/dev/null
else
  skip "no people extracted (entity extraction may have failed-open)"
fi

# ── 7. Report edges ──────────────────────────────────────────────────
GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")

if [ "$EDGE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "graph has edges ($EDGE_COUNT edges, $NODE_COUNT nodes)"

  # Count edge types
  FRAG_IN_WIKI=$(echo "$GRAPH" | jq '[.edges[] | select(.edgeType == "FRAGMENT_IN_WIKI")] | length' 2>/dev/null || echo "0")
  MENTIONS_PERSON=$(echo "$GRAPH" | jq '[.edges[] | select(.edgeType == "FRAGMENT_MENTIONS_PERSON")] | length' 2>/dev/null || echo "0")
  echo "    FRAGMENT_IN_WIKI edges: $FRAG_IN_WIKI"
  echo "    FRAGMENT_MENTIONS_PERSON edges: $MENTIONS_PERSON"
else
  fail "no edges in graph after pipeline"
fi

# ── 8. Check wiki detail (fragments + people attached) ────────────────
echo ""
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  W_FRAGS=$(echo "$DETAIL" | jq '.fragments | length' 2>/dev/null || echo "0")
  W_PEOPLE=$(echo "$DETAIL" | jq '.people | length' 2>/dev/null || echo "0")
  W_STATE=$(echo "$DETAIL" | jq -r '.state // ""')
  echo "  wiki '${WIKI_NAMES[$i]}': state=$W_STATE, fragments=$W_FRAGS, people=$W_PEOPLE"
done

# ── 9. Trigger regen on each wiki ────────────────────────────────────
echo ""
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue

  # Ensure regen is enabled
  curl -s -o /dev/null -X PATCH -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"regenerate":true}' \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}/regenerate"

  REGEN_HTTP=$(curl -s -o /tmp/uat-regen-$i.json -w "%{http_code}" \
    -X POST -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}/regenerate")

  if [ "$REGEN_HTTP" = "200" ]; then
    RFRAG_COUNT=$(jq -r '.fragmentCount // 0' /tmp/uat-regen-$i.json 2>/dev/null)
    pass "regen '${WIKI_NAMES[$i]}' → 200 ($RFRAG_COUNT fragments)"
  else
    fail "regen '${WIKI_NAMES[$i]}' → HTTP $REGEN_HTTP"
  fi
done

# ── 10. Report final wiki state ──────────────────────────────────────
echo ""
echo "  ── Final wiki state ──"
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  W_STATE=$(echo "$DETAIL" | jq -r '.state // ""')
  W_CONTENT=$(echo "$DETAIL" | jq -r '.wikiContent // ""')
  W_LEN=${#W_CONTENT}
  W_FRAGS=$(echo "$DETAIL" | jq '.fragments | length' 2>/dev/null || echo "0")
  W_PEOPLE=$(echo "$DETAIL" | jq '.people | length' 2>/dev/null || echo "0")

  echo ""
  echo "  wiki: ${WIKI_NAMES[$i]}"
  echo "    key: ${WIKI_KEYS[$i]}"
  echo "    slug: ${WIKI_SLUGS[$i]}"
  echo "    state: $W_STATE"
  echo "    content length: $W_LEN chars"
  echo "    fragments: $W_FRAGS"
  echo "    people: $W_PEOPLE"

  if [ "$W_LEN" -gt 50 ]; then
    pass "wiki '${WIKI_NAMES[$i]}' has generated content ($W_LEN chars)"

    # Check for objective document structure sections
    HAS_OBJ_SECTION=false
    HAS_KR_SECTION=false
    HAS_PROGRESS_SECTION=false
    echo "$W_CONTENT" | grep -qi "objective\|the objective" && HAS_OBJ_SECTION=true
    echo "$W_CONTENT" | grep -qi "key result" && HAS_KR_SECTION=true
    echo "$W_CONTENT" | grep -qi "progress" && HAS_PROGRESS_SECTION=true

    [ "$HAS_OBJ_SECTION" = true ] && pass "'${WIKI_NAMES[$i]}' has objective section" || skip "'${WIKI_NAMES[$i]}' objective section not detected"
    [ "$HAS_KR_SECTION" = true ] && pass "'${WIKI_NAMES[$i]}' has key results section" || skip "'${WIKI_NAMES[$i]}' key results section not detected"
    [ "$HAS_PROGRESS_SECTION" = true ] && pass "'${WIKI_NAMES[$i]}' has progress section" || skip "'${WIKI_NAMES[$i]}' progress section not detected"

    # Print first 5 lines of content as preview
    echo "    content preview:"
    echo "$W_CONTENT" | head -5 | sed 's/^/      /'
  else
    fail "wiki '${WIKI_NAMES[$i]}' has no generated content"
  fi
done

# ── 11. Cleanup ───────────────────────────────────────────────────────
echo ""
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue
  DEL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  if [ "$DEL_HTTP" = "204" ] || [ "$DEL_HTTP" = "200" ]; then
    pass "cleanup: deleted '${WIKI_NAMES[$i]}'"
  else
    fail "cleanup: delete '${WIKI_NAMES[$i]}' → HTTP $DEL_HTTP"
  fi
done

echo ""
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```
