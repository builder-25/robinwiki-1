/**
 * @module mcp/resolvers
 *
 * @summary Read-only resolvers for MCP tools and resources. Fuzzy
 * slug/name matching with Levenshtein scoring.
 *
 * @remarks
 * Resolvers never mutate state — all write operations live in
 * {@link module:mcp/handlers | handlers.ts}.
 *
 * **Slug resolution** uses Levenshtein-based fuzzy matching so MCP
 * clients don't need exact slugs. Threshold of 70 balances convenience
 * (LLMs paraphrase) against safety (don't auto-resolve wrong strings).
 *
 * **Person resolution** is more aggressive: checks canonical names,
 * aliases, then fuzzy. When multiple candidates score within 5 points,
 * the response includes `alternatives` for disambiguation.
 *
 * **Git as source of truth:** wiki/fragment content is read from git
 * via gateway, not DB. Gateway down → empty content, not failure.
 *
 * @see {@link resolveSlug} — generic fuzzy slug matching (auto-resolve at 70+)
 * @see {@link resolveThreadBySlug} — strict exact-match for write paths
 * @see {@link listThreads} — thread listing with fragment counts
 * @see {@link getThread} — full thread detail with wiki body
 * @see {@link getFragment} — full fragment with content + frontmatter
 * @see {@link getPerson} — person detail with alias-aware matching
 */

import { eq, and, isNull, sql, inArray } from 'drizzle-orm'
import type { DB } from '../db/client.js'
import { wikis, fragments, people, edges } from '../db/schema.js'
import type { gatewayClient as GatewayClient } from '../gateway/client.js'

/***********************************************************************
 * ## Types
 *
 * @internal Resolver-specific interfaces. MCP layer consumes these
 * via the public resolver functions, not directly.
 ***********************************************************************/

/**
 * Injected dependencies for all resolvers.
 *
 * @remarks
 * Intentionally narrower than {@link McpServerDeps} — resolvers only
 * need read access to the database and gateway.
 */
export interface McpResolverDeps {
  db: DB
  gatewayClient: typeof GatewayClient
}

/** Thread list item with fragment count and wiki preview. */
interface ThreadSummary {
  lookupKey: string
  slug: string
  name: string
  type: string
  state: string
  fragmentCount: number
  lastRebuiltAt: string | null
  wikiPreview: string
}

/** Full thread detail with wiki body and member fragment snippets. */
interface ThreadDetail {
  thread: {
    lookupKey: string
    slug: string
    name: string
    type: string
    state: string
    lastRebuiltAt: string | null
  }
  wikiBody: string
  fragments: FragmentSnippet[]
}

/** Abbreviated fragment — used in thread and person detail responses. */
interface FragmentSnippet {
  slug: string
  type: string | null
  title: string
  snippet: string
}

/** Full fragment with content and frontmatter from git. */
interface FragmentDetail {
  slug: string
  type: string | null
  title: string
  tags: string[]
  content: string
  frontmatter: string
}

/** Person detail with profile body and linked fragments. */
interface PersonDetail {
  person: {
    name: string
    slug: string
    aliases: string[]
    relationship: string
  }
  body: string
  fragments: FragmentSnippet[]
  alternatives?: string[]
}

/** Returned when slug/name resolution fails. */
interface ErrorResult {
  error: string
  suggestions: string[]
}

/***********************************************************************
 * ## Helpers
 *
 * @internal String utilities for markdown parsing and fuzzy matching.
 * Exported only for testing — not part of the public API.
 ***********************************************************************/

/**
 * Strip YAML frontmatter from markdown content.
 *
 * @param content - Raw markdown string (may or may not have frontmatter)
 * @returns Body after the closing `---` fence
 */
export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  if (!match) return content
  return content.slice(match[0].length)
}

/**
 * Extract the raw YAML block from between `---` fences.
 *
 * @param content - Raw markdown string
 * @returns YAML string (without fences), or empty string if none found
 */
function extractFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return match?.[1] ?? ''
}

/**
 * Levenshtein edit distance between two strings.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance (0 = identical)
 *
 * @see {@link ratio} — normalized similarity score built on this
 */
function levenshtein(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  if (la === 0) return lb
  if (lb === 0) return la

  let prev = Array.from({ length: lb + 1 }, (_, i) => i)
  let curr = new Array<number>(lb + 1)

  for (let i = 1; i <= la; i++) {
    curr[0] = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[lb]
}

/**
 * Similarity ratio (0–100), comparable to Python's `fuzz.ratio`.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Score from 0 (completely different) to 100 (identical)
 */
function ratio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 100
  return Math.round(((maxLen - levenshtein(a, b)) / maxLen) * 100)
}

/**
 * Partial ratio: slides the shorter string across the longer one
 * and returns the best ratio found.
 *
 * @remarks
 * Useful when the input is a substring of the target
 * (e.g. `"fitness"` matching `"fitness-log"`).
 *
 * @param a - First string
 * @param b - Second string
 * @returns Best windowed ratio (0–100)
 */
function partialRatio(a: string, b: string): number {
  let short = a
  let long = b
  if (short.length > long.length) [short, long] = [long, short]
  if (short.length === 0) return 0
  let best = 0
  for (let i = 0; i <= long.length - short.length; i++) {
    best = Math.max(best, ratio(short, long.slice(i, i + short.length)))
  }
  return best
}

/***********************************************************************
 * ## Slug resolution
 *
 * @remarks Generic fuzzy matching used by read-only resolvers.
 * Write paths use {@link resolveThreadBySlug} (exact only).
 ***********************************************************************/

/** @internal */
interface SlugCandidate {
  slug: string
  name: string
}

/**
 * Resolve a user-provided slug against a list of candidates.
 *
 * @remarks
 * **Resolution strategy:**
 * 1. Exact match on slug (case-insensitive)
 * 2. Fuzzy match on slug and name — best score wins if >= 70
 * 3. If no match, return error with top 3 suggestions
 *
 * The 70-point threshold balances convenience (LLMs often paraphrase)
 * against safety (don't auto-resolve wildly different strings).
 *
 * @param input      - The slug string to resolve
 * @param candidates - All available slugs to match against
 * @returns Matched candidate or error with suggestions
 *
 * @example
 * ```ts
 * resolveSlug('fitnes', [{ slug: 'fitness', name: 'Fitness' }])
 * // → { match: { slug: 'fitness', name: 'Fitness' } }
 * ```
 */
export function resolveSlug(
  input: string,
  candidates: SlugCandidate[]
): { match: SlugCandidate } | { error: string; suggestions: string[] } {
  const lower = input.toLowerCase()

  const exact = candidates.find((c) => c.slug === lower || c.slug === input)
  if (exact) return { match: exact }

  const scored = candidates
    .map((c) => ({
      candidate: c,
      score: Math.max(
        ratio(lower, c.slug.toLowerCase()),
        partialRatio(lower, c.slug.toLowerCase()),
        ratio(lower, c.name.toLowerCase())
      ),
    }))
    .sort((a, b) => b.score - a.score)

  if (scored.length > 0 && scored[0].score >= 70) {
    return { match: scored[0].candidate }
  }

  return {
    error: `No match found for "${input}"`,
    suggestions: scored.slice(0, 3).map((s) => s.candidate.slug),
  }
}

/***********************************************************************
 * ## Person name resolution
 *
 * @remarks More aggressive than slug resolution — checks canonical
 * names, aliases, and fuzzy matches with ambiguity detection.
 *
 * @see {@link getPerson} — public resolver that uses this
 ***********************************************************************/

/**
 * Resolve a person name with alias-aware fuzzy matching.
 *
 * @remarks
 * **Resolution strategy:**
 * 1. Exact canonical name match (case-insensitive)
 * 2. Exact alias match (case-insensitive)
 * 3. Fuzzy match across names + aliases — best score wins if >= 70
 * 4. Ambiguity detection: multiple candidates within 5 points →
 *    `alternatives` returned so the MCP client can disambiguate
 *
 * @param nameInput  - The name to search for
 * @param candidates - All known people with their aliases
 * @returns Matched person (possibly with `alternatives`) or error
 *
 * @example
 * ```ts
 * resolvePerson('Sarah', [
 *   { name: 'Sarah Connor', slug: 'sarah-connor', aliases: [] },
 *   { name: 'Sarah Chen', slug: 'sarah-chen', aliases: ['SC'] },
 * ])
 * // → { match: { name: 'Sarah Connor', ... }, alternatives: ['Sarah Chen'] }
 * ```
 */
function resolvePerson(
  nameInput: string,
  candidates: Array<{ name: string; slug: string; aliases: string[] }>
):
  | { match: (typeof candidates)[0]; alternatives?: string[] }
  | { error: string; suggestions: string[] } {
  const lower = nameInput.toLowerCase()

  const exact = candidates.find((c) => c.name.toLowerCase() === lower)
  if (exact) return { match: exact }

  const aliasMatch = candidates.find((c) => c.aliases.some((a) => a.toLowerCase() === lower))
  if (aliasMatch) return { match: aliasMatch }

  const scored = candidates
    .map((c) => {
      const nameScore = Math.max(
        ratio(lower, c.name.toLowerCase()),
        partialRatio(lower, c.name.toLowerCase())
      )
      const aliasScores = c.aliases.map((a) =>
        Math.max(ratio(lower, a.toLowerCase()), partialRatio(lower, a.toLowerCase()))
      )
      const best = Math.max(nameScore, ...aliasScores, 0)
      return { candidate: c, score: best }
    })
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return { error: `No match found for "${nameInput}"`, suggestions: [] }
  }

  if (scored[0].score < 70) {
    return {
      error: `No match found for "${nameInput}"`,
      suggestions: scored.slice(0, 3).map((s) => s.candidate.name),
    }
  }

  // Ambiguity check: multiple candidates within 5 points
  const topScore = scored[0].score
  const close = scored.filter((s) => topScore - s.score <= 5)
  if (close.length > 1) {
    return {
      match: scored[0].candidate,
      alternatives: close.slice(1).map((s) => s.candidate.name),
    }
  }

  return { match: scored[0].candidate }
}

/***********************************************************************
 * ## Resolvers
 *
 * @remarks Public query functions consumed by MCP tool/resource
 * registrations in {@link module:mcp/server | server.ts}.
 ***********************************************************************/

/**
 * List all wikis for a user with fragment counts and wiki previews.
 *
 * @remarks
 * Returns the 20 most recently updated wikis. Fragment counts are
 * computed via a LEFT JOIN on `FRAGMENT_IN_WIKI` edges. Wiki previews
 * are read from git (first 200 chars after frontmatter).
 *
 * @param deps   - Database and gateway client
 * @param userId - Authenticated user ID
 * @returns Array of {@link ThreadSummary} sorted by last update
 */
export async function listThreads(deps: McpResolverDeps, userId: string): Promise<ThreadSummary[]> {
  const rows = await deps.db
    .select({
      lookupKey: wikis.lookupKey,
      slug: wikis.slug,
      name: wikis.name,
      type: wikis.type,
      state: wikis.state,
      repoPath: wikis.repoPath,
      lastRebuiltAt: wikis.lastRebuiltAt,
      fragmentCount: sql<number>`count(${edges.id})::int`,
    })
    .from(wikis)
    .leftJoin(
      edges,
      and(
        eq(edges.dstId, wikis.lookupKey),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
        isNull(edges.deletedAt)
      )
    )
    .where(and(eq(wikis.userId, userId), isNull(wikis.deletedAt)))
    .groupBy(wikis.lookupKey)
    .orderBy(sql`${wikis.updatedAt} DESC`)
    .limit(20)

  const results: ThreadSummary[] = await Promise.all(
    rows.map(async (row) => {
      let wikiPreview = ''
      const path = row.repoPath || `wikis/${row.slug}.md`
      try {
        const file = await deps.gatewayClient.read(userId, path)
        const body = stripFrontmatter(file.content)
        wikiPreview = body.slice(0, 200).trim()
      } catch {
        // Gateway read failure or file doesn't exist
      }
      return {
        lookupKey: row.lookupKey,
        slug: row.slug,
        name: row.name,
        type: row.type,
        state: row.state,
        fragmentCount: row.fragmentCount,
        lastRebuiltAt: row.lastRebuiltAt?.toISOString() ?? null,
        wikiPreview,
      }
    })
  )

  return results
}

/**
 * Get full thread detail by slug with fuzzy matching.
 *
 * @remarks
 * Reads the thread's wiki body from git (source of truth) and fetches
 * all member fragments via `FRAGMENT_IN_WIKI` edges with 300-char snippets.
 *
 * @param deps      - Database and gateway client
 * @param userId    - Authenticated user ID
 * @param slugInput - Thread slug (exact or fuzzy)
 * @returns {@link ThreadDetail} with wiki body and fragments, or {@link ErrorResult}
 *
 * @see {@link resolveSlug} — fuzzy matching strategy used here
 */
export async function getThread(
  deps: McpResolverDeps,
  userId: string,
  slugInput: string
): Promise<ThreadDetail | ErrorResult> {
  const allThreads = await deps.db
    .select({
      lookupKey: wikis.lookupKey,
      slug: wikis.slug,
      name: wikis.name,
      type: wikis.type,
      state: wikis.state,
      repoPath: wikis.repoPath,
      lastRebuiltAt: wikis.lastRebuiltAt,
    })
    .from(wikis)
    .where(and(eq(wikis.userId, userId), isNull(wikis.deletedAt)))

  const resolved = resolveSlug(
    slugInput,
    allThreads.map((t) => ({ slug: t.slug, name: t.name }))
  )
  if ('error' in resolved) return resolved

  const thread = allThreads.find((t) => t.slug === resolved.match.slug)
  if (!thread) return { error: 'Thread not found', suggestions: [] }

  // Read wiki body from git (source of truth, not DB)
  let wikiBody = ''
  const wikiPath = thread.repoPath || `wikis/${thread.slug}.md`
  try {
    const file = await deps.gatewayClient.read(userId, wikiPath)
    wikiBody = stripFrontmatter(file.content)
  } catch {
    // Gateway read failure or file doesn't exist
  }

  // Fetch member fragments via edge graph
  const fragEdges = await deps.db
    .select({ srcId: edges.srcId })
    .from(edges)
    .where(
      and(
        eq(edges.userId, userId),
        eq(edges.dstId, thread.lookupKey),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
        isNull(edges.deletedAt)
      )
    )

  const fragKeys = fragEdges.map((e) => e.srcId)
  const frags =
    fragKeys.length > 0
      ? await deps.db
          .select({
            slug: fragments.slug,
            type: fragments.type,
            title: fragments.title,
            repoPath: fragments.repoPath,
          })
          .from(fragments)
          .where(and(inArray(fragments.lookupKey, fragKeys), isNull(fragments.deletedAt)))
      : []

  const fragmentSnippets: FragmentSnippet[] = await Promise.all(
    frags.map(async (f) => {
      let snippet = ''
      if (f.repoPath) {
        try {
          const file = await deps.gatewayClient.read(userId, f.repoPath)
          snippet = stripFrontmatter(file.content).slice(0, 300).trim()
        } catch {
          // Gateway read failure
        }
      }
      return { slug: f.slug, type: f.type, title: f.title, snippet }
    })
  )

  return {
    thread: {
      lookupKey: thread.lookupKey,
      slug: thread.slug,
      name: thread.name,
      type: thread.type,
      state: thread.state,
      lastRebuiltAt: thread.lastRebuiltAt?.toISOString() ?? null,
    },
    wikiBody,
    fragments: fragmentSnippets,
  }
}

/**
 * Get full fragment detail by slug with fuzzy matching.
 *
 * @remarks
 * Returns the complete markdown content and raw frontmatter from git.
 * The `content` field has frontmatter stripped; the `frontmatter` field
 * has just the YAML block for structured parsing by MCP clients.
 *
 * @param deps      - Database and gateway client
 * @param userId    - Authenticated user ID
 * @param slugInput - Fragment slug (exact or fuzzy)
 * @returns {@link FragmentDetail} with content and frontmatter, or {@link ErrorResult}
 *
 * @see {@link resolveSlug} — fuzzy matching strategy used here
 */
export async function getFragment(
  deps: McpResolverDeps,
  userId: string,
  slugInput: string
): Promise<FragmentDetail | ErrorResult> {
  const allFrags = await deps.db
    .select({
      slug: fragments.slug,
      type: fragments.type,
      title: fragments.title,
      tags: fragments.tags,
      repoPath: fragments.repoPath,
    })
    .from(fragments)
    .where(and(eq(fragments.userId, userId), isNull(fragments.deletedAt)))

  const resolved = resolveSlug(
    slugInput,
    allFrags.map((f) => ({ slug: f.slug, name: f.title }))
  )
  if ('error' in resolved) return resolved

  const frag = allFrags.find((f) => f.slug === resolved.match.slug)
  if (!frag) return { error: 'Fragment not found', suggestions: [] }

  let content = ''
  let frontmatter = ''
  if (frag.repoPath) {
    try {
      const file = await deps.gatewayClient.read(userId, frag.repoPath)
      content = stripFrontmatter(file.content)
      frontmatter = extractFrontmatter(file.content)
    } catch {
      // Gateway read failure
    }
  }

  return {
    slug: frag.slug,
    type: frag.type,
    title: frag.title,
    tags: frag.tags as string[],
    content,
    frontmatter,
  }
}

/**
 * Get person detail by name with alias-aware fuzzy matching.
 *
 * @remarks
 * Reads the person's profile body from git and fetches all fragments
 * that mention them via `FRAGMENT_MENTIONS_PERSON` edges. If multiple
 * people match closely, the response includes `alternatives` for
 * disambiguation.
 *
 * @param deps      - Database and gateway client
 * @param userId    - Authenticated user ID
 * @param nameInput - Person name to search for (exact or fuzzy)
 * @returns {@link PersonDetail} with profile and fragments, or {@link ErrorResult}
 *
 * @see {@link resolvePerson} — alias-aware matching strategy used here
 */
export async function getPerson(
  deps: McpResolverDeps,
  userId: string,
  nameInput: string
): Promise<PersonDetail | ErrorResult> {
  const allPeople = await deps.db
    .select({
      lookupKey: people.lookupKey,
      slug: people.slug,
      name: people.name,
      relationship: people.relationship,
      sections: people.sections,
      repoPath: people.repoPath,
    })
    .from(people)
    .where(and(eq(people.userId, userId), isNull(people.deletedAt)))

  const candidates = allPeople.map((p) => ({
    name: p.name,
    slug: p.slug,
    aliases: Array.isArray((p.sections as Record<string, unknown>)?.aliases)
      ? ((p.sections as Record<string, unknown>).aliases as string[])
      : [],
  }))

  const resolved = resolvePerson(nameInput, candidates)
  if ('error' in resolved) return resolved

  const person = allPeople.find((p) => p.slug === resolved.match.slug)
  if (!person) return { error: 'Person not found', suggestions: [] }

  // Read person profile from git
  let body = ''
  if (person.repoPath) {
    try {
      const file = await deps.gatewayClient.read(userId, person.repoPath)
      body = stripFrontmatter(file.content)
    } catch {
      // Gateway read failure
    }
  }

  // Fetch linked fragments via FRAGMENT_MENTIONS_PERSON edges
  const fragEdges = await deps.db
    .select({ srcId: edges.srcId })
    .from(edges)
    .where(
      and(
        eq(edges.userId, userId),
        eq(edges.dstId, person.lookupKey),
        eq(edges.edgeType, 'FRAGMENT_MENTIONS_PERSON'),
        isNull(edges.deletedAt)
      )
    )

  const fragKeys = fragEdges.map((e) => e.srcId)
  const frags =
    fragKeys.length > 0
      ? await deps.db
          .select({
            slug: fragments.slug,
            type: fragments.type,
            title: fragments.title,
            repoPath: fragments.repoPath,
          })
          .from(fragments)
          .where(and(inArray(fragments.lookupKey, fragKeys), isNull(fragments.deletedAt)))
      : []

  const fragmentSnippets: FragmentSnippet[] = await Promise.all(
    frags.map(async (f) => {
      let snippet = ''
      if (f.repoPath) {
        try {
          const file = await deps.gatewayClient.read(userId, f.repoPath)
          snippet = stripFrontmatter(file.content).slice(0, 300).trim()
        } catch {
          // Gateway read failure
        }
      }
      return { slug: f.slug, type: f.type, title: f.title, snippet }
    })
  )

  const result: PersonDetail = {
    person: {
      name: person.name,
      slug: person.slug,
      aliases: resolved.match.aliases,
      relationship: person.relationship,
    },
    body,
    fragments: fragmentSnippets,
  }

  if ('alternatives' in resolved && resolved.alternatives) {
    result.alternatives = resolved.alternatives
  }

  return result
}

/***********************************************************************
 * ## Thread slug resolution (strict)
 *
 * @remarks Exact-match only — used by write paths where precision
 * matters more than convenience. Compare with {@link resolveSlug}.
 ***********************************************************************/

/**
 * Resolve a thread by exact slug match — no fuzzy auto-resolution.
 *
 * @remarks
 * Used by {@link handleLogFragment} where precision is critical. When
 * writing a fragment to a thread, we can't afford to fuzzy-match and
 * accidentally file content to the wrong thread.
 *
 * On miss, returns scored suggestions so the MCP client can present
 * "did you mean?" options without auto-resolving.
 *
 * @param deps      - Database and gateway client
 * @param userId    - Authenticated user ID
 * @param slugInput - Exact thread slug to match
 * @returns Thread metadata or {@link ErrorResult} with suggestions
 *
 * @see {@link resolveSlug} — fuzzy alternative used by read-only resolvers
 */
export async function resolveThreadBySlug(
  deps: McpResolverDeps,
  userId: string,
  slugInput: string
): Promise<
  | { lookupKey: string; slug: string; name: string; state: string }
  | { error: string; suggestions: string[] }
> {
  const allThreads = await deps.db
    .select({
      lookupKey: wikis.lookupKey,
      slug: wikis.slug,
      name: wikis.name,
      state: wikis.state,
    })
    .from(wikis)
    .where(and(eq(wikis.userId, userId), isNull(wikis.deletedAt)))

  // Exact match only — log_fragment requires precision
  const exact = allThreads.find((t) => t.slug === slugInput)
  if (exact) return exact

  // No fuzzy auto-resolution — just provide ranked suggestions
  const scored = allThreads
    .map((t) => ({
      slug: t.slug,
      score: Math.max(
        ratio(slugInput.toLowerCase(), t.slug.toLowerCase()),
        partialRatio(slugInput.toLowerCase(), t.slug.toLowerCase()),
        ratio(slugInput.toLowerCase(), t.name.toLowerCase())
      ),
    }))
    .sort((a, b) => b.score - a.score)

  return {
    error: `Thread not found: "${slugInput}"`,
    suggestions: scored.slice(0, 3).map((s) => s.slug),
  }
}
