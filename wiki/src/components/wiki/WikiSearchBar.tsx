"use client";

import { T } from "@/lib/typography";

function SendArrowIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 14V3M8 3L3.5 7.5M8 3L12.5 7.5"
        stroke="var(--wiki-chat-send-icon)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Figma 247:43226 — header: inline row. Figma 217:35530 — home: stacked 88px card. */
export default function WikiSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Who is the president?",
  embedded = false,
  compact = false,
  layout = "inline",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /** When true, no outer fill/padding (parent provides card, e.g. wiki home) */
  embedded?: boolean;
  /** Tighter row for the fixed wiki header (50px strip) */
  compact?: boolean;
  /** `stacked` = ROBIN home: input on top, send button bottom-right (node 217:35530) */
  layout?: "inline" | "stacked";
}) {
  const sendBtn = (
    <button
      type="submit"
      aria-label="Search"
      style={{
        flexShrink: 0,
        width: layout === "stacked" ? 24 : compact ? 22 : 24,
        height: layout === "stacked" ? 24 : compact ? 22 : 24,
        minWidth: layout === "stacked" ? 24 : compact ? 22 : 24,
        minHeight: layout === "stacked" ? 24 : compact ? 22 : 24,
        padding: layout === "stacked" ? 4 : compact ? 3 : 4,
        border: "none",
        borderRadius: 80,
        background: "var(--wiki-chat-send-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <SendArrowIcon size={layout === "stacked" ? 16 : compact ? 14 : 16} />
    </button>
  );

  if (layout === "stacked") {
    return (
      <form
        className="flex w-full max-w-[591px] flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 591,
            minHeight: 88,
            padding: 12,
            boxSizing: "border-box",
            background: embedded ? "transparent" : "var(--wiki-chat-bg)",
            borderRadius: embedded ? 0 : 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              padding: "4px 8px",
              borderRadius: 12,
              boxSizing: "border-box",
            }}
          >
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="wiki-chat-input min-w-0 w-full bg-transparent outline-none"
              style={{
                height: 20,
                ...T.input,
                letterSpacing: 0,
                lineHeight: "20px",
                color: "var(--wiki-title)",
                fontFeatureSettings: "'ss01' 1, 'cv01' 1",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "flex-end",
              width: "100%",
              gap: 8,
              borderRadius: 12,
            }}
          >
            {sendBtn}
          </div>
        </div>
      </form>
    );
  }

  return (
    <form
      className="flex w-full max-w-[591px] flex-col items-center"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 591,
          minHeight: embedded ? undefined : 53,
          padding: embedded ? 0 : 12,
          borderRadius: 0,
          background: embedded ? "transparent" : "var(--wiki-chat-bg)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            padding: compact ? "2px 6px" : "4px 8px",
            borderRadius: 12,
            gap: compact ? 6 : 8,
            boxSizing: "border-box",
          }}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="wiki-chat-input min-w-0 flex-1 bg-transparent outline-none"
            style={{
              height: compact ? 18 : 20,
              ...T.input,
              letterSpacing: 0,
              lineHeight: compact ? "18px" : "20px",
              color: "var(--wiki-title)",
              fontFeatureSettings: "'ss01' 1, 'cv01' 1",
            }}
          />
          {sendBtn}
        </div>
      </div>
    </form>
  );
}
