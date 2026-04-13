# Plan: Close M3-M6 Gaps

**Date:** 2026-04-13
**Prerequisite:** Merge PR #20 (feat/m3-wiki-system)

## Overview

5 execution units, sequenced by dependency. Each unit is a single PR.

```
Unit 1: Close M3 (quality gate, embedding, hyperlinking)
  |
Unit 2: M4 Search (hybrid BM25 + pgvector + RRF fusion)
  |
Unit 3: Complete M5 MCP (search tool — closes milestone)
  |
Unit 4: Background Regen Worker (M3 gap, benefits from search)
  |
Unit 5: M6 API Routes (REST surface for future frontend)
```

---

## Unit 1 — Close M3 Gaps

**Goal:** Close milestone issue #3
**Scope:** 3 tasks, all in `core/src/routes/wikis.ts` and regen prompt area

### Task 1.1: Wiki creation quality gate

Wiki creation (`POST /vaults/:id/wikis`) must require non-empty title. The descriptor requirement (~200 words) applies to wiki types, not individual wikis — the `wiki_types.descriptor` field already enforces this at the type level.

**Files:** `core/src/routes/vaults.ts` (wiki creation handler)
**Change:** Validate `name` is non-empty and ≥3 chars. Return 400 if not.

### Task 1.2: Wiki embedding on composition

After regen writes `wikis.content`, compute and store an embedding.

**Files:** `core/src/routes/wikis.ts` (regenerate endpoint)
**Change:** After writing `wikis.content` in the regen handler:
```
const vec = await embedText({ apiKey: orConfig.apiKey, model: orConfig.embeddingModel }, wiki.content)
if (vec) await db.update(wikis).set({ embedding: vec }).where(eq(wikis.lookupKey, id))
```
**Reuse:** `embedText` from `@robin/agent` (already exported), `loadOpenRouterConfigFromDb` (already imported in wikis.ts)

### Task 1.3: Wiki-to-wiki hyperlinking in regen

The regen prompt must know about other wikis so it can hyperlink instead of duplicating content.

**Files:**
- `core/src/routes/wikis.ts` — gather wiki summaries before calling LLM
- `packages/shared/src/prompts/specs/wiki-types/*.yaml` — add `{{#if relatedWikis}}` section to templates
- `packages/shared/src/prompts/loaders/wiki-generation.ts` — add `relatedWikis` to input schema

**Change:**
1. In the regen handler, query all other wikis: `SELECT name, slug, type, content FROM wikis WHERE lookup_key != id AND deleted_at IS NULL LIMIT 20`
2. Format as context: `"- [Wiki Name](wiki-slug): first 200 chars of content..."`
3. Pass to `loadWikiGenerationSpec` as `relatedWikis` variable
4. Add to each YAML template: instruction to hyperlink to related wikis using `[[wiki-slug]]` syntax rather than duplicating content

### Verification
- `npx tsc --noEmit` — zero errors
- Test: create wiki with empty name → 400
- Test: regen a wiki → embedding column populated (not null)
- Test: regen with multiple wikis → output contains `[[slug]]` references

---

## Unit 2 — M4 Search

**Goal:** Close milestone issue #4
**Scope:** Hybrid search with RRF fusion across fragments, wikis, people
**Foundation:** tsvector GIN indexes + HNSW embedding indexes already exist on all 3 tables. Existing `GET /search` route does BM25 on fragments only.

### Task 2.1: RRF fusion utility

**File:** `core/src/lib/search.ts` (new)

Reciprocal Rank Fusion combines two ranked lists into one:
```typescript
function rrfFuse(bm25Results: ScoredResult[], vecResults: ScoredResult[], k = 60): ScoredResult[]
```
Each result gets score `1/(k + rank)` from each list, summed. Sort by fused score descending.

### Task 2.2: Multi-table BM25 search

**File:** `core/src/lib/search.ts`

```typescript
async function bm25Search(db, query: string, opts: { limit, tables }): Promise<ScoredResult[]>
```
- Run `plainto_tsquery('english', query)` against each table's `search_vector`
- Score via `ts_rank(search_vector, tsquery)`
- UNION ALL across selected tables (fragments, wikis, people)
- Return ranked results with `{ id, type, title, score, snippet }`

### Task 2.3: Multi-table vector search

**File:** `core/src/lib/search.ts`

```typescript
async function vectorSearch(db, embedding: number[], opts: { limit, tables }): Promise<ScoredResult[]>
```
- Cosine distance: `embedding <=> $vec::vector`
- Convert distance to similarity: `1 - (distance / 2)`
- UNION ALL across tables
- Return ranked results

### Task 2.4: Hybrid search endpoint

**File:** `core/src/routes/search.ts` (update existing)

Replace the current BM25-only implementation with:
1. Compute query embedding via `embedText`
2. Run BM25 search (Task 2.2)
3. Run vector search (Task 2.3) — skip if embedding fails
4. Fuse via RRF (Task 2.1)
5. Return top-K results

Add query params: `tables` (comma-separated: `fragments,wikis,people`, default all), `mode` (`hybrid`/`bm25`/`vector`, default `hybrid`)

### Task 2.5: Search response schema update

**File:** `core/src/schemas/search.schema.ts`

Add `type` field to results (fragment/wiki/person), add `snippet` (first 200 chars of content).

### Verification
- `npx tsc --noEmit`
- Test: `GET /search?q=Sarah` returns fragments mentioning Sarah
- Test: `GET /search?q=Sarah&tables=people` returns person results
- Test: `GET /search?q=product+launch&mode=hybrid` returns fused results

---

## Unit 3 — Complete M5 MCP

**Goal:** Close milestone issue #5
**Scope:** 1 task — add `search` MCP tool

### Task 3.1: `search` MCP tool

**Files:** `core/src/mcp/server.ts`, `core/src/mcp/resolvers.ts`

Register `search` tool wrapping the hybrid search from Unit 2:
```
Input: { query: string, tables?: string, limit?: number }
Output: ranked results array
```

The `search` tool was removed in Unit 2 (MCP reactivation) because it depended on the gateway. Now it's backed by the DB search function.

**Note:** No stdio transport. MCP is HTTP-only (`StreamableHTTPServerTransport`).

### Verification
- `npx tsc --noEmit`
- MCP `search` tool returns results for known queries

---

## Unit 4 — Background Regen Worker

**Goal:** Close last M3 gap (background regen)
**Scope:** Wire the dormant regen worker using existing BullMQ infrastructure

### Task 4.1: Implement regen processor

**File:** `core/src/queue/regen-worker.ts`

Replace the stubs with a real processor. Pattern: match `processExtractionJob` structure.

```typescript
async function processRegenJob(job: RegenJob): Promise<JobResult> {
  // 1. Load wiki by job.objectKey
  // 2. Load OpenRouter config
  // 3. Gather fragments, edits (same as on-demand regen)
  // 4. Load prompt spec, call LLM
  // 5. Write content, compute embedding
  // 6. Log edit with source: 'regen'
  // 7. Return JobResult
}
```

Extract the regen logic from `core/src/routes/wikis.ts` into a shared function (`core/src/lib/regen.ts`) that both the route handler and the worker call.

### Task 4.2: Register regen worker in startup

**File:** `core/src/queue/worker.ts`

Add regen worker to `startWorkers()`:
```typescript
bullmq.startRegenWorker(processRegenJob)
```

Concurrency: 1 (LLM calls are expensive, serialize them).

### Task 4.3: Enqueue regen from ingest pipeline

**File:** `core/src/queue/worker.ts` or linking stage

After a fragment is linked to a wiki (`FRAGMENT_IN_WIKI` edge created), enqueue a regen job for that wiki. Debounce: don't enqueue if a regen job for the same wiki is already pending.

### Task 4.4: Regen scheduler (optional)

**File:** `core/src/queue/scheduler.ts`

Periodic scan for wikis with `lastRebuiltAt` older than N hours that have new fragments since last rebuild. Low priority — the fragment-triggered regen from Task 4.3 covers most cases.

### Verification
- `npx tsc --noEmit`
- Test: ingest an entry → fragments created → regen job enqueued → wiki content updated

---

## Unit 5 — M6 API Routes

**Goal:** Advance milestone issue #6
**Scope:** REST surface for future frontend

### Task 5.1: Route renames

- `/threads` → already `/wikis` in most places; audit and rename any remaining `/threads` references
- Entries table is `raw_sources` in SQL but API uses `/entries` — keep the API name, it's clearer

### Task 5.2: Fragment CRUD

**File:** `core/src/routes/fragments.ts`

- `GET /fragments` — list with pagination, vault filter
- `GET /fragments/:id` — detail with content, tags, backlinks (via edges)
- `PUT /fragments/:id` — update content, tags

### Task 5.3: People CRUD

**File:** `core/src/routes/people.ts`

- `GET /people` — list with pagination
- `GET /people/:id` — detail with content, aliases, backlinks
- `PUT /people/:id` — update content, relationship, aliases

### Task 5.4: Graph endpoint

**File:** `core/src/routes/graph.ts` (already exists)

Currently returns nodes + edges. Extend with:
- Filter by wiki (show only a wiki's subgraph)
- Include content snippets on nodes
- Add search integration (highlight matching nodes)

### Task 5.5: Bouncer mode

**Files:** `core/src/db/schema.ts`, `core/src/routes/wikis.ts`

- Add `bouncerMode` column to wikis (`'auto' | 'review'`, default `'auto'`)
- `PATCH /wikis/:id/bouncer` — toggle mode
- When `review`: new fragments linking to this wiki get `state: 'PENDING'` on the edge instead of auto-accepting

### Task 5.6: Fragment review endpoints

**File:** `core/src/routes/fragments.ts`

- `POST /fragments/:id/accept` — accept into review-mode wiki (set edge state to active)
- `POST /fragments/:id/reject` — reject from wiki (soft-delete edge)

### Verification
- `npx tsc --noEmit`
- Full CRUD tests for fragments, people
- Bouncer mode: set wiki to review → ingest entry → fragment created but edge is pending → accept → edge active

---

## Execution Timeline

| Unit | Scope | Depends on | Closes |
|------|-------|------------|--------|
| 1 | M3 gaps (quality gate, embedding, hyperlinking) | PR #20 merged | #3 |
| 2 | M4 Search (hybrid BM25 + pgvector + RRF) | Unit 1 | #4 |
| 3 | M5 MCP search tool | Unit 2 | #5 |
| 4 | Background regen worker | Unit 1 | — |
| 5 | M6 API routes | Unit 2 | #6 (partial) |

Units 3 and 4 can run in parallel after their prerequisites.
Unit 5 can start as soon as Unit 2 lands.

## Milestone closure status after all 5 units

| Milestone | Status |
|-----------|--------|
| M3: Wiki Composition | Closed |
| M4: Search | Closed |
| M5: MCP Server | Closed |
| M6: API Routes | Partial — bouncer mode + fragment review may need frontend iteration |
| M7-M10 | Not started |
