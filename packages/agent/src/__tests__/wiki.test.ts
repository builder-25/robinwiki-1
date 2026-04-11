import { describe, it, expect, vi } from 'vitest'
import { regenerateWiki, THREAD_WIKI_TYPES } from '../wiki'
import { loadWikiGenerationSpec } from '@robin/shared'

const mockLlm = vi.fn(async (_system: string, _user: string) => {
  // Return a minimal valid wiki with YAML frontmatter
  return `---
type: test
generated_at: 2026-01-01
fragment_count: 1
---

# Test Wiki

Generated content based on prompt.`
})

describe('regenerateWiki', () => {
  it('returns body-only (no frontmatter delimiters) after stripping LLM output', async () => {
    const result = await regenerateWiki(
      'thread-123',
      'log',
      ['Do X first', 'Then do Y'],
      'test-model',
      mockLlm
    )

    expect(result).not.toMatch(/^---/)
    expect(result).toContain('# Test Wiki')
    expect(result).toContain('Generated content')
  })

  it('calls llm with the fragments included', async () => {
    const llm = vi.fn().mockResolvedValue('---\ntype: test\n---\n# Content')
    const fragments = ['fragment one content', 'fragment two content']

    await regenerateWiki('t1', 'belief', fragments, 'model', llm)

    expect(llm).toHaveBeenCalledOnce()
    const user = llm.mock.calls[0][1] as string
    expect(user).toContain('fragment one content')
    expect(user).toContain('fragment two content')
  })

  it('returns body as-is when llm returns no frontmatter', async () => {
    const llm = vi.fn().mockResolvedValue('Some content without frontmatter')

    const result = await regenerateWiki('t1', 'project', ['frag'], 'model', llm)

    expect(result).not.toMatch(/^---/)
    expect(result).toBe('Some content without frontmatter')
  })

  it('covers all 10 thread types with loadable YAML specs', () => {
    expect(THREAD_WIKI_TYPES).toHaveLength(10)
    for (const type of THREAD_WIKI_TYPES) {
      // Each type should load without error
      const spec = loadWikiGenerationSpec(type, {
        fragments: 'test fragment',
        title: 'Test',
        date: '2026-01-01',
        count: 1,
      })
      expect(spec.system).toBeDefined()
      expect(spec.user).toBeDefined()
    }
  })

  it('uses decision template structure for decision type', async () => {
    const llm = vi
      .fn()
      .mockResolvedValue('---\ntype: decision\n---\n# Decision\n## The Decision\nWe chose X')

    const result = await regenerateWiki('t1', 'decision', ['choice content'], 'model', llm)

    const user = llm.mock.calls[0][1] as string
    expect(user.toLowerCase()).toContain('decision')
    expect(user).toContain('Alternatives Considered')
    expect(result).toContain('Decision')
  })

  it('falls back to log type for unknown types', async () => {
    const llm = vi.fn().mockResolvedValue('Some content')

    const result = await regenerateWiki('t1', 'unknown_type', ['frag'], 'model', llm)

    // Should still work — falls back to 'log' type
    expect(result).toBeTruthy()
  })
})
