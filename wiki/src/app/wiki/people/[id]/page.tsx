"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserRound, type LucideIcon } from "lucide-react";
import { type CSSProperties } from "react";
import { FONT, T } from "@/lib/typography";
import {
  WikiEntityArticle,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { MarkdownContent } from "@/components/wiki/MarkdownContent";
import { usePerson } from "@/hooks/usePerson";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SettingsIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--wiki-header-icon)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  );
}

function PeopleInfobox({
  person,
  onSettingsClick,
}: {
  person: { relationship: string; updatedAt: string };
  onSettingsClick?: () => void;
}) {
  const label: CSSProperties = {
    ...T.label,
    fontWeight: 700,
    color: "var(--wiki-infobox-title)",
  };

  const body: CSSProperties = {
    ...T.micro,
    color: "var(--wiki-infobox-text)",
    opacity: 0.7,
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
      <button
        type="button"
        aria-label="Infobox settings"
        onClick={() => onSettingsClick?.()}
        style={{
          position: "absolute",
          top: -1,
          right: 0,
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <SettingsIcon />
      </button>

      {person.relationship && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={label}>Relationship</p>
          <p style={{ ...body, margin: 0 }}>{person.relationship}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={label}>Last Updated</p>
        <p
          style={{
            ...body,
            color: "var(--wiki-article-link)",
            margin: 0,
            whiteSpace: "nowrap",
          }}
        >
          {formatDate(person.updatedAt)}
        </p>
      </div>
    </aside>
  );
}

function PeopleFragmentsSection({ backlinks }: { backlinks: Array<{ id: string; title: string }> }) {
  const count = backlinks.length;
  const bodyStyle = {
    ...T.bodySmall,
    color: "var(--wiki-article-text)",
    lineHeight: 1.6,
  };

  return (
    <section style={{ width: "100%" }}>
      <WikiSectionH2 title="Mentioned-in fragments" count={count} />
      {count === 0 ? (
        <p
          style={{
            ...T.bodySmall,
            fontFamily: FONT.SANS,
            fontStyle: "italic",
            color: "var(--wiki-count)",
            margin: "12px 0 0 0",
          }}
        >
          Not mentioned in any fragments
        </p>
      ) : (
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
          {backlinks.map((frag, i) => (
            <li key={i}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
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
                  mentions
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function WikiPeoplePage() {
  const { id } = useParams<{ id: string }>();
  const { data: person, isLoading, error } = usePerson(id);

  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="p-6">
        <h1 style={T.h1}>Person not found</h1>
        <p style={{ ...T.bodySmall, color: "var(--wiki-article-text)", marginTop: 8 }}>
          This person could not be loaded. They may have been deleted or you may not have access.
        </p>
      </div>
    );
  }

  const backlinks = person.backlinks ?? [];

  return (
    <>
    <Link href="/wiki" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--wiki-count)", textDecoration: "none", marginBottom: 12 }}>
      <ArrowLeft size={14} strokeWidth={1.5} />
      <span style={{ ...T.micro }}>Back</span>
    </Link>
    <WikiEntityArticle
      chipIcon={UserRound as LucideIcon}
      chipLabel="People"
      title={person.name}
      infobox={{ kind: "simple", typeLabel: "People", showSettings: true }}
      renderCustomInfobox={({ onSettingsClick }) => (
        <PeopleInfobox person={person} onSettingsClick={onSettingsClick} />
      )}
      customBottomSections={<PeopleFragmentsSection backlinks={backlinks} />}
    >
      {person.content && (
        <MarkdownContent content={person.content} style={bodyStyle} />
      )}
    </WikiEntityArticle>
    </>
  );
}
