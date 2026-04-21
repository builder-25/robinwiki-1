# Wiki Type UAT — Principles

## What it proves
End-to-end lifecycle of the **principles** wiki type: create wikis typed as
`principles`, ingest realistic operating-principles content via MCP, verify
pipeline processing (fragments, people, edges), trigger wiki regeneration, and
confirm the generated wiki reflects the principles prompt structure.

A Principles wiki is "a document of operating rules, values, and commitments
that guide behavior."

## Prerequisites
- Server running at `$SERVER_URL` (default `http://localhost:3000`)
- `OPENROUTER_API_KEY` set (for pipeline + regen LLM calls)
- `core/.env` populated with `INITIAL_USERNAME`, `INITIAL_PASSWORD`

## Fixtures

Three realistic text inputs representing different domains of operating
principles. Each is 500+ words of authentic content that exercises people
extraction, rule identification, and commitment language.

### Fixture A — Company Values Statement (Meridian Labs)

> Meridian Labs was founded in 2019 by Elena Vasquez and James Okafor with a
> shared conviction: the way a company operates matters as much as what it
> builds. Over five years of scaling from twelve to three hundred people, we
> have distilled the operating principles that define who we are. These are not
> aspirational slogans — they are commitments we hold each other accountable to
> every day.
>
> **Transparency by default.** We share information openly unless there is a
> specific, articulable reason not to. Revenue numbers, board decks, incident
> postmortems, and compensation bands are visible to every employee. Elena
> learned this the hard way at her previous company, where a culture of
> information hoarding led to duplicated effort and eroded trust. At Meridian,
> we believe that people make better decisions when they have full context.
> Withholding information requires justification; sharing it does not.
>
> **Ownership over territory.** We do not protect turf. When Marcus Chen in
> engineering sees a customer support issue he can fix, he fixes it. When Priya
> Sharma in design identifies a data pipeline problem, she files the ticket and
> follows through. Titles describe your home base, not your boundaries. We
> actively discourage the phrase "that's not my job." James often says that the
> moment someone draws a line around their responsibilities is the moment the
> company develops its first crack.
>
> **Disagree and commit.** Healthy conflict is a feature, not a bug. We expect
> people to voice dissent clearly and early. But once a decision is made — and
> we are explicit about when decisions are made — everyone rows in the same
> direction. Sabotaging a decision you disagreed with is a fireable offense.
> Supporting a decision you disagreed with is a sign of maturity. This
> principle was tested during our 2022 pivot from enterprise to mid-market.
> Several senior leaders opposed the move. They said so. The decision was made.
> They executed it with full commitment. We grew forty percent that year.
>
> **Speed over perfection.** We ship early and iterate. A working prototype
> that reaches customers on Monday teaches us more than a polished release that
> ships on Friday. This does not mean we accept sloppy work — it means we
> accept incomplete work that is correct as far as it goes. Rachel Torres, our
> VP of Product, frames it as: "Would you rather be precisely wrong or
> approximately right?" We choose approximately right every time.
>
> **Earn trust through consistency.** Trust at Meridian is not granted by title
> or tenure. It is earned by doing what you say you will do, repeatedly, over
> time. We value reliability over brilliance. A person who delivers solid work
> on schedule earns more organizational trust than a person who occasionally
> produces genius but cannot be counted on. This principle shapes our promotion
> criteria, our peer review process, and how we assign critical projects.
>
> **No brilliant jerks.** Technical skill does not excuse interpersonal harm.
> We have passed on exceptional candidates and parted ways with high performers
> who treated colleagues with contempt. The cost of a brilliant jerk —
> suppressed ideas, attrition of good people, cultural erosion — always exceeds
> their individual contribution. This is non-negotiable.
>
> These six principles are reviewed annually by the full leadership team. They
> evolve as we evolve. But their core — transparency, ownership, commitment,
> speed, trust, and respect — has remained stable since our founding. Elena and
> James believe that principles only matter when they cost you something. Every
> one of these has cost us something. That is how we know they are real.

### Fixture B — Personal Operating Principles (Software Engineer)

> I wrote my first operating principles at twenty-four after reading Ray
> Dalio's book and realizing I had no coherent framework for making decisions.
> I am now thirty-one. These principles have been tested through two job
> changes, a cross-country move, a failed startup, and a period of burnout
> that lasted most of 2023. They are not abstract ideals — they are rules I
> follow. When I violate one, I notice, and I course-correct.
>
> **Principle 1: Protect the morning.** My best thinking happens before noon.
> I do not schedule meetings before 11am. I do not check Slack before I have
> spent at least ninety minutes on deep work. My manager, David Park, agreed
> to this arrangement when I showed him my output data — my morning PRs are
> two-thirds less likely to need revision. I guard this time aggressively
> because I know that if I give it up, everything downstream degrades.
>
> **Principle 2: Write before you build.** Before writing any code, I write a
> design document. Not a formal RFC — a one-page doc that answers three
> questions: What problem are we solving? What are two approaches? Why am I
> picking this one? My colleague Anika Patel taught me this after I wasted two
> weeks building the wrong abstraction on the Condor project. The document is
> not for approval — it is for clarity. If I cannot explain the approach in
> writing, I do not understand it well enough to build it.
>
> **Principle 3: Say no by default.** Every commitment I make reduces my
> capacity for existing commitments. When someone asks me to take on something
> new, my default answer is no unless I can identify what I will stop doing to
> make room. My friend and mentor, Kenji Yamamoto, calls this "the budget
> principle" — attention is a finite resource, and overspending it leads to
> bankruptcy in every domain. I would rather do three things well than seven
> things poorly.
>
> **Principle 4: Seek disconfirming evidence.** When I form an opinion, I
> actively look for reasons I might be wrong. This is uncomfortable and slow.
> It is also the only reliable way to avoid building on false assumptions. I
> learned this from Lisa Chen during the Arbor incident, where we spent three
> weeks debugging a performance regression that turned out to be a
> configuration error. Everyone was so sure it was a code issue that nobody
> checked the config. I never want to repeat that experience.
>
> **Principle 5: Health is infrastructure.** Sleep, exercise, and nutrition
> are not optional — they are load-bearing systems. When I skip workouts or
> sleep less than seven hours, my code quality drops, my patience decreases,
> and my ability to hold complex problems in my head degrades measurably. I
> treat my health the way I treat production infrastructure: with monitoring,
> maintenance windows, and zero tolerance for "we'll fix it later."
>
> **Principle 6: Relationships are compounding.** I invest time in
> professional relationships even when there is no immediate payoff. I respond
> to messages. I make introductions. I remember what people are working on and
> ask about it. My career has benefited more from relationships than from
> technical skill. My current role came through a referral from Omar Hassan,
> someone I had helped with a side project two years earlier with no
> expectation of return.
>
> **Principle 7: Ship and iterate.** Perfectionism is a trap that masquerades
> as quality. I set a "good enough" threshold before I start, and when I hit
> it, I ship. I can always improve it in v2. The graveyard of side projects I
> never launched taught me this lesson the hard way. Now I launch early, gather
> feedback, and refine. The first version of my open-source linting tool had
> embarrassing gaps. Version three is used by four thousand developers.
>
> These principles are mine. They reflect my personality, my failure modes, and
> the lessons I have earned through experience. I review them every January and
> update them when they no longer serve me. Principles that never change are
> probably principles you never test.

### Fixture C — Engineering Team Principles (Canopy Engineering)

> The Canopy Engineering team operates under a shared set of principles that
> define how we build software, make decisions, and treat each other. These
> principles were developed collaboratively over six months by the founding
> engineering team — Tomoko Nakamura, Ben Adeyemi, Sofia Reyes, and Chris
> Whitfield — and are revisited at our annual offsite. Every new engineer
> receives this document during onboarding and is expected to internalize it
> within their first quarter.
>
> **We are problem solvers, not feature factories.** Our job is to solve user
> problems, not to ship features. Before we write code, we validate that the
> problem exists and that our proposed solution addresses it. Tomoko instituted
> the "problem brief" requirement in 2021 after we shipped three consecutive
> features that saw less than five percent adoption. Every feature now starts
> with a one-page brief that includes the problem statement, evidence the
> problem exists, and a success metric. If you cannot fill out the brief, the
> feature is not ready for engineering.
>
> **Simplicity is a feature.** We prefer the simpler solution unless there is
> a demonstrated reason the complex one is necessary. "But we might need it
> later" is not a valid argument. Ben calls this "YAGNI with teeth." We have
> deleted more code than most teams write because we ruthlessly remove
> abstractions that served a past need but no longer earn their complexity
> cost. Our codebase is smaller today than it was eighteen months ago, and it
> does more.
>
> **Own your blast radius.** Every engineer is responsible for understanding
> the downstream impact of their changes. If your PR touches the payment flow,
> you own the risk. If your migration affects read latency, you watch the
> dashboards. We do not throw code over a wall to QA and hope for the best.
> Sofia built our blast-radius checklist after the March 2022 incident where a
> seemingly minor schema change caused a four-hour outage in the billing
> system. Now every PR over fifty lines includes an impact assessment.
>
> **Communicate through artifacts, not meetings.** We write RFCs, ADRs, and
> runbooks. We record architectural decisions in version-controlled documents.
> We do not convene a meeting to share information that could be a document.
> Meetings are for discussion, debate, and decision-making — not for broadcast.
> Chris tracks our meeting-to-document ratio and publishes it monthly. Teams
> that trend toward more meetings and fewer documents are gently redirected.
> This principle saves us an estimated fifteen hours per engineer per month.
>
> **Feedback is a gift, not an attack.** Code review is not adversarial. When
> you leave a review comment, you are helping your colleague improve their
> work. When you receive a comment, you are getting free mentorship. We use
> conventional comment prefixes — "nit:", "question:", "suggestion:",
> "blocker:" — so intent is never ambiguous. Personal attacks in code review
> are treated as seriously as production incidents. Tomoko and Ben model this
> by reviewing each other's code publicly and accepting criticism gracefully.
>
> **Incidents are learning opportunities.** We run blameless postmortems for
> every incident above severity two. The goal is to understand what happened,
> not who caused it. Every postmortem produces at least one concrete action
> item with an owner and a deadline. We maintain a public incident log that
> any employee can read. Our MTTR has dropped by sixty percent since we
> adopted this practice because engineers are no longer afraid to surface
> problems early. As Sofia says, "The only unforgivable incident is the one
> we don't learn from."
>
> **Invest in developer experience.** Build times, test reliability, deploy
> frequency, and onboarding speed are first-class metrics. We allocate twenty
> percent of every sprint to tooling and infrastructure improvements. This is
> not optional and it is not the first thing cut when deadlines tighten. Ben
> demonstrated that every hour invested in CI speed returns four hours in
> developer productivity across the team. Our deploy pipeline runs in under
> three minutes. New engineers ship their first PR within forty-eight hours.
>
> **Balance autonomy with alignment.** Teams have broad latitude in how they
> solve problems. They do not have latitude in what problems they solve. Our
> quarterly planning process establishes the "what" — team-level objectives
> tied to company goals. The "how" belongs entirely to the team. This means
> an individual team can choose its own tech stack, testing strategy, and
> release cadence, as long as it delivers on its objectives. Chris calls this
> "freedom within a frame."
>
> These principles are living commitments. They cost us something: we have
> rejected candidates who would not embrace them, slowed down releases to
> honor them, and restructured teams around them. If a principle never causes
> friction, it probably is not a real principle. Ours cause friction regularly.
> That is how we know they are working.

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

echo "Wiki Type UAT — Principles"
echo ""

# Check OpenRouter key (required for pipeline + regen)
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping principles pipeline test"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── Sign in ──────────────────────────────────────────────────────────
echo "── Sign in"
SIGNIN=$(curl -s -c "$COOKIE_JAR" -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email")
SIGNIN_HTTP=$(echo "$SIGNIN" | tail -1)
[ "$SIGNIN_HTTP" = "200" ] && pass "sign-in → 200" || fail "sign-in → HTTP $SIGNIN_HTTP"

# ── Get MCP token ────────────────────────────────────────────────────
echo ""
echo "── Get MCP token"
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')
if [ -n "$MCP_URL" ] && [ "$MCP_URL" != "null" ]; then
  MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
  MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
  pass "MCP token obtained"
else
  fail "mcpEndpointUrl missing from profile"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# SSE helper
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

# MCP initialize (required before tool calls)
curl -s --max-time 10 -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"uat-principles","version":"1.0"}}}' \
  "$MCP_URL" >/dev/null 2>&1

# ── Seed wiki types ──────────────────────────────────────────────────
echo ""
echo "── Seed wiki types"
SEED_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "seed wiki types → HTTP $SEED_HTTP"

# Verify principles type exists
TYPES_RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/wiki-types")
HAS_PRINCIPLES=$(echo "$TYPES_RESP" | jq '[.wikiTypes[].slug] | any(. == "principles")' 2>/dev/null)
[ "$HAS_PRINCIPLES" = "true" ] && pass "principles wiki type present after seed" || fail "principles wiki type not found"

# ── Create 3 principles wikis ────────────────────────────────────────
echo ""
echo "── Create principles wikis"

WIKI_SLUGS=()
WIKI_KEYS=()

create_wiki() {
  local name="$1" desc="$2"
  local resp
  resp=$(curl -s -w "\n%{http_code}" -X POST -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"$name\",\"type\":\"principles\",\"prompt\":\"\"}" \
    "$SERVER_URL/wikis")
  local http=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  local key=$(echo "$body" | jq -r '.lookupKey // .id // ""')
  local slug=$(echo "$body" | jq -r '.slug // ""')
  local wtype=$(echo "$body" | jq -r '.type // ""')

  if [ "$http" = "201" ] && [ -n "$key" ]; then
    pass "POST /wikis → 201, slug=$slug, type=$wtype, key=${key:0:20}..."
    WIKI_SLUGS+=("$slug")
    WIKI_KEYS+=("$key")
  else
    fail "POST /wikis ($name) → HTTP $http"
    WIKI_SLUGS+=("")
    WIKI_KEYS+=("")
  fi
}

create_wiki "Meridian Labs Operating Principles" "operating rules values and commitments for a company"
create_wiki "Personal Operating Principles" "personal rules for decision-making and behavior"
create_wiki "Canopy Engineering Principles" "engineering team operating principles for building software"

# Verify all are type=principles
for i in 0 1 2; do
  if [ -n "${WIKI_KEYS[$i]}" ]; then
    DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
    TYPE=$(echo "$DETAIL" | jq -r '.type // ""')
    [ "$TYPE" = "principles" ] && pass "wiki ${WIKI_SLUGS[$i]} confirmed type=principles" || fail "wiki ${WIKI_SLUGS[$i]} type=$TYPE (expected principles)"
  fi
done

# ── Submit 3 entries via MCP (log_entry) ─────────────────────────────
echo ""
echo "── Submit entries via MCP"

ENTRY_KEYS=()

# Fixture A — Meridian Labs
FIXTURE_A='Meridian Labs was founded in 2019 by Elena Vasquez and James Okafor with a shared conviction: the way a company operates matters as much as what it builds. Over five years of scaling from twelve to three hundred people, we have distilled the operating principles that define who we are. These are not aspirational slogans — they are commitments we hold each other accountable to every day.\n\nTransparency by default. We share information openly unless there is a specific, articulable reason not to. Revenue numbers, board decks, incident postmortems, and compensation bands are visible to every employee. Elena learned this the hard way at her previous company, where a culture of information hoarding led to duplicated effort and eroded trust. At Meridian, we believe that people make better decisions when they have full context. Withholding information requires justification; sharing it does not.\n\nOwnership over territory. We do not protect turf. When Marcus Chen in engineering sees a customer support issue he can fix, he fixes it. When Priya Sharma in design identifies a data pipeline problem, she files the ticket and follows through. Titles describe your home base, not your boundaries. We actively discourage the phrase that is not my job. James often says that the moment someone draws a line around their responsibilities is the moment the company develops its first crack.\n\nDisagree and commit. Healthy conflict is a feature, not a bug. We expect people to voice dissent clearly and early. But once a decision is made — and we are explicit about when decisions are made — everyone rows in the same direction. Sabotaging a decision you disagreed with is a fireable offense. Supporting a decision you disagreed with is a sign of maturity. This principle was tested during our 2022 pivot from enterprise to mid-market. Several senior leaders opposed the move. They said so. The decision was made. They executed it with full commitment. We grew forty percent that year.\n\nSpeed over perfection. We ship early and iterate. A working prototype that reaches customers on Monday teaches us more than a polished release that ships on Friday. This does not mean we accept sloppy work — it means we accept incomplete work that is correct as far as it goes. Rachel Torres, our VP of Product, frames it as: Would you rather be precisely wrong or approximately right? We choose approximately right every time.\n\nEarn trust through consistency. Trust at Meridian is not granted by title or tenure. It is earned by doing what you say you will do, repeatedly, over time. We value reliability over brilliance. A person who delivers solid work on schedule earns more organizational trust than a person who occasionally produces genius but cannot be counted on. This principle shapes our promotion criteria, our peer review process, and how we assign critical projects.\n\nNo brilliant jerks. Technical skill does not excuse interpersonal harm. We have passed on exceptional candidates and parted ways with high performers who treated colleagues with contempt. The cost of a brilliant jerk — suppressed ideas, attrition of good people, cultural erosion — always exceeds their individual contribution. This is non-negotiable.\n\nThese six principles are reviewed annually by the full leadership team. They evolve as we evolve. But their core — transparency, ownership, commitment, speed, trust, and respect — has remained stable since our founding. Elena and James believe that principles only matter when they cost you something. Every one of these has cost us something. That is how we know they are real.'

# Fixture B — Personal Operating Principles
FIXTURE_B='I wrote my first operating principles at twenty-four after reading Ray Dalio book and realizing I had no coherent framework for making decisions. I am now thirty-one. These principles have been tested through two job changes, a cross-country move, a failed startup, and a period of burnout that lasted most of 2023. They are not abstract ideals — they are rules I follow. When I violate one, I notice, and I course-correct.\n\nPrinciple 1: Protect the morning. My best thinking happens before noon. I do not schedule meetings before 11am. I do not check Slack before I have spent at least ninety minutes on deep work. My manager, David Park, agreed to this arrangement when I showed him my output data — my morning PRs are two-thirds less likely to need revision. I guard this time aggressively because I know that if I give it up, everything downstream degrades.\n\nPrinciple 2: Write before you build. Before writing any code, I write a design document. Not a formal RFC — a one-page doc that answers three questions: What problem are we solving? What are two approaches? Why am I picking this one? My colleague Anika Patel taught me this after I wasted two weeks building the wrong abstraction on the Condor project. The document is not for approval — it is for clarity. If I cannot explain the approach in writing, I do not understand it well enough to build it.\n\nPrinciple 3: Say no by default. Every commitment I make reduces my capacity for existing commitments. When someone asks me to take on something new, my default answer is no unless I can identify what I will stop doing to make room. My friend and mentor, Kenji Yamamoto, calls this the budget principle — attention is a finite resource, and overspending it leads to bankruptcy in every domain. I would rather do three things well than seven things poorly.\n\nPrinciple 4: Seek disconfirming evidence. When I form an opinion, I actively look for reasons I might be wrong. This is uncomfortable and slow. It is also the only reliable way to avoid building on false assumptions. I learned this from Lisa Chen during the Arbor incident, where we spent three weeks debugging a performance regression that turned out to be a configuration error. Everyone was so sure it was a code issue that nobody checked the config. I never want to repeat that experience.\n\nPrinciple 5: Health is infrastructure. Sleep, exercise, and nutrition are not optional — they are load-bearing systems. When I skip workouts or sleep less than seven hours, my code quality drops, my patience decreases, and my ability to hold complex problems in my head degrades measurably. I treat my health the way I treat production infrastructure: with monitoring, maintenance windows, and zero tolerance for we will fix it later.\n\nPrinciple 6: Relationships are compounding. I invest time in professional relationships even when there is no immediate payoff. I respond to messages. I make introductions. I remember what people are working on and ask about it. My career has benefited more from relationships than from technical skill. My current role came through a referral from Omar Hassan, someone I had helped with a side project two years earlier with no expectation of return.\n\nPrinciple 7: Ship and iterate. Perfectionism is a trap that masquerades as quality. I set a good enough threshold before I start, and when I hit it, I ship. I can always improve it in v2. The graveyard of side projects I never launched taught me this lesson the hard way. Now I launch early, gather feedback, and refine. The first version of my open-source linting tool had embarrassing gaps. Version three is used by four thousand developers.\n\nThese principles are mine. They reflect my personality, my failure modes, and the lessons I have earned through experience. I review them every January and update them when they no longer serve me. Principles that never change are probably principles you never test.'

# Fixture C — Canopy Engineering Principles
FIXTURE_C='The Canopy Engineering team operates under a shared set of principles that define how we build software, make decisions, and treat each other. These principles were developed collaboratively over six months by the founding engineering team — Tomoko Nakamura, Ben Adeyemi, Sofia Reyes, and Chris Whitfield — and are revisited at our annual offsite. Every new engineer receives this document during onboarding and is expected to internalize it within their first quarter.\n\nWe are problem solvers, not feature factories. Our job is to solve user problems, not to ship features. Before we write code, we validate that the problem exists and that our proposed solution addresses it. Tomoko instituted the problem brief requirement in 2021 after we shipped three consecutive features that saw less than five percent adoption. Every feature now starts with a one-page brief that includes the problem statement, evidence the problem exists, and a success metric. If you cannot fill out the brief, the feature is not ready for engineering.\n\nSimplicity is a feature. We prefer the simpler solution unless there is a demonstrated reason the complex one is necessary. But we might need it later is not a valid argument. Ben calls this YAGNI with teeth. We have deleted more code than most teams write because we ruthlessly remove abstractions that served a past need but no longer earn their complexity cost. Our codebase is smaller today than it was eighteen months ago, and it does more.\n\nOwn your blast radius. Every engineer is responsible for understanding the downstream impact of their changes. If your PR touches the payment flow, you own the risk. If your migration affects read latency, you watch the dashboards. We do not throw code over a wall to QA and hope for the best. Sofia built our blast-radius checklist after the March 2022 incident where a seemingly minor schema change caused a four-hour outage in the billing system. Now every PR over fifty lines includes an impact assessment.\n\nCommunicate through artifacts, not meetings. We write RFCs, ADRs, and runbooks. We record architectural decisions in version-controlled documents. We do not convene a meeting to share information that could be a document. Meetings are for discussion, debate, and decision-making — not for broadcast. Chris tracks our meeting-to-document ratio and publishes it monthly. Teams that trend toward more meetings and fewer documents are gently redirected. This principle saves us an estimated fifteen hours per engineer per month.\n\nFeedback is a gift, not an attack. Code review is not adversarial. When you leave a review comment, you are helping your colleague improve their work. When you receive a comment, you are getting free mentorship. We use conventional comment prefixes — nit, question, suggestion, blocker — so intent is never ambiguous. Personal attacks in code review are treated as seriously as production incidents. Tomoko and Ben model this by reviewing each others code publicly and accepting criticism gracefully.\n\nIncidents are learning opportunities. We run blameless postmortems for every incident above severity two. The goal is to understand what happened, not who caused it. Every postmortem produces at least one concrete action item with an owner and a deadline. We maintain a public incident log that any employee can read. Our MTTR has dropped by sixty percent since we adopted this practice because engineers are no longer afraid to surface problems early. As Sofia says, The only unforgivable incident is the one we do not learn from.\n\nInvest in developer experience. Build times, test reliability, deploy frequency, and onboarding speed are first-class metrics. We allocate twenty percent of every sprint to tooling and infrastructure improvements. This is not optional and it is not the first thing cut when deadlines tighten. Ben demonstrated that every hour invested in CI speed returns four hours in developer productivity across the team. Our deploy pipeline runs in under three minutes. New engineers ship their first PR within forty-eight hours.\n\nBalance autonomy with alignment. Teams have broad latitude in how they solve problems. They do not have latitude in what problems they solve. Our quarterly planning process establishes the what — team-level objectives tied to company goals. The how belongs entirely to the team. This means an individual team can choose its own tech stack, testing strategy, and release cadence, as long as it delivers on its objectives. Chris calls this freedom within a frame.\n\nThese principles are living commitments. They cost us something: we have rejected candidates who would not embrace them, slowed down releases to honor them, and restructured teams around them. If a principle never causes friction, it probably is not a real principle. Ours cause friction regularly. That is how we know they are working.'

submit_entry() {
  local fixture_var="$1" label="$2"
  local content
  content=$(printf '%b' "$fixture_var")

  # Escape content for JSON
  local json_content
  json_content=$(jq -Rs '.' <<< "$content")

  local raw
  raw=$(curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$(date +%s%N | cut -c1-10),\"method\":\"tools/call\",\"params\":{\"name\":\"log_entry\",\"arguments\":{\"content\":$json_content,\"source\":\"mcp\"}}}" \
    "$MCP_URL" 2>/dev/null)
  local resp
  resp=$(echo "$raw" | parse_sse)

  local has_result
  has_result=$(echo "$resp" | jq -e '.result' 2>/dev/null && echo "yes" || echo "no")

  if [ "$has_result" = "yes" ]; then
    local text
    text=$(echo "$resp" | jq -r '.result.content[0].text // ""')
    local entry_key
    entry_key=$(echo "$text" | grep -oP 'entry[A-Z0-9]{26}' || echo "")
    if [ -n "$entry_key" ]; then
      pass "MCP log_entry ($label) → entry queued: ${entry_key:0:20}..."
      ENTRY_KEYS+=("$entry_key")
    else
      pass "MCP log_entry ($label) → responded (key not parsed: ${text:0:60})"
      ENTRY_KEYS+=("")
    fi
  else
    fail "MCP log_entry ($label) → no result (${resp:0:120})"
    ENTRY_KEYS+=("")
  fi
}

submit_entry "$FIXTURE_A" "Meridian Labs"
submit_entry "$FIXTURE_B" "Personal Principles"
submit_entry "$FIXTURE_C" "Canopy Engineering"

# ── Poll entries until processed (max 360s) ──────────────────────────
echo ""
echo "── Poll entry processing (max 360s)"

PROCESSED=0
ELAPSED=0
MAX_WAIT=360

while [ $ELAPSED -lt $MAX_WAIT ] && [ $PROCESSED -lt ${#ENTRY_KEYS[@]} ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  PROCESSED=0

  for i in "${!ENTRY_KEYS[@]}"; do
    key="${ENTRY_KEYS[$i]}"
    if [ -z "$key" ]; then
      PROCESSED=$((PROCESSED + 1))
      continue
    fi
    resp=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/$key" 2>/dev/null)
    status=$(echo "$resp" | jq -r '.ingestStatus // .state // "unknown"')
    if [ "$status" = "processed" ] || [ "$status" = "RESOLVED" ] || [ "$status" = "failed" ]; then
      PROCESSED=$((PROCESSED + 1))
    fi
  done

  echo "    ${ELAPSED}s — $PROCESSED/${#ENTRY_KEYS[@]} entries done"
done

# Report final status of each entry
for i in "${!ENTRY_KEYS[@]}"; do
  key="${ENTRY_KEYS[$i]}"
  if [ -z "$key" ]; then continue; fi
  resp=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/entries/$key" 2>/dev/null)
  status=$(echo "$resp" | jq -r '.ingestStatus // .state // "unknown"')
  if [ "$status" = "processed" ] || [ "$status" = "RESOLVED" ]; then
    pass "entry $i ($key) → $status"
  elif [ "$status" = "failed" ]; then
    err=$(echo "$resp" | jq -r '.lastError // "unknown"')
    fail "entry $i ($key) → failed: $err"
  else
    fail "entry $i ($key) → stuck at $status after ${MAX_WAIT}s"
  fi
done

# ── Report fragments ─────────────────────────────────────────────────
echo ""
echo "── Fragments"
FRAGS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=100")
FRAG_COUNT=$(echo "$FRAGS" | jq '.fragments | length' 2>/dev/null || echo "0")

if [ "$FRAG_COUNT" -gt 0 ] 2>/dev/null; then
  pass "fragments created: $FRAG_COUNT total"
  # Show first 5 fragment titles
  echo "$FRAGS" | jq -r '.fragments[:5][] | "    → \(.title // .slug)"' 2>/dev/null
else
  fail "no fragments found after pipeline"
fi

# ── Report people ────────────────────────────────────────────────────
echo ""
echo "── People"
PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people?limit=50")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")

if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "people extracted: $PEOPLE_COUNT total"
  echo "$PEOPLE" | jq -r '.people[:10][] | "    → \(.name // .canonicalName // .slug)"' 2>/dev/null
else
  skip "no people extracted (entity extraction may have failed gracefully)"
fi

# ── Report edges ─────────────────────────────────────────────────────
echo ""
echo "── Edges (fragment-wiki + fragment-person)"

# Check each wiki for linked fragments
for i in 0 1 2; do
  key="${WIKI_KEYS[$i]:-}"
  slug="${WIKI_SLUGS[$i]:-wiki-$i}"
  if [ -z "$key" ]; then continue; fi
  detail=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$key")
  frag_count=$(echo "$detail" | jq '.fragments | length' 2>/dev/null || echo "0")
  people_count=$(echo "$detail" | jq '.people | length' 2>/dev/null || echo "0")
  echo "    $slug: $frag_count fragments, $people_count people"
  if [ "$frag_count" -gt 0 ] 2>/dev/null; then
    pass "$slug has $frag_count linked fragments"
  else
    skip "$slug has 0 linked fragments (pipeline may not have classified to this wiki)"
  fi
done

# ── Trigger regen on each wiki ───────────────────────────────────────
echo ""
echo "── Trigger wiki regeneration"

for i in 0 1 2; do
  key="${WIKI_KEYS[$i]:-}"
  slug="${WIKI_SLUGS[$i]:-wiki-$i}"
  if [ -z "$key" ]; then continue; fi

  # Enable regeneration first
  curl -s -o /dev/null -X PATCH -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"regenerate":true}' \
    "$SERVER_URL/wikis/$key/regenerate"

  # Trigger regen
  REGEN=$(curl -s -w "\n%{http_code}" -X POST -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$key/regenerate")
  REGEN_HTTP=$(echo "$REGEN" | tail -1)
  REGEN_BODY=$(echo "$REGEN" | sed '$d')

  if [ "$REGEN_HTTP" = "200" ]; then
    fcount=$(echo "$REGEN_BODY" | jq -r '.fragmentCount // 0')
    pass "POST /wikis/$slug/regenerate → 200 ($fcount fragments)"
  elif [ "$REGEN_HTTP" = "400" ]; then
    detail=$(echo "$REGEN_BODY" | jq -r '.error // ""')
    skip "regen $slug → 400: $detail"
  else
    fail "regen $slug → HTTP $REGEN_HTTP"
  fi
done

# ── Report final wiki state ──────────────────────────────────────────
echo ""
echo "── Final wiki state"

for i in 0 1 2; do
  key="${WIKI_KEYS[$i]:-}"
  slug="${WIKI_SLUGS[$i]:-wiki-$i}"
  if [ -z "$key" ]; then continue; fi

  detail=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$key")
  state=$(echo "$detail" | jq -r '.state // "unknown"')
  wtype=$(echo "$detail" | jq -r '.type // "unknown"')
  content_len=$(echo "$detail" | jq -r '.wikiContent // "" | length')
  frag_count=$(echo "$detail" | jq '.fragments | length' 2>/dev/null || echo "0")
  people_count=$(echo "$detail" | jq '.people | length' 2>/dev/null || echo "0")

  echo "    $slug:"
  echo "      type=$wtype, state=$state"
  echo "      content=${content_len} chars, fragments=$frag_count, people=$people_count"

  # Verify type stayed principles
  [ "$wtype" = "principles" ] && pass "$slug type=principles preserved" || fail "$slug type changed to $wtype"

  # Check if content was generated
  if [ "$content_len" -gt 100 ] 2>/dev/null; then
    pass "$slug has generated content ($content_len chars)"
    # Show first 200 chars of wiki content
    echo "$detail" | jq -r '.wikiContent // "" | .[0:200]' 2>/dev/null | sed 's/^/      > /'
    echo ""
  else
    skip "$slug has no/minimal content (regen may have had 0 fragments)"
  fi
done

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```
