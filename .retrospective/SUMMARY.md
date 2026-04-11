# Robin — Project Summary

A living summary of what Robin is becoming, updated after each phase.

## Where Robin Is Today

**M2 Ingest Pipeline complete (2026-04-11).** Robin is no longer just infrastructure — **it actually does the thing it exists to do.** A single `POST /entries` call turns a captured thought into structured knowledge: fragments, people, embeddings, and graph edges, all in the database within about 30 seconds, with automatic retries and a clean audit trail.

M2 builds on M1's encrypted, single-user, hybrid-search-ready foundation. Together they deliver:

1. **Ingest that works end-to-end.** Capture → structure → persist → embed. Six LLM-powered stages guarded by database-level CAS locks. Self-healing on transient failures via BullMQ exponential backoff.

2. **An encrypted personal knowledge base.** AES-256-GCM envelope encryption protects your sensitive values. Your OpenRouter API key lives encrypted-at-rest in the database, never on the command line after first seed.

3. **Single-user posture that runs anywhere.** Host it on a laptop, home server, tiny VPS, or Raspberry Pi. One user, one master key, one database.

4. **Hybrid-search-ready data model.** pgvector (HNSW, cosine) and Postgres tsvector (GIN, weighted) sit side-by-side on the same tables — vector search for conceptual queries, full-text for named entities and exact phrases, both joinable in a single query plan.

5. **A reusable CAS locking library.** `@robin/caslock` ships as a standalone workspace package with auto-renew, events, and full unit-test coverage. Genuine engineering asset, extractable beyond Robin.

## Phases Completed

| Phase | Name | Shipped | What It Delivered |
|-------|------|---------|-------------------|
| M1 | Foundation | 2026-04-11 | Schema + encryption + single-user auth + hybrid search foundation |
| M2 | Ingest Pipeline (Postgres-Native) | 2026-04-11 | End-to-end ingest, OpenRouter wiring, @robin/caslock, gateway purge, single-user collapse |

## Capabilities Unlocked (Cumulative)

As phases ship, capabilities accumulate here. This is the "what can Robin do for you" list, in plain language.

| Capability | Since | Notes |
|------------|-------|-------|
| Self-host with one-line boot | M1 | `pnpm dev` with three env vars (`MASTER_KEY`, `INITIAL_USERNAME`, `INITIAL_PASSWORD`) |
| Encrypted storage for sensitive config | M1 | AES-256-GCM, envelope pattern, per-user DEK |
| Single-user authentication | M1 | Email/password; sign-ups locked after first user |
| Vector embedding storage | M1 | 1536-dim nullable columns on wikis/fragments/people with HNSW indexes |
| Full-text search storage | M1 | tsvector columns, trigger-maintained, weighted title/body, GIN indexes |
| Hybrid-ready data model | M1 | Both search indexes on the same tables, ready to combine in one query |
| Migrations from zero | M1 | Single `0000_init.sql` applies cleanly from an empty database |
| **End-to-end ingest pipeline** | **M2** | **`POST /entries` → fragments + people + embeddings + edges in ~30s** |
| **Automatic fragment extraction** | **M2** | **LLM-powered 6-stage pipeline: vault-classify → fragment → entity-extract → wiki-classify → frag-relate → persist** |
| **People graph with typed columns** | **M2** | **`canonical_name`, `aliases text[]`, `verified` as top-level columns with GIN index on aliases** |
| **Mention-aware graph edges** | **M2** | **`FRAGMENT_MENTIONS_PERSON` edges created per mention; `FRAGMENT_RELATED_TO_FRAGMENT` for similarity** |
| **Live embedding generation** | **M2** | **OpenRouter `/v1/embeddings` wired directly; best-effort on failure** |
| **OpenRouter chat completion** | **M2** | **Mastra framework + OpenRouter provider; model selectable via config, default `anthropic/claude-3-5-sonnet`** |
| **Encrypted-at-rest API keys** | **M2** | **Operator seeds OpenRouter key once via CLI; stored encrypted, decrypted per-call** |
| **Self-healing ingest failures** | **M2** | **BullMQ exponential backoff; missing-key errors auto-retry after operator seeds the key** |
| **Audit trail per entry** | **M2** | **`ingest_status` / `last_error` / `last_attempt_at` / `attempt_count` on every raw_source** |
| **Database-level CAS locking** | **M2** | **`@robin/caslock` library — auto-renewing TTL locks with stolen-lock recovery** |
| **Pipeline observability via SQL** | **M2** | **Every stage transition logged to `pipeline_events`; single query traces an entry's full journey** |

## Design Decisions (Cumulative)

Load-bearing choices, with the reason they were made. These are the decisions future phases build on.

| # | Decision | Phase | Why |
|---|----------|-------|-----|
| 1 | Single-user deployment posture | M1 | Robin is a personal knowledge base. No multi-tenant complexity means it runs anywhere the user wants to run it. |
| 2 | Postgres + pgvector from day one (no SQLite, no driver split) | M1 | Vector search is a first-class feature. A database that natively supports it is simpler than a SQLite + separate vector store. |
| 3 | Hybrid search over pgvector + tsvector | M1 | Pure vector search fails on exact matches; pure full-text search fails on concepts. Both together beats either alone on the benchmarks search teams actually care about. |
| 4 | AES-256-GCM envelope encryption (master key wraps per-user DEK) | M1 | Industry-standard pattern. Supports key rotation without touching encrypted data. Auditable in ~100 lines. |
| 5 | Karpathy taxonomy for DB (`raw_sources`, `wikis`, `fragments`, `people`, `edges`, `edits`) | M1 | Separates intake from output and atomic units, which makes both the pipeline and the search model cleaner. |
| 6 | API terminology stays as `entry` even though the SQL table is `raw_sources` | M1 | The API is user-facing; the DB is implementer-facing. They can use different words. |
| 7 | Normalized config store with a `kind` discriminator | M1 | One table handles LLM keys, model preferences, and wiki prompts. Adding a new config kind is a row, not a migration. |
| 8 | Env-seeded first user with forced password reset | M1 | First-boot should be automatic. "Change password on first login" covers the insecure-env-var case. |
| 9 | No `config_notes` feature (deleted, not migrated) | M1 | The old `config_notes` table was stale from a prior iteration. Rebuilding on `configs` is cleaner than migrating cruft. |
| 10 | Preserve workspace package boundaries (`@robin/core`, `@robin/agent`, `@robin/queue`, `@robin/shared`) | v1.0 | Package boundaries enforce the conceptual separation between server, intelligence pipeline, job queue, and shared types. |
| 11 | Pin embedding models to `qwen/qwen3-embedding-8b` (default) and `openai/text-embedding-3-small` at `vector(1536)` | M1 | Qwen3-8B at 1536 (MRL truncation from 4096) beats OpenAI text-embedding-3-large at its native 3072 on MTEB (~67 vs 64.6), at 1/13th the cost. text-embedding-3-small is the alternative for OpenAI ecosystem fit. Two models keeps the onboarding model picker honest — each is a real, distinct choice. |
| 12 | BullMQ keeps the whole execution model; drop setImmediate and the 60s retry tick | M2 | BullMQ's native exponential backoff with jitter strictly beats hand-rolled retry logic. One less moving part. |
| 13 | Mastra retained for chat completion, per-call `Agent` construction | M2 | Mastra's structured-output API fits the 6-stage pipeline cleanly. Per-call construction means config changes take effect immediately without restart. |
| 14 | Embeddings via direct fetch to OpenRouter `/v1/embeddings`, not Mastra | M2 | Mastra doesn't do embeddings. Direct fetch is ~30 LOC and keeps the dep graph simple. |
| 15 | Embedding best-effort — NULL on failure, ingest continues | M2 | An unreachable OpenRouter shouldn't block ingest entirely. NULL fragments can be backfilled by a periodic worker. |
| 16 | Extract CAS locking into `@robin/caslock` workspace package | M2 | The algorithm is generic enough to be library-packageable. Isolation + unit tests improve correctness; reusability is a bonus. |
| 17 | Drop `DIRTY` state enum value now | M2 | DIRTY was wiki-regen-only (M3 concern). Removing it now and re-adding later is cheaper than carrying a vestigial state through M2. |
| 18 | Purge gateway facade + git/markdown code entirely | M2 | No downstream consumers; the facade was vestigial from v1.0. Net −2000 LOC. |
| 19 | Single-user collapse — drop `user_id` from all 11 domain tables; keep on 4 auth tables | M2 | better-auth's adapter requires user_id on auth tables. The asymmetry is documented in schema.ts to prevent future "cleanup". |
| 20 | Wiki creation deferred to M3 | M2 | Greenfield installs have no wikis; `wiki-classify` returning empty edges is correct M2 behavior, not a bug. Keeps scope tight. |
| 21 | Promote `people.canonical_name`, `aliases text[]`, `verified` to top-level columns | M2 | Typed columns beat jsonb for queryability. GIN index on aliases makes alias resolution O(log n) instead of full-scan jsonb parsing. |
| 22 | Regen worker kept dormant in core with throw-stubs | M2 | Files stay on disk; imports stay typed; M3 wakes them up with targeted changes rather than rewriting from scratch. |

## Active Items Being Tracked

Not blockers for today, but the next phase should address them.

| Item | Severity | Since | Notes |
|------|----------|-------|-------|
| PG 17 required for M2 migration | Low | M2 | `ALTER TYPE ... DROP VALUE` is PG 17+ only. **Not a production concern.** The `DROP VALUE` only exists because M2 migrates *from* the M1 schema *to* a new state. Before production-ready, the full migration history will be collapsed into a single init migration generated from the final schema — at that point the enum is declared fresh as `('PENDING', 'RESOLVED', 'LINKING')` with no `ALTER TYPE` in the file. The PG 17 dependency exists only during the development window between M2 and the pre-prod migration reset. |
| **Manual OpenRouter key seed on first boot** | **Medium** | **M2** | **Operator runs `pnpm seed-openrouter-key` before first ingest. M3 replaces this with an API endpoint.** |
| **Embedding best-effort silently degrades search** | **Medium** | **M2** | **Fragments with `embedding IS NULL` are invisible to vector search. M3 adds a periodic backfill worker.** |
| **No ingest E2E tests** | **Medium** | **M2** | **`@robin/caslock` has unit tests; the full pipeline is verified only by a 10-step manual acceptance procedure. M3 adds at least one integration test.** |
| **Wiki regen dormant code may drift** | **Low** | **M2** | **Stubs in `regen-worker.ts` may not match the new agent surface by the time M3 re-enables them. TODO comment lists exact stubs needing replacement.** |
| **Greenfield wiki classification is a no-op** | **Low** | **M2** | **Correct M2 behavior — no wikis seeded means `wiki-classify` returns empty edges. Add a boot-time info banner for clarity.** |
| **Mastra per-call Agent overhead** | **Low** | **M2** | **ms-scale, fine at ingest frequencies, untested under burst. Agent pooling is a drop-in optimization if needed.** |
| Onboarding API endpoints | Medium | M1 | State columns exist (`onboarding_complete`, `password_reset_required`), endpoints to flip them do not. M3 priority. |
| `drizzle-kit migrate` hung locally | Medium | M1 | Worked around with direct `psql` apply. Diagnose before CI. |
| pgvector deploy dependency | Low | M1 | Add to runbook. Requires superuser install on target DB. |
| Test suite unverified post-rename | Medium | M1 | Compile-clean, runtime-unverified. Run, fix, or retire stale tests. |
| Master key rotation story | Low | M1 | Envelope supports it cleanly; no implementation picked. Not urgent until first real deploy. |

## What Robin Will Become

Next milestone (M3, not yet planned):

1. **Wiki creation + management.** The output side of Robin — LLM-generated wikis that aggregate fragments by topic. Wakes up `wiki-classify` from no-op to real edges.
2. **Wiki regeneration.** Dormant `regen-worker.ts` wakes up. Wikis rebuild themselves as new fragments accumulate.
3. **Onboarding flow.** API endpoints replace the manual `pnpm seed-openrouter-key` step. User walks through OpenRouter key setup, model selection, password change, all through the app.
4. **Embedding backfill worker.** Periodic job that re-embeds fragments where `embedding IS NULL`.
5. **Ingest integration test.** At least one CI-runnable test that mocks OpenRouter and runs the full pipeline.
6. **Hybrid search endpoint.** Combines vector and full-text rank into a single ranked result set. The payoff phase for M1's storage foundation.

---

*Updated 2026-04-11 after M2 retro. Engineering detail lives in `phase-m1-foundation.md` and `phase-m2-ingest-pipeline.md`.*
