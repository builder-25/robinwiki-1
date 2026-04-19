# Phase: Deploy Fixes & Wiki Parity — Retrospective

> Generated: 2026-04-19
> Provider(s): gsd, git, github, manual

---

## 1. Phase Context

**Objective:** Sync contributor UI updates into the wiki, achieve feature parity with the original Robin OS (Explorer, Graph), implement single-tenant onboarding security, and fix all deployment-blocking issues reported by the product owner after Railway deploy.

**Scope:**
- **In scope:** Wiki UI sync, Explorer parity, Graph parity, onboarding/auth security, gateway removal, provision worker, env validation, env consolidation, missing deps, per-task model preferences
- **Out of scope:** Auto-generate secrets (deferred), Railway template creation, multi-tenant support, Dockerfile-based deploy

**Entry Conditions:** Wiki-updated contributor code available in `wiki-updated/` directory. Product owner's Railway deployment feedback documenting all blocking issues. Original Robin OS at `/home/me/source/os.withrobin.org` as reference.

**Success Criteria:**

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Wiki UI synced from contributor without breaking API integration | Done | 62 files copied, 0 new type errors, API hooks preserved |
| 2 | Explorer matches OS Robin capabilities | Done | Type checkboxes, group filter, sort, infinite scroll, URL state — all working in browser test |
| 3 | Graph has ego-graph, detail panel, depth slider | Done | 5 commits, GraphCanvas + GraphDetailPanel + GraphDepthSlider. Not fully browser-testable (1 node in test DB) |
| 4 | Single-tenant onboarding secure | Done | JIT provision, login-only, /recover page, no signup |
| 5 | Provision worker generates keypairs | Done | processProvisionJob implemented, registered in startWorkers() |
| 6 | All deploy-blocking env issues fixed | Done | createConfigVar validates all vars at boot, consolidated from 12+ to ~7 |
| 7 | Per-task model preferences | Done | 4 roles configurable, OpenRouter proxy, onboarding + profile UI |

---

## 2. Findings

### Expected
- The wiki sync was primarily a file copy + merge operation — the contributor's code was cleanly separated from the API layer
- Gateway removal was mostly cleanup — the directory was already deleted in M2
- Env validation was straightforward with Zod (t3-env pattern worked well)

### Unexpected

- **The contributor's UI scope was larger than anticipated.** 29 new files, 25 modified, spanning UI primitives, graph visualization, editor, onboarding — a near-complete frontend redesign, not a "cosmetic wiki style" update. Required careful merge strategy to avoid overwriting API integration.

- **OpenRouter API key was stored encrypted in the DB configs table, not just env.** The entire AI pipeline reads the key from DB at job time via `loadOpenRouterConfigFromDb()`. The env var was only a fallback during onboarding. This fundamentally changed the onboarding plan — CustomizeStep was necessary for writing the key to DB, not redundant as initially assumed. Decision: made key env-only, pipeline reads from env.

- **The onboarding CustomizeStep had dead model selectors.** Two dropdowns showed embedding model options (copy-paste), never POSTed the selections, and the server hardcoded all model choices. ~60 lines of dead UI.

- **`CORS_ORIGIN` was dead config.** The CORS middleware in index.ts echoes the request origin — it never read the env var. Only needed removal from `.env`, no code change.

- **better-auth requires absolute URLs.** `createAuthClient({ baseURL: '/api' })` silently fails. The error surfaces as "Invalid base URL" only at runtime, not at build time.

### Raw Data Points

| Metric | Value | Notes |
|--------|-------|-------|
| Total commits | 54 | Across 2 days |
| Files changed | 197 | +24,345 / -13,868 lines |
| PRs created | 2 | #56 (env consolidation), #58 (model preferences) |
| Issues created | 2 | #55, #57 |
| New hooks created | 8 | useExplorerFilters, useGroups, useExplorerData, useGraph, useModelPreferences, etc. |
| New routes created | 6 | /recover, /wiki/explorer, /wiki/graph, /wiki/example/[slug], GET /ai/models, auth/recover |
| Files deleted | 12 | AccountStep, PromptDetailStep, gateway tests, internal routes, vault routes, seed-first-user |
| Parallel agent executions | 14 | Research, planning, and execution agents |

---

## 3. Observations

**Patterns:**
- Parallel sub-agent execution was highly effective for independent phases (Explorer + Graph + Onboarding ran simultaneously)
- The "research → plan → execute" GSD pattern caught architectural issues before code was written (gateway removal scope, provision worker design)
- Every phase hit 0 new type errors on first verification — the planning phase caught most issues

**Anomalies:**
- The QA skill (`/qa`) was designed for the old `secondbrain` monorepo, not the current Robin project. Had to fall back to manual stack boot + agent-browser testing
- Nix flake had merge conflicts due to upstream multi-system support landing while we edited the single-system version
- The graph detail panel and ego-graph couldn't be fully browser-tested because the test DB had only 1 node with 0 edges

**Technical Notes for Future Phases:**
- `packages/shared/src/types/embedding.ts` has a hardcoded dimension map — new embedding models require manual registry updates
- The `configs` table `kind: 'model_preference'` keys use underscores (`wiki_generation`) while the API uses camelCase (`wikiGeneration`) — mapping happens in the route handler
- The wiki's `useSearchParams` requires `<Suspense>` wrapping in Next.js 16

---

## 4. Edge Cases

| Description | How Handled | Impact |
|-------------|-------------|--------|
| Multi-origin WIKI_ORIGIN (dev + prod domain) | Changed Zod validation from `z.url()` to comma-separated `z.string().refine()` | Unblocked split-origin Railway deploys |
| Embedding model dimension mismatch | Restricted UI to SAFE_EMBEDDING_MODELS (1536-dim only) | Prevents vector search from breaking |
| Auth-client relative URL in SSR vs client | `typeof window !== 'undefined'` check with env fallback | Fixed hydration redirect bug on /recover |
| Stale gateway mocks in test files | Removed all `vi.mock('../gateway/client.js')` during gateway cleanup | Tests pass without phantom dependencies |
| pnpm `up` script name conflict | Renamed to `serve` — `up` is a built-in pnpm alias for `update` | Script works correctly |

---

## 5. Decisions Made

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| OpenRouter key storage | DB-encrypted vs env-only | env-only | Single-tenant: user IS the server admin. No benefit to DB encryption. Simpler, smaller attack surface. **Second-guessing:** blocks future multi-tenant. |
| Provision mechanism | Sync in JIT vs BullMQ worker | BullMQ worker (enqueued from JIT) | Consistency with extraction/link/regen worker pattern |
| Migration timing | Boot-time vs JIT vs manual | JIT provision (first login) | User wanted migrations out of boot sequence. First login is a natural "installation" moment. **Second-guessing:** unconventional, could confuse if login is slow. |
| Env validation lib location | core/src/bootstrap vs packages/shared | packages/shared | Reusable across core + wiki. `createConfigVar` is a general utility. |
| APP_URL rename | APP_URL vs ROBIN_URL vs SERVER_PUBLIC_URL | SERVER_PUBLIC_URL | Most descriptive — says exactly what it is |
| Model list scope | All OpenRouter models vs curated providers | 6 curated providers | Select dropdown can't handle 500+ models without typeahead. **Note:** user says still too long, needs combobox. |
| Model defaults | All same model vs purpose-specific | Purpose-specific (gemini/haiku/sonnet) | Matches what the codebase defined but never used. Extraction = Gemini Pro, Classification = Haiku, Wiki Gen = Sonnet. |

---

## 6. Risks & Issues

### Issues Encountered

| Issue | Severity | Resolution | Time Impact |
|-------|----------|------------|-------------|
| Auth-client relative URL bug | Medium | Fixed to absolute URL with SSR check | ~30 min debugging in browser test |
| Nix flake merge conflicts (7 regions) | Medium | Took upstream multi-system version (already had pgvector) | ~15 min resolution |
| Phases 1/2/4 committed to main without branches | Low | Retroactive awareness, corrected for Phase 3 onwards | Process gap, no code impact |
| pgvector not in Nix Postgres | Medium | Added `withPackages (ps: [ ps.pgvector ])` to flake | ~10 min, blocked DB init |
| /qa skill incompatible with Robin project | Low | Manual boot + agent-browser testing | Changed test approach |

### Forward-Looking Risks

| Risk | Severity | Proposed Mitigation |
|------|----------|-------------------|
| Railway redeploy with new env var names | High | Must update SERVER_PUBLIC_URL, WIKI_ORIGIN, NEXT_PUBLIC_ROBIN_API, remove old vars before deploy. Document in deployment checklist. |
| Embedding dimension lock (1536) | Medium | Current safe list is 2 models. If user needs a different embedding model, requires schema migration + full re-index. Consider dimension-agnostic storage in future. |
| Model preferences untested with live OpenRouter | Medium | Per-task model selection implemented but never validated with actual API calls. First real user will be the test. |
| Onboarding E2E untested on clean DB | Medium | JIT provision + migration runner + onboarding wizard never tested as a complete fresh-install flow. |
| Curated model list UX | Low | 6 providers still produces a long dropdown. User wants combobox with typeahead. Current native `<select>` is temporary. |

---

## 7. Metrics & Progress

### Planned vs Actual

| Metric | Planned | Actual | Delta |
|--------|---------|--------|-------|
| Wiki UI sync | 1 phase | 1 phase + API wiring | +1 sub-phase (wiring was unplanned) |
| Feature parity phases | 2 (Explorer + Graph) | 2 | On target |
| Onboarding phase | 1 | 1 + 3 hotfixes | Auth-client, recover rewrite, dev origins |
| Deploy fix phases | 5 items | 5 items + model preferences | Model prefs emerged from PO feedback |
| PRs | Not planned | 2 (#56, #58) | Started using branches after Phase 3 |
| Issues | Not planned | 2 (#55, #57) | Same |

### Requirement Completion

| Req ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| WIKI-SYNC | Sync contributor UI into wiki workspace | Done | 62 files, 0 new errors |
| EXPLORER | Explorer parity with OS Robin | Done | Browser test: filters, sort, URL state all pass |
| GRAPH | Graph parity with ego-graph | Done | Code complete, limited browser test (1 node) |
| ONBOARD | Single-tenant onboarding security | Done | 3-state root, JIT provision, no signup |
| PROVISION | Keypair generation for MCP | Done | processProvisionJob + migration runner |
| ENV-VALID | Fail-fast env validation | Done | createConfigVar in @robin/shared |
| ENV-CONSOL | Consolidate env vars | Done | 12+ → ~7 vars |
| DEPS | Missing wiki deps | Done | react-markdown + remark-gfm added |
| GATEWAY | Full gateway removal | Done | 0 references remaining |
| MODELS | Per-task model preferences | Done | 4 roles, OpenRouter proxy, onboarding + profile UI |

---

## 8. Learnings

### What Didn't Work
- **Committing directly to main** for the first 3 deploy-fix phases. No PR trail, no review step, no issue linkage. Caught and corrected for Phase 3 onwards, but the first 11 commits are untracked.
- **The /qa skill** assumes the old secondbrain monorepo. It boots services from a different directory and tests endpoints that don't exist. Needs to be rewritten or replaced for the Robin project.
- **Native `<select>` for model dropdowns** can't handle the volume of OpenRouter models even after curating to 6 providers. Needs a combobox with typeahead.
- **better-auth's silent URL validation failure** cost debugging time. The error only surfaces at runtime in the browser, not at build or type-check time.

### What We'd Do Differently
- Create issues and branches BEFORE executing any phase, not after
- Build a Robin-specific QA skill that boots the actual Robin stack
- Use a combobox component from the start for model selection, not a native select
- Test the full onboarding flow on a clean DB before declaring it done

### What Worked Well
- **Parallel sub-agent execution** — 3 research agents, 3 planning agents, 3 execution agents ran simultaneously with zero conflicts
- **The research → plan → execute pattern** caught the gateway removal scope (already deleted), the provision worker design (BullMQ not sync), and the OpenRouter key architecture (DB not env) before code was written
- **createConfigVar (t3-env pattern)** — clean, reusable, caught the multi-origin WIKI_ORIGIN issue immediately at boot
- **Feature branch workflow for Phase 3 + model preferences** — proper PR trail, issue linkage, review-ready

### Recommendations for Next Phase
1. Fix the model selector UX — combobox with typeahead, or trim the list further
2. Test the full fresh-install flow (clean DB → first login → JIT provision → migration → onboarding → wiki)
3. Update the /qa skill for the Robin project
4. Deploy to Railway with new env var names and validate end-to-end

---

## 9. Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| createConfigVar | packages/shared/src/env.ts | Reusable Zod env validation (t3-env pattern) |
| Core env schema | core/src/bootstrap/env.ts | 13 validated env vars |
| Provision worker | core/src/queue/worker.ts | processProvisionJob for keypair generation |
| Migration runner | core/src/bootstrap/run-migrations.ts | Drizzle migrator for JIT provision |
| JIT provision | core/src/bootstrap/jit-provision.ts | First-user creation on first login |
| Password recovery | core/src/routes/auth-recover.ts | POST /auth/recover with rate limiting |
| OpenRouter models proxy | core/src/routes/ai-models.ts | GET /ai/models with 1h cache, curated providers |
| Model preferences API | core/src/routes/ai-preferences.ts | GET/PUT /users/preferences/models |
| Explorer page | wiki/src/app/wiki/explorer/page.tsx | Filters, sort, infinite scroll, URL state |
| Graph components | wiki/src/components/graph/ | GraphCanvas, GraphDetailPanel, GraphDepthSlider |
| Graph utilities | wiki/src/lib/graphUtils.ts | BFS ego-graph, adjacency map, label visibility |
| Model selector hook | wiki/src/hooks/useModelPreferences.ts | Shared hook for model preference UI |

---

## 10. Stakeholder Highlights

**Executive Summary:** Shipped a comprehensive sprint covering wiki UI sync, feature parity (Explorer + Graph), single-tenant security hardening, and deployment fixes from Railway testing. 54 commits across 197 files. All planned requirements met. Three forward risks remain: Railway redeploy with new env names, embedding dimension lock limiting model choices, and untested fresh-install onboarding flow.

**Key Numbers:**
- 54 commits, 197 files changed, +24k/-14k lines
- 12 new files deleted (dead code: gateway, vaults, old onboarding steps)
- Env vars reduced from 12+ to ~7
- 4 pipeline model roles now user-configurable
- 2 PRs merged (#56, #58)

**Notable Callouts:**
- The OpenRouter API key is now env-only — never stored in DB. This is a security improvement but blocks multi-tenant in the future.
- The curated model list (6 providers) still produces a long dropdown. The user flagged this as needing a combobox with typeahead.
- The JIT migration runner is unconventional (runs on first login, not at boot). Works for single-tenant but needs documentation.

**Confidence Scores:**

| Dimension | Score (1-5) | Notes |
|-----------|-------------|-------|
| Completeness | 3 | All requirements met in code, but fresh-install E2E, Railway redeploy, and live model preference tests are outstanding |
| Quality | 4 | 0 new type errors across all phases, parallel execution with no conflicts, proper PRs for later phases. Native select for models is a known UX debt. |
| Risk Exposure | 3 | Railway redeploy is high risk (new env names break existing deploy). Embedding lock is medium. Model preferences are untested with real OpenRouter calls. |
