/**
 * Wiki preview router — ergonomic quality-of-life enhancement.
 *
 * These routes exist to support the wiki content editor's live preview pane and to
 * give designers a stable reference render without requiring real DB data. They are
 * NOT part of the canonical wiki API surface:
 *
 * - GET /preview/wiki/fixture — returns a public design sample. Unauthenticated.
 * - POST /preview/wiki — takes user-drafted markdown + optional sidecar inputs and
 *   returns the same shape GET /wikis/:id produces, without writing anything to the
 *   database. Authenticated.
 *
 * Callers MUST NOT treat responses from these routes as persistent wiki state. No
 * data is stored. No regen is triggered. No fragment IDs are validated against
 * user-scoped data.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { wikiSidecarFixture } from '@robin/shared/fixtures'
import type { WikiRef } from '@robin/shared/schemas/sidecar'
import {
  wikiCitationDeclarationSchema,
  wikiMetadataSchema,
  wikiRefsMapSchema,
} from '@robin/shared/schemas/sidecar'
import { sessionMiddleware } from '../middleware/session.js'
import { buildSidecar } from '../lib/wikiSidecar.js'

const previewRouter = new Hono()

// ── GET /preview/wiki/fixture — public design sample ──────────────
// Unauthenticated on purpose. The fixture contains no user data.
previewRouter.get('/wiki/fixture', (c) => c.json(wikiSidecarFixture))

// ── POST /preview/wiki — authenticated draft preview ──────────────
// Everything below is session-gated. We apply the middleware narrowly so the
// fixture route above stays public.
previewRouter.use('/wiki', sessionMiddleware)

const previewRequestSchema = z.object({
  markdown: z.string().min(1),
  metadata: wikiMetadataSchema.nullable().optional(),
  citationDeclarations: z.array(wikiCitationDeclarationSchema).default([]),
  refsOverride: wikiRefsMapSchema.optional(),
})

const fixtureRefs = wikiSidecarFixture.refs as Record<string, WikiRef>

previewRouter.post('/wiki', async (c) => {
  let body: z.infer<typeof previewRequestSchema>
  try {
    const raw = await c.req.json()
    body = previewRequestSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', fields: err.flatten() }, 400)
    }
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const sidecar = await buildSidecar({
    content: body.markdown,
    metadata: body.metadata ?? null,
    citationDeclarations: body.citationDeclarations,
    deps: {
      // Stub resolver: prefer caller-supplied override, fall back to the fixture
      // refs (so a minimal POST with no overrides still renders familiar tokens),
      // otherwise drop.
      resolveRef: async (kind, slug) => {
        const key = `${kind}:${slug}`
        return body.refsOverride?.[key] ?? fixtureRefs[key] ?? null
      },
      // Stub citation resolver: every declared fragmentId echoes back as a
      // pseudo-citation so the caller sees the declaration flow end-to-end.
      resolveCitation: async (fragmentId) => ({
        fragmentId,
        fragmentSlug: fragmentId,
        capturedAt: new Date().toISOString().slice(0, 10),
      }),
    },
  })

  // Mirror the GET /wikis/:id envelope. `id`/`slug` are static sentinels —
  // nothing about this response is persisted or canonical.
  return c.json({
    id: 'preview',
    lookupKey: 'preview',
    slug: 'preview',
    name: 'Preview',
    type: 'project',
    prompt: '',
    state: 'RESOLVED',
    lastRebuiltAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    noteCount: 0,
    lastUpdated: new Date().toISOString(),
    shortDescriptor: '',
    descriptor: '',
    progress: null,
    wikiContent: body.markdown,
    content: body.markdown,
    fragments: [],
    people: [],
    refs: sidecar.refs,
    infobox: sidecar.infobox,
    sections: sidecar.sections,
  })
})

export { previewRouter }
