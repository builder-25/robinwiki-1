import { describe, it, expect } from 'vitest'
import type { WikiRef } from '@/lib/sidecarTypes'
import { substituteTokensInHtml, refToHref, type RefsMap } from './htmlTokenSubstitute'

function makeContainer(html: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = html
  document.body.appendChild(div)
  return div
}

function cleanup(el: HTMLElement): void {
  el.remove()
}

const personRef: WikiRef = {
  kind: 'person',
  id: 'p-sarah',
  slug: 'sarah-chen',
  label: 'Sarah Chen',
  relationship: 'Friend',
}

const fragmentRef: WikiRef = {
  kind: 'fragment',
  id: 'f-alpha',
  slug: 'alpha',
  label: 'Alpha fragment',
  snippet: 'A snippet.',
}

const wikiRef: WikiRef = {
  kind: 'wiki',
  id: 'w-beta',
  slug: 'beta',
  label: 'Beta Wiki',
  wikiType: 'reference',
}

const entryRef: WikiRef = {
  kind: 'entry',
  id: 'e-gamma',
  slug: 'gamma',
  label: 'Gamma Entry',
  createdAt: '2025-01-01',
}

describe('refToHref', () => {
  it('returns /wiki/people/:id for person refs', () => {
    expect(refToHref(personRef)).toBe('/wiki/people/p-sarah')
  })

  it('returns /wiki/fragments/:id for fragment refs', () => {
    expect(refToHref(fragmentRef)).toBe('/wiki/fragments/f-alpha')
  })

  it('returns /wiki/entries/:id for entry refs', () => {
    expect(refToHref(entryRef)).toBe('/wiki/entries/e-gamma')
  })

  it('returns /wiki/:id for wiki refs (default branch)', () => {
    expect(refToHref(wikiRef)).toBe('/wiki/w-beta')
  })
})

describe('substituteTokensInHtml', () => {
  it('replaces a single resolved token with a chip anchor', () => {
    const container = makeContainer('<p>See [[person:sarah-chen]] for context.</p>')
    const refs: RefsMap = { 'person:sarah-chen': personRef }
    try {
      substituteTokensInHtml(container, refs)
      const anchor = container.querySelector('a.wchip')
      expect(anchor).not.toBeNull()
      expect(anchor!.getAttribute('href')).toBe('/wiki/people/p-sarah')
      expect(anchor!.getAttribute('data-slot')).toBe('wiki-chip')
      expect(anchor!.textContent).toBe('Sarah Chen')
      // Surrounding text preserved.
      expect(container.textContent).toContain('See ')
      expect(container.textContent).toContain(' for context.')
    } finally {
      cleanup(container)
    }
  })

  it('replaces multiple tokens of different kinds in one pass', () => {
    const container = makeContainer(
      '<p>[[person:sarah-chen]] wrote [[fragment:alpha]] for [[wiki:beta]].</p>',
    )
    const refs: RefsMap = {
      'person:sarah-chen': personRef,
      'fragment:alpha': fragmentRef,
      'wiki:beta': wikiRef,
    }
    try {
      substituteTokensInHtml(container, refs)
      const anchors = Array.from(container.querySelectorAll('a.wchip'))
      expect(anchors).toHaveLength(3)
      expect(anchors.map((a) => a.getAttribute('href'))).toEqual([
        '/wiki/people/p-sarah',
        '/wiki/fragments/f-alpha',
        '/wiki/w-beta',
      ])
      expect(anchors.map((a) => a.textContent)).toEqual([
        'Sarah Chen',
        'Alpha fragment',
        'Beta Wiki',
      ])
    } finally {
      cleanup(container)
    }
  })

  it('leaves unresolved tokens as raw literal text (graceful drop per Q1)', () => {
    const container = makeContainer('<p>Ghost [[person:ghost]] and [[person:sarah-chen]] here.</p>')
    const refs: RefsMap = { 'person:sarah-chen': personRef }
    try {
      substituteTokensInHtml(container, refs)
      // The resolved token became an anchor.
      const anchor = container.querySelector('a.wchip')
      expect(anchor).not.toBeNull()
      expect(anchor!.textContent).toBe('Sarah Chen')
      // The unresolved token survives as literal text.
      expect(container.textContent).toContain('[[person:ghost]]')
      // Only one chip was rendered.
      expect(container.querySelectorAll('a.wchip')).toHaveLength(1)
    } finally {
      cleanup(container)
    }
  })

  it('does NOT substitute tokens inside <code> tags — token text renders as literal source', () => {
    const container = makeContainer('<p>See <code>[[person:sarah-chen]]</code> token.</p>')
    const refs: RefsMap = { 'person:sarah-chen': personRef }
    try {
      substituteTokensInHtml(container, refs)
      expect(container.querySelectorAll('a.wchip')).toHaveLength(0)
      expect(container.querySelector('code')!.textContent).toBe('[[person:sarah-chen]]')
    } finally {
      cleanup(container)
    }
  })

  it('does NOT substitute tokens inside <pre> blocks — preserves code samples verbatim', () => {
    const container = makeContainer(
      '<pre><code>fn example() { [[person:sarah-chen]] }</code></pre>',
    )
    const refs: RefsMap = { 'person:sarah-chen': personRef }
    try {
      substituteTokensInHtml(container, refs)
      expect(container.querySelectorAll('a.wchip')).toHaveLength(0)
      expect(container.querySelector('pre')!.textContent).toContain('[[person:sarah-chen]]')
    } finally {
      cleanup(container)
    }
  })

  it('does NOT rewrap tokens already inside an existing <a> element', () => {
    const container = makeContainer(
      '<p><a href="/existing">Existing with [[person:sarah-chen]] inside</a> outside.</p>',
    )
    const refs: RefsMap = { 'person:sarah-chen': personRef }
    try {
      substituteTokensInHtml(container, refs)
      // The existing anchor is preserved, and the token inside is NOT nested into a new anchor.
      const anchors = Array.from(container.querySelectorAll('a'))
      expect(anchors).toHaveLength(1)
      expect(anchors[0].getAttribute('href')).toBe('/existing')
      // The text inside includes the raw token still.
      expect(anchors[0].textContent).toContain('[[person:sarah-chen]]')
    } finally {
      cleanup(container)
    }
  })

  it('is a no-op on containers with no tokens present', () => {
    const container = makeContainer('<p>Nothing special here.</p>')
    const refs: RefsMap = { 'person:sarah-chen': personRef }
    const before = container.innerHTML
    try {
      substituteTokensInHtml(container, refs)
      expect(container.innerHTML).toBe(before)
    } finally {
      cleanup(container)
    }
  })

  it('is idempotent: running twice produces the same DOM', () => {
    const container = makeContainer('<p>[[person:sarah-chen]] again.</p>')
    const refs: RefsMap = { 'person:sarah-chen': personRef }
    try {
      substituteTokensInHtml(container, refs)
      const afterFirst = container.innerHTML
      substituteTokensInHtml(container, refs)
      expect(container.innerHTML).toBe(afterFirst)
    } finally {
      cleanup(container)
    }
  })
})
