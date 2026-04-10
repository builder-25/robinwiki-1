---
phase: 03-server-migration
reviewed: 2026-04-10T12:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - robin/src/gateway/client.ts
  - robin/tsconfig.json
  - robin/biome.json
  - robin/vitest.config.ts
  - robin/package.json
  - robin/src/index.ts
  - robin/.env.example
  - robin/drizzle.config.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the server migration files. The gateway facade (`robin/src/gateway/client.ts`) is well-structured and returns shapes that match caller expectations across the codebase. Configuration files have correct path adjustments for the new workspace depth. One critical issue: the existing gateway client test suite tests the OLD HTTP-based client behavior (HMAC signing, fetch calls) and will fail against the new no-op facade. Two security observations in copied files (CORS origin reflection, drizzle fallback credentials). One tsconfig strictness concern.

## Critical Issues

### CR-01: Gateway client test suite tests old HTTP client, will fail against facade

**File:** `robin/src/__tests__/gateway-client.test.ts` (not in review scope but directly coupled)
**Issue:** The test file `gateway-client.test.ts` stubs `fetch`, expects HMAC `X-Signature` headers, and tests HTTP error handling (`4xx` responses). The new facade in `robin/src/gateway/client.ts` makes zero HTTP calls -- it is a pure no-op stub. Every test assertion will fail:
- Line 39: `expect(fetchSpy).toHaveBeenCalled()` -- fetch is never called
- Line 42: `expect(headers['X-Signature']).toBeTruthy()` -- no headers exist
- Line 64: `expect(gatewayClient.reindex('user1')).rejects.toThrow()` -- facade never throws

Running `vitest run` will produce failures in this test file.
**Fix:** Replace the test file to match the facade's behavior:
```typescript
import { describe, it, expect } from 'vitest'
import { gatewayClient } from '../gateway/client'

describe('gateway client facade', () => {
  it('provision returns stub status', async () => {
    const result = await gatewayClient.provision('user1', 'pk')
    expect(result).toEqual({ status: 'stub', userId: 'user1' })
  })

  it('search returns empty results', async () => {
    const result = await gatewayClient.search('user1', 'query')
    expect(result).toEqual({ results: [], count: 0 })
  })

  it('read returns empty content', async () => {
    const result = await gatewayClient.read('user1', 'path.md')
    expect(result.content).toBe('')
  })

  it('write returns stub response with path', async () => {
    const result = await gatewayClient.write({
      userId: 'u1', path: 'p', content: 'c', message: 'm', branch: 'main',
    })
    expect(result.path).toBe('p')
    expect(result.commitHash).toBe('stub')
  })

  it('batchWrite returns file count', async () => {
    const result = await gatewayClient.batchWrite({
      userId: 'u1', files: [{ path: 'a', content: 'b' }], message: 'm', branch: 'main',
    })
    expect(result.fileCount).toBe(1)
  })
})
```

## Warnings

### WR-01: CORS origin reflection allows any origin with credentials

**File:** `robin/src/index.ts:62`
**Issue:** The CORS middleware reflects any `Origin` header back as the allowed origin (`origin: (origin) => origin`) while also setting `credentials: true`. This combination allows any website to make credentialed cross-origin requests to the API, which is a CSRF/credential-theft vector. This was likely present in the original codebase but is worth flagging since this is the server entry point.
**Fix:** Restrict to known origins, at minimum using the `CORS_ORIGIN` env var from `.env.example`:
```typescript
cors({
  origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:8080'],
  credentials: true,
})
```

### WR-02: TypeScript strict mode disabled

**File:** `robin/tsconfig.json:8-9`
**Issue:** Both `strict: false` and `noImplicitAny: false` are set. This disables critical type safety checks (null checks, implicit any, strict function types). While this may be intentional for the migration phase to avoid fixing hundreds of type errors at once, it should be tracked as technical debt -- the facade and other new code would benefit from stricter checking.
**Fix:** Plan to enable `strict: true` in a future phase. At minimum, consider enabling `strictNullChecks` to catch null/undefined issues in the facade callers that now receive empty/stub data.

### WR-03: Drizzle config has hardcoded fallback database credentials

**File:** `robin/drizzle.config.ts:9`
**Issue:** The fallback `postgresql://postgres:postgres@localhost:5432/robin_dev` uses different credentials than the `.env.example` default (`robin:robin_dev`). This inconsistency could cause confusion, and having any credentials hardcoded in source means they ship to version control.
**Fix:** Remove the fallback and fail explicitly if `DATABASE_URL` is not set:
```typescript
dbCredentials: {
  url: process.env.DATABASE_URL!,
},
```
Or at minimum, align the fallback with `.env.example`:
```typescript
url: process.env.DATABASE_URL ?? 'postgresql://robin:robin_dev@localhost:5432/robin_dev',
```

## Info

### IN-01: Gateway facade search returns empty array typed as SearchResult[]

**File:** `robin/src/gateway/client.ts:32`
**Issue:** The `as SearchResult[]` cast on the empty array is technically unnecessary since the empty array is compatible with any array type. Minor style point -- not a bug.
**Fix:** Can simplify to `return { results: [], count: 0 }` and let TypeScript infer, or add an explicit return type annotation to the `search` method for clarity.

### IN-02: .env.example contains placeholder secrets that could be mistaken for real values

**File:** `robin/.env.example:12,22,26`
**Issue:** Placeholder values like `change-me-32-chars-minimum-padding` and `change-me-same-value-on-both-server-and-gateway` are descriptive (good), but some developers may copy `.env.example` to `.env` and forget to change them. The format is fine for a template file -- just noting for awareness.
**Fix:** No action required. Consider adding a startup validation check that rejects known placeholder values in production (`NODE_ENV=production`).

---

_Reviewed: 2026-04-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
