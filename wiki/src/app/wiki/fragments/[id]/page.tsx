"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type CSSProperties } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { T, FONT } from "@/lib/typography";
import {
  WikiEntityArticle,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useFragment } from "@/hooks/useFragment";
import { useAcceptFragment } from "@/hooks/useAcceptFragment";
import { useRejectFragment } from "@/hooks/useRejectFragment";
import { MarkdownContent } from "@/components/wiki/MarkdownContent";
import type { FragmentWithContentResponseSchema } from "@/lib/generated/types.gen";

type FragmentData = FragmentWithContentResponseSchema & {
  backlinks?: Array<{ id: string; name: string; type: string }>;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function FragmentInfobox({ fragment }: { fragment: FragmentData }) {
  const label: CSSProperties = {
    ...T.micro,
    fontWeight: 700,
    color: "var(--wiki-infobox-title)",
    margin: 0,
  };

  const body: CSSProperties = {
    ...T.micro,
    color: "var(--wiki-infobox-text)",
    opacity: 0.7,
    margin: 0,
  };

  return (
    <aside
      className="wiki-aside-infobox"
      style={{
        position: "relative",
        width: 217,
        flexShrink: 0,
        border: "1px solid var(--wiki-card-border)",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        boxSizing: "border-box",
        alignSelf: "flex-start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={label}>Type</p>
        <p style={body}>{fragment.type}</p>
      </div>

      {fragment.tags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <p style={label}>Tags</p>
          <p style={body}>{fragment.tags.join(", ")}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={label}>Created</p>
        <p style={body}>{formatDate(fragment.createdAt)}</p>
      </div>
    </aside>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p
      style={{
        ...T.bodySmall,
        fontFamily: FONT.SANS,
        fontStyle: "italic",
        color: "var(--wiki-count)",
        margin: "12px 0 0 0",
      }}
    >
      {text}
    </p>
  );
}

function EntryOriginSection({ entryId }: { entryId: string }) {
  const bodyStyle = {
    ...T.bodySmall,
    color: "var(--wiki-article-text)",
    lineHeight: 1.6,
  };
  return (
    <section style={{ width: "100%" }}>
      <WikiSectionH2 title="Entry origin" count={1} />
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
        <li>
          <Link
            href={`/wiki/entries/${entryId}`}
            style={{
              color: "var(--wiki-fragment-link)",
              textDecoration: "underline",
              textDecorationSkipInk: "none",
            }}
          >
            View source entry
          </Link>
        </li>
      </ul>
    </section>
  );
}

function BacklinksSection({ backlinks }: { backlinks: Array<{ id: string; name: string; type: string }> }) {
  return (
    <section style={{ width: "100%" }}>
      <WikiSectionH2 title="Wikis" count={backlinks.length} />
      {backlinks.length === 0 ? (
        <EmptyState text="Not filed in any wiki" />
      ) : (
        <ul
          style={{
            ...T.bodySmall,
            color: "var(--wiki-article-text)",
            lineHeight: 1.6,
            listStyle: "decimal",
            paddingLeft: 20,
            margin: "12px 0 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {backlinks.map((bl) => (
            <li key={bl.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Link
                  href={`/wiki/${bl.id}`}
                  style={{
                    color: "var(--wiki-fragment-link)",
                    textDecoration: "underline",
                    textDecorationSkipInk: "none",
                  }}
                >
                  {bl.name}
                </Link>
                <Badge
                  variant="outline"
                  className="rounded-full"
                  style={{
                    backgroundColor: "#f5f5f5",
                    color: "#545353",
                    borderColor: "#d1d5db",
                    padding: "2px 10px",
                    ...T.micro,
                  }}
                >
                  {bl.type}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FragmentBottomSections({ fragment }: { fragment: FragmentData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40, width: "100%" }}>
      <EntryOriginSection entryId={fragment.entryId} />
      <BacklinksSection backlinks={fragment.backlinks ?? []} />
    </div>
  );
}

function FragmentReviewActions({ fragmentId, backlinks }: { fragmentId: string; backlinks: Array<{ id: string; name: string; type: string }> }) {
  const router = useRouter();
  const accept = useAcceptFragment();
  const reject = useRejectFragment();

  if (backlinks.length === 0) return null;

  const wikiId = backlinks[0].id;
  const isPending = accept.isPending || reject.isPending;

  const btnBase: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    fontSize: 12,
    background: "none",
    border: "1px solid var(--wiki-card-border)",
    cursor: isPending ? "default" : "pointer",
    opacity: isPending ? 0.6 : 1,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          accept.mutate({ id: fragmentId, wikiId }, {
            onSuccess: () => router.push(`/wiki/${wikiId}`),
          })
        }
        style={{ ...btnBase, color: "#16a34a" }}
      >
        <Check size={14} strokeWidth={1.5} />
        {accept.isPending ? "Accepting..." : "Accept"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          reject.mutate({ id: fragmentId, wikiId }, {
            onSuccess: () => router.push(`/wiki/${wikiId}`),
          })
        }
        style={{ ...btnBase, color: "red" }}
      >
        <X size={14} strokeWidth={1.5} />
        {reject.isPending ? "Rejecting..." : "Reject"}
      </button>
      {accept.isSuccess && (
        <span style={{ fontSize: 12, color: "#16a34a" }}>Fragment accepted</span>
      )}
      {reject.isSuccess && (
        <span style={{ fontSize: 12, color: "red" }}>Fragment rejected</span>
      )}
      {(accept.isError || reject.isError) && (
        <span style={{ fontSize: 12, color: "red" }}>
          {accept.isError ? "Failed to accept" : "Failed to reject"}
        </span>
      )}
    </div>
  );
}

export default function FragmentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: fragment, isLoading, error } = useFragment(id);

  const bodyStyle = {
    ...T.bodySmall,
    color: "var(--wiki-article-text)",
    lineHeight: 1.6,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !fragment) {
    return (
      <div className="p-6">
        <h1 style={T.h1}>Fragment not found</h1>
        <p style={{ ...T.bodySmall, color: "var(--wiki-article-text)", marginTop: 8 }}>
          This fragment could not be loaded. It may have been deleted or you may not have access.
        </p>
      </div>
    );
  }

  const frag = fragment as FragmentData;
  const backlinks = frag.backlinks ?? [];

  return (
    <>
    <Link href="/wiki" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--wiki-count)", textDecoration: "none", marginBottom: 12 }}>
      <ArrowLeft size={14} strokeWidth={1.5} />
      <span style={{ ...T.micro }}>Back</span>
    </Link>
    <WikiEntityArticle
      chipLabel="Fragment"
      title={frag.title}
      infobox={{ kind: "simple", typeLabel: "Fragment", showSettings: false }}
      renderCustomInfobox={() => <FragmentInfobox fragment={frag} />}
      customBottomSections={
        <>
          <FragmentReviewActions fragmentId={frag.id} backlinks={backlinks} />
          <FragmentBottomSections fragment={frag} />
        </>
      }
    >
      <MarkdownContent content={frag.content} style={bodyStyle} />
    </WikiEntityArticle>
    </>
  );
}
