import { and, eq } from 'drizzle-orm'
import { NoOpenRouterKeyError, type OpenRouterConfig } from '@robin/agent'
import { DEFAULT_MODEL } from '@robin/shared'
import { db as defaultDb, type DB } from '../db/client.js'
import { configs, users } from '../db/schema.js'
import { decryptWithDek, loadMasterKey, unwrapDek } from './crypto.js'

const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small'

/**
 * Loads the OpenRouter API key from the configs table at the start of every
 * ingest run. Single-user app: pulls the lone user's wrapped DEK to decrypt
 * the stored value when `encrypted=true`. Throws NoOpenRouterKeyError when
 * the key is missing — BullMQ then marks the job failed and applies backoff.
 */
export async function loadOpenRouterConfigFromDb(database: DB = defaultDb): Promise<OpenRouterConfig> {
  const rows = await database
    .select()
    .from(configs)
    .where(and(eq(configs.kind, 'llm_key'), eq(configs.key, 'openrouter')))
    .limit(1)

  const row = rows[0]
  if (!row) throw new NoOpenRouterKeyError()

  const rawValue = typeof row.value === 'string' ? row.value : (row.value as { value?: string })?.value
  if (!rawValue || typeof rawValue !== 'string') throw new NoOpenRouterKeyError()

  let apiKey: string
  if (row.encrypted) {
    const [user] = await database.select({ encryptedDek: users.encryptedDek }).from(users).limit(1)
    if (!user?.encryptedDek) throw new NoOpenRouterKeyError()
    const masterKey = loadMasterKey()
    const dek = unwrapDek(user.encryptedDek, masterKey)
    apiKey = decryptWithDek(rawValue, dek)
  } else {
    apiKey = rawValue
  }

  if (!apiKey) throw new NoOpenRouterKeyError()

  return {
    apiKey,
    chatModel: DEFAULT_MODEL,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
  }
}
