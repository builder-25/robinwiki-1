import { describe, it, expect, vi } from 'vitest'
import { persist } from '../stages/persist'
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
    content: 'Fragment content about testing',
    type: 'note',
    confidence: 0.9,
    sourceSpan: 'Fragment content about testing',
    suggestedSlug: 'testing-fragment',
    title: 'Testing Fragment',
    tags: ['test'],
    wikiLinks: [],
    ...overrides,
  }
}

const baseInput = {
  userId: 'user1',
  entryKey: 'entry01HTEST1234567890ABCDEF',
  entryContent: 'Original entry content for repoPath tests.',
  vaultId: 'vault1',
  source: 'web',
  primaryTopic: 'RepoPath test entry',
  jobId: 'job1',
}

// ── repoPath propagation ────────────────────────────────────────────────────

describe('persist repoPath propagation', () => {
  it('sets repoPath on insertEntry to entries/ directory', async () => {
    const deps = makeMockDeps()
    await persist(deps, { ...baseInput, fragments: [makeFragment()] })

    const entryCall = (deps.insertEntry as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(entryCall.repoPath).toMatch(/^entries\//)
    expect(entryCall.repoPath).toMatch(/\.md$/)
  })

  it('sets repoPath on insertFragment to fragments/ directory', async () => {
    const deps = makeMockDeps()
    await persist(deps, { ...baseInput, fragments: [makeFragment()] })

    expect(deps.insertFragment).toHaveBeenCalledTimes(1)
    const fragCall = (deps.insertFragment as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(fragCall.repoPath).toMatch(/^fragments\//)
    expect(fragCall.repoPath).toMatch(/\.md$/)
  })

  it('aligns each fragment repoPath with its batchWrite file path', async () => {
    const deps = makeMockDeps()
    const fragments = [
      makeFragment({ title: 'Alpha Fragment', suggestedSlug: 'alpha' }),
      makeFragment({ title: 'Beta Fragment', suggestedSlug: 'beta' }),
      makeFragment({ title: 'Gamma Fragment', suggestedSlug: 'gamma' }),
    ]

    await persist(deps, { ...baseInput, fragments })

    // Extract paths from batchWrite
    const batchCall = (deps.batchWrite as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const batchFragPaths = batchCall.files
      .filter((f: { path: string }) => f.path.startsWith('fragments/'))
      .map((f: { path: string }) => f.path)

    // Extract paths from insertFragment calls
    const insertFragCalls = (deps.insertFragment as ReturnType<typeof vi.fn>).mock.calls
    const insertFragPaths = insertFragCalls.map(
      (c: unknown[]) => (c[0] as Record<string, string>).repoPath
    )

    expect(insertFragCalls).toHaveLength(3)
    expect(batchFragPaths).toHaveLength(3)

    // Each insertFragment repoPath must match the corresponding batchWrite path
    for (let i = 0; i < 3; i++) {
      expect(insertFragPaths[i]).toBe(batchFragPaths[i])
    }
  })

  it('sets repoPath on insertPerson to people/ directory', async () => {
    const deps = makeMockDeps()
    const fragments = [
      makeFragment({ content: 'Met with Sarah today', sourceSpan: 'with Sarah' }),
    ]

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
    const personCall = (deps.insertPerson as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(personCall.repoPath).toMatch(/^people\//)
    expect(personCall.repoPath).toMatch(/\.md$/)
  })

  it('aligns person repoPath with its batchWrite file path', async () => {
    const deps = makeMockDeps()
    const fragments = [
      makeFragment({ content: 'Met with Sarah today', sourceSpan: 'with Sarah' }),
    ]

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
    const batchPersonPath = batchCall.files.find(
      (f: { path: string }) => f.path.startsWith('people/')
    )?.path

    const personCall = (deps.insertPerson as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(personCall.repoPath).toBe(batchPersonPath)
  })

  it('aligns entry repoPath with its batchWrite file path', async () => {
    const deps = makeMockDeps()
    await persist(deps, { ...baseInput, fragments: [makeFragment()] })

    const batchCall = (deps.batchWrite as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const batchEntryPath = batchCall.files.find(
      (f: { path: string }) => f.path.startsWith('entries/')
    )?.path

    const entryCall = (deps.insertEntry as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(entryCall.repoPath).toBe(batchEntryPath)
  })

  it('sets distinct repoPath for multiple people', async () => {
    const deps = makeMockDeps()
    const fragments = [
      makeFragment({
        content: 'Sarah and Bob discussed the project',
        sourceSpan: 'Sarah and Bob discussed',
      }),
    ]

    await persist(deps, {
      ...baseInput,
      fragments,
      newPeople: [
        { personKey: 'person01HAAA1111222233334444', canonicalName: 'Sarah Ouma', verified: false },
        { personKey: 'person01HBBB5555666677778888', canonicalName: 'Bob Smith', verified: false },
      ],
      peopleMap: new Map([
        ['Sarah', 'person01HAAA1111222233334444'],
        ['Bob', 'person01HBBB5555666677778888'],
      ]),
      extractions: [
        { mention: 'Sarah', sourceSpan: 'Sarah and Bob' },
        { mention: 'Bob', sourceSpan: 'Sarah and Bob' },
      ],
      entityExtractionStatus: 'completed' as const,
    })

    expect(deps.insertPerson).toHaveBeenCalledTimes(2)
    const p1 = (deps.insertPerson as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const p2 = (deps.insertPerson as ReturnType<typeof vi.fn>).mock.calls[1][0]

    expect(p1.repoPath).toMatch(/^people\//)
    expect(p2.repoPath).toMatch(/^people\//)
    expect(p1.repoPath).not.toBe(p2.repoPath)
  })

  it('entry repoPath uses entries/ not var/raw/', async () => {
    const deps = makeMockDeps()
    await persist(deps, { ...baseInput, fragments: [makeFragment()] })

    const entryCall = (deps.insertEntry as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(entryCall.repoPath).not.toMatch(/^var\//)
    expect(entryCall.repoPath).not.toMatch(/^notes\//)
    expect(entryCall.repoPath).toMatch(/^entries\//)
  })
})
