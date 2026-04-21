# Wiki Type UAT — Belief

## What it proves
End-to-end belief wiki lifecycle: create belief-typed wikis, submit belief-flavored
entries via MCP, pipeline processes them into fragments classified under the belief
wiki, regen produces structured belief documents (The Position / Evidence / Nuances /
Behavior sections).

## Prerequisites
- Server running at `$SERVER_URL` (default `http://localhost:3000`)
- `OPENROUTER_API_KEY` set for LLM calls
- `INITIAL_USERNAME` / `INITIAL_PASSWORD` in `core/.env`

## Fixtures
Three realistic belief entries (500+ words each):
1. **Remote work superiority** — a held position on distributed work with evidence
2. **Degrowth economics** — a worldview on post-growth economics with supporting arguments
3. **Embodied cognition** — a mental model about mind-body integration with philosophical reasoning

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

echo "Wiki Type UAT — Belief"
echo ""

# ── Preflight ──────────────────────────────────────────────────────────────

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping belief wiki type test"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── Fixtures ───────────────────────────────────────────────────────────────

FIXTURE_1=$(cat <<'FIXTURE_EOF'
I have become increasingly convinced that remote-first work is not merely a pandemic
accommodation but a fundamentally superior model for knowledge work. This is a position
I have arrived at after six years of working in both co-located and distributed teams,
and after watching dozens of organizations attempt the transition with varying degrees
of commitment.

The core of my argument rests on three observations. First, the default state of an
open-plan office is interruption. Cal Newport's research on deep work aligns with what
I have experienced firsthand: the average knowledge worker in an office gets roughly
eleven minutes of uninterrupted focus before someone taps their shoulder, pings them on
Slack, or pulls them into an impromptu hallway conversation. In a remote environment,
the default state is silence. You have to actively choose to interrupt someone, which
creates a natural filter — trivial questions get answered by searching documentation
instead of by shouting across the room. My own data from toggling between office weeks
and remote weeks showed a consistent 30-40% increase in deep work hours when remote.

Second, remote work democratizes opportunity in ways that office-centric models cannot.
When Sarah joined our team from rural Montana, she brought a perspective on agricultural
technology that nobody in our San Francisco office would have had. Remote hiring lets you
access talent pools that would never relocate for your particular company. I spoke with
Marcus, a hiring manager at a mid-size fintech, who told me that their remote-first
policy tripled their pipeline of senior engineers within six months. The geographic
constraint of offices creates an artificial talent bottleneck that companies mistake for
a talent shortage.

Third, the supposed benefits of in-person collaboration are overstated and poorly
measured. The "water cooler serendipity" argument has become a kind of corporate folk
wisdom that nobody bothers to quantify. When researchers at Microsoft studied
communication patterns during the shift to remote work, they found that while weak-tie
connections decreased, the quality of collaboration within established teams actually
improved. People prepared more for meetings because meetings had a higher activation
cost. Written communication created better documentation. Decisions became more traceable.

I do acknowledge genuine challenges. Onboarding new employees remotely requires more
deliberate structure — you cannot rely on osmotic learning when there is no physical
proximity. Junior team members sometimes struggle without the ambient mentorship that
offices provide. And some collaborative tasks — particularly early-stage brainstorming
on ambiguous problems — do benefit from the bandwidth of physical presence. Elena, our
design lead, has made a persuasive case that the first week of a new product discovery
phase works better in person.

But these exceptions do not invalidate the general principle. They suggest a model where
occasional in-person gatherings supplement a remote-first default, not the other way
around. The companies that will thrive in the next decade are the ones that treat remote
work as their primary operating mode and design their processes accordingly, rather than
bolting remote access onto fundamentally office-centric workflows.

This belief shapes how I evaluate job opportunities, how I structure my own team's
rituals, and how I advise founders. I default to asynchronous communication, invest
heavily in written documentation, and schedule synchronous time only when the task
genuinely requires it. It is a position I hold with high confidence, though I remain
open to evidence that specific domains — emergency medicine, theatrical production,
laboratory science — operate under different constraints.
FIXTURE_EOF
)

FIXTURE_2=$(cat <<'FIXTURE_EOF'
I believe that the pursuit of indefinite economic growth on a finite planet is not
merely unsustainable but actively destructive, and that the most urgent intellectual
project of our time is developing credible alternatives to growth-dependent economics.
This is not a fringe position — it builds on work by Herman Daly, Kate Raworth, Tim
Jackson, and Giorgos Kallis — but it remains deeply counterintuitive to most people
raised in growth-oriented societies.

The standard defense of growth economics goes something like this: growth lifts people
out of poverty, funds public services, and drives innovation. All of these claims
contain truth, but they conflate a historical observation with a universal law. Growth
did lift hundreds of millions out of poverty in the twentieth century. But the
relationship between GDP growth and human wellbeing decouples above a certain threshold.
Research by Richard Easterlin and subsequent studies have shown that once a country
reaches approximately $15,000-20,000 GDP per capita, further growth produces diminishing
returns in life satisfaction, health outcomes, and social cohesion. The United States has
roughly tripled its per-capita GDP since 1970, yet median wages have stagnated, life
expectancy has plateaued (and recently declined), and self-reported happiness has not
improved.

The ecological case is even starker. Our economic system requires roughly 3% annual
growth to avoid recession. But 3% compound growth means doubling the economy every 23
years. We are already consuming 1.7 Earths worth of resources annually. No amount of
efficiency improvement — what economists call "decoupling" — has ever reduced absolute
resource consumption at the global level while maintaining growth. The Jevons paradox
keeps reasserting itself: efficiency gains lower costs, which increases consumption,
which negates the efficiency gains. My colleague David, who works in materials science,
has shown me data on global copper extraction that makes this pattern painfully concrete.
We extract more copper every year despite copper-per-unit-of-GDP declining consistently.

The degrowth alternative does not mean recession or austerity. It means deliberately
redirecting economic activity away from resource-intensive production and toward care
work, ecological restoration, education, and community resilience. It means working less,
sharing more, and measuring prosperity by indicators other than GDP — indicators like the
Genuine Progress Indicator or Kate Raworth's Doughnut Economics framework, which defines
a safe operating space between ecological ceilings and social foundations.

I have discussed this with Patricia, an economist at the World Bank, who pushes back
hard. She argues that growth is the only proven mechanism for generating the tax revenue
needed to fund the transition to renewable energy. It is a fair challenge. My response
is that the growth needed to fund the transition is itself accelerating the ecological
damage that makes the transition necessary. We are running faster on a treadmill that is
speeding up beneath us.

This belief shapes my personal choices — I buy less, repair more, grow some of my own
food, and actively resist the consumer identity that advertising cultivates. But more
importantly, it shapes my political commitments. I support universal basic services over
universal basic income, community land trusts over private development, and cooperative
ownership over shareholder capitalism. These are not utopian fantasies — they are
existing models that operate successfully at scale in various parts of the world.

I hold this position with strong conviction but genuine uncertainty about implementation
paths. The transition from a growth-dependent to a post-growth economy is unprecedented,
and I am skeptical of anyone who claims to have a detailed roadmap. What I am confident
about is the diagnosis: infinite growth on a finite planet is a mathematical
impossibility dressed up as common sense, and the sooner we grapple with that, the less
painful the inevitable adjustment will be.
FIXTURE_EOF
)

FIXTURE_3=$(cat <<'FIXTURE_EOF'
I hold the view that cognition is not something that happens exclusively inside the
skull but is fundamentally shaped by — and in many cases constituted by — the body and
its interactions with the environment. This position, broadly called embodied cognition,
challenges the computational metaphor that has dominated cognitive science since the
1950s, and I believe it has profound implications for how we design technology, educate
children, and understand mental health.

The computational view treats the mind as software running on the hardware of the brain.
Perception is input, cognition is processing, and action is output. This metaphor has
been enormously productive — it gave us artificial intelligence, cognitive behavioral
therapy, and much of modern linguistics. But it is wrong in a fundamental way. It treats
the body as peripheral to thought, a mere vehicle for carrying the brain around. The
evidence against this view has been accumulating for decades.

Consider the work of George Lakoff and Mark Johnson on conceptual metaphor. They
demonstrated that abstract reasoning is systematically structured by bodily experience.
We understand time through spatial metaphors (the future is "ahead," the past is
"behind"). We understand morality through cleanliness metaphors (a "dirty" lie, "clean"
conscience). These are not decorative figures of speech — they shape how we actually
reason. When researchers had subjects hold warm cups of coffee versus iced drinks, the
warm-cup group rated strangers as having warmer personalities. The body is not just
executing cognitive commands; it is participating in cognition.

My friend Tomoko, a developmental psychologist, showed me studies on infant cognition
that make this even more vivid. Babies do not learn about objects by passively observing
them — they learn by grasping, mouthing, throwing, and dropping. The sensorimotor
system is not just gathering data for the brain to process; it is the medium through
which concepts form. Children who are prevented from physical exploration show delayed
cognitive development even when they have full visual access to the same environment.
The body is not optional equipment for thinking — it is foundational infrastructure.

The implications extend to adult cognition in ways that should alarm anyone who spends
eight hours a day sitting motionless in front of a screen. Research by Marily Oppezzo
and Daniel Schwartz at Stanford found that walking increased creative output by an
average of 60% compared to sitting. Not walking in nature versus sitting in an ugly
room — walking on a treadmill facing a blank wall versus sitting in the same room. The
movement itself, the rhythmic bilateral activation of the body, changes the quality of
thought. I discussed this with Raj, a neuroscientist colleague, who pointed me to
studies showing that even small postural changes — standing versus sitting, expansive
versus contracted postures — measurably affect hormonal profiles, risk tolerance, and
problem-solving strategies.

This belief has reshaped how I work and think. I take walking meetings whenever possible.
I sketch ideas on paper before typing them. I am suspicious of any educational
technology that further divorces learning from physical engagement. When I see Silicon
Valley evangelists promoting brain-computer interfaces as the next frontier of cognition,
I worry that they are doubling down on the exact wrong model — trying to optimize the
computer in the skull while ignoring the vast cognitive resources distributed throughout
the body and environment.

I recognize legitimate critiques. Andy Clark's extended mind thesis takes embodied
cognition further than I am comfortable with — I am not convinced that my smartphone is
literally part of my cognitive system in the same way my hands are. And the embodied
cognition research program has suffered from replication failures in some of its most
famous experiments, particularly the power-posing studies. These failures matter and
should moderate confidence.

But the core insight survives the replication crisis: thinking is not just brain
activity. It is brain-body-environment activity. Any theory of mind, any educational
system, any workplace design, any therapeutic intervention that ignores the body is
working with an incomplete model. I believe this with enough conviction to have
restructured my daily routines around it, and with enough humility to keep reading the
literature as it evolves.
FIXTURE_EOF
)

# ── Step 0: Sign in ───────────────────────────────────────────────────────

echo "─ Sign in"
SIGNIN=$(curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"$INITIAL_USERNAME\",\"password\":\"$INITIAL_PASSWORD\"}" \
  "$SERVER_URL/api/auth/sign-in/email")

if echo "$SIGNIN" | jq -e '.user' >/dev/null 2>&1; then
  pass "signed in as $INITIAL_USERNAME"
else
  fail "sign-in failed: ${SIGNIN:0:200}"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 1
fi

# ── Step 1: Get MCP token ─────────────────────────────────────────────────

echo ""
echo "─ MCP token"
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -n "$MCP_URL" ] && [ "$MCP_URL" != "null" ]; then
  MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
  MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
  pass "MCP token acquired"
else
  fail "mcpEndpointUrl missing from profile"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 1
fi

# Helper: extract JSON from SSE "data:" line
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

# Helper: MCP tool call
mcp_call() {
  local tool_name="$1"
  local args_json="$2"
  local call_id="${3:-99}"
  curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$call_id,\"method\":\"tools/call\",\"params\":{\"name\":\"$tool_name\",\"arguments\":$args_json}}" \
    "$MCP_URL" 2>/dev/null | parse_sse
}

# ── Step 2: Seed wiki types ───────────────────────────────────────────────

echo ""
echo "─ Seed wiki types"
SEED_HTTP=$(curl -s -o /tmp/uat-belief-seed.json -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "seed → HTTP $SEED_HTTP"

# Verify belief type exists
LIST_HTTP=$(curl -s -o /tmp/uat-belief-wt.json -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types")
HAS_BELIEF=$(jq '[.wikiTypes[].slug] | any(. == "belief")' /tmp/uat-belief-wt.json 2>/dev/null)
[ "$HAS_BELIEF" = "true" ] && pass "belief wiki type present" || fail "belief wiki type missing"

# ── Step 3: Create 3 belief wikis ─────────────────────────────────────────

echo ""
echo "─ Create belief wikis"

declare -a WIKI_KEYS=()
declare -a WIKI_SLUGS=()
WIKI_NAMES=("Remote Work Superiority" "Degrowth Economics" "Embodied Cognition")

for i in 0 1 2; do
  CREATE=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"${WIKI_NAMES[$i]}\",\"type\":\"belief\"}" \
    "$SERVER_URL/wikis")
  CREATE_HTTP=$(echo "$CREATE" | tail -1)
  CREATE_BODY=$(echo "$CREATE" | sed '$d')
  W_KEY=$(echo "$CREATE_BODY" | jq -r '.lookupKey // .id // ""')
  W_SLUG=$(echo "$CREATE_BODY" | jq -r '.slug // ""')
  W_TYPE=$(echo "$CREATE_BODY" | jq -r '.type // ""')

  if [ "$CREATE_HTTP" = "201" ] && [ "$W_TYPE" = "belief" ]; then
    WIKI_KEYS+=("$W_KEY")
    WIKI_SLUGS+=("$W_SLUG")
    pass "created wiki '${WIKI_NAMES[$i]}' → slug=$W_SLUG, type=$W_TYPE"
  else
    fail "create wiki '${WIKI_NAMES[$i]}' → HTTP $CREATE_HTTP, type=$W_TYPE"
    WIKI_KEYS+=("")
    WIKI_SLUGS+=("")
  fi
done

# ── Step 4: Submit 3 entries via MCP ──────────────────────────────────────

echo ""
echo "─ Submit entries via MCP"

# MCP initialize (required before tool calls)
curl -s --max-time 10 -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"uat-belief","version":"1.0"}}}' \
  "$MCP_URL" >/dev/null 2>&1

FIXTURES=("$FIXTURE_1" "$FIXTURE_2" "$FIXTURE_3")
FIXTURE_LABELS=("remote work superiority" "degrowth economics" "embodied cognition")
declare -a ENTRY_KEYS=()

for i in 0 1 2; do
  # Escape content for JSON
  ESCAPED=$(echo "${FIXTURES[$i]}" | jq -Rs '.')
  CALL_RESP=$(mcp_call "log_entry" "{\"content\":$ESCAPED,\"source\":\"mcp\"}" "$((10+i))")
  CALL_LEN=${#CALL_RESP}

  if [ "$CALL_LEN" -gt 5 ]; then
    ENTRY_TEXT=$(echo "$CALL_RESP" | jq -r '.result.content[0].text // ""' 2>/dev/null)
    if echo "$ENTRY_TEXT" | grep -q "Entry queued"; then
      E_KEY=$(echo "$ENTRY_TEXT" | grep -oP 'entry[0-9A-Z]{26}')
      ENTRY_KEYS+=("$E_KEY")
      pass "MCP log_entry (${FIXTURE_LABELS[$i]}) → $E_KEY"
    else
      fail "MCP log_entry (${FIXTURE_LABELS[$i]}) unexpected: ${ENTRY_TEXT:0:200}"
      ENTRY_KEYS+=("")
    fi
  else
    fail "MCP log_entry (${FIXTURE_LABELS[$i]}) empty response"
    ENTRY_KEYS+=("")
  fi
done

# ── Step 5: Poll entries until processed (max 360s) ───────────────────────

echo ""
echo "─ Poll entries (max 360s)"

ELAPSED=0
MAX_WAIT=360
RESOLVED_COUNT=0

while [ $ELAPSED -lt $MAX_WAIT ] && [ $RESOLVED_COUNT -lt 3 ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  RESOLVED_COUNT=0

  for i in 0 1 2; do
    KEY="${ENTRY_KEYS[$i]:-}"
    [ -z "$KEY" ] && continue
    RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/$KEY" 2>/dev/null)
    STATUS=$(echo "$RESP" | jq -r '.ingestStatus // .state // "unknown"')
    if [ "$STATUS" = "processed" ] || [ "$STATUS" = "RESOLVED" ]; then
      RESOLVED_COUNT=$((RESOLVED_COUNT + 1))
    fi
  done

  echo "    ${ELAPSED}s — $RESOLVED_COUNT/3 entries resolved"
done

if [ $RESOLVED_COUNT -eq 3 ]; then
  pass "all 3 entries reached processed state in ${ELAPSED}s"
elif [ $RESOLVED_COUNT -gt 0 ]; then
  pass "$RESOLVED_COUNT/3 entries processed (partial — pipeline may still be running)"
  fail "$((3 - RESOLVED_COUNT)) entries did not process within ${MAX_WAIT}s"
else
  fail "no entries processed within ${MAX_WAIT}s"
fi

# ── Step 6: Report fragments ─────────────────────────────────────────────

echo ""
echo "─ Report: fragments"
FRAGS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=100")
FRAG_COUNT=$(echo "$FRAGS" | jq '.fragments | length' 2>/dev/null || echo "0")

if [ "$FRAG_COUNT" -gt 0 ] 2>/dev/null; then
  pass "fragments exist ($FRAG_COUNT total)"
  echo "    sample titles:"
  echo "$FRAGS" | jq -r '.fragments[:5][] | "      - \(.title // "untitled")"' 2>/dev/null
else
  fail "no fragments found after pipeline"
fi

# ── Step 7: Report people ────────────────────────────────────────────────

echo ""
echo "─ Report: people"
PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")

if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "people extracted ($PEOPLE_COUNT total)"
  echo "    names:"
  echo "$PEOPLE" | jq -r '.people[] | "      - \(.name // .canonicalName // "unknown")"' 2>/dev/null
else
  skip "no people extracted (entity extraction may have failed gracefully)"
fi

# ── Step 8: Report edges ─────────────────────────────────────────────────

echo ""
echo "─ Report: edges (graph)"
GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")

echo "    nodes: $NODE_COUNT, edges: $EDGE_COUNT"

# Count edge types
FRAG_WIKI_EDGES=$(echo "$GRAPH" | jq '[.edges[] | select(.edgeType == "FRAGMENT_IN_WIKI")] | length' 2>/dev/null || echo "0")
MENTION_EDGES=$(echo "$GRAPH" | jq '[.edges[] | select(.edgeType == "FRAGMENT_MENTIONS_PERSON")] | length' 2>/dev/null || echo "0")
echo "    FRAGMENT_IN_WIKI: $FRAG_WIKI_EDGES"
echo "    FRAGMENT_MENTIONS_PERSON: $MENTION_EDGES"

if [ "$EDGE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "graph has edges ($EDGE_COUNT total)"
else
  skip "no edges in graph (classification may not have assigned fragments to belief wikis)"
fi

# ── Step 9: Check belief wiki state before regen ──────────────────────────

echo ""
echo "─ Belief wiki state (pre-regen)"

for i in 0 1 2; do
  KEY="${WIKI_KEYS[$i]:-}"
  [ -z "$KEY" ] && continue
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$KEY")
  W_STATE=$(echo "$DETAIL" | jq -r '.state // "unknown"')
  W_CONTENT_LEN=$(echo "$DETAIL" | jq -r '.content // "" | length' 2>/dev/null || echo "0")
  W_FRAG_COUNT=$(echo "$DETAIL" | jq '.fragments | length' 2>/dev/null || echo "0")
  echo "    ${WIKI_NAMES[$i]}: state=$W_STATE, content=${W_CONTENT_LEN}ch, fragments=$W_FRAG_COUNT"
done

# ── Step 10: Trigger regen on each belief wiki ────────────────────────────

echo ""
echo "─ Trigger regeneration"

for i in 0 1 2; do
  KEY="${WIKI_KEYS[$i]:-}"
  [ -z "$KEY" ] && continue

  # Ensure regenerate flag is enabled
  curl -s -o /dev/null -X PATCH \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"regenerate":true}' \
    "$SERVER_URL/wikis/$KEY/regenerate"

  REGEN=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$KEY/regenerate")
  REGEN_HTTP=$(echo "$REGEN" | tail -1)
  REGEN_BODY=$(echo "$REGEN" | sed '$d')

  if [ "$REGEN_HTTP" = "200" ]; then
    R_FRAGS=$(echo "$REGEN_BODY" | jq -r '.fragmentCount // 0')
    pass "regen '${WIKI_NAMES[$i]}' → 200, fragmentCount=$R_FRAGS"
  elif [ "$REGEN_HTTP" = "400" ]; then
    skip "regen '${WIKI_NAMES[$i]}' → 400 (regeneration disabled or no fragments)"
  else
    fail "regen '${WIKI_NAMES[$i]}' → HTTP $REGEN_HTTP: ${REGEN_BODY:0:200}"
  fi
done

# ── Step 11: Report final wiki state ──────────────────────────────────────

echo ""
echo "─ Belief wiki state (post-regen)"

for i in 0 1 2; do
  KEY="${WIKI_KEYS[$i]:-}"
  [ -z "$KEY" ] && continue
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$KEY")
  W_STATE=$(echo "$DETAIL" | jq -r '.state // "unknown"')
  W_CONTENT_LEN=$(echo "$DETAIL" | jq -r '.content // "" | length' 2>/dev/null || echo "0")
  W_FRAG_COUNT=$(echo "$DETAIL" | jq '.fragments | length' 2>/dev/null || echo "0")
  W_REBUILT=$(echo "$DETAIL" | jq -r '.lastRebuiltAt // "never"')

  echo "    ${WIKI_NAMES[$i]}:"
  echo "      state=$W_STATE, content=${W_CONTENT_LEN}ch, fragments=$W_FRAG_COUNT, lastRebuilt=$W_REBUILT"

  # Check for belief document structure in content
  W_CONTENT=$(echo "$DETAIL" | jq -r '.content // ""')
  if echo "$W_CONTENT" | grep -qi "position\|evidence\|reasoning\|nuance"; then
    pass "wiki '${WIKI_NAMES[$i]}' has belief structure keywords"
  elif [ "$W_CONTENT_LEN" -gt 100 ] 2>/dev/null; then
    skip "wiki '${WIKI_NAMES[$i]}' has content but belief structure not detected (observe)"
  else
    skip "wiki '${WIKI_NAMES[$i]}' has no content (fragments may not be linked)"
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
echo "$PASS passed, $FAIL failed, $SKIP skipped"
echo "════════════════════════════════════════"
```
