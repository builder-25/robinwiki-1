import { eq } from 'drizzle-orm'
import { entries, fragments } from './schema.js'
import { checkSlugCollision } from '@robin/shared'
import type { DB } from './client.js'

/**
 * @summary Resolve a unique slug for an entry, appending -2, -3 etc. on collision.
 *
 * @param database - Drizzle db instance
 * @param slug     - Candidate slug from generateSlug()
 * @returns A slug guaranteed unique in the entries table
 */
export async function resolveEntrySlug(database: DB, slug: string): Promise<string> {
  return checkSlugCollision(slug, async (candidate) => {
    const [existing] = await database
      .select({ key: entries.lookupKey })
      .from(entries)
      .where(eq(entries.slug, candidate))
      .limit(1)
    return !!existing
  })
}

/**
 * @summary Resolve a unique slug for a fragment, appending -2, -3 etc. on collision.
 *
 * @param database - Drizzle db instance
 * @param slug     - Candidate slug from generateSlug()
 * @returns A slug guaranteed unique in the fragments table
 */
export async function resolveFragmentSlug(database: DB, slug: string): Promise<string> {
  return checkSlugCollision(slug, async (candidate) => {
    const [existing] = await database
      .select({ key: fragments.lookupKey })
      .from(fragments)
      .where(eq(fragments.slug, candidate))
      .limit(1)
    return !!existing
  })
}
