"use client";

import { Circle, UserRound } from "lucide-react";
import { T, FONT } from "@/lib/typography";
import type { GraphData, GraphNodeType } from "./graphSampleData";

type LegendProps = {
  style?: React.CSSProperties;
};

export function GraphLegend({ style }: LegendProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        background: "#ffffff",
        border: "1px solid var(--wiki-card-border)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Circle size={12} color="#3366cc" />
        <span
          style={{
            ...T.caption,
            fontFamily: FONT.SANS,
            color: "var(--wiki-article-text)",
          }}
        >
          Wiki
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <UserRound size={12} color="#c87137" />
        <span
          style={{
            ...T.caption,
            fontFamily: FONT.SANS,
            color: "var(--wiki-article-text)",
          }}
        >
          People
        </span>
      </div>
    </div>
  );
}

type FiltersPanelProps = {
  data: GraphData;
  activeTypes: Set<GraphNodeType>;
  onToggle: (type: GraphNodeType) => void;
};

const TYPE_LABEL: Record<GraphNodeType, string> = {
  wiki: "Wiki",
  fragment: "Fragments",
  person: "People",
};

export function GraphFiltersPanel({ data, activeTypes, onToggle }: FiltersPanelProps) {
  const counts: Record<GraphNodeType, number> = { wiki: 0, fragment: 0, person: 0 };
  data.nodes.forEach((n) => {
    counts[n.type] += 1;
  });

  const types: GraphNodeType[] = ["wiki", "fragment", "person"];

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 200,
        background: "#ffffff",
        border: "1px solid var(--wiki-card-border)",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          ...T.bodySmall,
          fontFamily: FONT.SANS,
          fontWeight: 600,
          color: "var(--wiki-title)",
        }}
      >
        Filters
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {types.map((t) => {
          const active = activeTypes.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => onToggle(t)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 8px",
                background: active ? "var(--wiki-search-chip-bg)" : "#fafafa",
                border: "1px solid var(--wiki-card-border)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  ...T.bodySmall,
                  fontFamily: FONT.SANS,
                  fontWeight: 600,
                  color: active ? "var(--wiki-title)" : "var(--wiki-sidebar-text)",
                }}
              >
                {TYPE_LABEL[t]}
              </span>
              <span
                style={{
                  ...T.bodySmall,
                  fontFamily: FONT.SANS,
                  color: "var(--wiki-link)",
                  opacity: active ? 1 : 0.5,
                }}
              >
                {counts[t]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
