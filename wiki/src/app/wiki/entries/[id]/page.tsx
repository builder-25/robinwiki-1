"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { T } from "@/lib/typography";
import { Spinner } from "@/components/ui/spinner";
import { EntryArticle } from "@/components/wiki/EntryArticle";
import { WikiSectionH2 } from "@/components/wiki/WikiEntityArticle";
import { MarkdownContent } from "@/components/wiki/MarkdownContent";
import { useEntry } from "@/hooks/useEntry";
import { useEntryFragments } from "@/hooks/useEntryFragments";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const { data: entry, isLoading, error } = useEntry(id);
  const { data: fragmentsData } = useEntryFragments(id);
  const fragments = fragmentsData?.fragments ?? [];

  const bodyStyle = {
    ...T.bodySmall,
    color: "var(--wiki-article-text)",
    lineHeight: 1.6,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="p-6">
        <h1 style={T.h1}>Entry not found</h1>
        <p style={{ ...T.bodySmall, color: "var(--wiki-article-text)", marginTop: 8 }}>
          This entry could not be loaded. It may have been deleted or you may not have access.
        </p>
      </div>
    );
  }

  return (
    <>
    <Link href="/wiki" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--wiki-count)", textDecoration: "none", marginBottom: 12 }}>
      <ArrowLeft size={14} strokeWidth={1.5} />
      <span style={{ ...T.micro }}>Back</span>
    </Link>
    <EntryArticle
      title={entry.title}
      infobox={{
        type: entry.type,
        source: entry.source,
        createdAt: formatDate(entry.createdAt),
      }}
      body={
        <MarkdownContent content={entry.content} style={bodyStyle} />
      }
    >
      {fragments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <WikiSectionH2 title="Extracted Fragments" count={fragments.length} />
          <ul
            style={{
              ...bodyStyle,
              listStyle: "decimal",
              paddingLeft: 20,
              margin: "12px 0 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {fragments.map((frag) => (
              <li key={frag.id}>
                <Link
                  href={`/wiki/fragments/${frag.id}`}
                  style={{
                    color: "var(--wiki-fragment-link)",
                    textDecoration: "underline",
                    textDecorationSkipInk: "none",
                  }}
                >
                  {frag.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </EntryArticle>
    </>
  );
}
