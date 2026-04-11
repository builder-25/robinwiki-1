/***********************************************************************
 * @module routes/mcp
 *
 * @summary MCP HTTP bridge.
 *
 * @remarks
 * M2 disables the MCP tool surface — no log_entry/log_fragment/search tools
 * during the ingest pipeline rebuild. The endpoint stays mounted so clients
 * receive a structured 503 instead of a connection error, and so the JWT
 * auth path keeps marking onboardedAt on first connect.
 ***********************************************************************/

import { Hono } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import { verifyMcpToken } from '../mcp/jwt.js'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'mcp' })

const mcp = new Hono()

mcp.use('*', async (c, next) => {
  const token = new URL(c.req.url).searchParams.get('token')
  if (!token) return c.json({ error: 'Missing token' }, 401)
  try {
    const userId = await verifyMcpToken(token)
    c.set('userId', userId)
    db.update(users)
      .set({ onboardedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.onboardedAt)))
      .execute()
      .catch((err) => {
        log.debug({ err }, 'failed to set onboardedAt')
      })
    await next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
})

mcp.all('/', (c) =>
  c.json({ error: 'MCP tools are disabled during M2 ingest pipeline rebuild' }, 503)
)

export { mcp }
