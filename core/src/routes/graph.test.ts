import { describe, it, expect, vi } from 'vitest'

// Stub DB and session middleware so importing ./graph.js doesn't pull the
// postgres client at module load. The function under test is pure.
vi.mock('../db/client.js', () => ({ db: {} }))
vi.mock('../middleware/session.js', () => ({
  sessionMiddleware: async (_c: unknown, next: () => Promise<void>) => next(),
}))

const { normalizeNodeType } = await import('./graph.js')

describe('normalizeNodeType', () => {
  it('maps "frag" to "fragment"', () => {
    expect(normalizeNodeType('frag')).toBe('fragment')
  })

  it('maps "raw_source" to "entry" — regression guard for issue #153', () => {
    expect(normalizeNodeType('raw_source')).toBe('entry')
  })

  it('passes canonical API types through unchanged', () => {
    expect(normalizeNodeType('wiki')).toBe('wiki')
    expect(normalizeNodeType('fragment')).toBe('fragment')
    expect(normalizeNodeType('person')).toBe('person')
    expect(normalizeNodeType('entry')).toBe('entry')
  })

  it('passes unknown types through unchanged so downstream validation catches them loudly', () => {
    expect(normalizeNodeType('gadget')).toBe('gadget')
  })
})
