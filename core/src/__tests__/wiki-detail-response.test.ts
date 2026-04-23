import { describe, it, expect } from 'vitest'
import { wikiDetailResponseSchema } from '../schemas/wikis.schema.js'

const baseThreadFields = {
  id: 'wiki01ABC',
  lookupKey: 'wiki01ABC',
  slug: 'example',
  name: 'Example',
  type: 'project',
  prompt: '',
  state: 'RESOLVED',
  lastRebuiltAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  noteCount: 0,
  lastUpdated: new Date().toISOString(),
  shortDescriptor: '',
  descriptor: '',
  progress: null,
  wikiContent: '## Overview\n',
  fragments: [],
  people: [],
}

describe('wikiDetailResponseSchema', () => {
  it('preserves refs, infobox, and sections on a populated payload', () => {
    const personRef = {
      kind: 'person' as const,
      id: 'person01',
      slug: 'ashish-vaswani',
      label: 'Ashish Vaswani',
    }
    const infoboxRow = { label: 'Owner', value: 'Test', valueKind: 'text' as const }
    const section = {
      id: 'overview',
      anchor: 'overview',
      heading: 'Overview',
      level: 2,
      citations: [],
    }
    const result = wikiDetailResponseSchema.safeParse({
      ...baseThreadFields,
      refs: { 'person:ashish-vaswani': personRef },
      infobox: { rows: [infoboxRow] },
      sections: [section],
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.refs).toEqual({ 'person:ashish-vaswani': personRef })
    expect(result.data.infobox).toEqual({ rows: [infoboxRow] })
    expect(result.data.sections).toHaveLength(1)
    expect(result.data.sections[0].anchor).toBe('overview')
  })

  it('defaults refs/infobox/sections when the server omits them', () => {
    const result = wikiDetailResponseSchema.safeParse(baseThreadFields)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.refs).toEqual({})
    expect(result.data.infobox).toBeNull()
    expect(result.data.sections).toEqual([])
  })
})
