/**
 * remark-wiki-tokens — mdast transformer that replaces `[[kind:slug]]`
 * token text inside markdown with a phrasing node the React layer can
 * render as a `<WikiChip>`.
 *
 * For each text node that contains at least one wiki-link token, the
 * plugin splits the text into alternating plain-text runs and chip
 * nodes. Chip nodes are emitted as mdast `html` would be messy, so we
 * use a synthetic leaf carrying `data.hName = 'span'` plus
 * `hProperties` that stash the `${kind}:${slug}` key. `MarkdownContent`
 * registers a `span` component override that looks for the
 * `data-wiki-chip-key` attribute and swaps in `<WikiChip>` (or falls
 * back to the raw token text when the key has no matching `refs`
 * entry — per product decision Q1, unresolved tokens render as raw
 * `[[person:ghost]]` plain text rather than disappearing).
 *
 * Tokens are identified via `WIKI_LINK_RE` from the shared package;
 * never reimplement the regex locally.
 */

import { WIKI_LINK_RE } from '@robin/shared'

/**
 * Marker value carried on the synthetic span's `data-wiki-chip-key`
 * attribute. Using a prefix rather than a raw token lets the render
 * hook skip unrelated spans that a future plugin might introduce.
 */
export const WIKI_CHIP_DATA_ATTR = 'data-wiki-chip-key'

// Minimal local mdast shapes — the full `@types/mdast` package is a
// transitive-only dep and we deliberately avoid adding it as a direct
// dependency just to satisfy the plugin's narrow needs.
interface MdastText {
  type: 'text'
  value: string
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

interface MdastNodeLike {
  type: string
  children?: MdastNodeLike[]
}

interface MdastParent extends MdastNodeLike {
  children: MdastNodeLike[]
}

/**
 * Emit a synthetic text node whose `data.hName = 'span'` causes
 * remark-rehype to output a `<span>` element. We stash the token key
 * in `data-wiki-chip-key`, and the raw token text (e.g. `[[person:x]]`)
 * as the node's visible children so that unresolved tokens still have
 * something to display without any React-side lookup.
 */
function buildChipNode(rawToken: string, chipKey: string): MdastText {
  return {
    type: 'text',
    value: rawToken,
    data: {
      hName: 'span',
      hProperties: {
        [WIKI_CHIP_DATA_ATTR]: chipKey,
      },
    },
  }
}

function splitTextNode(node: MdastText): MdastNodeLike[] {
  const { value } = node
  // Fresh RegExp instance per scan — `WIKI_LINK_RE` has the `/g` flag
  // so `lastIndex` persists on the shared exported constant.
  const re = new RegExp(WIKI_LINK_RE.source, WIKI_LINK_RE.flags)
  const pieces: MdastNodeLike[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(value)) !== null) {
    const [rawToken, kindCapture, slug] = match
    const start = match.index
    const end = start + rawToken.length

    if (start > cursor) {
      pieces.push({ type: 'text', value: value.slice(cursor, start) } as MdastText)
    }

    // Unqualified `[[slug]]` tokens still need a key so the render
    // hook can attempt a lookup; fall back to just the slug when the
    // token had no `kind:` prefix.
    const chipKey = kindCapture ? `${kindCapture}:${slug}` : slug
    pieces.push(buildChipNode(rawToken, chipKey))

    cursor = end
  }

  if (pieces.length === 0) return [node]

  if (cursor < value.length) {
    pieces.push({ type: 'text', value: value.slice(cursor) } as MdastText)
  }

  return pieces
}

function transformParent(parent: MdastParent): void {
  const next: MdastNodeLike[] = []
  for (const child of parent.children) {
    if (child.type === 'text') {
      next.push(...splitTextNode(child as MdastText))
    } else {
      if (Array.isArray(child.children)) {
        transformParent(child as MdastParent)
      }
      next.push(child)
    }
  }
  parent.children = next
}

/**
 * Remark plugin function. Returns a transformer that walks the mdast
 * tree and rewrites text nodes containing wiki-link tokens. Typed as a
 * unified `Plugin` in shape but declared with a plain signature to
 * avoid adding `unified` as a direct type dependency.
 */
export default function remarkWikiTokens() {
  return (tree: MdastParent): void => {
    transformParent(tree)
  }
}
