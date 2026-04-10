# Robin

## What This Is

Robin is an AI-powered second brain that captures thoughts through conversation and structures them into a searchable knowledge base. Users interact with AI (via MCP or web UI), and Robin runs in the background to automatically extract atomic ideas (fragments), classify them into topic clusters (threads), and store everything in personal git-backed markdown repositories.

This repo is a migration from the original `stateful-robin-impl` monorepo. The Go gateway is being removed — its functionality will be stubbed via a facade in the gateway client that returns expected empty/default objects. The server app is the sole application, owning all intelligence, auth, API, MCP, and AI pipeline responsibilities.

## Core Value

Users can capture raw thoughts and have them automatically structured into searchable, interconnected knowledge — without manual organization.

## Requirements

### Validated

- [x] Set up pnpm workspace with `robin` and `packages/*` as workspace entries — Validated in Phase 1: Workspace Setup
- [x] Retain existing TypeScript config, Biome linting, and build setup — Validated in Phase 1: Workspace Setup

### Active

- [x] ~~Migrate server app from `stateful-robin-impl` into `robin/` workspace directory with `src/` source layout~~ — Validated in Phase 3: Server Migration
- [x] ~~Migrate `packages/agent`, `packages/queue`, `packages/shared` as workspace packages under `packages/`~~ — Validated in Phase 2: Package Migration
- [x] ~~Stub gateway client with facade that returns expected empty/default objects for all gateway calls~~ — Validated in Phase 3: Server Migration
- [x] ~~Remove Go gateway and gitolite infrastructure entirely~~ — Validated in Phase 3: Server Migration
- [x] ~~Set up pnpm workspace with `robin` and `packages/*` as workspace entries~~ (Phase 1)
- [x] ~~Preserve all existing server functionality: auth, REST API, MCP, AI pipeline, BullMQ workers~~ — Validated in Phase 3: Server Migration
- [x] ~~Database schema and Drizzle migrations live inside `robin/drizzle/`~~ — Validated in Phase 3: Server Migration
- [x] ~~Server boots and all routes respond (gateway-dependent routes return stub data)~~ — Validated in Phase 3: Server Migration
- [x] ~~Retain existing TypeScript config, Biome linting, and build setup~~ (Phase 1)

### Out of Scope

- Go gateway reimplementation — stubbed for now, future work
- Gitolite provisioning — removed, not needed without gateway
- Git-backed file storage — depends on gateway, stubbed
- Hybrid search (BM25 + vector) — was gateway-side, stubbed
- Frontend/web UI — lives in a separate repo
- New features — this is a structural migration only

## Context

**Source repo:** `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl`

The original was a pnpm + Turbo monorepo with two apps (`server` and `gateway`) and three packages (`agent`, `queue`, `shared`). The server is a Hono/TypeScript app on Node 22 with PostgreSQL (Drizzle), Redis (BullMQ), better-auth, MCP SDK, and Mastra AI agents. The Go gateway handled git storage and hybrid search but is being dropped.

**Target structure:**
```
robin/                      # repo root
├── robin/                  # @robin/server workspace
│   ├── src/                # server source
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── db/
│   │   ├── mcp/
│   │   └── index.ts
│   ├── drizzle/
│   ├── package.json
│   └── tsconfig.json
├── packages/
│   ├── agent/
│   ├── queue/
│   └── shared/
├── package.json            # workspace root only
└── pnpm-workspace.yaml
```

**Key tech:**
- Hono 4.4 (web framework)
- Drizzle ORM 0.45.1 (PostgreSQL)
- BullMQ 5.0.0 (job queue via Redis)
- better-auth 1.0.0 (authentication)
- Mastra Core 1.8.0 (AI agents)
- MCP SDK (Model Context Protocol)
- Pino (structured logging)
- Biome (linting/formatting)
- pnpm 10 workspaces

## Constraints

- **No regressions**: Workspace package boundaries (`@robin/agent`, `@robin/queue`, `@robin/shared`) must be preserved exactly — no flattening
- **Gateway facade**: Gateway client must return structurally valid responses so the server doesn't crash on gateway-dependent code paths
- **Single source**: Migration from existing working code, not a rewrite
- **Workspace layout**: `robin/` and `packages/*` are top-level workspace entries, no `apps/` subdirectory

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Drop Go gateway entirely | Simplify to single-language repo; gateway functionality can be rebuilt in TypeScript later | -- Pending |
| Stub gateway client with facade | Prevents regressions in server code that calls gateway; no-op instead of deletion | -- Pending |
| Server at `robin/` not `apps/server/` | Future apps (e.g. `router/`) sit as sibling workspace dirs, no `apps/` nesting | -- Pending |
| Keep `src/` inside `robin/` | Original server used `src/`, no rename needed | -- Pending |
| Preserve workspace packages | Flattening risks regressions from import rewrites; boundaries enforce separation | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after initialization*
