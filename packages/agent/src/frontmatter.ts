/**
 * Mechanical frontmatter assemblers for all 4 object types.
 * Uses YAML stringify for proper serialization - no hand-rolled string concat.
 * Never includes ULID in output.
 */

import matter from 'gray-matter'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WikiLinkRef {
  slug: string
  type: string
  key: string
}

// ── Entry Frontmatter ────────────────────────────────────────────────────────

export interface EntryFrontmatterInput {
  title: string
  date: string
  vaultId: string
  source: string
  status: string
  fragmentKeys: string[]
  personKeys: string[]
  wikiLinks: WikiLinkRef[]
  brokenLinks: string[]
}

export function assembleEntryFrontmatter(input: EntryFrontmatterInput): string {
  const data: Record<string, unknown> = {
    title: input.title,
    date: input.date,
    vaultId: input.vaultId,
    source: input.source,
    status: input.status,
    fragmentKeys: input.fragmentKeys,
    personKeys: input.personKeys,
    wikiLinks: input.wikiLinks,
    brokenLinks: input.brokenLinks,
  }
  return wrapFrontmatter(data)
}

// ── Fragment Frontmatter ─────────────────────────────────────────────────────

export interface FragmentFrontmatterInput {
  title: string
  type: string
  date: string
  tags: string[]
  entryKey?: string
  vaultId?: string
  wikiKeys: string[]
  personKeys: string[]
  relatedFragmentKeys: string[]
  status: string
  confidence: number
  sourceSpan: string
  suggestedSlug: string
  wikiLinks: WikiLinkRef[]
  brokenLinks: string[]
  entityExtractionStatus: string
}

export function assembleFragmentFrontmatter(input: FragmentFrontmatterInput): string {
  const data: Record<string, unknown> = {
    title: input.title,
    type: input.type,
    date: input.date,
    tags: input.tags,
    ...(input.entryKey !== undefined && { entryKey: input.entryKey }),
    ...(input.vaultId !== undefined && { vaultId: input.vaultId }),
    wikiKeys: input.wikiKeys,
    personKeys: input.personKeys,
    relatedFragmentKeys: input.relatedFragmentKeys,
    status: input.status,
    confidence: input.confidence,
    sourceSpan: input.sourceSpan,
    suggestedSlug: input.suggestedSlug,
    wikiLinks: input.wikiLinks,
    brokenLinks: input.brokenLinks,
    entityExtractionStatus: input.entityExtractionStatus,
  }
  return wrapFrontmatter(data)
}

// ── Thread Frontmatter ───────────────────────────────────────────────────────

export interface ThreadFrontmatterInput {
  type: string
  state: string
  vaultId?: string
  name: string
  prompt: string
  fragmentKeys: string[]
  fragmentCount: number
  lastRebuiltAt: string | null
  wikiLinks: WikiLinkRef[]
  brokenLinks: string[]
}

export function assembleThreadFrontmatter(input: ThreadFrontmatterInput): string {
  const data: Record<string, unknown> = {
    type: input.type,
    state: input.state,
    ...(input.vaultId !== undefined && { vaultId: input.vaultId }),
    name: input.name,
    prompt: input.prompt,
    fragmentKeys: input.fragmentKeys,
    fragmentCount: input.fragmentCount,
    lastRebuiltAt: input.lastRebuiltAt,
    wikiLinks: input.wikiLinks,
    brokenLinks: input.brokenLinks,
  }
  return wrapFrontmatter(data)
}

// ── Person Frontmatter ───────────────────────────────────────────────────────

export interface PersonFrontmatterInput {
  type: string
  state: string
  verified: boolean
  canonicalName: string
  aliases: string[]
  fragmentKeys: string[]
  lastRebuiltAt: string | null
  wikiLinks: WikiLinkRef[]
  brokenLinks: string[]
}

export function assemblePersonFrontmatter(input: PersonFrontmatterInput): string {
  const data: Record<string, unknown> = {
    type: input.type,
    state: input.state,
    verified: input.verified,
    canonicalName: input.canonicalName,
    aliases: input.aliases,
    fragmentKeys: input.fragmentKeys,
    lastRebuiltAt: input.lastRebuiltAt,
    wikiLinks: input.wikiLinks,
    brokenLinks: input.brokenLinks,
  }
  return wrapFrontmatter(data)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function wrapFrontmatter(data: Record<string, unknown>): string {
  return matter.stringify('', data).replace(/\n+$/, '\n')
}
