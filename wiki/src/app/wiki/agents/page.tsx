"use client";

import { Bot } from "lucide-react";
import {
  WikiDesktopH4Lorem,
  WikiEntityArticle,
  WikiIntroLead,
  WikiLink,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";
import { T } from "@/lib/typography";

function WikiBiographyFull() {
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
      up hearing her mother&apos;s stories about the{" "}
      <WikiLink>West Indies</WikiLink>. At the age of four, she learned to talk
      while she learned to read, and her mother taught her to write at around
      the same time. She wrote her first poem when she was in eighth grade.
    </p>
  );
}

function WikiBiographyShort() {
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
      <WikiLink>[5]</WikiLink>
    </p>
  );
}

export default function WikiAgentsPage() {
  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  return (
    <WikiEntityArticle
      chipIcon={Bot}
      chipLabel="Agent"
      title="Discovery Interview Agent"
      showTitleUnderline={false}
      infobox={{ kind: "simple", typeLabel: "Agent", showSettings: true }}
    >
      <WikiIntroLead />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <WikiSectionH2 title="Role" />
        <div style={bodyStyle}>
          <p style={{ margin: 0 }}>
            Audre Lorde (
            <WikiLink>/ˈɔːdri ˈlɔːrd/</WikiLink>; born Audrey Geraldine Lorde;
            February 18, 1934 – November 17, 1992) was an American writer,{" "}
            <WikiLink>feminist</WikiLink>, <WikiLink>womanist</WikiLink>,{" "}
            <WikiLink>librarian</WikiLink>, and <WikiLink>civil rights</WikiLink>{" "}
            activist. She was a self-described nown as Byron) hailed from
            Barbados and her mother, Linda Gertrude Belmar Lorde, was Grenadian
            and had been born in the island of Carriacou. Lorde&apos;s mother
            was of mixed ancestry but could &quot;pass&quot; for
            &apos;Spanish&apos;,
            <WikiLink>[4]</WikiLink> which was a source of pride for her family.
            Lorde&apos;s father was darker than the Belmar family liked, and they
            only allowed the couple to marry because of Byron Lorde&apos;s
            charm, ambition, and persistence.
            <WikiLink>[5]</WikiLink> The family settled in Harlem. Nearsighted
            to the point of being legally blind and the youngest of three
            daughters (her two older sisters were named Phyllis and Helen), Lorde
            grew up hearing her mother&apos;s{" "}
          </p>
          <WikiBiographyFull />
        </div>
        <WikiDesktopH4Lorem />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <WikiSectionH2 title="What Success looks like" />
        <div style={bodyStyle}>
          <WikiBiographyShort />
        </div>
        <WikiDesktopH4Lorem paragraphs={2} />
      </div>
    </WikiEntityArticle>
  );
}
