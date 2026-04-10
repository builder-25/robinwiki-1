# Phase 2: Package Migration - Research

**Researched:** 2026-04-10
**Domain:** pnpm workspace package migration — TypeScript ESM packages with tsdown build
**Confidence:** HIGH

---

## Summary

Phase 2 copies the three workspace packages (`@robin/agent`, `@robin/queue`, `@robin/shared`) from the `robin-fullstack` source monorepo into `packages/` under the new `robin` workspace. The source packages are already correctly named and structured. Migration is a file copy + minor path adjustment in `tsconfig.json` `paths` entries (from `../../` relative to the new root). No renaming, no rewriting.

The critical ordering constraint is: `@robin/shared` has no cross-package dependencies and must migrate first. `@robin/queue` depends only on `@robin/shared`. `@robin/agent` depends on `@robin/shared`. All three can be migrated in one plan (shared first, then queue and agent in the same wave), since the source files are only being copied — the build step is not executed in this phase.

The main non-obvious risk is the `@robin/shared` tsdown config's `copy` directive: it copies YAML spec files from `src/prompts/specs` to `dist/prompts` at build time. Those YAML files must land alongside the TypeScript source when migrating. The tsdown config itself handles this — but only if the files are present in `src/`. Confirm all 17 `.yaml` spec files come across.

**Primary recommendation:** Copy each package directory verbatim from `robin-fullstack/packages/` to `robin/packages/`, then update each `tsconfig.json`'s `paths` entries to use the new relative depths (from `../` to the correct path under the new layout). Do not run builds in this phase — Phase 4 is the verification gate.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PACK-01 | `@robin/agent` migrated to `packages/agent/` with all agents and stages | Source at `robin-fullstack/packages/agent/` — 37 files, correct package name already `@robin/agent` |
| PACK-02 | `@robin/queue` migrated to `packages/queue/` with BullMQ abstraction | Source at `robin-fullstack/packages/queue/` — 1 source file + config, package name `@robin/queue` |
| PACK-03 | `@robin/shared` migrated to `packages/shared/` with types, prompts, and utilities | Source at `robin-fullstack/packages/shared/` — 63 files including 17 YAML specs, package name `@robin/shared` |
| PACK-04 | All `workspace:*` cross-references resolve correctly | `@robin/agent` → `@robin/shared: workspace:*`; `@robin/queue` → `@robin/shared: workspace:*`; no other cross-references |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tsdown | ^0.21.0 | Build ESM output + `.d.mts` types | Already used by all three packages [VERIFIED: source package.json] |
| vitest | ^2.0.0 | Unit test runner | Already configured in agent and shared [VERIFIED: source package.json] |
| typescript | ^5.4.0 | Type checking | Used across all packages [VERIFIED: source package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | ^4.0.0 | Run TypeScript files directly | agent `eval` script only — dev tool |
| @biomejs/biome | ^1.8.0 | Lint + format | Root-level — packages defer to root config |

### Alternatives Considered

None — this is a migration, not a greenfield build. The existing stack is locked.

**Installation:** No new packages needed. Package dependencies come from their own `package.json` files; pnpm resolves them when `pnpm install` is run at Phase 4.

---

## Source Inventory

### `@robin/agent` (PACK-01)

**Source:** `robin-fullstack/packages/agent/`

**Files to migrate:**

| Path | Notes |
|------|-------|
| `package.json` | Name already `@robin/agent`; dependency `@robin/shared: workspace:*` |
| `tsconfig.json` | Paths entries need depth adjustment (see Architecture Patterns) |
| `tsdown.config.ts` | Unbundled ESM with `dts: true` |
| `vitest.config.ts` | Aliases `@robin/shared` to `../../packages/shared/src/index.ts` — must update relative path |
| `src/` (37 files) | agents/, stages/, regen/, eval/, index.ts, and standalone modules |

**Cross-package imports in source:** `@robin/shared` used in 17 source files. Resolved via vitest alias at test time and via `dist/` at build time. No runtime path patching needed.

**Exclusions from tsconfig:** `src/__tests__`, `src/eval`, `src/mastra` excluded from TypeScript compilation (intentional — keep as-is).

### `@robin/queue` (PACK-02)

**Source:** `robin-fullstack/packages/queue/`

**Files to migrate:**

| Path | Notes |
|------|-------|
| `package.json` | Name `@robin/queue`; dependency `@robin/shared: workspace:*` |
| `tsconfig.json` | Paths entry for `@robin/shared` needs depth adjustment |
| `tsdown.config.ts` | Standard unbundled ESM config |
| `src/index.ts` | Single source file — entire BullMQ abstraction |

**Note:** No vitest config. The `test` script uses `--passWithNoTests` because there are currently no test files.

### `@robin/shared` (PACK-03)

**Source:** `robin-fullstack/packages/shared/`

**Files to migrate:**

| Path | Notes |
|------|-------|
| `package.json` | Name `@robin/shared`; no cross-package deps |
| `tsconfig.json` | No path aliases needed (no cross-package imports) |
| `tsdown.config.ts` | Has a `copy` directive: `{ from: 'src/prompts/specs', to: 'dist/prompts' }` — copies 17 YAML files |
| `vitest.config.ts` | Simple config; no aliases needed |
| `src/` (63 files) | Types, prompts, slug, filename, state-machine, wiki-links, identity |

**Critical:** 17 YAML prompt spec files live under `src/prompts/specs/`. They must be copied exactly — the runtime `loadSpec()` function reads them from disk using `__dirname` relative paths after tsdown copies them to `dist/prompts/`. Missing YAML files = runtime crash when any prompt spec is loaded.

---

## Architecture Patterns

### Recommended Project Structure (post-migration)

```
packages/
├── agent/
│   ├── package.json          # @robin/agent
│   ├── tsconfig.json
│   ├── tsdown.config.ts
│   ├── vitest.config.ts
│   └── src/
│       ├── agents/
│       ├── stages/
│       ├── regen/
│       ├── eval/
│       ├── index.ts
│       └── [standalone modules]
├── queue/
│   ├── package.json          # @robin/queue
│   ├── tsconfig.json
│   ├── tsdown.config.ts
│   └── src/
│       └── index.ts
└── shared/
    ├── package.json          # @robin/shared
    ├── tsconfig.json
    ├── tsdown.config.ts
    ├── vitest.config.ts
    └── src/
        ├── types/
        ├── prompts/
        │   ├── specs/        # 17 YAML files — must migrate intact
        │   └── loaders/
        └── [standalone modules]
```

### Pattern 1: tsconfig `paths` Depth Adjustment

In the source repo, packages live at `apps/*/` and `packages/*/`. The root `tsconfig.base.json` is at `../../` relative to each package's tsconfig. In the destination repo, packages live at `packages/*/` with the root at `../../` — the same relative depth. However, the per-package `tsconfig.json` `paths` entries currently point to sibling packages using `../shared/dist/index.d.mts`:

**Source (robin-fullstack) — agent tsconfig:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "paths": {
      "@robin/shared": ["../shared/dist/index.d.ts"],
      "@robin/queue": ["../queue/dist/index.d.ts"]
    }
  }
}
```

**Destination (robin) — agent tsconfig:**

The relative depth from `packages/agent/tsconfig.json` to `packages/shared/dist/` is still `../shared/dist/index.d.ts` — identical. No change needed for the sibling-relative paths.

The `extends` path `../../tsconfig.base.json` also stays valid since both repos have the same two-level nesting for packages.

**Conclusion:** `tsconfig.json` files copy over without modification. [VERIFIED: manually traced paths in both directory trees]

### Pattern 2: vitest.config.ts Alias Adjustment

Agent's vitest config aliases `@robin/shared` to source for test-time resolution:

**Source:**
```typescript
// Source: robin-fullstack/packages/agent/vitest.config.ts
resolve: {
  alias: {
    '@robin/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
  },
}
```

In the destination repo, `packages/agent/vitest.config.ts` → `packages/shared/` is at `../shared/src/index.ts`, not `../../packages/shared/src/index.ts`.

**Destination — agent vitest.config.ts:**
```typescript
// Source: adjustment for new layout
resolve: {
  alias: {
    '@robin/shared': resolve(__dirname, '../shared/src/index.ts'),
  },
}
```

This is the only content change required across all migrated files. [VERIFIED: directory layout traced manually]

### Pattern 3: workspace:* Dependency Resolution

pnpm resolves `workspace:*` by looking up the workspace registry (built from `pnpm-workspace.yaml`). Phase 1 declares `packages/*` as a workspace entry. When `pnpm install` runs (Phase 4), it will symlink `packages/shared` as the resolution target for `@robin/shared: workspace:*` in both `agent` and `queue`.

No manual linking is needed. The `workspace:*` specifier in each `package.json` is correct and must not be changed to a version number. [ASSUMED — standard pnpm workspace behavior, not tested in this session]

### Anti-Patterns to Avoid

- **Flattening packages:** Do not merge package source into `robin/src/`. The CLAUDE.md explicitly forbids this. `workspace:*` boundaries must be preserved.
- **Hardcoded dist paths in source:** Do not change source imports to point at `../shared/dist/` — imports should use package names (`@robin/shared`) resolved through tsconfig paths or the workspace.
- **Running builds in this phase:** Phase 2 is migration only. `tsc --noEmit` and `tsdown` run in Phase 4. Attempting to build before the server package exists will cause Turbo to fail.
- **Forgetting YAML files:** The 17 YAML spec files in `shared/src/prompts/specs/` are not TypeScript — they will not appear in `tsc` output or be caught by type checking if missing. Forgetting them causes silent runtime failures.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript path resolution for workspace packages | Custom module resolver | tsconfig `paths` + pnpm symlinks | Already configured correctly in source — copy as-is |
| ESM build output | Custom esbuild/rollup config | tsdown with `unbundle: true` | Existing configs produce correct `.mjs` + `.d.mts` output |
| Runtime YAML loading | Inline YAML strings | `loadSpec()` in `@robin/shared` | Already has caching, validation, and error handling |

---

## Runtime State Inventory

This is a file-copy migration phase with no renaming or rebrand. No runtime state is involved.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — packages contain no data stores | None |
| Live service config | None — packages are libraries, not services | None |
| OS-registered state | None | None |
| Secrets/env vars | `REDIS_URL` referenced in `@robin/queue` src | Code reference only, not renamed — no action |
| Build artifacts | Source `dist/` directories in `robin-fullstack` | None — destination starts clean, no stale artifacts |

---

## Common Pitfalls

### Pitfall 1: Missing YAML Spec Files
**What goes wrong:** The `@robin/shared` prompts loader reads YAML files from disk at `__dirname/specs/`. If the 17 `.yaml` files under `src/prompts/specs/` are not migrated, the package appears healthy (TypeScript compiles) but crashes at runtime when any prompt spec is loaded.
**Why it happens:** YAML files are not TypeScript — glob copy commands targeting `*.ts` miss them silently.
**How to avoid:** Verify file count after copy: `find packages/shared/src/prompts/specs -name "*.yaml" | wc -l` should return 17.
**Warning signs:** `Error: ENOENT: no such file or directory` when the server processes a job that calls any prompt loader.

### Pitfall 2: vitest.config.ts Alias Not Updated
**What goes wrong:** Agent tests fail with `Cannot find module '@robin/shared'` because the alias path `../../packages/shared/src/index.ts` resolves to a non-existent location in the new tree.
**Why it happens:** Path is source-relative; the directory depth changes.
**How to avoid:** Change `../../packages/shared/src/index.ts` to `../shared/src/index.ts` in `packages/agent/vitest.config.ts`.
**Warning signs:** `vitest run` in `packages/agent` fails immediately on import resolution.

### Pitfall 3: Copying `node_modules` or `dist`
**What goes wrong:** Stale compiled output or OS-linked node_modules from `robin-fullstack` gets copied into the new workspace, causing pnpm to skip proper installation.
**Why it happens:** Naive `cp -r` includes all subdirectories.
**How to avoid:** Exclude `node_modules/` and `dist/` explicitly when copying. Copy only `src/`, `package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`.
**Warning signs:** `pnpm install` succeeds but points to wrong packages, or TypeScript errors reference old absolute paths.

### Pitfall 4: `tsconfig.json` `extends` Path Wrong
**What goes wrong:** TypeScript cannot find `tsconfig.base.json` and throws a fatal config error, blocking all type-checking.
**Why it happens:** If nesting depth differs from assumed, `../../tsconfig.base.json` resolves incorrectly.
**How to avoid:** Verify: `packages/agent/tsconfig.json` → root = two levels up = `../../` — correct for `robin/packages/agent/`.
**Warning signs:** `error TS5083: Cannot read file 'tsconfig.base.json'`.

---

## Code Examples

### Correct vitest.config.ts for agent (destination)
```typescript
// packages/agent/vitest.config.ts — updated alias path for new layout
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '@robin/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
})
```

### Correct tsdown.config.ts for shared (copy verbatim)
```typescript
// packages/shared/tsdown.config.ts — copy verbatim, the copy directive is correct
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.d.ts'],
  format: 'esm',
  dts: true,
  unbundle: true,
  outDir: 'dist',
  clean: true,
  copy: { from: 'src/prompts/specs', to: 'dist/prompts' },
})
```

### workspace:* in package.json (copy verbatim — do not change)
```json
// packages/agent/package.json — dependency block (correct as-is)
{
  "dependencies": {
    "@robin/shared": "workspace:*"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tsc + rollup manual bundle | tsdown (wraps esbuild + rollup under the hood) | ~2024 | Simpler config, unbundled ESM output |
| `dist/index.d.ts` | `dist/index.d.mts` (MTS extension) | NodeNext module resolution | TypeScript picks up correct declaration for ESM |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | Workspace install | Yes | 10.15.1 | — |
| Node.js | Runtime, scripts | Yes | v22.15.1 | — |
| Source repo (robin-fullstack) | File copy | Yes | at /Users/apple/srv/withrobinhq/robin-fullstack/ | — |

**Missing dependencies with no fallback:** None.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `workspace:*` in package.json resolves correctly once pnpm-workspace.yaml declares `packages/*` | Architecture Patterns — Pattern 3 | pnpm install would fail; fix is to run `pnpm install` and inspect lockfile |

---

## Open Questions

1. **Phase 1 artifacts may not exist yet**
   - What we know: Phase 1 plan exists but progress is 0% (no plans completed)
   - What's unclear: Whether `pnpm-workspace.yaml` and root `package.json` are already on disk in the destination
   - Recommendation: Phase 2 plan must declare dependency on Phase 1 completion. If Phase 1 is run first (correct order), this is a non-issue.

2. **eval/run-scored.ts referenced in agent package.json scripts but not found in source**
   - What we know: `package.json` has `"eval:scored": "tsx src/eval/run-scored.ts"` but the file does not exist in source
   - What's unclear: Whether it was deleted and the script is stale, or it lives elsewhere
   - Recommendation: Copy the eval directory as-is; leave the script in package.json. It's a dev-only script and won't block migration or TypeScript compilation.

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `robin-fullstack/packages/agent/package.json`, `queue/package.json`, `shared/package.json` — package names, dependency graph, script definitions
- Direct file read: All three `tsconfig.json` files — paths entries and extends depth
- Direct file read: All three `tsdown.config.ts` files — build configuration including shared copy directive
- Direct file read: `packages/agent/vitest.config.ts` — alias requiring path update
- Direct file read: `packages/shared/src/prompts/loader.ts` — confirms YAML runtime dependency
- Directory listing: `find packages/shared/src/prompts/specs -name "*.yaml" | wc -l` = 17 YAML files

### Secondary (MEDIUM confidence)
- Directory structure tracing for path depth analysis (manually verified, not tool-confirmed)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Source inventory: HIGH — verified by direct file read of all three packages
- Path adjustment analysis: HIGH — traced manually against actual directory trees
- workspace:* behavior: MEDIUM — standard pnpm behavior, not tested in this session (A1)
- YAML file criticality: HIGH — verified by reading the loader source directly

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable tech, no fast-moving parts)
