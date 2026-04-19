"use client";

import {
  Suspense,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  FileCode,
  MessageSquare,
  NotebookText,
  UserRound,
  X,
} from "lucide-react";

import { FONT, T } from "@/lib/typography";
import {
  WikiTypeBadge,
  getWikiTypeIcon,
} from "@/components/wiki/WikiTypeBadge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useExplorerFilters,
  EXPLORER_TYPES,
  type ExplorerType,
} from "@/hooks/useExplorerFilters";
import { useExplorerData, type ExplorerItem } from "@/hooks/useExplorerData";

const PAGE_SIZE = 50;

const TYPE_META: Record<ExplorerType, { icon: typeof FileCode; label: string }> = {
  fragment: { icon: FileCode, label: "Fragments" },
  wiki: { icon: MessageSquare, label: "Wikis" },
  person: { icon: UserRound, label: "People" },
  entry: { icon: NotebookText, label: "Entries" },
};

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

function ExplorerInner() {
  const { filters, setFilter, clearFilters, hasActiveFilters } =
    useExplorerFilters();
  const { items, isLoading, isError, groups } = useExplorerData(filters);

  const [showFilters, setShowFilters] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters.types.join(","), filters.group, filters.sort]);

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (entry?.isIntersecting && visibleCount < items.length) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, items.length));
      }
    },
    [visibleCount, items.length],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "200px",
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );

  // Toggle a type in the filter array
  const toggleType = useCallback(
    (type: ExplorerType) => {
      const current = filters.types;
      if (current.includes(type)) {
        setFilter(
          "types",
          current.filter((t) => t !== type),
        );
      } else {
        setFilter("types", [...current, type]);
      }
    },
    [filters.types, setFilter],
  );

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
          <div>
            <h1 style={{ ...T.hero, margin: 0, color: "var(--wiki-title)" }}>
              Explorer
            </h1>
            <p
              style={{
                ...T.bodySmall,
                color: "var(--wiki-count)",
                margin: "4px 0 0",
              }}
            >
              {isLoading
                ? "Loading..."
                : `${items.length} objects${hasActiveFilters ? " (filtered)" : ""}`}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative rounded-md"
            aria-label="Toggle filters"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.5} />
            {hasActiveFilters && (
              <span
                className="absolute -top-1 -right-1 block h-2.5 w-2.5 rounded-full bg-foreground"
                aria-hidden
              />
            )}
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div
            style={{
              borderTop: "1px solid var(--wiki-card-border)",
              padding: "16px 0 20px",
            }}
          >
            {/* Type filters */}
            <div style={{ marginBottom: 16 }}>
              <span
                style={{
                  ...T.micro,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--wiki-count)",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Type
              </span>
              <div className="flex flex-wrap items-start" style={{ gap: 8 }}>
                {EXPLORER_TYPES.map((type) => {
                  const meta = TYPE_META[type];
                  const Icon = meta.icon;
                  const isActive =
                    filters.types.length === 0 || filters.types.includes(type);
                  const isExplicit = filters.types.includes(type);

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={
                        isActive
                          ? "wiki-search-filter-chip wiki-search-filter-chip--active"
                          : "wiki-search-filter-chip"
                      }
                    >
                      <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                        <Icon size={12} strokeWidth={1.5} />
                      </span>
                      <span
                        style={{
                          ...T.micro,
                          letterSpacing: "-0.0288px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {meta.label}
                      </span>
                      {isExplicit && (
                        <span
                          className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-current"
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group filters */}
            {groups.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <span
                  style={{
                    ...T.micro,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--wiki-count)",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Group
                </span>
                <div className="flex flex-wrap items-start" style={{ gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setFilter("group", null)}
                    className={
                      filters.group === null
                        ? "wiki-search-filter-chip wiki-search-filter-chip--active"
                        : "wiki-search-filter-chip"
                    }
                  >
                    <span
                      style={{
                        ...T.micro,
                        letterSpacing: "-0.0288px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      All groups
                    </span>
                  </button>
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() =>
                        setFilter(
                          "group",
                          filters.group === group.id ? null : group.id,
                        )
                      }
                      className={
                        filters.group === group.id
                          ? "wiki-search-filter-chip wiki-search-filter-chip--active"
                          : "wiki-search-filter-chip"
                      }
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            group.color || "var(--wiki-count)",
                        }}
                        aria-hidden
                      />
                      <span
                        style={{
                          ...T.micro,
                          letterSpacing: "-0.0288px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {group.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort filters */}
            <div style={{ marginBottom: 16 }}>
              <span
                style={{
                  ...T.micro,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--wiki-count)",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Sort
              </span>
              <div className="flex flex-wrap items-start" style={{ gap: 8 }}>
                {(
                  [
                    { value: "recent", label: "Recent" },
                    { value: "oldest", label: "Oldest" },
                    { value: "alpha", label: "A-Z" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter("sort", value)}
                    className={
                      filters.sort === value
                        ? "wiki-search-filter-chip wiki-search-filter-chip--active"
                        : "wiki-search-filter-chip"
                    }
                  >
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
                ))}
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="wiki-search-filter-chip"
                style={{ gap: 6 }}
              >
                <X size={12} strokeWidth={1.5} />
                <span
                  style={{
                    ...T.micro,
                    letterSpacing: "-0.0288px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Clear filters
                </span>
              </button>
            )}
          </div>
        )}

        {/* Object list */}
        {isLoading ? (
          <div className="flex w-full justify-center py-12">
            <Spinner className="size-5" />
          </div>
        ) : isError ? (
          <p
            style={{
              ...T.body,
              color: "var(--wiki-count)",
              padding: "24px 0",
            }}
          >
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
            {visibleItems.length === 0 ? (
              <li
                style={{
                  padding: "24px 4px",
                  color: "var(--wiki-count)",
                  ...T.body,
                }}
              >
                {hasActiveFilters ? (
                  <span>
                    No objects match your filters.{" "}
                    <button
                      type="button"
                      onClick={clearFilters}
                      style={{
                        color: "var(--wiki-link)",
                        textDecoration: "underline",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        font: "inherit",
                      }}
                    >
                      Clear filters
                    </button>
                  </span>
                ) : (
                  "No objects yet"
                )}
              </li>
            ) : (
              visibleItems.map((item) => (
                <ExplorerRow key={item.id} item={item} />
              ))
            )}
          </ul>
        )}

        {/* Sentinel for infinite scroll */}
        {visibleCount < items.length && <div ref={sentinelRef} className="h-8" />}
      </div>
    </div>
  );
}

function ExplorerRow({ item }: { item: ExplorerItem }) {
  const Icon = getWikiTypeIcon(item.subtype ?? item.type);

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
          {Icon ? <Icon size={16} strokeWidth={1.5} /> : null}
        </span>
        <Link
          href={item.href}
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

      {/* Right: badge + group indicator + date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <WikiTypeBadge
          type={item.subtype ?? (item.type === "person" ? "Person" : item.type)}
        />

        {item.groupColor && item.groupName && (
          <div
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.groupColor }}
              aria-hidden
            />
            <span
              className="hidden sm:inline"
              style={{ ...T.micro, color: "var(--wiki-count)" }}
            >
              {item.groupName}
            </span>
          </div>
        )}

        <span
          style={{
            ...T.bodySmall,
            fontFamily: FONT.SANS,
            color: "var(--wiki-count)",
            minWidth: 80,
            textAlign: "right",
          }}
        >
          {timeAgo(item.date)}
        </span>
      </div>
    </li>
  );
}

export default function ExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex w-full justify-center py-12">
          <Spinner className="size-5" />
        </div>
      }
    >
      <ExplorerInner />
    </Suspense>
  );
}
