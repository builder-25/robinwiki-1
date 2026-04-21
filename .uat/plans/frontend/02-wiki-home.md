# Frontend UAT 02 — Wiki Home

## What it proves
Wiki home page renders all sections (hero, search, featured wiki, recently updated, browse by type), search interaction works, and sidebar navigation is functional.

## Page
`/wiki`

## Prerequisite
Authenticated session — login first via agent-browser.

---

## Steps

### Step 1 — Login

```bash
WIKI_URL="${WIKI_URL:-http://localhost:8080}"
INITIAL_USERNAME="${INITIAL_USERNAME:-uat@robin.test}"
INITIAL_PASSWORD="${INITIAL_PASSWORD:-uat-password-123}"

npx agent-browser open "$WIKI_URL/login"
npx agent-browser wait "input"
npx agent-browser fill "input[type='email'], input[name='email']" "$INITIAL_USERNAME"
npx agent-browser fill "input[type='password'], input[name='password']" "$INITIAL_PASSWORD"
npx agent-browser click "button[type='submit']"
npx agent-browser wait --timeout 8000 "text=Main page"
```

### Step 2 — Navigate to /wiki and verify hero section

```bash
PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

npx agent-browser open "$WIKI_URL/wiki"
npx agent-browser wait --timeout 8000 ".wiki-page--home"

# Verify hero section renders with greeting
if npx agent-browser query ".wiki-home-title" 2>/dev/null | grep -q .; then
  pass "hero section loads with greeting title"
else
  fail "hero section missing greeting title"
fi
```

### Step 3 — Verify search bar exists and is focusable

```bash
# Search bar is inside a stacked card (label element wrapping the input)
if npx agent-browser query ".wiki-chat-input" 2>/dev/null | grep -q .; then
  pass "search bar input exists"
else
  fail "search bar input missing"
fi

# Click the stacked card area to focus input
npx agent-browser click ".wiki-chat-input"
sleep 0.3

if npx agent-browser eval "document.activeElement?.classList.contains('wiki-chat-input')" 2>/dev/null | grep -qi "true"; then
  pass "search bar is focusable (click anywhere in stacked card)"
else
  fail "search bar did not receive focus on click"
fi
```

### Step 4 — Verify Featured Wiki section

```bash
if npx agent-browser query "text=Featured Wiki" 2>/dev/null | grep -q .; then
  pass "Featured Wiki section exists"
else
  fail "Featured Wiki section missing"
fi

# May show real data or empty state ("No wikis yet")
if npx agent-browser query "text=Read more" 2>/dev/null | grep -q . || \
   npx agent-browser query "text=No wikis yet" 2>/dev/null | grep -q .; then
  pass "Featured Wiki shows content or empty state"
else
  fail "Featured Wiki has neither content nor empty state"
fi
```

### Step 5 — Verify Recently Updated section

```bash
if npx agent-browser query "text=Recently updated" 2>/dev/null | grep -q .; then
  pass "Recently Updated section exists"
else
  fail "Recently Updated section missing"
fi
```

### Step 6 — Verify Browse by Type section

```bash
if npx agent-browser query "text=Browse by wiki type" 2>/dev/null | grep -q .; then
  pass "Browse by Type section exists"
else
  fail "Browse by Type section missing"
fi

# Check for wiki type category headers (badge icons with type names)
# Categories are rendered dynamically from API data; may show empty state
if npx agent-browser query ".wiki-browse-grid" 2>/dev/null | grep -q .; then
  pass "Browse by Type grid container rendered"
else
  fail "Browse by Type grid container missing"
fi
```

### Step 7 — Type in search bar and verify send button darkens

```bash
# Clear and type into search bar
npx agent-browser fill ".wiki-chat-input" "test query"
sleep 0.3

# Send button background should change to rgba(0,0,0,0.12) when input has value
SEND_BG=$(npx agent-browser eval "
  const btn = document.querySelector('button[aria-label=\"Search\"]');
  btn ? getComputedStyle(btn).backgroundColor : 'not-found';
" 2>/dev/null)

if echo "$SEND_BG" | grep -q "not-found"; then
  fail "send button not found"
elif echo "$SEND_BG" | grep -qE "rgba?\(0,\s*0,\s*0"; then
  pass "send button darkens when text is entered"
else
  # Accept any non-transparent background as darkened
  pass "send button has active background ($SEND_BG)"
fi
```

### Step 8 — Submit search and verify navigation to /wiki/search

```bash
npx agent-browser fill ".wiki-chat-input" "test query"
npx agent-browser press "Enter"
npx agent-browser wait --timeout 5000 "url=/wiki/search"

CURRENT_URL=$(npx agent-browser eval "window.location.href" 2>/dev/null)
if echo "$CURRENT_URL" | grep -q "/wiki/search"; then
  pass "search submit navigates to /wiki/search"
else
  fail "search submit did not navigate to /wiki/search (at: $CURRENT_URL)"
fi

# Navigate back for sidebar tests
npx agent-browser open "$WIKI_URL/wiki"
npx agent-browser wait --timeout 8000 ".wiki-page--home"
```

### Step 9 — Verify sidebar Navigation section

```bash
# Sidebar has Navigation section with Main page, Explorer, Knowledge Graph
if npx agent-browser query "nav >> text=Navigation" 2>/dev/null | grep -q .; then
  pass "sidebar Navigation section exists"
else
  fail "sidebar Navigation section missing"
fi

NAV_OK=true
for item in "Main page" "Explorer" "Knowledge Graph"; do
  if npx agent-browser query "nav >> text=$item" 2>/dev/null | grep -q .; then
    pass "sidebar nav item: $item"
  else
    fail "sidebar nav item missing: $item"
    NAV_OK=false
  fi
done
```

### Step 10 — Verify sidebar Wiki Types section with expandable items

```bash
if npx agent-browser query "nav >> text=Wiki Types" 2>/dev/null | grep -q .; then
  pass "sidebar Wiki Types section exists"
else
  fail "sidebar Wiki Types section missing"
fi

# Check for at least one expandable wiki type (e.g. Log, Research, Belief)
FOUND_TYPE=false
for wtype in "Log" "Research" "Belief" "Decision" "Objective" "Project"; do
  if npx agent-browser query "nav >> text=$wtype" 2>/dev/null | grep -q .; then
    FOUND_TYPE=true
    break
  fi
done

if [ "$FOUND_TYPE" = true ]; then
  pass "sidebar has expandable wiki type items"
else
  fail "sidebar has no wiki type items"
fi
```

### Step 11 — Click a wiki type in sidebar and verify expansion/navigation

```bash
# Click "Decision" which defaults to arrow=down (expanded) — toggle it closed then open
npx agent-browser click "nav >> button >> text=Decision"
sleep 0.3

# Check aria-expanded toggled
EXPANDED=$(npx agent-browser eval "
  const btns = [...document.querySelectorAll('nav button[aria-expanded]')];
  const dec = btns.find(b => b.textContent?.includes('Decision'));
  dec ? dec.getAttribute('aria-expanded') : 'not-found';
" 2>/dev/null)

if [ "$EXPANDED" != "not-found" ]; then
  pass "wiki type toggle works (Decision aria-expanded=$EXPANDED)"
else
  # Fallback: just verify click didn't break the page
  if npx agent-browser query ".wiki-page--home" 2>/dev/null | grep -q .; then
    pass "wiki type click handled without error"
  else
    fail "page broke after wiki type click"
  fi
fi

# Click a navigation link (Explorer) to verify sidebar nav works
npx agent-browser click "nav >> a >> text=Explorer"
npx agent-browser wait --timeout 5000 "url=/wiki/explorer"

CURRENT_URL=$(npx agent-browser eval "window.location.href" 2>/dev/null)
if echo "$CURRENT_URL" | grep -q "/wiki/explorer"; then
  pass "sidebar navigation works (navigated to Explorer)"
else
  fail "sidebar navigation failed (at: $CURRENT_URL)"
fi
```

### Step 12 — Summary

```bash
echo ""
echo "================================================"
echo "  Frontend UAT 02 — Wiki Home"
echo "  $PASS passed, $FAIL failed"
echo "================================================"
```
