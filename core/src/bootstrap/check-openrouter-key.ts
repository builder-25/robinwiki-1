import { and, eq } from 'drizzle-orm'
import { NoOpenRouterKeyError, probeEmbeddingReachable } from '@robin/agent'
import { db } from '../db/client.js'
import { configs } from '../db/schema.js'
import { loadOpenRouterConfig } from '../lib/openrouter-config.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'bootstrap' })

/**
 * Boot-time check for the OpenRouter API key. Does not throw — the server
 * can still serve non-ingest traffic without it. Logs an actionable warning
 * when the key is missing so the operator knows to run the seed script.
 */
export async function checkOpenRouterKey(): Promise<void> {
  const rows = await db
    .select({ id: configs.id })
    .from(configs)
    .where(and(eq(configs.kind, 'llm_key'), eq(configs.key, 'openrouter')))
    .limit(1)

  if (rows.length === 0) {
    log.warn(
      'No OpenRouter API key found in configs. ' +
        'Ingest jobs will fail with "no_openrouter_key" until seeded. ' +
        'Run: OPENROUTER_API_KEY=sk-or-v1-... pnpm seed-openrouter-key'
    )
    return
  }

  log.info('openrouter key present in configs')
}

/**
 * Boot-time embedding reachability probe. Issues a 1-token embedding call
 * against the configured OpenRouter model and returns a tri-state result
 * so the caller can gate worker startup.
 *
 * - `ok`: probe returned a vector. Safe to start ingest workers.
 * - `no-key`: OPENROUTER_API_KEY env var is unset. First-boot path —
 *   treat as non-fatal so the user can finish onboarding, but expect
 *   per-job `no_openrouter_key` failures in the worker.
 * - `unreachable`: key is present, but the request failed (invalid key,
 *   blocked region, OpenRouter outage, response schema drift). This is
 *   the silent-unembedded-DB scenario — workers should NOT start; we
 *   don't want to quietly fill the DB with rows whose embedding column
 *   will never populate. Operator needs to fix the key / allowlist.
 */
export async function probeEmbeddingsOrRefuseWorkers(): Promise<
  | { status: 'ok' }
  | { status: 'no-key' }
  | { status: 'unreachable'; detail: string }
> {
  let config: Awaited<ReturnType<typeof loadOpenRouterConfig>> | undefined
  try {
    config = await loadOpenRouterConfig()
  } catch (err) {
    if (err instanceof NoOpenRouterKeyError) return { status: 'no-key' }
    throw err
  }

  const result = await probeEmbeddingReachable({
    apiKey: config.apiKey,
    model: config.models.embedding,
  })
  if (result.ok === true) return { status: 'ok' }

  const failure = result.failure
  const detail =
    failure.kind === 'http'
      ? `HTTP ${failure.status}: ${failure.body.slice(0, 200)}`
      : failure.kind === 'malformed'
        ? `malformed response: ${failure.body.slice(0, 200)}`
        : `request threw: ${failure.message}`
  return { status: 'unreachable', detail }
}
