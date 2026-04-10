import type { MiddlewareHandler } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { apiKeys } from '../db/schema.js'
import { hashApiKey } from '../keypair.js'

// API key auth for MCP endpoint
// Clients send: Authorization: Bearer <api-key>
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

  c.set('userId', row.userId)
  await next()
}
