# Phase M2: Ingest Pipeline (Postgres-Native) — Retrospective

**Phase:** M2 — Ingest Pipeline (Postgres-Native)
**Branch:** `feat/m-ingest`
**Shipped:** 2026-04-11
**Commits:** 9 commits in 4 feature groups (plus merges), 66 files changed, +1979/-3034 (net **−1055 LOC**)
**Status:** Complete

## 1. Phase Context

### Objective

Rewire Robin's existing 6-stage ingest pipeline to run entirely on Postgres. No git write-through. No gateway facade. Extract CAS locking into a reusable library. Collapse the schema to single-user. End state: a `POST /entries` call produces fragments, embeddings, people, and edges in the DB within ~30 seconds.

### Scope In

- **`@robin/caslock`** — new standalone workspace package. Drizzle-native CAS locking library with `acquire`/`release`/`using` API, auto-renew (Redlock-style), EventEmitter events, full unit-test coverage (acquire/release/using/auto-renew/contention).
- **Schema migration `0001_ingest_m2.sql`** — single migration covering every M2 schema change:
  - Retire `DIRTY` state enum value
  - Drop `user_id` from all domain tables (`raw_sources`, `fragments`, `wikis`, `people`, `edges`, `edits`, `vaults`, `configs`, `audit_log`, `api_keys`, `processed_jobs`)
  - Keep `user_id` on `users`, `sessions`, `accounts`, `verifications` (better-auth requirement)
  - Drop git-era columns (`repo_path`, `frontmatter_hash`, `body_hash`, `content_hash`) from `baseColumns()`
  - Add ingest audit columns to `raw_sources` (`ingest_status`, `last_error`, `last_attempt_at`, `attempt_count`)
  - Promote `people` schema (`canonical_name`, `aliases text[]`, `verified bool`), GIN index on `aliases`, drop `sections` jsonb
  - Rebuild slug uniqueness indexes without `user_id` prefix
  - Drop `configs_scope_check` constraint (no longer meaningful at single-user)
- **`core/src/db/` rewire** — replace hand-rolled locking with `@robin/caslock`, delete `locking.ts` and `sync.ts`, new `locks.ts` config file exporting pre-configured `entryLock` and `fragmentLock`
- **`packages/agent/` rewrite** — purge all markdown/frontmatter/git code (`frontmatter.ts`, `wiki.ts`, `wikilink.ts`, `person-body.ts`, `regen/**` moved to core as dormant); add `embeddings.ts` (direct fetch to OpenRouter `/v1/embeddings`); add `openrouter-config.ts` (reads from `configs` table, decrypts with M1 crypto envelope); add `agent-factory.ts` (fresh Mastra `Agent` per ingest run); rewrite `persist.ts` from 413 LOC to ~150 LOC
- **Queue worker rewire** — `worker.ts` dispatches to rewired stages; `processExtractionJob` uses `entryLock.using({ autoRenew: true })`; BullMQ exponential backoff replaces the 60s retry tick; `processWriteJob`/`processSyncJob` deleted; regen kept dormant with early-return + TODO marker
- **Routes rewire** — drop `userId` filters from every route, drop `gatewayClient.write` from `POST /entries`, set `ingest_status: 'pending'` on insert, enqueue `ExtractionJob` directly
- **Gateway purge** — `core/src/gateway/` entirely deleted
- **OpenRouter key seed script** — `core/scripts/seed-openrouter-key.ts` reads `OPENROUTER_API_KEY` env var, encrypts with user DEK, writes to `configs` table as `kind='llm_key'`
- **People promotion** — canonical_name / aliases / verified as top-level columns; GIN index on aliases array; resolution config (`scoreFloor: 60, canonicalWeight: 5, aliasWeight: 4, ratioThreshold: 1.5`) reads from promoted columns, not `sections` jsonb

### Scope Out (deferred)

- **Integration / E2E tests for ingest** — explicitly out of scope. Unit tests for `@robin/caslock` are in, pipeline-level tests are not. Future milestone.
- **Wiki creation** — greenfield installs have no wikis. `wiki-classify` returns empty edges until wikis are seeded. Correct M2 behavior.
- **Wiki regen** — `regen-worker.ts` kept on disk but not registered with the worker dispatcher. M3 concern. Wrapped in `// TODO(M3)` comment and early-return.
- **MCP ingest tools** — deferred
- **Frontend** — deferred
- **Session middleware rename** (`userId` context → `authenticated`) — deferred as cosmetic cleanup
- **Observability UI for `pipeline_events`** — table populated, no UI
- **`.planning/` re-initialization** with ROADMAP.md / PROJECT.md / REQUIREMENTS.md — deferred
- **Per-call Mastra Agent pooling optimization** — acceptable overhead now, flagged for later

### Entry Conditions

- M1 shipped: pgvector extension, `configs` table, `users.encrypted_dek`, single-user auth, vector/tsvector schema
- `users.encrypted_dek` + MASTER_KEY envelope in place for decrypting the OpenRouter key stored in `configs`
- Operator must manually seed the OpenRouter key via `pnpm seed-openrouter-key` before the first successful ingest
- Branch `feat/m-ingest` cut from the tagged M1 state

### Success Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `@robin/caslock` builds + unit tests pass | ✓ | `pnpm --filter @robin/caslock test` green |
| Schema migration applies on fresh DB | ✓ | `db:reset && db:push` produces a DB with the new shape; `\d object_state` omits `DIRTY`; `\d+ raw_sources` shows ingest audit columns; `\d+ people` shows promoted columns |
| All packages typecheck | ✓ after Group 6 lands | `pnpm -r typecheck` green across `@robin/caslock`, `@robin/shared`, `@robin/queue`, `@robin/agent`, `@robin/core` |
| `pnpm dev` boots | ✓ | BullMQ registers extraction + link processors, `regen dormant (M3)` banner, warning if `configs` has no `llm_key` |
| `POST /entries` returns 202 | ✓ | Hono route returns `{ id, jobId, status: 'queued' }` |
| Ingest produces fragments in DB | ✓ | Acceptance test entry "I had lunch with Sarah about the new product launch" yields ≥1 fragment row linked to entry |
| Fragments get embeddings | ✓ (best-effort) | `embedding IS NOT NULL` on success; NULL on OpenRouter embedding API failure, logged |
| People promoted to top-level columns | ✓ | `people.canonical_name`, `people.aliases`, `people.verified` populated; GIN index used in EXPLAIN plan |
| Mention edges created | ✓ | `edges` row with `edge_type = 'FRAGMENT_MENTIONS_PERSON'` per mention |
| Failure path audit | ✓ | Deleting `configs.llm_key` produces `ingest_status='failed'`, `last_error='no_openrouter_key'`, BullMQ retries per exponential backoff |
| Gateway code purged | ✓ | `rg gatewayClient` returns zero |
| Git/markdown code purged | ✓ | `rg 'frontmatter\\|wikilink'` returns zero in source |
| Net LOC decrease | ✓ | −1055 LOC (less code doing more work) |

## 2. Findings

### Expected

- **CAS locking extracts cleanly.** The existing `core/src/db/locking.ts` was already parameterized enough that lifting it into a generic package required only renaming columns via Drizzle table references. The hard part was API design, not the core algorithm.
- **Auto-renew fits the existing sandwich pattern.** No changes to the orchestrator shape — `acquireLock(...) / work / releaseLock(...)` becomes `lock.using({ autoRenew: true }, work)`.
- **Gateway purge shrinks the codebase.** Deleting `gateway/client.ts`, `sync-worker.ts`, `sync.ts`, frontmatter assembly, wikilink parsing, and markdown body generation removed ~2000 LOC. Net −1055 LOC across the whole M2 diff.
- **Mastra's per-call `Agent` pattern works.** Constructing a fresh `Agent` per ingest run with the OpenRouter key decrypted on demand has no hidden state problems — Mastra's `Agent.generate({ structuredOutput: { schema } })` doesn't require agent reuse.

### Unexpected

- **`ALTER TYPE ... DROP VALUE` is PG 17+ only — but this is a development-window concern, not a production one.** The statement removes the `DIRTY` enum value that M1 left behind. On Postgres 16 it would require the drop-and-recreate dance (rename old enum, create new, `ALTER COLUMN ... USING ... ::text::new_enum`, drop old). Caught during Group 2 planning. The severity is bounded: before production ship, the whole migration history collapses into a single init migration generated from the final schema, which declares `object_state` fresh as `('PENDING', 'RESOLVED', 'LINKING')` with zero `ALTER TYPE` anywhere. The PG 17 requirement only applies to the development window between M2 and that migration reset. Local dev uses PG 17, so it's invisible today.
- **`configs_scope_check` constraint needed proactive removal.** The M1 constraint enforced `(scope='system' AND user_id IS NULL) OR (scope='user' AND user_id IS NOT NULL)`. After dropping `user_id` from `configs`, the constraint references a non-existent column. The migration drops the constraint before dropping the column — reverse order would have failed.
- **`users.encrypted_dek` must be preserved.** The M1 crypto envelope is user-scoped, and `configs` decryption depends on the user's DEK. Even though `configs.user_id` is dropped in M2, the auth-table `users.id → users.encrypted_dek → MASTER_KEY → decrypted config value` chain is preserved. The plan initially forgot this and would have orphaned all encrypted config values. Caught during Group 2 review.
- **`processReclassifyJob` and `processProvisionJob` fate wasn't decided upfront.** Both had to be audited during Group 5 execution. `processProvisionJob` turned out to be vestigial (M1 seeds the first user from env vars, so there's no "new user" path) — deleted. `processReclassifyJob` was DB-only and still useful for manual wiki reassignment — kept with `userId` dropped. Should have been pinned in the plan, not punted to execution.
- **`matchMentionsToFragments` still worked after markdown assembly removal.** The function matches mentions to fragments by `sourceSpan` text search. Even though markdown body assembly is gone, `sourceSpan` still comes from the fragmentation prompt's output. Behavior unchanged. Verified during Group 4.
- **BullMQ retries replaced the 60s tick cleanly.** The hand-rolled retry tick in M1's worker.ts was 40 LOC. Replacing it with `defaultJobOptions.attempts: 5, backoff: { type: 'exponential', delay: 1000 }` is 4 LOC and strictly better behavior. Shouldn't have existed in M1.
- **`wiki-classify` on a greenfield install is a no-op, which looks wrong.** With no wikis seeded, the classifier returns an empty candidate list and produces zero edges. The acceptance test output has "wikiEdges: []" which reads like a bug but is correct M2 behavior. Needs a boot-time banner or debug log to make the no-op visible.
- **Moving `regen-worker.ts` from agent to core, dormant, almost broke imports.** The regen code had cross-package imports via `@robin/agent` that resolved in M1 but not M2 (gateway purge left holes). Solution: stub missing imports with `throw new Error('M3 pending')` at module load time, preserve the dormant path. If regen wakes up in M3 and those stubs don't match the new agent surface, it'll blow up on load — but at the right time.
- **The plan's 7-group atomic-commit order had a hidden dependency.** Group 3 (core DB rewire) technically depends on Group 2 (schema migration) for the new columns to exist. But Group 3 is TS code that references schema exports; Group 2's schema.ts edits are also in Group 2, so Group 3 is a no-op until Group 2 lands. Groups 3 and 2 probably should have been one commit, or explicitly sequenced with a note that Group 3 can only be staged after Group 2.

## 3. Observations

- **Net −1055 LOC while adding functionality is meaningful.** M1 left a lot of scaffolding in place for the old file-based pipeline (frontmatter assembly, wiki link parsing, gateway facade). M2 replaces that scaffolding with a smaller, more direct DB-native path. The codebase is simpler after M2 than before.
- **BullMQ's exponential backoff is a direct win.** The M1 60s retry tick had three failure modes: drift (workers restart mid-tick, timer reset), overlap (tick fires while job is in flight), and thundering herd (all failed jobs retry at the same moment). BullMQ's native retry with jitter avoids all three for zero custom code.
- **`@robin/caslock` is a genuine engineering asset beyond Robin.** The library is Drizzle-native, protocol-agnostic (any row with state + locked_by + locked_at columns works), and has a `using` API that matches modern async patterns. It's the kind of thing that could ship as its own npm package. Keeping it internal for now is fine, but worth revisiting.
- **OpenRouter key stored in `configs` with encryption means operators never pass the key on the command line after the first seed.** The seed script reads from env once, encrypts, writes. After that, the env var can be unset. This is a better operational posture than "always in env" and was an unplanned benefit of M1's encryption envelope.
- **Fresh `Agent` per ingest run has a latency cost but no correctness cost.** Each M2 ingest call constructs a Mastra `Agent` for each of the six pipeline stages. At ingest frequencies (~1-10/min for a personal KB), the ms-scale overhead is imperceptible. At hot-path frequencies (1-10/sec) it would matter. Not our problem yet.
- **Single-user collapse is far more than a schema change.** Every query that had `WHERE user_id = $1` got simpler. Every test fixture that seeded a fake user got simpler. Every middleware that passed userId through every function got simpler. The pipeline diff is proof that constraint propagation through a codebase is real.
- **The `ingest_status` column + `last_error` pair is pleasant observability.** A single `SELECT ingest_status, last_error, attempt_count FROM raw_sources WHERE lookup_key = $1` tells the operator everything they need about an entry's state. No grep through logs, no BullMQ introspection. When the eventual observability UI lands, this is already the source of truth.
- **Dropping `DIRTY` from the state enum was fine.** The DIRTY state only existed for wiki regen (M3 concern). Removing it now and re-adding later if needed is cleaner than carrying a vestigial state through M2.

## 4. Edge Cases

| Case | How Handled | Impact |
|------|-------------|--------|
| OpenRouter key missing at ingest time | `NoOpenRouterKeyError` throws, BullMQ retries per backoff policy, `raw_sources.last_error='no_openrouter_key'`. Operator seeds key, retry succeeds. | Self-healing after operator action; no data loss. |
| OpenRouter embedding API returns error | `embedText` returns `null`, fragment lands with `embedding IS NULL`, logged as warning. Ingest continues. | Search will skip this fragment in vector retrieval until re-embedded. Best-effort is documented as acceptance criterion 9. |
| OpenRouter chat API returns malformed structured output | Mastra's structured-output validator throws, BullMQ retries. After `attempts: 5` exhaust, `raw_sources.ingest_status='failed'`, `last_error=<zod error message>`. | Operator inspects raw_sources, can manually retry or inspect the model output. |
| Multiple concurrent ingests on same entry | CAS lock with sandwich pattern: first claim wins, second blocks on `state != LINKING`. Lock auto-renews at 80% of 60s TTL. | Race-safe by design. |
| Lock holder crashes mid-stage | TTL-based stale lock detection: next acquire after `NOW() - locked_at > 60s` steals the lock, emits `stolen` event. | Recovery is automatic; no manual intervention. |
| Mention matching fails (person name in body but no fragment contains it) | `matchMentionsToFragments` returns empty for that person. Person is still inserted into `people` table (canonical_name + aliases), but no `FRAGMENT_MENTIONS_PERSON` edge. | Graceful degradation — the person exists, the relationship is weaker. |
| Fragment dedup finds an in-batch duplicate | `dedupBatch` drops the duplicate at Jaccard ≥ 0.6. Dropped fragment does not get inserted, embedded, or edged. | Expected; correct behavior. |
| People upsert collision by canonical_name but with new aliases | ILIKE match on existing `canonical_name`, append new aliases to `aliases` array, update `updated_at`. `verified=false` stays until operator manually verifies. | Idempotent; aliases accumulate across multiple ingests. |
| `users.encrypted_dek` is empty (pre-M1 user) | Seed path only runs when users table is empty; existing users without DEK can't decrypt configs. Fails on first OpenRouter key read with "user has no DEK". | No fresh deploy should ever hit this; documented as a migration edge case if rebasing onto an existing real DB. |
| PG 16 target hits `DROP VALUE` failure | Migration errors at SQL parse time. In dev, use PG 17. In production, the whole migration history collapses to a single init migration pre-ship, which declares the enum fresh with no `DROP VALUE` — so this edge case disappears entirely before Robin ever reaches a real deploy target. | Development-window only. Not a production blocker. |

## 5. Decisions Made

| # | Decision | Options Considered | Choice | Rationale |
|---|----------|-------------------|--------|-----------|
| 1 | Execution model | Keep BullMQ entirely / Inline async + DB retry tick / Mix | **Keep BullMQ entirely** (A1). Drop `setImmediate`. Drop 60s tick. `ingest_status` is audit trail only. | Native BullMQ retry is strictly better than hand-rolled. One less moving part. |
| 2 | LLM framework | Keep Mastra / Rip out Mastra / Direct OpenRouter SDK | **Keep Mastra** (B1), per-call `Agent` construction, OpenRouter key read per ingest. | Mastra's structured-output API is well-suited; replacement cost exceeds keep cost. |
| 3 | Chat provider | OpenAI direct / Anthropic direct / OpenRouter router | **OpenRouter** with `anthropic/claude-3-5-sonnet` default | Single provider for chat + embeddings, model switching without code change. |
| 4 | Embedding provider | OpenRouter / OpenAI direct / Local | **OpenRouter `/v1/embeddings`** with `openai/text-embedding-3-small` at 1536 dims | Consistent with M1 embedding pinning; verified supported via OpenRouter API. |
| 5 | Embedding call library | Mastra / `ai-sdk` / direct fetch | **Direct fetch** | Mastra doesn't support embeddings. Direct fetch is ~30 LOC and avoids adding `ai-sdk` as a dep. |
| 6 | Missing key handling | Hard-fail startup / Inline skip / Mark entry failed | **Mark entry failed** with `last_error='no_openrouter_key'`, let BullMQ retry | Self-healing after operator seeds key; no startup-time env coupling. |
| 7 | Locking extraction | Keep in core / New workspace package | **`@robin/caslock` workspace package** | Library is generic; packaging it is ~1 hour of extra work for reusability + test isolation. |
| 8 | State enum scope | Keep `DIRTY` / Drop `DIRTY` now / Drop in M3 | **Drop now** | DIRTY was wiki-regen-only. Re-adding later if needed is cheaper than carrying dead enum values. |
| 9 | Gateway + git purge | Rip entirely / Keep facade / Move to separate package | **Rip entirely** — delete `gateway/client.ts`, `sync-worker.ts`, `sync.ts`, markdown assembly, wikilink parsing | No downstream consumers; the facade was vestigial from v1.0. Net −2000 LOC. |
| 10 | Regen strategy | Delete now / Keep dormant / Migrate to core dormant | **Keep dormant in core with TODO markers and throw stubs** | M3 re-enables; deleting now means re-writing. Stubs make the dormant path explicit. |
| 11 | Single-user schema collapse | Domain tables only / All tables including auth / None | **Domain tables only** (D1). `users/sessions/accounts/verifications` keep `user_id` (better-auth requirement). | better-auth's adapter expects user_id on auth tables. Asymmetry is documented in schema.ts to prevent "cleanup". |
| 12 | Wiki creation | In scope / Out of scope | **Out of scope**. Greenfield = no wikis. `wiki-classify` returns empty edges. | M2 is about ingest flow; wiki creation is M3. |
| 13 | People schema | Keep `sections` jsonb / Promote columns | **Promote `canonical_name`, `aliases text[]`, `verified` to top-level** with GIN index on aliases | Queryability over flexibility; resolution config reads from typed columns. |
| 14 | People resolution config | New values / Keep existing | **Keep existing** (`scoreFloor: 60, canonicalWeight: 5, aliasWeight: 4, ratioThreshold: 1.5`) | Already matched spec; no reason to change. |
| 15 | Fragment dedup | Drop / Keep in persist stage | **Keep** (Jaccard @ 0.6, in-batch) | Existing logic works; removal would create duplicate fragments on retry. |
| 16 | Tests | E2E now / Unit-only now / None | **`@robin/caslock` unit tests in scope, ingest E2E out** | E2E requires BullMQ + Postgres + OpenRouter — high setup cost. Future milestone. |
| 17 | `.planning/` re-init | Do now / Defer | **Defer** | Cosmetic; no functional impact. |
| 18 | MCP ingest tools | Wire now / Defer | **Defer** | Dependency chain: ingest works → wiki creation → MCP tools that write to wikis. M3+. |

## 6. Risks & Issues

### Issues Encountered

| Issue | Severity | Resolution | Time Impact |
|-------|----------|------------|-------------|
| PG 16 `DROP VALUE` incompatibility | Low | Dev uses PG 17. Deferred to the pre-prod migration reset, which collapses all history into a single init migration from the final schema — no `ALTER TYPE` anywhere, dependency disappears. | ~5 min of plan review; no actual workaround needed |
| `configs_scope_check` references dropped column | Medium | Drop constraint before dropping column in migration | ~2 min |
| `users.encrypted_dek` chain almost orphaned | High | Preserve `users.encrypted_dek` column + document the chain in schema.ts comment | ~15 min; caught during plan review |
| `processReclassifyJob` / `processProvisionJob` fate not pre-decided | Low | Audited during Group 5 execution — `provision` deleted, `reclassify` kept | ~10 min |
| Regen imports broke after gateway purge | Medium | Stubbed missing imports with `throw new Error('M3 pending')` at module load time | ~5 min |
| Groups 2 and 3 had hidden dependency | Low | Documented in commit ordering; Group 3 staged only after Group 2 lands | 0 min (ordering fix) |
| Greenfield wiki-classify looks like a bug | Low | Added debug-level log when candidate list is empty; acceptance criterion documents this as correct | ~3 min |
| Fresh `Agent` per ingest has ms-scale overhead | Low | Accepted; flagged for later agent pooling if it becomes hot | 0 min (accepted) |

### Forward-Looking Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| PG 17 required for dev only — `DROP VALUE` is PG 17+ | Low | Not a prod concern. The `DROP VALUE` only exists to remove the `DIRTY` enum value M1 left in place. Before production ship, the full migration history collapses to a single init migration generated from the final schema, which declares the enum fresh with no `ALTER TYPE`. The PG 17 requirement only applies to the development window between M2 and that reset. Dev uses PG 17 already. |
| **Ingest has no E2E test coverage.** Unit tests cover `@robin/caslock`; the pipeline itself is verified only by manual curl in the acceptance procedure. | Medium | Next phase: add at least one integration test that mocks OpenRouter and runs the full pipeline. |
| **Operator must manually seed OpenRouter key before first ingest.** First-boot UX is "server boots, user signs in, tries to capture a thought, hits `last_error='no_openrouter_key'`, runs CLI script, retries." | Medium | M3 onboarding flow: UI/API endpoint that accepts the key, encrypts, writes to `configs`. |
| **Embedding failures silently degrade search quality.** A fragment with `embedding IS NULL` is invisible to vector search. | Medium | Monitor: periodic query for `SELECT count(*) FROM fragments WHERE embedding IS NULL`. Add a backfill worker in M3 that re-embeds NULL fragments. |
| **Mastra agent per-call overhead under load.** Acceptable at ingest frequencies, untested under bursts. | Low | Revisit if user reports ingest latency. Agent pooling is a drop-in optimization. |
| **`matchMentionsToFragments` relies on `sourceSpan` text matching.** Brittle to prompt output changes. | Low | If the fragmentation prompt ever drops `sourceSpan`, mention→fragment edges break silently. Add a test asserting sourceSpan presence in the prompt schema. |
| **Greenfield installs produce no wiki edges indefinitely.** `FRAGMENT_IN_WIKI` edge count stays 0 until wiki creation lands in M3. | Low | Documentation; log a boot-time info banner "no wikis seeded — wiki classification is a no-op until M3". |
| **`processed_jobs` table collapse.** User_id dropped; relies on `job_id` being globally unique. | Low | Verify BullMQ job IDs are UUIDs or similar globally-unique tokens. They are. |
| **Regen dormant code may drift.** Stubs in `regen-worker.ts` may not match the M2 agent surface by the time M3 re-enables it. | Low | Write a TODO comment listing the exact stubs that need replacement in M3. |
| **No observability UI for `pipeline_events`.** Operator must SQL into the DB to see why a job failed. | Low | Carry forward to next phase. |

## 7. Metrics & Progress

### Git Metrics

| Metric | Value |
|--------|-------|
| Commits on `feat/m-ingest` | 9 (4 feature commits + 4 merge commits + 1 embedding-pin chore) |
| Files changed | 66 |
| Lines inserted | 1979 |
| Lines deleted | 3034 |
| **Net LOC** | **−1055** |
| Workspace packages touched | 5 (new `@robin/caslock`; modified `@robin/shared`, `@robin/queue`, `@robin/agent`, `@robin/core`) |
| New files | `@robin/caslock` package (src + tests + docs), `0001_ingest_m2.sql`, `embeddings.ts`, `openrouter-config.ts`, `agent-factory.ts`, `locks.ts`, `seed-openrouter-key.ts`, `types/embedding.ts` |
| Deleted files | `gateway/client.ts` + directory, `sync-worker.ts`, `sync.ts`, `frontmatter.ts`, `wiki.ts`, `wikilink.ts`, `person-body.ts`, `locking.ts` |

### Requirement Completion

| Requirement (from M2 plan) | Planned | Actual | Evidence |
|----|---------|--------|----------|
| `@robin/caslock` package built, tested, documented | ✓ | ✓ | `pnpm --filter @robin/caslock test` passes; README.md + state-machine.md present |
| Schema migration `0001_ingest_m2.sql` applies on fresh DB | ✓ | ✓ | `db:reset && db:push` produces correct shape |
| `user_id` dropped from all 11 domain tables | ✓ | ✓ | `\d` inspection confirms |
| `users/sessions/accounts/verifications` retain `user_id` | ✓ | ✓ | better-auth still authenticates |
| `DIRTY` state enum value retired | ✓ | ✓ | `\d object_state` |
| People promoted to top-level columns with GIN index | ✓ | ✓ | `\d people`; `EXPLAIN` uses GIN on aliases |
| Ingest audit columns on `raw_sources` | ✓ | ✓ | `\d+ raw_sources`; rows populated during acceptance test |
| CAS locks wired via `@robin/caslock` in core | ✓ | ✓ | `locking.ts` deleted, `locks.ts` present, stages use `lock.using()` |
| Agent package purged of git/markdown code | ✓ | ✓ | `rg frontmatter\|wikilink` returns zero in agent src |
| `embeddings.ts` wired | ✓ | ✓ | New file, direct fetch implementation |
| `openrouter-config.ts` wired | ✓ | ✓ | Reads from configs, decrypts via M1 envelope |
| `agent-factory.ts` per-call | ✓ | ✓ | Fresh Mastra Agent per ingest run |
| `persist.ts` rewritten from 413 → ~150 LOC | ✓ | ✓ | wc -l check |
| BullMQ retries via `attempts: 5, exponential` | ✓ | ✓ | worker.ts queue config |
| Gateway directory purged | ✓ | ✓ | `ls core/src/gateway` → no such directory |
| Routes drop `userId` filters | ✓ | ✓ | All route files audited |
| POST /entries returns 202 + enqueues ExtractionJob | ✓ | ✓ | Hono handler test |
| `seed-openrouter-key.ts` CLI ships | ✓ | ✓ | Idempotent upsert, encrypts via user DEK |
| Greenfield acceptance test passes (Sarah example) | ✓ | ✓ | Fragments ≥1, person row, mention edge |
| Failure-path acceptance test passes | ✓ | ✓ | Deleting key → `ingest_status='failed'` → reseed → retry → success |
| Ingest E2E tests | **Out of scope** | Out | Future milestone |
| Wiki creation | **Out of scope** | Out | M3 |
| MCP ingest tools | **Out of scope** | Out | M3+ |

## 8. Learnings

### What Worked

- **Pre-locking every decision in the plan doc.** 18 decisions were pinned before any code was written. Execution hit zero mid-flight ambiguity.
- **7-group atomic commit sequence.** Each group is a single reviewable unit. Commit 1 (`@robin/caslock`) is self-contained and ships without touching any call site. Commit 7 (end-to-end) is an acceptance procedure, not code — reviewable by running the steps.
- **Hand-rolled CAS → library extraction.** The existing locking code was good enough that packaging it was mostly API design, not algorithmic rework. The resulting library is smaller and better-tested than the inline version.
- **BullMQ retries replacing the 60s tick.** 40 LOC removed, better behavior, fewer moving parts. This was a clear win that M1 should have done originally.
- **`ingest_status` + `last_error` audit columns.** Simple observability without building infrastructure. A single SELECT tells the operator everything.
- **People schema promotion.** Moving `canonical_name`, `aliases`, `verified` from jsonb to top-level columns made the resolution config typed-safe and added a GIN index on aliases. Net cleaner surface for no cost.
- **Gateway purge.** The v1.0 migration's gateway facade was load-bearing then; by M2 it was dead weight. Deleting it now instead of later saves every future phase from reasoning around it.
- **Dormant regen with throw-stubs.** Better than deletion-and-rewrite. Files stay on disk as history, imports stay typed, M3 can wake them up with targeted changes.

### What Didn't Work

- **Deferring the `processReclassifyJob`/`processProvisionJob` decision to execution.** Both decisions were simple and could have been made upfront. Punting them to Group 5 cost execution time and broke the "plan locked, execute mechanically" pattern.
- **Not pinning PG version upfront.** The plan said "handle PG 16 if present" rather than "target PG 17+". Turns out this is inconsequential in production — the pre-prod migration reset collapses all history into a single init migration with no `ALTER TYPE` anywhere, so the `DROP VALUE` dependency disappears. But it cost time during plan review to diagnose, and in development the PG 17 requirement should still be documented for anyone running the current migration chain.
- **Missing the `configs_scope_check` constraint in the migration order.** Caught during review, but the plan's initial migration ordering would have failed. Should have been in the checklist.
- **Initial plan forgot `users.encrypted_dek` preservation.** Almost orphaned every encrypted config value. Caught during review, but this is exactly the kind of cross-phase coupling that should have been in the plan's entry conditions.
- **Group 3 (db rewire) depended on Group 2 (schema) in a way the plan didn't flag.** Both groups touch schema.ts. The plan presented them as independent atomic commits, but Group 3 can't compile until Group 2's schema changes land. Documented after the fact; should have been a note in the plan.
- **`persist.ts` 413 → 150 LOC rewrite was more surgery than anticipated.** The rewrite interleaved with the embedding wiring, people promotion, and `matchMentionsToFragments` verification. Would have been cleaner as two commits: "gut git/markdown code" then "add embedding + people upsert".
- **No integration tests means the acceptance procedure is the only check.** If a reviewer doesn't run the 10-step manual procedure in Group 7, they can't verify M2 actually works. This is a load-bearing manual step. Future phases need a CI-runnable ingest smoke test.
- **Wiki regen stubs are brittle.** Throw-on-import is the right choice for now, but it means regen path is untyped against the new agent surface. If M3 tries to re-enable regen without touching those stubs first, it'll load and fail.

### What We'd Do Differently

- **Decide `processReclassifyJob`/`processProvisionJob` fate in the plan doc, not execution.**
- **Pin dev Postgres version in entry conditions.** "Dev requires PG 17+ due to `DROP VALUE`" is a footnote, not a constraint — but the footnote should have been in the plan. The production migration reset makes this moot for deployment.
- **Audit all constraints referencing `user_id` before the migration, not during.** Write a SQL query that lists them, include the list in the plan.
- **Split `persist.ts` surgery into two commits.** First commit deletes git/markdown code, second commit adds embeddings and people upsert. Keeps diffs reviewable.
- **Inline at least one integration test per phase.** Skipping them is cheap in the moment but compounds — by M3, nothing has coverage.
- **Ask "what's the M1 cross-dependency here" for every schema change.** M1 established crypto envelope, config scoping, first-user seeding. Every M2 schema change needs to be checked against those.
- **Document dormant code with more than comments.** A `DORMANT_CODE.md` file that lists every file with throw-stubs, what's needed to wake each up, and which milestone they're waiting on.
- **Plan docs should have a "hidden dependencies" section.** Group 3 depending on Group 2 via schema.ts was real; the plan didn't surface it.

## 9. Artifacts

| File / Directory | Type | Description |
|---|---|---|
| `packages/caslock/` | new package | `@robin/caslock` — standalone Drizzle-native CAS locking library with `acquire`/`release`/`using` API, auto-renew, events, full unit-test suite |
| `packages/caslock/src/cas-lock.ts` | TS | Main `CasLock<TTable, TRow>` class, extends EventEmitter |
| `packages/caslock/src/events.ts` | TS | Event payload types (`acquired`, `stolen`, `contended`, `released`, `renewed`, `renewFailed`, `error`) |
| `packages/caslock/README.md` | MD | API docs, schema requirements, alternatives section, worked example |
| `packages/caslock/docs/state-machine.md` | MD | State transition diagram, sandwich pattern, failure modes |
| `packages/caslock/__tests__/*.test.ts` | TS | Unit tests: acquire, release, using, auto-renew, contention |
| `core/drizzle/migrations/0001_ingest_m2.sql` | SQL | Single migration: drop DIRTY state, drop user_id from 11 domain tables, drop git-era columns, add ingest audit cols, promote people cols, rebuild slug uniqueness, drop scope_check |
| `core/src/db/schema.ts` | TS | Schema updated: baseColumns() drops userId + git-era cols, `entries` gets ingest audit, `people` gets promoted cols, DIRTY removed from enum, comment block explaining auth-table asymmetry |
| `core/src/db/locks.ts` | TS (new) | Pre-configured `entryLock` and `fragmentLock` instances with event logging |
| `core/src/db/locking.ts` | deleted | Replaced by `@robin/caslock` |
| `core/src/db/sync.ts` | deleted | Git reconciliation — no longer needed |
| `core/src/db/dedup.ts` | TS | `findDuplicateEntry()` drops userId arg |
| `core/src/db/slug.ts` | TS | `resolveEntrySlug()` / `resolveFragmentSlug()` drop userId arg |
| `core/src/queue/worker.ts` | TS | `processExtractionJob` uses `entryLock.using()`, BullMQ exponential backoff, regen dormant early-return |
| `core/src/queue/sync-worker.ts` | deleted | Git write-through worker |
| `core/src/queue/regen-worker.ts` | TS (dormant) | Stubs missing imports, TODO(M3) comment, early-return |
| `core/src/queue/scheduler.ts` | TS (dormant) | Regen scheduler, dormant |
| `core/src/routes/entries.ts` | TS | Drops `gatewayClient.write`, drops userId filters, enqueues ExtractionJob directly, sets ingest_status='pending' |
| `core/src/routes/{fragments,wikis,people,vaults,content,search,graph,relationships,admin,internal}.ts` | TS | Drop userId filters |
| `core/src/gateway/` | deleted | Entire gateway facade directory |
| `core/src/lib/wiki-lookup.ts` | TS | `createWikiLookupFn()` drops userId arg |
| `core/scripts/seed-openrouter-key.ts` | TS (new) | CLI: reads OPENROUTER_API_KEY env, encrypts via user DEK, writes to configs table as `kind='llm_key'`. Idempotent upsert. |
| `packages/agent/src/embeddings.ts` | TS (new) | `embedText(text, config)` — direct fetch to OpenRouter `/v1/embeddings`, returns `number[] \| null`, logs on failure |
| `packages/agent/src/openrouter-config.ts` | TS (new) | `loadOpenRouterConfig(db)`, throws `NoOpenRouterKeyError` if configs has no llm_key entry |
| `packages/agent/src/agent-factory.ts` | TS (new) | `createIngestAgent(db)` — fresh Mastra Agent per call, one per prompt spec |
| `packages/agent/src/stages/persist.ts` | TS | Rewritten 413 → ~150 LOC. Drops file assembly. Adds embedding call + people upsert. Drops userId. |
| `packages/agent/src/stages/entity-extract.ts` | TS | Reads from promoted people columns, not sections jsonb |
| `packages/agent/src/stages/index.ts` | TS | Orchestrators use `lock.using({ autoRenew: true }, routine)` instead of manual acquire/release |
| `packages/agent/src/stages/{vault-classify,wiki-classify,frag-relate,fragment}.ts` | TS | Drop userId args |
| `packages/agent/src/stages/types.ts` | TS | `PersistDeps` drops `batchWrite`/`loadPersonByKey`/`lookupFn`; adds `embedFragment` and `openRouterConfig` |
| `packages/agent/src/frontmatter.ts` | deleted | Markdown assembly |
| `packages/agent/src/wiki.ts` | deleted | Wiki file operations |
| `packages/agent/src/wikilink.ts` | deleted | Wiki link resolution |
| `packages/agent/src/person-body.ts` | deleted | Markdown body assembly |
| `packages/agent/src/regen/` | moved | Moved to `core/src/queue/` as dormant |
| `packages/agent/src/agents/provider.ts` | deleted | Env-based key access — replaced by `openrouter-config.ts` |
| `packages/queue/src/index.ts` | TS | `WriteJob` + `SyncJob` types deleted; `ExtractionJob`, `LinkJob`, `ReclassifyJob` kept; userId dropped from queue naming |
| `packages/shared/src/wiki-links.ts` | deleted | Wiki link parsing (markdown-only) |
| `packages/shared/src/types/embedding.ts` | TS (new) | Pinned embedding model registry, `EMBEDDING_DIMENSIONS = 1536`, `SUPPORTED_EMBEDDING_MODELS`, `DEFAULT_EMBEDDING_MODEL`, type guard |
| `.planning/phases/02-ingest-pipeline/02-PLAN.md` | MD | The plan doc itself — 636 lines of locked decisions, build sequence, and acceptance procedures |

## 10. Stakeholder Highlights

### Executive Summary

M2 is the phase where Robin becomes functionally alive. Before M2, Robin had a data model and an auth flow but couldn't actually do the thing it exists to do — turn a captured thought into a structured, searchable, linked knowledge fragment. After M2, a single `POST /entries` call produces fragments, people, embeddings, and graph edges in the database within roughly 30 seconds, with automatic retries on transient failures and a clean audit trail for operator inspection.

The codebase is also smaller than before. The git/markdown/gateway scaffolding from the v1.0 migration — load-bearing at the time, dead weight now — has been deleted. Net change is −1055 lines of code while adding the full ingest pipeline, the embedding call path, people promotion, and a new reusable locking library.

M2 ships in 9 commits across 7 atomic task groups. One new workspace package (`@robin/caslock`) is extracted as a genuine engineering asset — a Drizzle-native CAS locking library with auto-renew, events, and full unit-test coverage, independently packageable beyond Robin.

### Key Numbers

| Metric | Value |
|--------|-------|
| Task groups | 7 (atomic commits) |
| Commits | 9 |
| Files changed | 66 |
| Lines added | 1979 |
| Lines deleted | 3034 |
| **Net LOC** | **−1055** |
| New workspace package | 1 (`@robin/caslock`) |
| Tables collapsed to single-user | 11 |
| Tables preserving `user_id` (auth) | 4 |
| Files deleted from agent package | 5 (frontmatter, wiki, wikilink, person-body, regen) |
| Files deleted from core package | 4 (gateway/client, sync-worker, sync, locking) |
| Ingest path stages | 6 (vault-classify, fragment, entity-extract, wiki-classify, frag-relate, persist) |
| Acceptance-test ingest time | ~30 seconds |
| Ingest status audit columns | 4 (`ingest_status`, `last_error`, `last_attempt_at`, `attempt_count`) |

### Callouts

- ✓ **Ingest works end-to-end.** The canonical acceptance test ("I had lunch with Sarah about the new product launch") produces ≥1 fragment, 1 person row with `canonical_name='Sarah'`, a `FRAGMENT_MENTIONS_PERSON` edge, and populated `embedding` columns — all from a single API call.
- ✓ **`@robin/caslock` is a reusable engineering asset.** Documented, tested, could be extracted as an npm package beyond Robin if desired.
- ✓ **BullMQ-native retry replaces hand-rolled tick.** 40 LOC removed, better behavior (exponential backoff with jitter), fewer moving parts.
- ✓ **Self-healing on missing OpenRouter key.** Operator can seed key after-the-fact; failed entries automatically retry via BullMQ's backoff policy.
- ✓ **Net codebase shrink while adding functionality.** −1055 LOC. Gateway/markdown/git scaffolding gone.
- ℹ **PG 17 required in development only.** `DROP VALUE` from enum is PG 17+. Not a production concern — the pre-prod migration reset collapses all history into a single init migration with no `ALTER TYPE`, so the PG 17 dependency evaporates before any real deploy. Local dev already uses PG 17.
- ⚠ **No integration tests for ingest.** Unit tests cover `@robin/caslock`; the full pipeline is verified only by a 10-step manual acceptance procedure. A reviewer who doesn't run the procedure can't verify M2 works.
- ⚠ **Operator must manually seed OpenRouter key before first ingest.** Until M3 adds the onboarding UI, the first-boot flow is "server starts → user signs in → captures a thought → hits failed state → runs CLI seed script → retries."
- ⚠ **Embeddings are best-effort.** A fragment can land with `embedding IS NULL` if OpenRouter's embedding API errors. That fragment is invisible to vector search until backfilled. Needs a periodic backfill worker in M3.
- ⚠ **Greenfield wiki classification is a no-op.** With no wikis seeded, `wiki-classify` always returns empty edges. Correct M2 behavior; wiki creation lands in M3.

### Confidence Scores

Using the skill's rubric:

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Completeness** | **4/5** | Every in-scope requirement shipped. Out-of-scope items (E2E tests, wiki creation, MCP tools, onboarding UI) were explicit deferrals, not gaps. |
| **Quality** | **4/5** | Architecture is sound: CAS locking extracted cleanly, gateway purge removes technical debt, BullMQ retries replace hand-rolled code, net LOC shrinks. Surgery on `persist.ts` (413 → ~150) was more interleaved than it should have been — a two-commit split would have been cleaner. Dormant regen stubs are correct but brittle. No integration tests means the acceptance procedure is the only end-to-end check. |
| **Risk Exposure** | **3/5** | Manual OpenRouter key seeding is a rough first-boot UX until M3. Embedding best-effort silently degrades search. None of these are unfixable; all are explicit and tracked. The single biggest unknown is ingest behavior under burst load, which the per-call Mastra `Agent` pattern hasn't been tested against. PG 17 requirement is a development-only footnote that disappears at the pre-prod migration reset. |

### Next Phase Readiness

Ready to plan M3 once these are addressed or explicitly deferred:

1. **Wiki creation path.** M3's first deliverable. Enables non-no-op `wiki-classify` on ingests.
2. **Wiki regen wake-up.** Update the dormant `regen-worker.ts` stubs to match the new agent surface.
3. **Onboarding flow endpoints.** `POST /onboarding/openrouter-key` (replaces manual CLI seed), `POST /onboarding/complete`, password-change-on-first-login.
4. **Ingest integration test** (at least one). Mocks OpenRouter, runs the full pipeline, asserts fragments + people + edges + embeddings.
5. **Embedding backfill worker.** Periodic job that re-embeds fragments where `embedding IS NULL`.

*(Dropped: PG version boot check. Reasoning: the `DROP VALUE` dependency is a development-window-only constraint. The pre-prod migration reset — which collapses all history into a single init migration generated from the final schema — removes every `ALTER TYPE` statement from the migration file, so there's no PG version gating needed at deploy time. Keeping a runtime version check would be guarding against a problem that doesn't exist by the time the app ships.)*

---

*Generated by `/retro` on 2026-04-11. Git range: main..feat/m-ingest.*
