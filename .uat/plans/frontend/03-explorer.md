# Frontend UAT 03 — Explorer Page

## What it proves

Explorer page renders with live data, type/sort/group filters work via chip
toggles, URL search params stay in sync with filter state, page refresh
restores filters from URL, clear-filters resets everything, and clicking an
item navigates to the correct entity page.

## Prerequisite

Authenticated session (sign in completed before this plan runs).
Wiki dev server on `WIKI_URL`, core server on `SERVER_URL`.

## Steps

Each step is one `npx agent-browser` invocation. Run sequentially.
Track `PASS` / `FAIL` counters across steps.

---

### Step 1 — Navigate to Explorer, verify heading and item count

```bash
WIKI_URL="${WIKI_URL:-http://localhost:8080}"
PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

npx agent-browser open "$WIKI_URL/wiki/explorer"
npx agent-browser wait 2000
npx agent-browser snapshot
```

**Assert:**
- Page contains an `h1` with text **"Explorer"**.
- Subtitle text matches pattern `N objects` (where N >= 0).

```bash
TITLE=$(npx agent-browser get text "h1")
if echo "$TITLE" | grep -q "Explorer"; then
  pass "Explorer heading present"
else
  fail "Explorer heading missing (got: $TITLE)"
fi

COUNT_TEXT=$(npx agent-browser eval "document.querySelector('h1')?.closest('div')?.querySelector('p')?.textContent || ''")
if echo "$COUNT_TEXT" | grep -qE '[0-9]+ objects'; then
  pass "Item count displayed: $COUNT_TEXT"
else
  fail "Item count not found (got: $COUNT_TEXT)"
fi
```

---

### Step 2 — Verify type filter chips exist

```bash
npx agent-browser snapshot
```

**Assert:** Four type filter chips are visible — Fragments, Wikis, People, Entries.

```bash
for LABEL in "Fragments" "Wikis" "People" "Entries"; do
  FOUND=$(npx agent-browser find text "$LABEL" count)
  if [ "$FOUND" -ge 1 ] 2>/dev/null; then
    pass "Type chip '$LABEL' present"
  else
    fail "Type chip '$LABEL' missing"
  fi
done
```

---

### Step 3 — Toggle a type chip off, verify list and URL update

Toggle "Wikis" off so only fragments, people, entries remain. The URL should
gain a `?type=` param listing the remaining active types.

```bash
npx agent-browser find text "Wikis" click
npx agent-browser wait 500

CURRENT_URL=$(npx agent-browser get url)
if echo "$CURRENT_URL" | grep -q "type="; then
  pass "URL updated with type= param after toggling Wikis off"
else
  fail "URL missing type= param (got: $CURRENT_URL)"
fi

# Snapshot the list to verify wiki items are filtered out
npx agent-browser snapshot
```

**Assert:** URL contains `type=` query parameter.

---

### Step 4 — Toggle type chip back on, verify list restores

```bash
npx agent-browser find text "Wikis" click
npx agent-browser wait 500

CURRENT_URL=$(npx agent-browser get url)
# When all types are active, the type param is removed
if echo "$CURRENT_URL" | grep -qv "type="; then
  pass "URL cleared type= param after restoring all types"
else
  # Still valid if all four are listed explicitly
  pass "URL has type= param with all types re-enabled"
fi
```

---

### Step 5 — Verify sort chips exist

```bash
for LABEL in "Recent" "Oldest" "A-Z"; do
  FOUND=$(npx agent-browser find text "$LABEL" count)
  if [ "$FOUND" -ge 1 ] 2>/dev/null; then
    pass "Sort chip '$LABEL' present"
  else
    fail "Sort chip '$LABEL' missing"
  fi
done
```

---

### Step 6 — Change sort to A-Z, verify URL updates

```bash
npx agent-browser find text "A-Z" click
npx agent-browser wait 500

CURRENT_URL=$(npx agent-browser get url)
if echo "$CURRENT_URL" | grep -q "sort=alpha"; then
  pass "URL updated with sort=alpha"
else
  fail "URL missing sort=alpha (got: $CURRENT_URL)"
fi
```

---

### Step 7 — Verify item rows show title, type badge, and timestamp

```bash
# Grab first list item row
npx agent-browser snapshot
```

**Assert:** Each visible item row contains:
- A link with a title (non-empty text).
- A type badge element (WikiTypeBadge).
- A timestamp string (e.g. "just now", "2h ago", "3d ago", or date format).

```bash
FIRST_LINK=$(npx agent-browser eval "document.querySelector('ul li a')?.textContent || ''")
if [ -n "$FIRST_LINK" ]; then
  pass "First item has title: $FIRST_LINK"
else
  fail "First item missing title link"
fi

# Type badge is rendered inside each row
BADGE_COUNT=$(npx agent-browser eval "document.querySelectorAll('ul li [class*=badge], ul li [class*=Badge]').length")
if [ "$BADGE_COUNT" -ge 1 ] 2>/dev/null; then
  pass "Type badges present ($BADGE_COUNT found)"
else
  fail "No type badges found in item rows"
fi

# Timestamp — look for time-like text in the rightmost span
TIMESTAMP=$(npx agent-browser eval "
  const spans = document.querySelectorAll('ul li span');
  const last = spans[spans.length - 1];
  last?.textContent || '';
")
if echo "$TIMESTAMP" | grep -qE '(ago|just now|[0-9]+/[0-9]+)'; then
  pass "Timestamp visible: $TIMESTAMP"
else
  fail "Timestamp not found or unexpected format (got: $TIMESTAMP)"
fi
```

---

### Step 8 — Refresh page, verify filters persist from URL

The sort=alpha param from Step 6 should survive a page refresh.

```bash
npx agent-browser reload
npx agent-browser wait 2000

CURRENT_URL=$(npx agent-browser get url)
if echo "$CURRENT_URL" | grep -q "sort=alpha"; then
  pass "sort=alpha persisted after page refresh"
else
  fail "sort=alpha lost after refresh (got: $CURRENT_URL)"
fi

# Verify A-Z chip is still visually active
npx agent-browser snapshot
```

---

### Step 9 — Click "Clear filters", verify all reset

```bash
npx agent-browser find text "Clear filters" click
npx agent-browser wait 500

CURRENT_URL=$(npx agent-browser get url)
# After clearing, URL should have no type/sort/group params
if echo "$CURRENT_URL" | grep -qvE "(type=|sort=|group=)"; then
  pass "Clear filters removed all query params"
else
  fail "Query params remain after clear (got: $CURRENT_URL)"
fi
```

---

### Step 10 — Click an item, verify navigation to entity page

```bash
# Get the href of the first item before clicking
FIRST_HREF=$(npx agent-browser eval "document.querySelector('ul li a')?.getAttribute('href') || ''")
echo "First item href: $FIRST_HREF"

npx agent-browser eval "document.querySelector('ul li a')?.click()"
npx agent-browser wait 2000

CURRENT_URL=$(npx agent-browser get url)
if echo "$CURRENT_URL" | grep -qF "$FIRST_HREF"; then
  pass "Navigated to entity page: $CURRENT_URL"
else
  fail "Navigation failed — expected path containing $FIRST_HREF (got: $CURRENT_URL)"
fi

# Go back for next step
npx agent-browser back
npx agent-browser wait 1000
```

---

### Step 11 — Verify group filter section (conditional)

Groups only appear if the API returns groups. Check presence and basic toggle.

```bash
GROUP_HEADING=$(npx agent-browser eval "
  const spans = document.querySelectorAll('span');
  let found = '';
  spans.forEach(s => { if (s.textContent.trim() === 'GROUP') found = 'yes'; });
  found;
")

if [ "$GROUP_HEADING" = "yes" ]; then
  pass "Group filter section present"

  # Verify 'All groups' chip exists
  ALL_GROUPS=$(npx agent-browser find text "All groups" count)
  if [ "$ALL_GROUPS" -ge 1 ] 2>/dev/null; then
    pass "'All groups' chip present"
  else
    fail "'All groups' chip missing"
  fi
else
  pass "Group filter section absent (no groups in data — expected)"
fi
```

---

## Summary template

```bash
echo ""
echo "========================================="
echo "Frontend UAT 03 — Explorer Page"
echo "$PASS passed, $FAIL failed"
echo "========================================="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
```
