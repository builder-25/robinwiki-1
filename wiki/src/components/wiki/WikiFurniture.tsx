import { cn } from "@/lib/utils"

/* ── Citation: superscript [1] style ── */

interface WikiCitationProps {
  index: number
  href?: string
  className?: string
}

function WikiCitation({ index, href, className }: WikiCitationProps) {
  return (
    <sup data-slot="wiki-citation" className={cn("cite", className)}>
      <a href={href ?? `#ref-${index}`}>[{index}]</a>
    </sup>
  )
}

/* ── Edit link: bracket [edit] beside headings ── */

interface WikiEditLinkProps {
  href?: string
  onClick?: () => void
  className?: string
}

function WikiEditLink({ href, onClick, className }: WikiEditLinkProps) {
  return (
    <a
      data-slot="wiki-edit-link"
      href={href ?? "#"}
      onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : undefined}
      className={cn("wedit", className)}
    >
      edit
    </a>
  )
}

/* ── External link: arrow after <a> ── */

interface WikiExternalLinkProps {
  href: string
  children: React.ReactNode
  className?: string
}

function WikiExternalLink({ href, children, className }: WikiExternalLinkProps) {
  return (
    <a
      data-slot="wiki-external-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("ext", className)}
    >
      {children}
    </a>
  )
}

/* ── References list: numbered entries with back-link ^ ── */

interface ReferenceEntry {
  id: string
  content: React.ReactNode
  backHref?: string
}

interface WikiReferencesListProps {
  entries: ReferenceEntry[]
  className?: string
}

function WikiReferencesList({ entries, className }: WikiReferencesListProps) {
  return (
    <ol data-slot="wiki-references" className={cn("wrefs", className)}>
      {entries.map((entry) => (
        <li key={entry.id} id={entry.id}>
          <a
            href={entry.backHref ?? "#"}
            className="wrefs__back"
            aria-label="Jump back"
          >
            ^
          </a>
          <span>{entry.content}</span>
        </li>
      ))}
    </ol>
  )
}

/* ── See Also: two-column link list ── */

interface SeeAlsoItem {
  label: string
  href: string
}

interface WikiSeeAlsoProps {
  items: SeeAlsoItem[]
  className?: string
}

function WikiSeeAlso({ items, className }: WikiSeeAlsoProps) {
  return (
    <ul data-slot="wiki-see-also" className={cn("wsee", className)}>
      {items.map((item) => (
        <li key={item.href}>
          <a href={item.href}>{item.label}</a>
        </li>
      ))}
    </ul>
  )
}

/* ── Hint: small monospace hint text ── */

interface WikiHintProps {
  children: React.ReactNode
  className?: string
}

function WikiHint({ children, className }: WikiHintProps) {
  return (
    <p data-slot="wiki-hint" className={cn("hint", className)}>
      {children}
    </p>
  )
}

export {
  WikiCitation,
  WikiEditLink,
  WikiExternalLink,
  WikiReferencesList,
  WikiSeeAlso,
  WikiHint,
  type WikiCitationProps,
  type WikiEditLinkProps,
  type WikiExternalLinkProps,
  type WikiReferencesListProps,
  type ReferenceEntry,
  type WikiSeeAlsoProps,
  type SeeAlsoItem,
  type WikiHintProps,
}
