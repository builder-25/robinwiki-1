import type { WikiRef } from '@robin/shared/schemas/sidecar'

/**
 * Title-case a slug: "jane-doe" → "Jane Doe".
 * Used as fallback when a token has no matching ref entry.
 */
function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/**
 * Strip wiki-link tokens and citation markers from markdown content,
 * producing a clean, token-efficient body for LLM consumption.
 *
 * 1. Replaces `[[kind:slug]]` tokens with the resolved label from the
 *    refs map, falling back to title-casing the slug when no ref exists.
 * 2. Removes inline citation markers like `[1]`, `[2]`, etc.
 *
 * @param content - Raw markdown with wiki-link tokens
 * @param refs    - Sidecar refs map keyed by `${kind}:${slug}`
 * @returns Clean markdown string
 */
export function stripWikiContent(
  content: string,
  refs: Record<string, WikiRef>
): string {
  // Replace [[kind:slug]] tokens with resolved labels
  let result = content.replace(/\[\[([a-z]+):([a-z0-9-]+)\]\]/g, (_match, _kind, slug) => {
    const key = `${_kind}:${slug}`
    const ref = refs[key]
    return ref?.label ?? titleCase(slug)
  })

  // Strip inline citation markers [N] (e.g. [1], [12])
  result = result.replace(/\[(\d+)\]/g, '')

  return result
}
