"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface TOCHeading {
  level: number
  text: string
  id: string
}

interface WikiTOCProps {
  headings: TOCHeading[]
  defaultOpen?: boolean
  className?: string
}

function WikiTOC({ headings, defaultOpen = true, className }: WikiTOCProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (headings.length === 0) return null

  return (
    <nav data-slot="wiki-toc" className={cn("wtoc", className)}>
      <div className="wtoc__title">
        <span>Contents</span>
        <button
          type="button"
          className="wtoc__toggle"
          onClick={() => setOpen((v) => !v)}
        >
          [{open ? "hide" : "show"}]
        </button>
      </div>
      {open ? (
        <ol className="wtoc__list">
          {headings.map((h) => (
            <li
              key={h.id}
              className="wtoc__item"
              style={{ paddingLeft: (h.level - 2) * 16 }}
            >
              <a href={`#${h.id}`} className="wtoc__link">
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      ) : null}
    </nav>
  )
}

export { WikiTOC, type WikiTOCProps, type TOCHeading }
