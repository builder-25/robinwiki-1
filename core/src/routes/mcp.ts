/***********************************************************************
 * @module routes/mcp
 *
 * @summary MCP HTTP bridge — routes MCP JSON-RPC over Streamable HTTP.
 *
 * @remarks
 * Each request creates a fresh stateless transport + MCP server,
 * authenticates via JWT query param, and delegates to the transport.
 * The transport uses Web Standard Request/Response (works with Hono).
 ***********************************************************************/

import { Hono } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { verifyMcpToken } from '../mcp/jwt.js'
import { createMcpServer } from '../mcp/server.js'
import type { McpServerDeps } from '../mcp/server.js'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import { producer } from '../queue/producer.js'

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

mcp.all('/', async (c) => {
  const userId = c.get('userId')

  const deps: McpServerDeps = {
    db,
    producer,
    spawnWriteWorker: () => {},
    resolveDefaultVaultId: async () => null,
    entityExtractCall: async () => ({ people: [] }),
    loadUserPeople: async () => [],
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  const server = createMcpServer(deps)
  await server.connect(transport)

  try {
    const response = await transport.handleRequest(c.req.raw, {
      authInfo: { clientId: userId, token: '', scopes: [] },
    })
    return response
  } finally {
    await transport.close()
    await server.close()
  }
})

export { mcp }
