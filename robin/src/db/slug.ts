import { eq, and } from 'drizzle-orm'
import { entries, fragments } from './schema.js'
import { checkSlugCollision } from '@robin/shared'

/**
 * @summary Resolve a unique slug for an entry, appending -2, -3 etc. on collision.
 *
 * @param database - Drizzle db instance
 * @param userId   - Owner of the entry
 * @param slug     - Candidate slug from generateSlug()
 * @returns A slug guaranteed unique for (userId, slug) in the entries table
 */
export async function resolveEntrySlug(database: any, userId: string, slug: string): Promise<string> {
  return checkSlugCollision(slug, async (candidate) => {
    const [existing] = await database
      .select({ key: entries.lookupKey })
      .from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.slug, candidate)))
      .limit(1)
    return !!existing
  })
}

/**
 * @summary Resolve a unique slug for a fragment, appending -2, -3 etc. on collision.
 *
 * @param database - Drizzle db instance
 * @param userId   - Owner of the fragment
 * @param slug     - Candidate slug from generateSlug()
 * @returns A slug guaranteed unique for (userId, slug) in the fragments table
 */
export async function resolveFragmentSlug(database: any, userId: string, slug: string): Promise<string> {
  return checkSlugCollision(slug, async (candidate) => {
    const [existing] = await database
      .select({ key: fragments.lookupKey })
      .from(fragments)
      .where(and(eq(fragments.userId, userId), eq(fragments.slug, candidate)))
      .limit(1)
    return !!existing
  })
}
