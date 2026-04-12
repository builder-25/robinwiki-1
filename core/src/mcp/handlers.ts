/**
 * @module mcp/handlers
 *
 * @summary MCP write handlers — business logic behind `log_entry` and
 * `log_fragment` tools. Extracted from `server.ts` so tool registration
 * stays thin and declarative.
 *
 * @remarks
 * Both handlers return MCP-shaped responses (`{ content, isError }`)
 * so they plug directly into tool registrations with no transformation.
 *
 * **Two paths, one contract:**
 * - {@link handleLogEntry} feeds the full 6-stage AI pipeline via BullMQ.
 *   The entry row must exist before enqueue because the worker reads it.
 * - {@link handleLogFragment} is the fast path — bypasses the pipeline and
 *   writes a fragment directly to a known thread. Useful when the caller
 *   already knows the destination (e.g. after `list_threads`).
 *
 * **Fail-open semantics:**
 * - Entity extraction errors → fragment persisted without people edges.
 * - Thread marked DIRTY after insert → wiki regen picks it up next cycle.
 *
 * @see {@link handleLogEntry} — pipeline entry point
 * @see {@link handleLogFragment} — direct-to-thread fast path
 * @see {@link McpServerDeps} — dependency injection interface
 */

import {
  makeLookupKey,
  parseLookupKey,
  generateSlug,
  loadPeopleExtractionSpec,
} from '@robin/shared'
import type { PeopleExtractionOutput } from '@robin/shared'
import type { BullMQProducer, ExtractionJob } from '@robin/queue'
import { resolveEntrySlug } from '../db/slug.js'
import { computeContentHash, findDuplicateEntry } from '../db/dedup.js'
import type { DB } from '../db/client.js'
import {
  entries as entriesTable,
  fragments as fragmentsTable,
  wikis as threadsTable,
  edges as edgesTable,
  people as peopleTable,
} from '../db/schema.js'
import { resolveThreadBySlug } from './resolvers.js'
import type { McpResolverDeps } from './resolvers.js'
import { resolvePerson, DEFAULT_RESOLUTION_CONFIG } from '@robin/agent'
import type { KnownPerson } from '@robin/agent'
import { eq } from 'drizzle-orm'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'mcp' })

/**
 * Dependency injection interface shared by both handlers and
 * {@link createMcpServer}. Wired in `routes/mcp.ts` at request time.
 *
 * @remarks
 * Deliberately broader than {@link McpResolverDeps} — handlers need
 * write access (producer) plus LLM calls for entity extraction, while
 * resolvers only need reads.
 *
 * @property producer              - BullMQ producer for enqueuing pipeline jobs
 * @property db                    - Drizzle database instance
 * @property spawnWriteWorker      - Ensures a write worker exists for the user
 * @property resolveDefaultVaultId - Returns the user's inbox vault ID
 * @property entityExtractCall     - LLM call for people extraction (fail-open)
 * @property loadUserPeople        - Loads known people for fuzzy name matching
 */
export interface McpServerDeps {
  producer: BullMQProducer
  db: DB
  spawnWriteWorker: (userId: string) => void
  resolveDefaultVaultId: (userId: string) => Promise<string | null>
  entityExtractCall: (system: string, user: string) => Promise<PeopleExtractionOutput>
  loadUserPeople: (userId: string) => Promise<KnownPerson[]>
}

/**
 * Handle the `log_entry` MCP tool call.
 *
 * @summary Captures a raw thought and feeds it into the full AI
 * ingestion pipeline (6 stages via BullMQ).
 *
 * @param deps   - Injected dependencies (db, producer, etc.)
 * @param input  - The raw content and optional source tag
 * @param userId - Authenticated user ID (`undefined` = not authenticated)
 * @returns MCP-shaped response with entry key or error
 *
 * @throws Never — all errors are caught and returned as `{ isError: true }`
 */
export async function handleLogEntry(
  deps: McpServerDeps,
  input: { content: string; source?: 'mcp' | 'api' | 'web' },
  userId: string | undefined
) {
  if (!userId) {
    return {
      content: [{ type: 'text' as const, text: 'Error: not authenticated' }],
      isError: true as const,
    }
  }

  const trimmed = input.content?.trim()
  if (!trimmed) {
    return {
      content: [{ type: 'text' as const, text: 'Error: content is required' }],
      isError: true as const,
    }
  }

  try {
    const hash = computeContentHash(trimmed)
    const dup = await findDuplicateEntry(deps.db, hash)
    if (dup) {
      return {
        content: [{ type: 'text' as const, text: `Duplicate: entry ${dup.lookupKey} already contains this content` }],
      }
    }

    const entryKey = makeLookupKey('entry')
    const { ulid: entryUlid } = parseLookupKey(entryKey)
    const defaultVaultId = await deps.resolveDefaultVaultId(userId)
    const title = trimmed.slice(0, 80)
    const slug = await resolveEntrySlug(deps.db, generateSlug(title))
    const entrySource = input.source ?? 'mcp'
    const now = new Date()

    await deps.db.insert(entriesTable).values({
      lookupKey: entryKey,
      slug,
      vaultId: defaultVaultId,
      title,
      content: trimmed,
      dedupHash: hash,
      type: 'thought',
      source: entrySource,
    })

    const job: ExtractionJob = {
      type: 'extraction',
      jobId: entryUlid,
      enqueuedAt: now.toISOString(),
      content: trimmed,
      entryKey,
      vaultId: defaultVaultId,
      source: entrySource,
    }
    await deps.producer.enqueueExtraction(job)

    deps.spawnWriteWorker(userId)

    return {
      content: [{ type: 'text' as const, text: `Entry queued: ${entryKey}` }],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ err, userId }, 'mcp log_entry failed')
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true as const,
    }
  }
}

/**
 * Handle the `log_fragment` MCP tool call.
 *
 * @summary Persist a fragment directly to a known thread, bypassing
 * the full AI ingestion pipeline.
 *
 * @param deps   - Injected dependencies (db, LLM calls, etc.)
 * @param input  - Fragment content, target thread slug, optional title/tags
 * @param userId - Authenticated user ID (`undefined` = not authenticated)
 * @returns MCP-shaped response with fragment/thread keys or error
 *
 * @throws Never — all errors caught and returned as `{ isError: true }`
 */
export async function handleLogFragment(
  deps: McpServerDeps,
  input: {
    content: string
    threadSlug: string
    title?: string
    tags?: string[]
  },
  userId: string | undefined
) {
  if (!userId) {
    return {
      content: [{ type: 'text' as const, text: 'Error: not authenticated' }],
      isError: true as const,
    }
  }

  const trimmed = input.content?.trim()
  if (!trimmed) {
    return {
      content: [{ type: 'text' as const, text: 'Error: content is required' }],
      isError: true as const,
    }
  }

  if (!input.threadSlug?.trim()) {
    return {
      content: [{ type: 'text' as const, text: 'Error: threadSlug is required' }],
      isError: true as const,
    }
  }

  try {
    const resolverDeps: McpResolverDeps = {
      db: deps.db,
    }

    const threadResult = await resolveThreadBySlug(resolverDeps, input.threadSlug.trim())

    if ('error' in threadResult) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(threadResult) }],
        isError: true as const,
      }
    }

    // Entity extraction (fail-open)
    let personKeys: string[] = []
    let newPeople: Array<{ personKey: string; canonicalName: string }> = []
    try {
      const knownPeople = await deps.loadUserPeople(userId)
      const knownPeopleJson =
        knownPeople.length > 0
          ? JSON.stringify(
              knownPeople.map((p) => ({
                key: p.lookupKey,
                canonicalName: p.canonicalName,
                aliases: p.aliases,
              }))
            )
          : undefined

      const spec = loadPeopleExtractionSpec({
        content: trimmed,
        knownPeople: knownPeopleJson,
      })
      const parsed = await deps.entityExtractCall(spec.system, spec.user)

      const makePeopleKey = () => makeLookupKey('person')
      for (const extraction of parsed.people) {
        const resolved = resolvePerson(
          extraction,
          knownPeople,
          DEFAULT_RESOLUTION_CONFIG,
          makePeopleKey
        )
        personKeys.push(resolved.personKey)
        if (resolved.isNew) {
          newPeople.push({
            personKey: resolved.personKey,
            canonicalName: extraction.inferredName,
          })
        }
      }
    } catch (err) {
      log.warn({ err, userId }, 'log_fragment entity extraction failed (continuing)')
    }

    // Generate fragment identifiers
    const fragKey = makeLookupKey('frag')
    const { ulid: fragUlid } = parseLookupKey(fragKey)
    const title = input.title?.trim() || trimmed.slice(0, 80)
    const fragSlug = `${generateSlug(title)}-${fragUlid.slice(0, 6).toLowerCase()}`
    const now = new Date()

    // Insert fragment row
    await deps.db.insert(fragmentsTable).values({
      lookupKey: fragKey,
      slug: fragSlug,
      title,
      type: 'observation',
      tags: input.tags ?? [],
      entryId: null,
      state: 'RESOLVED',
      content: trimmed,
    })

    // Insert FRAGMENT_IN_WIKI edge
    await deps.db
      .insert(edgesTable)
      .values({
        id: crypto.randomUUID(),
        srcType: 'fragment',
        srcId: fragKey,
        dstType: 'wiki',
        dstId: threadResult.lookupKey,
        edgeType: 'FRAGMENT_IN_WIKI',
      })
      .onConflictDoNothing()

    // Insert FRAGMENT_MENTIONS_PERSON edges (one per person)
    for (const personKey of personKeys) {
      await deps.db
        .insert(edgesTable)
        .values({
          id: crypto.randomUUID(),
          srcType: 'fragment',
          srcId: fragKey,
          dstType: 'person',
          dstId: personKey,
          edgeType: 'FRAGMENT_MENTIONS_PERSON',
        })
        .onConflictDoNothing()
    }

    // Insert new people rows (for people not yet in DB)
    for (const person of newPeople) {
      await deps.db
        .insert(peopleTable)
        .values({
          lookupKey: person.personKey,
          slug: generateSlug(person.canonicalName),
          name: person.canonicalName,
          canonicalName: person.canonicalName,
          state: 'RESOLVED',
          aliases: [],
          verified: false,
        })
        .onConflictDoNothing()
    }

    // Mark thread for wiki regen (PENDING signals regen needed)
    await deps.db
      .update(threadsTable)
      .set({ state: 'PENDING', updatedAt: now })
      .where(eq(threadsTable.lookupKey, threadResult.lookupKey))

    const result = {
      fragmentKey: fragKey,
      fragmentSlug: fragSlug,
      threadSlug: threadResult.slug,
      wikiKey: threadResult.lookupKey,
    }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ err, userId }, 'mcp log_fragment failed')
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true as const,
    }
  }
}
