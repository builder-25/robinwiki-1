# Requirements: Robin Migration

**Defined:** 2026-04-10
**Core Value:** Migrate the server app into a clean monorepo structure without regressions

## v1 Requirements

### Workspace Setup

- [ ] **WORK-01**: pnpm workspace configured with `robin` and `packages/*` as entries
- [ ] **WORK-02**: Root `package.json` is workspace root only (no server code)
- [ ] **WORK-03**: Turbo build config migrated and working
- [ ] **WORK-04**: Biome linting/formatting config migrated
- [ ] **WORK-05**: Base TypeScript config (`tsconfig.base.json`) migrated

### Server Migration

- [ ] **SERV-01**: Server source migrated to `robin/src/` preserving all modules (routes, middleware, db, mcp, lib, queue, gateway, auth, schemas)
- [ ] **SERV-02**: Server `package.json` with all production and dev dependencies
- [ ] **SERV-03**: Server `tsconfig.json` extending base config
- [ ] **SERV-04**: Drizzle migrations migrated to `robin/drizzle/`
- [ ] **SERV-05**: Server boots and `/health` responds

### Package Migration

- [ ] **PACK-01**: `@robin/agent` migrated to `packages/agent/` with all agents and stages
- [ ] **PACK-02**: `@robin/queue` migrated to `packages/queue/` with BullMQ abstraction
- [ ] **PACK-03**: `@robin/shared` migrated to `packages/shared/` with types, prompts, and utilities
- [ ] **PACK-04**: All `workspace:*` cross-references resolve correctly

### Gateway Stub

- [ ] **GATE-01**: Gateway client facade returns structurally valid default/empty responses for all methods
- [ ] **GATE-02**: Server code paths that call gateway don't crash
- [ ] **GATE-03**: Go gateway and gitolite infra excluded from migration

### Verification

- [ ] **VERI-01**: `pnpm install` succeeds
- [ ] **VERI-02**: TypeScript compiles without errors (`tsc --noEmit`)
- [ ] **VERI-03**: All workspace packages build successfully

## v2 Requirements

### Gateway Rebuild

- **GWRB-01**: Rebuild gateway functionality in TypeScript
- **GWRB-02**: Git-backed file storage for user content
- **GWRB-03**: Hybrid search (BM25 + vector)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Gateway reimplementation in TS | Future work, not part of migration |
| Search functionality | Was gateway-side, stubbed |
| Git file storage | Was gateway-side, stubbed |
| New features or refactors | Migration only, no behavioral changes |
| Tests | Migrate if they come along, but not a blocker |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WORK-01 | Phase 1 | Pending |
| WORK-02 | Phase 1 | Pending |
| WORK-03 | Phase 1 | Pending |
| WORK-04 | Phase 1 | Pending |
| WORK-05 | Phase 1 | Pending |
| PACK-01 | Phase 2 | Pending |
| PACK-02 | Phase 2 | Pending |
| PACK-03 | Phase 2 | Pending |
| PACK-04 | Phase 2 | Pending |
| SERV-01 | Phase 3 | Pending |
| SERV-02 | Phase 3 | Pending |
| SERV-03 | Phase 3 | Pending |
| SERV-04 | Phase 3 | Pending |
| SERV-05 | Phase 3 | Pending |
| GATE-01 | Phase 3 | Pending |
| GATE-02 | Phase 3 | Pending |
| GATE-03 | Phase 3 | Pending |
| VERI-01 | Phase 4 | Pending |
| VERI-02 | Phase 4 | Pending |
| VERI-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after roadmap creation*
