"use client";

import Link from "next/link";
import { T } from "@/lib/typography";
import { EntryArticle } from "@/components/wiki/EntryArticle";
import { WikiSectionH2 } from "@/components/wiki/WikiEntityArticle";

type Fragment = {
  id: string;
  title: string;
  href: string;
};

const ENTRY = {
  title: "Morning thought — Apr 18",
  type: "thought",
  source: "mcp",
  createdAt: "18 Apr 2026",
  body: [
    "Woke early. Coffee on the fire escape. The city sounded soft for a Tuesday — trash trucks, pigeons, a saxophone two blocks over. I tried to hold the feeling of unhurried attention before my phone pulled me back in.",
    "Mornings are the one window where I can think without negotiation. When I lose the morning to notifications, the whole day runs tactical — answering, not asking. The rule holds: protect the first ninety minutes.",
    "The harder question is what counts as a real morning. A 7:30 start in silence is different from a 6:00 start already half-scheduled. The ritual matters less than the posture.",
  ],
};

const FRAGMENTS: Fragment[] = [
  { id: "f-1", title: "Protect the first ninety minutes of the day", href: "/wiki/fragments/fragment01SAMPLE" },
  { id: "f-2", title: "Mornings are the only window for unhurried attention", href: "/wiki/fragments/fragment01SAMPLE" },
  { id: "f-3", title: "Silence at the start changes the posture of the day", href: "/wiki/fragments/fragment01SAMPLE" },
  { id: "f-4", title: "Notifications convert thinking into answering", href: "/wiki/fragments/fragment01SAMPLE" },
  { id: "f-5", title: "A saxophone two blocks over", href: "/wiki/fragments/fragment01SAMPLE" },
];

export default function EntryPage() {
  const bodyStyle = {
    ...T.bodySmall,
    color: "var(--wiki-article-text)",
    lineHeight: 1.6,
  };

  return (
    <EntryArticle
      title={ENTRY.title}
      infobox={{
        type: ENTRY.type,
        source: ENTRY.source,
        createdAt: ENTRY.createdAt,
      }}
      body={
        <div style={{ display: "flex", flexDirection: "column", gap: 12, ...bodyStyle }}>
          {ENTRY.body.map((p, i) => (
            <p key={i} style={{ margin: 0 }}>
              {p}
            </p>
          ))}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <WikiSectionH2 title="Extracted Fragments" count={FRAGMENTS.length} />
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
          {FRAGMENTS.map((frag) => (
            <li key={frag.id}>
              <Link
                href={frag.href}
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
    </EntryArticle>
  );
}
