"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AddWikiModal from "@/components/layout/AddWikiModal";
import InlineEditor from "@/components/editor/InlineEditor";
import WikiHistoryTimeline from "@/components/wiki/WikiHistoryTimeline";
import { T, FONT } from "@/lib/typography";
import {
  EDITABLE_WIKI_TYPES,
  getWikiTypeColors,
  getWikiTypeIcon,
  isPeopleWikiType,
  WikiTypeBadge,
  type WikiType,
} from "@/components/wiki/WikiTypeBadge";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { useWikiEntityEditMode } from "@/components/wiki/useWikiEntityEditMode";
import { wikiEntitySettingsPrefill } from "@/lib/wikiSettingsPrefill";
import {
  Check,
  CircleDot,
  Flag,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const FragmentTitle =
  "Andrew Tate Biography | The Real World Portal";

function EyeOpenIcon() {
  return (
    <svg width={17} height={13} viewBox="0 0 17 13" fill="none" aria-hidden>
      <path
        d="M8.5 0.25C4.636 0.25 1.34 2.66 0 6.25C1.34 9.84 4.636 12.25 8.5 12.25C12.364 12.25 15.66 9.84 17 6.25C15.66 2.66 12.364 0.25 8.5 0.25ZM8.5 10.25C6.291 10.25 4.5 8.459 4.5 6.25C4.5 4.041 6.291 2.25 8.5 2.25C10.709 2.25 12.5 4.041 12.5 6.25C12.5 8.459 10.709 10.25 8.5 10.25ZM8.5 4.25C7.395 4.25 6.5 5.145 6.5 6.25C6.5 7.355 7.395 8.25 8.5 8.25C9.605 8.25 10.5 7.355 10.5 6.25C10.5 5.145 9.605 4.25 8.5 4.25Z"
        fill="rgba(0, 0, 0, 1)"
      />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg width={17} height={15} viewBox="0 0 17 15" fill="none" aria-hidden>
      <path
        d="M8.5 2.5C10.709 2.5 12.5 4.291 12.5 6.5C12.5 7.02 12.39 7.51 12.21 7.97L14.54 10.3C15.77 9.29 16.73 7.99 17 6.5C15.66 2.91 12.364 0.5 8.5 0.5C7.474 0.5 6.49 0.68 5.57 0.99L7.28 2.7C7.74 2.52 8.22 2.5 8.5 2.5ZM0.94 1.37L2.69 3.12L3.08 3.51C1.73 4.55 0.68 5.93 0 6.5C1.34 10.09 4.636 12.5 8.5 12.5C9.63 12.5 10.71 12.28 11.71 11.89L12.08 12.26L14.38 14.56L15.33 13.61L1.89 0.42L0.94 1.37ZM5.18 5.61L6.32 6.75C6.29 6.83 6.27 6.92 6.27 7C6.27 8.105 7.165 9 8.27 9C8.35 9 8.44 8.98 8.52 8.95L9.66 10.09C9.24 10.3 8.78 10.43 8.27 10.43C6.061 10.43 4.27 8.639 4.27 6.43C4.27 5.92 4.4 5.46 4.61 5.04L5.18 5.61ZM8.36 4.08L10.69 6.41L10.71 6.27C10.71 5.165 9.815 4.27 8.71 4.27L8.36 4.08Z"
        fill="rgba(0, 0, 0, 1)"
      />
    </svg>
  );
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

export function WikiLink({
  children,
  href = "#",
}: {
  children: ReactNode;
  href?: string;
}) {
  return (
    <a
      href={href}
      style={{ color: "var(--wiki-article-link)", textDecoration: "none" }}
    >
      {children}
    </a>
  );
}

const infoboxLabel = {
  ...T.micro,
  fontWeight: 700 as const,
  color: "var(--wiki-infobox-title)",
};

const infoboxBodyMuted = {
  ...T.micro,
  color: "var(--wiki-infobox-text)",
  opacity: 0.7,
};

export function WikiInfoboxTypeUpdated({
  typeLabel,
  showSettings,
  onSettingsClick,
}: {
  typeLabel: string;
  showSettings?: boolean;
  onSettingsClick?: () => void;
}) {
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
      {showSettings ? (
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
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={infoboxLabel}>Type</p>
        <p style={{ ...infoboxBodyMuted, margin: 0 }}>{typeLabel}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={infoboxLabel}>Last Updated</p>
        <p
          style={{
            ...infoboxBodyMuted,
            color: "var(--wiki-article-link)",
            margin: 0,
            whiteSpace: "nowrap",
          }}
        >
          8 Apr 2026
        </p>
      </div>
    </aside>
  );
}

export function WikiInfoboxGoalStyle({
  typeValue,
  showSettings,
  onSettingsClick,
}: {
  typeValue: string;
  showSettings?: boolean;
  onSettingsClick?: () => void;
}) {
  const linkValue = {
    ...infoboxBodyMuted,
    color: "var(--wiki-article-link)",
    margin: 0 as const,
    whiteSpace: "nowrap" as const,
  };

  const rows: { label: string; value: string; link?: boolean }[] = [
    { label: "Type", value: typeValue, link: false },
    { label: "Started", value: "8 Apr 2026", link: true },
    { label: "Target", value: "8 Apr 2026", link: true },
    { label: "Momentum", value: "In Progress", link: true },
    { label: "Last Updated", value: "8 Apr 2026", link: true },
  ];

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
        ...T.micro,
      }}
    >
      {showSettings ? (
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
      ) : null}
      {rows.map((row) => (
        <div
          key={row.label}
          style={{ display: "flex", flexDirection: "column", gap: 7 }}
        >
          <p style={infoboxLabel}>{row.label}</p>
          <p
            style={
              row.link
                ? linkValue
                : { ...infoboxBodyMuted, margin: 0, whiteSpace: "normal" }
            }
          >
            {row.value}
          </p>
        </div>
      ))}
    </aside>
  );
}

function ProgressMarkersBlock({
  rows,
}: {
  rows: [string, string, string, string, boolean][];
}) {
  return (
    <div
      style={{
        border: "1px solid #282828",
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
      }}
    >
      {rows.map(([title, body, date, status, muted], i) => (
        <div
          key={i}
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            opacity: muted ? 0.3 : 1,
          }}
        >
          <div
            className="wiki-progress-marker-row"
            style={{
              display: "flex",
              gap: 26,
              alignItems: "center",
              paddingTop: 9,
              paddingBottom: 9,
              width: "100%",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i === 0 ? (
                <Check
                  size={24}
                  strokeWidth={1.5}
                  color="#b9b9b9"
                  aria-hidden
                />
              ) : i === 1 ? (
                <CircleDot
                  size={24}
                  strokeWidth={1.5}
                  color="#b9b9b9"
                  aria-hidden
                />
              ) : (
                <Flag
                  size={24}
                  strokeWidth={1.5}
                  color="#b9b9b9"
                  aria-hidden
                />
              )}
            </div>
            <div
              className="wiki-progress-marker-main"
              style={{
                flex: "0 1 442px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minWidth: 0,
              }}
            >
              <p
                style={{
                  margin: 0,
                  ...T.h4,
                  fontWeight: 500,
                  letterSpacing: "0.16px",
                  color: "#d5d5d5",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                }}
              >
                {title}
              </p>
              <p
                style={{
                  margin: 0,
                  ...T.bodySmall,
                  color: "var(--wiki-article-text)",
                }}
              >
                {body}
              </p>
            </div>
            <div
              className="wiki-progress-marker-side"
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "flex-end",
                textAlign: "right",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  alignItems: "flex-end",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    ...T.h4,
                    fontWeight: 500,
                    letterSpacing: "0.16px",
                    color: "#d5d5d5",
                    whiteSpace: "nowrap",
                  }}
                >
                  {date}
                </p>
                <p
                  style={{
                    margin: 0,
                    ...T.bodySmall,
                    color: "var(--wiki-article-text)",
                    maxWidth: 171,
                  }}
                >
                  {status}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WikiProgressMarkersSection({
  variant = "objective",
}: {
  variant?: "objective" | "project";
}) {
  const row1Body =
    variant === "project"
      ? "First real proof — covers team costs and proves repeatable sales."
      : "Team costs and proves repeatable sales.";
  const rows: [string, string, string, string, boolean][] = [
    ["$500k ARR", row1Body, "Mar 2025", "Achieved", false],
    [
      "$500k ARR",
      variant === "project"
        ? "First real proof — covers team costs and proves repeatable sales."
        : "First real proof",
      "April 2025",
      "In Progress",
      false,
    ],
    [
      "$500k ARR",
      variant === "project"
        ? "First real proof — covers team costs and"
        : "First real proof — covers team costs and",
      "Dec 2026",
      "Not Started",
      true,
    ],
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        width: "100%",
        borderRadius: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 11,
          paddingTop: 20,
          width: "100%",
        }}
      >
        <h2
          style={{
            margin: 0,
            ...T.h2,
            color: "var(--wiki-article-h2)",
          }}
        >
          Progress Markers
        </h2>
        <div
          style={{
            height: 1,
            width: "100%",
            background: "var(--wiki-meta-line)",
          }}
        />
      </div>
      <ProgressMarkersBlock rows={rows} />
    </div>
  );
}

export function WikiIntroLead() {
  return (
    <p
      style={{
        margin: 0,
        ...T.bodySmall,
        color: "var(--wiki-article-text)",
      }}
    >
      Audre Lorde (
      <WikiLink>/ˈɔːdri ˈlɔːrd/</WikiLink>; born Audrey Geraldine Lorde;
      February 18, 1934 – November 17, 1992) was an American writer,{" "}
      <WikiLink>feminist</WikiLink>, <WikiLink>womanist</WikiLink>,{" "}
      <WikiLink>librarian</WikiLink>, and <WikiLink>civil rights</WikiLink>{" "}
      activist. She was a self-described
    </p>
  );
}

export function WikiBiographyBlock() {
  return (
    <p style={{ margin: 0 }}>
      Lorde was born in New York City to Caribbean immigrants. Her father,
      Frederick Byron Lorde, (known as Byron) hailed from Barbados and her
      mother, Linda Gertrude Belmar Lorde, was Grenadian and had been born in
      the island of <WikiLink>Carriacou</WikiLink>. Lorde&apos;s mother was of
      mixed ancestry but could &ldquo;<WikiLink>pass</WikiLink>&rdquo; for
      &lsquo;
      <WikiLink>Spanish</WikiLink>&rsquo;,
      <WikiLink>[4]</WikiLink> which was a source of pride for her family.
      Lorde&apos;s father was darker than the Belmar family liked, and they
      only allowed the couple to marry because of Byron Lorde&apos;s charm,
      ambition, and persistence.
      <WikiLink>[5]</WikiLink> The family settled in <WikiLink>Harlem</WikiLink>
      . <WikiLink>Nearsighted</WikiLink> to the point of{" "}
      <WikiLink>being legally</WikiLink> blind and the youngest of three
      daughters (her two older sisters were named Phyllis and Helen), Lorde grew
      up hearing her mother&apos;s stories about the <WikiLink>West Indies</WikiLink>
      . At the age of four, she learned to talk while she learned to read, and
      her mother taught her to write at around the same time. She wrote her
      first poem when she was in eighth grade.
    </p>
  );
}

export function WikiDesktopH4Lorem({ paragraphs = 1 }: { paragraphs?: 1 | 2 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h4
        style={{
          margin: 0,
          paddingTop: 6,
          ...T.bodySmall,
          fontWeight: 700,
          color: "var(--wiki-article-text)",
        }}
      >
        Desktop H4
      </h4>
      <p
        style={{
          margin: 0,
          ...T.bodySmall,
          color: "var(--wiki-article-text)",
        }}
      >
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat. Duis
      </p>
      {paragraphs === 2 ? (
        <p
          style={{
            margin: 0,
            ...T.bodySmall,
            color: "var(--wiki-article-text)",
          }}
        >
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
          veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
          commodo consequat. Duis
        </p>
      ) : null}
    </div>
  );
}

export function WikiSectionH2({ title, count }: { title: string; count?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        paddingTop: 20,
        width: "100%",
      }}
    >
      <h2
        style={{
          margin: 0,
          ...T.h2,
          color: "var(--wiki-article-h2)",
          display: "flex",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span>{title}</span>
        {count !== undefined ? (
          <span
            style={{
              ...T.bodySmall,
              fontFamily: FONT.SANS,
              fontWeight: 400,
              color: "var(--wiki-count)",
            }}
          >
            ({count})
          </span>
        ) : null}
      </h2>
      <div
        style={{
          height: 1,
          width: "100%",
          background: "var(--wiki-meta-line)",
        }}
      />
    </div>
  );
}

const MEMBER_FRAGMENTS: { id: string; title: string }[] = [
  { id: "fragment01SAMPLE", title: FragmentTitle },
  { id: "fragment01SAMPLE", title: FragmentTitle },
  { id: "fragment01SAMPLE", title: FragmentTitle },
  { id: "fragment01SAMPLE", title: FragmentTitle },
];

function MemberFragmentsSection() {
  const bodyStyle = {
    ...T.bodySmall,
    color: "var(--wiki-article-text)",
    lineHeight: 1.6,
  };
  const count = MEMBER_FRAGMENTS.length;
  return (
    <section style={{ width: "100%" }}>
      <WikiSectionH2 title="Member fragments" count={count} />
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
          No member fragments
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
          {MEMBER_FRAGMENTS.map((frag, i) => (
            <li key={i}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <a
                  href={`/wiki/fragments/${frag.id}`}
                  style={{
                    color: "var(--wiki-fragment-link)",
                    textDecoration: "underline",
                    textDecorationSkipInk: "none",
                  }}
                >
                  {frag.title}
                </a>
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
                  filed in
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface MentionedPerson {
  id: string;
  name: string;
  role: string;
  description: string;
  mentionCount: number;
  lastSeen: string;
  tags: string[];
}

const MENTIONED_PEOPLE: MentionedPerson[] = [
  {
    id: "person01SAMPLE",
    name: "Priya Natarajan",
    role: "Mentor",
    description:
      "Long conversations about astrophysics, dark matter, and the ethics of public science",
    mentionCount: 12,
    lastSeen: "3 days ago",
    tags: ["Mentor", "Science"],
  },
  {
    id: "person01SAMPLE",
    name: "Jamal Okafor",
    role: "Friend",
    description:
      "Recurring debates on jazz history, improvisation, and the weight of the blues tradition",
    mentionCount: 5,
    lastSeen: "2 weeks ago",
    tags: ["Friend", "Music"],
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function MentionedPersonCard({ person }: { person: MentionedPerson }) {
  return (
    <Link
      href={`/wiki/people/${person.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <Card className="cursor-pointer rounded-none border-[var(--card-border)] shadow-none transition-colors hover:bg-[#fafafa]">
      <CardContent className="flex items-start gap-3.5 p-4">
        <Avatar size="lg" className="shrink-0 rounded-none after:rounded-none">
          <AvatarFallback className="rounded-none bg-[#f0f0f0] text-[#6b6b6b]">
            {getInitials(person.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              style={{
                margin: 0,
                ...T.h4,
                fontWeight: 500,
                letterSpacing: "0.16px",
                color: "rgba(0, 0, 0, 1)",
              }}
            >
              {person.name}
            </p>
            {person.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="rounded-none bg-[#f5f5f5] text-[#545353] font-normal"
              >
                {tag}
              </Badge>
            ))}
          </div>
          <p
            style={{
              margin: 0,
              ...T.bodySmall,
              color: "var(--wiki-article-text)",
            }}
          >
            {person.description}
          </p>
          <div
            style={{
              display: "flex",
              gap: 3,
              alignItems: "center",
              ...T.micro,
              color: "#444",
              whiteSpace: "nowrap",
            }}
          >
            <span>Mentioned in {person.mentionCount} fragments </span>
            <span style={{ lineHeight: "10px" }}>•</span>
            <span>Last seen {person.lastSeen}</span>
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}

function MentionedPeopleSection() {
  const count = MENTIONED_PEOPLE.length;
  return (
    <section
      className="wiki-mentioned-section"
      style={{ width: "100%", maxWidth: 864 }}
    >
      <WikiSectionH2 title="Mentioned people" count={count} />
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
          No people mentioned
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 16,
          }}
        >
          {MENTIONED_PEOPLE.map((person, i) => (
            <MentionedPersonCard key={i} person={person} />
          ))}
        </div>
      )}
    </section>
  );
}

export type WikiEntityInfoboxConfig =
  | { kind: "simple"; typeLabel: string; showSettings?: boolean }
  | { kind: "extended"; typeValue: string; showSettings?: boolean };

export type WikiEntityArticleProps = {
  chipIcon?: LucideIcon;
  chipLabel: string;
  title: string;
  titleEllipsis?: boolean;
  /** Figma agent: divider under title row is hidden */
  showTitleUnderline?: boolean;
  /** Show/hide infobox panel + eye toggle button */
  showInfobox?: boolean;
  infobox: WikiEntityInfoboxConfig;
  /**
   * Optional custom infobox renderer used by pages that keep the shared shell
   * but need a type-specific infobox content/layout.
   */
  renderCustomInfobox?: (args: { onSettingsClick?: () => void }) => ReactNode;
  /**
   * If false, don't render default Member Fragments + Mentioned People sections.
   */
  showDefaultBottomSections?: boolean;
  /**
   * Optional sections rendered after divider and before modal.
   */
  customBottomSections?: ReactNode;
  children: ReactNode;
};

function renderInfobox(
  config: WikiEntityInfoboxConfig,
  onSettingsClick?: () => void,
) {
  if (config.kind === "simple") {
    return (
      <WikiInfoboxTypeUpdated
        typeLabel={config.typeLabel}
        showSettings={config.showSettings}
        onSettingsClick={onSettingsClick}
      />
    );
  }
  return (
    <WikiInfoboxGoalStyle
      typeValue={config.typeValue}
      showSettings={config.showSettings}
      onSettingsClick={onSettingsClick}
    />
  );
}

export function WikiEntityArticle({
  chipIcon: ChipIcon,
  chipLabel,
  title,
  titleEllipsis = false,
  showTitleUnderline = true,
  showInfobox = true,
  infobox,
  renderCustomInfobox,
  showDefaultBottomSections = true,
  customBottomSections,
  children,
}: WikiEntityArticleProps) {
  const [infoVisible, setInfoVisible] = useState(true);
  const [wikiSettingsOpen, setWikiSettingsOpen] = useState(false);
  const readContentRef = useRef<HTMLDivElement | null>(null);
  const {
    isEditing,
    isViewingHistory,
    draftContent,
    savedContent,
    draftTitle,
    savedTitle,
    draftChipLabel,
    savedChipLabel,
    revisions,
    setDraftContent,
    setDraftTitle,
    setDraftChipLabel,
    enterEditMode,
    openHistory,
    closeHistory,
    handleSave,
    handleCancel,
  } = useWikiEntityEditMode({
    infoVisible,
    setInfoVisible,
  });

  const displayTitle = savedTitle ?? title;
  const displayChipLabel = savedChipLabel ?? chipLabel;
  const displayChipIcon = getWikiTypeIcon(displayChipLabel);
  const draftChipColors = getWikiTypeColors(draftChipLabel);
  const wikiTypeLocked = isPeopleWikiType(displayChipLabel);

  const wikiSettingsPrefill = useMemo(
    () => wikiEntitySettingsPrefill({ title: displayTitle, chipLabel: displayChipLabel }),
    [displayTitle, displayChipLabel],
  );

  const tabs = ["Read", "Edit", "View history"] as const;

  return (
    <div className="wiki-page wiki-page--article">
      <div
        style={{
          width: "100%",
          maxWidth: 864,
          display: "flex",
          flexDirection: "column",
          gap: 56,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: "100%",
            }}
          >
            {isEditing ? (
              wikiTypeLocked ? (
                <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
                  <WikiTypeBadge type={displayChipLabel} icon={displayChipIcon} />
                </div>
              ) : (
                <div
                  style={{
                    display: "inline-flex",
                    flexDirection: "column",
                    gap: 0,
                    alignItems: "flex-start",
                  }}
                >
                  <Combobox
                    value={draftChipLabel}
                    items={EDITABLE_WIKI_TYPES}
                    filter={null}
                    onValueChange={(value) => setDraftChipLabel(String(value))}
                  >
                    <ComboboxTrigger
                      className="inline-flex w-fit items-center gap-1 rounded-sm border border-border bg-white text-xs [&>svg]:text-black"
                      render={<button type="button" />}
                      style={{
                        paddingLeft: 6,
                        paddingRight: 6,
                        paddingTop: 3,
                        paddingBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: draftChipColors.bg,
                          color: "rgba(0, 0, 0, 1)",
                          borderColor: draftChipColors.border,
                          borderWidth: 1,
                          borderStyle: "solid",
                          borderRadius: 2,
                          padding: "2px 8px",
                          lineHeight: "16px",
                        }}
                      >
                        {(() => {
                          const DraftIcon = getWikiTypeIcon(draftChipLabel);
                          return DraftIcon ? <DraftIcon /> : null;
                        })()}
                        <ComboboxValue />
                      </span>
                    </ComboboxTrigger>
                    <ComboboxContent className="rounded-none px-2 py-1">
                      <ComboboxEmpty>No wiki type found.</ComboboxEmpty>
                      <ComboboxList>
                        <ComboboxCollection>
                          {(item) => {
                            const type = item as WikiType;
                            return (
                              <ComboboxItem value={type}>
                                <WikiTypeBadge type={type} />
                              </ComboboxItem>
                            );
                          }}
                        </ComboboxCollection>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
              )
            ) : (
              <WikiTypeBadge type={displayChipLabel} icon={displayChipIcon ?? ChipIcon} />
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                width: "100%",
                padding: "4px 8px",
              }}
            >
              <div
                className="wiki-article-title-wrap"
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  width: "100%",
                  borderBottom: showTitleUnderline
                    ? "1px solid var(--wiki-search-section-line)"
                    : "none",
                }}
              >
                {isEditing ? (
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    aria-label="Wiki title"
                    style={{
                      margin: 0,
                      paddingBottom: 7,
                      ...T.h1,
                      fontFamily: FONT.SERIF,
                      color: "var(--wiki-title)",
                      minWidth: 0,
                      flex: 1,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                    }}
                  />
                ) : (
                  <h1
                    className="wiki-article-h1"
                    style={{
                      margin: 0,
                      paddingBottom: 7,
                      ...T.h1,
                      fontFamily: FONT.SERIF,
                      color: "var(--wiki-title)",
                      overflow: titleEllipsis ? "hidden" : undefined,
                      textOverflow: titleEllipsis ? "ellipsis" : undefined,
                      whiteSpace: titleEllipsis ? "nowrap" : undefined,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    {displayTitle}
                  </h1>
                )}
                <div
                  className="wiki-article-tabs"
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 13,
                    flexShrink: 0,
                  }}
                >
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="wiki-article-tab"
                        onClick={handleSave}
                        style={{
                          background: "none",
                          borderTop: "none",
                          borderLeft: "none",
                          borderRight: "none",
                          cursor: "pointer",
                          ...T.bodySmall,
                          fontFamily: FONT.SANS,
                          lineHeight: "20px",
                          paddingBottom: 7,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="wiki-article-tab-muted"
                        onClick={handleCancel}
                        style={{
                          background: "none",
                          borderTop: "none",
                          borderLeft: "none",
                          borderRight: "none",
                          cursor: "pointer",
                          ...T.bodySmall,
                          fontFamily: FONT.SANS,
                          lineHeight: "20px",
                          paddingBottom: 7,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    tabs.map((tab) => {
                      const active =
                        (tab === "Read" && !isViewingHistory) ||
                        (tab === "View history" && isViewingHistory);
                      return (
                        <button
                          key={tab}
                          type="button"
                          className={
                            active
                              ? "wiki-article-tab wiki-article-tab-active"
                              : "wiki-article-tab"
                          }
                          onClick={() => {
                            if (tab === "Edit") {
                              enterEditMode({
                                currentHtml: readContentRef.current?.innerHTML ?? "",
                                currentTitle: displayTitle,
                                currentChipLabel: displayChipLabel,
                              });
                            } else if (tab === "View history") {
                              openHistory({
                                currentHtml: readContentRef.current?.innerHTML ?? "",
                                currentTitle: displayTitle,
                                currentChipLabel: displayChipLabel,
                              });
                            } else if (tab === "Read") {
                              if (isViewingHistory) closeHistory();
                            }
                          }}
                          style={{
                            background: "none",
                            borderTop: "none",
                            borderLeft: "none",
                            borderRight: "none",
                            cursor: "pointer",
                            ...T.bodySmall,
                            fontFamily: FONT.SANS,
                            lineHeight: "20px",
                            paddingBottom: 7,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tab}
                        </button>
                      );
                    })
                  )}
                  {showInfobox && !isEditing && !isViewingHistory ? (
                    <button
                      type="button"
                      title={infoVisible ? "Hide infobox" : "Show infobox"}
                      onClick={() => setInfoVisible((v) => !v)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        paddingBottom: 12,
                      }}
                    >
                      {infoVisible ? <EyeOpenIcon /> : <EyeClosedIcon />}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div
            className="wiki-article-layout"
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              width: "100%",
            }}
          >
            <div
              className="wiki-article-content"
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {isEditing ? (
                <InlineEditor
                  content={draftContent}
                  onChange={setDraftContent}
                  editable
                />
              ) : isViewingHistory ? (
                <WikiHistoryTimeline revisions={revisions} />
              ) : (
                <div ref={readContentRef}>
                  {savedContent ? (
                    <div
                      className="wiki-richtext-rendered"
                      dangerouslySetInnerHTML={{ __html: savedContent }}
                    />
                  ) : (
                    children
                  )}
                </div>
              )}
            </div>

            {showInfobox && infoVisible && !isEditing && !isViewingHistory
              ? (() => {
                  const onSettingsClick =
                    (infobox.kind === "simple" || infobox.kind === "extended") &&
                    infobox.showSettings
                      ? () => setWikiSettingsOpen(true)
                      : undefined;

                  if (renderCustomInfobox) {
                    return renderCustomInfobox({ onSettingsClick });
                  }

                  return renderInfobox(infobox, onSettingsClick);
                })()
              : null}
          </div>
        </div>

        {showDefaultBottomSections ? (
          <>
            <MemberFragmentsSection />
            <MentionedPeopleSection />
          </>
        ) : null}

        {customBottomSections}
      </div>

      <AddWikiModal
        open={wikiSettingsOpen}
        onClose={() => setWikiSettingsOpen(false)}
        title="Wiki Settings"
        confirmLabel="Edit Wiki Settings"
        prefill={wikiSettingsPrefill}
      />
    </div>
  );
}
