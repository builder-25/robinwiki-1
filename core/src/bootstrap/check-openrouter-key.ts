import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { configs } from '../db/schema.js'
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
