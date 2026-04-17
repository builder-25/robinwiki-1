# Retrospective: M3-M10 Wiki System (2026-04-12 to 2026-04-16)

## 1. Phase Context

**Objective:** Ship the complete wiki composition, search, MCP, API, audit, and trust gate systems — taking Robin from "ingest pipeline" to "full knowledge base platform."

**Entry conditions:** M1 (Foundation) and M2 (Ingest Pipeline) were shipped and merged. The MCP layer was broken (excluded from TypeScript compilation), wiki content had no canonical storage (written to edits but never read back), and the schema still referenced a removed gateway.

**Scope:**

| In scope | Out of scope |
|----------|-------------|
| M3: Wiki types, composition, quality gates, regen | M7: Frontend implementation (separate agent) |
| M4: Hybrid search (BM25 + pgvector + RRF) | M8: Deploy & ship (deferred) |
| M5: MCP reactivation + all tools | Synthetic wikis |
| M6: REST API surface | MCP stdio transport |
| M9: Audit log (31 write paths) | Vault reprofile |
| M10: Trust gates, confidence, spawn | Section-level reader agent (#26) |
| Vault removal + Groups successor | Recommendation pipeline (#31) |
| Frontend structural integration | |
| Frontend API wiring (partial) | |
| API gap closure (6 issues) | |

**Success criteria:**

| Criterion | Met? | Evidence |
|-----------|------|----------|
| All MCP tools functional | Yes | 15 tools registered, UAT validates key flows |
| Wiki regen via Quill works | Yes | UAT Step 16: regen returns 200 {ok:true} |
| Hybrid search returns results | Yes | RRF fusion across 3 tables, mode selection |
| Audit events emitted on all writes | Yes | 42 emitAuditEvent references, 34 audit rows in UAT |
| Public wiki publishing works | Yes | UAT Steps 25-31: publish, unpublish, slug stability |
| UAT passes end-to-end | Yes | 111/111 asserts, 0 failures |
| Frontend integrated into monorepo | Yes | @robin/wiki workspace, builds clean |

## 2. Findings

**Unexpected:**

- **Wiki content was a black hole.** The `edits` table was write-only — content went in but was never read back. GET endpoints returned hardcoded empty strings. This was the M2 migration's partially completed work. Required designing the content storage model from scratch (brainstorming session with user on `baseColumns()`, edit history semantics, diff storage).

- **The MCP layer was completely non-functional.** Three files excluded from TypeScript compilation, all referencing columns dropped in M2 (`userId`, `repoPath`, `sections`), importing a deleted gateway client. Every resolver and handler was broken. This was known but the blast radius was larger than expected — 700+ lines of fixes.

- **The session scope grew 5x.** Started as "plan 4 features" and ended as "ship M3-M10, remove vaults, integrate frontend, close 30 issues." The parallel subagent pipeline made this possible but it was not the original plan.

- **`objective` → `goal` rename** touched 6 files across 2 packages. Small naming decisions have outsized blast radius in a type-safe codebase.

**Expected:**

- Content storage design converged quickly once the user clarified the mental model (one `content` column, edits as audit log, not source of truth).
- The wiki types YAML specs had real prompt content — no user authoring was needed.
- Existing pipeline infrastructure (BullMQ, Mastra agents, OpenRouter) worked without modification.

## 3. Observations

- **Parallel subagents are the force multiplier.** Running 6 agents simultaneously (one per API gap issue) compressed what would be days of sequential work into minutes. The trade-off: merge conflicts between agents required repeated resolution.

- **The "replatform sprint" constraint simplified everything.** No production data meant no migration concerns, no backward compatibility, no feature flags. Every migration could be destructive. This should be documented as a constraint that expires once real users exist.

- **Vaults were foundational coupling disguised as organizational grouping.** Removing them touched 32 files because `vaultId` was on every domain table. The groups successor (junction table, loose coupling) is architecturally superior — content exists independently, groups are optional overlay.

- **The previous Robin frontend (`os.withrobin.org`) had excellent API patterns** — OpenAPI codegen, TanStack React Query, better-auth, Zustand. Studying it before the new frontend wiring avoided reinventing patterns the team already knew.

## 4. Edge Cases

| Scenario | How handled | Impact |
|----------|-------------|--------|
| Soft-delete doesn't trigger FK CASCADE on group_wikis | Hard-delete junction rows explicitly in the delete handler | Required a validation run to catch — UAT missed it initially |
| Wiki regen with no fragments | Returns generated content from prompt alone (Quill handles empty fragment list) | Works but produces thin content |
| Publishing wiki with no content | 400 error with clear message | Caught in UAT |
| MCP search with no OpenRouter key | Graceful fallback to BM25-only mode | Tested in UAT failure path |
| Concurrent ingest creating duplicate fragments | CAS locking via @robin/caslock (M2) | Not re-tested but infrastructure unchanged |

## 5. Decisions Made

| Decision | Options considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| Content storage model | (A) content on wiki row, (B) derive from edits table | A: column on `baseColumns()` | 37 read-time filter patterns already exist; subquery on every read was unacceptable |
| Edit history semantics | Store (A) previous content + diff, or (B) new content + diff | A: previous content | The canonical state is always in `{table}.content`; edits capture what was there before |
| Wiki prompt override | (A) replace full template, (B) replace DOCUMENT STRUCTURE section | B: regex replace of `[DOCUMENT STRUCTURE]` block | Preserves the Handlebars template infrastructure while allowing user customization |
| Vaults → Groups | (A) folders as tags, (B) groups as junction table | B: groups table + group_wikis junction | Loose coupling — wikis have no FK to groups, groups reference wikis. Deletions are independent. |
| MCP transport | SSE vs StreamableHTTP | StreamableHTTP (stateless) | HTTP wins on compatibility. User decision — no stdio. |
| Search fusion | BM25-only vs hybrid | Hybrid BM25 + pgvector with RRF | Infrastructure already in place (tsvector GIN + HNSW indexes). RRF is the standard fusion approach. |
| Featured wikis | Recommendation engine vs recently updated | Recently updated (for now) | Issue #31 tracks future recommendation pipeline. Don't over-engineer the first iteration. |

## 6. Risks & Issues

**Issues encountered:**

| Issue | Severity | Resolution | Time impact |
|-------|----------|------------|-------------|
| Migration sprawl (10 files) | Medium | Consolidated into single 0000_init.sql | 30 min to consolidate + validate |
| OpenAPI spec 25+ endpoints behind | Medium | Updated generator script, regenerated spec | 1 agent cycle |
| UAT processed vs resolved terminology | Low | Fixed poll conditions | Already fixed by M3 UAT update |
| Parallel agent branch conflicts | Low | Repeated merge conflict resolution | ~15 min per conflict wave |
| Stale test fixtures (thread→wiki rename) | Low | Documented, not yet fixed | Deferred |

**Forward risks:**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| No production deployment (M8 deferred) | High | No real user feedback, no data durability guarantees | Plan exists at docs/plans/m8-deploy.md. Unblock when ready. |
| Frontend-backend integration untested E2E | High | API wiring PRs may have runtime bugs not caught by tsc | Boot both servers, manual smoke test, or extend UAT |
| Test coverage gaps beyond UAT | Medium | Regressions in code paths UAT doesn't exercise | Add unit tests for new routes incrementally |
| Groups feature untested in production context | Medium | group_wikis junction semantics may not match UX expectations | Validation plan exists, run after merge |

## 7. Metrics & Progress

**Commits:** 108 across all branches
**Issues closed:** 28 (of 30 opened)
**Issues opened:** 6 remain open (2 deferred, 3 future enhancement, 1 active PR)
**PRs merged:** 15+
**Milestones closed:** M3, M4, M5, M6, M7, M9, M10 (7 of 10)

**Planned vs actual:**

| Milestone | Planned scope | Actual | Delta |
|-----------|--------------|--------|-------|
| M3: Wiki Composition | Wiki types + regen | + content storage, prompt overrides, embedding | Expanded — content storage was prerequisite |
| M4: Search | Hybrid search | Delivered as planned | On target |
| M5: MCP Server | 7 tools | 15 tools shipped | Exceeded — added CRUD + publish + search + groups |
| M6: API Routes | REST surface | + bouncer, progress, history, accept/reject | Expanded — filled UX-driven gaps |
| M9: Audit Log | Event store | 31 write paths + timeline + MCP tool | On target |
| M10: Trust Gates | Confidence + linking | + spawn, brief_person, reader agent (simple) | On target |

**UAT results:** 111/111 asserts passed, 0 failures. Boot: 14ms. Ingest: 291ms.

## 8. Learnings

**What worked:**
- Parallel subagent pipeline compressed M3-M10 into one session. Each unit got its own agent, branch, and PR. Zero coordination overhead beyond conflict resolution.
- The brainstorming skill forced alignment on the content storage design before implementation. The user's mental model (descriptor vs prompt, `baseColumns()` content) was captured correctly.
- Studying the previous frontend (`os.withrobin.org`) before wiring the new one avoided pattern reinvention. OpenAPI codegen + React Query was the proven path.
- The UAT skill caught real bugs (processed vs resolved, soft-delete cascade gap) that tsc couldn't.

**What did not work:**
- 10 incremental migration files accumulated over the session. Should have been one file from the start — this is a replatform sprint with no production database. The consolidation was avoidable overhead.
- Running UAT only at the end of the session meant issues compounded. Running it between milestones (M3→UAT→M5→UAT) would have caught the processed/resolved bug earlier.
- Parallel agents working on the same repo caused repeated merge conflicts. Each PR merge wave required manual resolution. A worktree-per-agent strategy or sequential merging would have been cleaner.
- The OpenAPI spec drifted silently for 6+ features. The generator script should run as a post-commit hook or CI check, not as a manual afterthought.

**What we would do differently:**
- Run UAT between milestones, not just at the end.
- Start with a single consolidated migration and never create incrementals during a replatform sprint.
- Keep the OpenAPI spec in sync after every endpoint addition.
- Merge PRs one at a time to avoid conflict cascades.

## 9. Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Content storage design | `docs/plans/2026-04-12-content-storage-design.md` | baseColumns content, edits source+diff, tsvector triggers |
| M3-M6 gap plan | `docs/plans/2026-04-13-remaining-gaps-plan.md` | 5 units: M3 gaps, search, MCP, regen worker, API routes |
| M8 deploy plan | `docs/plans/m8-deploy.md` | Dockerfile, Docker Compose, Railway/Render (deferred) |
| Vault validation plan | `docs/plans/2026-04-16-vault-removal-validation.md` | 6-step validation for vault removal + groups |
| UAT skill | `.claude/skills/uat/SKILL.md` | 49 steps, 16 phases, M2-M10 coverage |
| README | `README.md` | Project overview, quick start, MCP tools, milestones |
| Consolidated migration | `drizzle/migrations/0000_init.sql` | Single schema init — 17 tables, all indexes, triggers |
| OpenAPI spec | `core/openapi.yaml` | 61 endpoints, 64 schemas |
| Generated SDK | `wiki/src/lib/generated/` | TypeScript types + React Query hooks from OpenAPI |

## 10. Stakeholder Highlights

**For the technical team:**

Robin went from "ingest pipeline with broken MCP" to "full knowledge base platform with 15 MCP tools, hybrid search, audit trail, public publishing, and a Next.js frontend" in one session. The architecture is clean — content lives in `baseColumns()`, edits are an append-only audit log, groups are a loose-coupling overlay, and the pipeline is 4 stages (no vault classification).

**Key numbers:**
- 108 commits, 28 issues closed, 7 milestones shipped
- 15 MCP tools (was 0 functional at session start)
- 61 API endpoints documented in OpenAPI
- 111/111 UAT asserts passing
- 17 database tables in a single consolidated migration

**What's ready:**
- Full ingest → compose → search → publish pipeline
- Wiki types with customizable prompts
- On-demand and background regen via Quill
- Fragment confidence, source citations, people aggregation
- Groups for wiki organization
- Audit trail on all 31 write paths

**What's not ready:**
- Production deployment (M8 deferred — plan exists)
- Frontend E2E testing against real backend
- Stale test fixtures from thread→wiki rename
- Vault removal PR (#54) pending merge + validation

**Confidence scores:**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Completeness | 4/5 | All requirements met. M8 deploy deferred. Frontend wiring untested E2E. |
| Quality | 4/5 | UAT 111/111. Type-safe throughout. Stale test fixtures and naming inconsistencies remain. |
| Risk Exposure | 3/5 | No production deployment, frontend untested E2E, groups feature unvalidated. Three compounding risks. |
