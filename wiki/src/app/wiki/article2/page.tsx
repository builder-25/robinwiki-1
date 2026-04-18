"use client";

import { T } from "@/lib/typography";
import {
  WikiEntityArticle,
  WikiLink,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";

const metaLabelStyle: React.CSSProperties = {
  ...T.tiny,
  fontWeight: 500,
  color: "var(--wiki-meta-label)",
  letterSpacing: "-0.2px",
  whiteSpace: "nowrap",
};

function MetaSection() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: 110,
        paddingBottom: 1,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          ...T.bodySmall,
          whiteSpace: "nowrap",
        }}
      >
        <p style={metaLabelStyle}>LAST UPDATED</p>
        <p
          style={{
            ...T.micro,
            fontWeight: 600,
            color: "var(--wiki-meta-date)",
            whiteSpace: "nowrap",
          }}
        >
          8 Apr 2026
        </p>
      </div>
      <p style={metaLabelStyle}>WHAT THEY CARE ABOUT</p>
      <p style={metaLabelStyle}>HOW THEY COMMUNITCATE</p>
      <p style={metaLabelStyle}>WHO THEY ARE</p>
      <p style={metaLabelStyle}>HOW THEY COMMUNICATE</p>

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "100%",
          height: 1,
          background: "#3b3b3b",
        }}
      />
    </div>
  );
}

export default function Article2Page() {
  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  return (
    <WikiEntityArticle
      chipLabel="People"
      title="Audre Lorde"
      showInfobox={false}
      infobox={{ kind: "simple", typeLabel: "People" }}
      showDefaultBottomSections={false}
    >
      <MetaSection />

      <div style={bodyStyle}>
        <p style={{ marginBottom: 0 }}>
          Audre Lorde (
          <WikiLink>/ˈɔːdri ˈlɔːrd/</WikiLink>; born Audrey Geraldine Lorde;
          February 18, 1934 – November 17, 1992) was an American writer,{" "}
          <WikiLink>feminist</WikiLink>, <WikiLink>womanist</WikiLink>,{" "}
          <WikiLink>librarian</WikiLink>, and <WikiLink>civil rights</WikiLink>{" "}
          activist. She was a self-described &ldquo;black, lesbian, mother,
          warrior, poet,&rdquo; who &ldquo;dedicated both her life and her
          creative talent to confronting and addressing injustices of{" "}
          <WikiLink>racism</WikiLink>, <WikiLink>sexism</WikiLink>,{" "}
          <WikiLink>classism</WikiLink>, and <WikiLink>homophobia</WikiLink>.
          &rdquo;
          <WikiLink>[1]</WikiLink>
        </p>
        <p>
          As a poet, she is best known for technical mastery and emotional
          expression, as well as her poems that express anger and outrage at
          civil and social injustices she observed throughout her life. As a{" "}
          <WikiLink>spoken word</WikiLink> artist, her delivery has been called
          powerful, melodic, and intense by the Poetry Foundation.
          <WikiLink>[1]</WikiLink> Her poems and prose largely deal with issues
          related to civil rights, feminism, lesbianism, illness and disability,
          and the exploration of black female identity.
          <WikiLink>[2][1][3]</WikiLink>
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <WikiSectionH2 title="Early life" />
        <p style={bodyStyle}>
          Lorde was born in New York City to Caribbean immigrants. Her father,
          Frederick Byron Lorde, (known as Byron) hailed from Barbados and her
          mother, Linda Gertrude Belmar Lorde, was Grenadian and had been born in
          the island of <WikiLink>Carriacou</WikiLink>. Lorde&apos;s mother was
          of mixed ancestry but could &ldquo;<WikiLink>pass</WikiLink>&rdquo; for
          &lsquo;<WikiLink>Spanish</WikiLink>&rsquo;,<WikiLink>[4]</WikiLink>{" "}
          which was a source of pride for her family. Lorde&apos;s father was
          darker than the Belmar family liked, and they only allowed the couple
          to marry because of Byron Lorde&apos;s charm, ambition, and
          persistence.
          <WikiLink>[5]</WikiLink> The family settled in <WikiLink>Harlem</WikiLink>
          . <WikiLink>Nearsighted</WikiLink> to the point of{" "}
          <WikiLink>being legally</WikiLink> blind and the youngest of three
          daughters (her two older sisters were named Phyllis and Helen), Lorde
          grew up hearing her mother&apos;s stories about the{" "}
          <WikiLink>West Indies</WikiLink>. At the age of four, she learned to
          talk while she learned to read, and her mother taught her to write at
          around the same time. She wrote her first poem when she was in eighth
          grade.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h4
          style={{
            ...T.bodySmall,
            fontWeight: 700,
            color: "var(--wiki-article-text)",
            paddingTop: 6,
            margin: 0,
          }}
        >
          Desktop H4
        </h4>
        <p style={{ ...bodyStyle, margin: 0 }}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
          veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
          commodo consequat. Duis
        </p>
        <p style={{ ...bodyStyle, margin: 0 }}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
          veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
          commodo consequat. Duis
        </p>
      </div>

      <WikiSectionH2 title="References" />
    </WikiEntityArticle>
  );
}
