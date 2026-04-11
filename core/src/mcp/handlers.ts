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
 * - Git gateway down → DB row created with empty `repoPath`; sync reconciles.
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
  composeFilename,
  loadPeopleExtractionSpec,
} from '@robin/shared'
import type { PeopleExtractionOutput } from '@robin/shared'
import type { BullMQProducer } from '@robin/queue'
import { resolveEntrySlug } from '../db/slug.js'
import { computeContentHash, findDuplicateEntry } from '../db/dedup.js'
import type { WriteJob } from '@robin/queue'
import type { gatewayClient as GatewayClient } from '../gateway/client.js'
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
import { assembleFragmentFrontmatter, assemblePersonFrontmatter } from '@robin/agent'
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
 * write access (producer, gateway writes) plus LLM calls for entity
 * extraction, while resolvers only need reads.
 *
 * @property producer              - BullMQ producer for enqueuing pipeline jobs
 * @property gatewayClient         - Git gateway for reads/writes to user repos
 * @property db                    - Drizzle database instance
 * @property spawnWriteWorker      - Ensures a write worker exists for the user
 * @property resolveDefaultVaultId - Returns the user's inbox vault ID
 * @property entityExtractCall     - LLM call for people extraction (fail-open)
 * @property loadUserPeople        - Loads known people for fuzzy name matching
 */
export interface McpServerDeps {
  producer: BullMQProducer
  gatewayClient: typeof GatewayClient
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
 * @remarks
 * This is the primary entry point for MCP clients that want Robin to
 * classify, fragment, and file their content automatically.
 *
 * @param deps   - Injected dependencies (db, gateway, producer, etc.)
 * @param input  - The raw content and optional source tag
 * @param userId - Authenticated user ID (`undefined` = not authenticated)
 * @returns MCP-shaped response with entry key or error
 *
 * @throws Never — all errors are caught and returned as `{ isError: true }`
 *
 * @example
 * ```ts
 * const result = await handleLogEntry(deps,
 *   { content: 'Had coffee with Sarah' },
 *   userId
 * )
 * // → { content: [{ type: 'text', text: 'Entry queued: entry01...' }] }
 * ```
 */
export async function handleLogEntry(
  deps: McpServerDeps,
  input: { content: string; source?: 'mcp' | 'api' | 'web' },
  userId: string | undefined
) {
  /** @gate — Reject unauthenticated requests */
  if (!userId) {
    return {
      content: [{ type: 'text' as const, text: 'Error: not authenticated' }],
      isError: true as const,
    }
  }

  /** @gate — Reject empty content */
  const trimmed = input.content?.trim()
  if (!trimmed) {
    return {
      content: [{ type: 'text' as const, text: 'Error: content is required' }],
      isError: true as const,
    }
  }

  try {
    /** @gate — Reject duplicate content */
    const hash = computeContentHash(trimmed)
    const dup = await findDuplicateEntry(deps.db, userId, hash)
    if (dup) {
      return {
        content: [{ type: 'text' as const, text: `Duplicate: entry ${dup.lookupKey} already contains this content` }],
      }
    }

    /** @step 1 — Generate entry identifiers and resolve default vault */
    const entryKey = makeLookupKey('entry')
    const { ulid: entryUlid } = parseLookupKey(entryKey)
    const defaultVaultId = await deps.resolveDefaultVaultId(userId)
    const title = trimmed.slice(0, 80)
    const slug = await resolveEntrySlug(deps.db, userId, generateSlug(title))
    const entrySource = input.source ?? 'mcp'
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]

    /** @step 2 — Write verbatim note to git (mirrors POST /entries) */
    const noteFilePath = `var/raw/${dateStr}-${slug}.${entryKey}.md`
    const noteContent = `---\ncreated_at: ${now.toISOString()}\nsource: ${entrySource}\nentry_id: ${entryKey}\n---\n\n${trimmed}`
    let noteWriteOk = false
    try {
      await deps.gatewayClient.write({
        userId,
        path: noteFilePath,
        content: noteContent,
        message: `note: raw entry ${entryUlid.slice(0, 8)}`,
        branch: 'main',
      })
      noteWriteOk = true
    } catch (err) {
      /** @fallback — Git down: entry row gets empty repoPath */
      log.error({ err }, 'mcp note write failed')
    }

    /** @step 3 — Insert entry row (must exist before enqueue — worker reads it) */
    await deps.db.insert(entriesTable).values({
      lookupKey: entryKey,
      userId,
      slug,
      vaultId: defaultVaultId,
      title,
      content: trimmed,
      dedupHash: hash,
      type: 'thought',
      source: entrySource,
      repoPath: noteWriteOk ? noteFilePath : '',
    })

    /** @step 4 — Enqueue WriteJob for the 6-stage AI pipeline */
    const job: WriteJob = {
      type: 'write',
      jobId: entryUlid,
      userId,
      enqueuedAt: now.toISOString(),
      payload: {
        userId,
        rawEntry: {
          content: trimmed,
          source: entrySource,
          metadata: defaultVaultId ? { vaultId: defaultVaultId } : undefined,
        },
        jobId: entryUlid,
        entryId: entryKey,
        enqueuedAt: now.toISOString(),
        noteFilePath: noteWriteOk ? noteFilePath : undefined,
      },
    }
    await deps.producer.enqueueWrite(userId, job)

    /** @step 5 — Spawn write worker if not already running */
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
 * @remarks
 * The standard pipeline (`log_entry` → 6 stages) is optimized for
 * unstructured input where Robin decides classification. When the
 * caller already knows the thread, this handler skips vault classify,
 * fragmentation, and thread classify — going straight to persist.
 *
 * **Edge types created:**
 * - `FRAGMENT_IN_WIKI` — links fragment to its parent thread
 * - `FRAGMENT_MENTIONS_PERSON` — one per extracted person mention
 *
 * @param deps   - Injected dependencies (db, gateway, LLM calls, etc.)
 * @param input  - Fragment content, target thread slug, optional title/tags
 * @param userId - Authenticated user ID (`undefined` = not authenticated)
 * @returns MCP-shaped response with fragment/thread keys or error
 *
 * @throws Never — all errors caught and returned as `{ isError: true }`
 *
 * @see {@link resolveThreadBySlug} — strict slug resolution (no fuzzy auto-match)
 * @see {@link handleLogEntry} — full pipeline alternative
 *
 * @example
 * ```ts
 * const result = await handleLogFragment(deps,
 *   { content: 'Did a 5k run', threadSlug: 'fitness' },
 *   userId
 * )
 * // → { content: [{ text: '{"fragmentKey":"frag01...","threadSlug":"fitness"}' }] }
 * ```
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
  /** @gate — Reject unauthenticated requests */
  if (!userId) {
    return {
      content: [{ type: 'text' as const, text: 'Error: not authenticated' }],
      isError: true as const,
    }
  }

  /** @gate — Reject empty content */
  const trimmed = input.content?.trim()
  if (!trimmed) {
    return {
      content: [{ type: 'text' as const, text: 'Error: content is required' }],
      isError: true as const,
    }
  }

  /** @gate — Reject missing threadSlug */
  if (!input.threadSlug?.trim()) {
    return {
      content: [{ type: 'text' as const, text: 'Error: threadSlug is required' }],
      isError: true as const,
    }
  }

  try {
    const resolverDeps: McpResolverDeps = {
      db: deps.db,
      gatewayClient: deps.gatewayClient,
    }

    /** @step 1 — Resolve thread by exact slug (no fuzzy auto-resolution) */
    const threadResult = await resolveThreadBySlug(resolverDeps, userId, input.threadSlug.trim())

    /** @gate — Thread not found → return error with suggestions */
    if ('error' in threadResult) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(threadResult) }],
        isError: true as const,
      }
    }

    /** @step 2 — Entity extraction (fail-open) */
    let personKeys: string[] = []
    let newPeople: Array<{ personKey: string; canonicalName: string }> = []
    let extractionStatus: 'completed' | 'failed' = 'failed'
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
      extractionStatus = 'completed'
    } catch (err) {
      /** @fallback — LLM down: continue without people edges */
      log.warn({ err, userId }, 'log_fragment entity extraction failed (continuing)')
    }

    /** @step 3 — Generate fragment identifiers (key, ULID, slug, filename) */
    const fragKey = makeLookupKey('frag')
    const { ulid: fragUlid } = parseLookupKey(fragKey)
    const title = input.title?.trim() || trimmed.slice(0, 80)
    const fragSlug = `${generateSlug(title)}-${fragUlid.slice(0, 6).toLowerCase()}`
    const now = new Date()
    const today = now.toISOString().slice(0, 10).replace(/-/g, '')
    const fragFilename = composeFilename({
      date: today,
      slug: fragSlug,
      type: 'frag',
      ulid: fragUlid,
    })
    const fragPath = `fragments/${fragFilename}`

    /** @step 4 — Assemble fragment frontmatter (always RESOLVED observation) */
    const frontmatter = assembleFragmentFrontmatter({
      title,
      type: 'observation',
      date: today,
      tags: input.tags ?? [],
      wikiKeys: [threadResult.lookupKey],
      personKeys,
      relatedFragmentKeys: [],
      status: 'RESOLVED',
      confidence: 1,
      sourceSpan: '',
      suggestedSlug: fragSlug,
      wikiLinks: [],
      brokenLinks: [],
      entityExtractionStatus: extractionStatus,
    })

    /** @step 5 — Build person markdown files for newly discovered people */
    const personFiles: Array<{ path: string; content: string }> = []
    for (const person of newPeople) {
      const { ulid: personUlid } = parseLookupKey(person.personKey)
      const personSlug = generateSlug(person.canonicalName)
      const personFilename = composeFilename({
        date: today,
        slug: personSlug,
        type: 'person',
        ulid: personUlid,
      })
      const personFm = assemblePersonFrontmatter({
        type: 'person',
        state: 'RESOLVED',
        verified: false,
        canonicalName: person.canonicalName,
        aliases: [],
        fragmentKeys: [fragKey],
        lastRebuiltAt: null,
        wikiLinks: [],
        brokenLinks: [],
      })
      personFiles.push({
        path: `people/${personFilename}`,
        content: personFm,
      })
    }

    /** @step 6 — Write fragment + person files to git via batchWrite */
    let repoPath = fragPath
    try {
      await deps.gatewayClient.batchWrite({
        userId,
        files: [{ path: fragPath, content: `${frontmatter}\n${trimmed}` }, ...personFiles],
        message: `fragment: ${title}`,
        branch: 'main',
      })
    } catch (err) {
      /** @fallback — Gateway down: fragment row gets empty repoPath */
      log.error({ err, userId }, 'log_fragment git write failed')
      repoPath = ''
    }

    /** @step 7a — Insert fragment row */
    await deps.db.insert(fragmentsTable).values({
      lookupKey: fragKey,
      userId,
      slug: fragSlug,
      title,
      type: 'observation',
      tags: input.tags ?? [],
      entryId: null,
      state: 'RESOLVED',
      repoPath,
    })

    /** @step 7b — Insert FRAGMENT_IN_WIKI edge */
    await deps.db
      .insert(edgesTable)
      .values({
        id: crypto.randomUUID(),
        userId,
        srcType: 'fragment',
        srcId: fragKey,
        dstType: 'wiki',
        dstId: threadResult.lookupKey,
        edgeType: 'FRAGMENT_IN_WIKI',
      } as any)
      .onConflictDoNothing()

    /** @step 7c — Insert FRAGMENT_MENTIONS_PERSON edges (one per person) */
    for (const personKey of personKeys) {
      await deps.db
        .insert(edgesTable)
        .values({
          id: crypto.randomUUID(),
          userId,
          srcType: 'fragment',
          srcId: fragKey,
          dstType: 'person',
          dstId: personKey,
          edgeType: 'FRAGMENT_MENTIONS_PERSON',
        } as any)
        .onConflictDoNothing()
    }

    /** @step 7d — Insert new people rows (for people not yet in DB) */
    for (const person of newPeople) {
      await deps.db
        .insert(peopleTable)
        .values({
          lookupKey: person.personKey,
          userId,
          slug: generateSlug(person.canonicalName),
          name: person.canonicalName,
          state: 'RESOLVED',
          sections: {
            canonicalName: person.canonicalName,
            aliases: [],
            verified: false,
            fragmentKeys: [fragKey],
          },
        } as any)
        .onConflictDoNothing()
    }

    /** @step 8 — Mark thread DIRTY for wiki regen (timeline + synthesis) */
    await deps.db
      .update(threadsTable)
      .set({ state: 'DIRTY', updatedAt: now } as any)
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
