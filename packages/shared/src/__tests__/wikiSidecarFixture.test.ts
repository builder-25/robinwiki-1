import { describe, expect, it } from 'vitest'
import {
  fixtureMarkdown,
  wikiSidecarFixture,
} from '../fixtures/wikiSidecarFixture.js'
import {
  wikiInfoboxSchema,
  wikiRefsMapSchema,
  wikiSectionSchema,
} from '../schemas/sidecar.js'
import { z } from 'zod'

// The canonical sidecar shape from CONTRACT §§3-4. Core's
// `wikiDetailResponseSchema` wraps these same schemas (plus thread fields);
// parsing the fixture's sidecar through the shared-layer schemas is the
// tightest check @robin/shared can perform without taking a dep on core.
const sidecarEnvelopeSchema = z.object({
  refs: wikiRefsMapSchema,
  infobox: wikiInfoboxSchema.nullable(),
  sections: z.array(wikiSectionSchema),
})

describe('wikiSidecarFixture', () => {
  it('parses clean through the shared sidecar schemas', () => {
    expect(() =>
      sidecarEnvelopeSchema.parse({
        refs: wikiSidecarFixture.refs,
        infobox: wikiSidecarFixture.infobox,
        sections: wikiSidecarFixture.sections,
      })
    ).not.toThrow()
  })

  it('ships refs for every token kind', () => {
    const keys = Object.keys(wikiSidecarFixture.refs)
    expect(keys.some((k) => k.startsWith('person:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('fragment:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('wiki:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('entry:'))).toBe(true)
  })

  it('includes the documented Transformer co-authors as person refs', () => {
    expect(wikiSidecarFixture.refs['person:ashish-vaswani']).toMatchObject({
      kind: 'person',
      slug: 'ashish-vaswani',
      label: 'Ashish Vaswani',
      relationship: expect.stringContaining('Attention Is All You Need'),
    })
    expect(wikiSidecarFixture.refs['person:noam-shazeer']).toMatchObject({
      kind: 'person',
      slug: 'noam-shazeer',
    })
    expect(wikiSidecarFixture.refs['person:niki-parmar']).toMatchObject({
      kind: 'person',
      slug: 'niki-parmar',
    })
  })

  it('omits the intentionally unresolvable token from the refs map', () => {
    // The markdown references `[[person:anonymous-reviewer]]` so the
    // renderer can prove its graceful-drop path. The refs map must omit
    // it — otherwise the "unresolvable" promise is hollow.
    expect(wikiSidecarFixture.refs).not.toHaveProperty(
      'person:anonymous-reviewer'
    )
    expect(fixtureMarkdown).toContain('[[person:anonymous-reviewer]]')
  })

  it('exercises every infobox valueKind', () => {
    expect(wikiSidecarFixture.infobox).not.toBeNull()
    const valueKinds = new Set(
      wikiSidecarFixture.infobox.rows.map((r) => r.valueKind)
    )
    expect(valueKinds).toEqual(new Set(['text', 'ref', 'date', 'status']))
  })

  it('ships infobox image and caption', () => {
    expect(wikiSidecarFixture.infobox?.image).toMatchObject({
      url: expect.any(String),
      alt: expect.any(String),
    })
    expect(wikiSidecarFixture.infobox?.caption).toEqual(expect.any(String))
  })

  it('covers heading levels 1, 2, and 3', () => {
    const levels = new Set(wikiSidecarFixture.sections.map((s) => s.level))
    expect(levels).toEqual(new Set([1, 2, 3]))
  })

  it('produces a duplicate heading with a -1 anchor suffix', () => {
    const notesAnchors = wikiSidecarFixture.sections
      .filter((s) => s.heading === 'Notes')
      .map((s) => s.anchor)
    expect(notesAnchors).toEqual(['notes', 'notes-1'])
  })

  it('ships at least one section with ≥2 populated citations and one with zero', () => {
    const populated = wikiSidecarFixture.sections.filter(
      (s) => s.citations.length >= 2
    )
    expect(populated.length).toBeGreaterThanOrEqual(1)
    for (const cite of populated[0].citations) {
      expect(cite).toMatchObject({
        fragmentId: expect.any(String),
        fragmentSlug: expect.any(String),
        quote: expect.any(String),
        capturedAt: expect.any(String),
      })
    }
    expect(
      wikiSidecarFixture.sections.some((s) => s.citations.length === 0)
    ).toBe(true)
  })

  it('markdown body references every ref kind at least once', () => {
    expect(fixtureMarkdown).toMatch(/\[\[person:[a-z0-9-]+\]\]/)
    expect(fixtureMarkdown).toMatch(/\[\[fragment:[a-z0-9-]+\]\]/)
    expect(fixtureMarkdown).toMatch(/\[\[wiki:[a-z0-9-]+\]\]/)
    expect(fixtureMarkdown).toMatch(/\[\[entry:[a-z0-9-]+\]\]/)
  })
})
