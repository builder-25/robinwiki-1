"use client";

/**
 * `/wiki/preview/fixture` — design-validation harness for the sidecar
 * rendering stack. Renders the canonical wiki preview fixture through the
 * same `<WikiEntityArticle>` + `<MarkdownContent>` pipeline used by real
 * wiki detail pages.
 *
 * This route is an unauthenticated developer/designer tool. It lets Wave 2
 * and Wave 3 consumer phases verify token rendering, citation placement,
 * and infobox layout end-to-end without needing a real wiki to regenerate
 * and without depending on the backend Zod-strip fix landing (NQ13).
 *
 * The initial landing of this page is a minimal shell — body rendering
 * only. Follow-up commits in each consumer phase will enrich the demo
 * to show new capabilities (tokens-as-chips, per-section citations,
 * structured infobox) as they land.
 */

import Link from "next/link";
import { T } from "@/lib/typography";
import { Spinner } from "@/components/ui/spinner";
import { usePreviewWikiFixture } from "@/hooks/usePreviewWikiFixture";
import {
  WikiEntityArticle,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";
import { getWikiTypeIcon } from "@/components/wiki/WikiTypeBadge";
import { MarkdownContent } from "@/components/wiki/MarkdownContent";
import { WikiCitations } from "@/components/wiki/WikiCitations";

function capitalize(s: string | null | undefined) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function WikiPreviewFixturePage() {
  const { data: wiki, isLoading, error } = usePreviewWikiFixture();

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
        <h1 style={T.h1}>Preview fixture unavailable</h1>
        <p
          style={{
            ...T.bodySmall,
            color: "var(--wiki-article-text)",
            marginTop: 8,
          }}
        >
          The preview fixture endpoint did not respond. Confirm the core server
          is running and reachable via the <code>/api</code> proxy.
        </p>
        {error instanceof Error && (
          <pre
            style={{
              ...T.micro,
              color: "var(--wiki-article-text)",
              opacity: 0.7,
              marginTop: 12,
            }}
          >
            {error.message}
          </pre>
        )}
      </div>
    );
  }

  const typeLabel = capitalize(wiki.type);
  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  return (
    <WikiEntityArticle
      chipIcon={getWikiTypeIcon(typeLabel)}
      chipLabel={typeLabel}
      title={wiki.name}
      infobox={{
        kind: "simple",
        typeLabel,
        lastUpdated: wiki.updatedAt,
        showSettings: false,
      }}
      wikiId="preview"
    >
      {wiki.wikiContent && (
        <MarkdownContent content={wiki.wikiContent} style={bodyStyle} />
      )}

      {wiki.fragments && wiki.fragments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <WikiSectionH2
            title="Member Fragments"
            count={wiki.fragments.length}
          />
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

      {wiki.sections && wiki.sections.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <WikiSectionH2
            title="Sections (citations demo)"
            count={wiki.sections.length}
          />
          <p
            style={{
              ...bodyStyle,
              opacity: 0.7,
              margin: "4px 0 8px",
            }}
          >
            Each row is one entry in <code>sections[]</code>; citation
            superscripts render via <code>&lt;WikiCitations&gt;</code>. Hover
            a superscript to see the captured quote. Empty arrays render
            nothing — rows without trailing numbers mean the LLM declared
            no citations for that section.
          </p>
          <ul
            style={{
              ...bodyStyle,
              listStyle: "none",
              paddingLeft: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {wiki.sections.map((section) => (
              <li key={section.id} style={{ margin: 0 }}>
                <span style={{ opacity: 0.5, marginRight: 6 }}>
                  H{section.level}
                </span>
                {section.heading}
                <WikiCitations citations={section.citations ?? []} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </WikiEntityArticle>
  );
}
