# Frontend UAT 04 — Knowledge Graph

## What it proves
The Knowledge Graph page renders its canvas, displays node/edge counts, provides
working type filters, shows node detail on selection, supports pan/zoom reset on
double-click, and surfaces the depth slider when a node is focused.

## Prerequisite
Authenticated session (user signed in via `/login`).

## Page
`/wiki/graph`

---

## Steps

### 1. Navigate and verify heading

```bash
WIKI_URL="${WIKI_URL:-http://localhost:8080}"

npx agent-browser open "$WIKI_URL/wiki/graph"
npx agent-browser wait --load networkidle
npx agent-browser screenshot /tmp/uat-graph-01-loaded.png
npx agent-browser snapshot -i
```

**Verify:** Page loads. Snapshot contains text "Knowledge Graph".

---

### 2. Verify node/edge counts displayed

```bash
npx agent-browser snapshot -s "[style]" -i
npx agent-browser get text "body"
```

**Verify:** Text matching the pattern `N nodes` and `N edges` is visible near the
top-left heading. The counts reflect the graph data (may be `0 nodes` if no data
has been ingested, but the labels must be present).

---

### 3. Verify filter panel on right side with type toggles

```bash
npx agent-browser snapshot -i
```

**Verify:** The right-side panel contains:
- A "Filters" heading
- Three toggle buttons labeled **Wiki**, **Fragments**, **People**
- Each toggle shows a count number beside it

```bash
npx agent-browser find text "Filters" click
npx agent-browser snapshot -i
```

---

### 4. Verify legend (top-left) with node type indicators

```bash
npx agent-browser snapshot -i
npx agent-browser screenshot /tmp/uat-graph-04-legend.png
```

**Verify:** A legend overlay is visible in the top-left area (below the heading,
at `top: 48px`). It contains entries for:
- "Wiki" (with a circle icon)
- "People" (with a person icon)

---

### 5. Toggle a type filter and verify visual change

```bash
# Screenshot before toggle
npx agent-browser screenshot /tmp/uat-graph-05a-before-toggle.png

# Click the "Fragments" filter button to toggle it off
npx agent-browser find text "Fragments" click
npx agent-browser wait 500

# Screenshot after toggle
npx agent-browser screenshot /tmp/uat-graph-05b-after-toggle.png

# Snapshot to confirm panel state changed
npx agent-browser snapshot -i
```

**Verify:** Compare `/tmp/uat-graph-05a-before-toggle.png` and
`/tmp/uat-graph-05b-after-toggle.png`. The canvas rendering should differ
(fragment nodes dimmed or hidden after the toggle). The Fragments button
appearance should change (dimmed text/background when inactive).

```bash
# Re-enable Fragments for subsequent steps
npx agent-browser find text "Fragments" click
npx agent-browser wait 500
```

---

### 6. Click canvas near a node to select it

If nodes exist in the graph, click the canvas center area to attempt node
selection. The graph uses a `<canvas>` element so standard selectors do not apply;
use mouse coordinates targeting the canvas center.

```bash
# Get the canvas bounding box
npx agent-browser get box "canvas"
```

Record the box dimensions. Click near the canvas center where nodes cluster due
to center-gravity physics:

```bash
# Click center of canvas (nodes cluster near center due to force layout)
npx agent-browser eval "
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2) });
"
```

Use the returned coordinates to click:

```bash
npx agent-browser mouse move 512 384
npx agent-browser mouse down
npx agent-browser mouse up
npx agent-browser wait 500
npx agent-browser screenshot /tmp/uat-graph-06-node-click.png
npx agent-browser snapshot -i
```

**Verify:** If a node was hit, the right panel switches from "Filters" mode to
detail mode (showing a back-arrow "Filters" link, the node label, and type badge).
If no node was hit, the panel stays in Filters mode. Repeat with adjusted
coordinates if needed.

---

### 7. Verify detail panel shows label, type, connections

After a node is selected (from step 6):

```bash
npx agent-browser snapshot -i
```

**Verify:** The detail panel contains:
- The selected node's **label** (bold text at top)
- A **type badge** (one of: wiki, fragment, person) displayed as a pill
- A **Connections** section listing connected node counts (e.g., "3 wikis, 2 fragments")
- An **Edge types** section showing edge type badges (filing, wikilink, mention)

---

### 8. Verify "Open" button in detail panel

```bash
npx agent-browser snapshot -i
```

**Verify:** When a node is selected, the detail panel shows an "Open" button at
the bottom. The button should be visible and clickable.

```bash
npx agent-browser find text "Open" click
npx agent-browser wait --load networkidle
npx agent-browser get url
```

**Verify:** Clicking "Open" navigates to the entity page. The URL should match
one of:
- `/wiki/<id>` for wiki nodes
- `/wiki/fragments/<id>` for fragment nodes
- `/wiki/people/<id>` for person nodes

```bash
# Navigate back to graph page for remaining steps
npx agent-browser back
npx agent-browser wait --load networkidle
```

---

### 9. Double-click canvas to reset pan/zoom

```bash
# First, scroll to zoom in so we can observe the reset
npx agent-browser eval "
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2) });
"
```

```bash
# Zoom in using mouse wheel
npx agent-browser mouse move 512 384
npx agent-browser mouse wheel -300
npx agent-browser wait 300
npx agent-browser screenshot /tmp/uat-graph-09a-zoomed.png

# Double-click to reset
npx agent-browser dblclick "canvas"
npx agent-browser wait 300
npx agent-browser screenshot /tmp/uat-graph-09b-reset.png
```

**Verify:** Compare the two screenshots. After double-click, the view should
return to the default zoom level (1x) and pan origin (0,0). The grid spacing
and node positions should match the initial load appearance.

---

### 10. Verify depth slider appears when node is selected

First, click a node to trigger focus mode:

```bash
npx agent-browser eval "
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2) });
"
```

```bash
npx agent-browser mouse move 512 384
npx agent-browser mouse down
npx agent-browser mouse up
npx agent-browser wait 500
npx agent-browser snapshot -i
npx agent-browser screenshot /tmp/uat-graph-10-depth-slider.png
```

**Verify:** When a node is selected (focusNodeId is set), a depth slider appears
at the bottom-center of the canvas area. It contains:
- A "Depth" label
- A range input (slider) with min=1, max=3, step=1
- The current depth value displayed (default: 2)

The slider is only visible when `hasFocus` is true (a node is selected). If no
node is selected, the slider must not appear.

```bash
# Click empty canvas to deselect
npx agent-browser eval "
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  JSON.stringify({ cx: Math.round(r.left + 20), cy: Math.round(r.top + r.height - 20) });
"
```

```bash
# Click an empty corner to deselect
npx agent-browser mouse move 50 700
npx agent-browser mouse down
npx agent-browser mouse up
npx agent-browser wait 500
npx agent-browser snapshot -i
```

**Verify:** After clicking empty canvas (no node hit), the depth slider
disappears and the panel returns to Filters mode.

---

## Cleanup

```bash
npx agent-browser close
```
