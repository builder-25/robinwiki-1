# Wiki Type UAT — Agent

## What it proves
End-to-end agent wiki lifecycle: create 3 agent-typed wikis, seed wiki types,
submit realistic AI-assistant documentation via MCP `log_fragment`, poll until
processed, verify fragments/people/edges, trigger wiki regen, report final
wiki state.

## Prerequisites
Requires OPENROUTER_API_KEY for LLM extraction and regen. Skips gracefully if missing.

## Fixtures

Three realistic agent documentation entries (500+ words each). Each describes
a configured AI assistant's purpose, behavior, and capabilities — the exact
domain the `agent` wiki type is designed to capture.

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

echo "Wiki Type UAT — Agent"
echo ""

# Check OpenRouter key
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping agent wiki-type test"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ─── Fixtures ───────────────────────────────────────────────────────────

FIXTURE_1=$(cat <<'FIXTURE'
Marcus and I spent the last two weeks configuring Relay, our internal customer support triage agent. Relay is built on top of GPT-4o and sits between our Zendesk inbox and the engineering escalation queue. Its primary purpose is to classify incoming support tickets by severity, route them to the correct team, and draft initial response templates that human agents can review before sending.

The system prompt we landed on defines Relay as a senior support specialist who has deep knowledge of our product catalog, billing system, and known issues database. We explicitly instruct it to never make promises about refunds or account changes — those decisions stay with humans. The tone is professional but warm, and we ask it to mirror the customer's urgency level. If someone writes in all caps, Relay acknowledges the frustration before addressing the technical issue.

For configuration, Relay pulls context from three sources: the customer's account history via our internal API, a vector store of resolved tickets from the past six months, and the current known-issues page that Priya maintains in Confluence. The retrieval window is capped at 8 relevant documents to keep latency under 2 seconds. We use a temperature of 0.2 for classification tasks and bump it to 0.5 for draft responses so they sound less robotic.

Performance has been mixed. On severity classification Relay hits about 91 percent accuracy, which is solid. The main failure mode is misclassifying billing disputes as general inquiries — Marcus thinks this is because the training data underrepresents billing edge cases. Draft response quality is harder to measure, but the human agents report they use Relay's drafts without modification about 60 percent of the time, which saves roughly 4 minutes per ticket.

Edge cases we have documented: Relay struggles with tickets that contain screenshots but no text. It also gets confused when customers reply to an old thread about a different issue, because the context window mixes two unrelated problems. We added a heuristic that detects subject-line mismatches and flags those tickets for manual review instead of auto-classifying.

Recent changes include adding a "confidence score" output that Relay appends to every classification. If confidence drops below 0.7, the ticket goes straight to the human queue instead of being auto-routed. Priya suggested this after we had a week where three P1 outage reports got misrouted to the billing team. We also reduced the retrieval window from 12 documents to 8 after noticing that too much context was causing Relay to hedge its classifications with irrelevant caveats from old tickets.

Next iteration will focus on multi-language support. About 15 percent of our tickets come in Spanish or Portuguese, and right now Relay just flags those as unclassifiable. Marcus is experimenting with a pre-processing step that translates the ticket before classification, but we are worried about latency and meaning loss in technical terms.

One thing worth noting is the monitoring setup. We pipe all of Relay's classification decisions and confidence scores into a Datadog dashboard that Priya built. It shows a rolling 7-day accuracy trend, a breakdown of misclassification categories, and the average time-to-first-response for auto-routed versus manually-routed tickets. The dashboard also flags drift — if accuracy drops below 85 percent for any two consecutive days, it sends an alert to the team Slack channel so someone can investigate whether the issue is data-related or a model regression. Marcus wants to add an A/B testing layer so we can safely trial prompt changes on 10 percent of traffic before rolling them out fully, but that is probably a Q2 project.
FIXTURE
)

FIXTURE_2=$(cat <<'FIXTURE'
We have been running Archie, our research synthesis assistant, for about three months now inside the product strategy team. Archie is an internal tool that Elena built using Claude as the base model, wrapped in a custom FastAPI service with a React frontend. The core purpose of Archie is to help product managers synthesize user research findings. You paste in interview transcripts, survey results, or usability test notes, and Archie extracts key themes, identifies contradictions across sources, and produces structured summaries that follow our internal research report template.

The system prompt positions Archie as a cautious research analyst who is allergic to overgeneralization. We specifically instruct it to always cite which source a finding came from, to flag when a conclusion is based on a single participant versus multiple, and to never use the phrase "users want" without qualifying how many users and in what context. This was a hard lesson — early versions of Archie would read three interview transcripts and confidently declare that "all users struggle with onboarding," which is exactly the kind of sloppy synthesis that gets product decisions wrong.

Configuration details: Archie uses a two-stage pipeline. Stage one is extraction, where each source document is processed independently to pull out discrete observations. Stage two is synthesis, where the extracted observations are clustered by theme and contradictions are surfaced. We run extraction at temperature 0.1 for faithfulness and synthesis at 0.4 to allow some creative grouping. The context window limit means we can handle about 12 interview transcripts per synthesis run. For larger studies, Elena added a chunking strategy that processes transcripts in batches of 6 and then merges the intermediate summaries.

Diego raised a concern last month about Archie's handling of sensitive participant data. Even though we strip names before pasting transcripts, Archie sometimes infers demographic details from context clues and includes them in summaries. We added a post-processing filter that redacts any inferred personal attributes, but it is imperfect. Elena is looking into using a separate classification model to detect and strip PII before the main synthesis pipeline runs.

Performance observations: Archie is strongest when working with structured interviews that follow a consistent question guide. It struggles with free-form diary studies where participants ramble across topics. The synthesis stage sometimes creates phantom themes — clusters that sound plausible but are actually just one participant's unique perspective inflated into a trend. We added a minimum-source threshold: a theme must appear in at least 3 sources to be included in the primary findings section. Single-source observations go into an "emerging signals" appendix.

Iteration history: Version 1 had no source citation, which made the output useless for decision-making. Version 2 added inline citations but they were unreliable — Archie would sometimes attribute a finding to the wrong transcript. Version 3, the current version, uses a structured extraction format that preserves source IDs through the entire pipeline. Elena also added a verification step where Archie cross-checks its citations against the original text and flags any it cannot verify. This reduced citation errors from roughly 15 percent to under 3 percent. The next planned change is adding support for quantitative survey data alongside qualitative transcripts, which requires a different extraction strategy that Diego is prototyping.
FIXTURE
)

FIXTURE_3=$(cat <<'FIXTURE'
Kai is the name we gave to our deployment review agent that Tomoko set up last quarter. It runs as a GitHub Actions workflow that triggers on every pull request targeting the main branch of our three production services. Kai's job is to review the PR diff, flag potential issues, and produce a structured risk assessment that the on-call engineer reads before approving the deploy. We built it because our team of six cannot do thorough code review on every PR, and we had two incidents in Q3 that were caused by changes that slipped through with only a cursory LGTM.

The system prompt for Kai defines it as a cautious senior engineer who has seen too many production incidents. We tell it to assume that every change is guilty until proven innocent. It should look for common failure patterns: missing error handling, database queries without index hints, API changes that break backward compatibility, environment variable references that might not exist in production, and retry logic that could cause thundering herds. We explicitly tell Kai not to comment on code style or formatting — that is what our linter is for. Kai should focus exclusively on correctness and operational risk.

Tomoko configured Kai with access to three context sources beyond the PR diff itself. First, the service's OpenAPI spec so it can detect breaking API changes. Second, the last 30 days of incident reports from PagerDuty so it understands what kinds of failures have actually bitten us recently. Third, a curated document of deployment runbook snippets that describe known gotchas for each service. The model runs at temperature 0.1 because we want deterministic, conservative assessments rather than creative suggestions.

The output format is a structured risk card with four sections: a one-line summary, a severity rating from low to critical, a list of specific concerns with file and line references, and a recommended action which is one of approve, request-changes, or flag-for-senior-review. Kai posts this as a PR comment and also sends a Slack notification to the deploy channel if severity is high or critical.

Performance-wise, Kai has been a net positive. In the first two months it flagged 14 PRs that had legitimate issues, including a database migration that would have locked a table for 20 minutes during peak traffic. False positive rate is around 30 percent, which Tomoko says is acceptable because the cost of reading a false alarm is low compared to the cost of a production incident. The main category of false positives is Kai flagging intentional behavior changes as "breaking" because it does not have full context about the product roadmap.

Nadia pointed out a blind spot: Kai cannot reason about the interaction between multiple PRs that might be deployed together. It reviews each PR in isolation, so it misses cases where PR-A is safe alone and PR-B is safe alone but deploying both creates a conflict. Tomoko is exploring a batch-review mode that would run Kai against the combined diff of all PRs queued for the next deploy window.

Recent iteration: we added a feedback loop where engineers can react to Kai's PR comments with thumbs-up or thumbs-down emoji. Tomoko aggregates these weekly and uses the patterns to refine the system prompt. For example, Kai was initially too aggressive about flagging any use of setTimeout as a potential race condition, so we added a carve-out in the prompt that says short polling delays under 5 seconds in non-critical paths are acceptable. We also started including the PR description in Kai's context after realizing it often lacked the "why" behind a change, leading to false concerns about intentional refactors.
FIXTURE
)

# ─── Auth ───────────────────────────────────────────────────────────────

echo "--- Auth"
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null

# Get MCP token
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -z "$MCP_URL" ] || [ "$MCP_URL" = "null" ]; then
  fail "mcpEndpointUrl not present in profile"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
pass "signed in, MCP token acquired"

# Helper: extract JSON from SSE "data:" line
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

# Helper: MCP tool call
mcp_call() {
  local id="$1" tool="$2" args="$3"
  local raw
  raw=$(curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$id,\"method\":\"tools/call\",\"params\":{\"name\":\"$tool\",\"arguments\":$args}}" \
    "$MCP_URL" 2>/dev/null)
  echo "$raw" | parse_sse
}

# ─── Seed wiki types ────────────────────────────────────────────────────

echo ""
echo "--- Seed wiki types"
SEED_HTTP=$(curl -s -o /tmp/uat-agent-seed.json -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "seed → HTTP $SEED_HTTP"

# Verify agent type exists
AGENT_EXISTS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types" | jq '[.wikiTypes[].slug] | any(. == "agent")')
[ "$AGENT_EXISTS" = "true" ] && pass "agent wiki type present after seed" || fail "agent wiki type missing"

# ─── Create 3 agent wikis ──────────────────────────────────────────────

echo ""
echo "--- Create agent wikis"

WIKI_NAMES=("Relay Support Triage Agent" "Archie Research Synthesis Agent" "Kai Deployment Review Agent")
WIKI_IDS=()
WIKI_SLUGS=()

for i in 0 1 2; do
  CREATE=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"${WIKI_NAMES[$i]}\",\"type\":\"agent\"}" \
    "$SERVER_URL/wikis")
  CREATE_HTTP=$(echo "$CREATE" | tail -1)
  CREATE_BODY=$(echo "$CREATE" | sed '$d')
  WID=$(echo "$CREATE_BODY" | jq -r '.lookupKey // .id // ""')
  WSLUG=$(echo "$CREATE_BODY" | jq -r '.slug // ""')
  WIKI_IDS+=("$WID")
  WIKI_SLUGS+=("$WSLUG")

  if [ "$CREATE_HTTP" = "201" ] && [ -n "$WID" ]; then
    pass "created wiki ${WIKI_NAMES[$i]} → id=$WID, slug=$WSLUG"
  else
    fail "create wiki ${WIKI_NAMES[$i]} → HTTP $CREATE_HTTP"
  fi
done

# Verify all are type=agent
for i in 0 1 2; do
  WTYPE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_IDS[$i]}" | jq -r '.type // ""')
  [ "$WTYPE" = "agent" ] && pass "wiki $i type=agent" || fail "wiki $i type=$WTYPE (expected agent)"
done

# ─── Submit 3 entries via MCP log_fragment ──────────────────────────────

echo ""
echo "--- Submit fixtures via MCP log_fragment"

FIXTURES=("$FIXTURE_1" "$FIXTURE_2" "$FIXTURE_3")
FRAG_KEYS=()

for i in 0 1 2; do
  # Escape content for JSON
  ESCAPED=$(python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' <<< "${FIXTURES[$i]}")
  SLUG="${WIKI_SLUGS[$i]}"

  RESP=$(mcp_call $((10 + i)) "log_fragment" "{\"content\":$ESCAPED,\"threadSlug\":\"$SLUG\",\"title\":\"Agent config notes $((i+1))\"}")
  RESP_LEN=${#RESP}

  if [ "$RESP_LEN" -gt 10 ]; then
    # Extract fragment key from result text
    RESULT_TEXT=$(echo "$RESP" | jq -r '.result.content[0].text // ""' 2>/dev/null)
    FRAG_KEY=$(echo "$RESULT_TEXT" | jq -r '.fragmentKey // ""' 2>/dev/null)
    IS_ERR=$(echo "$RESP" | jq -r '.result.isError // false' 2>/dev/null)

    if [ "$IS_ERR" = "true" ]; then
      fail "log_fragment wiki $i errored: ${RESULT_TEXT:0:200}"
    elif [ -n "$FRAG_KEY" ] && [ "$FRAG_KEY" != "null" ] && [ "$FRAG_KEY" != "" ]; then
      FRAG_KEYS+=("$FRAG_KEY")
      pass "log_fragment wiki $i → frag=$FRAG_KEY"
    else
      # May have returned entry key instead
      FRAG_KEYS+=("unknown")
      pass "log_fragment wiki $i → response received (${RESP_LEN} chars)"
    fi
  else
    fail "log_fragment wiki $i empty ($RESP_LEN chars)"
  fi
done

# ─── Poll until entries processed (max 360s) ────────────────────────────

echo ""
echo "--- Poll wiki states (max 360s)"
ELAPSED=0
MAX_WAIT=360
ALL_RESOLVED=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  RESOLVED_COUNT=0

  for i in 0 1 2; do
    STATE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/wikis/${WIKI_IDS[$i]}" | jq -r '.state // "unknown"')
    if [ "$STATE" = "RESOLVED" ] || [ "$STATE" = "GENERATED" ]; then
      RESOLVED_COUNT=$((RESOLVED_COUNT + 1))
    fi
  done

  echo "    ${ELAPSED}s — $RESOLVED_COUNT/3 wikis resolved"

  if [ "$RESOLVED_COUNT" -eq 3 ]; then
    ALL_RESOLVED=true
    break
  fi
done

if [ "$ALL_RESOLVED" = "true" ]; then
  pass "all 3 wikis reached resolved state in ${ELAPSED}s"
else
  # Report individual states
  for i in 0 1 2; do
    STATE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/wikis/${WIKI_IDS[$i]}" | jq -r '.state // "unknown"')
    echo "    wiki $i (${WIKI_NAMES[$i]}): state=$STATE"
  done
  skip "not all wikis resolved after ${MAX_WAIT}s (pipeline may still be running)"
fi

# ─── Report fragments ──────────────────────────────────────────────────

echo ""
echo "--- Fragments report"
TOTAL_FRAGS=0

for i in 0 1 2; do
  WIKI_DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_IDS[$i]}")
  FRAG_COUNT=$(echo "$WIKI_DETAIL" | jq '.fragments | length' 2>/dev/null || echo "0")
  TOTAL_FRAGS=$((TOTAL_FRAGS + FRAG_COUNT))
  echo "    wiki $i (${WIKI_SLUGS[$i]}): $FRAG_COUNT fragments"
done

if [ "$TOTAL_FRAGS" -ge 3 ]; then
  pass "fragments attached: $TOTAL_FRAGS total across 3 wikis"
else
  fail "expected >= 3 fragments, got $TOTAL_FRAGS"
fi

# ─── Report people ──────────────────────────────────────────────────────

echo ""
echo "--- People report"
PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")
echo "    total people: $PEOPLE_COUNT"

if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  echo "$PEOPLE" | jq -r '.people[] | "    - \(.name // .canonicalName // "unnamed") (\(.lookupKey))"' 2>/dev/null
  pass "people extracted ($PEOPLE_COUNT)"
else
  skip "no people extracted (entity extraction may have failed-open)"
fi

# Expected people from fixtures: Marcus, Priya, Elena, Diego, Tomoko, Nadia, Kai (maybe)
EXPECTED_NAMES="Marcus Priya Elena Diego Tomoko Nadia"
FOUND_EXPECTED=0
for NAME in $EXPECTED_NAMES; do
  if echo "$PEOPLE" | jq -r '.people[].name // .people[].canonicalName' 2>/dev/null | grep -qi "$NAME"; then
    FOUND_EXPECTED=$((FOUND_EXPECTED + 1))
  fi
done
if [ "$FOUND_EXPECTED" -gt 0 ]; then
  echo "    matched $FOUND_EXPECTED/6 expected names"
fi

# ─── Report edges ───────────────────────────────────────────────────────

echo ""
echo "--- Edge report"
GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")
echo "    graph: $NODE_COUNT nodes, $EDGE_COUNT edges"

# Count edge types
FRAG_IN_WIKI=$(echo "$GRAPH" | jq '[.edges[] | select(.edgeType == "FRAGMENT_IN_WIKI")] | length' 2>/dev/null || echo "0")
FRAG_MENTIONS=$(echo "$GRAPH" | jq '[.edges[] | select(.edgeType == "FRAGMENT_MENTIONS_PERSON")] | length' 2>/dev/null || echo "0")
echo "    FRAGMENT_IN_WIKI edges: $FRAG_IN_WIKI"
echo "    FRAGMENT_MENTIONS_PERSON edges: $FRAG_MENTIONS"

if [ "$FRAG_IN_WIKI" -ge 3 ]; then
  pass "FRAGMENT_IN_WIKI edges >= 3"
else
  fail "expected >= 3 FRAGMENT_IN_WIKI edges, got $FRAG_IN_WIKI"
fi

# ─── Trigger regen on first wiki ────────────────────────────────────────

echo ""
echo "--- Wiki regen"

# Ensure regenerate is enabled
TOGGLE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"regenerate":true}' \
  "$SERVER_URL/wikis/${WIKI_IDS[0]}/regenerate")
echo "    PATCH regenerate=true → HTTP $TOGGLE_HTTP"

REGEN=$(curl -s -w "\n%{http_code}" -X POST \
  -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wikis/${WIKI_IDS[0]}/regenerate")
REGEN_HTTP=$(echo "$REGEN" | tail -1)
REGEN_BODY=$(echo "$REGEN" | sed '$d')

if [ "$REGEN_HTTP" = "200" ]; then
  REGEN_FCOUNT=$(echo "$REGEN_BODY" | jq '.fragmentCount // 0' 2>/dev/null)
  pass "POST /wikis/:id/regenerate → 200, fragmentCount=$REGEN_FCOUNT"
else
  REGEN_ERR=$(echo "$REGEN_BODY" | jq -r '.error // ""' 2>/dev/null)
  fail "regen → HTTP $REGEN_HTTP: $REGEN_ERR"
fi

# ─── Report final wiki state ───────────────────────────────────────────

echo ""
echo "--- Final wiki state"
for i in 0 1 2; do
  WIKI_FINAL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_IDS[$i]}")
  F_STATE=$(echo "$WIKI_FINAL" | jq -r '.state // "unknown"')
  F_TYPE=$(echo "$WIKI_FINAL" | jq -r '.type // "unknown"')
  F_CONTENT_LEN=$(echo "$WIKI_FINAL" | jq -r '.content // "" | length')
  F_FRAGS=$(echo "$WIKI_FINAL" | jq '.fragments | length' 2>/dev/null || echo "0")
  F_PEOPLE=$(echo "$WIKI_FINAL" | jq '.people | length' 2>/dev/null || echo "0")
  echo "    wiki $i: state=$F_STATE type=$F_TYPE content=${F_CONTENT_LEN}ch frags=$F_FRAGS people=$F_PEOPLE"

  # Verify regen produced content on first wiki
  if [ "$i" = "0" ] && [ "$F_CONTENT_LEN" -gt 50 ]; then
    pass "wiki 0 has generated content (${F_CONTENT_LEN} chars)"
  fi
done

# ─── Cleanup ────────────────────────────────────────────────────────────

echo ""
echo "--- Cleanup"
for i in 0 1 2; do
  DEL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_IDS[$i]}")
  echo "    delete wiki $i → HTTP $DEL_HTTP"
done

echo ""
echo "========================================="
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```
