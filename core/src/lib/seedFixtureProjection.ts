/**
 * Pure projection of the Transformer wiki fixture into DB-row shapes.
 *
 * Split from `seedFixture.ts` so the CLI dry-run path can exercise the
 * projection logic without importing the DB client (which throws at
 * module load when DATABASE_URL is unset).
 */

import { wikiSidecarFixture, fixtureMarkdown } from '@robin/shared/fixtures'
import type {
  WikiCitationDeclaration,
  WikiMetadata,
  WikiRef,
} from '@robin/shared/schemas/sidecar'

export interface SeedPerson {
  slug: string
  name: string
  relationship: string
}

export interface SeedFragment {
  slug: string
  title: string
  content: string
}

export interface SeedEntry {
  slug: string
  title: string
  content: string
}

export interface ProjectedFixture {
  wiki: {
    slug: string
    name: string
    type: string
    content: string
    metadata: WikiMetadata
    citationDeclarations: WikiCitationDeclaration[]
  }
  people: SeedPerson[]
  fragments: SeedFragment[]
  entry: SeedEntry | null
}

export function projectFixture(): ProjectedFixture {
  const refs = wikiSidecarFixture.refs as Record<string, WikiRef>

  const projectedPeople: SeedPerson[] = []
  const projectedFragments: SeedFragment[] = []
  let entry: SeedEntry | null = null

  for (const ref of Object.values(refs)) {
    if (ref.kind === 'person') {
      projectedPeople.push({
        slug: ref.slug,
        name: ref.label,
        relationship: ref.relationship ?? '',
      })
    } else if (ref.kind === 'fragment') {
      projectedFragments.push({
        slug: ref.slug,
        title: ref.label,
        // `snippet` on a fragment ref is the one-sentence claim; the DB's
        // fragment.content needs a full body. Fall back to the label if
        // the snippet is absent.
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

  return { wiki, people: projectedPeople, fragments: projectedFragments, entry }
}

/**
 * The slug of the fixture wiki. Exposed for the bootstrap gate so it
 * can check for presence without pulling in the full projection.
 */
export const FIXTURE_WIKI_SLUG = wikiSidecarFixture.slug
