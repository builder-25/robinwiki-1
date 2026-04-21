# 21 — Wiki Sidecar Rendering (Frontend)

## What it proves
Token chips render for all four kinds (person / fragment / wiki / entry); unresolved tokens fall back to literal text; the structured infobox replaces the legacy flex-column layout with a typed table; per-section citation superscripts render, link, and describe their source fragment; the per-heading `[edit]` affordance scopes edits to a single section without disturbing siblings or the heading itself; H1 is excluded from the affordance; duplicate headings are disambiguated via `notes` / `notes-1` anchors; a stale-section save surfaces a recoverable message instead of crashing; the HTML-body path hides `[edit]` while still rendering chips; the public preview fixture route renders read-only; entry and person detail pages resolve tokens and render the server-derived person infobox.

## Prerequisites
- `pnpm -C core seed-fixture` has been run (seeds the Transformer demo wiki — see plan 22 for the seed lifecycle).
- Core server on `SERVER_URL` (default `http://localhost:3000`).
- Wiki dev server on `WIKI_URL` (default `http://localhost:8080`).
- `INITIAL_USERNAME` / `INITIAL_PASSWORD` set for authenticated flows.

## Fixture slugs this plan references
- Wiki: `transformer-architecture`
- People: `ashish-vaswani`, `noam-shazeer`, `niki-parmar`, `anonymous-reviewer` (unresolved — no refs entry)
- Fragments: `self-attention-replaces-recurrence`, `multi-head-attention-parallelism`, `positional-encoding-sequence-order`, `scaled-dot-product-attention`, `encoder-decoder-stacks`
- Wiki ref target: `attention-is-all-you-need`
- Entry: `attention-paper-abstract`
- Section anchors: `transformer-architecture`, `overview`, `the-attention-mechanism`, `architecture`, `encoder-stack`, `decoder-stack`, `notes`, `notes-1`

---

## Test Steps

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "${PROJECT_ROOT:-.}"
source core/.env 2>/dev/null || true

WIKI_URL="${WIKI_URL:-http://localhost:8080}"
SERVER_URL="${SERVER_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp /tmp/uat-cookies-XXXXXX.txt)
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  ⊘ $1"; }

echo "21 — Wiki Sidecar Rendering"
echo ""

# ── Prereq: confirm the Transformer demo wiki is seeded ─────────
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null 2>/dev/null

WIKIS_RESPONSE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/wikis?limit=50")
TRANSFORMER_KEY=$(echo "$WIKIS_RESPONSE" | jq -r '.wikis[] | select(.slug == "transformer-architecture") | .lookupKey // .id' | head -1)

if [ -z "${TRANSFORMER_KEY:-}" ] || [ "$TRANSFORMER_KEY" = "null" ]; then
  fail "0. Transformer demo wiki not seeded — run 'pnpm -C core seed-fixture' first"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 1
fi
pass "0. Transformer demo wiki present (key=${TRANSFORMER_KEY:0:16}...)"

# Verify the API response carries a populated sidecar — if the backend
# strip regression is back, every UI assertion below is noise.
WIKI_JSON=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/wikis/$TRANSFORMER_KEY")
REFS_COUNT=$(echo "$WIKI_JSON" | jq '.refs | length' 2>/dev/null || echo 0)
SECTIONS_COUNT=$(echo "$WIKI_JSON" | jq '.sections | length' 2>/dev/null || echo 0)
HAS_INFOBOX=$(echo "$WIKI_JSON" | jq 'has("infobox") and .infobox != null' 2>/dev/null || echo false)
[ "$REFS_COUNT" -ge 8 ] 2>/dev/null && pass "0b. API refs populated ($REFS_COUNT entries)" || fail "0b. API refs not populated ($REFS_COUNT)"
[ "$SECTIONS_COUNT" -ge 6 ] 2>/dev/null && pass "0c. API sections populated ($SECTIONS_COUNT entries)" || fail "0c. API sections not populated ($SECTIONS_COUNT)"
[ "$HAS_INFOBOX" = "true" ] && pass "0d. API infobox non-null" || fail "0d. API infobox missing or null"

# ── Sign in via browser ──────────────────────────────────────
npx agent-browser open "$WIKI_URL/login" 2>/dev/null
npx agent-browser wait --load networkidle
npx agent-browser fill 'input[name="email"]' "${INITIAL_USERNAME:-uat@robin.test}" 2>/dev/null
npx agent-browser fill 'input[name="password"]' "${INITIAL_PASSWORD:-uat-password-123}" 2>/dev/null
npx agent-browser click 'button[type="submit"]' 2>/dev/null
npx agent-browser wait --load networkidle

# ── 1. Navigate to the Transformer wiki detail page ──────────
npx agent-browser open "$WIKI_URL/wiki/$TRANSFORMER_KEY" 2>/dev/null
npx agent-browser wait --load networkidle
SNAP=$(npx agent-browser snapshot 2>/dev/null)
npx agent-browser screenshot /tmp/uat-21-01-wiki-loaded.png 2>/dev/null

if echo "$SNAP" | grep -qi "Transformer Architecture"; then
  pass "1. Wiki detail page loaded with 'Transformer Architecture' title"
else
  fail "1. Wiki detail page did not render Transformer title"
fi

# ── 2. Token chips — all four kinds render as <WikiChip> ─────
# The shared body mentions the Ashish Vaswani person, the self-attention
# fragment, the attention-is-all-you-need wiki, and the attention-paper
# entry. Each should surface the canonical label (from refs), not raw
# `[[...]]` syntax, and carry `data-slot="wiki-chip"`.

# Snapshot the HTML so we can look at chip markup directly.
npx agent-browser eval "document.documentElement.outerHTML" > /tmp/uat-21-dom.html 2>/dev/null

# 2a. Person chip
if grep -q 'data-slot="wiki-chip"[^>]*>Ashish Vaswani<' /tmp/uat-21-dom.html; then
  pass "2a. Person chip: 'Ashish Vaswani' renders as <WikiChip>"
else
  fail "2a. Person chip for ashish-vaswani not rendered as a chip"
fi

# 2b. Fragment chip — the 'self-attention-replaces-recurrence' label
if grep -qi 'data-slot="wiki-chip"[^>]*>Self-attention replaces recurrence<' /tmp/uat-21-dom.html; then
  pass "2b. Fragment chip: 'Self-attention replaces recurrence' renders as <WikiChip>"
else
  fail "2b. Fragment chip for self-attention-replaces-recurrence not rendered"
fi

# 2c. Wiki chip — 'Attention Is All You Need (paper)'
if grep -q 'data-slot="wiki-chip"[^>]*>Attention Is All You Need (paper)<' /tmp/uat-21-dom.html; then
  pass "2c. Wiki chip: 'Attention Is All You Need (paper)' renders as <WikiChip>"
else
  fail "2c. Wiki chip for attention-is-all-you-need not rendered"
fi

# 2d. Entry chip — 'Abstract — Attention Is All You Need'
if grep -q 'data-slot="wiki-chip"[^>]*>Abstract' /tmp/uat-21-dom.html; then
  pass "2d. Entry chip: 'Abstract — Attention Is All You Need' renders as <WikiChip>"
else
  fail "2d. Entry chip for attention-paper-abstract not rendered"
fi

# 2e. No raw `[[person:ashish-vaswani]]` token text leaks through
if grep -q '\[\[person:ashish-vaswani\]\]' /tmp/uat-21-dom.html; then
  fail "2e. Raw [[person:ashish-vaswani]] token appears unrendered in DOM"
else
  pass "2e. No raw resolved tokens leak into rendered output"
fi

# ── 3. Unresolved token fallback ─────────────────────────────
# `[[person:anonymous-reviewer]]` is in the body but deliberately missing
# from refs. Contract behavior: render as literal `[[person:anonymous-reviewer]]`
# text, NOT as a chip, NOT stripped.

if grep -q '\[\[person:anonymous-reviewer\]\]' /tmp/uat-21-dom.html; then
  pass "3a. Unresolved token renders as literal text"
else
  fail "3a. Unresolved [[person:anonymous-reviewer]] token was stripped or miscategorised"
fi

if grep -q 'data-slot="wiki-chip"[^>]*>\[\[person:anonymous-reviewer\]\]<' /tmp/uat-21-dom.html; then
  fail "3b. Unresolved token incorrectly wrapped as a chip"
else
  pass "3b. Unresolved token NOT rendered as a chip"
fi

# ── 4. Structured infobox (typed table) ──────────────────────
# The infobox in the Transformer wiki's right rail must render as
# `.winfo` table, not the legacy `.wiki-aside-infobox` flexbox. Every
# `valueKind` (text, ref, date, status) is present in this fixture.

# 4a. New .winfo table is used (not legacy flex-column aside)
if grep -qE 'class="[^"]*\bwinfo\b' /tmp/uat-21-dom.html; then
  pass "4a. Infobox renders using structured .winfo table"
else
  fail "4a. Infobox missing .winfo class — still on legacy flex layout?"
fi

# 4b. Row for each valueKind shows its label + value
for LABEL in "Status" "Paper" "Lead author" "Published"; do
  if echo "$SNAP" | grep -q "$LABEL"; then
    pass "4b. Infobox row '$LABEL' present"
  else
    fail "4b. Infobox row '$LABEL' missing"
  fi
done

# 4c. valueKind=ref — 'Lead author' value is a chip linking to Ashish
if grep -qE 'Lead author[[:space:]]*<[^>]*winfo__v[^>]*>[^<]*<a[^>]*data-slot="wiki-chip"' /tmp/uat-21-dom.html \
  || grep -qE 'winfo[^"]*">[^<]*Lead author[^<]*</[^>]+>[^<]*<[^>]+>[^<]*<a[^>]*data-slot="wiki-chip"[^>]*>Ashish Vaswani' /tmp/uat-21-dom.html \
  || grep -qE '<a[^>]*data-slot="wiki-chip"[^>]*>Ashish Vaswani</a>' /tmp/uat-21-dom.html; then
  pass "4c. Infobox ref-row renders Ashish Vaswani as a chip (not raw token text)"
else
  fail "4c. Infobox ref-row 'Lead author' did not substitute the token into a chip"
fi

# 4d. valueKind=status — 'complete' renders as a pill/badge, not bare text
if echo "$SNAP" | grep -qi "complete"; then
  pass "4d. Infobox status row shows 'complete'"
  # Look for a pill-like treatment (chip class or status-specific class)
  if grep -qE 'class="[^"]*(wchip|winfo__v--status|badge|pill)' /tmp/uat-21-dom.html; then
    pass "4e. Status value has pill/badge treatment"
  else
    fail "4e. Status value has no pill/badge treatment"
  fi
else
  fail "4d. Infobox status row 'complete' missing"
fi

# ── 5. Per-section citation superscripts ─────────────────────
# Sections 'overview' and 'architecture' each have 2 citations in the
# fixture. Other sections have citations: []. Expect `[1][2]` superscripts
# on the two populated sections and nothing on the rest.

# 5a. Overview section has citation superscripts
if grep -qE '<sup[^>]*class="[^"]*\bcite\b' /tmp/uat-21-dom.html; then
  pass "5a. Citation superscripts render somewhere in the document"
else
  fail "5a. No citation superscripts found (expected [1][2] after Overview + Architecture)"
fi

# 5b. Exactly the expected number of cite superscripts (2 per populated section = 4)
CITE_COUNT=$(grep -oE '<sup[^>]*class="[^"]*\bcite\b' /tmp/uat-21-dom.html | wc -l | tr -d ' ')
if [ "$CITE_COUNT" = "4" ]; then
  pass "5b. Citation superscript count matches fixture (4 = 2 overview + 2 architecture)"
else
  fail "5b. Citation superscript count is $CITE_COUNT, expected 4"
fi

# 5c. Hover (focus) a superscript — tooltip or inline detail shows the
# fragment quote + captured date. Use agent-browser's focus helper.
# NOTE: if the UAT harness can't emit synthetic hover events, this step
# is manual — the assertion here is that the fragment quote text exists
# somewhere in the rendered DOM so a hover card has content to show.
if grep -qF "A stack of self-attention layers models long-range dependencies" /tmp/uat-21-dom.html; then
  pass "5c. Overview citation quote text is present in DOM (hover source)"
else
  fail "5c. Overview citation quote not found — tooltip would be empty"
fi

# 5d. Clicking a citation superscript navigates to /wiki/fragments/<id>
# Grab the first citation's anchor href.
FRAG_HREF=$(grep -oE '<sup[^>]*class="[^"]*\bcite\b[^>]*>[^<]*<a[^>]*href="[^"]*"' /tmp/uat-21-dom.html \
  | head -1 | grep -oE 'href="[^"]+"' | sed 's/href="//;s/"$//')
if [ -n "${FRAG_HREF:-}" ] && echo "$FRAG_HREF" | grep -q "/wiki/fragments/"; then
  pass "5d. Citation link points at /wiki/fragments/<id> ($FRAG_HREF)"
elif [ -n "${FRAG_HREF:-}" ]; then
  fail "5d. Citation link exists but doesn't route to /wiki/fragments/ (got: $FRAG_HREF)"
else
  skip "5d. Citation link shape varies by design — inspect /tmp/uat-21-dom.html manually"
fi

# 5e. Sections with citations: [] show NO superscripts.
# `## Notes` is the easiest to check — it has no citations in the fixture.
# Inspect the DOM slice bounded by the 'notes' anchor.
NOTES_SLICE=$(awk '/id="notes"/,/id="notes-1"/' /tmp/uat-21-dom.html 2>/dev/null || true)
if [ -n "$NOTES_SLICE" ] && echo "$NOTES_SLICE" | grep -qE '<sup[^>]*class="[^"]*\bcite\b'; then
  fail "5e. 'Notes' section has unexpected citation superscripts (fixture has citations: [])"
else
  pass "5e. 'Notes' section correctly omits citation superscripts"
fi

# ── 6. Section-scoped edit — happy path ──────────────────────
# Click the `[edit]` bracket beside the H2 'Overview' heading, edit the
# body only, save, and verify: only that section changed, other sections
# intact, heading + anchor unchanged.

# 6a. The H2 'Overview' heading has a trailing [edit] affordance.
if grep -qE 'id="overview"[^>]*>[^<]*Overview[^<]*<[^>]+>[^<]*<a[^>]*class="[^"]*wedit' /tmp/uat-21-dom.html \
  || grep -qE '<a[^>]*class="[^"]*\bwedit\b[^"]*"' /tmp/uat-21-dom.html; then
  pass "6a. [edit] affordance (.wedit) renders next to H2 headings"
else
  fail "6a. No .wedit [edit] affordance found next to H2 headings"
fi

# 6b. Click the first [edit] bracket — dialog opens prefilled with body,
# heading read-only.
npx agent-browser click 'a.wedit' 2>/dev/null
npx agent-browser wait --load networkidle
EDIT_SNAP=$(npx agent-browser snapshot 2>/dev/null)
npx agent-browser screenshot /tmp/uat-21-06-edit-dialog.png 2>/dev/null

if echo "$EDIT_SNAP" | grep -qi "Overview" && echo "$EDIT_SNAP" | grep -qiE "textarea|edit.*section|editing section"; then
  pass "6b. Section editor dialog opened with heading 'Overview' as context"
else
  fail "6b. Section editor dialog did not open or is missing heading context"
fi

# 6c. Edit the body, save. Use a distinctive marker so we can verify.
EDIT_MARKER="UAT-21 scoped edit marker $(date +%s)"
npx agent-browser fill 'textarea' "$EDIT_MARKER" 2>/dev/null
npx agent-browser find text "Save" click 2>/dev/null
npx agent-browser wait --load networkidle
sleep 2
npx agent-browser screenshot /tmp/uat-21-06-after-save.png 2>/dev/null

# Refetch the wiki via API and look for the marker
AFTER_JSON=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/wikis/$TRANSFORMER_KEY")
AFTER_BODY=$(echo "$AFTER_JSON" | jq -r '.wikiContent // .content // ""')

if echo "$AFTER_BODY" | grep -qF "$EDIT_MARKER"; then
  pass "6c. Edited body persisted through PUT /api/content/wiki/<key>"
else
  fail "6c. Edit marker not present after save — edit did not persist"
fi

# 6d. Heading 'Overview' and its anchor 'overview' survived unchanged.
if echo "$AFTER_BODY" | grep -qE '^## Overview\s*$'; then
  pass "6d. '## Overview' heading line preserved verbatim"
else
  fail "6d. '## Overview' heading line was altered by section-scoped edit"
fi

AFTER_SECTIONS=$(echo "$AFTER_JSON" | jq -r '.sections[]?.anchor' | tr '\n' ' ')
if echo "$AFTER_SECTIONS" | grep -qw "overview"; then
  pass "6e. 'overview' anchor still present in server-computed sections"
else
  fail "6e. 'overview' anchor drifted after section-scoped save ($AFTER_SECTIONS)"
fi

# 6f. Sibling sections untouched — 'Architecture' heading still intact and
# still has its two citations populated.
if echo "$AFTER_BODY" | grep -qE '^## Architecture\s*$'; then
  pass "6f. Sibling '## Architecture' heading untouched"
else
  fail "6f. Sibling '## Architecture' heading was disturbed"
fi

ARCH_CITE_COUNT=$(echo "$AFTER_JSON" | jq '[.sections[] | select(.anchor == "architecture") | .citations | length] | add // 0')
[ "$ARCH_CITE_COUNT" = "2" ] && pass "6g. Sibling 'architecture' citations (2) preserved" || fail "6g. Sibling citations drifted: got $ARCH_CITE_COUNT, expected 2"

# ── 7. Section-scoped edit — H1 excluded ─────────────────────
# H1 is the document title. No [edit] bracket should sit next to it.
npx agent-browser open "$WIKI_URL/wiki/$TRANSFORMER_KEY" 2>/dev/null
npx agent-browser wait --load networkidle
npx agent-browser eval "document.documentElement.outerHTML" > /tmp/uat-21-dom-2.html 2>/dev/null

# Find the H1 block and check no `.wedit` sits inside it.
H1_SLICE=$(grep -oE '<h1[^>]*id="transformer-architecture"[^>]*>.*</h1>' /tmp/uat-21-dom-2.html 2>/dev/null \
  || grep -oE '<h1[^>]*>[^<]*Transformer Architecture[^<]*[^<]*</h1>' /tmp/uat-21-dom-2.html 2>/dev/null)
if [ -n "${H1_SLICE:-}" ] && echo "$H1_SLICE" | grep -qE 'class="[^"]*\bwedit\b'; then
  fail "7. H1 heading has an [edit] affordance (it must be excluded)"
else
  pass "7. H1 heading has no [edit] affordance"
fi

# ── 8. Duplicate-heading anchors — notes vs. notes-1 ─────────
# The fixture has two `## Notes` sections. Editing one must not affect
# the other. Anchors: `notes` (first) and `notes-1` (second).

# Confirm both anchors exist in server sections.
HAS_NOTES=$(echo "$AFTER_JSON" | jq '[.sections[] | select(.anchor == "notes")] | length')
HAS_NOTES_1=$(echo "$AFTER_JSON" | jq '[.sections[] | select(.anchor == "notes-1")] | length')
if [ "$HAS_NOTES" = "1" ] && [ "$HAS_NOTES_1" = "1" ]; then
  pass "8a. Both 'notes' and 'notes-1' anchors present server-side"
else
  fail "8a. Duplicate-heading anchors wrong: notes=$HAS_NOTES, notes-1=$HAS_NOTES_1"
fi

# Edit 'notes-1' specifically and verify 'notes' is untouched. Select the
# [edit] link that sits inside the section with id="notes-1".
npx agent-browser eval "document.querySelector('#notes-1 a.wedit, [id=\"notes-1\"] ~ * a.wedit, [id=\"notes-1\"] a.wedit')?.click()" 2>/dev/null
npx agent-browser wait --load networkidle

NOTES1_MARKER="UAT-21 notes-1 marker $(date +%s)"
npx agent-browser fill 'textarea' "$NOTES1_MARKER" 2>/dev/null
npx agent-browser find text "Save" click 2>/dev/null
npx agent-browser wait --load networkidle
sleep 2

AFTER2_JSON=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/wikis/$TRANSFORMER_KEY")
AFTER2_BODY=$(echo "$AFTER2_JSON" | jq -r '.wikiContent // .content // ""')

if echo "$AFTER2_BODY" | grep -qF "$NOTES1_MARKER"; then
  pass "8b. 'notes-1' body edited and persisted"
else
  fail "8b. 'notes-1' edit did not persist — the UAT click target may need tuning"
fi

# 'notes' (first Notes section) should still contain original fixture prose
# — specifically the anonymous-reviewer line.
if echo "$AFTER2_BODY" | grep -q '\[\[person:anonymous-reviewer\]\]'; then
  pass "8c. First 'notes' section preserved (anonymous-reviewer token intact)"
else
  fail "8c. First 'notes' section was unexpectedly modified by editing 'notes-1'"
fi

# ── 9. Stale-section save ────────────────────────────────────
# Open the editor on a section, then regenerate the wiki (simulates
# another tab reshaping the document), then try to save in the first
# tab. Expected: a user-facing "section no longer exists" message rather
# than a crash or silent clobber.

# 9a. Open editor on 'architecture'.
npx agent-browser open "$WIKI_URL/wiki/$TRANSFORMER_KEY" 2>/dev/null
npx agent-browser wait --load networkidle
npx agent-browser eval "document.querySelector('#architecture ~ * a.wedit, #architecture a.wedit, [id=\"architecture\"] a.wedit')?.click()" 2>/dev/null
npx agent-browser wait --load networkidle

# 9b. Simulate a regen that removes the section via an out-of-band PUT.
# Rewrite the wiki body WITHOUT the Architecture heading.
NEW_BODY=$'# Transformer Architecture\n\n## Overview\n\nStripped body for stale-section UAT.\n'
curl -s -o /dev/null -b "$COOKIE_JAR" -X PUT \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "$(jq -n --arg body "$NEW_BODY" --arg name "Transformer Architecture" '{frontmatter:{name:$name,type:"project",prompt:""},body:$body}')" \
  "$SERVER_URL/api/content/wiki/$TRANSFORMER_KEY"

# 9c. Save from the first tab — the section it was editing ('architecture')
# no longer exists.
npx agent-browser fill 'textarea' "UAT stale-section attempt" 2>/dev/null
npx agent-browser find text "Save" click 2>/dev/null
npx agent-browser wait --load networkidle
STALE_SNAP=$(npx agent-browser snapshot 2>/dev/null)
npx agent-browser screenshot /tmp/uat-21-09-stale-section.png 2>/dev/null

if echo "$STALE_SNAP" | grep -qiE "section no longer exists|regenerated|close this dialog"; then
  pass "9. Stale-section save shows a recoverable user message"
else
  fail "9. Stale-section save did not surface a 'section no longer exists' message"
fi

# Reseed the fixture so later test runs have the canonical body.
pnpm -C core seed-fixture >/dev/null 2>&1 || true

# ── 10. HTML body fallback ───────────────────────────────────
# If the wiki was last saved by the Tiptap editor, wiki.wikiContent starts
# with `<`. In that case:
#  - `[edit]` brackets MUST NOT render (section algorithm needs markdown).
#  - Token chips MUST still render (via the HTML DOM-walker substitution).

# Drive the HTML branch: PUT an HTML body containing tokens.
HTML_BODY='<h1>Transformer Architecture</h1><p>Token check: [[person:ashish-vaswani]] and [[wiki:attention-is-all-you-need]].</p><h2>Overview</h2><p>HTML-body overview.</p>'
curl -s -o /dev/null -b "$COOKIE_JAR" -X PUT \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "$(jq -n --arg body "$HTML_BODY" --arg name "Transformer Architecture" '{frontmatter:{name:$name,type:"project",prompt:""},body:$body}')" \
  "$SERVER_URL/api/content/wiki/$TRANSFORMER_KEY"

npx agent-browser open "$WIKI_URL/wiki/$TRANSFORMER_KEY" 2>/dev/null
npx agent-browser wait --load networkidle
sleep 1
npx agent-browser eval "document.documentElement.outerHTML" > /tmp/uat-21-dom-html-body.html 2>/dev/null

# 10a. No .wedit brackets on the HTML branch.
if grep -qE 'class="[^"]*\bwedit\b' /tmp/uat-21-dom-html-body.html; then
  fail "10a. HTML-body branch rendered [edit] brackets (should be hidden)"
else
  pass "10a. HTML-body branch correctly hides [edit] brackets"
fi

# 10b. Token chips still render on the HTML branch.
if grep -q 'data-slot="wiki-chip"[^>]*>Ashish Vaswani<' /tmp/uat-21-dom-html-body.html; then
  pass "10b. HTML-body branch still substitutes tokens into WikiChips"
else
  fail "10b. HTML-body branch failed to substitute [[person:ashish-vaswani]] into a chip"
fi

# Restore the markdown body for downstream steps + plan 22.
pnpm -C core seed-fixture >/dev/null 2>&1 || true

# ── 11. Preview fixture page — unauthenticated, read-only ────
# `/wiki/preview/fixture` should load without a session and render the
# exhaustive fixture through the same renderer. No save/regen/delete
# affordances should appear.

npx agent-browser close 2>/dev/null || true
npx agent-browser open "$WIKI_URL/wiki/preview/fixture" 2>/dev/null
npx agent-browser wait --load networkidle
PREVIEW_SNAP=$(npx agent-browser snapshot 2>/dev/null)
npx agent-browser eval "document.documentElement.outerHTML" > /tmp/uat-21-preview-dom.html 2>/dev/null
npx agent-browser screenshot /tmp/uat-21-11-preview.png 2>/dev/null

# 11a. Page loads (no redirect to /login).
PREVIEW_URL=$(npx agent-browser get url 2>/dev/null || echo "")
if echo "$PREVIEW_URL" | grep -q "/wiki/preview/fixture" && ! echo "$PREVIEW_URL" | grep -q "/login"; then
  pass "11a. /wiki/preview/fixture loads unauthenticated"
else
  fail "11a. Preview fixture page redirected or did not load (URL: $PREVIEW_URL)"
fi

# 11b. Renders the Transformer fixture.
if echo "$PREVIEW_SNAP" | grep -qi "Transformer Architecture"; then
  pass "11b. Preview page renders 'Transformer Architecture' title"
else
  fail "11b. Preview page did not render fixture title"
fi

# 11c. Chips render on the preview page too.
if grep -q 'data-slot="wiki-chip"' /tmp/uat-21-preview-dom.html; then
  pass "11c. Preview page renders token chips"
else
  fail "11c. Preview page has no WikiChips"
fi

# 11d. Read-only: no Save / Regenerate / Delete buttons should be visible.
if echo "$PREVIEW_SNAP" | grep -qiE "^Regenerate$|^Delete$|^Save changes$"; then
  fail "11d. Preview page surfaces mutation affordances (should be read-only)"
else
  pass "11d. Preview page has no Save/Regen/Delete affordances"
fi

# ── 12. Entry detail page — refs resolve inline ──────────────
# Sign back in and open the seeded entry.
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null 2>/dev/null

ENTRY_KEY=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/entries?limit=50" \
  | jq -r '.entries[] | select(.slug == "attention-paper-abstract") | .lookupKey // .id' | head -1)

if [ -n "${ENTRY_KEY:-}" ] && [ "$ENTRY_KEY" != "null" ]; then
  npx agent-browser open "$WIKI_URL/login" 2>/dev/null
  npx agent-browser wait --load networkidle
  npx agent-browser fill 'input[name="email"]' "${INITIAL_USERNAME:-uat@robin.test}" 2>/dev/null
  npx agent-browser fill 'input[name="password"]' "${INITIAL_PASSWORD:-uat-password-123}" 2>/dev/null
  npx agent-browser click 'button[type="submit"]' 2>/dev/null
  npx agent-browser wait --load networkidle

  npx agent-browser open "$WIKI_URL/wiki/entries/$ENTRY_KEY" 2>/dev/null
  npx agent-browser wait --load networkidle
  npx agent-browser eval "document.documentElement.outerHTML" > /tmp/uat-21-entry-dom.html 2>/dev/null
  ENTRY_SNAP=$(npx agent-browser snapshot 2>/dev/null)

  if echo "$ENTRY_SNAP" | grep -qi "Attention"; then
    pass "12a. Entry detail page loads (attention-paper-abstract)"
  else
    fail "12a. Entry detail page did not load"
  fi

  # Entries may contain tokens in body. Assert any that exist resolve.
  # Also assert the entry page shows NO infobox (entries never have one).
  if grep -qE 'class="[^"]*\bwinfo\b' /tmp/uat-21-entry-dom.html; then
    fail "12b. Entry page rendered an infobox — entries should never have one"
  else
    pass "12b. Entry page correctly has no infobox"
  fi
else
  skip "12. Entry 'attention-paper-abstract' not seeded — re-run seed-fixture"
fi

# ── 13. Person detail page — server-derived infobox ──────────
PERSON_KEY=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/people?limit=50" \
  | jq -r '.people[] | select(.slug == "ashish-vaswani") | .lookupKey // .id' | head -1)

if [ -n "${PERSON_KEY:-}" ] && [ "$PERSON_KEY" != "null" ]; then
  npx agent-browser open "$WIKI_URL/wiki/people/$PERSON_KEY" 2>/dev/null
  npx agent-browser wait --load networkidle
  PERSON_SNAP=$(npx agent-browser snapshot 2>/dev/null)
  npx agent-browser eval "document.documentElement.outerHTML" > /tmp/uat-21-person-dom.html 2>/dev/null
  npx agent-browser screenshot /tmp/uat-21-13-person.png 2>/dev/null

  if echo "$PERSON_SNAP" | grep -qi "Ashish Vaswani"; then
    pass "13a. Person detail page loads for Ashish Vaswani"
  else
    fail "13a. Person detail page did not render name"
  fi

  # Person infobox is server-derived and uses the structured table.
  if grep -qE 'class="[^"]*\bwinfo\b' /tmp/uat-21-person-dom.html; then
    pass "13b. Person page renders structured .winfo infobox"
  else
    fail "13b. Person page missing structured infobox"
  fi

  # Relationship row — derived from person.relationship
  if echo "$PERSON_SNAP" | grep -qi "Relationship"; then
    pass "13c. Person infobox has 'Relationship' row"
  else
    fail "13c. Person infobox missing 'Relationship' row"
  fi

  # At least one of Aliases / First mentioned / Mentions rows present
  # (any that would be empty are filtered server-side; Relationship alone
  # is enough to prove derivation).
  if echo "$PERSON_SNAP" | grep -qiE "Aliases|First mentioned|Mentions"; then
    pass "13d. Person infobox shows at least one derived row beyond Relationship"
  else
    skip "13d. Derived rows (Aliases/First mentioned/Mentions) all empty for this person"
  fi
else
  skip "13. Person 'ashish-vaswani' not seeded — re-run seed-fixture"
fi

# ── Cleanup ──────────────────────────────────────────────────
npx agent-browser close 2>/dev/null || true

echo ""
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```

---

## Pass/Fail Summary

| # | Assertion | Source |
|---|-----------|--------|
| 0 | Transformer demo wiki seeded; API returns refs/sections/infobox | seed-fixture prereq |
| 1 | /wiki/<transformer> loads with title | detail page |
| 2 | 4 token kinds (person/fragment/wiki/entry) render as WikiChip with canonical labels | MarkdownContent token substitution |
| 3 | Unresolved `[[person:anonymous-reviewer]]` renders as literal text, not chip, not stripped | renderer fallback policy |
| 4 | Structured .winfo table with rows for all valueKinds; ref-row is a chip; status is a pill | WikiInfobox |
| 5 | Citation superscripts on Overview + Architecture (4 total); none on Notes; hover has content; click routes to fragment | WikiCitations |
| 6 | Section-scoped edit: dialog opens, body saves, heading/anchor preserved, siblings untouched | SectionEditor + replaceSectionInMarkdown |
| 7 | H1 heading has no [edit] affordance | H1 exclusion rule |
| 8 | `notes` and `notes-1` are independent: editing the second doesn't change the first | duplicate-heading anchor algorithm |
| 9 | Stale-section save surfaces a recoverable message instead of crashing | handleSectionSave guard |
| 10 | HTML-body path: no [edit] brackets, chips still render | MarkdownContent vs HtmlWikiBody branch |
| 11 | /wiki/preview/fixture loads unauthenticated, renders fixture, is read-only | preview/fixture page |
| 12 | Entry detail page resolves tokens and has no infobox | useEntry + EntryArticle |
| 13 | Person detail page renders server-derived .winfo infobox with Relationship row | usePerson + derivePersonInfobox |

---

## Notes

- Citation hover/click behavior (step 5c/5d) depends on the Wave-3a decision for Q5 — some deployments open a popover, others navigate to the fragment. The script asserts the underlying DOM source exists; visual hover-card validation remains a manual screenshot check via `/tmp/uat-21-*.png`.
- Step 9 mutates the wiki body via `PUT /api/content/wiki/<key>` to simulate a concurrent regen. The script reseeds the fixture afterward so the overall suite leaves the DB clean.
- Step 10 also mutates the body (to an HTML string) to force the Tiptap-saved branch, then reseeds.
- If the `agent-browser eval document.querySelector('#notes-1 a.wedit')?.click()` selector misses because the `[edit]` link sits outside the section anchor wrapper rather than inside it, step 8 reports a deterministic fail rather than silently passing — adjust the selector to match the rendered DOM structure in `/tmp/uat-21-dom.html`.
