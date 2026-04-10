import { describe, it, expect } from 'vitest'
import { synthesizePersonBody } from '../person-body'

describe('synthesizePersonBody', () => {
  it('returns sparse template when < 3 fragments', async () => {
    const result = await synthesizePersonBody({
      canonicalName: 'Sarah Ouma',
      aliases: ['Sarah'],
      existingBody: '',
      fragmentContents: ['frag1', 'frag2'],
      llm: async () => 'should not be called',
    })
    expect(result).toContain('Mentioned in 2 fragment(s)')
    expect(result).toContain('Not enough context for a summary yet')
  })

  it('returns sparse template when 0 fragments', async () => {
    const result = await synthesizePersonBody({
      canonicalName: 'Unknown Person',
      aliases: [],
      existingBody: '',
      fragmentContents: [],
      llm: async () => 'should not be called',
    })
    expect(result).toContain('Mentioned in 0 fragment(s)')
  })

  it('calls LLM for >= 3 fragments and returns body', async () => {
    const mockLlm = async (_system: string, _user: string) =>
      '## Who They Are\nA developer.\n\n## How You Know Them\nWork colleague.\n\n## What They Care About\nCode quality.\n\n## How They Think\nMethodically.\n\n## How They Communicate\nDirectly.'

    const result = await synthesizePersonBody({
      canonicalName: 'Sarah Ouma',
      aliases: ['Sarah', 'S.O.'],
      existingBody: 'Old summary',
      fragmentContents: ['frag1', 'frag2', 'frag3'],
      llm: mockLlm,
    })
    expect(result).toContain('## Who They Are')
    expect(result).toContain('A developer.')
    expect(result).toContain('## How They Communicate')
  })

  it('passes correct context to LLM prompt', async () => {
    let capturedSystem = ''
    let capturedUser = ''
    const mockLlm = async (system: string, user: string) => {
      capturedSystem = system
      capturedUser = user
      return '## Who They Are\nTest.'
    }

    await synthesizePersonBody({
      canonicalName: 'Jane Doe',
      aliases: ['Jane', 'JD'],
      existingBody: 'Previous bio',
      fragmentContents: ['fragment one content', 'fragment two content', 'fragment three content'],
      llm: mockLlm,
    })

    expect(capturedUser).toContain('Jane Doe')
    expect(capturedUser).toContain('fragment one content')
    expect(capturedUser).toContain('fragment three content')
  })
})
