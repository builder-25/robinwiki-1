"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ChipProps {
  label: string
  icon?: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
  /** Extra content after the label (e.g. an active-indicator dot) */
  children?: ReactNode
}

function Chip({ label, icon, active, onClick, className, children }: ChipProps) {
  return (
    <button
      type="button"
      data-slot="chip"
      data-active={active || undefined}
      onClick={onClick}
      className={cn("sfchip", active && "sfchip--active", className)}
    >
      {icon ? (
        <span className="flex h-3 w-3 shrink-0 items-center justify-center">
          {icon}
        </span>
      ) : null}
      <span className="sfchip__label">{label}</span>
      {children}
    </button>
  )
}

export { Chip, type ChipProps }
