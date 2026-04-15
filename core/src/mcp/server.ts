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
import { eq, and, isNull, inArray, sql } from 'drizzle-orm'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listWikis, getThread, getFragment, findPersonById, findPersonByQuery, listWikiTypes, briefPerson, resolveThreadBySlug } from './resolvers.js'
import type { McpResolverDeps } from './resolvers.js'
import { handleLogEntry, handleLogFragment, handleCreateWikiType, handleCreateWiki, handleEditWiki } from './handlers.js'
import type { McpServerDeps } from './handlers.js'
import { wikis, edges, auditLog } from '../db/schema.js'
import { nanoid24 } from '../lib/id.js'
import { hybridSearch } from '../lib/search.js'
import { loadOpenRouterConfigFromDb } from '../lib/openrouter-config.js'
import { emitAuditEvent } from '../db/audit.js'

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

  server.registerTool(
    'brief_person',
    {
      description:
        'Get a formatted briefing on a person including their wiki appearances and fragment mentions. ' +
        'Returns a markdown summary. Instant response, no LLM call.',
      inputSchema: {
        query: z.string().describe('Person name, slug, or lookupKey'),
      },
    },
    async ({ query }) => {
      try {
        const result = await briefPerson(resolverDeps, query)
        return { content: [{ type: 'text' as const, text: result }] }
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
   * ## Search
   ***********************************************************************/

  server.registerTool(
    'search',
    {
      description:
        'Search the knowledge base across wikis, fragments, and people. ' +
        'Returns ranked results using hybrid BM25 + semantic search with RRF fusion. ' +
        'Use mode=bm25 for keyword search, mode=vector for semantic, mode=hybrid (default) for both.',
      inputSchema: {
        query: z.string().describe('Search query text'),
        tables: z.string().optional().describe('Comma-separated: fragments,wikis,people (default: all)'),
        mode: z.enum(['hybrid', 'bm25', 'vector']).optional().describe('Search mode (default: hybrid)'),
        limit: z.number().optional().describe('Max results (default: 10)'),
      },
    },
    async ({ query, tables, mode, limit }) => {
      try {
        const parsedTables = tables
          ? (tables.split(',').map((t) => t.trim()).filter(Boolean) as ('fragment' | 'wiki' | 'person')[])
          : undefined

        let embedConfig: { apiKey: string; model: string } | undefined
        if (mode !== 'bm25') {
          try {
            const orConfig = await loadOpenRouterConfigFromDb(deps.db)
            embedConfig = { apiKey: orConfig.apiKey, model: orConfig.embeddingModel }
          } catch {
            // No OpenRouter key — fall back to BM25-only
            if (mode === 'vector') {
              return {
                content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Vector search requires an OpenRouter API key' }) }],
                isError: true as const,
              }
            }
          }
        }

        const effectiveMode = (!embedConfig && mode !== 'bm25') ? 'bm25' : (mode ?? 'hybrid')

        const results = await hybridSearch(deps.db, query, {
          limit: limit ?? 10,
          tables: parsedTables,
          mode: effectiveMode,
          embedConfig,
        })

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(results) }],
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

        await emitAuditEvent(deps.db, {
          entityType: 'wiki',
          entityId: wikiKey,
          eventType: 'published',
          source: 'mcp',
          summary: `Wiki published: ${wiki.name}`,
          detail: { wikiKey, publishedSlug: slug },
        })

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

        await emitAuditEvent(deps.db, {
          entityType: 'wiki',
          entityId: wikiKey,
          eventType: 'unpublished',
          source: 'mcp',
          summary: `Wiki unpublished: ${wiki.name}`,
          detail: { wikiKey },
        })

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

  /***********************************************************************
   * ## Timeline
   ***********************************************************************/

  server.registerTool(
    'get_timeline',
    {
      description:
        'Get the audit timeline for a wiki — shows all events related to the wiki and its linked fragments, ' +
        'ordered newest first. Useful for understanding the history of a wiki.',
      inputSchema: {
        wikiSlug: z.string().describe('Wiki slug (fuzzy-matched)'),
        limit: z.number().optional().default(20).describe('Max events to return'),
      },
    },
    async ({ wikiSlug, limit }) => {
      try {
        const resolverDeps: McpResolverDeps = { db: deps.db }
        const resolved = await resolveThreadBySlug(resolverDeps, wikiSlug)
        if ('error' in resolved) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(resolved) }],
            isError: true as const,
          }
        }

        const wikiKey = resolved.lookupKey

        const fragmentEdges = await deps.db
          .select({ srcId: edges.srcId })
          .from(edges)
          .where(
            and(
              eq(edges.dstId, wikiKey),
              eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
              isNull(edges.deletedAt)
            )
          )

        const relatedIds = [wikiKey, ...fragmentEdges.map(e => e.srcId)]

        const events = await deps.db
          .select()
          .from(auditLog)
          .where(inArray(auditLog.entityId, relatedIds))
          .orderBy(sql`${auditLog.createdAt} DESC`)
          .limit(limit ?? 20)

        const formatted = events.map(e =>
          `[${e.createdAt.toISOString()}] ${e.entityType}.${e.eventType} — ${e.summary}`
        ).join('\n')

        return {
          content: [{
            type: 'text' as const,
            text: formatted || 'No timeline events found for this wiki.',
          }],
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true as const,
        }
      }
    }
  )

  return server
}
