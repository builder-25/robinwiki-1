"use client";

import { Circle, UserRound } from "lucide-react";
import { T, FONT } from "@/lib/typography";

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
