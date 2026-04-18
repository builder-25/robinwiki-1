"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

import { FONT, T } from "@/lib/typography";
import {
  WikiTypeBadge,
  getWikiTypeIcon,
  isPeopleWikiType,
  type WikiType,
} from "@/components/wiki/WikiTypeBadge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useWikis } from "@/hooks/useWikis";
import { useFragments } from "@/hooks/useFragments";
import { usePeople } from "@/hooks/usePeople";

type FilterKey = "all" | "fragments" | "people" | "wiki";

const FRAGMENT_TYPE_SET = new Set(["Fact", "Question", "Idea", "Action", "Quote", "Reference"]);

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function IconCircle() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
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

type ExplorerItem = {
  title: string;
  type: WikiType;
  source: string;
  date: string;
  href?: string;
};

export default function ExplorerPage() {
  const wikisQuery = useWikis({ limit: 200 });
  const fragmentsQuery = useFragments({ limit: 200 });
  const peopleQuery = usePeople({ limit: 200 });

  const [filter, setFilter] = useState<FilterKey>("all");

  const isLoading = wikisQuery.isLoading || fragmentsQuery.isLoading || peopleQuery.isLoading;
  const isError = wikisQuery.isError || fragmentsQuery.isError || peopleQuery.isError;

  const items = useMemo<ExplorerItem[]>(() => {
    const result: ExplorerItem[] = [];

    // Map wikis (threads) to explorer items
    for (const wiki of wikisQuery.data?.threads ?? []) {
      result.push({
        title: wiki.name,
        type: capitalize(wiki.type) as WikiType,
        source: "",
        date: timeAgo(wiki.updatedAt),
        href: `/wiki/${wiki.lookupKey}`,
      });
    }

    // Map fragments to explorer items
    for (const frag of fragmentsQuery.data?.fragments ?? []) {
      result.push({
        title: frag.title,
        type: capitalize(frag.type) as WikiType,
        source: "",
        date: timeAgo(frag.updatedAt),
        href: `/wiki/fragment/${frag.lookupKey}`,
      });
    }

    // Map people to explorer items
    for (const person of peopleQuery.data?.people ?? []) {
      result.push({
        title: person.name,
        type: "Person" as WikiType,
        source: "",
        date: timeAgo(person.updatedAt),
        href: `/wiki/person/${person.lookupKey}`,
      });
    }

    return result;
  }, [wikisQuery.data, fragmentsQuery.data, peopleQuery.data]);

  const counts = useMemo(() => {
    const total = items.length;
    const people = items.filter((i) => isPeopleWikiType(i.type)).length;
    const fragments = items.filter((i) => FRAGMENT_TYPE_SET.has(i.type)).length;
    const wiki = total - people - fragments;
    return { total, people, fragments, wiki };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "people") return items.filter((i) => isPeopleWikiType(i.type));
    if (filter === "fragments")
      return items.filter((i) => FRAGMENT_TYPE_SET.has(i.type));
    return items.filter(
      (i) => !isPeopleWikiType(i.type) && !FRAGMENT_TYPE_SET.has(i.type),
    );
  }, [items, filter]);

  return (
    <div className="wiki-page">
      <div className="wiki-page__content">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            marginBottom: 16,
          }}
        >
          <h1 style={{ ...T.hero, margin: 0, color: "var(--wiki-title)" }}>
            Explorer
          </h1>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-md"
            aria-label="Filter and sort"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.5} />
          </Button>
        </div>

        {/* Filter chips */}
        <div
          className="flex flex-wrap items-start"
          style={{ gap: 8, marginBottom: 20 }}
        >
          <FilterChip
            icon={<IconCircle />}
            label={`All (${counts.total})`}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            icon={<IconFileCode />}
            label={`Fragments (${counts.fragments})`}
            active={filter === "fragments"}
            onClick={() => setFilter("fragments")}
          />
          <FilterChip
            icon={<IconUserRound />}
            label={`People (${counts.people})`}
            active={filter === "people"}
            onClick={() => setFilter("people")}
          />
          <FilterChip
            icon={<IconWiki />}
            label={`Wiki (${counts.wiki})`}
            active={filter === "wiki"}
            onClick={() => setFilter("wiki")}
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex w-full justify-center py-12">
            <Spinner className="size-5" />
          </div>
        ) : isError ? (
          <p style={{ ...T.body, color: "var(--wiki-count)", padding: "24px 0" }}>
            Failed to load data. Please try again.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              borderTop: "1px solid var(--wiki-card-border)",
            }}
          >
            {filtered.length === 0 ? (
              <li style={{ padding: "24px 4px", color: "var(--wiki-count)", ...T.body }}>
                No items found.
              </li>
            ) : (
              filtered.map((item, i) => (
                <ExplorerRow key={`${item.title}-${i}`} item={item} />
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function ExplorerRow({ item }: { item: ExplorerItem }) {
  const Icon = getWikiTypeIcon(item.type);
  const isPerson = isPeopleWikiType(item.type);

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 4px",
        borderBottom: "1px solid var(--wiki-card-border)",
      }}
    >
      {/* Left: icon + title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            color: "var(--wiki-count)",
            flexShrink: 0,
          }}
        >
          <Icon size={16} strokeWidth={1.5} />
        </span>
        <Link
          href={item.href ?? "#"}
          className="wiki-fragment-link"
          style={{
            ...T.body,
            fontFamily: FONT.SANS,
            color: "var(--wiki-fragment-link)",
            textDecoration: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}
        >
          {item.title}
        </Link>
      </div>

      {/* Right: badge + source + date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <WikiTypeBadge type={isPerson ? "Person" : item.type} />
        <span
          style={{
            ...T.bodySmall,
            fontFamily: FONT.SANS,
            color: "var(--wiki-count)",
            minWidth: 80,
            textAlign: "right",
          }}
        >
          {item.date}
        </span>
      </div>
    </li>
  );
}
