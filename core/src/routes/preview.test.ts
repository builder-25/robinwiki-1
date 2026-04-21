import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'

// ── Mocks ───────────────────────────────────────────────────────────────────
//
// We simulate the real session middleware: a request with an `x-test-auth`
// header acts as signed-in; anything else gets a 401. The production
// middleware reads a better-auth cookie — the behavior we care about here is
// just the 401 gate.
vi.mock('../middleware/session.js', () => ({
  sessionMiddleware: vi.fn(async (c: any, next: any) => {
    const token = c.req.header('x-test-auth')
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    c.set('userId', 'test-user-1')
    await next()
  }),
}))

// ── Import under test (after mocks) ────────────────────────────────────────

const { previewRouter } = await import('./preview.js')
const { wikiSidecarFixture } = await import('@robin/shared/fixtures')
const { wikiDetailResponseSchema } = await import('../schemas/wikis.schema.js')

const app = new Hono()
app.route('/preview', previewRouter)

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function postAuthed(path: string, body: unknown) {
  return postJson(path, body, { 'x-test-auth': 'test' })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('preview router — GET /preview/wiki/fixture', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the fixture without auth', async () => {
    const res = await app.request('/preview/wiki/fixture')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe(wikiSidecarFixture.id)
    expect(json.slug).toBe(wikiSidecarFixture.slug)
    expect(Object.keys(json.refs)).toEqual(expect.arrayContaining([
      'person:sarah-chen',
      'person:alex-kim',
      'fragment:frag-overview-1',
      'wiki:onboarding-security',
      'entry:entry-kickoff',
    ]))
  })

  it('fixture parses clean through wikiDetailResponseSchema', async () => {
    const res = await app.request('/preview/wiki/fixture')
    const json = await res.json()

    // Proves the fixture shape matches the canonical wiki detail response.
    const parsed = wikiDetailResponseSchema.parse(json)
    expect(parsed.refs['person:sarah-chen']).toBeDefined()
    expect(parsed.sections.length).toBeGreaterThanOrEqual(4)
    expect(parsed.infobox).not.toBeNull()
  })

  it('fixture includes no entry for the intentional ghost token', async () => {
    // Covers the graceful-drop guarantee from CONTRACT §8 — unresolved
    // tokens never leak into the refs map.
    const res = await app.request('/preview/wiki/fixture')
    const json = await res.json()
    expect(json.refs['person:ghost']).toBeUndefined()
  })
})

describe('preview router — POST /preview/wiki', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects unauthenticated requests with 401', async () => {
    const res = await postJson('/preview/wiki', { markdown: '# Hi' })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('resolves fixture refs when no override is supplied', async () => {
    const res = await postAuthed('/preview/wiki', {
      markdown: '# Hi\n\nHello [[person:sarah-chen]].',
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.refs['person:sarah-chen']).toMatchObject({
      kind: 'person',
      slug: 'sarah-chen',
      label: 'Sarah Chen',
    })
  })

  it('gives refsOverride precedence over the fixture fallback', async () => {
    const customRef = {
      kind: 'person' as const,
      id: 'custom-1',
      slug: 'custom',
      label: 'Custom Person',
      relationship: 'test',
    }
    const res = await postAuthed('/preview/wiki', {
      markdown: 'Meet [[person:custom]] and [[person:sarah-chen]].',
      refsOverride: { 'person:custom': customRef },
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.refs['person:custom']).toEqual(customRef)
    // Fixture fallback still works for tokens not in the override.
    expect(json.refs['person:sarah-chen']).toMatchObject({ label: 'Sarah Chen' })
  })

  it('drops unresolvable tokens silently but still renders sections', async () => {
    const res = await postAuthed('/preview/wiki', {
      markdown: '# Top\n\n## Body\n\nSee [[person:ghost]] (unknown).',
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.refs['person:ghost']).toBeUndefined()
    expect(json.sections.map((s: { anchor: string }) => s.anchor)).toEqual([
      'top',
      'body',
    ])
  })

  it('suffixes duplicate heading anchors with -1', async () => {
    const res = await postAuthed('/preview/wiki', {
      markdown: '## Notes\n\nfirst\n\n## Notes\n\nsecond',
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    const anchors = json.sections.map((s: { anchor: string }) => s.anchor)
    expect(anchors).toEqual(['notes', 'notes-1'])
  })

  it('attaches resolved citations to matching sections', async () => {
    const res = await postAuthed('/preview/wiki', {
      markdown: '## Overview\n\nbody',
      citationDeclarations: [
        { sectionAnchor: 'overview', fragmentIds: ['frag-1', 'frag-2'] },
      ],
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    const overview = json.sections.find((s: { anchor: string }) => s.anchor === 'overview')
    expect(overview.citations).toHaveLength(2)
    expect(overview.citations[0]).toMatchObject({
      fragmentId: 'frag-1',
      fragmentSlug: 'frag-1',
    })
  })

  it('returns 400 on malformed request bodies', async () => {
    const res = await postAuthed('/preview/wiki', { markdown: '' })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid request body')
  })
})
