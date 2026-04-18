// Word-level text diff for the revision timeline.
// Backed by `diff` (jsdiff) — Myers' algorithm, linear memory on small edits.

import { diffWordsWithSpace } from "diff";

export type DiffPart = {
  type: "equal" | "added" | "removed";
  value: string;
};

/** Strip HTML to plain text, preserving block boundaries as newlines. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    // Server fallback — strip tags, decode a few entities, collapse whitespace.
    return html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      // Drop empty paragraphs Tiptap inserts (e.g. <p></p> or <p><br></p>) so they
      // don't produce runs of blank lines that diff as whitespace-only changes.
      .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, "")
      .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Drop empty paragraphs before tokenizing blocks.
  doc.querySelectorAll("p").forEach((p) => {
    if (!p.textContent || p.textContent.trim() === "") p.remove();
  });
  // Insert newlines after block-level elements so tokenization respects paragraphs.
  doc.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, br").forEach((el) => {
    el.append("\n");
  });
  return (doc.body.textContent ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Word-level diff. Returns parts tagged equal/added/removed. */
export function diffWords(before: string, after: string): DiffPart[] {
  const changes = diffWordsWithSpace(before, after);
  const raw: DiffPart[] = changes.map((c) => ({
    type: c.added ? "added" : c.removed ? "removed" : "equal",
    value: c.value,
  }));

  // Demote whitespace-only add/remove tokens to `equal` — they otherwise render
  // as thin colored bars (e.g. a removed newline shows as a salmon vertical
  // streak) without carrying any meaningful signal.
  const demoted = raw.map((p) =>
    (p.type === "added" || p.type === "removed") && p.value.trim() === ""
      ? { type: "equal" as const, value: p.value }
      : p,
  );

  // Merge adjacent same-type parts so the output is clean.
  const merged: DiffPart[] = [];
  for (const p of demoted) {
    const last = merged[merged.length - 1];
    if (last && last.type === p.type) last.value += p.value;
    else merged.push({ ...p });
  }
  return merged;
}

export type DiffStats = {
  added: number;
  removed: number;
};

export function diffStats(parts: DiffPart[]): DiffStats {
  let added = 0;
  let removed = 0;
  for (const p of parts) {
    if (p.type === "added") added += p.value.trim().length > 0 ? p.value.length : 0;
    else if (p.type === "removed") removed += p.value.trim().length > 0 ? p.value.length : 0;
  }
  return { added, removed };
}
