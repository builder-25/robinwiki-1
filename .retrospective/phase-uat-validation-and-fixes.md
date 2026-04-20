# Phase: UAT Validation & Bug Fixes — Retrospective

> Generated: 2026-04-18
> Provider(s): gsd, uat, manual

---

## 1. Phase Context

**Objective:** Build a comprehensive UAT suite for the Robin stack, run it against the live server, and fix every bug it exposes — proving the system actually works end-to-end, not just type-checks.

**Scope:**
- **In scope:** UAT plan authoring (all 21 feature areas), runner infrastructure, iterative bug fixing, wiki-type-specific validation, MCP end-to-end flow
- **Out of scope:** YAML bundling fix (ported but not deployed), Railway deploy validation, frontend E2E tests

**Entry Conditions:** All M2-M10 features declared "complete" based on type checks and code review. Product owner reported broken MCP, broken model preferences, and multiple 500 errors in deployed app.

**Success Criteria:**

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | UAT suite covers all 21 feature areas | Done | 20 plans in .uat/plans/, 139 total assertions |
| 2 | All assertions pass on clean DB | Done | 139/139 on final run |
| 3 | MCP ingest works end-to-end | Done | 50 fragments + 36 people extracted from fixture content |
| 4 | No unhandled 500 errors on any endpoint | Done | Settings PUT, Wiki PUT, Entry worker slug collision all fixed |
| 5 | Model preferences pipeline functional | Done | PUT/GET with valid model IDs, OpenRouter cache validation fixed |

---

## 2. Findings

### Expected
- Some endpoints would have missing `isNull(deletedAt)` filters — soft-delete is easy to forget in new queries
- The runner infrastructure was straightforward — bash scripts with curl assertions against a running server
- Wiki-type-specific plans would catch edge cases in extraction output validation

### Unexpected

- **MCP was completely broken, and it took 3 attempts to find the real cause.** The first fix addressed `c.newResponse()` dropping the ReadableStream body. The second addressed response format. The third — the actual fix — was removing a `try/finally` block that called `transport.close()` and `server.close()` before the SSE response stream finished. The enterprise reference had no try/finally. Three "fix" commits for one bug.

- **Model IDs were wrong from day one.** `anthropic/claude-sonnet-4-6` (hyphens) vs `anthropic/claude-sonnet-4.6` (dots). Three characters across 4 files. This was never validated against OpenRouter's actual model registry — the constants were invented from memory, not looked up. The bug was silent until the OpenRouter cache populated with real IDs and every model preference PUT started returning 400.

- **The model preference cache validator had a logic bug that rejected everything.** `getCachedModelIds()` returned an empty `Set` (truthy) when the cache had 0 models after filtering. `!emptySet.has(model)` is always true, so every model was rejected. The fix was returning `null` when the set is empty to skip validation entirely.

- **First run was 121/131 (92%).** The 8% failure rate mapped to 8 distinct code bugs — not noise, not flaky tests. Every failure pointed at a real defect that would have hit users in production.

### Raw Data Points

| Metric | Value | Notes |
|--------|-------|-------|
| UAT plans created | 20 | Covering all 21 feature areas |
| Total assertions | 139 | After test bug fixes (started at 131) |
| First-run pass rate | 92% (121/131) | 10 failures across 8 distinct bugs |
| Final pass rate | 100% (139/139) | Clean DB, all bugs fixed |
| Code bugs fixed | 8 | MCP, model IDs, soft-delete, slug uniqueness, entry worker, settings schema, cache validation, YAML bundling |
| Test bugs fixed | 2 | Assertion logic errors in test plans themselves |
| Wiki-type test plans | 11 | One per wiki type |
| Fragments extracted | 50 | From fixture content via MCP |
| People extracted | 36 | From fixture content via MCP |
| Fix attempts for MCP | 3 | Before finding the real cause |

---

## 3. Observations

**Patterns:**
- Every bug that survived to UAT had passed type checks. `npx tsc --noEmit` returning 0 errors was reported repeatedly as proof of correctness — it proves nothing about runtime behavior
- Soft-delete filter omissions were systematic — 5 queries across 2 files (wikis and people). If one query missed it, all queries of the same vintage missed it
- Slug uniqueness was handled in POST but not PUT for wikis, and in initial insert but not upsert for entries — the same class of bug (uniqueness constraint on write path) appeared twice in different subsystems

**Anomalies:**
- The MCP bug was architecturally invisible. The try/finally pattern looks correct — resource cleanup after request handling. But SSE responses stream after the handler returns, so the cleanup kills the stream mid-flight. This is a fundamental misunderstanding of SSE lifecycle, not a typo
- The model ID format bug (dots vs hyphens) would have been caught by a single curl to the OpenRouter API during development. It was never run

**Technical Notes for Future Phases:**
- Enterprise MCP handler returns `transport.handleRequest()` directly with no wrapping try/finally — this is the correct pattern for SSE transports
- OpenRouter model IDs use dots for version separators (e.g., `claude-sonnet-4.6`), not hyphens — always validate against the live API
- `packages/shared/src/prompts/models.ts` is the single source of truth for model constants — any model ID fix must start there
- Empty `Set` is truthy in JavaScript — never use a Set's truthiness as a "has items" check

---

## 4. Edge Cases

| Description | How Handled | Impact |
|-------------|-------------|--------|
| Wiki PUT with duplicate name generating existing slug | Added `resolveWikiSlug()` call matching POST handler | Prevented unhandled 500 on wiki rename |
| Two entries generating identical slugs during extraction | Removed `slug` from ON CONFLICT SET clause | Prevented entry upsert from overwriting wrong entry's slug |
| Settings PUT with partial body (`{"theme":"dark"}`) | Made all top-level schema fields optional, merge with existing | Prevented 400 on partial settings update |
| Model cache empty after filtering (0 valid models) | Return null instead of empty Set, skip validation | Prevented all models from being rejected |
| SSE response stream outliving handler function | Removed try/finally, return transport response directly | Fixed MCP returning empty bodies |
| Soft-deleted wiki returned by GET /:id | Added `isNull(deletedAt)` to 5 queries | Prevented "ghost" records appearing after deletion |

---

## 5. Decisions Made

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| UAT format | Jest integration tests vs bash+curl plans | Bash+curl in .md files | Tests the real HTTP surface, no mocking, readable by non-engineers. **Second-guessing:** harder to maintain than programmatic tests, no assertion library. |
| MCP fix approach | Patch try/finally vs match enterprise pattern | Match enterprise pattern exactly | The enterprise handler works in production. Our "improved" version with resource cleanup broke SSE. Copy what works. |
| Model cache empty behavior | Return empty Set vs return null | Return null (skip validation) | An empty cache means "we don't know what's valid" — rejecting everything is worse than accepting everything. **Second-guessing:** could allow invalid models through during cache cold start. |
| Settings schema | Require all fields vs partial updates | Partial updates with merge | Standard REST PATCH semantics. Requiring full objects for settings is hostile to clients. |

---

## 6. Risks & Issues

### Issues Encountered

| Issue | Severity | Resolution | Time Impact |
|-------|----------|------------|-------------|
| MCP empty body (PO's #1 blocker) | Critical | 3 fix attempts — final fix: remove try/finally, match enterprise SSE pattern | ~2 hours across 3 attempts |
| Model ID format wrong (dots vs hyphens) | High | Fixed in shared constants + 3 frontend files | ~30 min, but existed since initial implementation |
| Wiki soft-delete not filtered | Medium | Added isNull(deletedAt) to 5 queries across 2 files | ~20 min |
| Wiki PUT 500 on slug collision | Medium | Added resolveWikiSlug() to PUT handler | ~15 min |
| Entry worker slug collision on upsert | Medium | Removed slug from ON CONFLICT SET | ~15 min |
| Settings PUT 400 on partial body | Medium | Made schema fields optional + merge logic | ~15 min |
| Model cache rejecting all models | Medium | Return null for empty cache | ~20 min debugging the logic |
| YAML specs not bundled in dist | Medium | Ported enterprise fix (copy step in build) | ~15 min, still blocks Railway deploy |

### Forward-Looking Risks

| Risk | Severity | Proposed Mitigation |
|------|----------|-------------------|
| YAML bundling still blocks wiki regeneration on Railway | High | Must complete the build copy step and validate in deployed environment |
| New models with different naming conventions | Medium | Add a model ID validation step that checks against live OpenRouter API, not hardcoded constants |
| UAT suite maintenance burden | Medium | 20 bash-based plans with embedded scripts will drift as API changes. Consider generating from OpenAPI spec. |
| Enterprise pattern divergence | Medium | MCP fix was found by comparing to enterprise. No automated check that patterns stay in sync. |

---

## 7. Metrics & Progress

### Planned vs Actual

| Metric | Planned | Actual | Delta |
|--------|---------|--------|-------|
| UAT plans | ~20 | 20 | On target |
| First-run pass rate | 100% (hoped) | 92% | -8% (10 failures) |
| Bug fixes needed | 0 (hoped) | 8 code + 2 test | +10 total fixes |
| MCP fix attempts | 1 | 3 | 2 wasted attempts |
| Wiki-type plans | Not planned | 11 | Emerged from testing |
| Final pass rate | 100% | 100% | On target after fixes |

### Requirement Completion

| Req ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| UAT-SUITE | Full UAT coverage for all features | Done | 20 plans, 139 assertions |
| UAT-RUNNER | Automated runner with logging | Done | .uat/run.sh, logs in .uat/logs/, summaries in .uat/runs/ |
| BUG-MCP | MCP returns non-empty responses | Done | Fixture content ingested, fragments + people extracted |
| BUG-MODELS | Model preferences work end-to-end | Done | Correct IDs, cache validation fixed |
| BUG-SOFTDEL | Soft-deleted records filtered | Done | 5 queries patched |
| BUG-SLUGS | No slug collision crashes | Done | Wiki PUT + entry worker upsert fixed |
| BUG-SETTINGS | Partial settings updates accepted | Done | Schema relaxed, merge logic added |
| WIKI-TYPES | Per-type extraction validation | Done | 11 wiki-type-specific test plans |

---

## 8. Learnings

### What Didn't Work

- **"0 new type errors" as a quality signal.** This was cited repeatedly as proof of correctness throughout prior phases. Every bug found by UAT passed type checks. Type safety is necessary but proves nothing about runtime behavior. The MCP bug, the model ID bug, the cache logic bug, the soft-delete omissions — all invisible to `tsc`.

- **Claiming features "done" without end-to-end testing.** The MCP endpoint, model preferences, wiki CRUD, and settings were all declared complete based on code review and type checks. The product owner was the first person to actually call these endpoints, and they were broken.

- **Fixing MCP by reasoning about what should work.** The first two fix attempts were based on understanding the Hono response API and SSE semantics. The fix that worked was copying the enterprise pattern character-for-character. When a reference implementation exists, read it first.

- **Inventing model IDs from memory instead of looking them up.** `claude-sonnet-4-6` vs `claude-sonnet-4.6` — this was never validated against the actual OpenRouter API. A single API call during development would have caught it.

### What We'd Do Differently

- Write UAT plans BEFORE declaring a feature complete, not after the PO reports it broken
- Always compare against the enterprise reference for infrastructure patterns (MCP, SSE, transport) before writing new code
- Validate all external identifiers (model IDs, API formats) against the live service, not from memory
- Treat an empty collection as a distinct state from "no collection" — the Set truthiness bug is a JavaScript classic that should be caught by code review

### What Worked Well

- **The UAT suite itself was highly effective.** 20 plans, 139 assertions, 8 real bugs found in the first run. The plans are idempotent, re-runnable, and readable. They proved that the system works (or doesn't) in a way that type checks never could.
- **Iterative fix-and-rerun cycle** — fix a bug, rerun the full suite, confirm no regressions, repeat. Clean signal, fast feedback.
- **Enterprise comparison** solved the MCP bug that 2 reasoning-based attempts couldn't. When you have working reference code, use it.
- **The runner infrastructure** (run.sh, logs/, runs/) makes UAT repeatable. Any future change can be validated in minutes.

### Recommendations for Next Phase

1. **Fix YAML bundling** — wiki regeneration is blocked on Railway until `packages/shared` build copies YAML specs to dist/
2. **Add model ID validation against live OpenRouter** — fetch the model list at build/boot time and validate constants against it
3. **Run UAT before every deploy** — the suite exists now, use it as a gate
4. **Add UAT plans for new features at development time**, not retroactively after bugs are reported
5. **Never cite `tsc --noEmit` as evidence of correctness** — always pair with end-to-end validation

---

## 9. Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| UAT plans | .uat/plans/*.md | 20 feature-area test plans with embedded bash assertions |
| UAT runner | .uat/run.sh | Executes one or all plans, logs results |
| UAT logs | .uat/logs/ | Per-run output logs |
| UAT summaries | .uat/runs/ | Per-run pass/fail summaries |
| Wiki-type plans | .uat/plans/wiki-type-*.md | 11 per-wiki-type extraction validation plans |
| MCP fix | core/src/routes/mcp.ts | Removed try/finally, direct transport.handleRequest() return |
| Model constants | packages/shared/src/prompts/models.ts | Fixed dot-separated model IDs |
| Soft-delete filters | core/src/routes/wikis.ts, core/src/routes/people.ts | Added isNull(deletedAt) to 5 queries |
| Wiki slug resolution | core/src/routes/wikis.ts | Added resolveWikiSlug() to PUT handler |
| Entry worker upsert | core/src/queue/worker.ts | Removed slug from ON CONFLICT SET |
| Settings schema | core/src/routes/settings.ts | Made fields optional, added merge logic |
| Cache validation | core/src/routes/ai-preferences.ts | Return null for empty model cache |

---

## 10. Stakeholder Highlights

**Executive Summary:** Built a 139-assertion UAT suite and ran it against the Robin stack. First run exposed 8 real bugs — including the PO's #1 blocker (MCP returning empty bodies) and a silent model ID format error that broke the entire preference pipeline. All bugs fixed, final run 139/139. The uncomfortable truth: every one of these bugs existed in code that was previously declared "complete" based on type checks alone.

**Key Numbers:**
- 139 assertions across 20 UAT plans — first run 92%, final run 100%
- 8 code bugs fixed, 2 test bugs fixed
- 3 attempts to fix MCP before finding the real cause
- 3 characters wrong (`.` vs `-`) broke the entire model preference pipeline
- 50 fragments + 36 people successfully extracted via MCP after fixes

**Notable Callouts:**
- The MCP bug was caused by a try/finally pattern that looks correct but kills SSE streams prematurely. The enterprise reference had no try/finally. This class of bug is invisible to type checks, code review, and static analysis — only end-to-end testing catches it.
- The model ID bug was preventable with a single curl to the OpenRouter API. It wasn't run.
- YAML bundling still blocks wiki regeneration on Railway. This is the one remaining known issue.

**Confidence Scores:**

| Dimension | Score (1-5) | Notes |
|-----------|-------------|-------|
| Completeness | 4/5 | All API endpoints validated, MCP works end-to-end. Wiki regen still blocked by YAML bundling on Railway. |
| Quality | 3/5 | Bugs were real and impactful. Some required 3 attempts to fix. The fact that 8 bugs survived to UAT after being declared "done" is a process failure. |
| Risk Exposure | 3/5 | YAML bundling blocks wiki regen on Railway. Model ID naming conventions could recur with new models. UAT suite needs to be run as a deploy gate, not an afterthought. |
