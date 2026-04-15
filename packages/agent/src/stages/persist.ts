import { makeLookupKey, generateSlug } from '@robin/shared'
import type { StageResult, PersistDeps, PersistResult, FragmentResult } from './types.js'
import { embedText } from '../embeddings.js'

/**
 * Match mention extractions to fragments by checking if the extraction's
 * sourceSpan or mention text appears in each fragment's content or sourceSpan.
 * Returns Map<fragmentIndex, personKeys[]> with deduplication.
 */
export function matchMentionsToFragments(
  extractions: Array<{ mention: string; sourceSpan: string }>,
  fragments: FragmentResult[],
  peopleMap: Map<string, string>
): Map<number, string[]> {
  const result = new Map<number, string[]>()

  for (const extraction of extractions) {
    const personKey = peopleMap.get(extraction.mention)
    if (!personKey) continue

    for (let i = 0; i < fragments.length; i++) {
      const frag = fragments[i]
      const haystack = `${frag.content}\n${frag.sourceSpan}`

      const matched =
        haystack.includes(extraction.sourceSpan) || haystack.includes(extraction.mention)

      if (matched) {
        const existing = result.get(i) ?? []
        if (!existing.includes(personKey)) {
          existing.push(personKey)
          result.set(i, existing)
        }
      }
    }
  }

  return result
}

/**
 * Persist stage — pure Postgres.
 * Inserts entry, fragments (with embeddings), people (upserted by canonical_name),
 * and all edges. No markdown assembly, no git writes.
 */
export async function persist(
  deps: PersistDeps,
  input: {
    entryKey: string
    entryContent: string
    vaultId: string
    source: string
    fragments: FragmentResult[]
    primaryTopic: string
    jobId: string
    peopleMap?: Map<string, string>
    newAliases?: Map<string, string[]>
    extractions?: Array<{ mention: string; sourceSpan: string }>
    newPeople?: Array<{ personKey: string; canonicalName: string; verified: boolean }>
    entityExtractionStatus?: 'completed' | 'failed'
  }
): Promise<StageResult<PersistResult>> {
  const start = performance.now()

  // Resolve per-fragment person matches
  const fragmentPersonKeys =
    input.extractions && input.peopleMap && input.peopleMap.size > 0
      ? matchMentionsToFragments(input.extractions, input.fragments, input.peopleMap)
      : new Map<number, string[]>()

  // -- Entry insert --
  const entrySlug = generateSlug(input.primaryTopic)
  await deps.insertEntry({
    lookupKey: input.entryKey,
    slug: entrySlug,
    title: input.primaryTopic,
    content: input.entryContent,
    source: input.source,
    vaultId: input.vaultId,
    state: 'PENDING',
  })

  // -- Fragment inserts --
  const fragmentKeys: string[] = input.fragments.map(() => makeLookupKey('frag'))
  for (let i = 0; i < input.fragments.length; i++) {
    const frag = input.fragments[i]
    await deps.insertFragment({
      lookupKey: fragmentKeys[i],
      slug: frag.suggestedSlug || generateSlug(frag.title),
      title: frag.title,
      content: frag.content,
      type: frag.type,
      entryId: input.entryKey,
      vaultId: input.vaultId,
      tags: frag.tags,
      state: 'PENDING',
    })
  }

  // -- Fragment embeddings (best-effort, parallel) --
  const embedConfig = {
    apiKey: deps.openRouterConfig.apiKey,
    model: deps.openRouterConfig.embeddingModel,
  }
  const vectors = await Promise.all(
    input.fragments.map((frag) => embedText(frag.content, embedConfig))
  )
  await Promise.all(
    vectors.map((vec, i) =>
      vec ? deps.updateFragmentEmbedding(fragmentKeys[i], vec) : Promise.resolve()
    )
  )

  // -- Person upserts for new people --
  const personKeyRemap = new Map<string, string>()
  if (input.newPeople && input.newPeople.length > 0) {
    for (const person of input.newPeople) {
      const { personKey, isNew } = await deps.upsertPerson({
        personKey: person.personKey,
        canonicalName: person.canonicalName,
        verified: person.verified,
      })
      if (personKey !== person.personKey) {
        personKeyRemap.set(person.personKey, personKey)
      }
      if (isNew && deps.onPersonCreated) {
        deps.onPersonCreated(personKey, person.canonicalName)
      }
    }
  }

  // -- Merge aliases into existing people --
  if (input.newAliases && input.newAliases.size > 0) {
    for (const [personKey, aliases] of input.newAliases.entries()) {
      const resolved = personKeyRemap.get(personKey) ?? personKey
      await deps.mergePersonAliases(resolved, aliases)
    }
  }

  // -- Edges: ENTRY_IN_VAULT --
  await deps.insertEdge({
    srcType: 'entry',
    srcId: input.entryKey,
    dstType: 'vault',
    dstId: input.vaultId,
    edgeType: 'ENTRY_IN_VAULT',
  })

  // -- Edges: ENTRY_HAS_FRAGMENT, FRAGMENT_IN_VAULT --
  for (const fragKey of fragmentKeys) {
    await deps.insertEdge({
      srcType: 'entry',
      srcId: input.entryKey,
      dstType: 'fragment',
      dstId: fragKey,
      edgeType: 'ENTRY_HAS_FRAGMENT',
    })
    await deps.insertEdge({
      srcType: 'fragment',
      srcId: fragKey,
      dstType: 'vault',
      dstId: input.vaultId,
      edgeType: 'FRAGMENT_IN_VAULT',
    })
  }

  // -- Edges: FRAGMENT_MENTIONS_PERSON --
  for (const [fragIdx, personKeys] of fragmentPersonKeys.entries()) {
    const fragKey = fragmentKeys[fragIdx]
    for (const personKey of personKeys) {
      const resolved = personKeyRemap.get(personKey) ?? personKey
      await deps.insertEdge({
        srcType: 'fragment',
        srcId: fragKey,
        dstType: 'person',
        dstId: resolved,
        edgeType: 'FRAGMENT_MENTIONS_PERSON',
      })
    }
  }

  await deps.emitEvent({
    entryKey: input.entryKey,
    jobId: input.jobId,
    stage: 'persist',
    status: 'completed',
    metadata: {
      fragmentCount: fragmentKeys.length,
      personCount: input.newPeople?.length ?? 0,
    },
  })

  return {
    data: { entryKey: input.entryKey, fragmentKeys },
    durationMs: performance.now() - start,
  }
}
