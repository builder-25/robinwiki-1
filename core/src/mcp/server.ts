/***********************************************************************
 * @module mcp/server
 *
 * @summary MCP tool and resource registrations — thin declarative layer
 * that delegates all business logic to {@link module:mcp/handlers | handlers}
 * and {@link module:mcp/resolvers | resolvers}.
 *
 * @remarks
 * This file is intentionally kept minimal. Each `registerTool` /
 * `registerResource` call destructures inputs, passes them to the
 * appropriate handler or resolver, and wraps errors into MCP-shaped
 * responses. No business logic lives here.
 *
 * @see {@link createMcpServer} — factory function (the only export)
 * @see {@link McpServerDeps} — dependency injection interface (re-exported from handlers)
 * @see {@link module:mcp/handlers | handlers.ts} — write operations
 * @see {@link module:mcp/resolvers | resolvers.ts} — read operations
 ***********************************************************************/

import { z } from 'zod/v4'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listThreads, getThread, getFragment, getPerson } from './resolvers.js'
import type { McpResolverDeps } from './resolvers.js'
import { handleLogEntry, handleLogFragment } from './handlers.js'
import type { McpServerDeps } from './handlers.js'

export type { McpServerDeps }

/**
 * Create and configure the Robin MCP server with all tools and resources.
 *
 * @remarks
 * Called per-request in `routes/mcp.ts`. Each invocation gets a fresh
 * server instance bound to the authenticated user's context.
 *
 * @param deps - Injected dependencies wired from the route handler
 * @returns Configured {@link McpServer} ready for `server.connect(transport)`
 */
export function createMcpServer(deps: McpServerDeps): McpServer {
  const server = new McpServer({
    name: 'robin-mcp',
    version: '1.0.0',
  })

  const resolverDeps: McpResolverDeps = {
    db: deps.db,
    gatewayClient: deps.gatewayClient,
  }

  /***********************************************************************
   * ## Tools — Write operations
   *
   * @remarks Mutating tools that create entries, fragments, or search.
   * Business logic in {@link handleLogEntry} and {@link handleLogFragment}.
   ***********************************************************************/

  server.registerTool(
    'log_entry',
    {
      description: 'Log a new entry to your Robin second-brain',
      inputSchema: {
        content: z.string().describe('The text content to log'),
        source: z.enum(['mcp', 'api', 'web']).optional().describe('Origin of the entry'),
      },
    },
    async ({ content, source }, extra) => {
      return handleLogEntry(deps, { content, source }, extra.authInfo?.clientId as string)
    }
  )

  server.registerTool(
    'log_fragment',
    {
      description:
        'Persist a fragment directly to a known thread, bypassing the AI ingestion pipeline. ' +
        'Use when you already know which thread the content belongs to. ' +
        'Get thread slugs from list_threads or get_thread first.',
      inputSchema: {
        content: z.string().describe('Fragment body content'),
        threadSlug: z
          .string()
          .describe('Exact thread slug to attach to (from list_threads or get_thread)'),
        title: z.string().optional().describe('Fragment title (derived from content if omitted)'),
        tags: z.array(z.string()).optional().describe('Optional tags'),
      },
    },
    async ({ content, threadSlug, title, tags }, extra) => {
      return handleLogFragment(
        deps,
        { content, threadSlug, title, tags },
        extra.authInfo?.clientId as string
      )
    }
  )

  server.registerTool(
    'search',
    {
      description: 'Search your Robin knowledge base',
      inputSchema: {
        query: z.string().describe('Search query'),
        limit: z.number().optional().describe('Max results to return (default 10)'),
      },
    },
    async ({ query, limit }, extra) => {
      const userId = extra.authInfo?.clientId as string
      try {
        const results = await deps.gatewayClient.search(userId, query, limit ?? 10)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(results) }],
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: message }),
            },
          ],
        }
      }
    }
  )

  /***********************************************************************
   * ## Resources
   *
   * @remarks Static MCP resources exposed via `robin://` URIs.
   * @see {@link listThreads} — resolver backing this resource
   ***********************************************************************/

  server.registerResource(
    'list_threads',
    'robin://wikis',
    {
      description: 'All wikis for the authenticated user with fragment counts and wiki previews',
    },
    async (_uri, extra) => {
      const userId = extra.authInfo?.clientId as string
      try {
        const data = await listThreads(resolverDeps, userId)
        return {
          contents: [
            {
              uri: 'robin://wikis',
              mimeType: 'application/json',
              text: JSON.stringify(data),
            },
          ],
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          contents: [
            {
              uri: 'robin://wikis',
              mimeType: 'application/json',
              text: JSON.stringify({ error: message }),
            },
          ],
        }
      }
    }
  )

  /***********************************************************************
   * ## Read tools
   *
   * @remarks Non-mutating tools with fuzzy slug/name matching.
   * @see {@link getThread} — thread detail resolver
   * @see {@link getFragment} — fragment detail resolver
   * @see {@link getPerson} — person detail resolver
   ***********************************************************************/

  server.registerTool(
    'get_thread',
    {
      description: 'Get thread details by slug including full wiki body and fragment snippets',
      inputSchema: {
        slug: z.string().describe('Thread slug or partial slug for fuzzy matching'),
      },
    },
    async ({ slug }, extra) => {
      const userId = extra.authInfo?.clientId as string
      try {
        const result = await getThread(resolverDeps, userId, slug)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: message }),
            },
          ],
        }
      }
    }
  )

  server.registerTool(
    'get_fragment',
    {
      description: 'Get full fragment content by slug',
      inputSchema: {
        slug: z.string().describe('Fragment slug or partial slug'),
      },
    },
    async ({ slug }, extra) => {
      const userId = extra.authInfo?.clientId as string
      try {
        const result = await getFragment(resolverDeps, userId, slug)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: message }),
            },
          ],
        }
      }
    }
  )

  server.registerTool(
    'get_person',
    {
      description: 'Find a person by name with fuzzy matching on canonical name and aliases',
      inputSchema: {
        name: z.string().describe('Person name to search for'),
      },
    },
    async ({ name }, extra) => {
      const userId = extra.authInfo?.clientId as string
      try {
        const result = await getPerson(resolverDeps, userId, name)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: message }),
            },
          ],
        }
      }
    }
  )

  return server
}
