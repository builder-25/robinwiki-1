#!/usr/bin/env tsx
/**
 * CLI entry point for seeding the Transformer-architecture wiki fixture.
 *
 * Ergonomic shortcut: a user or dev can run `pnpm -C core seed-fixture`
 * and immediately navigate to `/wiki/transformer-architecture` in the
 * browser without waiting on the LLM regen pipeline.
 *
 * The fixture is the canonical design sample (packages/shared/src/fixtures/
 * wikiSidecarFixture.ts). The actual seeding logic lives in
 * `core/src/lib/seedFixture.ts` so the bootstrap path can share it.
 *
 * Identity policy and idempotency are documented in the library module.
 *
 * Flags:
 *   --dry-run    Report the intended projection without writing. No DB
 *                connection required — useful in CI or fresh worktrees.
 *
 * Usage:
 *   pnpm -C core seed-fixture
 *   pnpm -C core seed-fixture -- --dry-run
 *   npx tsx scripts/seed-fixture.ts --dry-run
 */

import 'dotenv/config'
import { logger } from '../src/lib/logger.js'
// Pure projection — no DB dependency, safe for --dry-run without DATABASE_URL.
import { projectFixture } from '../src/lib/seedFixtureProjection.js'

const log = logger.child({ component: 'seed-fixture' })

const DRY_RUN = process.argv.includes('--dry-run')

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

async function main() {
  if (DRY_RUN) {
    log.info('running in --dry-run mode (no DB writes)')
    await runDryRun()
    process.exit(0)
  }

  // Import lazily so dry-run doesn't require DATABASE_URL.
  const { seedFixture } = await import('../src/lib/seedFixture.js')
  await seedFixture()
  process.exit(0)
}

main().catch((err) => {
  log.fatal({ err }, 'seed-fixture failed')
  process.exit(1)
})
