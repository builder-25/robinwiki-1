import { eq, ne, and, inArray, desc, isNull } from 'drizzle-orm'
import { createIngestAgents, createStringCaller, embedText } from '@robin/agent'
import { loadWikiGenerationSpec } from '@robin/shared'
import type { WikiType } from '@robin/shared'
import { db as defaultDb, type DB } from '../db/client.js'
import { wikis, wikiTypes, edges, fragments, edits } from '../db/schema.js'
import { loadOpenRouterConfigFromDb } from './openrouter-config.js'
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

  const orConfig = await loadOpenRouterConfigFromDb(database)
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

  // Gather related wikis for cross-linking context
  const otherWikis = await database
    .select({ name: wikis.name, slug: wikis.slug, type: wikis.type })
    .from(wikis)
    .where(and(ne(wikis.lookupKey, wikiKey), isNull(wikis.deletedAt)))
    .limit(20)

  const relatedWikisText = otherWikis.length > 0
    ? otherWikis.map((w) => `- ${w.slug} (${w.type}): ${w.name}`).join('\n')
    : undefined

  // Resolve custom prompt override: wiki-level > type-level > YAML default
  let customPrompt: string | undefined
  if (wiki.prompt) {
    customPrompt = wiki.prompt
  } else {
    const [wikiType] = await database
      .select({ prompt: wikiTypes.prompt })
      .from(wikiTypes)
      .where(and(eq(wikiTypes.slug, wiki.type), eq(wikiTypes.userModified, true)))
    if (wikiType?.prompt) {
      customPrompt = wikiType.prompt
    }
  }

  // Load prompt spec and call LLM
  const spec = loadWikiGenerationSpec(wiki.type as WikiType, {
    fragments: fragmentsText,
    title: wiki.name,
    date: new Date().toISOString().split('T')[0],
    count: fragmentCount,
    existingWiki: previousContent || undefined,
    edits: editsSummary,
    relatedWikis: relatedWikisText,
  }, customPrompt)

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
      model: orConfig.embeddingModel,
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
