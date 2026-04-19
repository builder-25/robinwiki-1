"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { T } from "@/lib/typography";
import { WikiTypeBadge } from "@/components/wiki/WikiTypeBadge";
import { WikiSectionH2 } from "@/components/wiki/WikiEntityArticle";
import { Spinner } from "@/components/ui/spinner";
import { useSearch } from "@/hooks/useSearch";

function SectionRule() {
  return (
    <div
      style={{
        width: "100%",
        height: 1,
        background: "var(--wiki-search-section-line)",
        flexShrink: 0,
      }}
    />
  );
}

function FilterChip({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "wiki-search-filter-chip wiki-search-filter-chip--active"
          : "wiki-search-filter-chip"
      }
    >
      <span className="flex h-3 w-3 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span
        style={{
          ...T.micro,
          letterSpacing: "-0.0288px",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function IconCircle() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle
        cx="6"
        cy="6"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function IconFileCode() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M7 1.5H3.5C2.95 1.5 2.5 1.95 2.5 2.5v7c0 .55.45 1 1 1h5c.55 0 1-.45 1-1V4L7 1.5z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M7 1.5V4h2.5M4 6.5h4M4 8.5h3"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUserRound() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="3.5" r="2" stroke="currentColor" strokeWidth="1" />
      <path
        d="M2.5 10.5c.5-2 2.5-3 3.5-3s3 1 3.5 3"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconWiki() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 2.5h6v7H3v-7zM4.5 2.5V1.5h3v1M4.5 5h3M4.5 6.5h2"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface SearchResultItem {
  fragmentId: string;
  title: string;
  snippet: string;
  score: number;
  tags: string[];
}

function SearchResultRow({ item }: { item: SearchResultItem }) {
  const firstTag = item.tags[0];
  return (
    <div
      className="flex w-full flex-col items-start"
      style={{ gap: 8, paddingTop: 20 }}
    >
      <div className="flex w-full flex-col" style={{ gap: 6 }}>
        <div
          className="wiki-search-result-row-head flex w-full items-center"
          style={{ gap: 6 }}
        >
          <Link
            href={`/wiki/fragments/${item.fragmentId}`}
            className="wiki-search-result-title-link min-w-0"
            style={{
              ...T.h4,
              fontWeight: 400,
              letterSpacing: "0.16px",
              color: "var(--wiki-fragment-link)",
              textDecoration: "underline",
              textDecorationSkipInk: "none",
              whiteSpace: "nowrap",
            }}
          >
            {item.title}
          </Link>
          {firstTag && <WikiTypeBadge type={firstTag} />}
        </div>
      </div>
      {item.snippet && (
        <p
          style={{
            ...T.bodySmall,
            color: "var(--wiki-article-text)",
            maxWidth: "100%",
          }}
        >
          {item.snippet}
        </p>
      )}
      <div
        className="wiki-search-result-meta flex items-center"
        style={{
          ...T.micro,
          color: "#444444",
          gap: 3,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ lineHeight: "17px" }}>
          Score: {(item.score * 100).toFixed(0)}%
        </span>
        {item.tags.length > 0 && (
          <>
            <span style={{ lineHeight: "10px" }}>•</span>
            <span style={{ lineHeight: "17px" }}>{item.tags.join(", ")}</span>
          </>
        )}
      </div>
    </div>
  );
}

type SearchFilter = "all" | "fragments" | "people" | "wiki";

function parseFilterParam(v: string | null): SearchFilter {
  if (v === "fragments" || v === "people" || v === "wiki") return v;
  return "all";
}

export default function WikiSearchResults({ query }: { query: string }) {
  const sp = useSearchParams();
  const urlFilter = parseFilterParam(sp.get("type"));
  const [filter, setFilter] = useState<SearchFilter>(urlFilter);
  const searchQuery = useSearch(query.trim() || undefined);

  // Keep local filter in sync if the user navigates between filtered URLs
  useEffect(() => {
    setFilter(urlFilter);
  }, [urlFilter]);

  const results = useMemo<SearchResultItem[]>(() => {
    return (searchQuery.data?.results ?? []).map((r) => ({
      fragmentId: r.fragmentId,
      title: r.title,
      snippet: r.fragment,
      score: r.score,
      tags: r.tags ?? [],
    }));
  }, [searchQuery.data]);

  const totalCount = results.length;

  return (
    <div
      className="wiki-search-results-root flex w-full min-w-0 flex-col items-start"
      style={{
        width: "100%",
        maxWidth: 864,
        gap: 12,
      }}
    >
      <div className="flex w-full flex-col items-start" style={{ gap: 5 }}>
        <div className="flex w-full flex-col items-start">
          <div className="flex w-full flex-col" style={{ gap: 4 }}>
            <div className="wiki-search-results-title-wrap relative h-[35px] w-full shrink-0">
              <h1
                className="wiki-search-results-h1"
                style={{
                  position: "absolute",
                  left: 0,
                  top: "calc(50% - 17.5px)",
                  margin: 0,
                  ...T.h1,
                  color: "var(--wiki-title)",
                }}
              >
                {query}
              </h1>
            </div>
            <SectionRule />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start" style={{ gap: 8 }}>
        <FilterChip
          icon={<IconCircle />}
          label={`All (${totalCount})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterChip
          icon={<IconFileCode />}
          label={`Fragments (${totalCount})`}
          active={filter === "fragments"}
          onClick={() => setFilter("fragments")}
        />
      </div>

      {searchQuery.isLoading ? (
        <div className="flex w-full justify-center py-12">
          <Spinner className="size-5" />
        </div>
      ) : searchQuery.isError ? (
        <p style={{ ...T.body, color: "var(--wiki-count)", padding: "24px 0" }}>
          Search failed. Please try again.
        </p>
      ) : results.length === 0 ? (
        <p style={{ ...T.body, color: "var(--wiki-count)", padding: "24px 0" }}>
          No results found for &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="flex w-full flex-col items-start" style={{ gap: 64 }}>
          <section className="w-full">
            <div className="flex w-full flex-col" style={{ gap: 8 }}>
              <WikiSectionH2 title="Results" count={totalCount} />
              {results.map((item) => (
                <SearchResultRow key={item.fragmentId} item={item} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
