'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  // Process [[wiki-slug]] links before rendering
  const processed = content.replace(
    /\[\[([^\]]+)\]\]/g,
    (_, slug) => `[${slug}](/wiki/${slug})`
  )

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {processed}
      </ReactMarkdown>
    </div>
  )
}
