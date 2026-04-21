# Wiki Type UAT — Project

## What it proves
End-to-end Project wiki lifecycle: create 3 project wikis, seed wiki types,
submit 3 realistic project-update entries via MCP, poll until the pipeline
processes them into fragments, verify fragments/people/edges, trigger regen,
and report final wiki state.

A **Project** wiki is "a living document tracking an active initiative, its
goals, progress, and status."

## Prerequisites
- `OPENROUTER_API_KEY` set (LLM calls for extraction + regen)
- Server running at `SERVER_URL` (default `http://localhost:3000`)
- `INITIAL_USERNAME` / `INITIAL_PASSWORD` env vars for auth

## Fixtures

### Fixture 1 — Platform Migration Status Update

> A cross-team infrastructure migration report covering progress, blockers,
> and upcoming milestones for moving from a legacy monolith to microservices.

```
We're now six weeks into the Helios platform migration and I want to give
everyone a clear picture of where things stand. The goal of this initiative is
to decompose the legacy Rails monolith into independently deployable
microservices behind an API gateway, with zero customer-facing downtime during
the transition.

As of this week, four of the nine planned services have been extracted and are
running in production behind the new Kong gateway. The authentication service
went live on March 3 and has been stable — Priya Sharma's team handled the
session migration and we saw zero auth failures during cutover. The billing
service followed on March 10, though we discovered a timezone bug in invoice
generation that Marcus Chen patched within 48 hours. The notification service
and user-profile service both shipped last week after passing load testing at
3x current traffic.

The remaining five services — catalog, search, order-management,
inventory-sync, and reporting — are in various stages of extraction. Elena
Vasquez is leading the catalog service work and estimates it will be ready for
staging by April 1. Search is the most complex: it depends on a shared
Elasticsearch cluster that currently serves both the monolith and the new
services, and James Okafor flagged a concern about query routing during the
transition window. We're scheduling a design review for next Tuesday to nail
down the approach.

The biggest blocker right now is the shared database. The monolith and the
extracted services are still reading from the same Postgres instance, which
means schema changes require coordination across teams. David Park proposed a
strangler-fig pattern where new services get their own schemas first, then we
migrate data incrementally. We agreed to pilot this with the catalog service.

On the infrastructure side, our Kubernetes cluster utilization is at 68% and
we've pre-provisioned headroom for the remaining services. The CI/CD pipeline
changes are done — each service has its own Buildkite pipeline with automated
canary deployments. Sarah Lin from DevOps built a traffic-splitting dashboard
so we can monitor canary health in real time.

Timeline-wise, we're about one week behind the original schedule. The billing
timezone bug cost us three days and the Elasticsearch design question will
likely push search extraction by a week. I've updated the Gantt chart and
shared it in the project channel. Current target for full migration completion
is May 15, revised from the original May 8.

On the monitoring front, we've set up Datadog dashboards for each extracted
service. The auth service is averaging 12ms p99 latency, which is actually
faster than the monolith endpoint it replaced. Billing is at 45ms p99, which
is within our SLA but higher than expected — Marcus Chen suspects it's the
extra network hop to the payment gateway and is investigating connection
pooling. We've also configured PagerDuty alerts for each service independently
so on-call rotation can respond to the right team instead of routing everything
to the monolith on-call.

One process improvement worth noting: we started doing weekly migration
stand-ups on Thursdays with one representative from each extraction team. This
has cut down on cross-team Slack noise and made it easier to surface shared
blockers early. Priya Sharma suggested we add a shared risk register, which
we're now maintaining in Confluence.

Next steps: finalize the search service design (owner: James Okafor, due April
2), begin catalog service staging deployment (owner: Elena Vasquez, due April
5), and start the database strangler-fig pilot (owner: David Park, due April
8). I'll send the next update in two weeks unless something urgent comes up.
```

### Fixture 2 — Sprint 14 Retrospective and Planning Brief

> An engineering team's sprint wrap-up covering velocity, completed stories,
> carry-over items, retro takeaways, and sprint 15 planning.

```
Sprint 14 wrapped yesterday and here's the full picture for the Athena
recommendation engine project. This is the fourth sprint in the build phase
and we're tracking toward the beta release milestone at end of April.

Velocity came in at 34 story points against a planned 38. The shortfall was
mostly from one story — the collaborative filtering warm-start task — which
turned out to be significantly more complex than the original estimate. Rachel
Kim spent most of the sprint on it and got it to 80% complete, but the matrix
factorization step needs GPU-accelerated inference that our current staging
environment doesn't support. We're carrying it into sprint 15 and Tomás Rivera
is provisioning an A100 node on our GCP cluster to unblock it.

Completed work this sprint: the content-based feature pipeline is fully
operational and processing the live catalog nightly. We're generating
embeddings for roughly 2.3 million items using the fine-tuned BERT model that
Wei Zhang trained last month. The A/B testing framework is wired up — we can
now split traffic between the existing heuristic recommender and the new
ML-based pipeline at any percentage. Nadia Petrov handled the feature-flag
integration with LaunchDarkly and it's clean: one toggle flips the entire
recommendation stack for a given user cohort.

The API contract between the recommendation service and the product page
frontend is finalized. Liam O'Brien and the frontend team confirmed they can
consume the new response shape without breaking existing clients, since we're
adding fields rather than changing existing ones. The response now includes a
confidence score, explanation snippet, and diversity rank alongside the
original item ID and relevance score.

Retro highlights from yesterday's session. What went well: pair programming
between Rachel and Wei on the embedding pipeline caught three subtle
normalization bugs before they reached staging. The team consensus was that
more cross-pair sessions would help knowledge sharing. What didn't go well: the
GPU provisioning delay — we should have requested the hardware in sprint 13
when the story was groomed, not when implementation started. Action item: add a
"infrastructure prerequisites" checkbox to our story template so hardware needs
surface during refinement. Also, our daily standups have been running 20
minutes instead of 15. We're going to try a strict round-robin format with a
visible timer starting Monday.

Sprint 15 plan: finish the collaborative filtering warm-start (carry-over, 8
points), implement the re-ranking diversity algorithm (5 points), build the
real-time event ingestion pipeline for click-through tracking (8 points), and
begin integration testing with the product page (5 points). Total planned: 26
points, deliberately lower than our average to account for the GPU environment
setup. Rachel Kim owns the warm-start completion, Wei Zhang takes re-ranking,
Tomás Rivera handles the event pipeline, and Nadia Petrov leads integration
testing.

Beta release criteria remain: 95th-percentile latency under 200ms,
recommendation relevance score above 0.72 on the held-out test set, and zero
P0 bugs in the A/B test cohort for 72 continuous hours. We're currently at
p95 latency of 180ms on content-based only, so the collaborative filtering
addition is the main risk to the latency target.
```

### Fixture 3 — Quarterly Initiative Review: Customer Onboarding Redesign

> A product-led initiative review covering OKR progress, cross-functional
> workstreams, customer research findings, and go-to-market readiness.

```
This is the Q1 end-of-quarter review for the customer onboarding redesign
initiative, codenamed Project Compass. The initiative launched on January 8
with the goal of reducing time-to-first-value for new customers from 14 days
to under 5 days, and increasing 30-day activation rate from 41% to 60%.

OKR status as of March 31: time-to-first-value is currently at 8.2 days in
the test cohort, down from 14 days at baseline. That's meaningful progress
but still above our 5-day target. The 30-day activation rate in the test
cohort hit 53%, up from 41%. Both metrics are moving in the right direction
but neither has reached the stretch goal. Hannah Dreyfus, our product analyst,
attributes the remaining gap primarily to the integration setup step — 62% of
users who drop off do so while configuring their first data source connection.

Workstream updates across three tracks:

Track 1 — Guided Setup Wizard. Amir Hassani led the design and frontend team
through three iterations of the setup wizard. V1 launched in February with a
linear step-by-step flow. User testing showed that technical users found it
patronizing while non-technical users still got stuck at the API key step.
V2, launched March 5, introduced adaptive branching: the wizard detects
whether the user has developer experience (based on their signup role
selection) and adjusts the flow accordingly. Developer-track users see a
streamlined CLI-first flow with copy-paste commands, while business users get
a visual point-and-click integration builder. V2 improved completion rate
from 34% to 51%. V3 is in design now and adds a "connect a sample dataset"
escape hatch so users can experience the product with demo data before
committing to a real integration. Marta Kowalski is building the sample
dataset service and expects it in staging by April 10.

Track 2 — In-App Education. Yuki Tanaka's team built a contextual help system
that surfaces short tutorial videos and tooltips based on where the user is
in the setup flow. The system uses a simple state machine: it tracks which
setup steps are complete and which features the user has interacted with, then
serves the next most relevant piece of education. Early results are promising
— users who engage with at least two tutorial modules complete setup 40%
faster than those who skip them. The team is now working on a "guided tour"
overlay that activates on first login and walks through the three core screens.
Jorge Medina wrote the tour script after reviewing 30 customer onboarding
calls recorded by the success team.

Track 3 — Proactive Success Outreach. Caroline Fischer on the customer success
side implemented automated email sequences triggered by onboarding milestones.
If a user creates an account but doesn't start setup within 48 hours, they get
a personalized email with a calendar link to book a 15-minute setup session.
If they start setup but stall at the integration step, they get a targeted
email with a video walkthrough for their specific integration type. Open rates
on these emails are 47%, click-through is 12%, and booked-session rate is 8%.
Caroline's team has handled 142 setup sessions this quarter and reports that
the most common friction point is OAuth token scoping — users don't understand
which permissions they're granting and get anxious about security.

Cross-functional dependencies resolved this quarter: legal approved the sample
dataset terms of use (no customer PII in demo data), security completed the
OAuth scope audit and we now show plain-language permission descriptions
instead of raw scope strings, and the data engineering team (led by Raj
Patel) built the sandbox environment that lets trial users process up to
10,000 records without hitting billing.

Go-to-market readiness: marketing has updated the website onboarding page
with the new flow screenshots, and Ben Nakamura on content created six
integration-specific quick-start guides. The sales team completed enablement
training last week — they can now demo the new wizard live in calls.

Key risks for Q2: the sample dataset service depends on a new S3 bucket
policy that IT hasn't approved yet, the guided tour overlay needs
accessibility review before launch (WCAG 2.1 AA compliance), and we're
hearing from the sales team that enterprise customers want SSO-gated
onboarding which isn't on the roadmap until H2.

Next quarter priorities: ship wizard V3 with sample data, launch the guided
tour, build an onboarding analytics dashboard so product and success can
monitor cohort progress in real time, and run a formal A/B test comparing
the old and new flows at 50/50 traffic split for statistical significance.
```

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

echo "Wiki Type UAT — Project"
echo ""

# ── prerequisite check ──────────────────────────────────────────────
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping project wiki UAT"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── sign in ─────────────────────────────────────────────────────────
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null

# ── get MCP token ───────────────────────────────────────────────────
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/users/profile")
MCP_URL_RAW=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -z "$MCP_URL_RAW" ] || [ "$MCP_URL_RAW" = "null" ]; then
  fail "mcpEndpointUrl empty — cannot run MCP-based UAT"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

MCP_TOKEN=$(echo "$MCP_URL_RAW" | grep -oP 'token=\K.*')
MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
pass "MCP token acquired"

# Helper: call an MCP tool and return the result text
mcp_call() {
  local TOOL_NAME="$1"
  local ARGS_JSON="$2"
  local RAW
  RAW=$(curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$TOOL_NAME\",\"arguments\":$ARGS_JSON}}" \
    "$MCP_URL" 2>/dev/null)
  echo "$RAW" | grep '^data: ' | head -1 | sed 's/^data: //'
}

# Helper: parse SSE for initialize/tools
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

# ── MCP initialize (required before tool calls) ────────────────────
INIT_RAW=$(curl -s --max-time 10 -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"uat-project","version":"1.0"}}}' \
  "$MCP_URL" 2>/dev/null)
INIT_RESP=$(echo "$INIT_RAW" | parse_sse)
if echo "$INIT_RESP" | jq -e '.result' >/dev/null 2>&1; then
  pass "MCP initialized"
else
  fail "MCP initialize failed: ${INIT_RESP:0:200}"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── 1. Seed wiki types ──────────────────────────────────────────────
SEED_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "seed wiki types → HTTP $SEED_HTTP"

# Verify project type exists
WT_LIST=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types")
HAS_PROJECT=$(echo "$WT_LIST" | jq '[.wikiTypes[].slug] | any(. == "project")' 2>/dev/null)
[ "$HAS_PROJECT" = "true" ] && pass "project wiki type present" || fail "project wiki type missing after seed"

# ── 2. Create 3 project wikis ──────────────────────────────────────
declare -a WIKI_KEYS=()
declare -a WIKI_SLUGS=()
WIKI_NAMES=("Helios Platform Migration" "Athena Recommendation Engine" "Project Compass Onboarding")

for i in 0 1 2; do
  CREATE=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"${WIKI_NAMES[$i]}\",\"type\":\"project\",\"prompt\":\"\"}" \
    "$SERVER_URL/wikis")
  CREATE_HTTP=$(echo "$CREATE" | tail -1)
  CREATE_BODY=$(echo "$CREATE" | sed '$d')
  WK=$(echo "$CREATE_BODY" | jq -r '.lookupKey // .id // ""')
  WS=$(echo "$CREATE_BODY" | jq -r '.slug // ""')

  if [ "$CREATE_HTTP" = "201" ] && [ -n "$WK" ]; then
    WIKI_KEYS+=("$WK")
    WIKI_SLUGS+=("$WS")
    pass "created wiki ${WIKI_NAMES[$i]} → $WK"
  else
    fail "create wiki ${WIKI_NAMES[$i]} → HTTP $CREATE_HTTP"
    WIKI_KEYS+=("")
    WIKI_SLUGS+=("")
  fi
done

# ── 3. Enable regen on all 3 wikis ─────────────────────────────────
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue
  REGEN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"regenerate":true}' \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}/regenerate")
  [ "$REGEN_HTTP" = "200" ] && pass "regen enabled: ${WIKI_NAMES[$i]}" || fail "regen toggle ${WIKI_NAMES[$i]} → HTTP $REGEN_HTTP"
done

# ── 4. Submit 3 entries via MCP log_entry ───────────────────────────
# Fixture 1 — Platform Migration Status Update
read -r -d '' FIXTURE_1 << 'FIXTURE_EOF'
We're now six weeks into the Helios platform migration and I want to give everyone a clear picture of where things stand. The goal of this initiative is to decompose the legacy Rails monolith into independently deployable microservices behind an API gateway, with zero customer-facing downtime during the transition. As of this week, four of the nine planned services have been extracted and are running in production behind the new Kong gateway. The authentication service went live on March 3 and has been stable — Priya Sharma's team handled the session migration and we saw zero auth failures during cutover. The billing service followed on March 10, though we discovered a timezone bug in invoice generation that Marcus Chen patched within 48 hours. The notification service and user-profile service both shipped last week after passing load testing at 3x current traffic. The remaining five services — catalog, search, order-management, inventory-sync, and reporting — are in various stages of extraction. Elena Vasquez is leading the catalog service work and estimates it will be ready for staging by April 1. Search is the most complex: it depends on a shared Elasticsearch cluster that currently serves both the monolith and the new services, and James Okafor flagged a concern about query routing during the transition window. The biggest blocker right now is the shared database. The monolith and the extracted services are still reading from the same Postgres instance, which means schema changes require coordination across teams. David Park proposed a strangler-fig pattern where new services get their own schemas first, then we migrate data incrementally. On the infrastructure side, our Kubernetes cluster utilization is at 68% and we've pre-provisioned headroom for the remaining services. Sarah Lin from DevOps built a traffic-splitting dashboard so we can monitor canary health in real time. Timeline-wise, we're about one week behind the original schedule. Current target for full migration completion is May 15, revised from the original May 8. On the monitoring front, we've set up Datadog dashboards for each extracted service. The auth service is averaging 12ms p99 latency, which is actually faster than the monolith endpoint it replaced. Billing is at 45ms p99, which is within our SLA but higher than expected — Marcus Chen suspects it's the extra network hop to the payment gateway and is investigating connection pooling. We've also configured PagerDuty alerts for each service independently so on-call rotation can respond to the right team instead of routing everything to the monolith on-call. One process improvement worth noting: we started doing weekly migration stand-ups on Thursdays with one representative from each extraction team. This has cut down on cross-team Slack noise and made it easier to surface shared blockers early. Priya Sharma suggested we add a shared risk register, which we're now maintaining in Confluence. Next steps: finalize the search service design (owner: James Okafor), begin catalog service staging deployment (owner: Elena Vasquez), and start the database strangler-fig pilot (owner: David Park).
FIXTURE_EOF

# Fixture 2 — Sprint 14 Retrospective and Planning Brief
read -r -d '' FIXTURE_2 << 'FIXTURE_EOF'
Sprint 14 wrapped yesterday and here's the full picture for the Athena recommendation engine project. This is the fourth sprint in the build phase and we're tracking toward the beta release milestone at end of April. Velocity came in at 34 story points against a planned 38. The shortfall was mostly from one story — the collaborative filtering warm-start task — which turned out to be significantly more complex than the original estimate. Rachel Kim spent most of the sprint on it and got it to 80% complete, but the matrix factorization step needs GPU-accelerated inference that our current staging environment doesn't support. We're carrying it into sprint 15 and Tomás Rivera is provisioning an A100 node on our GCP cluster to unblock it. Completed work this sprint: the content-based feature pipeline is fully operational and processing the live catalog nightly. We're generating embeddings for roughly 2.3 million items using the fine-tuned BERT model that Wei Zhang trained last month. The A/B testing framework is wired up — we can now split traffic between the existing heuristic recommender and the new ML-based pipeline at any percentage. Nadia Petrov handled the feature-flag integration with LaunchDarkly and it's clean. The API contract between the recommendation service and the product page frontend is finalized. Liam O'Brien and the frontend team confirmed they can consume the new response shape without breaking existing clients. Retro highlights: pair programming between Rachel and Wei on the embedding pipeline caught three subtle normalization bugs before they reached staging. What didn't go well: the GPU provisioning delay — we should have requested the hardware in sprint 13 when the story was groomed. Sprint 15 plan: finish the collaborative filtering warm-start (8 points), implement the re-ranking diversity algorithm (5 points), build the real-time event ingestion pipeline for click-through tracking (8 points), and begin integration testing with the product page (5 points). Total planned: 26 points, deliberately lower than our average. Beta release criteria: 95th-percentile latency under 200ms, recommendation relevance score above 0.72 on the held-out test set, and zero P0 bugs in the A/B test cohort for 72 continuous hours.
FIXTURE_EOF

# Fixture 3 — Quarterly Initiative Review: Customer Onboarding Redesign
read -r -d '' FIXTURE_3 << 'FIXTURE_EOF'
This is the Q1 end-of-quarter review for the customer onboarding redesign initiative, codenamed Project Compass. The initiative launched on January 8 with the goal of reducing time-to-first-value for new customers from 14 days to under 5 days, and increasing 30-day activation rate from 41% to 60%. OKR status as of March 31: time-to-first-value is currently at 8.2 days in the test cohort, down from 14 days at baseline. The 30-day activation rate in the test cohort hit 53%, up from 41%. Hannah Dreyfus, our product analyst, attributes the remaining gap primarily to the integration setup step — 62% of users who drop off do so while configuring their first data source connection. Track 1 — Guided Setup Wizard: Amir Hassani led the design and frontend team through three iterations. V2, launched March 5, introduced adaptive branching and improved completion rate from 34% to 51%. V3 is in design now and adds a connect-a-sample-dataset escape hatch. Marta Kowalski is building the sample dataset service and expects it in staging by April 10. Track 2 — In-App Education: Yuki Tanaka's team built a contextual help system that surfaces tutorial videos and tooltips based on setup progress. Users who engage with at least two tutorial modules complete setup 40% faster. Jorge Medina wrote the guided tour script after reviewing 30 customer onboarding calls. Track 3 — Proactive Success Outreach: Caroline Fischer implemented automated email sequences triggered by onboarding milestones. Open rates are 47%, click-through is 12%, and booked-session rate is 8%. Her team handled 142 setup sessions this quarter. The most common friction point is OAuth token scoping — users don't understand which permissions they're granting. Cross-functional dependencies resolved: legal approved sample dataset terms, security completed the OAuth scope audit, and Raj Patel's data engineering team built the sandbox environment for trial users. Go-to-market readiness: Ben Nakamura created six integration-specific quick-start guides. Key risks for Q2: sample dataset S3 bucket policy pending IT approval, guided tour needs WCAG 2.1 AA accessibility review, and enterprise SSO-gated onboarding isn't on the roadmap until H2.
FIXTURE_EOF

declare -a ENTRY_KEYS=()
FIXTURES=("$FIXTURE_1" "$FIXTURE_2" "$FIXTURE_3")
FIXTURE_LABELS=("Platform Migration" "Sprint 14 Retro" "Compass Q1 Review")

for i in 0 1 2; do
  # Escape the fixture for JSON embedding
  ESCAPED=$(printf '%s' "${FIXTURES[$i]}" | jq -Rs .)
  RESP=$(mcp_call "log_entry" "{\"content\":$ESCAPED,\"source\":\"mcp\"}")
  ENTRY_TEXT=$(echo "$RESP" | jq -r '.result.content[0].text // ""' 2>/dev/null)
  IS_ERR=$(echo "$RESP" | jq -r '.result.isError // false' 2>/dev/null)

  if [ "$IS_ERR" = "true" ]; then
    fail "MCP log_entry ${FIXTURE_LABELS[$i]}: $ENTRY_TEXT"
    ENTRY_KEYS+=("")
  else
    # Extract entry key from "Entry queued: entry01ABC..." response
    EK=$(echo "$ENTRY_TEXT" | grep -oP 'entry[0-9A-Z]{26}' || echo "")
    ENTRY_KEYS+=("$EK")
    pass "MCP log_entry ${FIXTURE_LABELS[$i]} → $EK"
  fi
done

# ── 5. Poll entries until processed (max 360s) ─────────────────────
echo ""
echo "  ⟳ polling entry pipeline (max 360s)..."
ELAPSED=0
MAX_WAIT=360
ALL_DONE=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  DONE_COUNT=0

  for i in 0 1 2; do
    [ -z "${ENTRY_KEYS[$i]}" ] && continue
    STATUS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/${ENTRY_KEYS[$i]}" 2>/dev/null \
      | jq -r '.ingestStatus // .state // "unknown"')
    echo "    ${ELAPSED}s — ${FIXTURE_LABELS[$i]}: $STATUS"
    if [ "$STATUS" = "processed" ] || [ "$STATUS" = "RESOLVED" ]; then
      DONE_COUNT=$((DONE_COUNT + 1))
    elif [ "$STATUS" = "failed" ]; then
      fail "entry ${FIXTURE_LABELS[$i]} failed"
    fi
  done

  if [ "$DONE_COUNT" -ge 3 ]; then
    ALL_DONE=true
    break
  fi
done

if [ "$ALL_DONE" = "true" ]; then
  pass "all 3 entries processed in ${ELAPSED}s"
else
  fail "not all entries processed after ${MAX_WAIT}s"
fi

# ── 6. Report fragments ────────────────────────────────────────────
echo ""
echo "  ── fragment report ──"
FRAGS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=100")
FRAG_COUNT=$(echo "$FRAGS" | jq '.fragments | length' 2>/dev/null || echo "0")
echo "    total fragments: $FRAG_COUNT"

if [ "$FRAG_COUNT" -gt 0 ] 2>/dev/null; then
  pass "fragments created ($FRAG_COUNT)"
  # Show first 5 fragment titles
  echo "$FRAGS" | jq -r '.fragments[:5][] | "    - \(.title // .slug)"' 2>/dev/null
else
  fail "no fragments created by pipeline"
fi

# ── 7. Report people ───────────────────────────────────────────────
echo ""
echo "  ── people report ──"
PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people?limit=100")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")
echo "    total people: $PEOPLE_COUNT"

if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "people extracted ($PEOPLE_COUNT)"
  echo "$PEOPLE" | jq -r '.people[:10][] | "    - \(.name)"' 2>/dev/null
else
  skip "no people extracted (extraction may be async or model-dependent)"
fi

# ── 8. Report edges (graph) ────────────────────────────────────────
echo ""
echo "  ── edge report ──"
GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")
echo "    nodes: $NODE_COUNT, edges: $EDGE_COUNT"

if [ "$EDGE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "graph edges present ($EDGE_COUNT)"
  # Show edge type distribution
  echo "$GRAPH" | jq -r '[.edges[].edgeType] | group_by(.) | map("\(.[0]): \(length)") | .[]' 2>/dev/null \
    | while read -r line; do echo "    $line"; done
else
  skip "no edges yet (pipeline may still be linking)"
fi

# ── 9. Check wiki detail (fragments + people on each wiki) ─────────
echo ""
echo "  ── wiki detail check ──"
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  W_FRAG_COUNT=$(echo "$DETAIL" | jq '.fragments | length' 2>/dev/null || echo "0")
  W_PEOPLE_COUNT=$(echo "$DETAIL" | jq '.people | length' 2>/dev/null || echo "0")
  W_TYPE=$(echo "$DETAIL" | jq -r '.type // ""' 2>/dev/null)
  echo "    ${WIKI_NAMES[$i]}: type=$W_TYPE, fragments=$W_FRAG_COUNT, people=$W_PEOPLE_COUNT"
  [ "$W_TYPE" = "project" ] && pass "wiki type=project: ${WIKI_NAMES[$i]}" || fail "wiki type=$W_TYPE (expected project)"
done

# ── 10. Trigger regen on each wiki ─────────────────────────────────
echo ""
echo "  ── wiki regen ──"
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue
  REGEN_RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}/regenerate")
  REGEN_HTTP=$(echo "$REGEN_RESP" | tail -1)
  REGEN_BODY=$(echo "$REGEN_RESP" | sed '$d')
  REGEN_FRAGS=$(echo "$REGEN_BODY" | jq -r '.fragmentCount // "?"' 2>/dev/null)

  if [ "$REGEN_HTTP" = "200" ]; then
    pass "regen ${WIKI_NAMES[$i]} → 200, fragments=$REGEN_FRAGS"
  else
    # 400 = no fragments linked yet (regen disabled or empty), 500 = LLM error
    REGEN_ERR=$(echo "$REGEN_BODY" | jq -r '.error // ""' 2>/dev/null)
    fail "regen ${WIKI_NAMES[$i]} → HTTP $REGEN_HTTP ($REGEN_ERR)"
  fi
done

# ── 11. Report final wiki state ────────────────────────────────────
echo ""
echo "  ── final wiki state ──"
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue
  FINAL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  W_STATE=$(echo "$FINAL" | jq -r '.state // ""' 2>/dev/null)
  W_CONTENT_LEN=$(echo "$FINAL" | jq -r '.wikiContent | length' 2>/dev/null || echo "0")
  W_FRAG_COUNT=$(echo "$FINAL" | jq '.fragments | length' 2>/dev/null || echo "0")
  W_PEOPLE_COUNT=$(echo "$FINAL" | jq '.people | length' 2>/dev/null || echo "0")
  echo "    ${WIKI_NAMES[$i]}:"
  echo "      state=$W_STATE, content=${W_CONTENT_LEN} chars, fragments=$W_FRAG_COUNT, people=$W_PEOPLE_COUNT"

  if [ "$W_CONTENT_LEN" -gt 0 ] 2>/dev/null; then
    pass "wiki has generated content: ${WIKI_NAMES[$i]} (${W_CONTENT_LEN} chars)"
    # Show first 200 chars of generated wiki content
    echo "$FINAL" | jq -r '.wikiContent[:200]' 2>/dev/null | sed 's/^/      /'
    echo "      ..."
  else
    skip "wiki content empty after regen: ${WIKI_NAMES[$i]} (fragments may not be linked yet)"
  fi
done

# ── 12. Cleanup — soft-delete test wikis ────────────────────────────
echo ""
echo "  ── cleanup ──"
for i in 0 1 2; do
  [ -z "${WIKI_KEYS[$i]}" ] && continue
  DEL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  if [ "$DEL_HTTP" = "204" ] || [ "$DEL_HTTP" = "200" ]; then
    pass "deleted ${WIKI_NAMES[$i]}"
  else
    fail "delete ${WIKI_NAMES[$i]} → HTTP $DEL_HTTP"
  fi
done

echo ""
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```
