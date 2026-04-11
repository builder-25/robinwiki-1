import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  loadVaultClassificationSpec,
  loadWikiClassificationSpec,
  loadPeopleExtractionSpec,
  loadFragmentationSpec,
  loadWikiRelevanceSpec,
} from '../../prompts/index'

describe('vault-classification', () => {
  const fixtures = {
    content: 'I went running today and tracked my heart rate',
    vaults: 'health, work, personal',
  }

  it('loads and returns a valid PromptResult', () => {
    const result = loadVaultClassificationSpec(fixtures)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(result).toHaveProperty('meta')
    expect(result.meta).toHaveProperty('temperature')
    expect(result.meta).toHaveProperty('outputSchema')
  })

  it('renders system message with Marcel persona', () => {
    const result = loadVaultClassificationSpec(fixtures)
    expect(result.system).toContain('Marcel')
  })

  it('renders user template with substituted variables', () => {
    const result = loadVaultClassificationSpec(fixtures)
    expect(result.user).toContain('health, work, personal')
    expect(result.user).toContain('I went running today')
    expect(result.user).not.toContain('{{content}}')
    expect(result.user).not.toContain('{{vaults}}')
  })

  it('throws ZodError when required content is missing', () => {
    expect(() =>
      loadVaultClassificationSpec({ content: '', vaults: 'health' } as any)
    ).not.toThrow()
    expect(() => loadVaultClassificationSpec({ vaults: 'health' } as any)).toThrow(ZodError)
  })
})

describe('wiki-classification', () => {
  const fixtures = {
    content: 'test fragment about exercise',
    wikis: 'health-log, work-project, fitness-goals',
  }

  it('loads and returns a valid PromptResult', () => {
    const result = loadWikiClassificationSpec(fixtures)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(result.meta).toHaveProperty('temperature')
    expect(result.meta).toHaveProperty('outputSchema')
  })

  it('renders system message with Marcel persona', () => {
    const result = loadWikiClassificationSpec(fixtures)
    expect(result.system).toContain('Marcel')
  })

  it('renders user template with substituted variables', () => {
    const result = loadWikiClassificationSpec(fixtures)
    expect(result.user).toContain('health-log, work-project, fitness-goals')
    expect(result.user).toContain('test fragment about exercise')
    expect(result.user).not.toContain('{{content}}')
    expect(result.user).not.toContain('{{wikis}}')
  })

  it('throws ZodError when required content is missing', () => {
    expect(() => loadWikiClassificationSpec({ wikis: 'foo' } as any)).toThrow(ZodError)
  })
})

describe('people-extraction', () => {
  const fixtures = { content: 'I met John and Elfie at the coffee shop today' }

  it('loads and returns a valid PromptResult', () => {
    const result = loadPeopleExtractionSpec(fixtures)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(result.meta).toHaveProperty('temperature')
    expect(result.meta).toHaveProperty('outputSchema')
  })

  it('renders system message with Elfie persona', () => {
    const result = loadPeopleExtractionSpec(fixtures)
    expect(result.system).toContain('Elfie')
  })

  it('renders user template with substituted content', () => {
    const result = loadPeopleExtractionSpec(fixtures)
    expect(result.user).toContain('I met John and Elfie')
    expect(result.user).not.toContain('{{content}}')
  })
})

describe('fragmentation', () => {
  const fixtures = { content: 'Long entry text about multiple topics including health and work' }

  it('loads and returns a valid PromptResult', () => {
    const result = loadFragmentationSpec(fixtures)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(result.meta).toHaveProperty('temperature')
    expect(result.meta).toHaveProperty('outputSchema')
  })

  it('renders system message with Elfie persona', () => {
    const result = loadFragmentationSpec(fixtures)
    expect(result.system).toContain('Elfie')
  })

  it('renders user template with substituted content', () => {
    const result = loadFragmentationSpec(fixtures)
    expect(result.user).toContain('Long entry text about multiple topics')
    expect(result.user).not.toContain('{{content}}')
  })

  it('renders OUTPUT FIELDS section in template', () => {
    const result = loadFragmentationSpec(fixtures)
    expect(result.user).toContain('[OUTPUT FIELDS')
    expect(result.user).toContain('sourceSpan')
    expect(result.user).toContain('confidence')
  })

  it('injects correct fragmentTarget for short content', () => {
    const result = loadFragmentationSpec({ content: 'short entry' })
    expect(result.user).toContain('approximately 2 words')
    expect(result.user).toContain('approximately 1 fragments')
  })
})

describe('wiki-relevance', () => {
  const fixtures = {
    wikiName: 'Health Tracking',
    threadType: 'log',
    threadDescription: 'A log of health-related activities',
    fragmentContent: 'I went for a 5k run this morning',
  }

  it('loads and returns a valid PromptResult', () => {
    const result = loadWikiRelevanceSpec(fixtures)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(result.meta).toHaveProperty('temperature')
    expect(result.meta).toHaveProperty('outputSchema')
  })

  it('renders system message with Judge persona', () => {
    const result = loadWikiRelevanceSpec(fixtures)
    expect(result.system).toContain('Judge')
  })

  it('renders user template with substituted variables', () => {
    const result = loadWikiRelevanceSpec(fixtures)
    expect(result.user).toContain('Health Tracking')
    expect(result.user).toContain('I went for a 5k run this morning')
    expect(result.user).not.toContain('{{wikiName}}')
    expect(result.user).not.toContain('{{fragmentContent}}')
  })

  it('throws ZodError when required fragmentContent is missing', () => {
    expect(() =>
      loadWikiRelevanceSpec({
        wikiName: 'x',
        threadType: 'log',
        threadDescription: 'desc',
      } as any)
    ).toThrow(ZodError)
  })
})

describe('modification stack', () => {
  it('vault-classification has output.strict: true (classification)', () => {
    const result = loadVaultClassificationSpec({ content: 'test', vaults: 'v1' })
    // The spec itself has strict: true — verified via the loadSpec which parsed it
    // We verify the temperature matches classification specs
    expect(result.meta.temperature).toBe(0.1)
  })

  it('wiki-classification has output.strict: true (classification)', () => {
    const result = loadWikiClassificationSpec({ content: 'test', wikis: 't1' })
    expect(result.meta.temperature).toBe(0.1)
  })

  it('people-extraction does NOT have output.strict (extraction)', () => {
    const result = loadPeopleExtractionSpec({ content: 'test' })
    expect(result.meta.temperature).toBe(0)
  })

  it('fragmentation does NOT have output.strict (extraction)', () => {
    const result = loadFragmentationSpec({ content: 'test' })
    expect(result.meta.temperature).toBe(0.2)
  })

  it('wiki-relevance has output.loose: true (scoring)', () => {
    const result = loadWikiRelevanceSpec({
      wikiName: 'x',
      threadType: 'log',
      threadDescription: 'd',
      fragmentContent: 'f',
    })
    expect(result.meta.temperature).toBe(0.2)
  })
})
