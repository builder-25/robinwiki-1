# Phase M2: Ingest Pipeline — Stakeholder Report

**Shipped:** 2026-04-11
**Status:** Complete

## Robin Now Does The Thing

Before M2, Robin could authenticate you and hold a schema. After M2, **Robin actually captures thoughts and turns them into structured knowledge.** One `POST /entries` call, one sentence like *"I had lunch with Sarah about the new product launch"*, and roughly 30 seconds later your database contains:

- An entry row tracking the raw capture with full audit state
- One or more fragments — the atomic ideas extracted from your sentence
- A person row for Sarah with her canonical name and any aliases she's mentioned by
- Graph edges linking Sarah to the fragments that mention her
- Vector embeddings on each fragment, ready for semantic search

This is what Robin is for. M2 is the phase where the product stops being infrastructure and starts being a product.

Four foundations unlocked it:

1. A **Postgres-native pipeline** that replaces the v1.0 gateway facade
2. **Idempotency protection** that guarantees failed pipeline steps don't waste work Robin already did
3. **Cost-aligned intelligence** — OpenRouter chat + embeddings with two hand-picked models that give Robin the best cost-to-value ratio
4. A **simpler codebase** — Robin shrank by over 1,000 lines of code while gaining the entire ingest pipeline

Each matters for a specific reason.

---

## 1. Ingest Works End-to-End

The six-stage pipeline that was scaffolded in v1.0 now runs all the way through, in the right order, on the right data model, with automatic retries and a real audit trail:

1. **Vault classification.** Which of your knowledge vaults does this thought belong to?
2. **Fragmentation.** Split the thought into atomic ideas.
3. **Entity extraction.** Find people, places, and concepts in the text.
4. **Wiki classification.** Which existing wikis are relevant? (No-op until M3 seeds wikis — correct M2 behavior.)
5. **Fragment relationships.** Which existing fragments does this relate to?
6. **Persist.** Write everything to the database, create graph edges, generate embeddings.

Each stage is guarded by a **CAS lock** (compare-and-set on the database) with auto-renewing TTLs. If a worker crashes mid-stage, the lock expires on its own and the next worker picks up cleanly. No stuck entries, no manual intervention, no "which worker is holding this?" confusion.

Each entry carries its own audit trail via four new columns on `raw_sources`:

- `ingest_status` — `pending` → `processed` or `failed`
- `last_error` — the exact error message if anything went wrong
- `last_attempt_at` — timestamp of the last processing attempt
- `attempt_count` — how many retries have happened

A single SQL query tells you everything about any entry's processing state. No log-diving, no queue-introspection, no bespoke dashboards. The eventual observability UI (M3+) will read from these columns as the single source of truth.

**What you get:** Capture a thought. Wait ~30 seconds. Query the database and see the structured knowledge. If something went wrong, the error is right there on the row.

## 2. Idempotency Protection — Failed Steps Don't Waste Finished Work

Robin's ingest pipeline is six stages: vault classify → fragment → entity extract → wiki classify → fragment relate → persist. Each stage is an LLM call. Each one can fail for its own reasons — a flaky provider, a rate limit, a timeout, a malformed structured output.

The job queue (BullMQ) handles *retries* cleanly: exponential backoff, attempt counts, dead-letter handling. What a queue **cannot** guarantee is **idempotency**. If stage 4 fails and the job retries, the queue reruns the whole job from the top — stages 1 through 3 run again, burn tokens again, write duplicate rows again. On a multi-step pipeline where each step costs money and the stages are isolated from each other, that's the wrong behavior.

M2's solution is a **compare-and-set lock on the database row being processed**. Before a stage runs, it atomically moves the row from one state to another (`PENDING` → `LINKING`) in a single SQL statement. Only one worker can win that transition; everyone else sees the row is already being worked on and backs off. When the stage completes successfully, the lock releases to the next state. If a worker crashes mid-stage, the lock expires on its own (TTL-based) and the next retry picks it up cleanly from where the last one stopped — not from the beginning.

The practical result: **if stage 5 fails, the next retry picks up at stage 5.** Stages 1 through 4 don't re-run. Their results are already in the database, locked behind the row state. Each LLM call happens at most once per entry, regardless of how many times BullMQ retries the job.

**What you get:** Every LLM call costs money. Every failed pipeline retry that re-runs already-finished stages burns money for no reason. M2's locking makes sure Robin never pays twice for the same work.

## 3. Cost-Aligned Intelligence: One API, Two Hand-Picked Models

Robin routes all LLM traffic through **OpenRouter** — one API endpoint, one credential, dozens of chat and embedding models behind it. M2 picks the two models that align Robin's quality needs with Robin's cost-to-value ratio.

**Why `vector(1536)` as the dimension commitment:** Choosing 1536 lets Robin support the two models that give the best cost-to-value ratio on the market, without schema churn. Both models land at 1536 dimensions — one natively, one via matryoshka truncation — and both are priced low enough that captures-per-dollar isn't a concern. The two:

- **`qwen/qwen3-embedding-8b`** — Qwen3 at its native 4096 dimensions, truncated to 1536 via the matryoshka training the model was specifically optimized for. At **$0.01 per million tokens**, it's the cheapest top-tier embedding model on OpenRouter. Quality at 1536 still beats OpenAI's premium model at its native 3072 dimensions (~67 MTEB vs 64.6), which means Robin's default is both the cheapest *and* the highest-quality option.
- **`openai/text-embedding-3-small`** — Native 1536 dimensions, no truncation needed. Priced at **$0.02 per million tokens**. For users who prefer to keep all their LLM traffic with OpenAI for ecosystem reasons, this is a clean alternative at near-parity cost.

Either model, the same 1536-dimension column, the same HNSW index from M1. Robin gives the user the choice; the storage layer doesn't care.

**Chat completion runs through Mastra,** a lightweight agent framework that handles structured output and prompt management cleanly. Default chat model is `anthropic/claude-3-5-sonnet`, changeable via config without touching code.

Why Mastra matters for Robin's roadmap: Mastra ships with **built-in tracing** for every LLM call — inputs, outputs, timings, and errors are captured automatically. It also has **Mastra Studio**, an n8n-style visual workflow builder for experimenting with prompts and agent flows. M2 uses Mastra in its lightweight form — just the `Agent` class with OpenRouter as provider — but that's a deliberate investment toward future versions where users can **open their own ingest and query pipelines in Mastra Studio**, tweak prompts, visualize how their thoughts flow through classification and extraction, and customize Robin's behavior without writing code. Starting with Mastra now means that prompt-flexibility and pipeline-visualization features drop in later without a framework migration.

**The credential story is where M1's encryption pays off.** On first boot, the operator runs `pnpm seed-openrouter-key` with the `OPENROUTER_API_KEY` environment variable set. The script encrypts the key using the M1 user DEK (AES-256-GCM envelope) and stores the ciphertext in the `configs` table. The env var can then be unset — Robin never needs it again. Every ingest decrypts the key on demand. One credential, encrypted at rest, no process-memory hoarding, and if the operator forgets to seed the key, Robin marks the entry `failed` with a clear error message and auto-retries via BullMQ after the operator seeds it. **Self-healing after a single operator action, zero entry loss.**

**What you get:** Two embedding models hand-picked for cost-to-value. A chat framework that's lightweight today and unlocks prompt-editing UI later. One credential encrypted at rest. Model selection via config, not code.

## 4. Less Code, Doing More

M2's diff is **+1979 / −3034 lines = −1055 net LOC** while adding the full ingest pipeline. This is because M2 deletes a lot of dead weight that v1.0 carried for pragmatic reasons:

**Deleted from v1.0 → Replaced by M2:**

| Deleted | Replaced by |
|---|---|
| `core/src/gateway/` entire directory | Nothing — gateway was vestigial |
| `core/src/queue/sync-worker.ts` | Nothing — no more git write-through |
| `core/src/db/sync.ts` | Nothing — no more git reconciliation |
| `core/src/db/locking.ts` (hand-rolled) | `@robin/caslock` library |
| `packages/agent/src/frontmatter.ts` | Nothing — no more markdown assembly |
| `packages/agent/src/wiki.ts` | Nothing — no more wiki file operations |
| `packages/agent/src/wikilink.ts` | Nothing — no more wiki link parsing |
| `packages/agent/src/person-body.ts` | Nothing — no more markdown body generation |
| `packages/shared/src/wiki-links.ts` | Nothing — no more wiki link parsing |
| Hand-rolled 60s retry tick in `worker.ts` | BullMQ native `attempts: 5, backoff: exponential` |
| `user_id` threading through every query | Single-user collapse |
| `sections jsonb` on people | Typed columns (`canonical_name`, `aliases text[]`, `verified`) |

The v1.0 migration was a deliberate "keep everything working, rebuild later" move. M2 is the "rebuild later" — it removes the scaffolding now that Postgres-native ingest replaces it. Every future phase builds on a smaller, cleaner codebase.

**BullMQ retries replacing the hand-rolled tick is a particularly clean win.** The v1.0 retry tick had three failure modes (drift, overlap, thundering herd) that BullMQ's native exponential backoff with jitter avoids for free. 40 lines of custom code removed, better behavior.

**People promoted to typed columns means you can actually query them.** Before M2, people were stored as jsonb `sections` — untyped, un-indexable, un-queryable except by brute parsing. After M2, `people.canonical_name` is a text column with a btree index, `people.aliases` is a `text[]` with a GIN index, and `people.verified` is a boolean. The people resolution pipeline reads typed data and the search layer can actually use the aliases for fuzzy matching.

**What you get:** A Robin codebase that is smaller, faster to reason about, and has a cleaner foundation for M3 and beyond.

---

## What's Ready Now

- `POST /entries` accepts a thought and returns a 202 with a job ID within milliseconds
- Behind the scenes, the 6-stage pipeline processes the entry in ~30 seconds
- Entry lands in `raw_sources` with full audit state
- Fragments land in `fragments` with embeddings populated (best-effort)
- People land in `people` with canonical name + aliases + verified flag
- Graph edges land in `edges` connecting fragments to people and to other fragments
- Pipeline events land in `pipeline_events` for observability
- On failure, `raw_sources.last_error` tells the operator exactly what happened
- BullMQ exponential backoff retries transient failures without manual intervention
- Failed pipeline stages don't re-run already-completed work (no duplicate LLM calls, no wasted spend)
- Codebase is 1000+ lines smaller than before

## What's Next (M3)

1. **Wiki creation.** M3's first deliverable. Once wikis can be created (via API or default seeds), `wiki-classify` will produce real edges and Robin's output side wakes up. Today every ingest correctly produces zero wiki edges — it's a no-op, not a bug.
2. **Wiki regeneration.** The `regen-worker.ts` code is kept on disk but dormant in M2. M3 wakes it up to regenerate wikis as new fragments accumulate.
3. **Onboarding flow endpoints.** Today the operator must run a CLI script to seed the OpenRouter key. M3 adds an API endpoint that accepts the key through the app itself.
4. **Ingest integration tests.** Today the ingest pipeline is verified by a manual acceptance procedure. M3 adds automated tests that run the full pipeline against a mocked OpenRouter.
5. **Embedding backfill worker.** Fragments that land with `embedding IS NULL` because of transient OpenRouter failures need a periodic job to re-embed them.

## Items We're Tracking

These are real but not urgent:

- **Postgres 17 during development only (not a prod concern).** M2's migration uses `ALTER TYPE ... DROP VALUE` to remove the `DIRTY` enum value inherited from M1 — and that statement is PG 17+. This only matters during the development window between M2 and production-readiness. Before prod ship, the full migration history collapses into a single init migration generated from the final schema, which declares the enum fresh with no `ALTER TYPE` anywhere. At that point the PG 17 dependency disappears entirely.
- **Manual key seed on first boot is rough UX.** The operator has to run `pnpm seed-openrouter-key` before the first successful ingest. M3 replaces this with an API endpoint.
- **Embedding best-effort means search quality silently degrades on provider outages.** A fragment with `embedding IS NULL` is invisible to vector search. Needs the M3 backfill worker.
- **Mastra per-call Agent construction has ms-scale overhead.** Fine at ingest frequencies (a handful per minute), untested under burst load. Optimization deferred.
- **Greenfield installs produce zero wiki edges indefinitely** until M3 seeds wikis. Correct behavior; may surprise people who read logs and expect wiki classifications.

---

*Engineering retro with commit-level detail: `.retrospective/phase-m2-ingest-pipeline.md`.*
