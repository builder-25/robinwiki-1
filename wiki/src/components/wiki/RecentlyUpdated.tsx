"use client";

import Link from "next/link";
import { useWikis } from "@/hooks/useWikis";

const BulletDot = () => (
  <svg
    width="8"
    height="8"
    viewBox="0 0 8 8"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4 0C1.79086 0 0 1.79086 0 4C0 6.20914 1.79086 8 4 8C6.20914 8 8 6.20914 8 4C8 1.79086 6.20914 0 4 0Z"
      fill="var(--wiki-bullet)"
    />
  </svg>
);

export default function RecentlyUpdated() {
  const { data, isLoading, error } = useWikis({ limit: 5 });
  const wikis = data?.threads ?? [];

  return (
    <div
      className="wiki-recently-updated"
      style={{
        border: "1px solid var(--wiki-card-border)",
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
            whiteSpace: "nowrap",
          }}
        >
          Recently updated
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {isLoading && (
          <div style={{ padding: "8px 12px" }}>
            <p style={{ color: "var(--wiki-item-date)", fontSize: 12 }}>Loading...</p>
          </div>
        )}
        {error && (
          <div style={{ padding: "8px 12px" }}>
            <p style={{ color: "var(--wiki-item-date)", fontSize: 12 }}>Failed to load</p>
          </div>
        )}
        {wikis.length === 0 && !isLoading && !error && (
          <div style={{ padding: "8px 12px" }}>
            <p style={{ color: "var(--wiki-item-date)", fontSize: 12, fontStyle: "italic" }}>
              No wikis yet
            </p>
          </div>
        )}
        {wikis.map((wiki) => (
          <div
            key={wiki.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "8px 12px",
            }}
          >
            <div
              style={{
                width: 18,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <BulletDot />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                flex: 1,
                minWidth: 0,
                lineHeight: "20px",
              }}
            >
              <Link
                href={`/wiki/${wiki.id}`}
                style={{
                  fontFamily: "var(--font-inter), Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: "20px",
                  color: "var(--wiki-item-link)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {wiki.name}
              </Link>
              <span
                style={{
                  fontFamily: "var(--font-inter), Inter, sans-serif",
                  fontSize: 10,
                  fontWeight: 400,
                  lineHeight: "20px",
                  color: "var(--wiki-item-date)",
                  whiteSpace: "nowrap",
                  marginLeft: 8,
                }}
              >
                ({wiki.lastUpdated?.slice(0, 10) ?? ""})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
