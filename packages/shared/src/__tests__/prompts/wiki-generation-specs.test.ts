import { describe, expect, it } from 'vitest'
import { loadWikiGenerationSpec } from '../../prompts/index'
import type { ThreadWikiType } from '../../prompts/index'

const wikiFixtures = {
  fragments: 'Fragment 1: I went running today.\nFragment 2: Hit a new personal best on the 5k.',
  title: 'Health Tracking Log',
  date: '2026-03-07',
  count: 3,
}

const allTypes: ThreadWikiType[] = [
  'log',
  'collection',
  'belief',
  'decision',
  'project',
  'objective',
  'skill',
  'agent',
  'voice',
  'principles',
]

describe('wiki-types specs', () => {
  for (const type of allTypes) {
    describe(type, () => {
      it('loads and returns a valid PromptResult', () => {
        const result = loadWikiGenerationSpec(type, wikiFixtures)
        expect(result).toHaveProperty('system')
        expect(result).toHaveProperty('user')
        expect(result.meta).toHaveProperty('temperature')
        expect(result.meta).toHaveProperty('outputSchema')
      })

      it('renders system message with Quill persona', () => {
        const result = loadWikiGenerationSpec(type, wikiFixtures)
        expect(result.system).toContain('Quill')
      })

      it('renders user template with substituted title', () => {
        const result = loadWikiGenerationSpec(type, wikiFixtures)
        expect(result.user).toContain('Health Tracking Log')
        expect(result.user).not.toContain('{{title}}')
      })

      it('renders user template with substituted fragments', () => {
        const result = loadWikiGenerationSpec(type, wikiFixtures)
        expect(result.user).toContain('I went running today')
        expect(result.user).not.toContain('{{fragments}}')
      })

      it('is a generation category with output.strict: true', () => {
        const result = loadWikiGenerationSpec(type, wikiFixtures)
        // All wiki-types specs are generation category
        // Temperature for generation specs
        expect(result.meta.temperature).toBeGreaterThan(0)
        expect(result.meta.outputSchema).toBeDefined()
      })
    })
  }
})
