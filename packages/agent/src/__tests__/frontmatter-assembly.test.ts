import { describe, it, expect } from 'vitest'
import {
  assembleEntryFrontmatter,
  assembleFragmentFrontmatter,
  assembleThreadFrontmatter,
  assemblePersonFrontmatter,
} from '../frontmatter'

describe('assembleEntryFrontmatter', () => {
  it('produces valid YAML frontmatter with --- delimiters and flat keys', () => {
    const result = assembleEntryFrontmatter({
      title: 'Coffee meetup',
      date: '20260308',
      vaultId: 'vault01',
      source: 'web',
      status: 'PENDING',
      fragmentKeys: ['frag01HABC'],
      personKeys: ['person01HDEF'],
      wikiLinks: [{ slug: 'nairobi', type: 'wiki', key: 'thread01HXYZ' }],
      brokenLinks: ['ghost'],
    })

    expect(result).toMatch(/^---\n/)
    expect(result).toMatch(/\n---\n?$/)
    expect(result).toContain('title: Coffee meetup')
    expect(result).toMatch(/date: ['"]20260308['"]/)  // js-yaml uses single quotes, yaml uses double
    expect(result).toContain('vaultId: vault01')
    expect(result).toContain('source: web')
    expect(result).toContain('status: PENDING')
    expect(result).toContain('frag01HABC')
    expect(result).toContain('person01HDEF')
    expect(result).toContain('nairobi')
    expect(result).toContain('ghost')
  })

  it('does not include ULID in output', () => {
    const result = assembleEntryFrontmatter({
      title: 'Test',
      date: '20260308',
      vaultId: 'v1',
      source: 'web',
      status: 'PENDING',
      fragmentKeys: [],
      personKeys: [],
      wikiLinks: [],
      brokenLinks: [],
    })

    expect(result).not.toMatch(/ulid/i)
  })
})

describe('assembleFragmentFrontmatter', () => {
  it('produces valid YAML frontmatter with all flat keys', () => {
    const result = assembleFragmentFrontmatter({
      title: 'Coffee note',
      type: 'note',
      date: '20260308',
      tags: ['social', 'coffee'],
      entryKey: 'entry01HABC',
      wikiKeys: ['thread01HXYZ'],
      personKeys: ['person01HDEF'],
      relatedFragmentKeys: [],
      status: 'PENDING',
      confidence: 0.9,
      sourceSpan: 'Had coffee with Sarah',
      suggestedSlug: 'coffee-note',
      wikiLinks: [{ slug: 'sarah', type: 'person', key: 'person01HDEF' }],
      brokenLinks: [],
      entityExtractionStatus: 'completed',
    })

    expect(result).toMatch(/^---\n/)
    expect(result).toMatch(/\n---\n?$/)
    expect(result).toContain('title: Coffee note')
    expect(result).toContain('type: note')
    expect(result).toContain('confidence: 0.9')
    expect(result).toContain('sarah')
    expect(result).toContain('entityExtractionStatus: completed')
  })

  it('does not include ULID', () => {
    const result = assembleFragmentFrontmatter({
      title: 'Test',
      type: 'note',
      date: '20260308',
      tags: [],
      entryKey: 'entry01H',
      wikiKeys: [],
      personKeys: [],
      relatedFragmentKeys: [],
      status: 'PENDING',
      confidence: 0.8,
      sourceSpan: 'test',
      suggestedSlug: 'test',
      wikiLinks: [],
      brokenLinks: [],
      entityExtractionStatus: 'completed',
    })

    expect(result).not.toMatch(/ulid/i)
  })

  it('includes vaultId when provided', () => {
    const result = assembleFragmentFrontmatter({
      title: 'Test',
      type: 'note',
      date: '20260308',
      tags: [],
      entryKey: 'entry01H',
      vaultId: 'vault01ABC',
      wikiKeys: [],
      personKeys: [],
      relatedFragmentKeys: [],
      status: 'PENDING',
      confidence: 0.8,
      sourceSpan: 'test',
      suggestedSlug: 'test',
      wikiLinks: [],
      brokenLinks: [],
      entityExtractionStatus: 'completed',
    })

    expect(result).toContain('vaultId: vault01ABC')
  })

  it('omits vaultId when undefined', () => {
    const result = assembleFragmentFrontmatter({
      title: 'Test',
      type: 'note',
      date: '20260308',
      tags: [],
      entryKey: 'entry01H',
      wikiKeys: [],
      personKeys: [],
      relatedFragmentKeys: [],
      status: 'PENDING',
      confidence: 0.8,
      sourceSpan: 'test',
      suggestedSlug: 'test',
      wikiLinks: [],
      brokenLinks: [],
      entityExtractionStatus: 'completed',
    })

    expect(result).not.toContain('vaultId')
  })
})

describe('assembleThreadFrontmatter', () => {
  it('produces valid YAML frontmatter', () => {
    const result = assembleThreadFrontmatter({
      type: 'log',
      state: 'RESOLVED',
      name: 'Moving to Nairobi',
      prompt: 'Track my relocation',
      fragmentKeys: ['frag01H1', 'frag01H2'],
      fragmentCount: 2,
      lastRebuiltAt: '2026-03-08T00:00:00Z',
      wikiLinks: [],
      brokenLinks: [],
    })

    expect(result).toMatch(/^---\n/)
    expect(result).toContain('type: log')
    expect(result).toContain('state: RESOLVED')
    expect(result).toContain('name: Moving to Nairobi')
    expect(result).toContain('fragmentCount: 2')
  })

  it('handles null lastRebuiltAt', () => {
    const result = assembleThreadFrontmatter({
      type: 'collection',
      state: 'PENDING',
      name: 'Test',
      prompt: '',
      fragmentKeys: [],
      fragmentCount: 0,
      lastRebuiltAt: null,
      wikiLinks: [],
      brokenLinks: [],
    })

    expect(result).toContain('lastRebuiltAt: null')
  })

  it('includes vaultId when provided', () => {
    const result = assembleThreadFrontmatter({
      type: 'log',
      state: 'RESOLVED',
      vaultId: 'vault01XYZ',
      name: 'Test Thread',
      prompt: '',
      fragmentKeys: [],
      fragmentCount: 0,
      lastRebuiltAt: null,
      wikiLinks: [],
      brokenLinks: [],
    })

    expect(result).toContain('vaultId: vault01XYZ')
  })

  it('omits vaultId when undefined', () => {
    const result = assembleThreadFrontmatter({
      type: 'log',
      state: 'RESOLVED',
      name: 'Test Thread',
      prompt: '',
      fragmentKeys: [],
      fragmentCount: 0,
      lastRebuiltAt: null,
      wikiLinks: [],
      brokenLinks: [],
    })

    expect(result).not.toContain('vaultId')
  })
})

describe('assemblePersonFrontmatter', () => {
  it('produces valid YAML frontmatter', () => {
    const result = assemblePersonFrontmatter({
      type: 'person',
      state: 'RESOLVED',
      verified: false,
      canonicalName: 'Sarah Ouma',
      aliases: ['Sarah', 'S. Ouma'],
      fragmentKeys: ['frag01H1'],
      lastRebuiltAt: null,
      wikiLinks: [],
      brokenLinks: ['missing-link'],
    })

    expect(result).toMatch(/^---\n/)
    expect(result).toContain('type: person')
    expect(result).toContain('verified: false')
    expect(result).toContain('canonicalName: Sarah Ouma')
    expect(result).toContain('Sarah')
    expect(result).toContain('S. Ouma')
    expect(result).toContain('missing-link')
  })

  it('does not include ULID', () => {
    const result = assemblePersonFrontmatter({
      type: 'person',
      state: 'RESOLVED',
      verified: true,
      canonicalName: 'Test',
      aliases: [],
      fragmentKeys: [],
      lastRebuiltAt: null,
      wikiLinks: [],
      brokenLinks: [],
    })

    expect(result).not.toMatch(/ulid/i)
  })
})

describe('wikiLinks in frontmatter', () => {
  it('formats wikiLinks as array of objects with slug, type, key', () => {
    const result = assembleEntryFrontmatter({
      title: 'Test',
      date: '20260308',
      vaultId: 'v1',
      source: 'web',
      status: 'PENDING',
      fragmentKeys: [],
      personKeys: [],
      wikiLinks: [
        { slug: 'nairobi', type: 'wiki', key: 'thread01HXYZ' },
        { slug: 'sarah', type: 'person', key: 'person01HABC' },
      ],
      brokenLinks: [],
    })

    // Should contain the wiki link objects
    expect(result).toContain('slug: nairobi')
    expect(result).toContain('type: thread')
    expect(result).toContain('key: thread01HXYZ')
  })

  it('formats brokenLinks as string array', () => {
    const result = assembleEntryFrontmatter({
      title: 'Test',
      date: '20260308',
      vaultId: 'v1',
      source: 'web',
      status: 'PENDING',
      fragmentKeys: [],
      personKeys: [],
      wikiLinks: [],
      brokenLinks: ['ghost', 'missing'],
    })

    expect(result).toContain('ghost')
    expect(result).toContain('missing')
  })
})
