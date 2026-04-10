# Roadmap: Robin Migration

## Overview

Migrate the server and packages from `stateful-robin-impl` into the `robin/` workspace, stub the Go gateway with a facade, and verify the result compiles and boots. Work flows from workspace scaffolding through package migration, server migration with gateway stub, and ends with full build verification.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Workspace Setup** - Scaffold the pnpm workspace with root config, Turbo, Biome, and base TypeScript config
- [ ] **Phase 2: Package Migration** - Migrate `@robin/agent`, `@robin/queue`, and `@robin/shared` into `packages/`
- [ ] **Phase 3: Server Migration** - Migrate server source to `robin/src/`, stub the gateway client, preserve all modules
- [ ] **Phase 4: Verification** - Confirm install, TypeScript compile, and workspace package builds all pass

## Phase Details

### Phase 1: Workspace Setup
**Goal**: The repo root is a valid pnpm workspace with shared config available to all packages
**Depends on**: Nothing (first phase)
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05
**Success Criteria** (what must be TRUE):
  1. `pnpm-workspace.yaml` declares `robin` and `packages/*` as entries
  2. Root `package.json` contains no server code — workspace root only
  3. Turbo config is present and recognizes the workspace topology
  4. Biome config is present at root and applies to all workspace members
  5. `tsconfig.base.json` exists at root and is extendable by workspace packages
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Create pnpm-workspace.yaml, root package.json, turbo.json, biome.json, and tsconfig.base.json; run pnpm install to verify

### Phase 2: Package Migration
**Goal**: All three workspace packages are in place under `packages/` with correct identities and cross-references
**Depends on**: Phase 1
**Requirements**: PACK-01, PACK-02, PACK-03, PACK-04
**Success Criteria** (what must be TRUE):
  1. `packages/agent/` contains all agents and stages with package name `@robin/agent`
  2. `packages/queue/` contains the BullMQ abstraction with package name `@robin/queue`
  3. `packages/shared/` contains types, prompts, and utilities with package name `@robin/shared`
  4. `workspace:*` references between packages resolve without error
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md — Migrate @robin/shared, @robin/queue, and @robin/agent from source repo; fix agent vitest alias; verify cross-references

### Phase 3: Server Migration
**Goal**: Server source lives at `robin/src/`, all modules are preserved, and gateway-dependent code paths use a facade that returns valid empty responses
**Depends on**: Phase 2
**Requirements**: SERV-01, SERV-02, SERV-03, SERV-04, GATE-01, GATE-02, GATE-03, SERV-05
**Success Criteria** (what must be TRUE):
  1. `robin/src/` contains all original modules: routes, middleware, db, mcp, lib, queue, gateway, auth, schemas
  2. Server `package.json` declares all production and dev dependencies
  3. Drizzle migrations exist under `robin/drizzle/`
  4. Gateway client facade returns structurally valid default/empty responses for every method — no crashes on gateway code paths
  5. Server boots and `GET /health` returns a successful response
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Copy server source, configs, and migrations; fix config paths; replace gateway client with no-op facade
- [x] 03-02-PLAN.md — Install dependencies, verify TypeScript compilation, and confirm server boots with /health

### Phase 4: Verification
**Goal**: The full workspace installs, compiles, and builds cleanly with no errors
**Depends on**: Phase 3
**Requirements**: VERI-01, VERI-02, VERI-03
**Success Criteria** (what must be TRUE):
  1. `pnpm install` completes successfully with no missing dependencies
  2. `tsc --noEmit` passes with zero TypeScript errors across the workspace
  3. All workspace packages (`@robin/agent`, `@robin/queue`, `@robin/shared`, `@robin/server`) build successfully
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md — Run pnpm install, fix TypeScript errors, and verify all workspace packages build successfully

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Workspace Setup | 0/1 | Not started | - |
| 2. Package Migration | 0/1 | Not started | - |
| 3. Server Migration | 0/2 | Not started | - |
| 4. Verification | 0/1 | Not started | - |
