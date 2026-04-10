import matter from 'gray-matter'

/**
 * @summary Parse YAML frontmatter from a markdown string.
 *
 * @param raw - Full markdown string with optional `---` delimited frontmatter
 * @returns Parsed frontmatter object and the body text after the closing `---`
 */
export function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const { data, content } = matter(raw)
  return { frontmatter: data, body: content }
}

/**
 * @summary Reassemble a markdown string from frontmatter object and body.
 *
 * @param fm - Frontmatter key/value pairs (serialized to YAML)
 * @param body - Markdown body content after frontmatter
 * @returns Full markdown string with `---` delimited frontmatter
 */
export function assembleFrontmatter(fm: Record<string, unknown>, body: string): string {
  return matter.stringify(body, fm)
}
