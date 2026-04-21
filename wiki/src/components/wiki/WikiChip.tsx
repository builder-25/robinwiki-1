import { cn } from "@/lib/utils"

interface WikiChipProps {
  label: string
  href?: string
  className?: string
}

function WikiChip({ label, href, className }: WikiChipProps) {
  const classes = cn("wchip", className)

  if (href) {
    return (
      <a data-slot="wiki-chip" href={href} className={classes}>
        {label}
      </a>
    )
  }

  return (
    <span data-slot="wiki-chip" className={classes}>
      {label}
    </span>
  )
}

export { WikiChip, type WikiChipProps }
