"use client";

import { AudioWaveform } from "lucide-react";
import {
  WikiBiographyBlock,
  WikiDesktopH4Lorem,
  WikiEntityArticle,
  WikiIntroLead,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";
import { T } from "@/lib/typography";

function WikiBiographyShort() {
  return (
    <p style={{ margin: 0 }}>
      Lorde was born in New York City to Caribbean immigrants. Her father,
      Frederick Byron Lorde, (known as Byron) hailed from Barbados and her
      mother, Linda Gertrude Belmar Lorde, was Grenadian and had been born in
      the island of{" "}
      <a href="#" style={{ color: "var(--wiki-article-link)", textDecoration: "none" }}>
        Carriacou
      </a>
      . Lorde&apos;s mother was of mixed ancestry but could &quot;pass&quot; for
      &apos;Spanish&apos;,
      <a href="#" style={{ color: "var(--wiki-article-link)", textDecoration: "none" }}>
        [4]
      </a>{" "}
      which was a source of pride for her family. Lorde&apos;s father was darker
      than the Belmar family liked, and they only allowed the couple to marry
      because of Byron Lorde&apos;s charm, ambition, and persistence.
      <a href="#" style={{ color: "var(--wiki-article-link)", textDecoration: "none" }}>
        [5]
      </a>
    </p>
  );
}

export default function WikiVoicePage() {
  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  return (
    <WikiEntityArticle
      chipIcon={AudioWaveform}
      chipLabel="Voice"
      title="Written Voice"
      infobox={{ kind: "simple", typeLabel: "Agent", showSettings: true }}
    >
      <WikiIntroLead />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <WikiSectionH2 title="The Voice" />
        <div style={bodyStyle}>
          <WikiBiographyBlock />
        </div>
        <WikiDesktopH4Lorem />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <WikiSectionH2 title="Tone" />
        <div style={bodyStyle}>
          <WikiBiographyShort />
        </div>
        <WikiDesktopH4Lorem paragraphs={2} />
      </div>
    </WikiEntityArticle>
  );
}
