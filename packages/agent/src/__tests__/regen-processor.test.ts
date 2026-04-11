import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processRegenJob } from '../regen/processor'
import type { RegenDeps } from '../regen/types'

// Only mock the LLM boundary — everything else uses real code with injected deps
vi.mock('../agents/wiki-generator.js', () => ({
  wikiGenerateCall: vi.fn().mockResolvedValue('# Fitness\n\nGenerated wiki content.'),
}))

vi.mock('../agents/person-synthesizer.js', () => ({
  personSynthesizeCall: vi.fn().mockResolvedValue('## Who They Are\nTest person.'),
}))

// ── Dep builders ────────────────────────────────────────────────────────────

function makeThreadDeps(overrides: Partial<RegenDeps> = {}): RegenDeps {
  return {
    loadThread: vi.fn().mockResolvedValue({
      lookupKey: 'thread01HZY3Q9R3TSV4RRFFQ69G5FAV',
      name: 'Fitness',
      type: 'log',
      slug: 'fitness',
      repoPath: '',
      prompt: '',
    }),
    loadFragmentContents: vi
      .fn()
      .mockResolvedValue([{ lookupKey: 'frag-1', content: 'Did a 5k run today.' }]),
    loadPersonWithFragments: vi.fn(),
    acquireLock: vi.fn().mockResolvedValue(true),
    releaseLock: vi.fn(),
    canRebuildThread: vi.fn().mockResolvedValue(true),
    batchWrite: vi.fn(),
    updateAfterRegen: vi.fn(),
    ...overrides,
  }
}

const baseJob = {
  type: 'regen' as const,
  jobId: 'regen-1',
  userId: 'user-1',
  objectKey: 'thread01HZY3Q9R3TSV4RRFFQ69G5FAV',
  objectType: 'wiki' as const,
  triggeredBy: 'scheduler',
  enqueuedAt: new Date().toISOString(),
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('regen processor — repoPath persistence', () => {
  beforeEach(() => vi.clearAllMocks())

  it('derives repoPath from slug when thread has no repoPath and passes it to updateAfterRegen', async () => {
    const deps = makeThreadDeps()
    await processRegenJob(deps, baseJob)

    expect(deps.updateAfterRegen).toHaveBeenCalledWith(
      'wikis',
      'thread01HZY3Q9R3TSV4RRFFQ69G5FAV',
      expect.stringMatching(/^wikis\/\d{8}-fitness\.thread01HZY3Q9R3TSV4RRFFQ69G5FAV\.md$/)
    )
    expect(deps.batchWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [
          expect.objectContaining({
            path: expect.stringMatching(
              /^wikis\/\d{8}-fitness\.thread01HZY3Q9R3TSV4RRFFQ69G5FAV\.md$/
            ),
          }),
        ],
      })
    )
  })

  it('preserves existing repoPath', async () => {
    const deps = makeThreadDeps({
      loadThread: vi.fn().mockResolvedValue({
        lookupKey: 'thread01HZY3Q9R3TSV4RRFFQ69G5FAV',
        name: 'Fitness',
        type: 'log',
        slug: 'fitness',
        repoPath: 'wikis/20260301-fitness.thread01ABC.md',
        prompt: '',
      }),
    })

    await processRegenJob(deps, baseJob)

    expect(deps.updateAfterRegen).toHaveBeenCalledWith(
      'wikis',
      'thread01HZY3Q9R3TSV4RRFFQ69G5FAV',
      'wikis/20260301-fitness.thread01ABC.md'
    )
  })
})

describe('regen processor — manual trigger bypasses guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('skips canRebuildThread for manual triggers', async () => {
    const deps = makeThreadDeps({
      canRebuildThread: vi.fn().mockResolvedValue(false),
    })

    const result = await processRegenJob(deps, { ...baseJob, triggeredBy: 'manual' })

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(deps.canRebuildThread).not.toHaveBeenCalled()
    expect(deps.batchWrite).toHaveBeenCalled()
  })

  it('enforces canRebuildThread for scheduler triggers', async () => {
    const deps = makeThreadDeps({
      canRebuildThread: vi.fn().mockResolvedValue(false),
    })

    const result = await processRegenJob(deps, baseJob)

    expect(result.error).toContain('blocked by pending/linking fragments')
    expect(deps.canRebuildThread).toHaveBeenCalledWith('thread01HZY3Q9R3TSV4RRFFQ69G5FAV')
    expect(deps.releaseLock).toHaveBeenCalledWith(
      'wikis',
      'thread01HZY3Q9R3TSV4RRFFQ69G5FAV',
      'DIRTY'
    )
    expect(deps.batchWrite).not.toHaveBeenCalled()
  })
})

describe('regen processor — lock + error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns skipped when lock cannot be acquired', async () => {
    const deps = makeThreadDeps({ acquireLock: vi.fn().mockResolvedValue(false) })

    const result = await processRegenJob(deps, baseJob)

    expect(result.success).toBe(true)
    expect(result.error).toContain('lock')
    expect(deps.batchWrite).not.toHaveBeenCalled()
  })

  it('reverts thread to DIRTY on batchWrite failure', async () => {
    const deps = makeThreadDeps({
      batchWrite: vi.fn().mockRejectedValue(new Error('gateway down')),
    })

    await expect(processRegenJob(deps, baseJob)).rejects.toThrow('gateway down')
    expect(deps.releaseLock).toHaveBeenCalledWith(
      'wikis',
      'thread01HZY3Q9R3TSV4RRFFQ69G5FAV',
      'DIRTY'
    )
    expect(deps.updateAfterRegen).not.toHaveBeenCalled()
  })

  it('returns not found when thread does not exist', async () => {
    const deps = makeThreadDeps({ loadThread: vi.fn().mockResolvedValue(null) })

    const result = await processRegenJob(deps, baseJob)

    expect(result.success).toBe(false)
    expect(result.error).toContain('thread not found')
  })
})
