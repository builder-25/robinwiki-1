import { eq, ne, and, inArray, desc, isNull } from 'drizzle-orm'
import { createIngestAgents, createStringCaller, embedText } from '@robin/agent'
import { loadWikiGenerationSpec, type WikiGenerationOverride } from '@robin/shared'
import type { WikiType } from '@robin/shared'
import { db as defaultDb, type DB } from '../db/client.js'
import { wikis, wikiTypes, edges, fragments, edits } from '../db/schema.js'
import { loadOpenRouterConfig } from './openrouter-config.js'
import { nanoid } from './id.js'
import { logger } from './logger.js'
import { emitAuditEvent } from '../db/audit.js'

const log = logger.child({ component: 'regen' })

export interface RegenResult {
  content: string
  fragmentCount: number
  hasEmbedding: boolean
}

/**
 * Shared wiki regeneration logic used by both the on-demand route handler
 * and the background regen worker.
 */
export async function regenerateWiki(
  database: DB = defaultDb,
  wikiKey: string,
  opts?: { skipEmbedding?: boolean }
): Promise<RegenResult> {
  const [wiki] = await database.select().from(wikis).where(eq(wikis.lookupKey, wikiKey))
  if (!wiki) throw new Error(`Wiki not found: ${wikiKey}`)

  const previousContent = wiki.content

  const orConfig = await loadOpenRouterConfig()
  const agents = createIngestAgents(orConfig)
  const callLlm = createStringCaller(agents.wikiClassifier)

  // Gather linked fragments via FRAGMENT_IN_WIKI edges
  const fragmentEdges = await database
    .select({ srcId: edges.srcId })
    .from(edges)
    .where(
      and(
        eq(edges.dstId, wikiKey),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
        isNull(edges.deletedAt)
      )
    )

  const fragmentKeys = fragmentEdges.map((e) => e.srcId)
  let fragmentsText = ''
  let fragmentCount = 0

  if (fragmentKeys.length > 0) {
    const fragRows = await database
      .select({ title: fragments.title, content: fragments.content })
      .from(fragments)
      .where(and(inArray(fragments.lookupKey, fragmentKeys), isNull(fragments.deletedAt)))

    fragmentCount = fragRows.length
    fragmentsText = fragRows
      .map((f) => `### ${f.title}\n${f.content}`)
      .join('\n\n')
  }

  // Gather recent user edits for the {{edits}} template variable
  const userEdits = await database
    .select({ content: edits.content })
    .from(edits)
    .where(
      and(
        eq(edits.objectType, 'wiki'),
        eq(edits.objectId, wikiKey),
        eq(edits.source, 'user')
      )
    )
    .orderBy(desc(edits.timestamp))
    .limit(10)

  const editsSummary = userEdits.length > 0
    ? userEdits.map((e) => e.content).join('\n---\n')
    : undefined

  // Gather related wikis via shared fragments and [[wiki-slug]] references
  const linkedWikiKeys = new Set<string>()

  // Source 1: wikis that share fragments with the current wiki (co-occurrence)
  if (fragmentKeys.length > 0) {
    const sharedFragWikiRows = await database
      .select({ dstId: edges.dstId })
      .from(edges)
      .where(and(
        inArray(edges.srcId, fragmentKeys),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
        ne(edges.dstId, wikiKey),
        isNull(edges.deletedAt)
      ))
      .groupBy(edges.dstId)
    for (const row of sharedFragWikiRows) linkedWikiKeys.add(row.dstId)
  }

  // Source 2: explicit [[wiki-slug]] references in existing content
  const wikiLinkPattern = /\[\[([a-z0-9-]+)\]\]/g
  const referencedSlugs = [...(wiki.content?.matchAll(wikiLinkPattern) ?? [])].map(m => m[1])
  if (referencedSlugs.length > 0) {
    const slugRows = await database
      .select({ lookupKey: wikis.lookupKey })
      .from(wikis)
      .where(and(
        inArray(wikis.slug, referencedSlugs),
        ne(wikis.lookupKey, wikiKey),
        isNull(wikis.deletedAt)
      ))
    for (const row of slugRows) linkedWikiKeys.add(row.lookupKey)
  }

  // Cap at 8 linked wikis, load content
  const cappedKeys = [...linkedWikiKeys].slice(0, 8)
  let relatedWikisText: string | undefined
  if (cappedKeys.length > 0) {
    const linkedRows = await database
      .select({
        slug: wikis.slug,
        name: wikis.name,
        type: wikis.type,
        content: wikis.content,
      })
      .from(wikis)
      .where(inArray(wikis.lookupKey, cappedKeys))

    relatedWikisText = linkedRows.map((w) => {
      const raw = (w.content ?? '').slice(0, 400)
      // Trim to last sentence boundary within 400 chars
      const lastDot = raw.lastIndexOf('.')
      const lastNewline = raw.lastIndexOf('\n')
      const boundary = Math.max(lastDot, lastNewline)
      const truncated = boundary > 0 ? raw.slice(0, boundary + 1) : raw + '...'
      return `- [[${w.slug}]] (${w.type}): ${w.name}\n  > ${truncated.trim()}`
    }).join('\n')
  }

  // Resolve override hierarchy: wiki.prompt (systemMessage swap) > wikiTypes.prompt
  // (YAML blob) > disk default. Per-wiki overrides short-circuit the type-level
  // override entirely (locked decision).
  let override: WikiGenerationOverride | undefined
  if (wiki.prompt && wiki.prompt.trim().length > 0) {
    override = { kind: 'systemMessage', text: wiki.prompt }
  } else {
    const [wikiTypeRow] = await database
      .select({ prompt: wikiTypes.prompt })
      .from(wikiTypes)
      .where(and(eq(wikiTypes.slug, wiki.type), eq(wikiTypes.userModified, true)))
    if (wikiTypeRow?.prompt) {
      override = { kind: 'yaml', blob: wikiTypeRow.prompt }
    }
  }

  const vars = {
    fragments: fragmentsText,
    title: wiki.name,
    date: new Date().toISOString().split('T')[0],
    count: fragmentCount,
    existingWiki: previousContent || undefined,
    edits: editsSummary,
    relatedWikis: relatedWikisText,
  }

  // Load prompt spec with runtime fallback on override parse/validation failure.
  // A malformed stored YAML must not crash the regen worker — log a warn and retry
  // with no override (disk default).
  let spec
  try {
    spec = loadWikiGenerationSpec(wiki.type as WikiType, vars, override)
  } catch (err) {
    log.warn({
      err: err instanceof Error ? { name: err.name, message: err.message } : err,
      wikiKey,
      wikiType: wiki.type,
      overrideKind: override?.kind,
    }, 'prompt override failed to parse/validate — falling back to disk YAML default')
    spec = loadWikiGenerationSpec(wiki.type as WikiType, vars)
  }

  const markdown = await callLlm(spec.system, spec.user)

  // Update wiki content
  const now = new Date()
  await database
    .update(wikis)
    .set({ content: markdown, lastRebuiltAt: now, updatedAt: now })
    .where(eq(wikis.lookupKey, wikiKey))

  // Compute and store embedding for the new content
  let hasEmbedding = false
  if (!opts?.skipEmbedding) {
    const vec = await embedText(markdown, {
      apiKey: orConfig.apiKey,
      model: orConfig.models.embedding,
    })
    if (vec) {
      await database.update(wikis).set({ embedding: vec }).where(eq(wikis.lookupKey, wikiKey))
      hasEmbedding = true
    }
  }

  // Log edit with source: 'regen'
  await database.insert(edits).values({
    id: nanoid(),
    objectType: 'wiki',
    objectId: wikiKey,
    type: 'addition',
    content: previousContent,
    source: 'regen',
    diff: '',
  })

  await emitAuditEvent(database, {
    entityType: 'wiki',
    entityId: wikiKey,
    eventType: 'composed',
    source: 'system',
    summary: `Wiki regenerated from ${fragmentCount} fragments`,
    detail: { wikiKey, fragmentCount, hasEmbedding },
  })

  log.info({ wikiKey, fragmentCount, hasEmbedding }, 'wiki regenerated')

  return { content: markdown, fragmentCount, hasEmbedding }
}
