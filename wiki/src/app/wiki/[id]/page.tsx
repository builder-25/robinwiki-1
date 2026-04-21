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
import SectionEditor from "@/components/editor/SectionEditor";
import {
  WikiEntityArticle,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";
import { getWikiTypeIcon } from "@/components/wiki/WikiTypeBadge";
import { MarkdownContent } from "@/components/wiki/MarkdownContent";
import { WikiInfobox } from "@/components/wiki/WikiInfobox";
import { WikiChip } from "@/components/wiki/WikiChip";
import { WikiCitations } from "@/components/wiki/WikiCitations";
import { WikiEditLink } from "@/components/wiki/WikiFurniture";
import {
  parseSectionsFromMarkdown,
  replaceSectionInMarkdown,
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
 * Heading styles mirroring `MarkdownContent`'s internal `buildComponents`
 * heading mapping so that section-scoped headings (rendered by this
 * page) look identical to headings rendered inside `<MarkdownContent>`
 * body blocks. Kept inline rather than extracted to a shared module so
 * the duplication is local and easy to resync when either side drifts.
 */
const sectionHeadingStyle: Record<2 | 3 | 4, CSSProperties> = {
  2: {
    ...T.h2,
    color: "var(--wiki-article-h2)",
    margin: "24px 0 8px",
    borderBottom: "1px solid var(--wiki-card-border)",
    paddingBottom: 4,
  },
  3: {
    ...T.h3,
    color: "var(--wiki-article-h2)",
    margin: "20px 0 6px",
  },
  4: {
    ...T.h4,
    color: "var(--wiki-article-h2)",
    margin: "16px 0 4px",
  },
};

/**
 * Render a section's heading line with a trailing `[edit]` affordance.
 * The edit link is suppressed for H1 (per the phase spec — editing H1
 * is equivalent to full-body edit, which lives on the Edit tab) and for
 * H5/H6 (no visual treatment exists in `MarkdownContent`; fall through
 * to plain `MarkdownContent` rendering).
 *
 * Returns `null` when the level is outside 2–4 so the caller falls back
 * to rendering the whole section — including its heading — via
 * `<MarkdownContent>`.
 */
function SectionHeadingWithEdit({
  section,
  onEdit,
  showEditLink,
}: {
  section: SectionInfo;
  onEdit: (sectionId: string) => void;
  showEditLink: boolean;
}) {
  const style = sectionHeadingStyle[section.level as 2 | 3 | 4];
  if (!style) return null;

  const HeadingTag = (section.level === 3
    ? "h3"
    : section.level === 4
      ? "h4"
      : "h2") as "h2" | "h3" | "h4";

  const editLink = showEditLink ? (
    <>
      {" "}
      <WikiEditLink onClick={() => onEdit(section.id)} />
    </>
  ) : null;

  return (
    <HeadingTag style={style}>
      {section.heading}
      {editLink}
    </HeadingTag>
  );
}

/**
 * Render the markdown body as a sequence of section-scoped
 * `<MarkdownContent>` blocks, each followed by its `<WikiCitations>`
 * superscripts. Preamble before the first heading (if any) renders as
 * an unattributed leading block.
 *
 * If the body has no headings, falls back to a single whole-body render
 * — `sections` is empty in that case, so no citations are rendered.
 *
 * When `onEditSection` is provided, H2/H3/H4 headings gain a trailing
 * `[edit]` bracket affordance. H1 is excluded (editing it is equivalent
 * to whole-body edit). The heading itself is extracted and rendered
 * separately so the `[edit]` link can sit next to the heading text;
 * only the section body (lines after the heading) goes through
 * `<MarkdownContent>`.
 */
function SectionedMarkdownBody({
  content,
  refs,
  sections,
  style,
  onEditSection,
}: {
  content: string;
  refs: Record<string, WikiRef>;
  sections: WikiSection[] | undefined;
  style: CSSProperties;
  onEditSection?: (sectionId: string) => void;
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
    const matched = citationsByAnchor.get(section.anchor);
    const citations = matched?.citations ?? [];

    // H1 never gets the [edit] affordance — it's the document-level
    // heading and section-editing it is equivalent to full-body edit.
    // Levels outside 2–4 fall through to plain MarkdownContent so the
    // `[edit]` affordance isn't shown on H5/H6 that MarkdownContent
    // renders with default styling.
    const canExtractHeading =
      section.level >= 2 && section.level <= 4 && onEditSection !== undefined;

    if (canExtractHeading) {
      const bodyOnly = lines
        .slice(section.startLine + 1, section.endLine + 1)
        .join("\n");
      blocks.push(
        <div key={section.anchor} id={section.anchor}>
          <SectionHeadingWithEdit
            section={section}
            onEdit={onEditSection}
            showEditLink={true}
          />
          {bodyOnly.trim().length > 0 && (
            <MarkdownContent content={bodyOnly} refs={refs} style={style} />
          )}
          {citations.length > 0 && <WikiCitations citations={citations} />}
        </div>,
      );
      continue;
    }

    const body = lines
      .slice(section.startLine, section.endLine + 1)
      .join("\n");
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

  // Section-scoped edit state. `editingSectionId` doubles as the
  // "dialog open" indicator — non-null ⇒ open. The anchor id is stable
  // across renders as long as the heading text hasn't changed server-side.
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionSaveError, setSectionSaveError] = useState<string | null>(null);
  const [isSavingSection, setIsSavingSection] = useState(false);

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

  /**
   * Save a section-scoped edit. Re-parses the current wiki body (not a
   * cached snapshot) so the anchor lookup sees the latest document — if
   * another tab just regenerated the wiki, this gives us a chance to
   * surface a stale-section error rather than overwrite the wrong span.
   *
   * Heading line is preserved verbatim so anchor slugs stay stable; only
   * the body after the heading is replaced with the user's edit.
   */
  const handleSectionSave = async (sectionId: string, editedBody: string) => {
    if (!wiki || typeof wiki.wikiContent !== "string") return;
    const currentBody = wiki.wikiContent;
    const parsedNow = parseSectionsFromMarkdown(currentBody);
    const target = parsedNow.find((s) => s.id === sectionId);
    if (!target) {
      setSectionSaveError(
        "This section no longer exists — the wiki may have been regenerated. Close this dialog and reopen the section you want to edit.",
      );
      return;
    }
    const lines = currentBody.split("\n");
    const headingLine = lines[target.startLine];
    const newSectionBody = `${headingLine}\n${editedBody}`;
    const newFullBody = replaceSectionInMarkdown(
      currentBody,
      sectionId,
      newSectionBody,
    );

    setIsSavingSection(true);
    setSectionSaveError(null);
    try {
      const response = await fetch(`/api/api/content/wiki/${wiki.lookupKey}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontmatter: {
            name: wiki.name,
            type: wiki.type,
            prompt: wiki.prompt ?? "",
          },
          body: newFullBody,
        }),
      });
      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }
      await queryClient.invalidateQueries({ queryKey: ["wiki", id] });
      await queryClient.invalidateQueries({ queryKey: ["wikis"] });
      setEditingSectionId(null);
    } catch (e) {
      setSectionSaveError(
        e instanceof Error
          ? e.message
          : "Failed to save. Check your connection and try again.",
      );
    } finally {
      setIsSavingSection(false);
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

  // Resolve the currently-editing section's heading + body-only prefill.
  // Parses the live wiki content so a mid-session regeneration is
  // detected at dialog-open time — if the anchor no longer resolves,
  // `editingHeading` stays empty and the dialog surfaces a stale-anchor
  // message synthesized below instead of showing an empty editor.
  let editingHeading = "";
  let editingInitialBody = "";
  let sectionMissing = false;
  if (
    editingSectionId &&
    typeof wiki.wikiContent === "string" &&
    !isHtmlBody
  ) {
    const parsedForEdit = parseSectionsFromMarkdown(wiki.wikiContent);
    const target = parsedForEdit.find((s) => s.id === editingSectionId);
    if (target) {
      editingHeading = target.heading;
      const lines = wiki.wikiContent.split("\n");
      editingInitialBody = lines
        .slice(target.startLine + 1, target.endLine + 1)
        .join("\n");
    } else {
      sectionMissing = true;
      editingHeading = editingSectionId;
    }
  }
  const dialogError =
    sectionMissing && !sectionSaveError
      ? "This section no longer exists on the current wiki — it may have been regenerated while you weren't looking. Close this dialog and pick a section from the current page."
      : sectionSaveError;

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
          //
          // `onEditSection` enables the per-heading `[edit]` bracket
          // affordance. It's wired here (not on the HTML branch) because
          // section-scoped editing requires markdown fidelity — when the
          // body has been round-tripped through Tiptap HTML, the [[token]]
          // syntax and fenced blocks don't survive cleanly. Q9 default
          // option (b): hide the affordance on HTML-saved bodies. The
          // user is told to regenerate to re-enable it.
          <SectionedMarkdownBody
            content={wiki.wikiContent}
            refs={refs}
            sections={sidecarSections}
            style={bodyStyle}
            onEditSection={(sectionId) => {
              setSectionSaveError(null);
              setEditingSectionId(sectionId);
            }}
          />
        )
      )}
      <SectionEditor
        open={editingSectionId !== null}
        onOpenChange={(next) => {
          if (!next) {
            setEditingSectionId(null);
            setSectionSaveError(null);
          }
        }}
        heading={editingHeading}
        initialBody={editingInitialBody}
        isSaving={isSavingSection}
        error={dialogError}
        onSave={(body) => {
          if (editingSectionId && !sectionMissing) {
            void handleSectionSave(editingSectionId, body);
          }
        }}
      />

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
