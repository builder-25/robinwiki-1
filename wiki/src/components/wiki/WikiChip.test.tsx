import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WikiChip } from './WikiChip'

afterEach(cleanup)

describe('<WikiChip>', () => {
  it('renders an anchor with the given href and label when href is provided', () => {
    render(<WikiChip label="Sarah Chen" href="/people/p-sarah" />)
    const anchor = screen.getByText('Sarah Chen')
    expect(anchor.tagName).toBe('A')
    expect(anchor).toHaveAttribute('href', '/people/p-sarah')
    expect(anchor).toHaveAttribute('data-slot', 'wiki-chip')
    expect(anchor).toHaveClass('wchip')
  })

  it('renders a span (not an anchor) when href is omitted', () => {
    render(<WikiChip label="Unresolved" />)
    const chip = screen.getByText('Unresolved')
    expect(chip.tagName).toBe('SPAN')
    expect(chip).toHaveAttribute('data-slot', 'wiki-chip')
    expect(chip).toHaveClass('wchip')
    expect(chip).not.toHaveAttribute('href')
  })

  it('merges a caller-provided className with the wchip base class', () => {
    render(<WikiChip label="Chip" href="/x" className="custom-extra" />)
    const anchor = screen.getByText('Chip')
    expect(anchor).toHaveClass('wchip')
    expect(anchor).toHaveClass('custom-extra')
  })
})
