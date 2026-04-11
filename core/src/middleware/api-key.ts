import type { MiddlewareHandler } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { apiKeys, users } from '../db/schema.js'
import { hashApiKey } from '../keypair.js'

// API key auth for MCP endpoint. Single-user: any valid api key resolves to
// the lone user row; we still set `userId` on context for downstream auth.
export const apiKeyMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const apiKey = authHeader.slice(7).trim()
  if (!apiKey) return c.json({ error: 'Unauthorized' }, 401)

  const keyHash = hashApiKey(apiKey)
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash))

  if (!row) return c.json({ error: 'Invalid API key' }, 401)

  const [user] = await db.select({ id: users.id }).from(users).limit(1)
  if (!user) return c.json({ error: 'No user' }, 401)

  c.set('userId', user.id)
  await next()
}
