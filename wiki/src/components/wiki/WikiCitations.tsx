"use client";

/**
 * Per-section citation superscripts for the m-wiki-sidecar rendering stack.
 *
 * Consumes a single section's `citations: WikiCitation[]` (from the sidecar
 * response envelope) and renders one superscript per citation. Numbering is
 * per-section — the first citation in a section is `[1]`, matching the
 * contract's per-section storage shape.
 *
 * Each superscript is an anchor to the source fragment
 * (`/fragments/${fragmentId}`); hovering shows the captured quote plus
 * the capture date via the shared `<Tooltip>` component. Empty citation
 * arrays render nothing — the component never emits an empty wrapper.
 *
 * Styling reuses the existing `.cite` class defined in
 * `wiki/src/app/globals.css` (superscript + `--wiki-link` color). No new
 * CSS is introduced here; the component composes `WikiCitation` from
 * `WikiFurniture.tsx` for each superscript so the visual treatment stays
 * in one place.
 *
 * Scope note: this component only renders the superscripts. Wiring it into
 * the real wiki detail page (`wiki/src/app/wiki/[id]/page.tsx`) is the
 * `wiki-detail-page` phase's job.
 */

import Link from "next/link";
import { Tooltip } from "@/components/ui/tooltip";
import type { WikiCitation } from "@/lib/sidecarTypes";
import { ROUTES } from "@/lib/routes";

/**
 * Format an ISO date string for the tooltip "Captured" line. Falls back to
 * the raw string if `Date` parsing fails so we never swallow backend output
 * the user might still want to see.
 */
function formatCapturedAt(capturedAt: string): string {
  const parsed = new Date(capturedAt);
  if (Number.isNaN(parsed.getTime())) return capturedAt;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface CitationSuperscriptProps {
  citation: WikiCitation;
  index: number;
}

function CitationSuperscript({ citation, index }: CitationSuperscriptProps) {
  const href = ROUTES.fragment(citation.fragmentId);
  const tooltipContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {citation.quote && (
        <span style={{ fontStyle: "italic" }}>&ldquo;{citation.quote}&rdquo;</span>
      )}
      <span style={{ opacity: 0.7, fontSize: 11 }}>
        Captured {formatCapturedAt(citation.capturedAt)}
      </span>
    </div>
  );

  // Reuse the `.cite` superscript treatment from globals.css. The anchor is
  // wrapped in `<Tooltip>` so hover reveals the quote+capturedAt card; the
  // native `title` attribute is kept as a fallback for keyboard focus and
  // users with JS disabled.
  return (
    <Tooltip content={tooltipContent}>
      <sup data-slot="wiki-citation" className="cite">
        <Link href={href} title={citation.quote ?? undefined}>
          [{index}]
        </Link>
      </sup>
    </Tooltip>
  );
}

interface WikiCitationsProps {
  citations: WikiCitation[];
  /**
   * Optional starting index for the superscripts. Defaults to `1` for
   * per-section numbering. A future document-wide numbering mode can pass
   * a running offset without changing the component.
   */
  startIndex?: number;
  className?: string;
}

export function WikiCitations({
  citations,
  startIndex = 1,
  className,
}: WikiCitationsProps) {
  if (citations.length === 0) return null;

  return (
    <span data-slot="wiki-citations" className={className}>
      {citations.map((citation, i) => (
        <CitationSuperscript
          key={citation.fragmentId}
          citation={citation}
          index={startIndex + i}
        />
      ))}
    </span>
  );
}
