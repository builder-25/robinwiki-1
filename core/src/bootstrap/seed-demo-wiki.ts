import { logger } from '../lib/logger.js'
import { isFixtureSeeded, seedFixture } from '../lib/seedFixture.js'

const log = logger.child({ component: 'seed-demo-wiki' })

export interface SeedDemoWikiResult {
  seeded: boolean
  skipped: boolean
  reason?: 'already-present' | 'error'
}

/**
 * Seed the Transformer demo wiki on first-run if not already present.
 *
 * Runs after first-user provisioning inside `ensureFirstUser`. Single-tenant
 * app: "first user created" = "fresh instance", so this doubles as onboarding
 * content and an end-to-end smoke test of the wiki stack.
 *
 * Idempotent: gated on slug presence. If the fixture wiki row exists (by
 * slug, not soft-deleted) this is a no-op. A user who deletes the demo wiki
 * will not have it re-seeded — the bootstrap only re-seeds when the row is
 * absent, and first-user provisioning only fires once per instance lifetime.
 *
 * Errors are swallowed with an error log so a seed failure never blocks
 * user sign-in. The fixture is a nice-to-have; a broken DB-row shape should
 * surface via the dedicated bootstrap checks (runMigrations, ensurePgvector)
 * rather than by preventing login.
 */
export async function seedDemoWiki(): Promise<SeedDemoWikiResult> {
  try {
    if (await isFixtureSeeded()) {
      log.info('Demo wiki already present, skipping seed')
      return { seeded: false, skipped: true, reason: 'already-present' }
    }

    const result = await seedFixture()
    log.info(
      {
        wikiKey: result.wikiKey,
        slug: result.slug,
        people: result.peopleCount,
        fragments: result.fragmentCount,
        entry: result.entryCount,
      },
      'Seeded Transformer demo wiki'
    )
    return { seeded: true, skipped: false }
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      'seed-demo-wiki failed — continuing without demo wiki'
    )
    return { seeded: false, skipped: true, reason: 'error' }
  }
}
