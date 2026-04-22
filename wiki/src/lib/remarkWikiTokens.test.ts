import { describe, it, expect } from 'vitest'
import remarkWikiTokens, { WIKI_CHIP_DATA_ATTR } from './remarkWikiTokens'

/**
 * Minimal mdast shape accepted by the transformer. The plugin doesn't depend on
 * any specific mdast library — it walks `children` arrays and splits `text`
 * nodes — so test trees can be hand-built without importing mdast types.
 */
type Node = {
  type: string
  value?: string
  children?: Node[]
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

type ParentNode = Node & { children: Node[] }

function root(...children: Node[]): ParentNode {
  return { type: 'root', children }
}

function paragraph(...children: Node[]): ParentNode {
  return { type: 'paragraph', children }
}

function text(value: string): Node {
  return { type: 'text', value }
}

function codeBlock(value: string): Node {
  // mdast `code` nodes have a `value` string but NO `children` array.
  return { type: 'code', value }
}

function inlineCode(value: string): Node {
  // mdast `inlineCode` nodes also have `value`, no `children`.
  return { type: 'inlineCode', value }
}

/** Apply the plugin and return the transformed tree. */
function transform(tree: ParentNode): ParentNode {
  const plugin = remarkWikiTokens()
  plugin(tree as never)
  return tree
}

describe('remarkWikiTokens', () => {
  it('leaves plain text without tokens untouched', () => {
    const tree = root(paragraph(text('Just prose without any wiki links.')))
    transform(tree)
    expect(tree.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'Just prose without any wiki links.' }] },
    ])
  })

  it('detects [[person:slug]] tokens and emits a chip node with data-wiki-chip-key', () => {
    const tree = root(paragraph(text('Hello [[person:sarah-chen]] there.')))
    transform(tree)
    const kids = (tree.children[0].children ?? []) as Node[]
    expect(kids.map((n) => n.type)).toEqual(['text', 'text', 'text'])
    expect(kids[0].value).toBe('Hello ')
    expect(kids[1].value).toBe('[[person:sarah-chen]]')
    expect(kids[1].data?.hName).toBe('span')
    expect(kids[1].data?.hProperties).toEqual({ [WIKI_CHIP_DATA_ATTR]: 'person:sarah-chen' })
    expect(kids[2].value).toBe(' there.')
  })

  it('detects [[fragment:slug]], [[wiki:slug]], and [[entry:slug]] tokens with correct keys', () => {
    const tree = root(
      paragraph(
        text('A [[fragment:alpha]] B [[wiki:beta]] C [[entry:gamma]] D'),
      ),
    )
    transform(tree)
    const kids = (tree.children[0].children ?? []) as Node[]
    const chips = kids.filter((n) => n.data?.[`hProperties` as never])
    expect(chips).toHaveLength(3)
    expect(chips.map((c) => c.data!.hProperties![WIKI_CHIP_DATA_ATTR])).toEqual([
      'fragment:alpha',
      'wiki:beta',
      'entry:gamma',
    ])
    // Raw token text preserved as the visible value so unresolved tokens render as text.
    expect(chips.map((c) => c.value)).toEqual([
      '[[fragment:alpha]]',
      '[[wiki:beta]]',
      '[[entry:gamma]]',
    ])
  })

  it('detects unqualified [[slug]] tokens and emits a key without kind prefix', () => {
    const tree = root(paragraph(text('Look: [[orphan-slug]] end.')))
    transform(tree)
    const kids = (tree.children[0].children ?? []) as Node[]
    const chip = kids.find((n) => n.data?.hName === 'span')
    expect(chip).toBeDefined()
    expect(chip!.value).toBe('[[orphan-slug]]')
    expect(chip!.data!.hProperties![WIKI_CHIP_DATA_ATTR]).toBe('orphan-slug')
  })

  it('handles multiple tokens in one text node', () => {
    const tree = root(
      paragraph(text('[[person:a]] then [[fragment:b]] and [[c]] done.')),
    )
    transform(tree)
    const kids = (tree.children[0].children ?? []) as Node[]
    const chips = kids.filter((n) => n.data?.hName === 'span')
    expect(chips.map((c) => c.data!.hProperties![WIKI_CHIP_DATA_ATTR])).toEqual([
      'person:a',
      'fragment:b',
      'c',
    ])
  })

  it('does NOT substitute tokens inside fenced code blocks (code nodes have no children)', () => {
    const tree = root(
      paragraph(text('before [[person:real]] after')),
      codeBlock('[[person:inside-code]] should not be touched'),
    )
    transform(tree)
    // The code block's value is unchanged; no children appear and no chip nodes were synthesized in it.
    expect(tree.children[1]).toEqual({
      type: 'code',
      value: '[[person:inside-code]] should not be touched',
    })
    // Sanity: the paragraph WAS transformed.
    const paragraphKids = (tree.children[0].children ?? []) as Node[]
    expect(paragraphKids.some((n) => n.data?.hName === 'span')).toBe(true)
  })

  it('does NOT substitute tokens inside inline code (inlineCode nodes have no children)', () => {
    const tree = root(
      paragraph(
        text('See '),
        inlineCode('[[person:inline]]'),
        text(' vs [[person:real]] here.'),
      ),
    )
    transform(tree)
    const kids = (tree.children[0].children ?? []) as Node[]
    // inlineCode node is still present and untouched.
    const inlineCodeNode = kids.find((n) => n.type === 'inlineCode')
    expect(inlineCodeNode).toBeDefined()
    expect(inlineCodeNode!.value).toBe('[[person:inline]]')
    // The real token outside inline code was still substituted.
    const chips = kids.filter((n) => n.data?.hName === 'span')
    expect(chips).toHaveLength(1)
    expect(chips[0].data!.hProperties![WIKI_CHIP_DATA_ATTR]).toBe('person:real')
  })

  it('recurses into nested parents (e.g. tokens inside emphasis)', () => {
    const tree = root(
      paragraph({
        type: 'emphasis',
        children: [text('Quoting [[person:nested]] inline.')],
      }),
    )
    transform(tree)
    const emphasis = tree.children[0].children![0] as Node
    const chip = (emphasis.children ?? []).find((n) => n.data?.hName === 'span') as Node | undefined
    expect(chip).toBeDefined()
    expect(chip!.data!.hProperties![WIKI_CHIP_DATA_ATTR]).toBe('person:nested')
  })
})
