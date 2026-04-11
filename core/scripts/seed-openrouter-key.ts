#!/usr/bin/env tsx
/**
 * Seed the OpenRouter API key into the configs table.
 *
 * Idempotent — running twice updates the existing row.
 * Reads the key from OPENROUTER_API_KEY env var. Exits 1 if unset.
 * Encrypts the value using the first user's DEK (M1 crypto envelope).
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-or-v1-... pnpm seed-openrouter-key
 */

import 'dotenv/config'
import { db } from '../src/db/client.js'
import { users } from '../src/db/schema.js'
import { setConfig } from '../src/lib/config.js'
import { loadMasterKey } from '../src/lib/crypto.js'
import { logger } from '../src/lib/logger.js'

const log = logger.child({ component: 'seed-openrouter-key' })

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    log.fatal('OPENROUTER_API_KEY env var is not set — aborting')
    process.exit(1)
  }

  // Trip the master key check early so a misconfigured env fails obviously
  loadMasterKey()

  // Single-user world — find the first (and only) user
  const [user] = await db.select({ id: users.id }).from(users).limit(1)
  if (!user) {
    log.fatal('no user in database — run the server once with INITIAL_USERNAME/INITIAL_PASSWORD to seed the first user')
    process.exit(1)
  }

  await setConfig({
    scope: 'user',
    userId: user.id,
    kind: 'llm_key',
    key: 'openrouter',
    value: apiKey,
    encrypted: true,
  })

  log.info({ userId: user.id }, 'openrouter key seeded into configs')
  process.exit(0)
}

main().catch((err) => {
  log.fatal({ err }, 'seed-openrouter-key failed')
  process.exit(1)
})
