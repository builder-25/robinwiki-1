# Robin

Robin is an AI-powered second brain that captures raw thoughts through conversation (MCP or web UI) and automatically structures them into a searchable knowledge base. Behind the scenes, a 6-stage AI pipeline extracts atomic ideas (fragments), classifies them into topic clusters (wikis), resolves people mentions, and stores everything in Postgres with vector embeddings for hybrid search.

## Architecture

Monorepo managed by pnpm workspaces + Turborepo.

```
core/           @robin/core    — Hono API server, MCP server, AI pipeline, workers
wiki/           @robin/wiki    — Next.js 16 web frontend (shadcn/ui)
packages/agent  @robin/agent   — LLM agent utilities, person resolution
packages/queue  @robin/queue   — BullMQ producer/consumer abstractions
packages/shared @robin/shared  — Shared types, lookup keys, slug helpers
packages/caslock @robin/caslock — CAS-based distributed locking
```

## Tech Stack

| Layer | Stack |
|-------|-------|
| API | Hono, Zod, better-auth |
| Database | PostgreSQL + pgvector, Drizzle ORM |
| Queue | Redis + BullMQ |
| AI | OpenRouter (Claude, embeddings) |
| Frontend | Next.js 16, React 19, Tailwind CSS, shadcn/ui |
| Tooling | TypeScript, Biome, Vitest, Turborepo, pnpm |

## Quick Start

```bash
# Clone and install
git clone https://github.com/withrobinhq/robin.git
cd robin
pnpm install

# Configure environment
cp core/.env.example core/.env

# Generate MASTER_KEY (required for encryption)
openssl rand -hex 32
# Paste the output into core/.env as MASTER_KEY=<value>

# Fill in the remaining values:
# - DATABASE_URL (Postgres with pgvector extension)
# - REDIS_URL
# - OPENROUTER_API_KEY
# - BETTER_AUTH_SECRET (32+ chars)
# - INITIAL_USERNAME / INITIAL_PASSWORD

# Push database schema
pnpm --filter @robin/core db:push

# Start dev servers (core API + wiki frontend)
pnpm dev
```

Core runs on `http://localhost:3000`, wiki on `http://localhost:8080`.

## MCP Tools

Robin exposes an MCP server for Claude, ChatGPT, and other AI clients.

| Tool | Description |
|------|-------------|
| `log_entry` | Capture a thought — feeds the full 6-stage AI pipeline |
| `log_fragment` | Write a fragment directly to a known wiki (fast path) |
| `create_wiki` | Create a new wiki with auto-inferred type |
| `edit_wiki` | Update wiki content with edit history preservation |
| `list_wikis` | List all wikis with fragment counts and type info |
| `get_wiki` | Get wiki details with full body and fragment snippets |
| `get_fragment` | Get full fragment content by slug |
| `find_person` | Find a person by ID or fuzzy name search |
| `brief_person` | Get a formatted person briefing (no LLM call) |
| `search` | Hybrid BM25 + semantic search across all entities |
| `get_wiki_types` | List available wiki types and descriptors |
| `create_wiki_type` | Define a custom wiki type |
| `publish_wiki` | Publish a wiki with a stable public URL |
| `unpublish_wiki` | Unpublish a wiki (preserves slug for re-publish) |
| `get_timeline` | Audit timeline for a wiki and its fragments |

## API

The core server exposes a REST API alongside MCP. OpenAPI spec available at:

```
GET http://localhost:3000/openapi.json
```

Generate the TypeScript client for the wiki frontend:

```bash
pnpm --filter @robin/wiki openapi:generate
```

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| M1 | Foundation — repo scaffold, schema, single-user auth | Done |
| M2 | Ingest Pipeline — 6-stage pipeline with inline-async | Done |
| M3 | Wiki Composition — 10 wiki types with quality gates | Done |
| M4 | Search — hybrid two-layer retrieval with RRF fusion | Done |
| M5 | MCP Server — 15 tools for AI client integration | Done |
| M6 | API Routes — REST API with wiki governance | Done |
| M7 | Frontend Integration — Wikipedia-style web UI | Done |
| M8 | Deploy & Ship — one-click deployment | Open |
| M9 | Audit Log — append-only event store with timeline views | Done |
| M10 | Interconnectivity & Trust Gates — wiki linking, source quality | Done |

Track progress: [GitHub Issues](https://github.com/withrobinhq/robin/issues)

## License

Private. All rights reserved.
