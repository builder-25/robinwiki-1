import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { configs, users } from '../db/schema.js'
import { decryptWithDek, encryptWithDek, loadMasterKey, unwrapDek } from './crypto.js'

/**
 * Normalized config store for system and user-scoped values.
 *
 * Read precedence:
 *   1. If a matching (scope, userId, kind, key) row exists in `configs`,
 *      return its value (decrypting with the user's DEK if `encrypted=true`).
 *   2. If the user has not completed onboarding AND an ENV fallback is
 *      declared for (kind, key), return the ENV value.
 *   3. Otherwise return `null`.
 *
 * System-scope values ignore the onboarding gate; ENV fallbacks apply as long
 * as no row exists.
 */

type Scope = 'system' | 'user'

/** Registered env-var fallbacks by (kind, key) tuple. */
const ENV_FALLBACKS: Record<string, string | undefined> = {
  // LLM API keys
  'llm_key:openrouter': process.env.OPENROUTER_API_KEY,
  // Preferred chat model for a given pipeline stage
  'model_preference:default': process.env.DEFAULT_MODEL,
  'model_preference:extraction': process.env.EXTRACTION_MODEL,
  'model_preference:wiki_classify': process.env.WIKI_CLASSIFY_MODEL,
  'model_preference:wiki_generation': process.env.WIKI_GENERATION_MODEL,
  'model_preference:embedding': process.env.EMBEDDING_MODEL,
}

function envKey(kind: string, key: string): string {
  return `${kind}:${key}`
}

async function getUserOnboardingComplete(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ onboardingComplete: users.onboardingComplete })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.onboardingComplete ?? false
}

async function getUserDek(userId: string): Promise<Buffer | null> {
  const [row] = await db
    .select({ encryptedDek: users.encryptedDek })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!row || !row.encryptedDek) return null
  const masterKey = loadMasterKey()
  return unwrapDek(row.encryptedDek, masterKey)
}

export interface GetConfigOptions {
  scope: Scope
  userId?: string | null
  kind: string
  key: string
}

/**
 * Read a config value. Returns the plaintext string (decrypted if encrypted)
 * or the raw JSON value for non-encrypted rows. Falls back to env vars for
 * user-scoped reads when the user has not completed onboarding.
 */
export async function getConfig(opts: GetConfigOptions): Promise<unknown | null> {
  const { scope, userId, kind, key } = opts

  if (scope === 'user' && !userId) {
    throw new Error('user-scope config lookups require userId')
  }

  const rows = await db
    .select()
    .from(configs)
    .where(and(eq(configs.scope, scope), eq(configs.kind, kind), eq(configs.key, key)))
    .limit(1)

  const row = rows[0]

  if (row) {
    if (row.encrypted) {
      if (scope !== 'user' || !userId) {
        throw new Error('encrypted configs must be user-scoped')
      }
      const dek = await getUserDek(userId)
      if (!dek) throw new Error('user has no DEK — cannot decrypt config')
      return decryptWithDek(row.value as string, dek)
    }
    return row.value
  }

  // ── Fallback to env vars when onboarding is incomplete ──
  if (scope === 'user' && userId) {
    const onboarded = await getUserOnboardingComplete(userId)
    if (!onboarded) {
      return ENV_FALLBACKS[envKey(kind, key)] ?? null
    }
  } else if (scope === 'system') {
    return ENV_FALLBACKS[envKey(kind, key)] ?? null
  }

  return null
}

export interface SetConfigOptions {
  scope: Scope
  userId?: string | null
  kind: string
  key: string
  value: unknown
  encrypted?: boolean
}

/**
 * Write or update a config row. Encrypts the value with the user's DEK when
 * `encrypted=true` (user-scope only).
 */
export async function setConfig(opts: SetConfigOptions): Promise<void> {
  const { scope, userId, kind, key, value, encrypted = false } = opts

  if (scope === 'user' && !userId) {
    throw new Error('user-scope config writes require userId')
  }
  if (encrypted && (scope !== 'user' || !userId)) {
    throw new Error('encrypted configs must be user-scoped')
  }

  let storedValue: unknown = value
  if (encrypted) {
    if (typeof value !== 'string') {
      throw new Error('encrypted config values must be strings')
    }
    const dek = await getUserDek(userId as string)
    if (!dek) throw new Error('user has no DEK — cannot encrypt config')
    storedValue = encryptWithDek(value, dek)
  }

  await db
    .insert(configs)
    .values({
      scope,
      kind,
      key,
      value: storedValue,
      encrypted,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [configs.scope, configs.kind, configs.key],
      set: {
        value: storedValue,
        encrypted,
        updatedAt: new Date(),
      },
    })
}
