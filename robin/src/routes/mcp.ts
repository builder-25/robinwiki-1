/***********************************************************************
 * @module routes/mcp
 *
 * @summary Hono route that bridges HTTP to the MCP server. Handles
 * JWT auth via `?token=` and wires {@link McpServerDeps} from
 * concrete implementations.
 *
 * @remarks
 * Every request gets a fresh {@link createMcpServer} instance bound
 * to the authenticated user. The MCP SDK's streamable HTTP transport
 * handles the actual protocol framing.
 *
 * **Auth flow:** `?token=` → {@link verifyMcpToken} → `userId` →
 * set on Hono context → passed as `authInfo.clientId` to MCP tools.
 *
 * @see {@link verifyMcpToken} — JWT verification
 * @see {@link createMcpServer} — tool/resource registrations
 * @see {@link McpServerDeps} — dep interface satisfied here
 ***********************************************************************/

import { Hono } from 'hono'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { eq, and, isNull } from 'drizzle-orm'
import { verifyMcpToken } from '../mcp/jwt.js'
import { createMcpServer } from '../mcp/server.js'
import { producer } from '../queue/producer.js'
import { spawnWriteWorker } from '../queue/worker.js'
import { gatewayClient } from '../gateway/client.js'
import { db } from '../db/client.js'
import { users, vaults, people } from '../db/schema.js'
import { entityExtractCall } from '@robin/agent'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'mcp' })

/**
 * Resolve the user's default (inbox) vault ID.
 *
 * @param userId - Authenticated user ID
 * @returns Vault ID or `null` if no inbox vault exists
 *
 * @internal Passed as {@link McpServerDeps.resolveDefaultVaultId}
 */
async function resolveDefaultVaultId(userId: string): Promise<string | null> {
  const [vault] = await db
    .select({ id: vaults.id })
    .from(vaults)
    .where(and(eq(vaults.userId, userId), eq(vaults.type, 'inbox')))
    .limit(1)
  return vault?.id ?? null
}

const mcp = new Hono()

/**
 * @remarks Auth middleware — extracts and verifies JWT from `?token=`.
 * Also marks onboarding complete on first valid MCP connection
 * (fire-and-forget, non-blocking).
 */
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

/**
 * @remarks Main MCP endpoint — creates a fresh server per request,
 * wires all deps, connects transport, and delegates to SDK.
 */
mcp.all('/', async (c) => {
  const userId = c.get('userId') as string
  const transport = new WebStandardStreamableHTTPServerTransport()
  const server = createMcpServer({
    producer,
    gatewayClient,
    db,
    spawnWriteWorker,
    resolveDefaultVaultId,
    entityExtractCall,
    loadUserPeople: async (uid: string) => {
      const rows = await db
        .select({
          lookupKey: people.lookupKey,
          name: people.name,
          sections: people.sections,
        })
        .from(people)
        .where(eq(people.userId, uid))
      return rows.map((r) => ({
        lookupKey: r.lookupKey,
        canonicalName: r.name,
        aliases: ((r.sections as any)?.aliases as string[]) ?? [],
      }))
    },
  })
  await server.connect(transport)
  return transport.handleRequest(c.req.raw, {
    authInfo: { token: '', clientId: userId, scopes: [] },
  })
})

export { mcp }
