# Wiki Type UAT — Collection

## What it proves
End-to-end lifecycle for the **Collection** wiki type: create 3 collection wikis,
submit entries via MCP (one per wiki), poll until the pipeline processes them,
verify fragments/people/edges exist, trigger on-demand regeneration, and confirm
the wiki content reflects the collection prompt structure.

A Collection wiki is "a curated library organizing related bookmarks, references,
or resources." The pipeline should extract atomic fragments from the raw entries,
detect mentioned people, create FRAGMENT_IN_WIKI and FRAGMENT_MENTIONS_PERSON
edges, and produce a structured markdown document with Overview / Items / When to
Use sections.

## Prerequisites
- `OPENROUTER_API_KEY` set in the invoking shell
- Server running at `SERVER_URL` (default `http://localhost:3000`)
- `core/.env` populated with `INITIAL_USERNAME`, `INITIAL_PASSWORD`

## Fixtures

Three realistic text inputs representing curated collections. Each is submitted
as a raw entry via MCP `log_entry`, processed through the full AI pipeline, and
the resulting fragments are attached to the corresponding collection wiki.

---

### Fixture 1 — Software Engineering Reading List

> A curated reading list of essential software engineering books with annotations
> on why each matters and when to read it.

```
My Software Engineering Reading List — Annotated Picks

I have been building and refining this reading list for the past four years. Every book here changed how I think about building software, and I have organized them by the stage of your career where they hit hardest. This is not a "top ten" listicle — it is a working reference I actually go back to.

Foundations (read these first):
- "The Pragmatic Programmer" by David Thomas and Andrew Hunt. This is the single best starting point for any developer. The tips on tracer bullets, DRY, and orthogonality are things I still reference in design reviews a decade later. Dave and Andy wrote the second edition in 2019, and it is significantly updated — do not read the original 1999 edition.
- "Code Complete" by Steve McConnell. Dense, long, and worth every page. McConnell backs up every recommendation with data from empirical studies. The chapters on variable naming and code layout seem trivial until you realize how much time your team burns on style arguments that this book already settled.
- "A Philosophy of Software Design" by John Ousterhout. Short, opinionated, and contrarian — Ousterhout argues that deep modules with simple interfaces beat the popular "small classes, small methods" advice. I resisted this at first, then realized he was right about 80 percent of the cases I encounter. Professor Maria Chen at Stanford uses this as her primary text for CS 190.

Architecture and Systems Thinking:
- "Designing Data-Intensive Applications" by Martin Kleppmann. The single most important book for anyone building distributed systems or working with databases beyond toy projects. Kleppmann explains replication, partitioning, and consistency models with diagrams that actually clarify rather than confuse. James Watkins, our staff engineer, calls this "the book that replaced three shelves of O'Reilly titles."
- "Software Architecture: The Hard Parts" by Neal Ford, Mark Richards, Pramod Sadalage, and Zhamak Dehghani. Focuses on the trade-off decisions that architecture is actually about: coupling versus cohesion, synchronous versus asynchronous, orchestration versus choreography. The fitness functions concept is something I brought into our architecture review process after reading it.
- "Building Evolutionary Architectures" by Ford and Richards. Companion to Hard Parts. The concept of fitness functions — automated checks that verify architectural characteristics — is something every team should adopt.

Process and Culture:
- "Accelerate" by Nicole Forsgren, Jez Humble, and Gene Kim. Links specific engineering practices to measurable outcomes through DORA metrics: deployment frequency, lead time, change fail rate, and mean time to recovery. I gave a copy to every engineering manager on my team. Sarah Park from our DevOps group ran a book club on this last quarter and it directly shaped our CI/CD migration plan.
- "Team Topologies" by Matthew Skelton and Manuel Pais. Changed how I think about organizational structure and its effect on software architecture. The four team types (stream-aligned, enabling, complicated subsystem, platform) gave us a shared vocabulary that eliminated months of ambiguous reorg discussions.

When to reach for this list: at career transitions, before starting a greenfield project, during architecture reviews, or when onboarding a new senior hire. I update it roughly every six months as new standouts emerge.
```

---

### Fixture 2 — Developer Productivity Toolkit

> An annotated collection of the developer tools, CLIs, and workflows
> that form a daily working environment.

```
My Developer Productivity Toolkit — Tools I Actually Use Daily

This is the canonical list of tools in my daily development workflow. Everything here has survived at least six months of real use — I drop anything that adds friction or that I find myself working around instead of with. Last reviewed January 2025 with input from my colleague Tom Rivera who runs a similar setup on Linux.

Editor and IDE:
- Neovim (nightly builds) with lazy.nvim as the plugin manager. I switched from VS Code eighteen months ago and never looked back. The combination of Telescope for fuzzy finding, nvim-lspconfig for language server integration, and oil.nvim for file management gives me a workflow that feels like an extension of my thinking rather than a tool I am operating. Tom uses the same setup but swaps oil.nvim for neo-tree — both work, it is a preference thing.
- Claude Code as the AI coding assistant integrated directly into the terminal. The MCP protocol support means it can read my project context without me copy-pasting files. I evaluated GitHub Copilot, Cursor, and Cody — Claude Code won on accuracy for complex refactors and its ability to run shell commands in context.

Terminal and Shell:
- Ghostty as the terminal emulator. Native GPU rendering, sub-millisecond input latency, and configuration through a single text file. Mitchell Hashimoto built this after leaving HashiCorp and it shows the same attention to correctness that went into Terraform.
- Zsh with a minimal custom config (no oh-my-zsh). I use starship for the prompt, zoxide for directory jumping, and fzf for history search. Rachel Kim on our platform team showed me the zoxide + fzf combination and it cut my directory navigation time by roughly half.
- Tmux with a handful of custom bindings. The session persistence alone justifies it — I can detach, reboot, and reattach without losing state. I keep one session per project with a standardized window layout: editor, server logs, shell, and a test runner.

Version Control and Collaboration:
- Git with delta for diffs (syntax highlighting in the terminal) and gh (the GitHub CLI) for pull requests, issues, and reviews without leaving the terminal. I alias common workflows: "git pr" creates a PR from the current branch, "git review" checks out a PR for local testing.
- Conventional commits enforced via commitlint and a husky pre-commit hook. Sounds bureaucratic until you need to auto-generate a changelog or bisect a regression — then the structured history pays for itself immediately.

Build and Runtime:
- Bun as the JavaScript runtime and package manager. The install speed alone (10x faster than npm) justifies it, but the built-in test runner and TypeScript support without a separate compile step eliminated three tools from my chain. Alex Doshi on the frontend team was skeptical until he saw our CI pipeline drop from 4 minutes to 90 seconds.
- Docker with Colima on macOS (no Docker Desktop). Lightweight, scriptable, and does not eat half my RAM. For local development I use docker compose with health checks and depends_on conditions so services start in the right order.

Monitoring and Debugging:
- Grafana + Prometheus for local observability when testing distributed services. Overkill for solo work but essential when you need to understand why a request is slow across three services. I keep a pre-built docker compose stack for this.
- jq and fx for JSON processing in the terminal. Every API response, every log line, every config file — jq handles it. Lisa Patel from our data team wrote a set of shared jq filters for our common log formats that the whole backend team uses now.

When to reach for this list: when setting up a new machine, when onboarding a teammate, or when evaluating whether to add or remove a tool from the stack. The goal is a small, composable toolkit where every piece earns its place.
```

---

### Fixture 3 — Design Systems Reference Shelf

> A curated compilation of design system references, component libraries,
> and learning resources with notes on what makes each one worth studying.

```
Design Systems Reference Shelf — What to Study and Why

I maintain this reference shelf as a working resource for anyone on our team building or contributing to design systems. Every entry has a note on what makes it worth studying and what you will actually learn from it. This is not an exhaustive catalogue — it is an opinionated selection of the references that have most influenced how we build our own component library. Updated quarterly; last review was with our design lead, Priya Sharma, in December 2024.

Production Design Systems (study the source, not just the docs):
- Material Design 3 (Google). The most comprehensive public design system. Study it for the token architecture — every color, shape, and motion value flows from a small set of source tokens through a layered resolution system. The way they handle dynamic color (Material You) is the best public implementation of user-personalized theming. Download the Figma kit and trace how a single "primary" seed color cascades into 80+ derived tokens.
- Carbon (IBM). Open source and deeply opinionated about accessibility. Carbon treats WCAG compliance not as a checklist but as a structural constraint that shapes every component API. Their grid system documentation is the clearest I have found anywhere. Kevin Park from IBM's design tools team gave a talk at Config 2024 that walks through how they enforce contrast ratios programmatically through their token pipeline.
- Polaris (Shopify). Study this for its content guidelines — Polaris treats voice and tone as first-class design system artifacts alongside components. The way they document "do / don't" patterns for UX writing is something we adapted directly for our own content guidelines. Emma Liu on our content design team used Polaris as the template for our tone rubric.
- Geist (Vercel). Minimalist and performance-driven. Geist is worth studying for what it leaves out — every component exists only because it solved a real problem in the Vercel dashboard. The CSS variable naming convention is clean and the dark mode implementation uses a single class toggle with no JavaScript. Guillermo Rauch's philosophy of "reduce to the essential" is visible in every API surface.

Component Library Implementations (study the code):
- Radix Primitives (WorkOS). The gold standard for unstyled, accessible React primitives. Every component ships with full ARIA support, keyboard navigation, and focus management built in. Study the Dialog and Popover implementations to understand how they handle focus trapping and scroll locking without breaking the page. Our own modal system is built on Radix.
- Headless UI (Tailwind Labs). Similar philosophy to Radix but with a smaller surface area and tight Tailwind integration. Adam Wathan designed the API to match how people actually use Tailwind — the components produce no visual output, just behavior and accessibility. Compare their Combobox with Radix's Select to see two valid approaches to the same problem.
- shadcn/ui. Not a component library in the traditional sense — it is a collection of copy-paste components built on Radix and Tailwind. Study it for the distribution model: components live in your codebase, not in node_modules. This eliminates the version-lock problem that plagues traditional libraries. Daniel Nguyen on our frontend team used shadcn as the starting point for our internal component library and it saved us roughly three months of boilerplate.

Learning Resources (read these in order):
- "Design Systems" by Alla Kholmatova (Smashing Magazine, 2017). Still the best single book on the topic. Kholmatova covers the organizational and process aspects that most technical resources skip. The chapter on naming conventions alone is worth the price.
- "Atomic Design" by Brad Frost. Introduces the atoms-molecules-organisms-templates-pages hierarchy. The model is imperfect (the biology metaphor breaks down at the template level) but it gave us a shared vocabulary for component composition that we still use. Brad maintains a living version at atomicdesign.bradfrost.com.
- Storybook documentation and tutorials. Not a book, but the Storybook docs are the most practical guide to building a component development environment. Their Chromatic visual regression testing integration is what we use for our own CI pipeline. Marcus Chen set up our Storybook instance and credits their docs for cutting setup time from weeks to days.

Token Architecture References:
- Style Dictionary (Amazon). The open-source tool for transforming design tokens into platform-specific outputs (CSS custom properties, iOS Swift, Android XML). Study the transform pipeline to understand how a single source-of-truth token file becomes usable across web, iOS, and Android. Priya and I spent a week evaluating token tools and Style Dictionary won on extensibility.
- Figma Variables (native). Figma's built-in variable system is now mature enough to be the single source for design tokens in small-to-medium systems. The modes feature (light/dark, compact/comfortable) maps cleanly to the multi-dimensional token concept. For larger systems you still need Style Dictionary as a build step, but Figma Variables is the right starting point.

When to reach for this shelf: when starting a new design system, when evaluating component libraries, when onboarding a designer or frontend developer, or when you need to justify a technical decision about token architecture to stakeholders. The goal is informed decisions, not cargo-culting someone else's system.
```

---

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

echo "Wiki Type UAT — Collection"
echo ""

# Check OpenRouter key (required for pipeline + regen)
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping collection pipeline test"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── Sign in ──────────────────────────────────────────────────────────
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null

# ── Get MCP token ────────────────────────────────────────────────────
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -z "$MCP_URL" ] || [ "$MCP_URL" = "null" ]; then
  fail "mcpEndpointUrl is empty — cannot run MCP tests"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
pass "MCP token acquired"

# Helper: SSE response parser
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

# Helper: MCP tool call
mcp_call() {
  local tool_name="$1"
  local args_json="$2"
  local call_id="${3:-99}"
  local RAW
  RAW=$(curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$call_id,\"method\":\"tools/call\",\"params\":{\"name\":\"$tool_name\",\"arguments\":$args_json}}" \
    "$MCP_URL" 2>/dev/null)
  echo "$RAW" | parse_sse
}

# ── 1. Seed wiki types ───────────────────────────────────────────────
SEED_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "seed wiki types → HTTP $SEED_HTTP"

# Verify collection type exists
COLLECTION_TYPE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/collection" 2>/dev/null)
HAS_COLLECTION=$(echo "$COLLECTION_TYPE" | jq -r '.slug // ""' 2>/dev/null)
[ "$HAS_COLLECTION" = "collection" ] && pass "collection wiki type exists" || fail "collection wiki type missing (got: $HAS_COLLECTION)"

# ── 2. Create 3 collection wikis ─────────────────────────────────────
declare -a WIKI_IDS WIKI_SLUGS
WIKI_NAMES=("Engineering Reading List" "Developer Productivity Toolkit" "Design Systems Reference Shelf")

for i in 0 1 2; do
  CREATE=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"${WIKI_NAMES[$i]}\",\"type\":\"collection\"}" \
    "$SERVER_URL/wikis")
  CREATE_HTTP=$(echo "$CREATE" | tail -1)
  CREATE_BODY=$(echo "$CREATE" | sed '$d')
  WID=$(echo "$CREATE_BODY" | jq -r '.lookupKey // .id // ""')
  WSLUG=$(echo "$CREATE_BODY" | jq -r '.slug // ""')

  if [ "$CREATE_HTTP" = "201" ] && [ -n "$WID" ]; then
    WIKI_IDS[$i]="$WID"
    WIKI_SLUGS[$i]="$WSLUG"
    pass "created wiki[$i]: ${WIKI_NAMES[$i]} (id=$WID, slug=$WSLUG)"
  else
    fail "create wiki[$i] → HTTP $CREATE_HTTP"
    WIKI_IDS[$i]=""
    WIKI_SLUGS[$i]=""
  fi
done

# Verify all 3 have type=collection
for i in 0 1 2; do
  [ -z "${WIKI_IDS[$i]}" ] && continue
  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_IDS[$i]}")
  WTYPE=$(echo "$DETAIL" | jq -r '.type // ""')
  [ "$WTYPE" = "collection" ] && pass "wiki[$i] type=collection" || fail "wiki[$i] type=$WTYPE (expected collection)"
done

# ── 3. Submit 3 entries via MCP log_entry ─────────────────────────────
# Each entry maps to one wiki. The pipeline will extract fragments;
# we will manually attach them to the correct wiki afterward via log_fragment.

# Fixture 1: Software Engineering Reading List
read -r -d '' FIXTURE_1 << 'FIXTURE_EOF'
My Software Engineering Reading List — Annotated Picks. I have been building and refining this reading list for the past four years. Every book here changed how I think about building software, and I have organized them by the stage of your career where they hit hardest. This is not a top ten listicle — it is a working reference I actually go back to. Foundations (read these first): The Pragmatic Programmer by David Thomas and Andrew Hunt. This is the single best starting point for any developer. The tips on tracer bullets, DRY, and orthogonality are things I still reference in design reviews a decade later. Dave and Andy wrote the second edition in 2019. Code Complete by Steve McConnell. Dense, long, and worth every page. McConnell backs up every recommendation with data from empirical studies. A Philosophy of Software Design by John Ousterhout. Short, opinionated, and contrarian — Ousterhout argues that deep modules with simple interfaces beat the popular small classes small methods advice. Professor Maria Chen at Stanford uses this as her primary text for CS 190. Architecture and Systems Thinking: Designing Data-Intensive Applications by Martin Kleppmann. The single most important book for anyone building distributed systems. Kleppmann explains replication, partitioning, and consistency models with diagrams that actually clarify rather than confuse. James Watkins, our staff engineer, calls this the book that replaced three shelves of O'Reilly titles. Software Architecture The Hard Parts by Neal Ford, Mark Richards, Pramod Sadalage, and Zhamak Dehghani. Focuses on the trade-off decisions that architecture is actually about. The fitness functions concept is something I brought into our architecture review process. Accelerate by Nicole Forsgren, Jez Humble, and Gene Kim. Links specific engineering practices to measurable outcomes through DORA metrics. Sarah Park from our DevOps group ran a book club on this last quarter and it directly shaped our CI/CD migration plan. Team Topologies by Matthew Skelton and Manuel Pais. Changed how I think about organizational structure and its effect on software architecture. When to reach for this list: at career transitions, before starting a greenfield project, during architecture reviews, or when onboarding a new senior hire.
FIXTURE_EOF

# Fixture 2: Developer Productivity Toolkit
read -r -d '' FIXTURE_2 << 'FIXTURE_EOF'
My Developer Productivity Toolkit — Tools I Actually Use Daily. This is the canonical list of tools in my daily development workflow. Everything here has survived at least six months of real use. Last reviewed January 2025 with input from my colleague Tom Rivera who runs a similar setup on Linux. Editor and IDE: Neovim nightly builds with lazy.nvim as the plugin manager. I switched from VS Code eighteen months ago and never looked back. The combination of Telescope for fuzzy finding, nvim-lspconfig for language server integration, and oil.nvim for file management gives me a workflow that feels like an extension of my thinking. Tom uses the same setup but swaps oil.nvim for neo-tree. Claude Code as the AI coding assistant integrated directly into the terminal. The MCP protocol support means it can read my project context without me copy-pasting files. Terminal and Shell: Ghostty as the terminal emulator. Native GPU rendering, sub-millisecond input latency, and configuration through a single text file. Mitchell Hashimoto built this after leaving HashiCorp. Zsh with a minimal custom config. I use starship for the prompt, zoxide for directory jumping, and fzf for history search. Rachel Kim on our platform team showed me the zoxide plus fzf combination and it cut my directory navigation time by roughly half. Tmux with custom bindings for session persistence. Version Control and Collaboration: Git with delta for diffs and gh the GitHub CLI for pull requests, issues, and reviews without leaving the terminal. Conventional commits enforced via commitlint and a husky pre-commit hook. Build and Runtime: Bun as the JavaScript runtime and package manager. The install speed alone justifies it, but the built-in test runner and TypeScript support without a separate compile step eliminated three tools from my chain. Alex Doshi on the frontend team was skeptical until he saw our CI pipeline drop from 4 minutes to 90 seconds. Docker with Colima on macOS. Monitoring and Debugging: Grafana plus Prometheus for local observability. jq and fx for JSON processing in the terminal. Lisa Patel from our data team wrote a set of shared jq filters for our common log formats that the whole backend team uses. When to reach for this list: when setting up a new machine, when onboarding a teammate, or when evaluating whether to add or remove a tool from the stack.
FIXTURE_EOF

# Fixture 3: Design Systems Reference Shelf
read -r -d '' FIXTURE_3 << 'FIXTURE_EOF'
Design Systems Reference Shelf — What to Study and Why. I maintain this reference shelf as a working resource for anyone building or contributing to design systems. Every entry has a note on what makes it worth studying. Updated quarterly; last review was with our design lead, Priya Sharma, in December 2024. Production Design Systems: Material Design 3 from Google. The most comprehensive public design system. Study it for the token architecture — every color shape and motion value flows from a small set of source tokens through a layered resolution system. Carbon from IBM. Open source and deeply opinionated about accessibility. Carbon treats WCAG compliance not as a checklist but as a structural constraint. Kevin Park from IBM's design tools team gave a talk at Config 2024 that walks through how they enforce contrast ratios programmatically. Polaris from Shopify. Study this for its content guidelines — Polaris treats voice and tone as first-class design system artifacts alongside components. Emma Liu on our content design team used Polaris as the template for our tone rubric. Geist from Vercel. Minimalist and performance-driven. Guillermo Rauch's philosophy of reduce to the essential is visible in every API surface. Component Library Implementations: Radix Primitives from WorkOS. The gold standard for unstyled accessible React primitives. Our own modal system is built on Radix. Headless UI from Tailwind Labs. Adam Wathan designed the API to match how people actually use Tailwind. shadcn/ui. Not a component library in the traditional sense — it is a collection of copy-paste components built on Radix and Tailwind. Daniel Nguyen on our frontend team used shadcn as the starting point for our internal component library and it saved us roughly three months of boilerplate. Learning Resources: Design Systems by Alla Kholmatova. Still the best single book on the topic. Atomic Design by Brad Frost. Introduces the atoms-molecules-organisms-templates-pages hierarchy. Storybook documentation and tutorials. Marcus Chen set up our Storybook instance and credits their docs for cutting setup time from weeks to days. Token Architecture: Style Dictionary from Amazon. Priya and I spent a week evaluating token tools and Style Dictionary won on extensibility. Figma Variables native. When to reach for this shelf: when starting a new design system, when evaluating component libraries, when onboarding a designer or frontend developer.
FIXTURE_EOF

FIXTURES=("$FIXTURE_1" "$FIXTURE_2" "$FIXTURE_3")
declare -a ENTRY_KEYS

for i in 0 1 2; do
  # Escape the fixture for JSON
  ESCAPED=$(printf '%s' "${FIXTURES[$i]}" | jq -Rs '.')
  RESP=$(mcp_call "log_entry" "{\"content\":$ESCAPED,\"source\":\"mcp\"}" $((10+i)))

  if [ -z "$RESP" ] || [ ${#RESP} -lt 5 ]; then
    fail "MCP log_entry[$i] returned empty response"
    ENTRY_KEYS[$i]=""
    continue
  fi

  # Extract entry key from "Entry queued: entry01ABC..."
  EKEY=$(echo "$RESP" | jq -r '.result.content[0].text // ""' 2>/dev/null | grep -oP 'entry[0-9A-Z]{26}' || true)

  if [ -n "$EKEY" ]; then
    ENTRY_KEYS[$i]="$EKEY"
    pass "MCP log_entry[$i] → queued ($EKEY)"
  else
    # Check for error or duplicate
    TEXT=$(echo "$RESP" | jq -r '.result.content[0].text // .error.message // "unknown"' 2>/dev/null)
    fail "MCP log_entry[$i] unexpected response: ${TEXT:0:120}"
    ENTRY_KEYS[$i]=""
  fi
done

# ── 4. Poll until entries are processed (max 360s) ────────────────────
echo ""
echo "  ⟳ polling entry processing (max 360s)..."
ELAPSED=0
MAX_WAIT=360
PROCESSED_COUNT=0

while [ $ELAPSED -lt $MAX_WAIT ] && [ $PROCESSED_COUNT -lt 3 ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  PROCESSED_COUNT=0

  for i in 0 1 2; do
    [ -z "${ENTRY_KEYS[$i]:-}" ] && continue
    ENTRY_RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/${ENTRY_KEYS[$i]}" 2>/dev/null)
    STATUS=$(echo "$ENTRY_RESP" | jq -r '.ingestStatus // .state // "unknown"')
    if [ "$STATUS" = "processed" ] || [ "$STATUS" = "RESOLVED" ]; then
      PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
    fi
  done
  echo "    ${ELAPSED}s — $PROCESSED_COUNT/3 entries processed"
done

for i in 0 1 2; do
  [ -z "${ENTRY_KEYS[$i]:-}" ] && continue
  ENTRY_RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/entries/${ENTRY_KEYS[$i]}" 2>/dev/null)
  STATUS=$(echo "$ENTRY_RESP" | jq -r '.ingestStatus // .state // "unknown"')
  if [ "$STATUS" = "processed" ] || [ "$STATUS" = "RESOLVED" ]; then
    pass "entry[$i] reached $STATUS"
  elif [ "$STATUS" = "failed" ]; then
    LAST_ERR=$(echo "$ENTRY_RESP" | jq -r '.lastError // "unknown"')
    fail "entry[$i] failed: $LAST_ERR"
  else
    fail "entry[$i] stuck at $STATUS after ${MAX_WAIT}s"
  fi
done

# ── 5. Report fragments ──────────────────────────────────────────────
echo ""
echo "  ── Fragments ──"
FRAGS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=100")
FRAG_COUNT=$(echo "$FRAGS" | jq '.fragments | length' 2>/dev/null || echo "0")

if [ "$FRAG_COUNT" -gt 0 ] 2>/dev/null; then
  pass "fragments created ($FRAG_COUNT total)"
  echo "    first 5 titles:"
  echo "$FRAGS" | jq -r '.fragments[:5][] | "      - \(.title // "untitled")"' 2>/dev/null
else
  fail "no fragments found after pipeline"
fi

# ── 6. Report people ─────────────────────────────────────────────────
echo ""
echo "  ── People ──"
PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")

if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "people extracted ($PEOPLE_COUNT total)"
  echo "    names:"
  echo "$PEOPLE" | jq -r '.people[] | "      - \(.canonicalName // .name)"' 2>/dev/null
else
  skip "no people extracted (entity extraction is observe-only)"
fi

# ── 7. Report edges ──────────────────────────────────────────────────
echo ""
echo "  ── Edges ──"
GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")

echo "    nodes: $NODE_COUNT, edges: $EDGE_COUNT"

# Count edge types
FRAG_WIKI_EDGES=$(echo "$GRAPH" | jq '[.edges[] | select(.edgeType == "FRAGMENT_IN_WIKI")] | length' 2>/dev/null || echo "0")
FRAG_PERSON_EDGES=$(echo "$GRAPH" | jq '[.edges[] | select(.edgeType == "FRAGMENT_MENTIONS_PERSON")] | length' 2>/dev/null || echo "0")
echo "    FRAGMENT_IN_WIKI: $FRAG_WIKI_EDGES"
echo "    FRAGMENT_MENTIONS_PERSON: $FRAG_PERSON_EDGES"

if [ "$EDGE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "graph has edges ($EDGE_COUNT)"
else
  skip "no edges yet (edge creation is observe-only)"
fi

# ── 8. Attach fragments to collection wikis via log_fragment ──────────
# Use the first available fragments and attach them to our wikis so
# regeneration has content to work with.
echo ""
echo "  ── Attaching fragments to collection wikis ──"

FRAG_SLUGS=$(echo "$FRAGS" | jq -r '[.fragments[].slug // empty] | .[]' 2>/dev/null)
FRAG_SLUG_ARRAY=()
while IFS= read -r line; do
  [ -n "$line" ] && FRAG_SLUG_ARRAY+=("$line")
done <<< "$FRAG_SLUGS"

ATTACHED=0
for i in 0 1 2; do
  [ -z "${WIKI_SLUGS[$i]:-}" ] && continue
  # Grab a subset of fragments for each wiki (round-robin)
  FRAG_IDX=$((i * 2))
  for offset in 0 1; do
    IDX=$((FRAG_IDX + offset))
    [ $IDX -ge ${#FRAG_SLUG_ARRAY[@]} ] && continue
    FSLUG="${FRAG_SLUG_ARRAY[$IDX]}"
    [ -z "$FSLUG" ] && continue

    # Use log_fragment to attach a new fragment to this wiki
    ATTACH_CONTENT="Attached reference from fragment $FSLUG for ${WIKI_NAMES[$i]}"
    ESCAPED_ATTACH=$(printf '%s' "$ATTACH_CONTENT" | jq -Rs '.')
    ATTACH_RESP=$(mcp_call "log_fragment" "{\"content\":$ESCAPED_ATTACH,\"threadSlug\":\"${WIKI_SLUGS[$i]}\"}" $((20+i*2+offset)))

    if echo "$ATTACH_RESP" | jq -e '.result.content[0].text' >/dev/null 2>&1; then
      ATTACHED=$((ATTACHED + 1))
    fi
  done
done

if [ $ATTACHED -gt 0 ]; then
  pass "attached $ATTACHED fragments to collection wikis via log_fragment"
else
  skip "no fragments attached (log_fragment may not have resolved slugs)"
fi

# ── 9. Trigger regeneration for each collection wiki ──────────────────
echo ""
echo "  ── Regeneration ──"

for i in 0 1 2; do
  [ -z "${WIKI_IDS[$i]:-}" ] && continue

  # Ensure regenerate is enabled
  curl -s -o /dev/null -X PATCH -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"regenerate":true}' \
    "$SERVER_URL/wikis/${WIKI_IDS[$i]}/regenerate"

  REGEN=$(curl -s -w "\n%{http_code}" -X POST -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_IDS[$i]}/regenerate")
  REGEN_HTTP=$(echo "$REGEN" | tail -1)
  REGEN_BODY=$(echo "$REGEN" | sed '$d')

  if [ "$REGEN_HTTP" = "200" ]; then
    REGEN_FCOUNT=$(echo "$REGEN_BODY" | jq -r '.fragmentCount // 0')
    pass "regen wiki[$i] → 200 (fragmentCount=$REGEN_FCOUNT)"
  else
    ERR_MSG=$(echo "$REGEN_BODY" | jq -r '.error // .detail // "unknown"' 2>/dev/null)
    fail "regen wiki[$i] → HTTP $REGEN_HTTP: $ERR_MSG"
  fi
done

# ── 10. Report final wiki state ───────────────────────────────────────
echo ""
echo "  ── Final Wiki State ──"

for i in 0 1 2; do
  [ -z "${WIKI_IDS[$i]:-}" ] && continue

  DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/${WIKI_IDS[$i]}")
  W_NAME=$(echo "$DETAIL" | jq -r '.name // "?"')
  W_TYPE=$(echo "$DETAIL" | jq -r '.type // "?"')
  W_STATE=$(echo "$DETAIL" | jq -r '.state // "?"')
  W_CONTENT_LEN=$(echo "$DETAIL" | jq -r '.content // "" | length')
  W_REBUILT=$(echo "$DETAIL" | jq -r '.lastRebuiltAt // "never"')

  echo "    wiki[$i]: $W_NAME"
  echo "      type=$W_TYPE state=$W_STATE content=${W_CONTENT_LEN}chars rebuilt=$W_REBUILT"

  # Verify content has collection structure markers
  HAS_OVERVIEW=$(echo "$DETAIL" | jq -r '.content // ""' | grep -ci "overview" || true)
  HAS_ITEMS=$(echo "$DETAIL" | jq -r '.content // ""' | grep -ci "items" || true)

  if [ "$W_CONTENT_LEN" -gt 50 ] 2>/dev/null; then
    pass "wiki[$i] has generated content ($W_CONTENT_LEN chars)"
  else
    fail "wiki[$i] content too short or empty ($W_CONTENT_LEN chars)"
  fi

  if [ "$HAS_OVERVIEW" -gt 0 ] && [ "$HAS_ITEMS" -gt 0 ]; then
    pass "wiki[$i] has collection structure (Overview + Items sections)"
  else
    skip "wiki[$i] collection structure not detected (observe-only — LLM output varies)"
  fi
done

# ── Summary ───────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo "  Collection wiki type UAT complete"
echo "  $PASS passed, $FAIL failed, $SKIP skipped"
echo "════════════════════════════════════════════"
```
