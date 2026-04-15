"use client";

import Link from "next/link";
import { useWikis } from "@/hooks/useWikis";

const ExternalLinkIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 9.86 9.86"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.36713 0.493007H5.42308L7.0432 2.11314L2.95804 5.91608L3.63401 6.64199L7.74164 2.81158L7.74514 2.81507L9.36713 4.43706V0.493007ZM0.986014 2.46503H2.95804V3.45105H1.47902V8.38112H6.40909V6.40717H7.3951V8.87413C7.3951 9.14641 7.17439 9.36713 6.9021 9.36713H0.986014C0.713736 9.36713 0.493007 9.14641 0.493007 8.87413V2.95804C0.493007 2.68576 0.713736 2.46503 0.986014 2.46503Z"
      fill="var(--wiki-featured-readmore)"
    />
  </svg>
);

export default function FeaturedArticle() {
  const { data, isLoading, error } = useWikis({ limit: 1 });
  const wiki = data?.threads?.[0];

  if (isLoading) {
    return (
      <div
        style={{
          border: "1px solid var(--wiki-card-border)",
          width: "100%",
          height: "100%",
          padding: 16,
        }}
      >
        <p style={{ color: "var(--wiki-featured-meta)", fontSize: 12 }}>
          Loading featured wiki...
        </p>
      </div>
    );
  }

  if (error || !wiki) {
    return (
      <div
        style={{
          border: "1px solid var(--wiki-card-border)",
          width: "100%",
          height: "100%",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid var(--wiki-card-border)",
            padding: "10px 16px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-inter), Inter, sans-serif",
              fontSize: 16,
              fontWeight: 600,
              lineHeight: "20px",
              color: "var(--wiki-card-header)",
            }}
          >
            Featured Wiki
          </p>
        </div>
        <div style={{ padding: "21px 16px 16px" }}>
          <p style={{ color: "var(--wiki-featured-meta)", fontSize: 12, fontStyle: "italic" }}>
            {error ? "Failed to load" : "No wikis yet"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--wiki-card-border)",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid var(--wiki-card-border)",
          padding: "10px 16px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-inter), Inter, sans-serif",
            fontSize: 16,
            fontWeight: 600,
            lineHeight: "20px",
            color: "var(--wiki-card-header)",
          }}
        >
          Featured Wiki
        </p>
      </div>

      <div style={{ padding: "21px 16px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/wiki/${wiki.id}`}
            style={{
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontSize: 12.4,
              fontWeight: 400,
              lineHeight: "17.3px",
              color: "var(--wiki-featured-link)",
              textDecoration: "none",
            }}
          >
            {wiki.name}
          </Link>
          <span
            style={{
              background: "var(--wiki-chip-bg)",
              border: "0.512px solid var(--wiki-chip-border)",
              borderRadius: 1,
              padding: "0.5px 3px",
              fontFamily: "var(--font-inter), Inter, sans-serif",
              fontSize: 7.16,
              fontWeight: 400,
              lineHeight: "10.23px",
              color: "var(--wiki-chip-text)",
              whiteSpace: "nowrap",
            }}
          >
            {wiki.type}
          </span>
        </div>

        <p
          style={{
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: 10,
            lineHeight: "17px",
            color: "var(--wiki-featured-meta)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            marginTop: 6,
          }}
        >
          {`${wiki.noteCount ?? 0} fragments       Updated ${wiki.lastUpdated?.slice(0, 10) ?? "unknown"}`}
        </p>

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
            href={`/wiki/${wiki.id}`}
            style={{
              fontFamily: "var(--font-inter), Inter, sans-serif",
              fontSize: 9.86,
              fontWeight: 400,
              lineHeight: "14px",
              color: "var(--wiki-featured-readmore)",
              textDecoration: "none",
            }}
          >
            Read more
          </Link>
          <ExternalLinkIcon />
        </div>
      </div>
    </div>
  );
}
