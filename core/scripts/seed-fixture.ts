#!/usr/bin/env tsx
/**
 * Seed the Transformer-architecture wiki fixture into Postgres.
 *
 * Ergonomic shortcut: a user or dev can run `pnpm -C core seed-fixture` and
 * immediately navigate to `/wiki/transformer-architecture` in the browser
 * without waiting on the LLM regen pipeline.
 *
 * The fixture is the canonical design sample (packages/shared/src/fixtures/
 * wikiSidecarFixture.ts). This script materialises its people/fragments/
 * entry/wiki rows and the edges that connect them, mirroring what the real
 * ingestion + regen pipeline produces end-to-end.
 *
 * Identity policy:
 * - Fixture-declared `id` values (e.g. 'p-ashish-vaswani') are decorative for
 *   frontend preview. They are NOT used as primary keys here.
 * - Primary keys are freshly generated via `makeLookupKey` on first seed.
 * - Rows are keyed by **slug** on subsequent runs (the sidecar builder also
 *   resolves tokens by slug), so re-running updates in place without
 *   duplicating.
 *
 * Flags:
 *   --dry-run    Log every intended insert/update without writing. No DB
 *                connection required — useful in CI or fresh worktrees.
 *
 * Usage:
 *   pnpm -C core seed-fixture
 *   pnpm -C core seed-fixture -- --dry-run
 *   npx tsx scripts/seed-fixture.ts --dry-run
 */

import 'dotenv/config'
import { and, eq, isNull } from 'drizzle-orm'
import { makeLookupKey } from '@robin/shared'
import { wikiSidecarFixture, fixtureMarkdown } from '@robin/shared/fixtures'
import type {
  WikiCitationDeclaration,
  WikiMetadata,
  WikiRef,
} from '@robin/shared/schemas/sidecar'
import { logger } from '../src/lib/logger.js'

const log = logger.child({ component: 'seed-fixture' })

const DRY_RUN = process.argv.includes('--dry-run')

// ── Fixture → seed projections ────────────────────────────────────
// The fixture carries refs/infobox/sections/citations shaped for the
// frontend detail response. The seed needs DB-row projections: people,
// fragments, and a single entry.

interface SeedPerson {
  slug: string
  name: string
  relationship: string
}

interface SeedFragment {
  slug: string
  title: string
  content: string
}

interface SeedEntry {
  slug: string
  title: string
  content: string
}

function projectFixture() {
  const refs = wikiSidecarFixture.refs as Record<string, WikiRef>

  const people: SeedPerson[] = []
  const fragments: SeedFragment[] = []
  let entry: SeedEntry | null = null

  for (const ref of Object.values(refs)) {
    if (ref.kind === 'person') {
      people.push({
        slug: ref.slug,
        name: ref.label,
        relationship: ref.relationship ?? '',
      })
    } else if (ref.kind === 'fragment') {
      fragments.push({
        slug: ref.slug,
        title: ref.label,
        // `snippet` on a fragment ref is the one-sentence claim; the DB's
        // fragment.content needs a full body. Fall back to the label if the
        // snippet is absent.
        content: ref.snippet ?? ref.label,
      })
    } else if (ref.kind === 'entry') {
      entry = {
        slug: ref.slug,
        title: ref.label,
        // Entries carry longer raw-source text. The fixture doesn't expose
        // the full abstract, so seed with a compact canonical summary.
        content:
          'Abstract — Attention Is All You Need. The dominant sequence transduction models are based on complex recurrent or convolutional neural networks in an encoder-decoder configuration. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
      }
    }
  }

  const wiki = {
    slug: wikiSidecarFixture.slug,
    name: wikiSidecarFixture.name,
    type: wikiSidecarFixture.type,
    content: fixtureMarkdown,
    metadata: { infobox: wikiSidecarFixture.infobox } satisfies WikiMetadata,
    // Derive citation declarations from section[].citations so the sidecar
    // builder re-attaches them on read without re-running the LLM.
    citationDeclarations: wikiSidecarFixture.sections
      .filter((s) => s.citations.length > 0)
      .map(
        (s): WikiCitationDeclaration => ({
          sectionAnchor: s.anchor,
          // fragmentIds are resolved to real lookup keys at seed time below,
          // so leave the fragmentSlugs here as a placeholder we patch up.
          fragmentIds: s.citations.map((c) => c.fragmentSlug),
        })
      ),
  }

  return { wiki, people, fragments, entry }
}

// ── Dry-run path ──────────────────────────────────────────────────
// Everything below the dry-run branch assumes a working DB connection.

async function runDryRun() {
  const { wiki, people, fragments, entry } = projectFixture()

  log.info(
    { slug: wiki.slug, type: wiki.type },
    'DRY RUN — would upsert wiki'
  )
  log.info(
    { people: people.map((p) => p.slug) },
    `DRY RUN — would upsert ${people.length} people`
  )
  log.info(
    { fragments: fragments.map((f) => f.slug) },
    `DRY RUN — would upsert ${fragments.length} fragments`
  )
  if (entry) {
    log.info({ entry: entry.slug }, 'DRY RUN — would upsert 1 entry')
  }

  const personEdges = fragments.length * people.length
  log.info(
    {
      wikiFragmentEdges: fragments.length,
      fragmentPersonEdges: personEdges,
      entryFragmentEdges: entry ? fragments.length : 0,
    },
    `DRY RUN — would create edges: ${fragments.length} FRAGMENT_IN_WIKI, ${personEdges} FRAGMENT_MENTIONS_PERSON, ${entry ? fragments.length : 0} ENTRY_HAS_FRAGMENT`
  )

  log.info(
    `DRY RUN complete. Seeded wiki ${wiki.slug} would result in ${people.length} people, ${fragments.length} fragments, ${entry ? 1 : 0} entry`
  )
}

// ── Live path ─────────────────────────────────────────────────────

async function runLive() {
  // Import lazily so dry-run doesn't require DATABASE_URL.
  const { db } = await import('../src/db/client.js')
  const { wikis, people, fragments, entries, edges } = await import(
    '../src/db/schema.js'
  )

  const projected = projectFixture()

  // ── Wiki: upsert by slug ────────────────────────────────────────
  const [existingWiki] = await db
    .select({ lookupKey: wikis.lookupKey })
    .from(wikis)
    .where(and(eq(wikis.slug, projected.wiki.slug), isNull(wikis.deletedAt)))
    .limit(1)

  const wikiKey =
    existingWiki?.lookupKey ?? makeLookupKey('wiki')

  if (existingWiki) {
    await db
      .update(wikis)
      .set({
        name: projected.wiki.name,
        type: projected.wiki.type,
        content: projected.wiki.content,
        state: 'RESOLVED',
        metadata: projected.wiki.metadata,
        // citationDeclarations need fragmentIds patched after fragment
        // upserts resolve real lookup keys — set below.
        regenerate: false,
        updatedAt: new Date(),
      })
      .where(eq(wikis.lookupKey, wikiKey))
    log.info({ wikiKey, slug: projected.wiki.slug }, 'updated existing wiki')
  } else {
    await db.insert(wikis).values({
      lookupKey: wikiKey,
      slug: projected.wiki.slug,
      name: projected.wiki.name,
      type: projected.wiki.type,
      content: projected.wiki.content,
      state: 'RESOLVED',
      metadata: projected.wiki.metadata,
      regenerate: false,
    })
    log.info({ wikiKey, slug: projected.wiki.slug }, 'inserted new wiki')
  }

  // ── People: upsert by slug ──────────────────────────────────────
  const personKeysBySlug = new Map<string, string>()
  for (const p of projected.people) {
    const [existing] = await db
      .select({ lookupKey: people.lookupKey })
      .from(people)
      .where(and(eq(people.slug, p.slug), isNull(people.deletedAt)))
      .limit(1)

    const key = existing?.lookupKey ?? makeLookupKey('person')
    if (existing) {
      await db
        .update(people)
        .set({
          name: p.name,
          canonicalName: p.name,
          relationship: p.relationship,
          state: 'RESOLVED',
          updatedAt: new Date(),
        })
        .where(eq(people.lookupKey, key))
    } else {
      await db.insert(people).values({
        lookupKey: key,
        slug: p.slug,
        name: p.name,
        canonicalName: p.name,
        relationship: p.relationship,
        state: 'RESOLVED',
        verified: false,
        aliases: [],
      })
    }
    personKeysBySlug.set(p.slug, key)
  }

  // ── Fragments: upsert by slug ───────────────────────────────────
  const fragmentKeysBySlug = new Map<string, string>()
  for (const f of projected.fragments) {
    const [existing] = await db
      .select({ lookupKey: fragments.lookupKey })
      .from(fragments)
      .where(and(eq(fragments.slug, f.slug), isNull(fragments.deletedAt)))
      .limit(1)

    const key = existing?.lookupKey ?? makeLookupKey('frag')
    if (existing) {
      await db
        .update(fragments)
        .set({
          title: f.title,
          content: f.content,
          state: 'RESOLVED',
          updatedAt: new Date(),
        })
        .where(eq(fragments.lookupKey, key))
    } else {
      await db.insert(fragments).values({
        lookupKey: key,
        slug: f.slug,
        title: f.title,
        type: 'observation',
        content: f.content,
        state: 'RESOLVED',
        tags: [],
      })
    }
    fragmentKeysBySlug.set(f.slug, key)
  }

  // ── Entry: upsert by slug ───────────────────────────────────────
  let entryKey: string | null = null
  if (projected.entry) {
    const [existing] = await db
      .select({ lookupKey: entries.lookupKey })
      .from(entries)
      .where(
        and(eq(entries.slug, projected.entry.slug), isNull(entries.deletedAt))
      )
      .limit(1)

    entryKey = existing?.lookupKey ?? makeLookupKey('entry')
    if (existing) {
      await db
        .update(entries)
        .set({
          title: projected.entry.title,
          content: projected.entry.content,
          state: 'RESOLVED',
          updatedAt: new Date(),
        })
        .where(eq(entries.lookupKey, entryKey))
    } else {
      await db.insert(entries).values({
        lookupKey: entryKey,
        slug: projected.entry.slug,
        title: projected.entry.title,
        content: projected.entry.content,
        type: 'thought',
        source: 'seed',
        state: 'RESOLVED',
        ingestStatus: 'complete',
      })
    }
  }

  // ── Patch citationDeclarations with real fragment lookup keys ──
  // Fixture citations reference fragmentSlugs, but the column stores
  // fragmentIds that must match real lookup keys for buildSidecar to
  // resolve them on read.
  const patchedDeclarations: WikiCitationDeclaration[] =
    projected.wiki.citationDeclarations.map((d) => ({
      sectionAnchor: d.sectionAnchor,
      fragmentIds: d.fragmentIds
        .map((slugOrKey) => fragmentKeysBySlug.get(slugOrKey))
        .filter((k): k is string => !!k),
    }))

  await db
    .update(wikis)
    .set({ citationDeclarations: patchedDeclarations })
    .where(eq(wikis.lookupKey, wikiKey))

  // ── Edges: FRAGMENT_IN_WIKI (every fragment linked to the wiki) ─
  for (const fragKey of fragmentKeysBySlug.values()) {
    await db
      .insert(edges)
      .values({
        id: crypto.randomUUID(),
        srcType: 'fragment',
        srcId: fragKey,
        dstType: 'wiki',
        dstId: wikiKey,
        edgeType: 'FRAGMENT_IN_WIKI',
        attrs: { score: 1.0, method: 'seed', signal: 'strong' },
      })
      .onConflictDoNothing()
  }

  // ── Edges: FRAGMENT_MENTIONS_PERSON (every author mentioned in every
  //          fragment; a coarse model, but matches the wiki body's
  //          intent that the three authors co-wrote the paper being
  //          summarised by every fragment.)
  for (const fragKey of fragmentKeysBySlug.values()) {
    for (const personKey of personKeysBySlug.values()) {
      await db
        .insert(edges)
        .values({
          id: crypto.randomUUID(),
          srcType: 'fragment',
          srcId: fragKey,
          dstType: 'person',
          dstId: personKey,
          edgeType: 'FRAGMENT_MENTIONS_PERSON',
        })
        .onConflictDoNothing()
    }
  }

  // ── Edges: ENTRY_HAS_FRAGMENT (entry → every fragment it spawned) ─
  if (entryKey) {
    for (const fragKey of fragmentKeysBySlug.values()) {
      await db
        .insert(edges)
        .values({
          id: crypto.randomUUID(),
          srcType: 'raw_source',
          srcId: entryKey,
          dstType: 'fragment',
          dstId: fragKey,
          edgeType: 'ENTRY_HAS_FRAGMENT',
        })
        .onConflictDoNothing()
    }
  }

  log.info(
    {
      wikiKey,
      slug: projected.wiki.slug,
      people: projected.people.length,
      fragments: projected.fragments.length,
      entry: projected.entry ? 1 : 0,
    },
    `Seeded wiki ${projected.wiki.slug} (key=${wikiKey}) with ${projected.people.length} people, ${projected.fragments.length} fragments, ${projected.entry ? 1 : 0} entry`
  )
}

async function main() {
  if (DRY_RUN) {
    log.info('running in --dry-run mode (no DB writes)')
    await runDryRun()
    process.exit(0)
  }

  await runLive()
  process.exit(0)
}

main().catch((err) => {
  log.fatal({ err }, 'seed-fixture failed')
  process.exit(1)
})
