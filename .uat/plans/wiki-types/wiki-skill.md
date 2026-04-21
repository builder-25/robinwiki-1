# Wiki Type UAT — Skill

## What it proves
End-to-end lifecycle of the **skill** wiki type: create 3 skill wikis via API,
seed wiki types, submit 3 realistic entries via MCP `log_entry`, poll until
the pipeline processes them, report extracted fragments/people/edges, trigger
on-demand wiki regeneration, and report final wiki state.

A Skill wiki is "a knowledge base documenting a capability being developed or
maintained." The 3 fixtures below represent realistic learning journals: Rust
programming notes, sourdough baking technique, and fingerstyle guitar practice.

## Prerequisites
- Server running at `$SERVER_URL`
- `OPENROUTER_API_KEY` set (for LLM extraction + regen)
- `INITIAL_USERNAME` / `INITIAL_PASSWORD` env vars

## Fixtures

### Fixture 1 — Learning Rust: Ownership and Borrowing

> A programmer's study notes after their first month with Rust, covering
> ownership semantics, the borrow checker, and early patterns learned.

```
I have been working through the Rust Book for about four weeks now, and the ownership system is finally starting to click. The first two weeks were rough. I kept fighting the borrow checker like it was an adversary instead of understanding that it is a collaborator trying to prevent me from writing memory-unsafe code.

The core rule is deceptively simple: each value in Rust has exactly one owner, and when that owner goes out of scope, the value is dropped. But the implications cascade into every design decision. When I pass a String to a function, ownership moves unless I explicitly borrow with an ampersand reference. This tripped me up constantly in week one because in Python and JavaScript I never had to think about who "owns" data — everything is reference counted or garbage collected behind the scenes.

Borrowing comes in two flavors and the distinction matters. An immutable borrow (&T) lets you read data without taking ownership, and you can have as many of these as you want simultaneously. A mutable borrow (&mut T) gives you exclusive write access, but the compiler enforces that no other references — mutable or immutable — exist at the same time. My mentor Sarah explained it as the "readers-writer lock" pattern baked into the type system. Once I internalized that analogy, the compiler errors went from cryptic to obvious.

Lifetimes were the next hurdle. The compiler needs to know how long each reference is valid so it can guarantee no dangling pointers. Most of the time lifetime elision rules handle this automatically, but when you write functions that return references, you sometimes need explicit lifetime annotations like 'a. The syntax looks alien at first — fn longest<'a>(x: &'a str, y: &'a str) -> &'a str — but it is really just telling the compiler "the returned reference lives at least as long as both inputs."

Pattern matching with match and if let has become one of my favorite features. Combined with Rust's enum system (especially Option and Result), it eliminates entire categories of null pointer bugs. I refactored a small CLI tool I had written in Python, and the Rust version caught three edge cases at compile time that the Python version only caught via runtime exceptions in production. Dr. James Chen from our systems reading group pointed out that this is exactly why Mozilla invested in Rust for Firefox — the browser engine cannot afford null dereference crashes.

Practical patterns I have adopted so far: I clone liberally when prototyping (the Rust community calls this "clone-driven development") and then optimize ownership later once the logic is correct. I use .as_ref() and .as_deref() to convert between owned and borrowed types without unnecessary copying. I have started writing smaller functions that take references rather than owned values, which makes the borrow checker happier and keeps the call sites flexible.

The cargo ecosystem is remarkable. Coming from npm, the fact that cargo handles building, testing, dependency management, and documentation in one tool feels luxurious. I set up cargo-watch for hot reloading during development, and clippy catches style issues that would take a senior Rust developer to spot. My colleague Marcus Rivera recommended the rust-analyzer LSP integration for VS Code, and it has been transformative — inline type hints and real-time borrow checker feedback make the learning curve much gentler.

Next month I plan to tackle async Rust with tokio, which everyone warns is a significant step up in complexity. The Pin and Future traits apparently require a solid understanding of ownership to make sense, so I am glad I spent this month building that foundation.
```

### Fixture 2 — Sourdough Bread: Fermentation and Scoring Technique

> A home baker's accumulated knowledge on sourdough fermentation timing,
> dough shaping, and scoring patterns after six months of weekly bakes.

```
Six months of weekly sourdough bakes and I finally feel like I understand what the dough is telling me. The biggest lesson has nothing to do with recipes — it is about learning to read fermentation by touch and sight rather than by clock. Every kitchen is different. My apartment runs cool in winter (around 66 degrees Fahrenheit) and warm in summer (78 degrees), and that twenty-degree swing changes bulk fermentation time by three to four hours.

The starter is everything. I maintain a 100% hydration starter (equal parts flour and water by weight) that I feed every twelve hours when baking and once a week when dormant in the fridge. The critical indicator of readiness is the float test — a spoonful of starter dropped in water should float within four hours of feeding. My baker friend Tomoko Hayashi taught me that the smell matters too: ripe starter smells like overripe fruit with a slight vinegar tang. If it smells like nail polish remover (ethyl acetate), it has over-fermented and needs a couple of back-to-back feedings to recover.

Bulk fermentation is where most beginners go wrong, myself included. The dough needs to increase in volume by roughly 50 to 75 percent — not double, which is the old advice from commercial yeast recipes. I use a straight-sided clear container with a rubber band marking the starting level. Stretch-and-fold sets every thirty minutes for the first two hours build gluten structure without the heavy kneading that traditional bread requires. After the folds, I leave the dough alone and check it every hour. The signs of readiness: the dough is domed on top, jiggles when you shake the container, and you can see bubbles along the sides and bottom.

Cold retard in the refrigerator is the secret weapon. After shaping, I put the dough in a banneton lined with rice flour and refrigerate it for 12 to 18 hours. This slows fermentation dramatically while allowing enzymes to break down starches into sugars, which produces better flavor complexity and a darker, more caramelized crust. The cold also firms up the dough, making it much easier to score cleanly. Chef Antonio Rossi at the community baking workshop emphasized that professional bakeries retard overnight specifically for scoring control, not just scheduling convenience.

Shaping is a two-stage process. First comes the pre-shape: gently tip the dough onto an unfloured surface, use a bench scraper to fold it into a rough round, and let it rest for 20 to 30 minutes covered with a damp towel. The bench rest lets the gluten relax so the final shape does not fight back. For the final shape, I flour the top of the dough, flip it, and pull the edges toward the center like folding an envelope. Then I flip it seam-side down and use the bench scraper to drag it toward me on the unfloured surface, building surface tension. The dough should feel taut, like a filled water balloon. If it tears, the gluten was not developed enough during bulk.

Scoring is both functional and artistic. The functional purpose is to control where the bread expands during the initial oven spring — without a score, the loaf will burst unpredictably along its weakest seam. I use a double-edged razor blade (lame) held at roughly 45 degrees to the surface. A shallow angle creates the coveted "ear" — that crispy flap of crust that lifts during baking. A perpendicular cut gives a more open, rustic split. My go-to pattern is a single curved slash off-center, about a quarter inch deep. For decorative loaves I add wheat stalk designs using a fine-tipped blade, though these are purely cosmetic cuts (very shallow, about an eighth of an inch) that do not affect oven spring.

The bake itself follows a two-phase approach. Phase one: 20 minutes at 500 degrees Fahrenheit in a preheated Dutch oven with the lid on. The trapped steam keeps the crust pliable so the bread can expand fully. Phase two: remove the lid, drop to 450 degrees, and bake another 20 to 25 minutes until the crust is deeply caramelized — darker than you think is right. I learned from Lucia Fernandez, who runs a micro-bakery in our neighborhood, that the internal temperature should hit 208 to 210 degrees Fahrenheit. Below that and the crumb will be gummy. I let the loaf cool on a wire rack for at least two hours before cutting. The crumb is still setting during cooling and cutting too early compresses the structure.
```

### Fixture 3 — Fingerstyle Guitar: Practice Log and Technique Notes

> A guitarist's practice journal tracking their progression from basic
> fingerpicking patterns through Travis picking to arrangement work.

```
Three months into dedicated fingerstyle practice after playing with a pick for six years. The transition has been humbling but deeply rewarding. My right hand is essentially relearning how to interact with the strings, and the independence required between thumb and fingers is a completely different motor skill than flatpicking.

The foundation is the PIMA system: P (pulgar) for the thumb covering bass strings (E, A, D), I (indice) index finger on the G string, M (medio) middle finger on the B string, and A (anular) ring finger on the high E string. My teacher Robert Nakamura insists on strict assignment during the first month — no cheating by letting fingers drift to adjacent strings. The discipline pays off because once the default assignments are automatic, you can break the rules intentionally for musical effect rather than out of sloppiness.

The first exercise that really built my foundation was a simple arpeggiated pattern in 4/4 time: P-I-M-A-M-I repeated over basic open chords (C, Am, G, Em). I practiced this with a metronome at 60 BPM for two weeks before increasing to 72, then 80. The key insight from my practice: speed comes from relaxation, not effort. When I tense my right hand trying to go faster, the tone gets thin and scratchy. When I focus on a loose wrist and letting each finger fall naturally into the string with just enough force, the tone is warm and full, and paradoxically the tempo increases on its own.

Travis picking was the first major milestone. Named after Merle Travis, this pattern uses an alternating bass note on the thumb (typically root-fifth or root-octave) while the fingers pick a melody or fill pattern on the treble strings. The thumb becomes a metronome — steady alternating bass regardless of what the fingers are doing above. I spent three weeks just on the thumb pattern alone, walking bass lines over chord changes without adding any finger melody. My practice partner Elena Kowalski, who has been playing fingerstyle for ten years, told me that most people rush this step and it shows in their playing forever. The bass needs to be rock solid before layering anything on top.

The independence between thumb and fingers is the core technical challenge. I use a practice technique where I play the thumb pattern and sing a simple melody simultaneously — if I can sing independently of the thumb, my brain has truly separated the two motor tasks. Then I transfer the sung melody to the fingers. This approach was slower initially but produced much more reliable independence than trying to coordinate both hands from the start.

Nail maintenance has become surprisingly important. I keep my right hand fingernails about 1 to 2 millimeters past the fingertip, shaped with a fine-grit nail file into a smooth ramp that follows the natural curve of each finger's attack angle. The tone difference between well-maintained nails and ragged ones is dramatic — smooth nails produce a clear, bell-like tone while rough edges create a scratchy, unfocused sound. I file after every practice session and apply a nail hardener weekly. My luthier, David Park, mentioned that classical guitarists are equally obsessive about their nails and some even carry emergency nail repair kits to performances.

Current repertoire work focuses on three arrangements that cover different technical demands. First is "Dust in the Wind" by Kansas, which is essentially a Travis picking etude with a moving melody — good for cementing the alternating bass habit. Second is an arrangement of "Hallelujah" by Leonard Cohen that requires barre chords with fingerpicking, which is a left-hand stamina challenge since you cannot relax the barre between notes the way you can between strums. Third is Chet Atkins' arrangement of "Mr. Sandman," which is the aspirational piece — full chord melody with walking bass, harmonics, and position shifts. I can play about 60 percent of it at tempo but the B section still falls apart when the bass line becomes chromatic.

Practice structure that works for me: 10 minutes of PIMA warm-up patterns across all positions, 15 minutes of isolated technical work (currently focused on hammer-ons and pull-offs within fingerpicking patterns — my teacher calls these "ornaments"), 20 minutes of repertoire practice with a metronome, and 5 minutes of free improvisation over a simple chord loop to keep the creativity alive. Total of 50 minutes daily, six days a week with one rest day. The consistency matters more than the duration according to virtually every resource I have consulted.
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

echo "Wiki Type UAT — Skill"
echo ""

# Check OpenRouter key (needed for pipeline + regen)
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping skill wiki type test"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── 0. Sign in ────────────────────────────────────────────────
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null

# ── 1. Get MCP token from profile ────────────────────────────
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -z "$MCP_URL" ] || [ "$MCP_URL" = "null" ]; then
  fail "mcpEndpointUrl not in profile — cannot continue"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
pass "MCP token retrieved"

# Helper: MCP JSON-RPC call → parse SSE data: line
mcp_call() {
  local payload="$1"
  local raw
  raw=$(curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "$payload" \
    "$MCP_URL" 2>/dev/null)
  echo "$raw" | grep '^data: ' | head -1 | sed 's/^data: //'
}

# MCP initialize (required before tool calls)
mcp_call '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"uat-skill","version":"1.0"}}}' >/dev/null

# ── 2. Seed wiki types ───────────────────────────────────────
SEED_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "wiki-types seed → HTTP $SEED_HTTP"

# Verify 'skill' type exists
TYPES=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/wiki-types")
HAS_SKILL=$(echo "$TYPES" | jq '[.wikiTypes[].slug] | any(. == "skill")' 2>/dev/null)
[ "$HAS_SKILL" = "true" ] && pass "skill wiki type present" || fail "skill wiki type missing after seed"

# ── 3. Create 3 skill wikis via API ──────────────────────────
declare -a WIKI_KEYS=()
declare -a WIKI_SLUGS=()
TS=$(date +%s)

create_skill_wiki() {
  local name="$1"
  local desc="$2"
  local result
  result=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"$name\",\"type\":\"skill\",\"prompt\":\"\"}" \
    "$SERVER_URL/wikis")
  local http=$(echo "$result" | tail -1)
  local body=$(echo "$result" | sed '$d')
  local key=$(echo "$body" | jq -r '.lookupKey // .id // ""')
  local slug=$(echo "$body" | jq -r '.slug // ""')
  if [ "$http" = "201" ] && [ -n "$key" ]; then
    pass "POST /wikis → 201 ($name), key=$key"
    WIKI_KEYS+=("$key")
    WIKI_SLUGS+=("$slug")
  else
    fail "POST /wikis ($name) → HTTP $http"
  fi
}

create_skill_wiki "Learning Rust $TS" "A knowledge base for building capability in Rust programming, covering ownership, borrowing, lifetimes"
create_skill_wiki "Sourdough Baking $TS" "A knowledge base for developing sourdough bread baking capability, fermentation and scoring technique"
create_skill_wiki "Fingerstyle Guitar $TS" "A knowledge base for building fingerstyle guitar capability, practice patterns and technique"

if [ "${#WIKI_KEYS[@]}" -lt 3 ]; then
  fail "could not create all 3 skill wikis — aborting"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── 4. Submit 3 entries via MCP log_entry ─────────────────────

# Fixture 1: Rust ownership and borrowing
read -r -d '' FIXTURE_RUST << 'FIXTURE_EOF'
I have been working through the Rust Book for about four weeks now, and the ownership system is finally starting to click. The first two weeks were rough. I kept fighting the borrow checker like it was an adversary instead of understanding that it is a collaborator trying to prevent me from writing memory-unsafe code. The core rule is deceptively simple: each value in Rust has exactly one owner, and when that owner goes out of scope, the value is dropped. But the implications cascade into every design decision. When I pass a String to a function, ownership moves unless I explicitly borrow with an ampersand reference. This tripped me up constantly in week one because in Python and JavaScript I never had to think about who owns data — everything is reference counted or garbage collected behind the scenes.

Borrowing comes in two flavors and the distinction matters. An immutable borrow lets you read data without taking ownership, and you can have as many of these as you want simultaneously. A mutable borrow gives you exclusive write access, but the compiler enforces that no other references — mutable or immutable — exist at the same time. My mentor Sarah explained it as the readers-writer lock pattern baked into the type system. Once I internalized that analogy, the compiler errors went from cryptic to obvious.

Lifetimes were the next hurdle. The compiler needs to know how long each reference is valid so it can guarantee no dangling pointers. Most of the time lifetime elision rules handle this automatically, but when you write functions that return references, you sometimes need explicit lifetime annotations like the tick-a syntax. It looks alien at first but it is really just telling the compiler that the returned reference lives at least as long as both inputs.

Pattern matching with match and if let has become one of my favorite features. Combined with the enum system, especially Option and Result, it eliminates entire categories of null pointer bugs. I refactored a small CLI tool I had written in Python, and the Rust version caught three edge cases at compile time that the Python version only caught via runtime exceptions in production. Dr. James Chen from our systems reading group pointed out that this is exactly why Mozilla invested in Rust for Firefox — the browser engine cannot afford null dereference crashes.

Practical patterns I have adopted so far: I clone liberally when prototyping (the Rust community calls this clone-driven development) and then optimize ownership later once the logic is correct. I use as_ref and as_deref to convert between owned and borrowed types without unnecessary copying. I have started writing smaller functions that take references rather than owned values, which makes the borrow checker happier and keeps the call sites flexible.

The cargo ecosystem is remarkable. Coming from npm, the fact that cargo handles building, testing, dependency management, and documentation in one tool feels luxurious. I set up cargo-watch for hot reloading during development, and clippy catches style issues that would take a senior Rust developer to spot. My colleague Marcus Rivera recommended the rust-analyzer LSP integration for VS Code, and it has been transformative — inline type hints and real-time borrow checker feedback make the learning curve much gentler.

Next month I plan to tackle async Rust with tokio, which everyone warns is a significant step up in complexity. The Pin and Future traits apparently require a solid understanding of ownership to make sense, so I am glad I spent this month building that foundation.
FIXTURE_EOF

# Fixture 2: Sourdough fermentation and scoring
read -r -d '' FIXTURE_BREAD << 'FIXTURE_EOF'
Six months of weekly sourdough bakes and I finally feel like I understand what the dough is telling me. The biggest lesson has nothing to do with recipes — it is about learning to read fermentation by touch and sight rather than by clock. Every kitchen is different. My apartment runs cool in winter around 66 degrees Fahrenheit and warm in summer at 78 degrees, and that twenty-degree swing changes bulk fermentation time by three to four hours.

The starter is everything. I maintain a 100 percent hydration starter (equal parts flour and water by weight) that I feed every twelve hours when baking and once a week when dormant in the fridge. The critical indicator of readiness is the float test — a spoonful of starter dropped in water should float within four hours of feeding. My baker friend Tomoko Hayashi taught me that the smell matters too: ripe starter smells like overripe fruit with a slight vinegar tang. If it smells like nail polish remover (ethyl acetate), it has over-fermented and needs a couple of back-to-back feedings to recover.

Bulk fermentation is where most beginners go wrong, myself included. The dough needs to increase in volume by roughly 50 to 75 percent — not double, which is the old advice from commercial yeast recipes. I use a straight-sided clear container with a rubber band marking the starting level. Stretch-and-fold sets every thirty minutes for the first two hours build gluten structure without the heavy kneading that traditional bread requires. After the folds, I leave the dough alone and check it every hour. The signs of readiness: the dough is domed on top, jiggles when you shake the container, and you can see bubbles along the sides and bottom.

Cold retard in the refrigerator is the secret weapon. After shaping, I put the dough in a banneton lined with rice flour and refrigerate it for 12 to 18 hours. This slows fermentation dramatically while allowing enzymes to break down starches into sugars, which produces better flavor complexity and a darker, more caramelized crust. The cold also firms up the dough, making it much easier to score cleanly. Chef Antonio Rossi at the community baking workshop emphasized that professional bakeries retard overnight specifically for scoring control, not just scheduling convenience.

Shaping is a two-stage process. First comes the pre-shape: gently tip the dough onto an unfloured surface, use a bench scraper to fold it into a rough round, and let it rest for 20 to 30 minutes covered with a damp towel. The bench rest lets the gluten relax so the final shape does not fight back. For the final shape, I flour the top of the dough, flip it, and pull the edges toward the center like folding an envelope. Then I flip it seam-side down and use the bench scraper to drag it toward me on the unfloured surface, building surface tension. The dough should feel taut, like a filled water balloon. If it tears, the gluten was not developed enough during bulk.

Scoring is both functional and artistic. The functional purpose is to control where the bread expands during the initial oven spring — without a score, the loaf will burst unpredictably along its weakest seam. I use a double-edged razor blade held at roughly 45 degrees to the surface. A shallow angle creates the coveted ear — that crispy flap of crust that lifts during baking. A perpendicular cut gives a more open, rustic split. My go-to pattern is a single curved slash off-center, about a quarter inch deep.

The bake itself follows a two-phase approach. Phase one: 20 minutes at 500 degrees Fahrenheit in a preheated Dutch oven with the lid on. The trapped steam keeps the crust pliable so the bread can expand fully. Phase two: remove the lid, drop to 450 degrees, and bake another 20 to 25 minutes until the crust is deeply caramelized. I learned from Lucia Fernandez, who runs a micro-bakery in our neighborhood, that the internal temperature should hit 208 to 210 degrees Fahrenheit. Below that and the crumb will be gummy. I let the loaf cool on a wire rack for at least two hours before cutting.
FIXTURE_EOF

# Fixture 3: Fingerstyle guitar practice
read -r -d '' FIXTURE_GUITAR << 'FIXTURE_EOF'
Three months into dedicated fingerstyle practice after playing with a pick for six years. The transition has been humbling but deeply rewarding. My right hand is essentially relearning how to interact with the strings, and the independence required between thumb and fingers is a completely different motor skill than flatpicking.

The foundation is the PIMA system: P (pulgar) for the thumb covering bass strings E, A, and D, I (indice) index finger on the G string, M (medio) middle finger on the B string, and A (anular) ring finger on the high E string. My teacher Robert Nakamura insists on strict assignment during the first month — no cheating by letting fingers drift to adjacent strings. The discipline pays off because once the default assignments are automatic, you can break the rules intentionally for musical effect rather than out of sloppiness.

The first exercise that really built my foundation was a simple arpeggiated pattern in 4/4 time: P-I-M-A-M-I repeated over basic open chords (C, Am, G, Em). I practiced this with a metronome at 60 BPM for two weeks before increasing to 72, then 80. The key insight from my practice: speed comes from relaxation, not effort. When I tense my right hand trying to go faster, the tone gets thin and scratchy. When I focus on a loose wrist and letting each finger fall naturally into the string with just enough force, the tone is warm and full, and paradoxically the tempo increases on its own.

Travis picking was the first major milestone. Named after Merle Travis, this pattern uses an alternating bass note on the thumb (typically root-fifth or root-octave) while the fingers pick a melody or fill pattern on the treble strings. The thumb becomes a metronome — steady alternating bass regardless of what the fingers are doing above. I spent three weeks just on the thumb pattern alone, walking bass lines over chord changes without adding any finger melody. My practice partner Elena Kowalski, who has been playing fingerstyle for ten years, told me that most people rush this step and it shows in their playing forever. The bass needs to be rock solid before layering anything on top.

The independence between thumb and fingers is the core technical challenge. I use a practice technique where I play the thumb pattern and sing a simple melody simultaneously — if I can sing independently of the thumb, my brain has truly separated the two motor tasks. Then I transfer the sung melody to the fingers. This approach was slower initially but produced much more reliable independence than trying to coordinate both hands from the start.

Nail maintenance has become surprisingly important. I keep my right hand fingernails about 1 to 2 millimeters past the fingertip, shaped with a fine-grit nail file into a smooth ramp that follows the natural curve of each finger's attack angle. The tone difference between well-maintained nails and ragged ones is dramatic — smooth nails produce a clear, bell-like tone while rough edges create a scratchy, unfocused sound. I file after every practice session and apply a nail hardener weekly. My luthier, David Park, mentioned that classical guitarists are equally obsessive about their nails and some even carry emergency nail repair kits to performances.

Current repertoire work focuses on three arrangements that cover different technical demands. First is Dust in the Wind by Kansas, which is essentially a Travis picking etude with a moving melody — good for cementing the alternating bass habit. Second is an arrangement of Hallelujah by Leonard Cohen that requires barre chords with fingerpicking, which is a left-hand stamina challenge since you cannot relax the barre between notes the way you can between strums. Third is Chet Atkins arrangement of Mr. Sandman, which is the aspirational piece — full chord melody with walking bass, harmonics, and position shifts.

Practice structure that works for me: 10 minutes of PIMA warm-up patterns across all positions, 15 minutes of isolated technical work (currently focused on hammer-ons and pull-offs within fingerpicking patterns), 20 minutes of repertoire practice with a metronome, and 5 minutes of free improvisation over a simple chord loop to keep the creativity alive. Total of 50 minutes daily, six days a week with one rest day. The consistency matters more than the duration according to virtually every resource I have consulted.
FIXTURE_EOF

declare -a ENTRY_KEYS=()

submit_entry() {
  local label="$1"
  local content="$2"
  local payload
  payload=$(jq -n --arg c "$content" '{
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "log_entry",
      arguments: { content: $c, source: "mcp" }
    }
  }')
  local resp
  resp=$(mcp_call "$payload")
  local text
  text=$(echo "$resp" | jq -r '.result.content[0].text // ""' 2>/dev/null)
  local is_error
  is_error=$(echo "$resp" | jq -r '.result.isError // false' 2>/dev/null)

  if [ "$is_error" = "true" ]; then
    fail "MCP log_entry ($label): $text"
    return
  fi

  # Extract entry key from "Entry queued: entry01XXXX..."
  local ekey
  ekey=$(echo "$text" | grep -oP 'entry[0-9A-Z]{26}' | head -1)
  if [ -n "$ekey" ]; then
    pass "MCP log_entry ($label) → $ekey"
    ENTRY_KEYS+=("$ekey")
  else
    fail "MCP log_entry ($label): no entry key in response: $text"
  fi
}

submit_entry "Rust" "$FIXTURE_RUST"
submit_entry "Sourdough" "$FIXTURE_BREAD"
submit_entry "Guitar" "$FIXTURE_GUITAR"

echo ""
echo "  submitted ${#ENTRY_KEYS[@]} entries, polling pipeline..."

# ── 5. Poll until all entries reach processed (max 360s) ──────
ELAPSED=0
MAX_WAIT=360
RESOLVED_COUNT=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  RESOLVED_COUNT=0

  for ekey in "${ENTRY_KEYS[@]}"; do
    STATUS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/$ekey" 2>/dev/null | jq -r '.ingestStatus // .state // "unknown"')
    if [ "$STATUS" = "processed" ] || [ "$STATUS" = "RESOLVED" ]; then
      RESOLVED_COUNT=$((RESOLVED_COUNT + 1))
    fi
  done

  echo "    ${ELAPSED}s — $RESOLVED_COUNT/${#ENTRY_KEYS[@]} entries processed"
  if [ "$RESOLVED_COUNT" -ge "${#ENTRY_KEYS[@]}" ]; then
    break
  fi
done

if [ "$RESOLVED_COUNT" -ge "${#ENTRY_KEYS[@]}" ]; then
  pass "all ${#ENTRY_KEYS[@]} entries processed in ${ELAPSED}s"
else
  fail "only $RESOLVED_COUNT/${#ENTRY_KEYS[@]} entries processed after ${MAX_WAIT}s"
fi

# ── 6. Report fragments ──────────────────────────────────────
echo ""
echo "  -- Fragment report --"
FRAGS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=100")
FRAG_COUNT=$(echo "$FRAGS" | jq '.fragments | length' 2>/dev/null || echo "0")
echo "    total fragments: $FRAG_COUNT"

if [ "$FRAG_COUNT" -gt 0 ] 2>/dev/null; then
  pass "fragments created ($FRAG_COUNT)"
  # Show first 5 fragment titles
  echo "$FRAGS" | jq -r '.fragments[:5][] | "    - \(.title // .slug)"' 2>/dev/null
else
  fail "no fragments after pipeline"
fi

# ── 7. Report people (entity extraction) ─────────────────────
echo ""
echo "  -- People report --"
PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")
echo "    total people: $PEOPLE_COUNT"

if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "people extracted ($PEOPLE_COUNT)"
  echo "$PEOPLE" | jq -r '.people[] | "    - \(.canonicalName // .name)"' 2>/dev/null
else
  # People extraction is fail-open; not a hard failure
  skip "no people extracted (entity extraction may have been skipped)"
fi

# ── 8. Report edges (graph) ──────────────────────────────────
echo ""
echo "  -- Edge report --"
GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")
echo "    nodes: $NODE_COUNT, edges: $EDGE_COUNT"

if [ "$EDGE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "graph edges exist ($EDGE_COUNT)"
  # Break down edge types
  echo "$GRAPH" | jq -r '[.edges[].edgeType] | group_by(.) | map("\(.[0]): \(length)") | .[]' 2>/dev/null | while read -r line; do
    echo "    $line"
  done
else
  fail "no edges in graph"
fi

# ── 9. Check skill wikis have fragments linked ───────────────
echo ""
echo "  -- Wiki-fragment linkage --"
for i in 0 1 2; do
  SLUG="${WIKI_SLUGS[$i]}"
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  WIKI_STATE=$(echo "$DETAIL" | jq -r '.state // "unknown"')
  WIKI_FRAG_COUNT=$(echo "$DETAIL" | jq '.fragments | length // 0' 2>/dev/null || echo "0")
  echo "    $SLUG: state=$WIKI_STATE, fragments=$WIKI_FRAG_COUNT"
done

# ── 10. Trigger on-demand regen for first skill wiki ─────────
echo ""
echo "  -- Regeneration --"
REGEN_KEY="${WIKI_KEYS[0]}"
REGEN_SLUG="${WIKI_SLUGS[0]}"

# Enable regeneration
curl -s -o /dev/null -X PATCH -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"regenerate":true}' \
  "$SERVER_URL/wikis/$REGEN_KEY/regenerate"

REGEN_HTTP=$(curl -s -o /tmp/uat-skill-regen.json -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wikis/$REGEN_KEY/regenerate")

if [ "$REGEN_HTTP" = "200" ]; then
  REGEN_FCOUNT=$(jq '.fragmentCount // 0' /tmp/uat-skill-regen.json 2>/dev/null)
  pass "POST /wikis/:id/regenerate → 200 ($REGEN_SLUG, $REGEN_FCOUNT fragments)"
else
  fail "POST /wikis/:id/regenerate → HTTP $REGEN_HTTP"
  jq '.' /tmp/uat-skill-regen.json 2>/dev/null
fi

# ── 11. Report final wiki state ──────────────────────────────
echo ""
echo "  -- Final wiki state --"
for i in 0 1 2; do
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_KEYS[$i]}")
  WIKI_NAME=$(echo "$DETAIL" | jq -r '.name // "?"')
  WIKI_STATE=$(echo "$DETAIL" | jq -r '.state // "unknown"')
  WIKI_TYPE=$(echo "$DETAIL" | jq -r '.type // "unknown"')
  WIKI_HAS_CONTENT=$(echo "$DETAIL" | jq 'if .content and (.content | length > 0) then "yes" else "no" end' 2>/dev/null)
  CONTENT_LEN=$(echo "$DETAIL" | jq '.content | length // 0' 2>/dev/null || echo "0")
  echo "    $WIKI_NAME: type=$WIKI_TYPE, state=$WIKI_STATE, hasContent=$WIKI_HAS_CONTENT (${CONTENT_LEN} chars)"

  if [ "$WIKI_TYPE" = "skill" ]; then
    pass "wiki type is skill ($WIKI_NAME)"
  else
    fail "wiki type is $WIKI_TYPE, expected skill ($WIKI_NAME)"
  fi
done

# ── 12. Cleanup: delete test wikis ───────────────────────────
echo ""
echo "  -- Cleanup --"
for key in "${WIKI_KEYS[@]}"; do
  DEL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$key")
  if [ "$DEL_HTTP" = "204" ] || [ "$DEL_HTTP" = "200" ]; then
    pass "DELETE wiki $key"
  else
    fail "DELETE wiki $key → HTTP $DEL_HTTP"
  fi
done

echo ""
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```
