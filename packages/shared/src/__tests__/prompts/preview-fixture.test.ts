import { describe, expect, it } from 'vitest'
import { loadWikiTypePreviewFixture } from '../../prompts/index'

describe('loadWikiTypePreviewFixture', () => {
  it('returns an object with all 9 expected keys', () => {
    const vars = loadWikiTypePreviewFixture()
    const expected = [
      'fragments',
      'title',
      'date',
      'count',
      'timeline',
      'people',
      'existingWiki',
      'edits',
      'relatedWikis',
    ]
    for (const key of expected) {
      expect(vars).toHaveProperty(key)
    }
  })

  it('returns count as number and every other variable as string', () => {
    const vars = loadWikiTypePreviewFixture()
    expect(typeof vars.count).toBe('number')
    expect(typeof vars.fragments).toBe('string')
    expect(typeof vars.title).toBe('string')
    expect(typeof vars.date).toBe('string')
    expect(typeof vars.timeline).toBe('string')
    expect(typeof vars.people).toBe('string')
    expect(typeof vars.existingWiki).toBe('string')
    expect(typeof vars.edits).toBe('string')
    expect(typeof vars.relatedWikis).toBe('string')
  })

  it('populates every variable with a non-empty value so conditional branches fire', () => {
    const vars = loadWikiTypePreviewFixture()
    expect(vars.fragments.length).toBeGreaterThan(0)
    expect(vars.title.length).toBeGreaterThan(0)
    expect(vars.date.length).toBeGreaterThan(0)
    expect(vars.count).toBeGreaterThan(0)
    expect(vars.timeline.length).toBeGreaterThan(0)
    expect(vars.people.length).toBeGreaterThan(0)
    expect(vars.existingWiki.length).toBeGreaterThan(0)
    expect(vars.edits.length).toBeGreaterThan(0)
    expect(vars.relatedWikis.length).toBeGreaterThan(0)
  })

  it('returns the shared fixture for a known slug (no per-slug file exists yet)', () => {
    const shared = loadWikiTypePreviewFixture()
    const logFixture = loadWikiTypePreviewFixture('log')
    // Per-slug files have not been dropped — loader falls through to shared.
    expect(logFixture).toBe(shared)
  })

  it('caches by resolved path — repeated calls return the same reference', () => {
    const a = loadWikiTypePreviewFixture()
    const b = loadWikiTypePreviewFixture()
    expect(a).toBe(b)
  })

  it('does not throw for an unknown slug — falls back to shared fixture', () => {
    const shared = loadWikiTypePreviewFixture()
    expect(() => loadWikiTypePreviewFixture('definitely-not-a-real-slug')).not.toThrow()
    const unknown = loadWikiTypePreviewFixture('definitely-not-a-real-slug')
    expect(unknown).toBe(shared)
  })
})
