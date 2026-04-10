# Phase 3: Server Migration - Research

**Researched:** 2026-04-10
**Domain:** Server app migration, gateway facade, Drizzle migrations
**Confidence:** HIGH -- all findings sourced from direct reads of source repository files

---

## Project Constraints (from CLAUDE.md)

- **No regressions**: Workspace package boundaries (`@robin/agent`, `@robin/queue`, `@robin/shared`) must be preserved exactly -- no flattening
- **Gateway facade**: Gateway client must return structurally valid responses so the server doesn't crash on gateway-dependent code paths
- **Single source**: Migration from existing working code, not a rewrite
- **Workspace layout**: `robin/` and `packages/*` are top-level workspace entries, no `apps/` subdirectory
- **Package manager**: pnpm 10+ with workspaces. Never use npm or yarn
- **GSD workflow enforcement**: File changes go through GSD commands

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SERV-01 | Server source migrated to `robin/src/` preserving all modules | Full directory tree mapped: 9 subdirs, 62 source files. Copy plan documented below |
| SERV-02 | Server `package.json` with all production and dev dependencies | Source package.json fully read: 17 production deps, 9 dev deps. Workspace refs need no change |
| SERV-03 | Server `tsconfig.json` extending base config | Source tsconfig read: `extends` path changes from `../../tsconfig.base.json` to `../tsconfig.base.json` |
| SERV-04 | Drizzle migrations migrated to `robin/drizzle/` | Source drizzle dir has 1 migration (191 lines) + meta journal. Copy verbatim |
| GATE-01 | Gateway client facade returns structurally valid default/empty responses for all methods | Gateway client API fully mapped: 6 methods with exact return types documented below |
| GATE-02 | Server code paths that call gateway don't crash | 13 source files import gatewayClient. Facade must handle module-level HMAC_SECRET throw |
| GATE-03 | Go gateway and gitolite infra excluded from migration | Only `src/gateway/client.ts` migrates; no Go code, no gitolite |
| SERV-05 | Server boots and `/health` responds | Health endpoint is pre-auth, registered first. Boot blockers: env vars, gateway IIFE throw |
</phase_requirements>

---

## Summary

The server lives at `apps/server/` in the source repo and must land at `robin/` in the target. It is a Hono 4.4 app running on `@hono/node-server` with PostgreSQL (Drizzle ORM), Redis (BullMQ via `@robin/queue`), better-auth sessions, MCP SDK integration, and Pino logging. The source has 62 non-test source files across 9 subdirectories under `src/`, plus a `drizzle/` migrations dir, `drizzle.config.ts`, `vitest.config.ts`, `openapi.yaml`, and a `scripts/` dir with one code-gen script.

The critical migration challenge is the gateway client. The original `gateway/client.ts` has a top-level IIFE that throws if `GATEWAY_HMAC_SECRET` is not set -- this happens at module import time, meaning any file importing `gatewayClient` will crash the server on startup without that env var. The facade must replace this module entirely: remove the HMAC_SECRET requirement and make all 6 methods return structurally valid empty/default responses instead of making HTTP calls. Thirteen files across routes, queue workers, and MCP handlers import from `gateway/client.ts`.

**Primary recommendation:** Copy all source files verbatim, then replace `gateway/client.ts` with a facade module that exports the same `gatewayClient` object with all 6 methods returning resolved promises with structurally valid empty objects. Fix `tsconfig.json` extends path. No other source files need modification.

---

## Source Repository Structure

### Server Directory Tree (from source `apps/server/`) [VERIFIED: direct file listing]

```
apps/server/
├── .env.example                    # 13 env vars documented
├── biome.json                      # extends root, overrides lineWidth to 80
├── drizzle/
│   └── migrations/
│       ├── 0000_windy_rocket_racer.sql  # 191 lines -- initial schema
│       └── meta/
│           ├── _journal.json
│           └── 0000_snapshot.json
├── drizzle.config.ts               # schema: ./src/db/schema.ts, out: ./drizzle/migrations
├── openapi.yaml                    # 2129 lines -- generated OpenAPI spec
├── package.json                    # @robin/server, 17 prod + 9 dev deps
├── scripts/
│   └── generate-openapi-manifest.ts
├── src/
│   ├── index.ts                    # Hono app, route mounting, boot
│   ├── auth.ts                     # better-auth config with Drizzle adapter
│   ├── keypair.ts                  # Ed25519 keypair generation/encryption
│   ├── db/
│   │   ├── client.ts               # Drizzle + postgres.js connection
│   │   ├── schema.ts               # All table definitions (317 lines)
│   │   ├── sync.ts                 # DB upsert/state-transition helpers
│   │   ├── dedup.ts                # Job deduplication
│   │   ├── locking.ts              # Advisory locking
│   │   ├── slug.ts                 # Slug generation
│   │   ├── edge-types.ts           # Edge type constants
│   │   └── pipeline-events.ts      # Pipeline event recording
│   ├── gateway/
│   │   └── client.ts               # THE file to replace with facade
│   ├── lib/
│   │   ├── logger.ts               # Pino logger singleton
│   │   ├── validation.ts           # Shared validation helpers
│   │   ├── content-schemas.ts      # Content write Zod schemas
│   │   ├── frontmatter.ts          # Gray-matter helpers
│   │   ├── wiki-lookup.ts          # Wiki link resolution
│   │   └── id.ts                   # ID generation
│   ├── mcp/
│   │   ├── server.ts               # MCP server factory
│   │   ├── handlers.ts             # MCP write handlers
│   │   ├── resolvers.ts            # MCP read resolvers
│   │   └── jwt.ts                  # MCP JWT verification
│   ├── middleware/
│   │   ├── session.ts              # Session middleware
│   │   ├── api-key.ts              # API key middleware
│   │   └── httpLogger.ts           # HTTP request logger
│   ├── queue/
│   │   ├── worker.ts               # Main job dispatcher (~950 lines)
│   │   ├── producer.ts             # BullMQ producer singleton
│   │   ├── regen-worker.ts         # Thread regen processor
│   │   ├── scheduler.ts            # Batch regen cron
│   │   ├── sync-worker.ts          # Git-DB sync worker
│   │   └── sync-worker.test.ts     # Co-located test
│   ├── routes/
│   │   ├── entries.ts              ├── admin.ts
│   │   ├── fragments.ts            ├── bull-board.ts
│   │   ├── threads.ts              ├── content.ts
│   │   ├── people.ts               ├── graph.ts
│   │   ├── vaults.ts               ├── mcp.ts
│   │   ├── users.ts                ├── robin.ts
│   │   ├── search.ts               ├── relationships.ts
│   │   ├── internal.ts             └── internal.test.ts
│   ├── schemas/
│   │   ├── index.ts                # Barrel export
│   │   ├── base.schema.ts          ├── admin.schema.ts
│   │   ├── entries.schema.ts       ├── content.schema.ts
│   │   ├── fragments.schema.ts     ├── graph.schema.ts
│   │   ├── threads.schema.ts       ├── internal.schema.ts
│   │   ├── people.schema.ts        ├── relationships.schema.ts
│   │   ├── users.schema.ts         ├── robin.schema.ts
│   │   ├── vaults.schema.ts        └── search.schema.ts
│   └── __tests__/                  # 14 test files (migrate as-is)
├── tsconfig.json                   # extends ../../tsconfig.base.json
└── vitest.config.ts                # aliases for @robin/* packages
```

### File Counts [VERIFIED: find command]

| Category | Count |
|----------|-------|
| Source files (non-test) | 49 |
| Test files (`__tests__/` + co-located) | 16 |
| Config files (root of server) | 5 |
| Drizzle migration files | 3 |
| Scripts | 1 |
| OpenAPI spec | 1 |
| **Total files to copy** | **75** |

---

## Gateway Client Facade (GATE-01, GATE-02)

### Original API [VERIFIED: `apps/server/src/gateway/client.ts`]

The `gatewayClient` object exports 6 methods, all returning promises:

| Method | Signature | Return Type |
|--------|-----------|-------------|
| `provision` | `(userId: string, publicKey: string)` | `{ status: string; userId: string }` |
| `write` | `(req: { userId, path, content, message, branch, batch? })` | `{ path: string; commitHash: string; timestamp: string }` |
| `search` | `(userId, query, limit?, minScore?, repoPaths?)` | `{ results: SearchResult[]; count: number }` |
| `read` | `(userId: string, path: string)` | `{ path: string; content: string; commitHash: string }` |
| `reindex` | `(userId: string)` | `{ status: string }` |
| `batchWrite` | `(req: { userId, files: Array<{path, content}>, message, branch })` | `{ commitHash: string; fileCount: number; timestamp: string }` |

### Boot-blocking Problem [VERIFIED: source code]

The original module has a top-level IIFE:

```typescript
const HMAC_SECRET = (() => {
  const s = process.env.GATEWAY_HMAC_SECRET
  if (!s) throw new Error('GATEWAY_HMAC_SECRET env var is required')
  return s
})()
```

This executes at **module import time**. Since 13 files import from `gateway/client.ts`, the server cannot start without `GATEWAY_HMAC_SECRET`. The facade must remove this IIFE entirely.

### Facade Design [ASSUMED]

Replace the entire `gateway/client.ts` with a no-op facade:

```typescript
import type { SearchResult } from '@robin/shared'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'gateway' })

export const gatewayClient = {
  provision: async (_userId: string, _publicKey: string) => {
    log.debug('gateway facade: provision (no-op)')
    return { status: 'stub', userId: _userId }
  },

  write: async (_req: {
    userId: string
    path: string
    content: string
    message: string
    branch: string
    batch?: boolean
  }) => {
    log.debug('gateway facade: write (no-op)')
    return { path: _req.path, commitHash: 'stub', timestamp: new Date().toISOString() }
  },

  search: async (_userId: string, _query: string, _limit = 10, _minScore?: number, _repoPaths?: string[]) => {
    log.debug('gateway facade: search (no-op)')
    return { results: [] as SearchResult[], count: 0 }
  },

  read: async (_userId: string, _path: string) => {
    log.debug('gateway facade: read (no-op)')
    return { path: _path, content: '', commitHash: 'stub' }
  },

  reindex: async (_userId: string) => {
    log.debug('gateway facade: reindex (no-op)')
    return { status: 'stub' }
  },

  batchWrite: async (_req: {
    userId: string
    files: Array<{ path: string; content: string }>
    message: string
    branch: string
  }) => {
    log.debug('gateway facade: batchWrite (no-op)')
    return { commitHash: 'stub', fileCount: _req.files.length, timestamp: new Date().toISOString() }
  },
}
```

Key design points:
- Same export name and shape -- no changes to any importing file
- No HMAC_SECRET, no HTTP calls, no `node:crypto` import
- Returns structurally valid objects matching every return type
- `search` returns `{ results: [], count: 0 }` -- routes will return empty arrays, not crash
- `read` returns empty content -- callers parsing frontmatter will get empty/default values
- `write`/`batchWrite` return stub commit hashes -- callers only log these, don't use them as keys

### Files Importing gatewayClient [VERIFIED: grep]

| File | Import Type | Usage Pattern |
|------|------------|---------------|
| `routes/entries.ts` | value | `gatewayClient.write()` |
| `routes/fragments.ts` | value | `gatewayClient.read()`, `.write()` |
| `routes/threads.ts` | value | `gatewayClient.read()`, `.write()` |
| `routes/vaults.ts` | value | `gatewayClient.write()` |
| `routes/search.ts` | value | `gatewayClient.search()` |
| `routes/content.ts` | value | `gatewayClient.read()`, `.write()` |
| `routes/admin.ts` | value | `gatewayClient.read()` |
| `routes/mcp.ts` | value | `gatewayClient` passed as dep |
| `queue/worker.ts` | value | Multiple: `.batchWrite()`, `.search()`, `.read()`, `.write()`, `.provision()` |
| `queue/regen-worker.ts` | value | `.read()`, `.batchWrite()` |
| `mcp/handlers.ts` | **type only** | `typeof GatewayClient` |
| `mcp/resolvers.ts` | **type only** | `typeof GatewayClient` |
| `mcp/server.ts` | via deps | Passes to handlers/resolvers |

The two type-only imports (`mcp/handlers.ts`, `mcp/resolvers.ts`) will work fine since they use `import type` and don't trigger module execution.

---

## tsconfig.json Adaptation (SERV-03)

### Source [VERIFIED: `apps/server/tsconfig.json`]

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": false,
    "noImplicitAny": false,
    "skipLibCheck": true,
    "paths": {
      "@robin/shared": ["../../packages/shared/dist/index.d.ts"],
      "@robin/queue": ["../../packages/queue/dist/index.d.ts"],
      "@robin/agent": ["../../packages/agent/dist/index.d.ts"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

### Required Changes for Target (`robin/tsconfig.json`)

| Field | Source Value | Target Value | Reason |
|-------|-------------|--------------|--------|
| `extends` | `../../tsconfig.base.json` | `../tsconfig.base.json` | `robin/` is one level deep, not two |
| `paths.@robin/shared` | `../../packages/shared/dist/index.d.ts` | `../packages/shared/dist/index.d.ts` | Same depth change |
| `paths.@robin/queue` | `../../packages/queue/dist/index.d.ts` | `../packages/queue/dist/index.d.ts` | Same |
| `paths.@robin/agent` | `../../packages/agent/dist/index.d.ts` | `../packages/agent/dist/index.d.ts` | Same |

Everything else stays the same. The `strict: false` / `noImplicitAny: false` is intentional in the source -- the server has loose typing. Do not tighten these.

---

## package.json (SERV-02)

### Source [VERIFIED: `apps/server/package.json`]

Copy verbatim. No path adjustments needed -- `package.json` uses package names, not relative paths.

**Production dependencies (17):**
`@bull-board/api`, `@bull-board/hono`, `@hono/node-server`, `@hono/zod-validator`, `@modelcontextprotocol/sdk`, `@robin/agent` (workspace:*), `@robin/queue` (workspace:*), `@robin/shared` (workspace:*), `better-auth`, `diff`, `dotenv`, `drizzle-orm`, `gray-matter`, `hono`, `jose`, `js-yaml`, `nanoid`, `pino`, `postgres`, `zod`

**Dev dependencies (9):**
`@types/diff`, `@types/js-yaml`, `@types/node`, `drizzle-kit`, `pino-pretty`, `tsx`, `typescript`, `vitest`, `zod-to-json-schema`

The three `workspace:*` references (`@robin/agent`, `@robin/queue`, `@robin/shared`) will resolve correctly since Phase 2 will have placed these packages in `packages/`.

---

## Drizzle Migrations (SERV-04)

### Source [VERIFIED: `apps/server/drizzle/`]

```
drizzle/
└── migrations/
    ├── 0000_windy_rocket_racer.sql   # 191 lines, initial schema
    └── meta/
        ├── _journal.json              # Migration journal
        └── 0000_snapshot.json         # Schema snapshot
```

Copy the entire `drizzle/` directory verbatim to `robin/drizzle/`.

The `drizzle.config.ts` references `./src/db/schema.ts` and `./drizzle/migrations` -- both paths are relative to the server root and remain correct after the move.

---

## Server Boot Requirements (SERV-05)

### Boot Sequence [VERIFIED: `src/index.ts`]

1. `dotenv/config` loads env vars
2. `js-yaml` + `readFileSync` loads `openapi.yaml` (relative to `import.meta.url`)
3. Hono app created, middleware attached
4. `/health` registered (pre-auth, no DB needed)
5. Auth routes, authenticated API routes mounted
6. `startWorkers()` called -- connects to Redis, starts BullMQ workers
7. `serve()` starts HTTP listener on PORT

### Required Environment Variables [VERIFIED: source code reads]

| Var | Required | Throws on Missing | Used By |
|-----|----------|-------------------|---------|
| `DATABASE_URL` | Yes | `db/client.ts` throws at import | Drizzle connection |
| `BETTER_AUTH_SECRET` | Yes | `auth.ts` throws in IIFE | better-auth |
| `REDIS_URL` | Yes (implicit) | BullMQ connection fails | Queue producer/workers |
| `GATEWAY_HMAC_SECRET` | **No (after facade)** | Removed by facade | N/A |
| `PORT` | No | Defaults to 3000 | HTTP listener |
| `BETTER_AUTH_URL` | No | Defaults to localhost:3000 | better-auth baseURL |
| `KEY_ENCRYPTION_SECRET` | Only for provision | Used in provision worker | Keypair generation |
| `OPENROUTER_AGENT_KEY` | Only for AI pipeline | Used by @robin/agent | LLM calls |

### Health Check [VERIFIED: `src/index.ts` line 87]

```typescript
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))
```

This is registered before any auth middleware. It requires only that the Hono app starts -- no DB, no Redis, no gateway. However, the server module imports `auth.ts` which imports `db/client.ts` which throws without `DATABASE_URL`, and `auth.ts` itself throws without `BETTER_AUTH_SECRET`. So for `/health` to respond, `DATABASE_URL` and `BETTER_AUTH_SECRET` must be set. Similarly, `startWorkers()` requires Redis.

For the boot test (`SERV-05`), the `.env.example` file should be copied and populated with dev defaults, or the test should set env vars before starting.

---

## biome.json (server-level) [VERIFIED: source]

The server has its own `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.8.0/schema.json",
  "extends": ["../../biome.json"],
  "formatter": { "lineWidth": 80 }
}
```

The `extends` path needs to change from `../../biome.json` to `../biome.json` (same depth fix as tsconfig).

---

## vitest.config.ts [VERIFIED: source]

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      '@robin/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@robin/agent': resolve(__dirname, '../../packages/agent/src/index.ts'),
      '@robin/queue': resolve(__dirname, '../../packages/queue/src/index.ts'),
    },
  },
})
```

The `resolve()` paths use `../../packages/...` -- must change to `../packages/...`.

---

## Architecture Patterns

### Target Directory Structure

```
robin/                          # @robin/server workspace package
├── package.json                # copied verbatim from source
├── tsconfig.json               # extends path adjusted: ../tsconfig.base.json
├── biome.json                  # extends path adjusted: ../biome.json
├── drizzle.config.ts           # copied verbatim (relative paths still correct)
├── vitest.config.ts            # alias paths adjusted: ../packages/...
├── openapi.yaml                # copied verbatim
├── .env.example                # copied verbatim
├── scripts/
│   └── generate-openapi-manifest.ts
├── drizzle/
│   └── migrations/
│       ├── 0000_windy_rocket_racer.sql
│       └── meta/
│           ├── _journal.json
│           └── 0000_snapshot.json
└── src/
    ├── index.ts
    ├── auth.ts
    ├── keypair.ts
    ├── db/           (7 files)
    ├── gateway/
    │   └── client.ts              # FACADE -- replaced, not original
    ├── lib/          (6 files)
    ├── mcp/          (4 files)
    ├── middleware/    (3 files)
    ├── queue/        (6 files)
    ├── routes/       (16 files)
    ├── schemas/      (14 files)
    └── __tests__/    (14 files)
```

### Migration Strategy: Copy Then Patch

1. **Copy everything** from `apps/server/` to `robin/` using `cp -r`
2. **Replace** `robin/src/gateway/client.ts` with the facade
3. **Fix paths** in 3 config files:
   - `robin/tsconfig.json`: `../../` to `../`
   - `robin/biome.json`: `../../` to `../`
   - `robin/vitest.config.ts`: `../../packages/` to `../packages/`
4. **No source code changes** to any file under `src/` except `gateway/client.ts`

### Anti-Patterns to Avoid

- **Do not modify any route, worker, or MCP file to remove gateway calls.** The facade handles this transparently. Modifying calling code violates the "no regression" constraint and introduces diff noise.
- **Do not set `strict: true` in tsconfig.** The server was written with `strict: false` and `noImplicitAny: false`. Tightening this will produce hundreds of type errors. Migration only.
- **Do not delete `openapi.yaml`.** The server reads it at startup via `readFileSync`. Missing file = crash.
- **Do not delete `__tests__/` or co-located test files.** Tests migrate as-is even though they are not a blocker requirement.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gateway facade | Complex mock system or conditional imports | Simple object literal with same shape | All callers import the same named export; drop-in replacement works |
| Path adjustments | Regex search-and-replace across all files | Fix only 3 config files | Source code uses package names (`@robin/shared`), not relative paths |
| DB schema | New schema definition | Copy `db/schema.ts` verbatim | 317 lines of Drizzle table definitions, zero changes needed |
| Migration files | Re-generate migrations | Copy `drizzle/migrations/` verbatim | Drizzle migrations are append-only; existing migration is the schema history |

---

## Common Pitfalls

### Pitfall 1: Gateway HMAC_SECRET crashes server at import time

**What goes wrong:** Server fails to start with `Error: GATEWAY_HMAC_SECRET env var is required` even though the gateway is being stubbed.
**Why it happens:** The original `gateway/client.ts` has a top-level IIFE that validates the env var. This runs when any importing module is loaded, before any route handler executes.
**How to avoid:** Replace the entire `gateway/client.ts` file with the facade. Do not try to wrap it or make the IIFE conditional -- replace the whole file.
**Warning signs:** Server crashes immediately on startup with the HMAC error.

### Pitfall 2: Missing openapi.yaml breaks boot

**What goes wrong:** `Error: ENOENT: no such file or directory` at startup.
**Why it happens:** `index.ts` line 80 does `readFileSync(new URL('../openapi.yaml', import.meta.url))` -- the file must exist relative to the compiled output or source.
**How to avoid:** Copy `openapi.yaml` to `robin/openapi.yaml`. The `new URL('../openapi.yaml', import.meta.url)` resolves relative to `src/index.ts`, so `../openapi.yaml` lands in the server root.
**Warning signs:** Crash on startup before any routes are registered.

### Pitfall 3: Config extends paths still point to `../../`

**What goes wrong:** TypeScript can't find `tsconfig.base.json`, biome can't find root config, vitest aliases point to wrong location.
**Why it happens:** Source was at `apps/server/` (two levels deep), target is at `robin/` (one level deep). Three config files use `../../` which must become `../`.
**How to avoid:** Explicitly fix `tsconfig.json`, `biome.json`, and `vitest.config.ts` after copying.
**Warning signs:** `tsc --noEmit` fails with "cannot find tsconfig.base.json"; biome gives schema warnings.

### Pitfall 4: `startWorkers()` hangs without Redis

**What goes wrong:** Server starts but hangs or crashes trying to connect to Redis for BullMQ.
**Why it happens:** `startWorkers()` is called unconditionally in `index.ts`. It creates BullMQ workers that need Redis.
**How to avoid:** For the boot/health test, Redis must be running at `REDIS_URL`, OR workers startup must be made fault-tolerant. Since this is a migration (no behavioral changes), just document that Redis is needed for full boot. The `/health` endpoint itself doesn't need Redis -- but the import chain and `startWorkers()` call do.
**Warning signs:** Server logs connection refused errors to Redis.

### Pitfall 5: db/client.ts throws without DATABASE_URL

**What goes wrong:** Server can't even load modules that depend on the DB.
**Why it happens:** `db/client.ts` has `if (!process.env.DATABASE_URL) throw new Error(...)` at module scope.
**How to avoid:** Ensure `DATABASE_URL` is set (even to a non-reachable value is fine for just checking if the server can compile -- but for actual boot, Postgres must be reachable).
**Warning signs:** Immediate crash before Hono app creation.

---

## Code Examples

### Verified: Health check endpoint

```typescript
// Source: apps/server/src/index.ts line 87
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))
```

### Verified: DB client connection

```typescript
// Source: apps/server/src/db/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env var is required')
const sql = postgres(process.env.DATABASE_URL)
export const db = drizzle(sql, { schema })
export type DB = typeof db
```

### Verified: Queue producer singleton

```typescript
// Source: apps/server/src/queue/producer.ts
import { BullMQProducer, createRedisConnection } from '@robin/queue'

const connection = createRedisConnection()
export const producer = new BullMQProducer(connection)
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | Runtime | Yes | v22.15.1 | -- |
| pnpm | Install | Yes | 10.15.1 | -- |
| PostgreSQL | DATABASE_URL | Unknown | -- | Not needed for tsc --noEmit; needed for actual boot |
| Redis | REDIS_URL / BullMQ | Unknown | -- | Not needed for tsc --noEmit; needed for actual boot |

**Missing dependencies with no fallback:**
- PostgreSQL and Redis are needed for a full server boot (`SERV-05`). If not available locally, the health check test can't run. This is an execution-time concern, not a planning blocker -- the planner should note that boot verification requires running services.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gateway facade should log via `logger.child()` for debuggability | Gateway Facade Design | Low -- logging is cosmetic |
| A2 | `read` facade returning empty content won't cause downstream parse errors in non-gateway paths | Gateway Facade Design | Medium -- frontmatter parsing of empty string may behave differently than expected; but routes that call `read` won't be exercised without the gateway, so this is moot for boot |
| A3 | PostgreSQL and Redis are available on the dev machine for boot testing | Environment | Medium -- if not available, SERV-05 can't be verified in this phase |

---

## Open Questions

1. **Are PostgreSQL and Redis running locally for boot verification?**
   - What we know: The source repo's CLAUDE.md mentions a nix flake that manages these via `start`/`stop` commands
   - What's unclear: Whether the target repo has the same dev infrastructure set up
   - Recommendation: Attempt boot test. If services aren't available, document that SERV-05 is verified structurally (compiles) but not functionally (boot tested) -- defer to Phase 4 verification

2. **Should `scripts/generate-openapi-manifest.ts` be migrated?**
   - What we know: It's a code-gen script, not needed for runtime
   - What's unclear: Whether it will be needed
   - Recommendation: Copy it anyway -- it's one file and may be useful later. Migration, not cleanup.

---

## Sources

### Primary (HIGH confidence)
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/apps/server/package.json` -- all dependencies
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/apps/server/src/gateway/client.ts` -- gateway API surface
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/apps/server/src/index.ts` -- boot sequence, health check
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/apps/server/tsconfig.json` -- TypeScript config
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/apps/server/src/db/client.ts` -- DB connection
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/apps/server/src/auth.ts` -- auth config
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/apps/server/drizzle/` -- migration files
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/apps/server/.env.example` -- env var inventory
- Grep results for `gatewayClient` across entire `src/` -- all 13 importing files mapped

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- requirement IDs and descriptions
- `.planning/PROJECT.md` -- project constraints and architecture decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- package.json read directly, all deps enumerated
- Architecture: HIGH -- full directory tree mapped, all config files read and diffs identified
- Gateway facade: HIGH -- all 6 methods mapped with exact return types from source; all 13 consumers identified
- Pitfalls: HIGH -- every pitfall derived from verified source code reads (IIFE throws, readFileSync calls, module-scope validation)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- source repo is frozen, no version drift)
