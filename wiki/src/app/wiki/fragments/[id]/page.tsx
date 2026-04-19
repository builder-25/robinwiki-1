"use client";

import Link from "next/link";
import { type CSSProperties } from "react";
import { T, FONT } from "@/lib/typography";
import {
  WikiEntityArticle,
  WikiLink,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";
import { Badge } from "@/components/ui/badge";

const FRAGMENT = {
  title: "Instability and Collapse of the Weimar Republic",
  type: "fact",
  tags: ["germany", "history", "weimar-republic", "economic-crisis"],
  createdAt: "8 Apr 2026",
};

const ENTRY_ORIGIN = {
  id: "entry01SAMPLE",
  title: "Summary of German History",
  status: "extracted",
};

function FragmentInfobox() {
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
        <p style={body}>{FRAGMENT.type}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={label}>Tags</p>
        <p style={body}>{FRAGMENT.tags.join(", ")}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={label}>Created</p>
        <p style={body}>{FRAGMENT.createdAt}</p>
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

function EntryOriginSection() {
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Link
              href={`/wiki/entries/${ENTRY_ORIGIN.id}`}
              style={{
                color: "var(--wiki-fragment-link)",
                textDecoration: "underline",
                textDecorationSkipInk: "none",
              }}
            >
              {ENTRY_ORIGIN.title}
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
              {ENTRY_ORIGIN.status}
            </Badge>
          </div>
        </li>
      </ul>
    </section>
  );
}

function WikisSection() {
  return (
    <section style={{ width: "100%" }}>
      <WikiSectionH2 title="Wikis" count={0} />
      <EmptyState text="Not filed in any wiki" />
    </section>
  );
}

function PeopleSection() {
  return (
    <section style={{ width: "100%" }}>
      <WikiSectionH2 title="People" count={0} />
      <EmptyState text="No people mentioned" />
    </section>
  );
}

function RelatedFragmentsSection() {
  return (
    <section style={{ width: "100%" }}>
      <WikiSectionH2 title="Related fragments" count={0} />
      <EmptyState text="No related fragments" />
    </section>
  );
}

function FragmentBottomSections() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40, width: "100%" }}>
      <EntryOriginSection />
      <WikisSection />
      <PeopleSection />
      <RelatedFragmentsSection />
    </div>
  );
}

export default function FragmentPage() {
  const bodyStyle = {
    ...T.bodySmall,
    color: "var(--wiki-article-text)",
    lineHeight: 1.6,
  };

  return (
    <WikiEntityArticle
      chipLabel="Fragment"
      title={FRAGMENT.title}
      infobox={{ kind: "simple", typeLabel: "Fragment", showSettings: false }}
      renderCustomInfobox={() => <FragmentInfobox />}
      showDefaultBottomSections={false}
      customBottomSections={<FragmentBottomSections />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, ...bodyStyle }}>
        <p style={{ margin: 0 }}>
          The Weimar Republic faced compounding pressures from the moment of its
          founding in 1919: war reparations under the Treaty of Versailles, a
          fragile coalition government, and a public still reeling from the losses
          of the First World War. By the early 1920s, hyperinflation had
          destroyed middle-class savings and fuelled deep distrust of the
          democratic order.
        </p>
        <p style={{ margin: 0 }}>
          The 1929 Wall Street Crash triggered the next and decisive crisis.
          American loans that had propped up German industry were withdrawn; mass
          unemployment followed within months. The Reichstag fractured into
          increasingly extreme blocs, and Chancellor <WikiLink>Heinrich Brüning</WikiLink>
          {" "}governed by emergency decree as the constitutional order thinned.
        </p>
        <p style={{ margin: 0 }}>
          By 1933 the republic had effectively collapsed from within — not by
          invasion but by the slow erosion of the institutions meant to hold it
          up. The appointment of <WikiLink>Adolf Hitler</WikiLink> as Chancellor
          in January of that year marked the formal end of the republican
          experiment, though its substance had given way long before.
        </p>
      </div>
    </WikiEntityArticle>
  );
}
