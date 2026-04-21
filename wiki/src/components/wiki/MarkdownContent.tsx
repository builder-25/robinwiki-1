"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { CSSProperties } from "react";
import { T } from "@/lib/typography";

const baseText: CSSProperties = {
  ...T.bodySmall,
  color: "var(--wiki-article-text)",
  lineHeight: 1.6,
};

const components: Components = {
  h1: ({ children }) => (
    <h2
      style={{
        ...T.h2,
        color: "var(--wiki-article-h2)",
        margin: "24px 0 8px",
        borderBottom: "1px solid var(--wiki-card-border)",
        paddingBottom: 4,
      }}
    >
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        ...T.h2,
        color: "var(--wiki-article-h2)",
        margin: "24px 0 8px",
        borderBottom: "1px solid var(--wiki-card-border)",
        paddingBottom: 4,
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        ...T.h3,
        color: "var(--wiki-article-h2)",
        margin: "20px 0 6px",
      }}
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4
      style={{
        ...T.h4,
        color: "var(--wiki-article-h2)",
        margin: "16px 0 4px",
      }}
    >
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p style={{ ...baseText, margin: "8px 0" }}>{children}</p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      style={{
        color: "var(--wiki-article-link)",
        textDecoration: "underline",
        textDecorationSkipInk: "none",
      }}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul
      style={{
        ...baseText,
        listStyle: "disc",
        paddingLeft: 24,
        margin: "8px 0",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      style={{
        ...baseText,
        listStyle: "decimal",
        paddingLeft: 24,
        margin: "8px 0",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li style={{ margin: 0 }}>{children}</li>,
  strong: ({ children }) => (
    <strong style={{ fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }) => <em>{children}</em>,
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: "3px solid var(--wiki-card-border)",
        paddingLeft: 16,
        margin: "12px 0",
        color: "var(--wiki-article-text)",
        opacity: 0.8,
        fontStyle: "italic",
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code
          style={{
            display: "block",
            fontFamily: "monospace",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          fontFamily: "monospace",
          fontSize: "0.9em",
          backgroundColor: "var(--wiki-card-border)",
          padding: "1px 4px",
          borderRadius: 3,
        }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre
      style={{
        backgroundColor: "var(--code-block-bg)",
        border: "1px solid var(--wiki-card-border)",
        borderRadius: 4,
        padding: 12,
        margin: "12px 0",
        overflow: "auto",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </pre>
  ),
  hr: () => (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid var(--wiki-card-border)",
        margin: "16px 0",
      }}
    />
  ),
};

interface MarkdownContentProps {
  content: string;
  className?: string;
  style?: CSSProperties;
}

export function MarkdownContent({ content, className, style }: MarkdownContentProps) {
  return (
    <div className={className} style={style}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
