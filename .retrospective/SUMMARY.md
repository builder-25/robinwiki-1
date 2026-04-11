# Robin — Project Summary

A living summary of what Robin is becoming, updated after each phase.

## Where Robin Is Today

**M1 Foundation complete (2026-04-11).** Robin is now a single-user, self-hostable, encrypted knowledge base with a hybrid-search-ready data model. The three capabilities that unlock this:

1. **Encryption at rest for sensitive values.** AES-256-GCM envelope encryption with a server master key that wraps per-user data encryption keys. The same algorithm class used by AWS KMS, Google Tink, and modern password managers. Your API keys, LLM credentials, and anything else you trust Robin with are encrypted with an industry-standard authenticated cipher.

2. **Single-user posture.** Robin is yours alone. Host it on a laptop, home server, tiny VPS, or Raspberry Pi. Access it from anywhere you work. No social providers, no multi-tenant isolation complexity, no vendor lock-in. The first user gets seeded from environment variables at boot; subsequent sign-ups are blocked with a clean 403.

3. **Hybrid-search-ready schema.** `pgvector` (HNSW, cosine) and Postgres `tsvector` (GIN, weighted) sit side-by-side on the same three tables (`wikis`, `fragments`, `people`). This is the foundation for search that's consistently better than RAG-over-embeddings alone: vector search for conceptual queries, full-text search for named entities and exact phrases, both joinable in a single query plan.

## Phases Completed

| Phase | Name | Shipped | What It Delivered |
|-------|------|---------|-------------------|
| M1 | Foundation | 2026-04-11 | Schema + encryption + single-user auth + hybrid search foundation |

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

## Active Items Being Tracked

Not blockers for today, but the next phase should address them.

| Item | Severity | Since | Notes |
|------|----------|-------|-------|
| Onboarding API endpoints | Medium | M1 | State columns exist (`onboarding_complete`, `password_reset_required`), endpoints to flip them do not. M2 priority. |
| Embedding generation not wired | Medium | M1 | Storage is ready; provider calls are not. M2 picks a provider and wires the write path. |
| `drizzle-kit migrate` hung locally | Medium | M1 | Worked around with direct `psql` apply. Diagnose before CI. |
| pgvector deploy dependency | Low | M1 | Add to runbook. Requires superuser install on target DB. |
| Test suite unverified post-rename | Medium | M1 | Compile-clean, runtime-unverified. Run, fix, or retire stale tests. |
| Master key rotation story | Low | M1 | Envelope supports it cleanly; no implementation picked. Not urgent until first real deploy. |

## What Robin Will Become

Next milestone (M2, not yet planned):
- Onboarding flow that walks a fresh user through setting their OpenRouter key, picking models, and switching to their own password
- Embedding generation on write — fragments and wikis get embedded as they're created
- Hybrid search endpoint — the one that combines vector and full-text rank into a single ranked result set

---

*Updated 2026-04-11 after M1 retro. Engineering detail lives in `phase-m1-foundation.md`.*
