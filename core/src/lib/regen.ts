import { eq, ne, and, inArray, desc, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  createIngestAgents,
  createTypedCaller,
  embedText,
  wikiClassify,
} from '@robin/agent'
import {
  loadWikiGenerationSpec,
  renderFragmentsBlock,
  wikiClassificationSchema,
  type WikiGenerationOverride,
  type WikiType,
} from '@robin/shared'
import {
  wikiCitationDeclarationSchema,
  wikiInfoboxSchema,
  type WikiCitationDeclaration,
  type WikiInfobox,
  type WikiMetadata,
} from '@robin/shared/schemas/sidecar'

/**
 * Shape of the wiki-generation LLM output. All 10 per-type schemas share
 * this projection (markdown + infobox + per-section citation declarations),
 * so regen can call the model with a single schema rather than branching
 * per wiki type.
 */
const regenOutputSchema = z.object({
  markdown: z.string(),
  infobox: wikiInfoboxSchema.nullable().default(null),
  citations: z.array(wikiCitationDeclarationSchema).default([]),
})
type RegenOutput = z.infer<typeof regenOutputSchema>
import { db as defaultDb, type DB } from '../db/client.js'
import { wikis, wikiTypes, edges, fragments, edits } from '../db/schema.js'
import { loadOpenRouterConfig } from './openrouter-config.js'
import { nanoid } from './id.js'
import { logger } from './logger.js'
import { emitAuditEvent } from '../db/audit.js'

const log = logger.child({ component: 'regen' })

// ── Classification Thresholds ───────────────────────────────────────────────
// Cosine similarity (1 - distance) thresholds for fragment-to-wiki filing.

/** Similarity >= AUTO_FILE_THRESHOLD → file immediately, no LLM needed */
export const AUTO_FILE_THRESHOLD = 0.8

/** Similarity >= LLM_REVIEW_THRESHOLD (and < AUTO_FILE) → send to LLM for judgment */
export const LLM_REVIEW_THRESHOLD = 0.5

/** LLM confidence >= STRONG_SIGNAL_THRESHOLD → strong signal; below → weak signal */
export const STRONG_SIGNAL_THRESHOLD = 0.7

/** Below LLM_REVIEW_THRESHOLD → skip entirely, not relevant */
// (implicit: similarity < 0.5 is ignored)

/** Max unfiled fragments to evaluate per regen call */
const MAX_UNFILED_PER_REGEN = 50

export interface RegenTiming {
  classify: number
  gatherFragments: number
  llmCall: number
  embed: number
  total: number
}

export interface RegenResult {
  content: string
  fragmentCount: number
  hasEmbedding: boolean
  timing?: RegenTiming
}

/**
 * Classify unfiled fragments against a specific wiki using a two-tier approach:
 *
 * 1. Cosine similarity >= AUTO_FILE_THRESHOLD (0.75) → file immediately (no LLM)
 * 2. Cosine similarity >= LLM_REVIEW_THRESHOLD (0.4) and < AUTO_FILE → LLM decides
 * 3. Below LLM_REVIEW_THRESHOLD → skip
 *
 * "Unfiled" = has an embedding but no FRAGMENT_IN_WIKI edge anywhere.
 * Called before regenerateWiki gathers fragments so newly-linked ones are included.
 */
export async function classifyUnfiledFragments(
  database: DB,
  wikiKey: string
): Promise<{ linked: number; autoFiled: number; llmFiled: number; llmRejected: number }> {
  // Get the wiki's embedding for cosine similarity
  const [wiki] = await database
    .select({
      lookupKey: wikis.lookupKey,
      name: wikis.name,
      type: wikis.type,
      prompt: wikis.prompt,
      embedding: wikis.embedding,
    })
    .from(wikis)
    .where(eq(wikis.lookupKey, wikiKey))
    .limit(1)

  if (!wiki) return { linked: 0, autoFiled: 0, llmFiled: 0, llmRejected: 0 }

  // If wiki has no embedding, generate one from name + prompt
  let wikiEmbedding = wiki.embedding
  if (!wikiEmbedding) {
    try {
      const orConfig = await loadOpenRouterConfig()
      const text = `${wiki.name} ${wiki.prompt ?? ''}`.trim()
      const vec = await embedText(text, {
        apiKey: orConfig.apiKey,
        model: orConfig.models.embedding,
      })
      if (vec) {
        wikiEmbedding = vec
        // Persist the embedding for future use
        await database
          .update(wikis)
          .set({ embedding: vec })
          .where(eq(wikis.lookupKey, wikiKey))
      }
    } catch (err) {
      log.warn({ wikiKey, err }, 'failed to generate wiki embedding for classification')
    }
  }

  if (!wikiEmbedding) {
    log.info({ wikiKey }, 'no wiki embedding available, skipping cosine pre-filter')
    return { linked: 0, autoFiled: 0, llmFiled: 0, llmRejected: 0 }
  }

  // Query unfiled fragments ordered by cosine similarity to this wiki
  // Only take those above LLM_REVIEW_THRESHOLD (similarity > 0.4 = distance < 0.6)
  const maxDistance = 1 - LLM_REVIEW_THRESHOLD
  const vecLiteral = JSON.stringify(wikiEmbedding)

  const candidates = await database
    .select({
      lookupKey: fragments.lookupKey,
      content: fragments.content,
      distance: sql<number>`${fragments.embedding} <=> ${vecLiteral}::vector`,
    })
    .from(fragments)
    .where(
      and(
        isNull(fragments.deletedAt),
        sql`${fragments.embedding} IS NOT NULL`,
        sql`${fragments.lookupKey} NOT IN (
          SELECT src_id FROM edges
          WHERE edge_type = 'FRAGMENT_IN_WIKI' AND deleted_at IS NULL
        )`,
        sql`${fragments.embedding} <=> ${vecLiteral}::vector < ${maxDistance}`
      )
    )
    .orderBy(sql`${fragments.embedding} <=> ${vecLiteral}::vector`)
    .limit(MAX_UNFILED_PER_REGEN)

  if (candidates.length === 0) return { linked: 0, autoFiled: 0, llmFiled: 0, llmRejected: 0 }

  let autoFiled = 0
  let llmFiled = 0
  let llmRejected = 0

  // Tier 1: Auto-file high-similarity fragments
  const autoFileFrags: typeof candidates = []
  const llmReviewFrags: typeof candidates = []

  for (const c of candidates) {
    const similarity = 1 - c.distance
    if (similarity >= AUTO_FILE_THRESHOLD) {
      autoFileFrags.push(c)
    } else {
      llmReviewFrags.push(c)
    }
  }

  // Auto-file: create edges directly
  for (const frag of autoFileFrags) {
    const similarity = 1 - frag.distance
    try {
      await database
        .insert(edges)
        .values({
          id: crypto.randomUUID(),
          srcType: 'fragment',
          srcId: frag.lookupKey,
          dstType: 'wiki',
          dstId: wikiKey,
          edgeType: 'FRAGMENT_IN_WIKI',
          attrs: { score: similarity, method: 'cosine-auto', signal: 'strong' },
        })
        .onConflictDoNothing()
      autoFiled++
      log.info(
        { fragmentKey: frag.lookupKey, wikiKey, similarity: similarity.toFixed(3), method: 'cosine-auto' },
        'regen classify: auto-filed (above threshold)'
      )
    } catch (err) {
      log.warn({ fragmentKey: frag.lookupKey, err }, 'failed to auto-file fragment')
    }
  }

  // Tier 2: LLM review for borderline fragments
  if (llmReviewFrags.length > 0) {
    const orConfig = await loadOpenRouterConfig()
    const agents = createIngestAgents(orConfig)

    const deps = {
      searchCandidates: async () => [{ wikiKey, score: 0 }],
      loadThreads: async (wikiKeys: string[]) => {
        if (wikiKeys.length === 0) return []
        const rows = await database
          .select({
            lookupKey: wikis.lookupKey,
            name: wikis.name,
            type: wikis.type,
            prompt: wikis.prompt,
          })
          .from(wikis)
          .where(
            sql`${wikis.lookupKey} = ANY(ARRAY[${sql.join(
              wikiKeys.map((k) => sql`${k}`),
              sql`, `
            )}])`
          )
        return rows
      },
      llmCall: createTypedCaller(agents.wikiClassifier, wikiClassificationSchema),
      emitEvent: async () => {},
    }

    for (const frag of llmReviewFrags) {
      const similarity = 1 - frag.distance
      try {
        const result = await wikiClassify(deps, {
          fragmentContent: frag.content,
          fragmentKey: frag.lookupKey,
          jobId: `regen-classify-${frag.lookupKey}`,
          entryKey: '',
        })

        // Log all raw scores
        for (const a of result.data.rawAssignments ?? []) {
          log.info(
            { fragmentKey: frag.lookupKey, wikiKey: a.wikiKey, confidence: a.confidence, cosineSimilarity: similarity.toFixed(3), reasoning: a.reasoning },
            'regen classify: LLM review score'
          )
        }

        if (result.data.wikiEdges.length > 0) {
          for (const edge of result.data.wikiEdges) {
            await database
              .insert(edges)
              .values({
                id: crypto.randomUUID(),
                srcType: 'fragment',
                srcId: frag.lookupKey,
                dstType: 'wiki',
                dstId: edge.wikiKey,
                edgeType: 'FRAGMENT_IN_WIKI',
                attrs: {
                  score: edge.score,
                  cosineSimilarity: similarity,
                  method: 'llm-review',
                  signal: edge.score >= STRONG_SIGNAL_THRESHOLD ? 'strong' : 'weak',
                },
              })
              .onConflictDoNothing()
            llmFiled++
          }
        } else {
          llmRejected++
          log.info(
            { fragmentKey: frag.lookupKey, wikiKey, cosineSimilarity: similarity.toFixed(3) },
            'regen classify: LLM rejected (below confidence threshold)'
          )
        }
      } catch (err) {
        log.warn({ fragmentKey: frag.lookupKey, err }, 'failed LLM classification for fragment')
      }
    }
  }

  const totalLinked = autoFiled + llmFiled
  log.info(
    { wikiKey, candidates: candidates.length, autoFiled, llmFiled, llmRejected, totalLinked },
    'unfiled fragment classification completed'
  )

  return { linked: totalLinked, autoFiled, llmFiled, llmRejected }
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
  const t0 = performance.now()
  const [wiki] = await database.select().from(wikis).where(eq(wikis.lookupKey, wikiKey))
  if (!wiki) throw new Error(`Wiki not found: ${wikiKey}`)

  // Classify unfiled fragments into this wiki before gathering (mechanism 1)
  const tClassify0 = performance.now()
  try {
    const classifyResult = await classifyUnfiledFragments(database, wikiKey)
    log.info({ wikiKey, linked: classifyResult.linked }, 'unfiled fragment classification completed')
  } catch (err) {
    log.warn({ wikiKey, err }, 'unfiled fragment classification failed — continuing with existing fragments')
  }
  const classifyMs = performance.now() - tClassify0

  const previousContent = wiki.content

  const orConfig = await loadOpenRouterConfig()
  const agents = createIngestAgents(orConfig)
  // Cast through `unknown` because Zod's `.default()` widens the schema's
  // input type but createTypedCaller is parameterised by the output type
  // (what the caller ultimately consumes).
  const callLlm = createTypedCaller(
    agents.wikiClassifier,
    regenOutputSchema as unknown as import('zod').ZodType<RegenOutput>,
  )

  // Gather linked fragments via FRAGMENT_IN_WIKI edges, with signal strength
  const tGather0 = performance.now()
  const fragmentEdgeRows = await database
    .select({ srcId: edges.srcId, attrs: edges.attrs })
    .from(edges)
    .where(
      and(
        eq(edges.dstId, wikiKey),
        eq(edges.edgeType, 'FRAGMENT_IN_WIKI'),
        isNull(edges.deletedAt)
      )
    )

  // Build a signal map: fragmentKey → 'strong' | 'weak' (default strong for legacy edges without attrs)
  const signalMap = new Map<string, 'strong' | 'weak'>()
  for (const e of fragmentEdgeRows) {
    const attrs = e.attrs as Record<string, unknown> | null
    const signal = (attrs?.signal === 'weak' ? 'weak' : 'strong') as 'strong' | 'weak'
    signalMap.set(e.srcId, signal)
  }

  const fragmentKeys = fragmentEdgeRows.map((e) => e.srcId)
  let fragmentsText = ''
  let fragmentCount = 0

  if (fragmentKeys.length > 0) {
    const fragRows = await database
      .select({
        lookupKey: fragments.lookupKey,
        slug: fragments.slug,
        title: fragments.title,
        content: fragments.content,
        createdAt: fragments.createdAt,
      })
      .from(fragments)
      .where(and(inArray(fragments.lookupKey, fragmentKeys), isNull(fragments.deletedAt)))

    // Sort: strong-signal fragments first, then weak
    fragRows.sort((a, b) => {
      const sigA = signalMap.get(a.lookupKey) === 'weak' ? 1 : 0
      const sigB = signalMap.get(b.lookupKey) === 'weak' ? 1 : 0
      return sigA - sigB
    })

    const strongFrags = fragRows.filter((f) => signalMap.get(f.lookupKey) !== 'weak')
    const weakFrags = fragRows.filter((f) => signalMap.get(f.lookupKey) === 'weak')

    fragmentCount = fragRows.length

    // Render each fragment with inline id/slug/captured header so the LLM
    // can emit grounded [[fragment:<slug>]] tokens and per-section
    // citationDeclarations whose fragmentIds reference real lookupKeys.
    const strongText = renderFragmentsBlock(
      strongFrags.map((f) => ({
        id: f.lookupKey,
        slug: f.slug,
        title: f.title,
        content: f.content,
        createdAt: f.createdAt,
      })),
    )
    const weakText = renderFragmentsBlock(
      weakFrags.map((f) => ({
        id: f.lookupKey,
        slug: f.slug,
        title: f.title,
        content: f.content,
        createdAt: f.createdAt,
      })),
    )

    if (weakFrags.length > 0 && strongFrags.length > 0) {
      fragmentsText = `${strongText}\n\n---\n[SUPPLEMENTARY FRAGMENTS — lower confidence, include as supporting context or "See also" references]\n\n${weakText}`
    } else {
      fragmentsText = strongText || weakText
    }
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

  const gatherMs = performance.now() - tGather0

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

  const tLlm0 = performance.now()
  const llmOutput = await callLlm(spec.system, spec.user)
  const llmMs = performance.now() - tLlm0
  const markdown = llmOutput.markdown
  const llmInfobox: WikiInfobox | null = llmOutput.infobox ?? null
  const llmCitations: WikiCitationDeclaration[] = llmOutput.citations ?? []

  // Merge LLM-emitted infobox into wikis.metadata (preserving any other
  // structured sidecar fields we may bundle into metadata in the future).
  const mergedMetadata: WikiMetadata = {
    ...((wiki.metadata as WikiMetadata | null) ?? {}),
    infobox: llmInfobox,
  }

  // Update wiki content + sidecar fields in a single statement so readers
  // never observe a stale infobox paired with fresh markdown.
  const now = new Date()
  await database
    .update(wikis)
    .set({
      content: markdown,
      metadata: mergedMetadata,
      citationDeclarations: llmCitations,
      lastRebuiltAt: now,
      updatedAt: now,
    })
    .where(eq(wikis.lookupKey, wikiKey))

  // Compute and store embedding for the new content
  const tEmbed0 = performance.now()
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
  const embedMs = performance.now() - tEmbed0
  const totalMs = performance.now() - t0

  const timing: RegenTiming = {
    classify: Math.round(classifyMs),
    gatherFragments: Math.round(gatherMs),
    llmCall: Math.round(llmMs),
    embed: Math.round(embedMs),
    total: Math.round(totalMs),
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
    detail: { wikiKey, fragmentCount, hasEmbedding, timing },
  })

  log.info({ wikiKey, fragmentCount, hasEmbedding, timing }, 'wiki regenerated')

  return { content: markdown, fragmentCount, hasEmbedding, timing }
}
