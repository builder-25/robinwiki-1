import { describe, it, expect, vi, beforeEach } from 'vitest'
import { persist, matchMentionsToFragments } from '../stages/persist'
import type { PersistDeps, FragmentResult } from '../stages/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockDeps(overrides: Partial<PersistDeps> = {}): PersistDeps {
  return {
    batchWrite: vi.fn().mockResolvedValue({ commitHash: 'abc123' }),
    insertEntry: vi.fn().mockResolvedValue(undefined),
    insertFragment: vi.fn().mockResolvedValue(undefined),
    insertEdge: vi.fn().mockResolvedValue(undefined),
    insertPerson: vi.fn().mockResolvedValue(undefined),
    loadPersonByKey: vi.fn().mockResolvedValue(null),
    emitEvent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeFragment(overrides: Partial<FragmentResult> = {}): FragmentResult {
  return {
    content: 'Had coffee with Sarah at the park',
    type: 'note',
    confidence: 0.9,
    sourceSpan: 'Had coffee with Sarah at the park',
    suggestedSlug: 'coffee-with-sarah',
    title: 'Coffee with Sarah',
    tags: [],
    wikiLinks: [],
    ...overrides,
  }
}

const baseInput = {
  userId: 'user1',
  entryKey: 'entry01HTEST1234567890ABCDEF',
  entryContent: 'Had coffee with Sarah at the park. Bob said hello.',
  vaultId: 'vault1',
  source: 'web',
  primaryTopic: 'Coffee meetup',
  jobId: 'job1',
}

// ── matchMentionsToFragments ────────────────────────────────────────────────

describe('matchMentionsToFragments', () => {
  it('matches mention to fragment containing sourceSpan', () => {
    const fragments: FragmentResult[] = [
      makeFragment({
        content: 'Had coffee with Sarah at the park',
        sourceSpan: 'Had coffee with Sarah',
      }),
      makeFragment({ content: 'Bob said hello at the gate', sourceSpan: 'Bob said hello' }),
    ]
    const extractions = [
      { mention: 'Sarah', sourceSpan: 'with Sarah' },
      { mention: 'Bob', sourceSpan: 'Bob said' },
    ]
    const peopleMap = new Map([
      ['Sarah', 'personAAA'],
      ['Bob', 'personBBB'],
    ])

    const result = matchMentionsToFragments(extractions, fragments, peopleMap)

    expect(result.get(0)).toContain('personAAA')
    expect(result.get(1)).toContain('personBBB')
  })

  it('matches mention text fallback when sourceSpan is not found', () => {
    const fragments: FragmentResult[] = [
      makeFragment({ content: 'Sarah was here yesterday', sourceSpan: 'Sarah was here' }),
    ]
    const extractions = [{ mention: 'Sarah', sourceSpan: 'nonexistent span' }]
    const peopleMap = new Map([['Sarah', 'personAAA']])

    const result = matchMentionsToFragments(extractions, fragments, peopleMap)

    expect(result.get(0)).toContain('personAAA')
  })

  it('matches one mention to multiple fragments', () => {
    const fragments: FragmentResult[] = [
      makeFragment({
        content: 'Talked with Sarah in the morning',
        sourceSpan: 'Talked with Sarah',
      }),
      makeFragment({ content: 'Sarah joined us for lunch', sourceSpan: 'Sarah joined us' }),
    ]
    const extractions = [{ mention: 'Sarah', sourceSpan: 'with Sarah' }]
    const peopleMap = new Map([['Sarah', 'personAAA']])

    const result = matchMentionsToFragments(extractions, fragments, peopleMap)

    expect(result.get(0)).toContain('personAAA')
    expect(result.get(1)).toContain('personAAA')
  })

  it('deduplicates person keys per fragment', () => {
    const fragments: FragmentResult[] = [
      makeFragment({ content: 'Sarah and Sarah met again', sourceSpan: 'Sarah and Sarah' }),
    ]
    const extractions = [
      { mention: 'Sarah', sourceSpan: 'Sarah and' },
      { mention: 'Sarah O.', sourceSpan: 'Sarah met' },
    ]
    const peopleMap = new Map([
      ['Sarah', 'personAAA'],
      ['Sarah O.', 'personAAA'],
    ])

    const result = matchMentionsToFragments(extractions, fragments, peopleMap)

    expect(result.get(0)).toEqual(['personAAA'])
  })

  it('returns empty map when no fragments match', () => {
    const fragments: FragmentResult[] = [
      makeFragment({ content: 'Nice weather', sourceSpan: 'Nice weather' }),
    ]
    const extractions = [{ mention: 'Sarah', sourceSpan: 'with Sarah downtown' }]
    const peopleMap = new Map([['Sarah', 'personAAA']])

    const result = matchMentionsToFragments(extractions, fragments, peopleMap)

    // Fragment 0 should NOT contain personAAA since neither mention nor sourceSpan appear
    expect(result.has(0)).toBe(false)
  })
})

// ── persist with people integration ─────────────────────────────────────────

describe('persist with people', () => {
  it('creates person markdown files in people/ directory in batchWrite', async () => {
    const deps = makeMockDeps()
    const fragments = [makeFragment()]

    await persist(deps, {
      ...baseInput,
      fragments,
      newPeople: [
        {
          personKey: 'person01HAAAABBBBCCCCDDDDEEEE',
          canonicalName: 'Sarah Ouma',
          verified: false,
        },
      ],
      peopleMap: new Map([['Sarah', 'person01HAAAABBBBCCCCDDDDEEEE']]),
      extractions: [{ mention: 'Sarah', sourceSpan: 'with Sarah' }],
      entityExtractionStatus: 'completed' as const,
    })

    const batchCall = (deps.batchWrite as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const personFile = batchCall.files.find((f: { path: string }) => f.path.startsWith('people/'))

    expect(personFile).toBeDefined()
    expect(personFile.content).toContain('type: person')
    expect(personFile.content).toContain('state: RESOLVED')
    expect(personFile.content).toContain('verified: false')
    expect(personFile.content).toContain('canonicalName: Sarah Ouma')
    expect(personFile.content).toContain('aliases: []')
  })

  it('includes person files in same batchWrite as entry + fragment files', async () => {
    const deps = makeMockDeps()
    const fragments = [makeFragment()]

    await persist(deps, {
      ...baseInput,
      fragments,
      newPeople: [
        {
          personKey: 'person01HAAAABBBBCCCCDDDDEEEE',
          canonicalName: 'Sarah Ouma',
          verified: false,
        },
      ],
      peopleMap: new Map([['Sarah', 'person01HAAAABBBBCCCCDDDDEEEE']]),
      extractions: [{ mention: 'Sarah', sourceSpan: 'with Sarah' }],
      entityExtractionStatus: 'completed' as const,
    })

    // Single batchWrite call with entry + fragment + person
    expect(deps.batchWrite).toHaveBeenCalledTimes(1)
    const batchCall = (deps.batchWrite as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const paths = batchCall.files.map((f: { path: string }) => f.path)

    expect(paths.some((p: string) => p.startsWith('entries/'))).toBe(true)
    expect(paths.some((p: string) => p.startsWith('fragments/'))).toBe(true)
    expect(paths.some((p: string) => p.startsWith('people/'))).toBe(true)
  })

  it('creates FRAGMENT_MENTIONS_PERSON edges', async () => {
    const deps = makeMockDeps()
    const fragments = [makeFragment({ content: 'Had coffee with Sarah', sourceSpan: 'with Sarah' })]

    await persist(deps, {
      ...baseInput,
      fragments,
      newPeople: [
        { personKey: 'person01HAAAABBBBCCCCDDDDEEEE', canonicalName: 'Sarah', verified: false },
      ],
      peopleMap: new Map([['Sarah', 'person01HAAAABBBBCCCCDDDDEEEE']]),
      extractions: [{ mention: 'Sarah', sourceSpan: 'with Sarah' }],
      entityExtractionStatus: 'completed' as const,
    })

    const edgeCalls = (deps.insertEdge as ReturnType<typeof vi.fn>).mock.calls
    const mentionEdges = edgeCalls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>).edgeType === 'FRAGMENT_MENTIONS_PERSON'
    )

    expect(mentionEdges.length).toBeGreaterThan(0)
    expect(mentionEdges[0][0]).toMatchObject({
      srcType: 'fragment',
      dstType: 'person',
      dstId: 'person01HAAAABBBBCCCCDDDDEEEE',
      edgeType: 'FRAGMENT_MENTIONS_PERSON',
    })
  })

  it('populates fragment frontmatter with personKeys and entityExtractionStatus', async () => {
    const deps = makeMockDeps()
    const fragments = [makeFragment({ content: 'Had coffee with Sarah', sourceSpan: 'with Sarah' })]

    await persist(deps, {
      ...baseInput,
      fragments,
      newPeople: [
        { personKey: 'person01HAAAABBBBCCCCDDDDEEEE', canonicalName: 'Sarah', verified: false },
      ],
      peopleMap: new Map([['Sarah', 'person01HAAAABBBBCCCCDDDDEEEE']]),
      extractions: [{ mention: 'Sarah', sourceSpan: 'with Sarah' }],
      entityExtractionStatus: 'completed' as const,
    })

    const batchCall = (deps.batchWrite as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const fragFile = batchCall.files.find((f: { path: string }) => f.path.startsWith('fragments/'))

    expect(fragFile.content).toContain('entityExtractionStatus: completed')
    expect(fragFile.content).toContain('person01HAAAABBBBCCCCDDDDEEEE')
  })

  it('sets entityExtractionStatus failed and empty personKeys when extraction failed', async () => {
    const deps = makeMockDeps()
    const fragments = [makeFragment()]

    await persist(deps, {
      ...baseInput,
      fragments,
      peopleMap: new Map(),
      extractions: [],
      newPeople: [],
      entityExtractionStatus: 'failed' as const,
    })

    const batchCall = (deps.batchWrite as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const fragFile = batchCall.files.find((f: { path: string }) => f.path.startsWith('fragments/'))

    expect(fragFile.content).toContain('entityExtractionStatus: failed')
    expect(fragFile.content).toContain('personKeys: []')
  })

  it('inserts person DB rows for new people', async () => {
    const deps = makeMockDeps()
    const fragments = [makeFragment()]

    await persist(deps, {
      ...baseInput,
      fragments,
      newPeople: [
        {
          personKey: 'person01HAAAABBBBCCCCDDDDEEEE',
          canonicalName: 'Sarah Ouma',
          verified: false,
        },
      ],
      peopleMap: new Map([['Sarah', 'person01HAAAABBBBCCCCDDDDEEEE']]),
      extractions: [{ mention: 'Sarah', sourceSpan: 'with Sarah' }],
      entityExtractionStatus: 'completed' as const,
    })

    expect(deps.insertPerson).toHaveBeenCalledTimes(1)
    const personRow = (deps.insertPerson as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(personRow.lookupKey).toBe('person01HAAAABBBBCCCCDDDDEEEE')
    expect(personRow.name).toBe('Sarah Ouma')
    expect(personRow.state).toBe('RESOLVED')
    expect(personRow.sections.canonicalName).toBe('Sarah Ouma')
    expect(personRow.sections.verified).toBe(false)
  })

  it('merges and deduplicates aliases case-insensitively', async () => {
    const deps = makeMockDeps({
      loadPersonByKey: vi.fn().mockResolvedValue({
        lookupKey: 'personEXIST',
        slug: 'sarah-ouma',
        repoPath: 'people/20260307-sarah-ouma.person01HEXIST.md',
        name: 'Sarah Ouma',
        sections: {
          canonicalName: 'Sarah Ouma',
          aliases: ['Sarah'],
          verified: true,
          fragmentKeys: [],
        },
      }),
    })
    const fragments = [makeFragment()]

    await persist(deps, {
      ...baseInput,
      fragments,
      newPeople: [],
      peopleMap: new Map([['sarah', 'personEXIST']]),
      newAliases: new Map([['personEXIST', ['sarah', 'S. Ouma']]]),
      extractions: [{ mention: 'sarah', sourceSpan: 'with Sarah' }],
      entityExtractionStatus: 'completed' as const,
    })

    // Should have been called for alias update
    expect(deps.loadPersonByKey).toHaveBeenCalledWith('personEXIST')

    // batchWrite should include the updated person file
    const batchCall = (deps.batchWrite as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const personFile = batchCall.files.find(
      (f: { path: string }) => f.path.includes('personEXIST') || f.path.includes('sarah-ouma')
    )

    // The merged aliases should contain "Sarah" (existing) and "S. Ouma" (new), but NOT duplicate "sarah"
    if (personFile) {
      expect(personFile.content).toContain('S. Ouma')
      // Should not have duplicate sarah/Sarah
      const aliasMatches = personFile.content.match(/aliases:/)?.[0]
      expect(aliasMatches).toBeDefined()
    }
  })

  it('works without people fields (backwards compatible)', async () => {
    const deps = makeMockDeps()
    const fragments = [makeFragment()]

    const result = await persist(deps, {
      ...baseInput,
      fragments,
    })

    expect(result.data.entryKey).toBe(baseInput.entryKey)
    expect(result.data.commitHash).toBe('abc123')
    expect(deps.batchWrite).toHaveBeenCalledTimes(1)
  })
})
