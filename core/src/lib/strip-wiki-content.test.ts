import { describe, it, expect } from 'vitest'
import { stripWikiContent } from './strip-wiki-content.js'
import type { WikiRef } from '@robin/shared/schemas/sidecar'

const refs: Record<string, WikiRef> = {
  'person:jane-doe': {
    kind: 'person',
    id: 'person01ABC',
    slug: 'jane-doe',
    label: 'Jane Doe',
  },
  'wiki:ai-infrastructure': {
    kind: 'wiki',
    id: 'wiki01XYZ',
    slug: 'ai-infrastructure',
    label: 'AI Infrastructure',
    wikiType: 'log',
  },
  'fragment:vector-db-note': {
    kind: 'fragment',
    id: 'frag01DEF',
    slug: 'vector-db-note',
    label: 'Vector DB Note',
  },
}

describe('stripWikiContent', () => {
  it('replaces [[kind:slug]] tokens with resolved labels', () => {
    const input = 'See [[person:jane-doe]] for details on [[wiki:ai-infrastructure]].'
    const result = stripWikiContent(input, refs)
    expect(result).toBe('See Jane Doe for details on AI Infrastructure.')
  })

  it('falls back to title-casing the slug when no ref exists', () => {
    const input = 'Check [[wiki:unknown-topic]] for more.'
    const result = stripWikiContent(input, refs)
    expect(result).toBe('Check Unknown Topic for more.')
  })

  it('strips inline citation markers', () => {
    const input = 'This is a fact[1] with multiple citations[2][12].'
    const result = stripWikiContent(input, refs)
    expect(result).toBe('This is a fact with multiple citations.')
  })

  it('handles both tokens and citations together', () => {
    const input = '[[person:jane-doe]] noted this[1]. See [[wiki:ai-infrastructure]][2].'
    const result = stripWikiContent(input, refs)
    expect(result).toBe('Jane Doe noted this. See AI Infrastructure.')
  })

  it('returns content unchanged when no tokens or citations', () => {
    const input = '# Plain Heading\n\nJust regular markdown.'
    const result = stripWikiContent(input, refs)
    expect(result).toBe(input)
  })

  it('handles empty content', () => {
    expect(stripWikiContent('', refs)).toBe('')
  })

  it('handles empty refs map', () => {
    const input = 'See [[person:jane-doe]] here.'
    const result = stripWikiContent(input, {})
    expect(result).toBe('See Jane Doe here.')
  })
})
