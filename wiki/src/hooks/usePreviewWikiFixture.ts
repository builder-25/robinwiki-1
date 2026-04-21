'use client'

/**
 * Fetch the canonical wiki preview fixture.
 *
 * Backs the `/wiki/preview/fixture` design-validation route. The fixture is
 * an unauthenticated endpoint on the core server (`GET /preview/wiki/fixture`)
 * that returns the same envelope shape as `GET /wikis/:id`, populated with
 * an exhaustive sample exercising every sidecar affordance (every token kind,
 * an intentionally unresolvable `[[person:ghost]]`, duplicate headings,
 * citations, infobox with all `valueKind` variants).
 *
 * Implementation note: the preview routes are not yet registered in the SDK's
 * OpenAPI spec, so this hook hand-writes the fetch rather than going through
 * `@/lib/api`. The call still flows through Next's `/api/*` rewrite to hit
 * the core server. Swap to a generated SDK call once the preview routes are
 * added to `core/openapi.json` and the wiki SDK regenerates.
 */

import { useQuery } from '@tanstack/react-query'
import type {
  WikiDetailResponseSchema,
} from '@/lib/generated/types.gen'
import type {
  WikiInfobox,
  WikiRef,
  WikiSection,
} from '@/lib/sidecarTypes'

/**
 * Preview response envelope — mirrors `WikiDetailResponseSchema` plus the
 * sidecar fields and the preview-only `content` mirror field. Typed as a
 * local alias so consumers see sidecar fields as definite (non-optional)
 * once the fixture has loaded; the fixture always populates them.
 */
export type PreviewWikiFixture = WikiDetailResponseSchema & {
  content: string
  refs: Record<string, WikiRef>
  infobox: WikiInfobox | null
  sections: WikiSection[]
}

async function fetchPreviewWikiFixture(): Promise<PreviewWikiFixture> {
  const res = await fetch('/api/preview/wiki/fixture', {
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      body || `Failed to load preview fixture: ${res.status} ${res.statusText}`,
    )
  }
  return (await res.json()) as PreviewWikiFixture
}

export function usePreviewWikiFixture() {
  return useQuery({
    queryKey: ['preview', 'wiki', 'fixture'],
    queryFn: fetchPreviewWikiFixture,
    // Fixture is static — no need to refetch on window focus, and it can
    // stay fresh indefinitely within a session.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  })
}
