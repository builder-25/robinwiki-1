# M10: Interconnectivity & Trust Gates — Plan

**Date:** 2026-04-12
**Issue:** #10
**Depends on:** M3 (wiki-to-wiki hyperlinking), M2 (people extraction), M6 (API aggregation)

---

## Current State

### What exists

**Edges table and graph infrastructure.** The `edges` table stores typed relationships: `ENTRY_HAS_FRAGMENT`, `FRAGMENT_IN_WIKI`, `FRAGMENT_MENTIONS_PERSON`, `FRAGMENT_RELATED_TO_FRAGMENT`. Each edge carries `attrs` JSONB (currently stores `{ score }` for classification/relevance edges). The `/graph` endpoint renders these as nodes and edges with batch-resolved labels. The `/relationships/:type/:id` endpoint returns all edges for any object.

**Fragment confidence.** Fragments are extracted with a `confidence` field (0.70-0.95 scale) by the fragmentation prompt spec. Dedup uses confidence to pick winners. Wiki-classify uses the confidence as the edge score. However, the `fragments` DB table does not persist the `confidence` value — it's used transiently in the pipeline and then discarded.

**Relevance scoring.** Two dedicated LLM scorer prompts exist: `fragment-relevance.yaml` (fragment-to-fragment) and `wiki-relevance.yaml` (fragment-to-wiki). Both produce calibrated `score` values stored in edge `attrs`. The `wiki-classify` stage filters by a `THREAD_CLASSIFY_THRESHOLD` (default 0.7).

**Wiki-to-wiki hyperlinking (basic).** The regen pipeline (`core/src/lib/regen.ts`) queries all non-deleted wikis (up to 20) and passes them as a `relatedWikis` template variable. Every wiki-type YAML template has a `{{#if relatedWikis}}` section that instructs the LLM to use `[[wiki-slug]]` syntax instead of duplicating content. This is a flat list of slug+type+name — no content or context from linked wikis is provided.

**Bouncer mode.** Wikis have a `bouncerMode` column (`'auto' | 'review'`). The fragment review endpoint checks this to gate auto-inclusion. This is the seed of a trust gate but operates only at the fragment-to-wiki level.

**People infrastructure.** Entity extraction resolves mentions against known people with weighted fuzzy matching (canonical name at 5x, aliases at 4x). `FRAGMENT_MENTIONS_PERSON` edges connect fragments to people. The `/people/:id` detail endpoint returns fragment backlinks. No wiki-level people aggregation exists.

**Source tracking.** The `raw_sources` table has `source` (text, e.g. "api", "mcp.claude") and `type` (e.g. "thought") but no `source_metadata` JSONB column. There is no citation-style naming or human-readable source attribution anywhere.

**Search.** Hybrid BM25 + pgvector search with RRF fusion across fragments, wikis, and people. MCP `search` tool exposes this. No "save this answer" or synthetic wiki flow exists.

### What does NOT exist

- No reader agent (wikis don't read linked wiki content during regen)
- No `source_metadata` column or citation-style source names
- No fragment confidence persisted to DB
- No wiki-level people aggregation
- No person-to-wiki reverse aggregation ("which wikis mention this person")
- No synthetic wiki / meta-thread concept
- No "create related wiki" bootstrapping flow
- No "brief me on this person" query

---

## Gap Analysis vs Milestone Requirements

| Requirement | Current State | Gap |
|---|---|---|
| Reader agent resolves wiki-to-wiki links during regen | Regen passes flat slug list, no content | Need to resolve linked wikis, read their content, inject summaries |
| Linked wiki summaries injected as regen context | `relatedWikis` is slug+type+name only | Need to read actual wiki content for semantically linked wikis |
| Regen reflects current state of linked wikis | No linked wiki content read at all | Full gap |
| Source attribution generates readable names | `source` is "api" / "mcp.claude" | Need `source_metadata` column + citation generator at ingest |
| `raw_sources.source_metadata` carries citation context | Column does not exist | Schema migration + ingest-time population |
| Fragments display source as readable citation | No citation field on fragments | Derive from entry's source_metadata |
| Wiki composition references sources by citation | Wiki regen doesn't mention sources | Template + regen changes |
| Signal for "output worth keeping" | No mechanism | Design decision needed |
| Synthetic wiki type/placement | No concept | Design decision needed |
| Save-to-wiki flow from search/query | No flow | New endpoint + possibly MCP tool |
| "Create related wiki" action | No flow | New endpoint or MCP tool |
| New wiki pre-populated from relationship context | No flow | Regen or bootstrap logic |
| Initial fragments seeded from parent wiki | No flow | Fragment cloning or linking logic |
| People aggregated at wiki level | Only fragment-level backlinks | Query through edges: wiki -> fragments -> people |
| People pages show which wikis they appear in | Only fragment backlinks exist | Traverse: person -> fragments -> wikis |
| "Brief me on this person" query | No dedicated flow | MCP tool or query endpoint |

---

## Tasks

### Task 1: Reader Agent (wiki-to-wiki context in regen)

**What "reader agent" means concretely:** During wiki regeneration, instead of passing a flat list of all wiki slugs, identify the wikis semantically linked to the target wiki (via shared fragments, `[[wiki-slug]]` references in content, or embedding similarity), read their current content, and inject condensed summaries into the regen prompt so the LLM can write with awareness of the linked knowledge.

**Changes:**
1. **`core/src/lib/regen.ts`** — Replace the current "grab 20 random other wikis" approach:
   - Query `FRAGMENT_IN_WIKI` edges to find wikis that share fragments with the target wiki (co-occurrence).
   - Parse `[[wiki-slug]]` references in the target wiki's existing content to find explicitly linked wikis.
   - Optionally: use embedding similarity between the target wiki and others to find semantically related ones.
   - For each linked wiki (cap at ~5-8), read its current `content` and produce a condensed summary (first 300-500 chars, or a dedicated summarizer LLM call for large wikis).
   - Pass these summaries as the `relatedWikis` template variable instead of the flat slug list.

2. **Wiki-type YAML templates** — Update the `[RELATED WIKIS]` section instructions:
   - Current: "link to it using `[[wiki-slug]]` syntax instead of reproducing the content"
   - New: Include both the linking instruction AND the summary context, so the LLM can reference the linked wiki's actual content to inform writing (e.g., "The linked Belief wiki 'early-teams-need-generalists' currently states: [summary]. Use this context to inform how you frame this Decision.")

3. **`packages/shared/src/prompts/loaders/wiki-generation.ts`** — No schema change needed (relatedWikis is already `z.string().optional()`), but the content format changes from slug list to structured summaries.

**Verification:**
- Regenerate a Decision wiki that links to 2+ Belief wikis. The output should reference specific content from those Beliefs.
- Compare regen output with and without the reader agent context — the reader-agent version should be more informed and contextual.

### Task 2: Source Quality — Citation-Style Attribution

**Changes:**
1. **Schema migration** — Add `source_metadata` JSONB column to `raw_sources`:
   ```sql
   ALTER TABLE "raw_sources" ADD COLUMN "source_metadata" jsonb DEFAULT '{}';
   ```
   Expected shape: `{ displayName: string, timestamp?: string, channel?: string, sessionId?: string }`.

2. **`core/src/db/schema.ts`** — Add `sourceMetadata` to `entries` table definition.

3. **Ingest-time citation generation** — In the ingest worker (`core/src/queue/worker.ts`) or the persist stage (`packages/agent/src/stages/persist.ts`):
   - Generate a human-readable `displayName` from `source` + metadata at ingest time.
   - Examples: `"mcp.claude"` -> `"Claude conversation, Apr 10"`, `"api"` -> `"API import, Apr 10"`, `"mcp.cursor"` -> `"Cursor session, Apr 10"`.
   - Store in `source_metadata.displayName`.

4. **Fragment citation derivation** — Fragments don't store source directly; they reference `entry_id`. The API response for fragment detail should resolve `entry_id` -> `raw_sources.source_metadata.displayName` and include it.
   - Update `core/src/schemas/fragments.schema.ts` to include `sourceCitation` in the detail response.
   - Update `core/src/routes/fragments.ts` detail endpoint to join through `entry_id`.

5. **Wiki composition with citations** — Update wiki generation templates to include source citations in the fragments section:
   - When building `fragmentsText` in `regen.ts`, annotate each fragment with its source citation.
   - Template instruction: "When referencing a claim, note its source in parentheses."

**Verification:**
- Ingest via MCP, check `raw_sources.source_metadata` has a readable `displayName`.
- Fragment detail API returns `sourceCitation`.
- Regenerated wiki content includes parenthetical source citations.

### Task 3: Fragment Confidence Persistence

**Changes:**
1. **Schema migration** — Add `confidence` column to `fragments`:
   ```sql
   ALTER TABLE "fragments" ADD COLUMN "confidence" real;
   ```

2. **`core/src/db/schema.ts`** — Add `confidence` real column to fragments table.

3. **`packages/agent/src/stages/persist.ts`** — When inserting fragments, persist the `confidence` value from the fragmentation output.

4. **API surfaces** — Include `confidence` in fragment list and detail response schemas.

5. **Trust gate concept** — The `confidence` value becomes a quality signal:
   - Fragments below a configurable threshold (e.g. 0.7) could be flagged for review rather than auto-linked.
   - This interacts with the existing `bouncerMode` on wikis — a wiki in `'review'` mode already gates fragment inclusion. Fragment confidence adds a second dimension: even in `'auto'` mode, low-confidence fragments could be held for review.

**Verification:**
- Ingest content, check `fragments.confidence` is populated.
- Fragment API responses include the confidence value.

### Task 4: People Aggregation at Wiki Level

**Changes:**
1. **Wiki detail endpoint** (`core/src/routes/wikis.ts`) — Add a `people` field to the wiki detail response:
   - Traverse: wiki -> `FRAGMENT_IN_WIKI` edges -> fragment keys -> `FRAGMENT_MENTIONS_PERSON` edges -> person keys -> resolve names.
   - Return as `people: Array<{ id: string, name: string, mentionCount: number }>`.

2. **Person detail endpoint** (`core/src/routes/people.ts`) — Add a `wikis` field to the person detail response:
   - Traverse: person -> `FRAGMENT_MENTIONS_PERSON` edges (reverse) -> fragment keys -> `FRAGMENT_IN_WIKI` edges -> wiki keys -> resolve names.
   - Return as `wikis: Array<{ id: string, name: string }>`.

3. **"Brief me on this person" MCP tool** (`core/src/mcp/server.ts`):
   - New MCP tool: `brief_person` — given a person name/key, gather all wikis they appear in, pull relevant fragment content, and produce an LLM-generated briefing.
   - Uses existing search + edge traversal infrastructure.

**Verification:**
- Wiki detail API includes aggregated people.
- Person detail API includes reverse wiki list.
- MCP `brief_person` produces a coherent briefing from cross-wiki data.

### Task 5: Synthetic Wikis / Meta-Threads (Design + Initial Implementation)

This is the most open-ended item. The core question: how does the system know the user valued an AI-generated answer?

**Proposed signal mechanism:** An explicit `save` action. When the user gets a search/query result they want to keep:
- MCP: a `save_answer` tool that takes the query + answer text
- API: `POST /wikis/synthetic` with the query + answer

**Proposed placement:** A regular wiki with `source: 'synthetic'` metadata tag in its edit history. No new type — synthetic wikis are typed the same as regular wikis (belief, decision, etc.) but their origin is different.

**Changes:**
1. **New endpoint** `POST /wikis/synthetic` — Creates a wiki from a query answer:
   - Accepts `{ query: string, answer: string, type?: WikiType }`.
   - Auto-classifies type if not provided.
   - Creates wiki with initial content = answer.
   - Creates an edit record with `source: 'synthetic'`.

2. **MCP tool** `save_answer` — Wraps the endpoint above.

3. **Future:** Fragment extraction from the synthetic wiki's content, linking it into the graph. This could be a follow-up — the initial implementation just stores the wiki.

**Verification:**
- Save a search result as a synthetic wiki. It appears in the wiki list.
- The synthetic wiki participates in normal regen and linking cycles.

### Task 6: Thread-to-Thread Bootstrapping ("Create Related Wiki")

**Changes:**
1. **New endpoint** `POST /wikis/:id/spawn` — Create a new wiki related to an existing one:
   - Accepts `{ name: string, type: WikiType, relationship?: string }`.
   - Creates a new wiki with its descriptor pre-populated from the parent wiki's context.
   - Seeds initial `FRAGMENT_IN_WIKI` edges by copying relevant fragments from the parent (based on the relationship description — LLM-scored relevance).
   - Creates a `WIKI_RELATED_TO_WIKI` edge (new edge type) between parent and child.

2. **Schema** — Add `WIKI_RELATED_TO_WIKI` to the edge type vocabulary. Update graph route's `EDGE_TYPE_MAP`.

3. **MCP tool** `create_related_wiki` — Wraps the endpoint.

**Verification:**
- Spawn a Decision wiki from a Belief wiki. The new wiki starts with relevant fragments.
- The graph shows the relationship between parent and child wikis.

---

## Trust Gate Design

"Trust gate" is the overarching concept: quality thresholds that determine whether content flows automatically or requires human review. The concrete mechanisms:

| Gate | Signal | Auto threshold | Review trigger |
|---|---|---|---|
| Fragment inclusion in wiki | `confidence` (from fragmentation) | >= 0.7 | < 0.7 |
| Wiki bouncer mode | `bouncerMode` on wiki | `'auto'` | `'review'` — all fragments held |
| Wiki classification | `score` (from wiki-classify) | >= THREAD_CLASSIFY_THRESHOLD (0.7) | Below threshold — not linked |
| Source quality | `source_metadata.displayName` existence | Present | Missing — flag for enrichment |
| Fragment-to-fragment | `score` (from frag-relate) | >= 0.3 | Below — not linked |

The trust model is additive: each gate is independent. A fragment with confidence 0.95 still gets held if the target wiki is in `'review'` mode. A low-confidence fragment in an `'auto'` wiki gets auto-linked but could be surfaced as "low confidence" in the UI.

Future extension: a composite "trust score" per wiki that aggregates fragment confidences, source quality, and freshness. Not in scope for M10 initial implementation.

---

## Execution Order

1. **Task 3: Fragment confidence persistence** — Schema migration + pipeline change. Foundation for trust gates. Small, low-risk.
2. **Task 2: Source quality / citations** — Schema migration + ingest changes. Independent of other tasks.
3. **Task 4: People aggregation** — Pure query/API work. No schema changes. Can parallelize with 1-2.
4. **Task 1: Reader agent** — The highest-value item. Depends on existing wiki content being useful (which it already is post-M3). Most complex — touches regen, templates, and prompt engineering.
5. **Task 5: Synthetic wikis** — Design decision on signal mechanism first. Implementation is straightforward once decided.
6. **Task 6: Thread bootstrapping** — Depends on reader agent concepts. New edge type. Can be deferred if time-constrained.

---

## Verification Checklist

- [ ] Fragment confidence persisted to DB and visible in API
- [ ] `raw_sources.source_metadata` populated at ingest with human-readable citation
- [ ] Fragment detail API includes `sourceCitation` field
- [ ] Wiki regen reads linked wiki content (not just slugs) and produces contextually aware output
- [ ] Wiki detail API includes aggregated people mentions
- [ ] Person detail API includes reverse wiki list
- [ ] MCP `brief_person` tool produces coherent briefing
- [ ] MCP `save_answer` tool creates a synthetic wiki
- [ ] `POST /wikis/:id/spawn` creates a related wiki with seeded fragments
- [ ] Graph endpoint renders `WIKI_RELATED_TO_WIKI` edges
- [ ] Bouncer mode + fragment confidence interact correctly (low-confidence + review mode = held)
- [ ] `npx tsc --noEmit` passes after all changes
- [ ] `npx eslint . --quiet` passes after all changes
