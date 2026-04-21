import { cn } from "@/lib/utils"

type NoteVariant = "info" | "warning" | "danger"

interface WikiNoteProps {
  children: React.ReactNode
  variant?: NoteVariant
  className?: string
}

function WikiNote({ children, variant = "info", className }: WikiNoteProps) {
  return (
    <div
      data-slot="wiki-note"
      data-variant={variant}
      className={cn("wiki-note", `wiki-note--${variant}`, className)}
    >
      {children}
    </div>
  )
}

export { WikiNote, type WikiNoteProps, type NoteVariant }
