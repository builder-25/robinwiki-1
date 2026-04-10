---
phase: 02-package-migration
reviewed: 2026-04-10T00:00:00Z
depth: quick
files_reviewed: 15
files_reviewed_list:
  - packages/agent/package.json
  - packages/agent/src/index.ts
  - packages/agent/src/agents/caller.ts
  - packages/agent/src/stages/index.ts
  - packages/agent/src/stages/persist.ts
  - packages/agent/vitest.config.ts
  - packages/agent/tsconfig.json
  - packages/queue/package.json
  - packages/queue/src/index.ts
  - packages/queue/tsconfig.json
  - packages/shared/package.json
  - packages/shared/src/index.ts
  - packages/shared/src/prompts/loader.ts
  - packages/shared/src/types/config.ts
  - packages/shared/tsconfig.json
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-10
**Depth:** quick
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Files were copied verbatim from `robin-fullstack` as part of a migration. The only intentional modification was `packages/agent/vitest.config.ts` (alias path fix). The vitest alias fix is correct and resolves the `@robin/shared` import to the source tree at `../shared/src/index.ts`, which is the right approach for a local workspace test environment. No hardcoded secrets, dangerous function calls, or empty catch blocks were found by pattern scan.

However, there are several issues worth addressing: one critical path-traversal risk in the prompt loader, two workspace cross-reference mismatches, one `tsdown` / `moduleResolution` build concern, and two info-level items.

---

## Critical Issues

### CR-01: Path Traversal in `loadSpec` — No Sanitization of `filename` or `subdir`

**File:** `packages/shared/src/prompts/loader.ts:18-30`

**Issue:** `loadSpec(filename, subdir?)` calls `resolve(SPECS_DIR, subdir)` and `resolve(dir, filename)` without any validation that the resulting path stays inside `SPECS_DIR`. A caller passing `filename = '../../.env'` or `subdir = '../../../etc'` would read arbitrary files from the filesystem. In the current codebase these callers are internal, but this is a latent path-traversal vulnerability that will bite if any external input (user config key, API parameter) ever reaches `loadSpec`.

**Fix:**
```typescript
import { resolve, relative } from 'node:path'

export function loadSpec(filename: string, subdir?: string): PromptSpec {
  const key = subdir ? `${subdir}/${filename}` : filename
  const cached = specCache.get(key)
  if (cached) return cached

  const dir = subdir ? resolve(SPECS_DIR, subdir) : SPECS_DIR
  const filePath = resolve(dir, filename)

  // Guard: ensure resolved path is inside SPECS_DIR
  const rel = relative(SPECS_DIR, filePath)
  if (rel.startsWith('..') || require('node:path').isAbsolute(rel)) {
    throw new Error(`loadSpec: path escape attempt — "${filename}"`)
  }

  const raw = readFileSync(filePath, 'utf-8')
  const parsed = loadYaml(raw)
  const spec = PromptSpecSchema.parse(parsed)
  specCache.set(key, spec)
  return spec
}
```

---

## Warnings

### WR-01: `@robin/agent` tsconfig `paths` Points to `.d.ts` Dist Files — Will Fail Before First Build

**File:** `packages/agent/tsconfig.json:9`

**Issue:** The `paths` entries for `@robin/shared` and `@robin/queue` resolve to `../shared/dist/index.d.ts` and `../queue/dist/index.d.ts`. If `@robin/shared` or `@robin/queue` have not been built yet (fresh clone, clean workspace), `tsc --noEmit` will error with "cannot find module" and the dev loop breaks. The root `tsconfig.base.json` already declares the correct source paths (`packages/shared/src/index.ts`) for workspace-level resolution — the package-level tsconfig override is counterproductive.

**Fix:** Either remove the `paths` block from `packages/agent/tsconfig.json` entirely (inherit from root) or point it to the source:
```json
"paths": {
  "@robin/shared": ["../shared/src/index.ts"],
  "@robin/queue": ["../queue/src/index.ts"]
}
```
Same fix applies to `packages/queue/tsconfig.json` for `@robin/shared`.

### WR-02: `@robin/queue` tsconfig `paths` Has Same Pre-Build Failure Risk

**File:** `packages/queue/tsconfig.json:7`

**Issue:** Same as WR-01 — `@robin/shared` resolves to `../shared/dist/index.d.ts`. Fresh-clone `typecheck` will fail until shared is built.

**Fix:** Point to source or remove and inherit from root:
```json
"paths": {
  "@robin/shared": ["../shared/src/index.ts"]
}
```

### WR-03: `@robin/agent/package.json` Missing `@robin/queue` Dependency Despite Usage in `src/stages/`

**File:** `packages/agent/package.json`

**Issue:** `packages/agent/tsconfig.json` declares a `paths` alias for `@robin/queue`, implying queue types are used somewhere in the agent package. The package `dependencies` list only declares `@robin/shared`. If any agent source file imports from `@robin/queue` (e.g., job types for the `enqueueLinkJob` callback), the dependency is implicit — it will work at runtime only because pnpm hoists it, but it is undeclared. This is fragile and will break if the workspace layout changes or strict `--filter` builds are used.

**Fix:** Audit whether `@robin/queue` types are imported in `packages/agent/src`. If yes, add `"@robin/queue": "workspace:*"` to `packages/agent/package.json` dependencies. If no imports exist, remove the `@robin/queue` entry from `packages/agent/tsconfig.json` paths.

---

## Info

### IN-01: `vitest.config.ts` Alias Fix Verified Correct

**File:** `packages/agent/vitest.config.ts:11`

**Issue:** None — the alias `'@robin/shared': resolve(__dirname, '../shared/src/index.ts')` is the right fix. Vitest does not honour pnpm workspace symlinks during test runs without an explicit alias, and pointing directly to the source `.ts` file avoids a dependency on a pre-built dist. This is the idiomatic fix.

### IN-02: `shared/package.json` vitest Version Inconsistency

**File:** `packages/shared/package.json:29`

**Issue:** `@robin/shared` declares `"vitest": "^4.0.18"` while `@robin/agent` and `@robin/queue` both declare `"vitest": "^2.0.0"`. This version gap (major version difference) will either cause pnpm to install two copies or resolve to one version depending on the semver constraints, creating a potentially confusing test environment. This is unlikely to cause failures today but should be normalized.

**Fix:** Align all three packages to the same vitest version range. Pick the highest stable release and update `packages/agent` and `packages/queue` to match, or pin `packages/shared` back to `^2.0.0`.

---

_Reviewed: 2026-04-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
