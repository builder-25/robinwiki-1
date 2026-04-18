"use client";

import { UserRound, type LucideIcon } from "lucide-react";
import { type CSSProperties } from "react";
import { FONT, T } from "@/lib/typography";
import {
  WikiDesktopH4Lorem,
  WikiEntityArticle,
  WikiSectionH2,
  WikiLink,
} from "@/components/wiki/WikiEntityArticle";

const PEOPLE_FRAGMENTS: string[] = [
  "Andrew Tate Biography | The Real World Portal",
  "Andrew Tate Biography | The Real World Portal",
  "Andrew Tate Biography | The Real World Portal",
  "Andrew Tate Biography | The Real World Portal",
];

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
  onSettingsClick,
}: {
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

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={label}>Relationship</p>
        <div style={body}>
          <p style={{ margin: 0 }}>Audrey Geraldine Lorde</p>
          <p style={{ margin: 0 }}>
            February 18, 1934
            <span
              style={{
                ...T.tiny,
                fontSize: 8,
                lineHeight: "10px",
                color: "var(--wiki-article-link)",
                verticalAlign: "super",
              }}
            >
              [1]
            </span>
          </p>
          <p style={{ margin: 0 }}>
            <WikiLink>New York City</WikiLink>, U.S.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={label}>Last Updated</p>
        <p
          style={{
            ...body,
            color: "var(--wiki-article-link)",
            margin: 0,
            whiteSpace: "nowrap",
          }}
        >
          8 Apr 2026
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={label}>Who They Are</p>
        <div style={body}>
          <p style={{ margin: 0 }}>Poetry</p>
          <p style={{ margin: 0 }}>Nonfiction</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={label}>How They Think</p>
        <div style={{ ...body, fontStyle: "italic" }}>
          <p style={{ margin: 0 }}>The First Cities</p>
          <p style={{ margin: 0 }}>
            <WikiLink>Zami: A New Spelling of My Name</WikiLink>
          </p>
          <p style={{ margin: 0 }}>
            <WikiLink>The Cancer Journals</WikiLink>
          </p>
        </div>
      </div>
    </aside>
  );
}

function PeopleFragmentsSection() {
  const count = PEOPLE_FRAGMENTS.length;

  return (
    <section style={{ width: "100%" }}>
      <WikiSectionH2 title="Mentioned in fragments" count={count} />
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
            listStyle: "disc",
            paddingLeft: 20,
            margin: "12px 0 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            color: "var(--wiki-bullet)",
          }}
        >
          {PEOPLE_FRAGMENTS.map((title, i) => (
            <li key={i} style={{ lineHeight: "22px" }}>
              <a
                href="#"
                className="wiki-fragment-link"
                style={{
                  ...T.body,
                  fontFamily: FONT.SANS,
                  lineHeight: "22px",
                  color: "var(--wiki-fragment-link)",
                  textDecoration: "none",
                }}
              >
                {title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** People entity view: shares the common wiki shell + custom infobox/body */
export default function WikiPeoplePage() {
  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  return (
    <WikiEntityArticle
      chipIcon={UserRound as LucideIcon}
      chipLabel="People"
      title="Audre Lorde"
      infobox={{ kind: "simple", typeLabel: "People", showSettings: true }}
      renderCustomInfobox={({ onSettingsClick }) => (
        <PeopleInfobox onSettingsClick={onSettingsClick} />
      )}
      showDefaultBottomSections={false}
      customBottomSections={<PeopleFragmentsSection />}
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
        <p style={{ marginBottom: 0 }}>
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
        <WikiSectionH2 title="Who They Are" />
        <div style={bodyStyle}>
          <p style={{ margin: 0 }}>
            Lorde was born in New York City to Caribbean immigrants. Her father,
            Frederick Byron Lorde, (known as Byron) hailed from Barbados and her
            mother, Linda Gertrude Belmar Lorde, was Grenadian and had been born
            in the island of <WikiLink>Carriacou</WikiLink>. Lorde&apos;s mother
            was of mixed ancestry but could &ldquo;<WikiLink>pass</WikiLink>
            &rdquo; for &lsquo;<WikiLink>Spanish</WikiLink>&rsquo;,
            <WikiLink>[4]</WikiLink> which was a source of pride for her family.
            Lorde&apos;s father was darker than the Belmar family liked, and
            they only allowed the couple to marry because of Byron Lorde&apos;s
            charm, ambition, and persistence.
            <WikiLink>[5]</WikiLink> The family settled in{" "}
            <WikiLink>Harlem</WikiLink>. <WikiLink>Nearsighted</WikiLink> to the
            point of <WikiLink>being legally</WikiLink> blind and the youngest of
            three daughters (her two older sisters were named Phyllis and
            Helen), Lorde grew up hearing her mother&apos;s stories about the{" "}
            <WikiLink>West Indies</WikiLink>. At the age of four, she learned to
            talk while she learned to read, and her mother taught her to write
            at around the same time. She wrote her first poem when she was in
            eighth grade.
          </p>
        </div>
        <WikiDesktopH4Lorem paragraphs={2} />
      </div>
    </WikiEntityArticle>
  );
}
