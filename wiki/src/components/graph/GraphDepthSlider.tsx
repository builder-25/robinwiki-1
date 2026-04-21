"use client";

import { T, FONT } from "@/lib/typography";

type GraphDepthSliderProps = {
  depth: number;
  onDepthChange: (d: number) => void;
  hasFocus: boolean;
};

export function GraphDepthSlider({ depth, onDepthChange, hasFocus }: GraphDepthSliderProps) {
  if (!hasFocus) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--graph-panel-bg)",
        border: "1px solid var(--wiki-card-border)",
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        zIndex: 10,
      }}
    >
      <span
        style={{
          ...T.caption,
          fontFamily: FONT.SANS,
          color: "var(--wiki-sidebar-text)",
          whiteSpace: "nowrap",
        }}
      >
        Depth
      </span>
      <input
        type="range"
        min={1}
        max={3}
        step={1}
        value={depth}
        onChange={(e) => onDepthChange(Number(e.target.value))}
        style={{ width: 80, accentColor: "var(--wiki-title)" }}
      />
      <span
        style={{
          ...T.caption,
          fontFamily: FONT.SANS,
          fontWeight: 600,
          color: "var(--wiki-title)",
          minWidth: 14,
          textAlign: "center",
        }}
      >
        {depth}
      </span>
    </div>
  );
}
