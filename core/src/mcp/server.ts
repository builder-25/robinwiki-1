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
import { listWikis, getThread, getFragment, findPersonById, findPersonByQuery } from './resolvers.js'
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
  }

  /***********************************************************************
   * ## Tools — Write operations
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

  /***********************************************************************
   * ## Resources
   ***********************************************************************/

  server.registerResource(
    'list_threads',
    'robin://wikis',
    {
      description: 'All wikis with fragment counts and wiki previews',
    },
    async () => {
      try {
        const data = await listWikis(resolverDeps)
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
   ***********************************************************************/

  server.registerTool(
    'get_thread',
    {
      description: 'Get thread details by slug including full wiki body and fragment snippets',
      inputSchema: {
        slug: z.string().describe('Thread slug or partial slug for fuzzy matching'),
      },
    },
    async ({ slug }) => {
      try {
        const result = await getThread(resolverDeps, slug)
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
    async ({ slug }) => {
      try {
        const result = await getFragment(resolverDeps, slug)
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
    'find_person',
    {
      description:
        'Find a person by ID or name. ' +
        'If the input matches the pattern person{ULID} (e.g. "person01ABC..."), it routes to an exact ID lookup. ' +
        'Otherwise it performs fuzzy search across slug, name, and aliases. ' +
        'Pass id for guaranteed exact lookup; pass query for name-based search.',
      inputSchema: {
        id: z.string().optional().describe(
          'Exact person lookupKey (e.g. "person01ABCDEFGHIJKLMNOPQRS"). Use for precise lookup when you have the ID.'
        ),
        query: z.string().optional().describe(
          'Person name, slug, or alias to search for. Fuzzy-matched across all three fields.'
        ),
      },
    },
    async ({ id, query }) => {
      try {
        // Auto-detect: if input looks like a lookupKey, route to id lookup
        const input = id ?? query ?? ''
        const isLookupKey = /^person[0-9A-Z]{26}$/i.test(input)

        if (isLookupKey) {
          const result = await findPersonById(resolverDeps, input)
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
        }

        if (query) {
          const result = await findPersonByQuery(resolverDeps, query)
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Provide id or query' }) }],
          isError: true as const,
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
          isError: true as const,
        }
      }
    }
  )

  return server
}
