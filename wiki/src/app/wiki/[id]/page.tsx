"use client";

import { useState } from "react";
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

function capitalize(s: string | null | undefined) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
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

  return (
    <WikiEntityArticle
      chipIcon={getWikiTypeIcon(typeLabel)}
      chipLabel={typeLabel}
      title={wiki.name}
      infobox={{ kind: "simple", typeLabel, lastUpdated: wiki.updatedAt, showSettings: true }}
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
        wiki.wikiContent.trim().startsWith('<') ? (
          <div className="wiki-richtext-rendered" style={bodyStyle} dangerouslySetInnerHTML={{ __html: wiki.wikiContent }} />
        ) : (
          <MarkdownContent content={wiki.wikiContent} style={bodyStyle} />
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
