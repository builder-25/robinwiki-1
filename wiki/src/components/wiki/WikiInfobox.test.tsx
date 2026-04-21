import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WikiInfobox, type WikiInfoboxSection } from './WikiInfobox'
import { WikiChip } from './WikiChip'

afterEach(cleanup)

// A test section that exercises every sidecar valueKind variant
// (text / ref / date / status) mapped onto the component's
// presentation-agnostic {key, value} row shape. This is the shape
// downstream pages will use when wiring the real fixture in — the
// component itself is intentionally kind-unaware.
const fixtureSections: WikiInfoboxSection[] = [
  {
    rows: [
      // status valueKind — plain text label
      { key: 'Status', value: 'complete' },
      // text valueKind — plain text
      { key: 'Paper', value: 'Attention Is All You Need' },
      // ref valueKind — rendered via <WikiChip>
      {
        key: 'Lead author',
        value: <WikiChip label="Ashish Vaswani" href="/wiki/people/p-ashish-vaswani" />,
      },
      // date valueKind — ISO date string
      { key: 'Published', value: '2017-06-12' },
    ],
  },
]

describe('<WikiInfobox>', () => {
  it('renders the title as the table caption', () => {
    render(<WikiInfobox title="Transformer Architecture" sections={fixtureSections} />)
    const caption = document.querySelector('caption.winfo__head')
    expect(caption).not.toBeNull()
    expect(caption!.textContent).toBe('Transformer Architecture')
  })

  it('renders every row label and value (all four valueKind variants)', () => {
    render(<WikiInfobox title="Transformer" sections={fixtureSections} />)
    // Keys (labels)
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Paper')).toBeInTheDocument()
    expect(screen.getByText('Lead author')).toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()
    // Values
    expect(screen.getByText('complete')).toBeInTheDocument()
    expect(screen.getByText('Attention Is All You Need')).toBeInTheDocument()
    expect(screen.getByText('2017-06-12')).toBeInTheDocument()
    // ref-valueKind row renders a WikiChip anchor
    const chip = screen.getByText('Ashish Vaswani')
    expect(chip.tagName).toBe('A')
    expect(chip).toHaveAttribute('href', '/wiki/people/p-ashish-vaswani')
  })

  it('renders an image and caption when provided', () => {
    render(
      <WikiInfobox
        title="Transformer"
        image="/images/transformer.png"
        caption="Figure 1 — the canonical diagram."
        sections={fixtureSections}
      />,
    )
    const img = document.querySelector('td.winfo__image img') as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img!.src).toContain('/images/transformer.png')
    expect(img!.alt).toBe('Figure 1 — the canonical diagram.')
    const caption = document.querySelector('td.winfo__caption')
    expect(caption).not.toBeNull()
    expect(caption!.textContent).toBe('Figure 1 — the canonical diagram.')
  })

  it('omits image + caption elements when image is not provided', () => {
    render(<WikiInfobox title="Transformer" sections={fixtureSections} />)
    expect(document.querySelector('td.winfo__image')).toBeNull()
    expect(document.querySelector('td.winfo__caption')).toBeNull()
  })

  it('renders a section label (th.winfo__section) when section.label is set', () => {
    render(
      <WikiInfobox
        title="Transformer"
        sections={[
          { label: 'Metadata', rows: [{ key: 'Status', value: 'complete' }] },
        ]}
      />,
    )
    const sectionHeader = document.querySelector('th.winfo__section')
    expect(sectionHeader).not.toBeNull()
    expect(sectionHeader!.textContent).toBe('Metadata')
  })

  it('applies caller-provided className to the outer table', () => {
    render(
      <WikiInfobox title="Transformer" sections={fixtureSections} className="custom-info" />,
    )
    const table = document.querySelector('table[data-slot="wiki-infobox"]')
    expect(table).not.toBeNull()
    expect(table).toHaveClass('winfo')
    expect(table).toHaveClass('custom-info')
  })
})
