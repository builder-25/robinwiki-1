"use client";

import { useMemo, useState } from "react";
import { T, FONT } from "@/lib/typography";
import type { WikiRevision } from "./useWikiEntityEditMode";
import {
  diffStats,
  diffWords,
  htmlToPlainText,
  type DiffPart,
} from "./wikiDiff";

type WikiHistoryTimelineProps = {
  revisions: WikiRevision[];
};

const formatAbsolute = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatRelative = (ts: number) => {
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

const diffStyles = {
  added: {
    backgroundColor: "var(--diff-added-bg)",
    color: "var(--diff-added-text)",
    textDecoration: "none",
    padding: "0 1px",
    borderRadius: 2,
  },
  removed: {
    backgroundColor: "var(--diff-removed-bg)",
    color: "var(--diff-removed-text)",
    textDecoration: "line-through",
    padding: "0 1px",
    borderRadius: 2,
  },
  equal: {
    color: "var(--wiki-sidebar-text)",
  },
} as const;

function DiffInline({ parts }: { parts: DiffPart[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} style={diffStyles[p.type]}>
          {p.value}
        </span>
      ))}
    </>
  );
}

type ComputedDiff = {
  fieldChanges: Array<{
    label: string;
    before: string;
    after: string;
    parts: DiffPart[];
  }>;
  contentParts: DiffPart[] | null;
  added: number;
  removed: number;
  hasAnyChange: boolean;
};

function computeDiff(curr: WikiRevision, prev: WikiRevision | null): ComputedDiff {
  const fieldChanges: ComputedDiff["fieldChanges"] = [];

  if (!prev) {
    return {
      fieldChanges: [],
      contentParts: null,
      added: 0,
      removed: 0,
      hasAnyChange: false,
    };
  }

  if (prev.title !== curr.title) {
    fieldChanges.push({
      label: "Title",
      before: prev.title,
      after: curr.title,
      parts: diffWords(prev.title, curr.title),
    });
  }
  if (prev.chipLabel !== curr.chipLabel) {
    fieldChanges.push({
      label: "Type",
      before: prev.chipLabel,
      after: curr.chipLabel,
      parts: diffWords(prev.chipLabel, curr.chipLabel),
    });
  }

  let contentParts: DiffPart[] | null = null;
  let added = 0;
  let removed = 0;
  if (prev.content !== curr.content) {
    const prevText = htmlToPlainText(prev.content);
    const currText = htmlToPlainText(curr.content);
    contentParts = diffWords(prevText, currText);
    const stats = diffStats(contentParts);
    added = stats.added;
    removed = stats.removed;
  }

  return {
    fieldChanges,
    contentParts,
    added,
    removed,
    hasAnyChange: fieldChanges.length > 0 || contentParts !== null,
  };
}

export default function WikiHistoryTimeline({ revisions }: WikiHistoryTimelineProps) {
  // Precompute diffs for every revision vs. its immediate predecessor.
  const computedDiffs = useMemo(
    () =>
      revisions.map((rev, idx) => computeDiff(rev, revisions[idx + 1] ?? null)),
    [revisions],
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (revisions.length === 0) {
    return (
      <div
        style={{
          ...T.bodySmall,
          fontFamily: FONT.SANS,
          color: "var(--wiki-sidebar-text)",
          padding: "24px 0",
        }}
      >
        No edits recorded yet. Save a change to start the history.
      </div>
    );
  }

  return (
    <div
      className="wiki-history-timeline"
      style={{
        position: "relative",
        paddingLeft: 20,
        borderLeft: "1px solid var(--wiki-meta-line)",
        marginTop: 8,
      }}
    >
      {revisions.map((rev, idx) => {
        const isLatest = idx === 0;
        const isInitial = idx === revisions.length - 1 && revisions.length > 0;
        const diff = computedDiffs[idx];
        const isOpen = expanded[rev.id] ?? isLatest;

        return (
          <div
            key={rev.id}
            style={{
              position: "relative",
              paddingBottom: idx === revisions.length - 1 ? 0 : 24,
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: -26,
                top: 4,
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: isLatest ? "var(--foreground)" : "var(--background)",
                border: "2px solid var(--wiki-meta-line)",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  ...T.bodySmall,
                  fontFamily: FONT.SANS,
                  fontWeight: 600,
                  color: "var(--wiki-title)",
                }}
              >
                {rev.summary}
              </span>
              {isLatest ? (
                <span
                  style={{
                    ...T.caption,
                    fontFamily: FONT.SANS,
                    padding: "1px 6px",
                    borderRadius: 3,
                    border: "1px solid var(--wiki-chip-border)",
                    background: "var(--wiki-chip-bg)",
                    color: "var(--wiki-chip-text)",
                  }}
                >
                  current
                </span>
              ) : null}
              {diff.contentParts ? (
                <span
                  style={{
                    ...T.caption,
                    fontFamily: FONT.SANS,
                    color: "var(--wiki-sidebar-text)",
                    display: "inline-flex",
                    gap: 6,
                  }}
                >
                  <span style={{ color: "var(--diff-added-text)" }}>+{diff.added}</span>
                  <span style={{ color: "var(--diff-removed-text)" }}>−{diff.removed}</span>
                </span>
              ) : null}
            </div>
            <div
              style={{
                ...T.caption,
                fontFamily: FONT.SANS,
                color: "var(--wiki-sidebar-text)",
                marginTop: 2,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span>{rev.author}</span>
              <span aria-hidden>·</span>
              <span title={formatAbsolute(rev.timestamp)}>
                {formatRelative(rev.timestamp)} · {formatAbsolute(rev.timestamp)}
              </span>
            </div>

            {/* Field-level diffs (title, type) — always visible when changed. */}
            {diff.fieldChanges.length > 0 ? (
              <div
                style={{
                  ...T.caption,
                  fontFamily: FONT.SANS,
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {diff.fieldChanges.map((f) => (
                  <div key={f.label}>
                    <strong
                      style={{ color: "var(--wiki-title)", fontWeight: 500 }}
                    >
                      {f.label}:
                    </strong>{" "}
                    <DiffInline parts={f.parts} />
                  </div>
                ))}
              </div>
            ) : null}

            {/* Content diff — collapsible. */}
            {diff.contentParts ? (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [rev.id]: !isOpen }))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    ...T.caption,
                    fontFamily: FONT.SANS,
                    color: "var(--wiki-link)",
                  }}
                >
                  {isOpen ? "Hide content diff" : "Show content diff"}
                </button>
                {isOpen ? (
                  <pre
                    style={{
                      ...T.bodySmall,
                      fontFamily: FONT.SANS,
                      marginTop: 6,
                      padding: "10px 12px",
                      border: "1px solid var(--wiki-card-border)",
                      borderRadius: 4,
                      background: "var(--code-block-bg)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: "22px",
                      color: "var(--wiki-article-text)",
                    }}
                  >
                    <DiffInline parts={diff.contentParts} />
                  </pre>
                ) : null}
              </div>
            ) : isInitial ? (
              <div
                style={{
                  ...T.caption,
                  fontFamily: FONT.SANS,
                  color: "var(--wiki-sidebar-text)",
                  marginTop: 6,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  <strong
                    style={{ color: "var(--wiki-title)", fontWeight: 500 }}
                  >
                    Title:
                  </strong>{" "}
                  {rev.title || "—"}
                </span>
                <span>
                  <strong
                    style={{ color: "var(--wiki-title)", fontWeight: 500 }}
                  >
                    Type:
                  </strong>{" "}
                  {rev.chipLabel || "—"}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
