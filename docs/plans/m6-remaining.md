# M6: API Routes -- Remaining Gap Plan

## Already Shipped

- [x] **GET /wikis/:id** -- wiki detail with content (`core/src/routes/wikis.ts`)
- [x] **PUT /wikis/:id** -- update wiki (name, type, prompt) (`core/src/routes/wikis.ts`)
- [x] **POST /vaults/:vaultId/wikis** -- create wiki with quality gate (`core/src/routes/vaults.ts`)
- [x] **PUT /api/content/wiki/:key** -- wiki edit with diff preservation, logged in `edits` table (`core/src/routes/content.ts`)
- [x] **PATCH /wikis/:id/bouncer** -- toggle bouncer mode (auto/review) (`core/src/routes/wikis.ts`)
- [x] **POST /wikis/:id/regenerate** -- on-demand wiki regen via Quill (`core/src/routes/wikis.ts`)
- [x] **POST /wikis/:id/publish / unpublish** -- public wiki publishing (`core/src/routes/wikis.ts`)
- [x] **GET /published/wiki/:nanoid** -- unauthenticated public wiki read (`core/src/routes/published.ts`)
- [x] **GET /fragments** -- fragment feed, recency-sorted with pagination (`core/src/routes/fragments.ts`)
- [x] **GET /fragments/:id** -- fragment detail with content, backlinks, source entry (`core/src/routes/fragments.ts`)
- [x] **POST /fragments** -- create fragment (`core/src/routes/fragments.ts`)
- [x] **PUT /fragments/:id** -- update fragment (`core/src/routes/fragments.ts`)
- [x] **POST /fragments/:id/accept** -- accept fragment into review-mode wiki (`core/src/routes/fragments.ts`)
- [x] **POST /fragments/:id/reject** -- reject fragment from review-mode wiki (`core/src/routes/fragments.ts`)
- [x] **GET /entries** -- list raw sources (entries) (`core/src/routes/entries.ts`)
- [x] **GET /entries/:id** -- single entry detail (`core/src/routes/entries.ts`)
- [x] **POST /entries** -- create entry (ingest) (`core/src/routes/entries.ts`)
- [x] **GET /people** -- list people with pagination (`core/src/routes/people.ts`)
- [x] **GET /people/:id** -- person detail with backlinks (fragments mentioning this person) (`core/src/routes/people.ts`)
- [x] **PUT /people/:id** -- update person (`core/src/routes/people.ts`)
- [x] **GET /search?q=** -- hybrid BM25 + pgvector search (`core/src/routes/search.ts`)
- [x] **GET /graph** -- knowledge graph (nodes + edges) with vaultId/wikiId filters (`core/src/routes/graph.ts`)
- [x] **GET/PUT /api/content/:type/:key** -- generic content read/write for wiki, fragment, person, entry (`core/src/routes/content.ts`)
- [x] **GET/POST/PUT /wiki-types** -- wiki types CRUD with setup endpoint (`core/src/routes/wiki-types.ts`)
- [x] **GET /relationships/:type/:id** -- relationship traversal (`core/src/routes/relationships.ts`)
- [x] **`regenerate` boolean field on wiki** -- schema column exists, regen endpoint respects it
- [x] **`bouncerMode` field on wiki** -- schema column exists, PATCH endpoint works

## Remaining Work

### 1. Route rename: `/entries` to `/raw-sources`

**Issue scope item:** Rename `/threads` to `/wikis`, `/entries` to `/raw-sources`

The `/threads` to `/wikis` rename is already done (routes mount at `/wikis`). The `/entries` to `/raw-sources` rename has NOT been done -- the route still mounts at `/entries` in `core/src/index.ts`.

The DB table is already named `raw_sources` (see `core/src/db/schema.ts` line 166), but the route path and file name still say `entries`.

**Tasks:**
- Rename `core/src/routes/entries.ts` to `core/src/routes/raw-sources.ts`
- Update the export name from `entries` to `rawSourcesRoutes`
- In `core/src/index.ts`, change `app.route('/entries', entries)` to `app.route('/raw-sources', rawSourcesRoutes)`
- Update imports in `core/src/index.ts`
- Search for any other references to the `/entries` path in schemas, tests, or other routes (e.g., `core/src/routes/fragments.ts` references `entries` table but that's the DB import, not the route)
- Keep the `entries` DB table import name (`entries` in schema.ts) unchanged -- only the HTTP route path changes

### 2. `GET /wikis` -- list all wikis (top-level)

**Issue scope item:** `GET /wikis` -- List all wikis with content previews

Currently, listing wikis is only possible via `GET /vaults/:vaultId/wikis` (scoped to a vault). There is no top-level `GET /wikis` endpoint that lists all wikis across all vaults.

**Tasks:**
- Add `GET /` handler in `core/src/routes/wikis.ts`
- Support pagination (limit/offset query params)
- Join with `wikiTypes` table to include `shortDescriptor` and `descriptor` (same pattern as `GET /vaults/:vaultId/wikis` in `core/src/routes/vaults.ts` lines 122-146)
- Return array parsed through `threadResponseSchema`

### 3. `GET /wikis/:id` -- aggregated people from member fragments

**Issue scope items (from comments):**
- `GET /wikis/:id` includes aggregated people from member fragments
- `GET /wikis/:id/people` dedicated endpoint for wiki's people with mention counts
- `GET /wikis/:id` returns member fragments with full detail, ordered by classification confidence

The current `GET /wikis/:id` returns only the wiki row. It does NOT return:
- Member fragments (via FRAGMENT_IN_WIKI edges)
- Aggregated people (via fragments -> FRAGMENT_MENTIONS_PERSON edges)

**Tasks:**
- Enhance `GET /wikis/:id` in `core/src/routes/wikis.ts` to:
  - Query FRAGMENT_IN_WIKI edges to get member fragment IDs
  - Batch-fetch fragment rows, return them with content + metadata
  - Order fragments by classification confidence (if a confidence/score field exists on edges) or by `createdAt` as fallback
  - Traverse FRAGMENT_MENTIONS_PERSON edges from those fragments to aggregate people with mention counts
  - Return `fragments` and `people` arrays in the response
- Add `GET /wikis/:id/people` sub-endpoint for dedicated people-with-mention-counts view
- Update `threadWithWikiResponseSchema` in `core/src/schemas/wikis.schema.ts` to include `fragments` and `people` arrays

### 4. `PATCH /wikis/:id/regenerate` -- toggle regeneration on/off

**Issue scope item:** `PATCH /wikis/:id/regenerate` endpoint to toggle regeneration

The `POST /wikis/:id/regenerate` endpoint triggers on-demand regen. But there is no `PATCH` endpoint to toggle the `regenerate` boolean field on/off. The field exists in the schema.

**Tasks:**
- Add `PATCH /wikis/:id/regenerate` handler in `core/src/routes/wikis.ts`
- Accept `{ regenerate: boolean }` body
- Update the wiki's `regenerate` column
- Add schema for request/response in `core/src/schemas/wikis.schema.ts`

### 5. Stub routes: `/fragments/:id/thread` and `/fragments/:id/links` and `/fragments/:id/backlinks`

These exist as stubs returning 501 or empty arrays. They should be wired up to the edges table.

**Tasks:**
- `PUT /fragments/:id/thread` -- create/update FRAGMENT_IN_WIKI edge (move fragment to a wiki)
- `GET /fragments/:id/links` -- query outgoing edges from this fragment
- `GET /fragments/:id/backlinks` -- query incoming edges to this fragment (partially duplicates the main `GET /fragments/:id` backlinks, but as a dedicated sub-endpoint)

**Priority:** Low. The main `GET /fragments/:id` already returns backlinks. These sub-endpoints are convenience/legacy.

## Verification Steps

1. **Type check:** `npx tsc --noEmit` from `core/` -- must pass with zero errors
2. **Lint:** `npx eslint . --quiet` from `core/` -- must pass
3. **Route audit:** Every endpoint in the M6 issue table has a corresponding handler that returns non-501 status
4. **Schema validation:** All responses are parsed through Zod schemas before returning (already enforced by existing patterns)
5. **Manual smoke test:** Hit each new/modified endpoint via curl or the UAT skill to confirm 200/201 responses with valid payloads
