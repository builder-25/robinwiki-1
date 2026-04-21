"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { T } from "@/lib/typography";
import { Spinner } from "@/components/ui/spinner";
import { useWiki } from "@/hooks/useWiki";
import { useRegenerateWiki } from "@/hooks/useRegenerateWiki";
import { useDeleteWiki } from "@/hooks/useDeleteWiki";
import { useQueryClient } from "@tanstack/react-query";
import ConfirmDialog from "@/components/prompts/ConfirmDialog";
import {
  WikiEntityArticle,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";
import { getWikiTypeIcon } from "@/components/wiki/WikiTypeBadge";
import { MarkdownContent } from "@/components/wiki/MarkdownContent";
import { WikiInfobox } from "@/components/wiki/WikiInfobox";
import { WikiChip } from "@/components/wiki/WikiChip";
import { WikiCitations } from "@/components/wiki/WikiCitations";
import {
  parseSectionsFromMarkdown,
  type SectionInfo,
} from "@/lib/sectionEdit";
import { useWikiTokenSubstitution } from "@/lib/htmlTokenSubstitute";
import type {
  WikiInfobox as WikiInfoboxData,
  WikiRef,
  WikiSection,
} from "@/lib/sidecarTypes";

function capitalize(s: string | null | undefined) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Single-token matcher for infobox `valueKind: 'ref'` cells. Mirrors the
 * canonical `WIKI_LINK_RE` in `packages/shared/src/wiki-links.ts` but
 * anchored to the whole value — a row value that is a single token gets
 * chip treatment; anything else falls back to plain text.
 */
const REF_VALUE_RE = /^\s*\[\[([a-z]+):([a-z0-9-]+)\]\]\s*$/;

function hrefForRef(ref: WikiRef): string | undefined {
  switch (ref.kind) {
    case "person":
      return `/wiki/people/${ref.id}`;
    case "fragment":
      return `/wiki/fragments/${ref.id}`;
    case "wiki":
      return `/wiki/${ref.id}`;
    case "entry":
      return `/wiki/entries/${ref.id}`;
    default:
      return undefined;
  }
}

/**
 * Resolve an infobox row value into a ReactNode. Only `valueKind: 'ref'`
 * gets chip treatment; `text`, `date`, `status` render as plain text per
 * the Q7 default in PHASES.md.
 */
function renderInfoboxValue(
  row: WikiInfoboxData["rows"][number],
  refs: Record<string, WikiRef>,
): ReactNode {
  if (row.valueKind === "ref") {
    const match = row.value.match(REF_VALUE_RE);
    if (match) {
      const [, kind, slug] = match;
      const ref = refs[`${kind}:${slug}`];
      if (ref) {
        return <WikiChip label={ref.label} href={hrefForRef(ref)} />;
      }
    }
    return row.value;
  }
  return row.value;
}

/**
 * Inner renderer for the HTML-saved body path. Owns its own container
 * ref so the token-substitution hook can run against the mounted DOM.
 * Must live in its own component so the hook re-runs when `html` changes
 * (e.g. after an edit-mode save round-trip).
 */
function HtmlWikiBody({
  html,
  refs,
  style,
}: {
  html: string;
  refs: Record<string, WikiRef>;
  style: CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useWikiTokenSubstitution(containerRef, html, refs);
  return (
    <div
      ref={containerRef}
      className="wiki-richtext-rendered"
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Match server-computed `sections[]` entries to the anchors produced by
 * `parseSectionsFromMarkdown` against the displayed markdown. The server
 * slugifier and the client helper are kept in sync (see
 * `wiki/src/lib/sectionEdit.ts` header) so this lookup is a plain
 * `Map<anchor, WikiSection>`.
 */
function buildCitationsByAnchor(
  sections: WikiSection[] | undefined,
): Map<string, WikiSection> {
  const map = new Map<string, WikiSection>();
  if (!sections) return map;
  for (const s of sections) {
    map.set(s.anchor, s);
  }
  return map;
}

/**
 * Render the markdown body as a sequence of section-scoped
 * `<MarkdownContent>` blocks, each followed by its `<WikiCitations>`
 * superscripts. Preamble before the first heading (if any) renders as
 * an unattributed leading block.
 *
 * If the body has no headings, falls back to a single whole-body render
 * — `sections` is empty in that case, so no citations are rendered.
 */
function SectionedMarkdownBody({
  content,
  refs,
  sections,
  style,
}: {
  content: string;
  refs: Record<string, WikiRef>;
  sections: WikiSection[] | undefined;
  style: CSSProperties;
}) {
  const parsed: SectionInfo[] = parseSectionsFromMarkdown(content);
  if (parsed.length === 0) {
    return <MarkdownContent content={content} refs={refs} style={style} />;
  }

  const lines = content.split("\n");
  const citationsByAnchor = buildCitationsByAnchor(sections);

  const preamble = lines.slice(0, parsed[0].startLine).join("\n");
  const blocks: ReactNode[] = [];
  if (preamble.trim().length > 0) {
    blocks.push(
      <MarkdownContent
        key="__preamble"
        content={preamble}
        refs={refs}
        style={style}
      />,
    );
  }

  for (const section of parsed) {
    const body = lines
      .slice(section.startLine, section.endLine + 1)
      .join("\n");
    const matched = citationsByAnchor.get(section.anchor);
    const citations = matched?.citations ?? [];
    blocks.push(
      <div key={section.anchor} id={section.anchor}>
        <MarkdownContent content={body} refs={refs} style={style} />
        {citations.length > 0 && <WikiCitations citations={citations} />}
      </div>,
    );
  }

  return <>{blocks}</>;
}

export default function WikiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: wiki, isLoading, error } = useWiki(id);
  const regenerate = useRegenerateWiki();
  const deleteWiki = useDeleteWiki();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveToApi = async (data: { title: string; chipLabel: string; content: string }) => {
    if (!wiki) return;
    try {
      await fetch(`/api/api/content/wiki/${wiki.lookupKey}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontmatter: {
            name: data.title,
            type: data.chipLabel.toLowerCase(),
            prompt: wiki.prompt ?? '',
          },
          body: data.content,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['wiki', id] });
      await queryClient.invalidateQueries({ queryKey: ['wikis'] });
    } catch {
      // Silently fail — local state is already saved
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !wiki) {
    return (
      <div className="p-6">
        <h1 style={T.h1}>Wiki not found</h1>
        <p style={{ ...T.bodySmall, color: "var(--wiki-article-text)", marginTop: 8 }}>
          This wiki could not be loaded. It may have been deleted or you may not have access.
        </p>
      </div>
    );
  }

  const typeLabel = capitalize(wiki.type);
  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  // Sidecar data. Cast against the local hand-mirror types in
  // `@/lib/sidecarTypes` — the generated SDK types are structurally
  // compatible but slightly looser (e.g. `valueKind` is optional on the
  // generated row shape). Fallbacks keep the page safe against older
  // backends that strip sidecar fields (see RESEARCH NQ13).
  const refs: Record<string, WikiRef> = (wiki.refs ?? {}) as Record<string, WikiRef>;
  const sidecarInfobox: WikiInfoboxData | null =
    (wiki.infobox ?? null) as WikiInfoboxData | null;
  const sidecarSections: WikiSection[] =
    (wiki.sections ?? []) as WikiSection[];

  const isHtmlBody =
    typeof wiki.wikiContent === "string" &&
    wiki.wikiContent.trim().startsWith("<");

  return (
    <WikiEntityArticle
      chipIcon={getWikiTypeIcon(typeLabel)}
      chipLabel={typeLabel}
      title={wiki.name}
      infobox={{ kind: "simple", typeLabel, lastUpdated: wiki.updatedAt, showSettings: true }}
      renderCustomInfobox={
        sidecarInfobox
          ? () => (
              <WikiInfobox
                title={wiki.name}
                image={sidecarInfobox.image?.url}
                caption={sidecarInfobox.caption}
                sections={[
                  {
                    rows: sidecarInfobox.rows.map(
                      (row: WikiInfoboxData["rows"][number]) => ({
                        key: row.label,
                        value: renderInfoboxValue(row, refs),
                      }),
                    ),
                  },
                ]}
              />
            )
          : undefined
      }
      wikiId={wiki.id}
      onSave={handleSaveToApi}
      customBottomSections={
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => regenerate.mutate(wiki.id)}
              disabled={regenerate.isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                fontSize: 12,
                color: "var(--wiki-article-text)",
                background: "none",
                border: "1px solid var(--wiki-card-border)",
                cursor: regenerate.isPending ? "default" : "pointer",
                opacity: regenerate.isPending ? 0.6 : 1,
              }}
            >
              <RefreshCw
                size={14}
                strokeWidth={1.5}
                style={regenerate.isPending ? { animation: "spin 1s linear infinite" } : undefined}
              />
              {regenerate.isPending ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteWiki.isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                fontSize: 12,
                color: "red",
                background: "none",
                border: "1px solid var(--wiki-card-border)",
                cursor: deleteWiki.isPending ? "default" : "pointer",
                opacity: deleteWiki.isPending ? 0.6 : 1,
              }}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              {deleteWiki.isPending ? "Deleting..." : "Delete Wiki"}
            </button>
            {regenerate.isSuccess && (
              <span style={{ fontSize: 12, color: "var(--wiki-article-link)" }}>
                Regeneration queued
              </span>
            )}
            {regenerate.isError && (
              <span style={{ fontSize: 12, color: "red" }}>
                Failed to regenerate
              </span>
            )}
            {deleteWiki.isError && (
              <span style={{ fontSize: 12, color: "red" }}>
                Failed to delete
              </span>
            )}
          </div>
          <ConfirmDialog
            open={showDeleteConfirm}
            onOpenChange={setShowDeleteConfirm}
            title="Delete Wiki"
            description="Are you sure? This permanently deletes this wiki."
            confirmLabel="Delete"
            destructive
            onConfirm={() => {
              deleteWiki.mutate(wiki.id, {
                onSuccess: () => router.push("/wiki"),
              });
            }}
          />
        </>
      }
    >
      {wiki.wikiContent && (
        isHtmlBody ? (
          // HTML body (Tiptap-saved): the remark plugin never runs on this
          // branch, so token substitution is done by a post-render DOM
          // walker (`useWikiTokenSubstitution`). Server-computed
          // `sections[]` were derived from markdown and their anchors may
          // not line up with the HTML structure, so citations are
          // rendered as a trailing flat list keyed by section heading
          // rather than injected per-section (MVP option b in the
          // phase spec).
          <>
            <HtmlWikiBody
              html={wiki.wikiContent}
              refs={refs}
              style={bodyStyle}
            />
            {sidecarSections.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: "1px solid var(--wiki-card-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {sidecarSections
                  .filter((section) => (section.citations ?? []).length > 0)
                  .map((section) => (
                    <div
                      key={section.anchor}
                      style={{ ...bodyStyle, display: "flex", gap: 8, alignItems: "baseline" }}
                    >
                      <span style={{ opacity: 0.7 }}>
                        {section.heading}
                      </span>
                      <WikiCitations citations={section.citations ?? []} />
                    </div>
                  ))}
              </div>
            )}
          </>
        ) : (
          // Markdown body (LLM-emitted): `<MarkdownContent>` owns token
          // substitution via `remarkWikiTokens` when refs is passed.
          // Rendering section-by-section lets us append `<WikiCitations>`
          // after each section's prose.
          <SectionedMarkdownBody
            content={wiki.wikiContent}
            refs={refs}
            sections={sidecarSections}
            style={bodyStyle}
          />
        )
      )}

      {wiki.fragments && wiki.fragments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <WikiSectionH2 title="Member Fragments" count={wiki.fragments.length} />
          <ul
            style={{
              ...bodyStyle,
              listStyle: "decimal",
              paddingLeft: 20,
              margin: "12px 0 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {wiki.fragments.map((frag) => (
              <li key={frag.id}>
                <Link
                  href={`/wiki/fragments/${frag.id}`}
                  style={{
                    color: "var(--wiki-fragment-link)",
                    textDecoration: "underline",
                    textDecorationSkipInk: "none",
                  }}
                >
                  {frag.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {wiki.people && wiki.people.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <WikiSectionH2 title="Mentioned People" count={wiki.people.length} />
          <ul
            style={{
              ...bodyStyle,
              listStyle: "disc",
              paddingLeft: 20,
              margin: "12px 0 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {wiki.people.map((person) => (
              <li key={person.id}>
                <Link
                  href={`/wiki/people/${person.id}`}
                  style={{
                    color: "var(--wiki-fragment-link)",
                    textDecoration: "underline",
                    textDecorationSkipInk: "none",
                  }}
                >
                  {person.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WikiEntityArticle>
  );
}
