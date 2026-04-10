# Phase 1: Workspace Setup - Research

**Researched:** 2026-04-10
**Domain:** pnpm workspace scaffolding, Turbo, Biome, TypeScript base config
**Confidence:** HIGH — all key findings sourced directly from the source repo's checked-in config files

---

## Project Constraints (from CLAUDE.md)

- **Workspace layout:** `robin/` and `packages/*` are top-level workspace entries — no `apps/` subdirectory
- **No regressions:** Workspace package boundaries (`@robin/agent`, `@robin/queue`, `@robin/shared`) must be preserved exactly
- **Package manager:** pnpm 10+ with workspaces. Never use npm or yarn
- **Single source of truth:** Migration from existing working code, not a rewrite
- **GSD workflow enforcement:** File changes go through GSD commands; no direct repo edits outside GSD

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORK-01 | pnpm workspace configured with `robin` and `packages/*` as entries | `pnpm-workspace.yaml` content verified in source; layout differs from source (`robin/` not `apps/server/`) |
| WORK-02 | Root `package.json` is workspace root only (no server code) | Source root `package.json` verified — only workspace scripts and devDeps |
| WORK-03 | Turbo build config migrated and working | `turbo.json` verified in source at v2.8.11; task graph documented below |
| WORK-04 | Biome linting/formatting config migrated | `biome.json` verified in source at v1.9.4; full config documented below |
| WORK-05 | Base TypeScript config (`tsconfig.base.json`) migrated | `tsconfig.base.json` verified in source; path aliases require adjustment for new layout |
</phase_requirements>

---

## Summary

This phase replicates the root scaffolding from `stateful-robin-impl` into the fresh `robin` repo. All five config files exist in the source and are small (under 40 lines each). The only non-trivial decision is that the target workspace layout differs from the source: the source uses `apps/*` and `packages/*`, while the target uses `robin` (the server) and `packages/*` — a flat sibling layout with no `apps/` directory.

Every config file needs to be created at the repo root. The content for biome.json, turbo.json, and tsconfig.base.json can be copied nearly verbatim; pnpm-workspace.yaml and the root package.json need adjusted paths to reflect `robin` instead of `apps/*`. The turbo.json references `@robin/server#build` which should remain correct since the server's package.json keeps the name `@robin/server`.

**Primary recommendation:** Copy config files from source, replace `apps/*` references with `robin` in pnpm-workspace.yaml and clean up the root package.json scripts to use `robin` path patterns.

---

## Standard Stack

### Core

| Tool | Pinned Version | Purpose | Source |
|------|---------------|---------|--------|
| pnpm | 10.15.1 (env) / ≥9.0.0 (engine) | Workspace package manager | [VERIFIED: `pnpm --version` on host] |
| turbo | 2.8.11 | Monorepo task orchestration with caching | [VERIFIED: pnpm-lock.yaml in source] |
| @biomejs/biome | 1.9.4 | Unified linter + formatter | [VERIFIED: pnpm-lock.yaml in source] |
| typescript | 5.9.3 | TypeScript compiler | [VERIFIED: pnpm-lock.yaml in source] |
| node | 22.15.1 (env) / ≥20.0.0 (engine) | Runtime | [VERIFIED: `node --version` on host] |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| release-it | ^19.2.4 | Changelog and release automation | Root-only; not needed in workspace packages |
| @release-it/conventional-changelog | ^10.0.5 | Conventional commit changelog | Paired with release-it |

**Installation (root devDependencies only):**
```bash
pnpm add -D -w @biomejs/biome turbo typescript
```

---

## Architecture Patterns

### Target Workspace Layout

```
robin/                          # repo root
├── pnpm-workspace.yaml         # declares "robin" and "packages/*"
├── package.json                # workspace root — scripts + devDeps only
├── turbo.json                  # task graph for all packages
├── biome.json                  # unified lint/format config
├── tsconfig.base.json          # extended by all workspace packages
├── robin/                      # server workspace package (@robin/server)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
└── packages/                   # library packages
    ├── agent/                  # @robin/agent
    ├── queue/                  # @robin/queue
    └── shared/                 # @robin/shared
```

Note: `robin/` (the server directory) does not exist yet in Phase 1. The workspace entry will be declared but the directory is created in Phase 3.

### pnpm-workspace.yaml (exact target content)

```yaml
packages:
  - "robin"
  - "packages/*"
```

[VERIFIED: source has `apps/*` and `packages/*`; `robin` replaces `apps/*` per CLAUDE.md constraint]

### Root package.json (adapted from source)

Key adaptations from source:
- Name changes from `robin-os` to `robin` (or keep — not specified, use `robin`)
- `"workspaces"` field removed (pnpm uses `pnpm-workspace.yaml`, not package.json workspaces)
- `clean` script: replace `find apps packages` with `find robin packages`
- `packageManager` field: use `pnpm@10.15.1` to match host

```json
{
  "name": "robin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "biome format --write .",
    "clean": "find robin packages -type d \\( -name dist -o -name node_modules -o -name .turbo \\) -prune -exec rm -rf {} + && rm -rf node_modules .turbo"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "turbo": "^2.8.11",
    "typescript": "^5.9.3"
  },
  "packageManager": "pnpm@10.15.1",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

[VERIFIED: source package.json read directly; adaptations marked above are [ASSUMED] to be correct for layout change]

### turbo.json (copy verbatim from source)

The `turbo.json` content is layout-agnostic — it references package names (`@robin/server#build`), not paths. Safe to copy verbatim.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "@robin/server#build": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "build:gateway": {
      "cache": true,
      "outputs": ["bin/**"],
      "inputs": ["**/*.go", "go.mod", "go.sum"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

[VERIFIED: copied from source `turbo.json`]

Note: `build:gateway` task is retained even though the Go gateway is being dropped — it will simply never be invoked. Removing it is safe but unnecessary for this phase.

### biome.json (copy verbatim from source)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "asNeeded"
    }
  },
  "files": {
    "ignore": ["node_modules", "dist", ".turbo", ".mastra", "*.env", "*.env.*", "tsconfig*.json"]
  }
}
```

[VERIFIED: copied from source `biome.json`; `$schema` URL version bumped to match pinned 1.9.4]

### tsconfig.base.json (copy verbatim, paths unchanged for now)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@robin/agent": ["packages/agent/src/index.ts"],
      "@robin/queue": ["packages/queue/src/index.ts"],
      "@robin/shared": ["packages/shared/src/index.ts"]
    }
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

[VERIFIED: copied from source `tsconfig.base.json`; `paths` are correct for target layout since packages stay at `packages/*`]

Note: The server (`robin/`) does not appear in `paths` — that is correct. The paths entries are for the shared library packages consumed by the server, not the server itself.

### Anti-Patterns to Avoid

- **Do not add `"workspaces"` to root package.json:** pnpm reads `pnpm-workspace.yaml`; the `workspaces` field is for yarn/npm. Source has it as a leftover — omit in target.
- **Do not declare `robin` entry before the `robin/` directory exists:** pnpm may warn but won't fail. The directory will be created in Phase 3. The workspace declaration in Phase 1 is correct and expected.
- **Do not copy release-it config:** `release-it`, `@release-it/bumper`, `@release-it/conventional-changelog` are not needed for the migration and add noise. Omit unless explicitly needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task dependency graph | Custom Makefile/scripts | turbo.json `dependsOn` | Handles parallelism, caching, topological order |
| Lint + format config | Per-package eslint/prettier configs | Single root biome.json | Biome covers both; `files.ignore` handles exclusions |
| TypeScript path aliases | Manual tsconfig per package | Root `tsconfig.base.json` + per-package `extends` | Centralizes compiler options; workspace packages just `extend` |

---

## Common Pitfalls

### Pitfall 1: pnpm workspace entry declared before directory exists

**What goes wrong:** pnpm may print a warning like `No packages were found matching the glob "robin"` during `pnpm install`.
**Why it happens:** The `robin/` directory is only created in Phase 3.
**How to avoid:** This is expected and benign in Phase 1. The warning disappears once `robin/package.json` is present. Do not omit the entry from `pnpm-workspace.yaml` to silence it.
**Warning signs:** `pnpm install` warning but no error — acceptable.

### Pitfall 2: Schema URL version mismatch in biome.json

**What goes wrong:** biome prints a schema validation warning if the `$schema` URL version doesn't match the installed binary.
**Why it happens:** Source has `1.8.0` in the schema URL but the lockfile pins `1.9.4`.
**How to avoid:** Set `"$schema": "https://biomejs.dev/schemas/1.9.4/schema.json"` to match the pinned version.

### Pitfall 3: Incorrect `packageManager` field

**What goes wrong:** pnpm corepack enforcement may reject the version if `packageManager` specifies a different version than what's installed.
**Why it happens:** Source has `pnpm@10.30.3`; host has `pnpm@10.15.1`.
**How to avoid:** Set `"packageManager": "pnpm@10.15.1"` to match the host's actual version, or omit the field entirely.

### Pitfall 4: `turbo` not found after install

**What goes wrong:** `turbo` command not found if it's not in devDependencies or not installed globally.
**Why it happens:** Turbo must be a devDependency at the workspace root to be available via `pnpm run build`.
**How to avoid:** Ensure `turbo` is in root devDependencies; `pnpm run build` will use the local binary via PATH.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | TypeScript, turbo, pnpm scripts | ✓ | v22.15.1 | — |
| pnpm | Workspace install | ✓ | 10.15.1 | — |

No external services, databases, or CLI tools beyond node and pnpm are required for this phase.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Root package.json name should be `robin` (not `robin-os`) | Architecture Patterns | Low — name is cosmetic for the workspace root; doesn't affect resolution |
| A2 | release-it devDependencies should be omitted from root package.json | Architecture Patterns | Low — they are optional tooling, not required for workspace function |
| A3 | `build:gateway` task in turbo.json is harmless to retain even without a Go gateway | Architecture Patterns | Low — an unused task definition has no effect |

---

## Open Questions

1. **Root package.json name: `robin` vs `robin-os`?**
   - What we know: source uses `robin-os`; CLAUDE.md and REQUIREMENTS.md say nothing about root package name
   - What's unclear: does any tooling reference the root package name?
   - Recommendation: Use `robin` to match the repo name; the root package is never imported as a dependency

2. **Should `packageManager` field be pinned to host version or omitted?**
   - What we know: source has `pnpm@10.30.3`, host has `pnpm@10.15.1`
   - What's unclear: whether corepack enforcement is active on this machine
   - Recommendation: Pin to `pnpm@10.15.1` (host version) or omit the field entirely to avoid corepack rejection

---

## Sources

### Primary (HIGH confidence)
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/pnpm-workspace.yaml` — workspace entries
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/package.json` — root package.json content
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/turbo.json` — turbo task graph
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/biome.json` — biome config
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/tsconfig.base.json` — base tsconfig
- `/Users/apple/srv/withrobinhq/robin/.idea/stateful-robin-impl/pnpm-lock.yaml` — pinned versions for turbo (2.8.11), biome (1.9.4), typescript (5.9.3)
- Host environment — node v22.15.1, pnpm 10.15.1

### Secondary (MEDIUM confidence)
- `CLAUDE.md` project constraints — workspace layout `robin/` and `packages/*` (not `apps/*`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions read directly from lockfile and host
- Architecture: HIGH — config file content verified by direct read; layout adaptation is a straightforward substitution
- Pitfalls: MEDIUM — pitfalls sourced from knowledge of pnpm/turbo/biome behavior [ASSUMED], not reproduced experimentally

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable tooling; version drift unlikely within 30 days)
