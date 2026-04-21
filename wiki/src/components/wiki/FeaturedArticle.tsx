"use client";

import Link from "next/link";
import { T } from "@/lib/typography";
import { WikiTypeBadge } from "@/components/wiki/WikiTypeBadge";
import { useWikis } from "@/hooks/useWikis";

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay < 1) return "today";
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 52) return `${diffWeek}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

function capitalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function FeaturedArticle() {
  const wikisQuery = useWikis();

  // Pick the wiki with the highest noteCount as the "featured" article
  const featured = wikisQuery.data?.wikis
    ?.slice()
    .sort((a, b) => (b.noteCount ?? 0) - (a.noteCount ?? 0))[0] ?? null;

  const title = featured?.name ?? "No wikis yet";
  const type = featured ? capitalize(featured.type) : "Log";
  const href = featured ? `/wiki/${featured.lookupKey}` : "#";
  const meta = featured
    ? `${featured.noteCount ?? 0} fragments  •  Last Updated, ${timeAgo(featured.updatedAt)}`
    : "";

  return (
    <div
      style={{
        border: "1px solid var(--wiki-card-border)",
        width: "100%",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid var(--wiki-card-border)",
          backgroundColor: "var(--surface-subtle)",
          padding: "10px 16px",
        }}
      >
        <p
          style={{
            ...T.h4,
            color: "var(--wiki-card-header)",
          }}
        >
          Featured Wiki
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "21px 16px 16px", backgroundColor: "var(--color-background)" }}>
        {/* Article link + chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={href}
            style={{
              ...T.h4,
              fontWeight: 400,
              color: "var(--wiki-featured-link)",
              textDecoration: "none",
            }}
          >
            {title}
          </Link>
          {featured && <WikiTypeBadge type={type} />}
        </div>

        {/* Metadata */}
        {meta && (
          <p
            style={{
              ...T.micro,
              marginTop: 6,
              color: "var(--wiki-featured-meta)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {meta}
          </p>
        )}

        {/* Read more */}
        {featured && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2.8,
              marginTop: 12,
              borderRadius: 1.4,
            }}
          >
            <Link
              href={href}
              style={{
                ...T.helper,
                color: "var(--wiki-featured-readmore)",
                textDecoration: "none",
              }}
            >
              Read more
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
