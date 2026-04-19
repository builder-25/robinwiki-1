"use client";

import Link from "next/link";
import { T } from "@/lib/typography";
import { useFragments } from "@/hooks/useFragments";

function FragmentListItem({
  index,
  text,
  href,
}: {
  index: number;
  text: string;
  href: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        padding: "4px 16px",
        minWidth: 0,
      }}
    >
      <span
        style={{
          ...T.micro,
          flexShrink: 0,
          color: "var(--wiki-fragment-index-1)",
        }}
      >
        {index}.
      </span>
      <Link
        href={href}
        style={{
          ...T.bodySmall,
          color: "var(--wiki-fragment-link)",
          textDecoration: "underline",
          textDecorationSkipInk: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </Link>
    </div>
  );
}

export default function WikiFragments() {
  const fragmentsQuery = useFragments({ limit: 12 });
  const fragments = fragmentsQuery.data?.fragments ?? [];

  return (
    <section
      style={{
        display: "flex",
        width: "100%",
        flexDirection: "column",
        border: "1px solid var(--wiki-card-border)",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid var(--wiki-card-border)",
          padding: "10px 16px",
          backgroundColor: "var(--profile-item-border)",
        }}
      >
        <p
          style={{
            ...T.h4,
            margin: 0,
            color: "var(--wiki-card-header)",
          }}
        >
          Fragments
        </p>
      </div>

      {/* Two-column list */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px 0",
          padding: "12px 0",
          backgroundColor: "var(--color-background)",
        }}
      >
        {fragments.length === 0 && !fragmentsQuery.isLoading ? (
          <p style={{ padding: "4px 16px", ...T.bodySmall, color: "var(--wiki-fragment-index-1)" }}>
            No fragments yet.
          </p>
        ) : (
          fragments.map((frag, i) => (
            <FragmentListItem
              key={frag.id}
              index={i + 1}
              text={frag.title}
              href={`/wiki/fragments/${frag.lookupKey}`}
            />
          ))
        )}
      </div>
    </section>
  );
}
