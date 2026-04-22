import { describe, it, expect } from 'vitest'
import { fixtureMarkdown } from '@robin/shared/fixtures'
import {
  parseSectionsFromMarkdown,
  replaceSectionInMarkdown,
  getSectionBody,
  slugifyHeading,
  scrollToSectionAnchor,
} from './sectionEdit'

describe('slugifyHeading', () => {
  it('lowercases and collapses non-alphanumerics to single hyphens', () => {
    expect(slugifyHeading('Attention Is All You Need')).toBe('attention-is-all-you-need')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugifyHeading('  Hello World!  ')).toBe('hello-world')
    expect(slugifyHeading('---Foo---')).toBe('foo')
  })

  it('handles empty and all-non-alphanumeric strings', () => {
    expect(slugifyHeading('')).toBe('')
    expect(slugifyHeading('!!!')).toBe('')
  })
})

describe('parseSectionsFromMarkdown', () => {
  it('returns an empty array for empty content', () => {
    expect(parseSectionsFromMarkdown('')).toEqual([])
  })

  it('returns an empty array for content with no headings', () => {
    expect(parseSectionsFromMarkdown('Just a paragraph.\n\nAnother.')).toEqual([])
  })

  it('parses a single level-1 heading', () => {
    const sections = parseSectionsFromMarkdown('# Title\n\nBody.')
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({
      id: 'title',
      anchor: 'title',
      heading: 'Title',
      level: 1,
      startLine: 0,
      endLine: 2,
    })
  })

  it('parses headings at levels 1/2/3 and computes endLine correctly', () => {
    const md = [
      '# Root', // 0
      '', // 1
      '## Sub A', // 2
      'alpha', // 3
      '### Sub Sub', // 4
      'beta', // 5
      '## Sub B', // 6
      'gamma', // 7
    ].join('\n')
    const sections = parseSectionsFromMarkdown(md)
    expect(sections.map((s) => ({ heading: s.heading, level: s.level, startLine: s.startLine, endLine: s.endLine }))).toEqual([
      { heading: 'Root', level: 1, startLine: 0, endLine: 7 },
      { heading: 'Sub A', level: 2, startLine: 2, endLine: 5 },
      { heading: 'Sub Sub', level: 3, startLine: 4, endLine: 5 },
      { heading: 'Sub B', level: 2, startLine: 6, endLine: 7 },
    ])
  })

  it('disambiguates duplicate headings with -1, -2 suffixes on subsequent occurrences', () => {
    const md = '## Notes\n\n## Notes\n\n## Notes\n'
    const sections = parseSectionsFromMarkdown(md)
    expect(sections.map((s) => s.anchor)).toEqual(['notes', 'notes-1', 'notes-2'])
  })

  it('ignores `#` lines inside fenced code blocks (backtick fences)', () => {
    const md = [
      '# Real',
      '',
      '```',
      '# Not a heading',
      '## Also not',
      '```',
      '',
      '## Real Two',
    ].join('\n')
    const sections = parseSectionsFromMarkdown(md)
    expect(sections.map((s) => s.heading)).toEqual(['Real', 'Real Two'])
  })

  it('ignores `#` lines inside fenced code blocks (tilde fences)', () => {
    const md = [
      '# Real',
      '',
      '~~~',
      '# Not a heading',
      '~~~',
      '',
      '## Real Two',
    ].join('\n')
    const sections = parseSectionsFromMarkdown(md)
    expect(sections.map((s) => s.heading)).toEqual(['Real', 'Real Two'])
  })

  it('handles the fixtureMarkdown integration case (duplicate Notes produces notes + notes-1)', () => {
    const sections = parseSectionsFromMarkdown(fixtureMarkdown)
    const anchors = sections.map((s) => s.anchor)
    // Full expected list derived from the fixture's heading structure
    expect(anchors).toEqual([
      'transformer-architecture',
      'overview',
      'the-attention-mechanism',
      'architecture',
      'encoder-stack',
      'decoder-stack',
      'notes',
      'notes-1',
    ])
  })
})

describe('getSectionBody', () => {
  it('returns the section including its heading line', () => {
    const md = '# Title\n\nBody line.\n\n## Other\n\nOther body.'
    const body = getSectionBody(md, 'other')
    expect(body).toBe('## Other\n\nOther body.')
  })

  it('returns the heading line plus body for a leaf section', () => {
    const md = '# A\n\naa\n\n## B\n\nbb'
    expect(getSectionBody(md, 'b')).toBe('## B\n\nbb')
  })

  it('returns an empty string when sectionId does not match any section', () => {
    const md = '# Real\n\nbody'
    expect(getSectionBody(md, 'nonexistent')).toBe('')
  })

  it('does not crash on empty content with a stale sectionId', () => {
    expect(getSectionBody('', 'anything')).toBe('')
  })
})

describe('replaceSectionInMarkdown', () => {
  it('replaces section body and preserves surrounding lines byte-for-byte on no-op', () => {
    const md = '# A\n\naa\n\n## B\n\nbb'
    const body = getSectionBody(md, 'b')
    const out = replaceSectionInMarkdown(md, 'b', body)
    expect(out).toBe(md)
  })

  it('round-trips identical body on every section of the fixture', () => {
    const sections = parseSectionsFromMarkdown(fixtureMarkdown)
    for (const section of sections) {
      const body = getSectionBody(fixtureMarkdown, section.id)
      const out = replaceSectionInMarkdown(fixtureMarkdown, section.id, body)
      expect(out).toBe(fixtureMarkdown)
    }
  })

  it('replaces only the targeted section when headings are nested', () => {
    const md = [
      '## Parent', // 0
      '', // 1
      'parent body', // 2
      '### Child', // 3
      'child body', // 4
      '## Sibling', // 5
      'sibling body', // 6
    ].join('\n')
    // Replacing H2 "Parent" must subsume H3 "Child" — the new body replaces lines 0..4.
    const replaced = replaceSectionInMarkdown(md, 'parent', '## Parent\n\nnew parent body')
    expect(replaced).toBe('## Parent\n\nnew parent body\n## Sibling\nsibling body')

    // Replacing H3 "Child" alone only touches lines 3..4.
    const childReplaced = replaceSectionInMarkdown(md, 'child', '### Child\nnew child body')
    expect(childReplaced).toBe(
      '## Parent\n\nparent body\n### Child\nnew child body\n## Sibling\nsibling body',
    )
  })

  it('returns original content unchanged when sectionId is stale', () => {
    const md = '# Real\n\nbody'
    expect(replaceSectionInMarkdown(md, 'ghost', '# Something Else')).toBe(md)
  })

  it('replaces the correct disambiguated duplicate section', () => {
    const md = '## Notes\n\nfirst\n\n## Notes\n\nsecond'
    const out = replaceSectionInMarkdown(md, 'notes-1', '## Notes\n\nsecond-edited')
    expect(out).toBe('## Notes\n\nfirst\n\n## Notes\n\nsecond-edited')
  })
})

describe('scrollToSectionAnchor', () => {
  it('does not throw when the target element does not exist', () => {
    expect(() => scrollToSectionAnchor('definitely-not-here')).not.toThrow()
  })

  it('calls scrollIntoView on a matching element', () => {
    const el = document.createElement('div')
    el.id = 'target-section'
    let called = false
    el.scrollIntoView = () => {
      called = true
    }
    document.body.appendChild(el)
    try {
      scrollToSectionAnchor('target-section')
      expect(called).toBe(true)
    } finally {
      el.remove()
    }
  })
})
