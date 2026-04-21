/**
 * Exhaustive wiki sidecar fixture.
 *
 * One sample that exercises every affordance of the wiki detail surface:
 * - every token kind (`person`, `fragment`, `wiki`, `entry`)
 * - a deliberately unresolvable token (`[[person:ghost]]`) so the renderer
 *   can prove its graceful-drop path
 * - duplicate heading producing `notes` + `notes-1` anchors
 * - headings at levels 1, 2, and 3
 * - one section with ≥2 populated citations, one section with an empty
 *   citation array
 * - infobox with image, caption, and rows covering every `valueKind`
 *   (`text`, `ref`, `date`, `status`)
 * - refs map entries for every kind the markdown references (minus the
 *   intentional ghost)
 *
 * Consumed by:
 * - `GET /preview/wiki/fixture` in `core/src/routes/preview.ts` — canonical
 *   public design sample for the frontend renderer
 * - `POST /preview/wiki` fallback ref resolver — when a caller's
 *   `refsOverride` misses, we fall back to these refs
 * - Prompt/generator regression tests that need a known-good shape
 */

import type {
  WikiCitation,
  WikiInfobox,
  WikiRef,
  WikiSection,
} from '../schemas/sidecar.js'

/**
 * Raw markdown body for the fixture. Exported separately so `POST /preview/wiki`
 * can use it as a sane default and tests can re-parse it through `buildSidecar`.
 */
export const fixtureMarkdown = `# Robin sample wiki

Short intro paragraph mentioning [[person:sarah-chen]] and [[wiki:onboarding-security]].

## Overview

This section cites [[fragment:frag-overview-1]]. It also mentions [[entry:entry-kickoff]] and a ghost reference [[person:ghost]] that should drop silently.

### Scope

A level-3 heading to exercise deeper section rendering.

## Progress

Work is underway with [[person:alex-kim]].

## Notes

First Notes section — empty citations.

## Notes

Duplicate heading; anchor should be notes-1.
`

const refs: Record<string, WikiRef> = {
  'person:sarah-chen': {
    kind: 'person',
    id: 'p1',
    slug: 'sarah-chen',
    label: 'Sarah Chen',
    relationship: 'coworker',
  },
  'person:alex-kim': {
    kind: 'person',
    id: 'p2',
    slug: 'alex-kim',
    label: 'Alex Kim',
    relationship: 'manager',
  },
  'fragment:frag-overview-1': {
    kind: 'fragment',
    id: 'f1',
    slug: 'frag-overview-1',
    label: 'Project kickoff note',
    snippet: 'We agreed to ship by Q2.',
  },
  'wiki:onboarding-security': {
    kind: 'wiki',
    id: 'w1',
    slug: 'onboarding-security',
    label: 'Onboarding security',
    wikiType: 'project',
  },
  'entry:entry-kickoff': {
    kind: 'entry',
    id: 'e1',
    slug: 'entry-kickoff',
    label: 'Kickoff meeting notes',
    createdAt: '2026-02-01',
  },
  // NOTE: `person:ghost` is intentionally absent — the markdown references it
  // so the renderer can prove its graceful-drop path.
}

const infobox: WikiInfobox = {
  image: { url: '/images/fixture-banner.png', alt: 'Project banner' },
  caption: 'Sample project wiki for design/preview',
  rows: [
    { label: 'Status', value: 'active', valueKind: 'status' },
    { label: 'Goal', value: 'Ship sidecar v1', valueKind: 'text' },
    { label: 'Started', value: '2026-02-01', valueKind: 'date' },
    { label: 'Owner', value: '[[person:sarah-chen]]', valueKind: 'ref' },
  ],
}

const overviewCitations: WikiCitation[] = [
  {
    fragmentId: 'f1',
    fragmentSlug: 'frag-overview-1',
    quote: 'We agreed to ship by Q2.',
    capturedAt: '2026-02-01',
  },
  {
    fragmentId: 'f2',
    fragmentSlug: 'frag-overview-2',
    quote: 'Scoped infobox to 5 fields.',
    capturedAt: '2026-02-05',
  },
]

const sections: WikiSection[] = [
  // H1 covered by the `# Robin sample wiki` title line — emitted as a section
  // so the renderer sees at least one level-1 entry.
  {
    id: 'robin-sample-wiki',
    anchor: 'robin-sample-wiki',
    heading: 'Robin sample wiki',
    level: 1,
    citations: [],
  },
  {
    id: 'overview',
    anchor: 'overview',
    heading: 'Overview',
    level: 2,
    citations: overviewCitations,
  },
  {
    id: 'scope',
    anchor: 'scope',
    heading: 'Scope',
    level: 3,
    citations: [],
  },
  {
    id: 'progress',
    anchor: 'progress',
    heading: 'Progress',
    level: 2,
    citations: [],
  },
  {
    id: 'notes',
    anchor: 'notes',
    heading: 'Notes',
    level: 2,
    citations: [],
  },
  {
    id: 'notes-1',
    anchor: 'notes-1',
    heading: 'Notes',
    level: 2,
    citations: [],
  },
]

/**
 * Full wiki detail payload shaped to match `wikiDetailResponseSchema` from
 * `core/src/schemas/wikis.schema.ts`. Dates are emitted as ISO strings — the
 * schema uses `z.coerce.date()` and accepts them without ceremony.
 */
export const wikiSidecarFixture = {
  // ── Thread/wiki core fields ─────────────────────────────────────
  id: 'wiki-fixture',
  lookupKey: 'wiki-fixture',
  slug: 'sample-wiki',
  name: 'Robin sample wiki',
  type: 'project',
  prompt: '',
  state: 'RESOLVED' as const,
  lastRebuiltAt: '2026-02-10T12:00:00.000Z',
  createdAt: '2026-02-01T09:00:00.000Z',
  updatedAt: '2026-02-10T12:00:00.000Z',
  noteCount: 2,
  lastUpdated: '2026-02-10T12:00:00.000Z',
  shortDescriptor: 'Design preview sample',
  descriptor: 'An exhaustive fixture used by the wiki renderer preview pane.',
  progress: null,

  // ── Wiki detail fields ──────────────────────────────────────────
  wikiContent: fixtureMarkdown,
  content: fixtureMarkdown,
  fragments: [
    {
      id: 'f1',
      slug: 'frag-overview-1',
      title: 'Project kickoff note',
      snippet: 'We agreed to ship by Q2.',
    },
    {
      id: 'f2',
      slug: 'frag-overview-2',
      title: 'Infobox scoping',
      snippet: 'Scoped infobox to 5 fields.',
    },
  ],
  people: [
    { id: 'p1', name: 'Sarah Chen' },
    { id: 'p2', name: 'Alex Kim' },
  ],

  // ── Sidecar (m-wiki-sidecar) ────────────────────────────────────
  refs,
  infobox,
  sections,
}
