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
import { eq } from 'drizzle-orm'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listWikis, getThread, getFragment, findPersonById, findPersonByQuery, listWikiTypes } from './resolvers.js'
import type { McpResolverDeps } from './resolvers.js'
import { handleLogEntry, handleLogFragment, handleCreateWikiType, handleCreateWiki, handleEditWiki } from './handlers.js'
import type { McpServerDeps } from './handlers.js'
import { wikis } from '../db/schema.js'
import { nanoid24 } from '../lib/id.js'

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

  server.registerTool(
    'create_wiki',
    {
      description:
        'Create a new wiki in the knowledge base. Robin infers the wiki type from the description.',
      inputSchema: {
        title: z.string().describe('Wiki title (becomes the slug)'),
        description: z
          .string()
          .optional()
          .describe('What this wiki is for — used to infer the wiki type'),
      },
    },
    async ({ title, description }, extra) => {
      return handleCreateWiki(deps, { title, description }, extra.authInfo?.clientId as string)
    }
  )

  server.registerTool(
    'edit_wiki',
    {
      description:
        'Write content to a wiki. The full content is stored as an edit record and will be ' +
        'incorporated during the next regeneration cycle. Use list_wikis to get valid slugs.',
      inputSchema: {
        wikiSlug: z.string().describe('Exact wiki slug (from list_wikis)'),
        content: z
          .string()
          .describe('The content to add or replace. Full text is preserved for regen context.'),
      },
    },
    async ({ wikiSlug, content }, extra) => {
      return handleEditWiki(deps, { wikiSlug, content }, extra.authInfo?.clientId as string)
    }
  )

  /***********************************************************************
   * ## Wiki listing
   ***********************************************************************/

  server.registerTool(
    'list_wikis',
    {
      description: 'List all wikis with fragment counts, previews, and type descriptors',
      inputSchema: {
        includeDescriptors: z.boolean().optional().describe(
          'Include type descriptors in the response (default: true). Set false for compact output.'
        ),
      },
    },
    async ({ includeDescriptors }) => {
      try {
        const data = await listWikis(resolverDeps, { includeDescriptors })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data) }],
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

  /***********************************************************************
   * ## Wiki type tools
   ***********************************************************************/

  server.registerTool(
    'get_wiki_types',
    {
      description:
        'List all available wiki types with their descriptors. ' +
        'Use this to understand what types are available before classifying or creating wikis.',
      inputSchema: {},
    },
    async () => {
      try {
        const data = await listWikiTypes(resolverDeps)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data) }],
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

  server.registerTool(
    'create_wiki_type',
    {
      description:
        'Create a custom wiki type. Use this intentionally — only when the existing types ' +
        'do not fit the content. Requires a unique slug, a display name, a short descriptor ' +
        '(3-5 words), and a full descriptor sentence.',
      inputSchema: {
        slug: z.string().describe('Unique slug: lowercase alphanumeric + hyphens only'),
        name: z.string().describe('Display name (e.g. "Research Notes")'),
        shortDescriptor: z.string().describe('3-5 word label for pills/badges'),
        descriptor: z.string().describe('One sentence describing what this wiki type contains'),
        prompt: z.string().optional().describe('Optional: custom Quill generation instruction'),
      },
    },
    async ({ slug, name, shortDescriptor, descriptor, prompt }) => {
      return handleCreateWikiType(deps, { slug, name, shortDescriptor, descriptor, prompt })
    }
  )

  /***********************************************************************
   * ## Publish tools
   ***********************************************************************/

  server.registerTool(
    'publish_wiki',
    {
      description:
        'Publish a wiki with a stable public URL. Generates a nanoid slug on first publish. ' +
        'Wiki must have content before publishing.',
      inputSchema: {
        wikiKey: z.string().describe('Wiki lookupKey or slug'),
      },
    },
    async ({ wikiKey }) => {
      try {
        const [wiki] = await deps.db
          .select()
          .from(wikis)
          .where(eq(wikis.lookupKey, wikiKey))

        if (!wiki) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Wiki not found' }) }],
            isError: true as const,
          }
        }

        if (!wiki.content) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Cannot publish a wiki with no content' }) }],
            isError: true as const,
          }
        }

        const slug = wiki.publishedSlug ?? nanoid24()
        const [updated] = await deps.db
          .update(wikis)
          .set({
            published: true,
            publishedSlug: slug,
            publishedAt: wiki.publishedAt ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(wikis.lookupKey, wikiKey))
          .returning()

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              published: updated.published,
              publishedSlug: updated.publishedSlug,
              publishedAt: updated.publishedAt,
            }),
          }],
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

  server.registerTool(
    'unpublish_wiki',
    {
      description:
        'Unpublish a wiki. The slug is preserved so re-publishing restores the same URL.',
      inputSchema: {
        wikiKey: z.string().describe('Wiki lookupKey or slug'),
      },
    },
    async ({ wikiKey }) => {
      try {
        const [wiki] = await deps.db
          .select()
          .from(wikis)
          .where(eq(wikis.lookupKey, wikiKey))

        if (!wiki) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Wiki not found' }) }],
            isError: true as const,
          }
        }

        const [updated] = await deps.db
          .update(wikis)
          .set({ published: false, updatedAt: new Date() })
          .where(eq(wikis.lookupKey, wikiKey))
          .returning()

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              published: updated.published,
              publishedSlug: updated.publishedSlug,
              publishedAt: updated.publishedAt,
            }),
          }],
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
