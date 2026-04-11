import { describe, it, expect, vi } from 'vitest'
import { parseWikiLinks, resolveWikiLinks } from '../wiki-links'

describe('parseWikiLinks', () => {
  it('extracts [[slug]] and [[type:slug]] from text', () => {
    const result = parseWikiLinks('Check [[nairobi]] and [[thread:moving]]')
    expect(result).toEqual([
      { slug: 'nairobi', typeHint: undefined, raw: '[[nairobi]]' },
      { slug: 'moving', typeHint: 'wiki', raw: '[[thread:moving]]' },
    ])
  })

  it('returns empty array when no links', () => {
    expect(parseWikiLinks('No links here')).toEqual([])
  })

  it('deduplicates by slug+typeHint', () => {
    const result = parseWikiLinks('Duplicate [[foo]] and [[foo]]')
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('foo')
  })

  it('parses typed [[person:sarah]] link', () => {
    const result = parseWikiLinks('Typed [[person:sarah]] link')
    expect(result).toEqual([{ slug: 'sarah', typeHint: 'person', raw: '[[person:sarah]]' }])
  })

  it('handles mixed typed and untyped links', () => {
    const result = parseWikiLinks('See [[foo]], [[thread:bar]], and [[person:baz]]')
    expect(result).toHaveLength(3)
  })
})

describe('resolveWikiLinks', () => {
  it('resolves known slug to {slug, type, key}, puts unknown in broken[]', async () => {
    const lookupFn = vi
      .fn()
      .mockResolvedValueOnce({ type: 'wiki', key: 'thread01HABC' }) // nairobi found as thread
      .mockResolvedValueOnce(null) // ghost not found in any type
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const parsed = parseWikiLinks('See [[nairobi]] and [[ghost]]')
    const result = await resolveWikiLinks(parsed, lookupFn)

    expect(result.resolved).toEqual([{ slug: 'nairobi', type: 'wiki', key: 'thread01HABC' }])
    expect(result.broken).toEqual(['ghost'])
  })

  it('checks priority order: thread > person > fragment > entry for unqualified links', async () => {
    const lookupFn = vi.fn().mockImplementation(async (slug: string, type?: string) => {
      if (type === 'wiki') return null
      if (type === 'person') return { type: 'person', key: 'person01HABC' }
      return null
    })

    const parsed = parseWikiLinks('See [[sarah]]')
    const result = await resolveWikiLinks(parsed, lookupFn)

    expect(result.resolved).toEqual([{ slug: 'sarah', type: 'person', key: 'person01HABC' }])
    // Should have tried thread first, then person
    expect(lookupFn).toHaveBeenCalledWith('sarah', 'wiki')
    expect(lookupFn).toHaveBeenCalledWith('sarah', 'person')
  })

  it('uses type hint directly for qualified links like [[thread:x]]', async () => {
    const lookupFn = vi.fn().mockResolvedValue({ type: 'wiki', key: 'thread01HXXX' })

    const parsed = parseWikiLinks('See [[thread:moving]]')
    const result = await resolveWikiLinks(parsed, lookupFn)

    expect(lookupFn).toHaveBeenCalledTimes(1)
    expect(lookupFn).toHaveBeenCalledWith('moving', 'wiki')
    expect(result.resolved).toEqual([{ slug: 'moving', type: 'wiki', key: 'thread01HXXX' }])
  })

  it('puts qualified link in broken if type-specific lookup fails', async () => {
    const lookupFn = vi.fn().mockResolvedValue(null)

    const parsed = parseWikiLinks('See [[thread:nonexistent]]')
    const result = await resolveWikiLinks(parsed, lookupFn)

    expect(result.resolved).toEqual([])
    expect(result.broken).toEqual(['thread:nonexistent'])
  })
})
