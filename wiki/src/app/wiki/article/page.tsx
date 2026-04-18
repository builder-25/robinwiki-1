"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { T } from "@/lib/typography";
import {
  WikiEntityArticle,
  WikiLink,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";

function InfoBox() {
  const sectionTitleStyle = {
    ...T.micro,
    fontWeight: 700 as const,
    color: "var(--wiki-infobox-title)",
  };

  const sectionTextStyle = {
    ...T.micro,
    color: "var(--wiki-infobox-text)",
  };

  return (
    <Collapsible defaultOpen>
      <div
        className="wiki-article-infobox"
        style={{
          border: "1px solid var(--wiki-card-border)",
          width: 217,
          flexShrink: 0,
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          ...T.micro,
          overflow: "hidden",
          alignSelf: "flex-start",
        }}
      >
        <div>
          <CollapsibleTrigger
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              width: "100%",
              textAlign: "left",
            }}
          >
            <p style={sectionTitleStyle}>Relationship</p>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div style={{ ...sectionTextStyle, marginTop: 7 }}>
              <p>Audrey Geraldine Lorde</p>
              <p>
                February 18, 1934
                <span
                  style={{
                    ...T.tiny,
                    fontSize: 8,
                    color: "var(--wiki-article-link)",
                  }}
                >
                  [1]
                </span>
              </p>
              <p>
                <WikiLink>New York City</WikiLink>, U.S.
              </p>
            </div>
          </CollapsibleContent>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <p style={sectionTitleStyle}>Last Updated</p>
          <p
            style={{
              ...sectionTextStyle,
              color: "var(--wiki-article-link)",
              opacity: 0.7,
            }}
          >
            8 Apr 2026
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <p style={sectionTitleStyle}>Who They Are</p>
          <div style={sectionTextStyle}>
            <p>Poetry</p>
            <p>Nonfiction</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <p style={sectionTitleStyle}>How They Think</p>
          <div style={{ ...sectionTextStyle, fontStyle: "italic" }}>
            <p>The First Cities</p>
            <p>
              <WikiLink>Zami: A New Spelling of My Name</WikiLink>
            </p>
            <p>
              <WikiLink>The Cancer Journals</WikiLink>
            </p>
          </div>
        </div>
      </div>
    </Collapsible>
  );
}

export default function ArticlePage() {
  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  return (
    <WikiEntityArticle
      chipLabel="People"
      title="Audre Lorde"
      infobox={{ kind: "simple", typeLabel: "People" }}
      renderCustomInfobox={() => <InfoBox />}
      showDefaultBottomSections={false}
    >
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
