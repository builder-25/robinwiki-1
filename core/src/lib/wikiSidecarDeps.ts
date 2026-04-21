/**
 * Database-backed factory for `SidecarDeps`. Used by wiki/entry/person read
 * handlers to satisfy the `deps` parameter of `buildSidecar`. Keeping this
 * out of `wikiSidecar.ts` preserves the purity of the builder itself.
 */
import { and, eq, isNull } from 'drizzle-orm'
import type { WikiCitation, WikiRef } from '@robin/shared/schemas/sidecar'
import type { SidecarDeps } from './wikiSidecar.js'
import type { DB } from '../db/client.js'
import { wikis, people, fragments, entries } from '../db/schema.js'

function snippet(content: string): string {
  return content.length > 200 ? content.slice(0, 200) : content
}

export function makeSidecarDeps(db: DB): SidecarDeps {
  const resolveRef = async (kind: string, slug: string): Promise<WikiRef | null> => {
    if (kind === 'person') {
      const [row] = await db
        .select({
          lookupKey: people.lookupKey,
          slug: people.slug,
          name: people.name,
          relationship: people.relationship,
        })
        .from(people)
        .where(and(eq(people.slug, slug), isNull(people.deletedAt)))
        .limit(1)
      if (!row) return null
      return {
        kind: 'person',
        id: row.lookupKey,
        slug: row.slug,
        label: row.name,
        relationship: row.relationship || undefined,
      }
    }

    if (kind === 'wiki') {
      const [row] = await db
        .select({
          lookupKey: wikis.lookupKey,
          slug: wikis.slug,
          name: wikis.name,
          type: wikis.type,
        })
        .from(wikis)
        .where(and(eq(wikis.slug, slug), isNull(wikis.deletedAt)))
        .limit(1)
      if (!row) return null
      return {
        kind: 'wiki',
        id: row.lookupKey,
        slug: row.slug,
        label: row.name,
        wikiType: row.type,
      }
    }

    if (kind === 'fragment') {
      const [row] = await db
        .select({
          lookupKey: fragments.lookupKey,
          slug: fragments.slug,
          title: fragments.title,
          content: fragments.content,
        })
        .from(fragments)
        .where(and(eq(fragments.slug, slug), isNull(fragments.deletedAt)))
        .limit(1)
      if (!row) return null
      return {
        kind: 'fragment',
        id: row.lookupKey,
        slug: row.slug,
        label: row.title,
        snippet: snippet(row.content ?? ''),
      }
    }

    if (kind === 'entry') {
      const [row] = await db
        .select({
          lookupKey: entries.lookupKey,
          slug: entries.slug,
          title: entries.title,
          createdAt: entries.createdAt,
        })
        .from(entries)
        .where(and(eq(entries.slug, slug), isNull(entries.deletedAt)))
        .limit(1)
      if (!row) return null
      return {
        kind: 'entry',
        id: row.lookupKey,
        slug: row.slug,
        label: row.title || row.slug,
        createdAt: row.createdAt.toISOString(),
      }
    }

    return null
  }

  const resolveCitation = async (fragmentId: string): Promise<WikiCitation | null> => {
    const [row] = await db
      .select({
        lookupKey: fragments.lookupKey,
        slug: fragments.slug,
        content: fragments.content,
        createdAt: fragments.createdAt,
      })
      .from(fragments)
      .where(and(eq(fragments.lookupKey, fragmentId), isNull(fragments.deletedAt)))
      .limit(1)
    if (!row) return null
    return {
      fragmentId: row.lookupKey,
      fragmentSlug: row.slug,
      quote: snippet(row.content ?? ''),
      capturedAt: row.createdAt.toISOString(),
    }
  }

  return { resolveRef, resolveCitation }
}
