import { describe, it, expect } from 'vitest'
import { jaccardSimilarity, dedupBatch } from '../dedup'

describe('jaccardSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBe(1.0)
  })

  it('returns 0.0 for completely disjoint strings', () => {
    expect(jaccardSimilarity('hello world', 'foo bar')).toBe(0.0)
  })

  it('returns correct value for partial overlap', () => {
    // sets: {the, cat, sat} and {the, dog, sat} → intersection=2, union=4
    expect(jaccardSimilarity('the cat sat', 'the dog sat')).toBeCloseTo(0.5)
  })

  it('is case-insensitive', () => {
    expect(jaccardSimilarity('Hello World', 'hello world')).toBe(1.0)
  })

  it('returns 0 for two empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(0)
  })

  it('returns 0 when one string is empty', () => {
    expect(jaccardSimilarity('hello', '')).toBe(0)
  })
})

describe('dedupBatch', () => {
  it('returns single fragment unchanged', () => {
    const fragments = [{ content: 'hello world', confidence: 0.9 }]
    expect(dedupBatch(fragments)).toEqual(fragments)
  })

  it('returns empty array unchanged', () => {
    expect(dedupBatch([])).toEqual([])
  })

  it('keeps higher-confidence fragment when pair is identical', () => {
    const fragments = [
      { content: 'the data layer handles persistence', confidence: 0.8 },
      { content: 'the data layer handles persistence', confidence: 0.95 },
    ]
    const result = dedupBatch(fragments)
    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe(0.95)
  })

  it('keeps both fragments when content is different', () => {
    const fragments = [
      { content: 'the cat sat on the mat', confidence: 0.9 },
      { content: 'quantum physics explains entanglement', confidence: 0.8 },
    ]
    const result = dedupBatch(fragments)
    expect(result).toHaveLength(2)
  })

  it('respects custom threshold', () => {
    // These have ~0.5 Jaccard similarity (the/cat/sat vs the/dog/sat)
    const fragments = [
      { content: 'the cat sat', confidence: 0.9 },
      { content: 'the dog sat', confidence: 0.8 },
    ]

    // With low threshold (0.4), they're considered duplicates
    const strict = dedupBatch(fragments, 0.4)
    expect(strict).toHaveLength(1)

    // With high threshold (0.9), they're kept as distinct
    const lenient = dedupBatch(fragments, 0.9)
    expect(lenient).toHaveLength(2)
  })

  it('handles chain of duplicates correctly', () => {
    // A≈B and B≈C but A≠C — should keep A and C (B gets dropped by A)
    const fragments = [
      { content: 'alpha beta gamma delta', confidence: 0.9 },
      { content: 'alpha beta gamma epsilon', confidence: 0.7 },
      { content: 'zeta theta iota kappa', confidence: 0.85 },
    ]
    const result = dedupBatch(fragments, 0.5)
    expect(result).toHaveLength(2)
    expect(result[0].confidence).toBe(0.9)
    expect(result[1].confidence).toBe(0.85)
  })
})
