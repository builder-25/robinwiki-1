"use client";

import Link from "next/link";
import { useFragments } from "@/hooks/useFragments";

const IBM = "var(--font-ibm-plex-sans), 'IBM Plex Sans', sans-serif";

function FragmentListItem({
  fragment,
  index,
}: {
  fragment: { id: string; title: string };
  index: number;
}) {
  const indexColorVar =
    index % 2 === 0
      ? "var(--wiki-fragment-index-1)"
      : "var(--wiki-fragment-index-2)";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flex: "1 0 0",
        alignItems: "flex-start",
        gap: 8,
        minWidth: 0,
        paddingLeft: 16,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 20,
          alignSelf: "stretch",
          fontFamily: IBM,
          fontSize: 14,
          fontWeight: 400,
          lineHeight: "20px",
          letterSpacing: "0.16px",
          color: indexColorVar,
        }}
      >
        {index + 1}.
      </span>
      <Link
        href={`/wiki/fragment/${fragment.id}`}
        style={{
          fontFamily: IBM,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: "20px",
          letterSpacing: "0.16px",
          color: "var(--wiki-fragment-link)",
          textDecoration: "underline",
          textDecorationSkipInk: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {fragment.title}
      </Link>
    </div>
  );
}

export default function WikiFragments() {
  const { data, isLoading, error } = useFragments({ limit: 12 });
  const fragments = data?.fragments ?? [];

  // Pair fragments into rows of 2
  const rows: Array<[typeof fragments[0], typeof fragments[0] | undefined]> = [];
  for (let i = 0; i < fragments.length; i += 2) {
    rows.push([fragments[i], fragments[i + 1]]);
  }

  return (
    <section
      style={{
        display: "flex",
        width: "100%",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 20,
        paddingBottom: 20,
        border: "1px solid var(--wiki-card-border)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          flexShrink: 0,
          borderTop: "1px solid var(--wiki-card-border)",
          borderBottom: "1px solid var(--wiki-card-border)",
          padding: "10px 16px",
          boxSizing: "border-box",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-inter), Inter, sans-serif",
            fontSize: 16,
            fontWeight: 600,
            lineHeight: "20px",
            color: "var(--wiki-card-header)",
          }}
        >
          Fragments
        </p>
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        {isLoading && (
          <div style={{ padding: "0 16px" }}>
            <p style={{ color: "var(--wiki-item-date)", fontSize: 12 }}>Loading fragments...</p>
          </div>
        )}
        {error && (
          <div style={{ padding: "0 16px" }}>
            <p style={{ color: "var(--wiki-item-date)", fontSize: 12 }}>Failed to load fragments</p>
          </div>
        )}
        {!isLoading && !error && fragments.length === 0 && (
          <div style={{ padding: "0 16px" }}>
            <p style={{ color: "var(--wiki-item-date)", fontSize: 12, fontStyle: "italic" }}>
              No fragments yet
            </p>
          </div>
        )}
        <div
          style={{
            display: "flex",
            width: "100%",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 13,
          }}
        >
          {rows.map(([left, right], rowIdx) => (
            <div
              key={rowIdx}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <FragmentListItem fragment={left} index={rowIdx * 2} />
              {right && <FragmentListItem fragment={right} index={rowIdx * 2 + 1} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
