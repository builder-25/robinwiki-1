import { cn } from "@/lib/utils"

interface WikiInfoboxSection {
  label?: string
  rows: Array<{ key: string; value: React.ReactNode }>
}

interface WikiInfoboxProps {
  title: string
  image?: string
  caption?: string
  sections: WikiInfoboxSection[]
  className?: string
}

function WikiInfobox({ title, image, caption, sections, className }: WikiInfoboxProps) {
  return (
    <table data-slot="wiki-infobox" className={cn("winfo", className)}>
      <caption className="winfo__head">{title}</caption>
      <tbody>
        {image ? (
          <>
            <tr>
              <td colSpan={2} className="winfo__image">
                <img src={image} alt={caption ?? title} style={{ maxWidth: "100%" }} />
              </td>
            </tr>
            {caption ? (
              <tr>
                <td colSpan={2} className="winfo__caption">
                  {caption}
                </td>
              </tr>
            ) : null}
          </>
        ) : null}
        {sections.map((section, si) => (
          <Section key={si} section={section} />
        ))}
      </tbody>
    </table>
  )
}

function Section({ section }: { section: WikiInfoboxSection }) {
  return (
    <>
      {section.label ? (
        <tr>
          <th colSpan={2} className="winfo__section">
            {section.label}
          </th>
        </tr>
      ) : null}
      {section.rows.map((row, ri) => (
        <tr key={ri} className="winfo__row">
          <td className="winfo__k">{row.key}</td>
          <td className="winfo__v">{row.value}</td>
        </tr>
      ))}
    </>
  )
}

export { WikiInfobox, type WikiInfoboxProps, type WikiInfoboxSection }
