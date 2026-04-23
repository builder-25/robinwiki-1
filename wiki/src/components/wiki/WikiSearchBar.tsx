"use client";

import { cn } from "@/lib/utils";

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
  placeholder = "What are you looking for?",
  embedded = false,
  compact = false,
  layout = "inline",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  embedded?: boolean;
  compact?: boolean;
  layout?: "inline" | "stacked";
}) {
  const hasValue = value.length > 0;
  const sendSize = layout === "stacked" ? 24 : compact ? 22 : 24;
  const iconSize = layout === "stacked" ? 16 : compact ? 14 : 16;

  const sendBtn = (
    <button
      type="submit"
      aria-label="Search"
      className={cn(
        "wiki-search-bar__send",
        compact && layout !== "stacked" && "wiki-search-bar__send--compact",
      )}
      style={{
        width: sendSize,
        height: sendSize,
        minWidth: sendSize,
        minHeight: sendSize,
        background: hasValue
          ? "rgba(0, 0, 0, 0.12)"
          : "var(--wiki-chat-send-bg)",
      }}
    >
      <SendArrowIcon size={iconSize} />
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
        <label
          className={cn(
            "wiki-search-bar__stacked-label border border-[var(--wiki-card-border)] focus-within:border-[var(--wiki-search-border)] transition-colors",
          )}
          style={{
            background: embedded ? "transparent" : "var(--wiki-chat-bg)",
            borderRadius: embedded ? 0 : 12,
          }}
        >
          <div className="flex w-full flex-col" style={{ padding: "4px 8px", borderRadius: 12 }}>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="wiki-chat-input min-w-0 w-full bg-transparent outline-none"
              style={{
                height: 20,
                fontFamily: "var(--font-noto-sans), 'Noto Sans', sans-serif",
                fontSize: 14,
                fontWeight: 400,
                letterSpacing: 0,
                lineHeight: "20px",
                color: "var(--wiki-title)",
                fontFeatureSettings: "'ss01' 1, 'cv01' 1",
              }}
            />
          </div>
          <div className="flex w-full flex-wrap items-center justify-end" style={{ gap: 8, borderRadius: 12 }}>
            {sendBtn}
          </div>
        </label>
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
        className={cn(
          "wiki-search-bar__inline-wrap",
          embedded && "wiki-search-bar__inline-wrap--embedded",
        )}
        style={{
          background: embedded ? "transparent" : "var(--wiki-chat-bg)",
        }}
      >
        <div
          className={cn(
            "wiki-search-bar__input-row",
            compact && "wiki-search-bar__input-row--compact",
          )}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="wiki-chat-input min-w-0 flex-1 bg-transparent outline-none"
            style={{
              height: compact ? 18 : 20,
              fontFamily: "var(--font-noto-sans), 'Noto Sans', sans-serif",
              fontSize: 14,
              fontWeight: 400,
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
