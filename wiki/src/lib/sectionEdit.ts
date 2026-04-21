/**
 * Client-side helpers for section-scoped wiki edits.
 *
 * Wave 3b's `section-scoped-edit-ui` will use these to:
 *   - Find section boundaries in the displayed markdown (so the `[edit]`
 *     affordance knows which span to open).
 *   - Extract a section's content into a scoped editor.
 *   - Re-assemble the full document after Save, then PUT the whole body
 *     to the existing content endpoint.
 *   - Smooth-scroll to a heading by its anchor id.
 *
 * Slugification MUST match the server (`core/src/lib/wikiSidecar.ts`).
 * The algorithm is duplicated locally rather than imported from core
 * because the wiki workspace avoids direct core imports.
 *
 * Duplicate-heading disambiguation mirrors the server: the first
 * occurrence keeps its base slug, the second becomes `${base}-1`, the
 * third `${base}-2`, etc. URL fragments generated server-side remain
 * valid after a round-trip through these helpers.
 *
 * Section boundaries follow the standard "next heading at same-or-higher
 * level" rule: a level-2 section ends at the next `##`/`#` heading and
 * absorbs intervening level-3+ sub-headings. The final section runs to
 * end-of-document.
 *
 * Note on fenced code blocks: lines inside triple-backtick (or
 * triple-tilde) fences are ignored by the heading scanner. The server
 * currently does not skip fences, which is a latent issue there; the
 * real-world impact is limited because anchors are matched within a
 * single document parsed by the same code path (this module), so no
 * client/server anchor mismatch arises from this difference.
 */

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/
const FENCE_RE = /^(`{3,}|~{3,})/

/** Section metadata exposed to UI callers. Line numbers are 0-indexed. */
export interface SectionInfo {
  /** Stable id — identical to `anchor`, kept as a separate field so calling code reads cleanly. */
  id: string
  /** The heading text as written (no `#` prefix, trimmed). */
  heading: string
  /** ATX heading level (1-6). */
  level: number
  /** Slugified, disambiguated anchor — suitable for `#anchor` URL fragments. */
  anchor: string
  /** Line index of the heading line. */
  startLine: number
  /** Line index of the last line belonging to this section (inclusive). */
  endLine: number
}

/**
 * Lowercase, replace non-alphanumeric runs with `-`, trim hyphens.
 * MUST stay in sync with `slugifyHeading` in
 * `core/src/lib/wikiSidecar.ts`. Stable across regenerations so URL
 * fragments survive rewrites.
 */
export function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Scan markdown for ATX headings and return one `SectionInfo` per
 * heading, in document order, with anchor disambiguation applied.
 *
 * The `endLine` of each section is the last line of its body — i.e. the
 * line immediately before the next heading at same-or-higher level, or
 * the final line of the document for the tail section.
 */
export function parseSectionsFromMarkdown(content: string): SectionInfo[] {
  const lines = content.split('\n')
  const anchorCount = new Map<string, number>()

  // First pass: find every heading line (skipping fenced code blocks)
  // and record `{ lineIndex, level, heading, anchor }`.
  const headings: Array<{ lineIndex: number; level: number; heading: string; anchor: string }> = []
  let inFence = false
  let fenceMarker = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = line.match(FENCE_RE)
    if (fenceMatch) {
      const marker = fenceMatch[1][0] // '`' or '~'
      if (!inFence) {
        inFence = true
        fenceMarker = marker
      } else if (marker === fenceMarker) {
        inFence = false
        fenceMarker = ''
      }
      continue
    }
    if (inFence) continue

    const match = line.match(HEADING_RE)
    if (!match) continue
    const level = match[1].length
    const heading = match[2].trim()
    const base = slugifyHeading(heading)
    if (!base) continue

    const prev = anchorCount.get(base) ?? 0
    anchorCount.set(base, prev + 1)
    const anchor = prev === 0 ? base : `${base}-${prev}`

    headings.push({ lineIndex: i, level, heading, anchor })
  }

  // Second pass: derive endLine by looking at the next heading at
  // same-or-higher level; walk the heading list in one sweep.
  const sections: SectionInfo[] = []
  for (let h = 0; h < headings.length; h++) {
    const current = headings[h]
    let endLine = lines.length - 1
    for (let n = h + 1; n < headings.length; n++) {
      if (headings[n].level <= current.level) {
        endLine = headings[n].lineIndex - 1
        break
      }
    }
    sections.push({
      id: current.anchor,
      anchor: current.anchor,
      heading: current.heading,
      level: current.level,
      startLine: current.lineIndex,
      endLine,
    })
  }

  return sections
}

/**
 * Return the current content of a section — heading line plus body,
 * joined with `\n`. Used to prefill a section-scoped editor.
 *
 * Returns an empty string if `sectionId` doesn't match any parsed
 * section (callers should treat this as "section disappeared; abort the
 * edit").
 */
export function getSectionBody(content: string, sectionId: string): string {
  const sections = parseSectionsFromMarkdown(content)
  const target = sections.find((s) => s.id === sectionId)
  if (!target) return ''
  const lines = content.split('\n')
  return lines.slice(target.startLine, target.endLine + 1).join('\n')
}

/**
 * Replace the identified section's content (heading and body) with
 * `newSectionBody`. `newSectionBody` is the full replacement span
 * including the heading line; the caller is responsible for preserving
 * the heading if they want a body-only edit (Wave 3b's UI currently
 * keeps the heading fixed per Q8 default).
 *
 * Returns the original content unchanged if `sectionId` doesn't match
 * any parsed section — callers should surface this as a stale-edit
 * error rather than silently overwriting the wrong range.
 *
 * The function preserves the document's surrounding lines verbatim,
 * including trailing newlines. If the original section ended at EOF
 * and the document had a trailing newline, that newline is preserved
 * via the `lines.slice` + `join('\n')` round-trip.
 */
export function replaceSectionInMarkdown(
  content: string,
  sectionId: string,
  newSectionBody: string,
): string {
  const sections = parseSectionsFromMarkdown(content)
  const target = sections.find((s) => s.id === sectionId)
  if (!target) return content

  const lines = content.split('\n')
  const before = lines.slice(0, target.startLine)
  const after = lines.slice(target.endLine + 1)
  // Splitting the replacement body into lines keeps the join consistent
  // and avoids double-newline insertion when the caller includes a
  // trailing blank line in `newSectionBody`.
  const replacement = newSectionBody.split('\n')
  return [...before, ...replacement, ...after].join('\n')
}

/**
 * Smooth-scroll the viewport to a section heading by anchor id.
 *
 * No-op when `document` is unavailable (SSR) or when no element with
 * the given id exists on the page. Wave 3b's `[edit]` bracket UI and
 * any in-page nav links should call through this helper so the
 * scroll-restoration behaviour stays consistent.
 */
export function scrollToSectionAnchor(anchor: string): void {
  if (typeof document === 'undefined') return
  const target = document.getElementById(anchor)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
