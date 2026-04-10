# Robin

## What This Is

Robin is an AI-powered second brain that captures thoughts through conversation and structures them into a searchable knowledge base. Users interact with AI (via MCP or web UI), and Robin runs in the background to automatically extract atomic ideas (fragments), classify them into topic clusters (threads), and store everything in personal git-backed markdown repositories.

The codebase is a pnpm + Turbo monorepo with one app (`robin/` — the server) and three workspace packages (`@robin/agent`, `@robin/queue`, `@robin/shared`). The Go gateway has been removed; its functionality is stubbed via a facade in the gateway client.

## Core Value

Users can capture raw thoughts and have them automatically structured into searchable, interconnected knowledge — without manual organization.

## Requirements

### Validated

- ✓ Set up pnpm workspace with `robin` and `packages/*` as workspace entries — v1.0
- ✓ Retain existing TypeScript config, Biome linting, and build setup — v1.0
- ✓ Migrate server app into `robin/` workspace directory with `src/` source layout — v1.0
- ✓ Migrate `packages/agent`, `packages/queue`, `packages/shared` as workspace packages — v1.0
- ✓ Stub gateway client with facade returning valid empty/default responses — v1.0
- ✓ Remove Go gateway and gitolite infrastructure — v1.0
- ✓ Preserve all server functionality: auth, REST API, MCP, AI pipeline, BullMQ workers — v1.0
- ✓ Database schema and Drizzle migrations in `robin/drizzle/` — v1.0
- ✓ Server boots and all routes respond — v1.0
- ✓ `pnpm install` succeeds with no missing dependencies — v1.0
- ✓ TypeScript compiles without errors across workspace — v1.0
- ✓ All workspace packages build successfully — v1.0

### Active

(None — next milestone requirements TBD via `/gsd-new-milestone`)

### Out of Scope

- Go gateway reimplementation — stubbed for now, future work
- Git-backed file storage — depends on gateway rebuild
- Hybrid search (BM25 + vector) — was gateway-side, stubbed
- Frontend/web UI — lives in a separate repo

## Context

**Shipped v1.0** with 17,961 LOC TypeScript across 172 source files.

**Current structure:**
```
robin/                      # repo root
├── robin/                  # @robin/server workspace
│   ├── src/                # server source (routes, middleware, db, mcp, lib, queue, gateway, auth, schemas)
│   ├── drizzle/            # database migrations
│   ├── package.json
│   └── tsconfig.json
├── packages/
│   ├── agent/              # @robin/agent — AI agents and stages
│   ├── queue/              # @robin/queue — BullMQ abstraction
│   └── shared/             # @robin/shared — types, prompts, utilities
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
- pnpm 10 workspaces + Turbo

## Constraints

- **No regressions**: Workspace package boundaries (`@robin/agent`, `@robin/queue`, `@robin/shared`) must be preserved exactly — no flattening
- **Gateway facade**: Gateway client returns structurally valid responses so server doesn't crash on gateway-dependent code paths
- **Workspace layout**: `robin/` and `packages/*` are top-level workspace entries, no `apps/` subdirectory

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Drop Go gateway entirely | Simplify to single-language repo; gateway functionality can be rebuilt in TypeScript later | ✓ Good — eliminated cross-language complexity |
| Stub gateway client with facade | Prevents regressions in server code that calls gateway; no-op instead of deletion | ✓ Good — zero crashes on gateway paths |
| Server at `robin/` not `apps/server/` | Future apps sit as sibling workspace dirs, no `apps/` nesting | ✓ Good — clean layout |
| Preserve workspace packages | Flattening risks regressions from import rewrites; boundaries enforce separation | ✓ Good — all workspace:* refs resolve |
| Verbatim copy migration | Copy files from source repo without rewriting; fix only layout-specific paths | ✓ Good — minimal risk, one vitest alias fix |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-10 after v1.0 milestone*
