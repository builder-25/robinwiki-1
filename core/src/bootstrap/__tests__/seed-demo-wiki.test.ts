import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the seed library — we're testing the bootstrap gate's branching,
// not the seeding SQL itself.
const isFixtureSeededMock = vi.fn<() => Promise<boolean>>()
const seedFixtureMock = vi.fn<
  () => Promise<{
    seeded: boolean
    skipped: boolean
    wikiKey: string | null
    slug: string
    peopleCount: number
    fragmentCount: number
    entryCount: number
  }>
>()

vi.mock('../../lib/seedFixture.js', () => ({
  isFixtureSeeded: isFixtureSeededMock,
  seedFixture: seedFixtureMock,
}))

// Import AFTER mocks are registered.
const { seedDemoWiki } = await import('../seed-demo-wiki.js')

describe('seedDemoWiki', () => {
  beforeEach(() => {
    isFixtureSeededMock.mockReset()
    seedFixtureMock.mockReset()
  })

  it('seeds when fixture is absent', async () => {
    isFixtureSeededMock.mockResolvedValue(false)
    seedFixtureMock.mockResolvedValue({
      seeded: true,
      skipped: false,
      wikiKey: 'wiki_abc',
      slug: 'transformer-architecture',
      peopleCount: 3,
      fragmentCount: 5,
      entryCount: 1,
    })

    const result = await seedDemoWiki()

    expect(isFixtureSeededMock).toHaveBeenCalledOnce()
    expect(seedFixtureMock).toHaveBeenCalledOnce()
    expect(result).toEqual({ seeded: true, skipped: false })
  })

  it('skips when fixture is already present — no write call', async () => {
    isFixtureSeededMock.mockResolvedValue(true)

    const result = await seedDemoWiki()

    expect(isFixtureSeededMock).toHaveBeenCalledOnce()
    expect(seedFixtureMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      seeded: false,
      skipped: true,
      reason: 'already-present',
    })
  })

  it('is idempotent across repeated boots — second call skips', async () => {
    // First call: fresh instance, seed runs.
    isFixtureSeededMock.mockResolvedValueOnce(false)
    seedFixtureMock.mockResolvedValue({
      seeded: true,
      skipped: false,
      wikiKey: 'wiki_abc',
      slug: 'transformer-architecture',
      peopleCount: 3,
      fragmentCount: 5,
      entryCount: 1,
    })
    // Second call: row now exists, gate short-circuits.
    isFixtureSeededMock.mockResolvedValueOnce(true)

    const first = await seedDemoWiki()
    const second = await seedDemoWiki()

    expect(first.seeded).toBe(true)
    expect(second.seeded).toBe(false)
    expect(second.skipped).toBe(true)
    expect(seedFixtureMock).toHaveBeenCalledTimes(1)
  })

  it('swallows seed errors and never throws — user login must not be blocked', async () => {
    isFixtureSeededMock.mockResolvedValue(false)
    seedFixtureMock.mockRejectedValue(new Error('db exploded'))

    const result = await seedDemoWiki()

    expect(result).toEqual({
      seeded: false,
      skipped: true,
      reason: 'error',
    })
  })

  it('swallows gate errors and never throws', async () => {
    isFixtureSeededMock.mockRejectedValue(new Error('db unreachable'))

    const result = await seedDemoWiki()

    expect(result).toEqual({
      seeded: false,
      skipped: true,
      reason: 'error',
    })
    expect(seedFixtureMock).not.toHaveBeenCalled()
  })
})
