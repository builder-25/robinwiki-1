/**
 * Strip [[...]] delimiters from a wikilink string.
 */
export function stripWikiDelimiters(wikiLink: string): string {
  return wikiLink.replace(/^\[\[|\]\]$/g, '')
}

/**
 * Resolve an array of wikilink strings against a set of known notes (by title).
 * Returns only the links that matched.
 */
export function resolveWikiLinks(
  wikiLinks: string[],
  knownNotes: Array<{ path: string; title: string }>
): Array<{ toPath: string; linkText: string }> {
  const links: Array<{ toPath: string; linkText: string }> = []
  for (const wl of wikiLinks) {
    const title = stripWikiDelimiters(wl)
    const match = knownNotes.find((n) => n.title && n.title.toLowerCase() === title.toLowerCase())
    if (match) {
      links.push({ toPath: match.path, linkText: title })
    }
  }
  return links
}
