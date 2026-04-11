import {
  makeLookupKey,
  parseLookupKey,
  composeFilename,
  generateSlug,
  parseWikiLinks,
  resolveWikiLinks,
} from '@robin/shared'
import type { StageResult, PersistDeps, PersistResult, FragmentResult } from './types.js'
import {
  assembleEntryFrontmatter,
  assembleFragmentFrontmatter,
  assemblePersonFrontmatter,
} from '../frontmatter.js'

// ── SourceSpan Matching ─────────────────────────────────────────────────────

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

// ── Persist Stage ───────────────────────────────────────────────────────────

/**
 * Persist stage.
 * Assembles entry + fragment + person markdown files with mechanical frontmatter (no LLM),
 * commits via batch write, then inserts DB rows and edges.
 */
export async function persist(
  deps: PersistDeps,
  input: {
    userId: string
    entryKey: string
    entryContent: string
    vaultId: string
    source: string
    fragments: FragmentResult[]
    primaryTopic: string
    jobId: string
    // Entity extraction results (optional for backwards compat)
    peopleMap?: Map<string, string>
    newAliases?: Map<string, string[]>
    extractions?: Array<{ mention: string; sourceSpan: string }>
    newPeople?: Array<{ personKey: string; canonicalName: string; verified: boolean }>
    entityExtractionStatus?: 'completed' | 'failed'
  }
): Promise<StageResult<PersistResult>> {
  const start = performance.now()

  const { ulid: entryUlid } = parseLookupKey(input.entryKey)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const entrySlug = generateSlug(input.primaryTopic)

  // -- Match mentions to fragments for personKeys population --
  const fragmentPersonKeys =
    input.extractions && input.peopleMap && input.peopleMap.size > 0
      ? matchMentionsToFragments(input.extractions, input.fragments, input.peopleMap)
      : new Map<number, string[]>()

  // -- Entry markdown --
  const entryFilename = composeFilename({
    date: today,
    slug: entrySlug,
    type: 'entry',
    ulid: entryUlid,
  })

  // Collect all fragment keys first (needed for entry frontmatter)
  // Fragment keys will be populated in the loop below
  const allFragmentKeys: string[] = []

  // Collect all person keys associated with any fragment for entry-level personKeys
  const allPersonKeysSet = new Set<string>()
  for (const pKeys of fragmentPersonKeys.values()) {
    for (const pk of pKeys) allPersonKeysSet.add(pk)
  }

  // Resolve wiki-links for entry body
  const entryBodyParsed = parseWikiLinks(input.entryContent)
  const entryWikiResult = deps.lookupFn
    ? await resolveWikiLinks(entryBodyParsed, deps.lookupFn)
    : { resolved: [], broken: [] }

  const entryFrontmatter = assembleEntryFrontmatter({
    title: input.primaryTopic,
    date: today,
    vaultId: input.vaultId,
    source: input.source,
    status: 'PENDING',
    fragmentKeys: [], // Will be updated after fragment keys are generated
    personKeys: [...allPersonKeysSet],
    wikiLinks: entryWikiResult.resolved,
    brokenLinks: entryWikiResult.broken,
  })

  const entryMarkdown = `${entryFrontmatter}\n${input.entryContent}`

  // -- Fragment markdown --
  const fragmentFiles: Array<{ path: string; content: string }> = []
  const fragmentKeys: string[] = []

  for (let i = 0; i < input.fragments.length; i++) {
    const frag = input.fragments[i]
    const fragKey = makeLookupKey('frag')
    const { ulid: fragUlid } = parseLookupKey(fragKey)
    fragmentKeys.push(fragKey)

    const fragSlug = frag.suggestedSlug || generateSlug(frag.title)
    const fragFilename = composeFilename({
      date: today,
      slug: fragSlug,
      type: 'frag',
      ulid: fragUlid,
    })

    // Build personKeys for this fragment
    const matchedPersonKeys = fragmentPersonKeys.get(i) ?? []
    const extractionStatus = input.entityExtractionStatus ?? 'completed'

    const fragBody = `${frag.content}\n\n> Source: [[${entrySlug}]]`

    // Parse and resolve wiki-links from body text for frontmatter
    const bodyWikiLinks = parseWikiLinks(fragBody)
    const fragWikiResult = deps.lookupFn
      ? await resolveWikiLinks(bodyWikiLinks, deps.lookupFn)
      : { resolved: [], broken: [] }

    const fragFrontmatter = assembleFragmentFrontmatter({
      title: frag.title,
      type: frag.type,
      date: today,
      tags: frag.tags,
      entryKey: input.entryKey,
      vaultId: input.vaultId,
      wikiKeys: [],
      personKeys: matchedPersonKeys,
      relatedFragmentKeys: [],
      status: 'PENDING',
      confidence: frag.confidence,
      sourceSpan: frag.sourceSpan,
      suggestedSlug: fragSlug,
      wikiLinks: fragWikiResult.resolved,
      brokenLinks: fragWikiResult.broken,
      entityExtractionStatus: extractionStatus,
    })

    fragmentFiles.push({
      path: `fragments/${fragFilename}`,
      content: `${fragFrontmatter}\n${fragBody}`,
    })
  }

  // -- Person markdown files for new people --
  const personFiles: Array<{ path: string; content: string }> = []

  if (input.newPeople && input.newPeople.length > 0) {
    for (const person of input.newPeople) {
      const { ulid: personUlid } = parseLookupKey(person.personKey)
      const personSlug = generateSlug(person.canonicalName)
      const personFilename = composeFilename({
        date: today,
        slug: personSlug,
        type: 'person',
        ulid: personUlid,
      })

      // Find fragment keys associated with this person
      const associatedFragKeys: string[] = []
      for (const [fragIdx, pKeys] of fragmentPersonKeys.entries()) {
        if (pKeys.includes(person.personKey)) {
          associatedFragKeys.push(fragmentKeys[fragIdx])
        }
      }

      const personFm = assemblePersonFrontmatter({
        type: 'person',
        state: 'RESOLVED',
        verified: person.verified,
        canonicalName: person.canonicalName,
        aliases: [],
        fragmentKeys: associatedFragKeys,
        lastRebuiltAt: null,
        wikiLinks: [], // New people have no body text to resolve
        brokenLinks: [],
      })

      personFiles.push({
        path: `people/${personFilename}`,
        content: personFm,
      })
    }
  }

  // -- Handle alias updates for existing people --
  const aliasUpdateFiles: Array<{ path: string; content: string }> = []

  if (input.newAliases && input.newAliases.size > 0) {
    for (const [personKey, newAliases] of input.newAliases.entries()) {
      const existingPerson = await deps.loadPersonByKey(personKey)
      if (!existingPerson) continue

      const existingSections = existingPerson.sections as {
        canonicalName?: string
        aliases?: string[]
        verified?: boolean
        fragmentKeys?: string[]
      }

      const existingAliases = existingSections.aliases ?? []

      // Case-insensitive dedup: merge existing + new, keep original casing
      const seenLower = new Set(existingAliases.map((a) => a.toLowerCase()))
      const mergedAliases = [...existingAliases]
      for (const alias of newAliases) {
        const lower = alias.toLowerCase()
        if (!seenLower.has(lower)) {
          seenLower.add(lower)
          mergedAliases.push(alias)
        }
      }

      // Find fragment keys associated with this person
      const associatedFragKeys: string[] = []
      for (const [fragIdx, pKeys] of fragmentPersonKeys.entries()) {
        if (pKeys.includes(personKey)) {
          associatedFragKeys.push(fragmentKeys[fragIdx])
        }
      }
      const allFragKeys = [...(existingSections.fragmentKeys ?? []), ...associatedFragKeys]

      const updatedPersonFm = assemblePersonFrontmatter({
        type: 'person',
        state: 'RESOLVED',
        verified: existingSections.verified ?? false,
        canonicalName: existingSections.canonicalName ?? existingPerson.name,
        aliases: mergedAliases,
        fragmentKeys: allFragKeys,
        lastRebuiltAt: null,
        wikiLinks: [],
        brokenLinks: [],
      })

      aliasUpdateFiles.push({
        path: existingPerson.repoPath,
        content: updatedPersonFm,
      })
    }
  }

  // -- Batch write all files atomically --
  const allFiles = [
    { path: `entries/${entryFilename}`, content: entryMarkdown },
    ...fragmentFiles,
    ...personFiles,
    ...aliasUpdateFiles,
  ]

  const { commitHash } = await deps.batchWrite({
    userId: input.userId,
    files: allFiles,
    message: `ingest: ${input.primaryTopic}`,
    branch: 'main',
  })

  // -- DB inserts --
  await deps.insertEntry({
    lookupKey: input.entryKey,
    userId: input.userId,
    slug: entrySlug,
    title: input.primaryTopic,
    content: input.entryContent,
    source: input.source,
    vaultId: input.vaultId,
    state: 'PENDING',
    repoPath: `entries/${entryFilename}`,
  })

  for (let i = 0; i < input.fragments.length; i++) {
    const frag = input.fragments[i]
    const fragKey = fragmentKeys[i]
    await deps.insertFragment({
      lookupKey: fragKey,
      userId: input.userId,
      slug: frag.suggestedSlug || generateSlug(frag.title),
      title: frag.title,
      content: frag.content,
      type: frag.type,
      entryId: input.entryKey,
      vaultId: input.vaultId,
      tags: frag.tags,
      state: 'PENDING',
      repoPath: fragmentFiles[i].path,
    })
  }

  // -- Person DB inserts for new people --
  if (input.newPeople && input.newPeople.length > 0) {
    for (let pi = 0; pi < input.newPeople.length; pi++) {
      const person = input.newPeople[pi]
      const personSlug = generateSlug(person.canonicalName)
      const associatedFragKeys: string[] = []
      for (const [fragIdx, pKeys] of fragmentPersonKeys.entries()) {
        if (pKeys.includes(person.personKey)) {
          associatedFragKeys.push(fragmentKeys[fragIdx])
        }
      }

      await deps.insertPerson({
        lookupKey: person.personKey,
        userId: input.userId,
        slug: personSlug,
        name: person.canonicalName,
        state: 'RESOLVED',
        repoPath: personFiles[pi].path,
        sections: {
          canonicalName: person.canonicalName,
          aliases: [],
          verified: person.verified,
          fragmentKeys: associatedFragKeys,
        },
      })
    }
  }

  // -- Edges: ENTRY_IN_VAULT and ENTRY_HAS_FRAGMENT --
  await deps.insertEdge({
    srcType: 'entry',
    srcId: input.entryKey,
    dstType: 'vault',
    dstId: input.vaultId,
    edgeType: 'ENTRY_IN_VAULT',
  })

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
      await deps.insertEdge({
        srcType: 'fragment',
        srcId: fragKey,
        dstType: 'person',
        dstId: personKey,
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
      commitHash,
      personCount: input.newPeople?.length ?? 0,
    },
  })

  return {
    data: { entryKey: input.entryKey, fragmentKeys, commitHash },
    durationMs: performance.now() - start,
  }
}
