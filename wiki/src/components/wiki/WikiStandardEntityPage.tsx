"use client";

import type { LucideIcon } from "lucide-react";
import {
  WikiBiographyBlock,
  WikiDesktopH4Lorem,
  WikiEntityArticle,
  WikiIntroLead,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";
import { T } from "@/lib/typography";

type WikiStandardEntityPageProps = {
  chipIcon: LucideIcon;
  chipLabel: string;
  title: string;
  titleEllipsis?: boolean;
  infoboxTypeValue?: string;
  sectionTitle?: string;
};

/**
 * Shared shell for the standard wiki entity pages that follow the same structure:
 * intro -> H2 section + biography -> H4 body.
 */
export function WikiStandardEntityPage({
  chipIcon,
  chipLabel,
  title,
  titleEllipsis = false,
  infoboxTypeValue = "Voice",
  sectionTitle = "The Objective",
}: WikiStandardEntityPageProps) {
  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  return (
    <WikiEntityArticle
      chipIcon={chipIcon}
      chipLabel={chipLabel}
      title={title}
      titleEllipsis={titleEllipsis}
      infobox={{ kind: "extended", typeValue: infoboxTypeValue, showSettings: true }}
    >
      <WikiIntroLead />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <WikiSectionH2 title={sectionTitle} />
        <div style={bodyStyle}>
          <WikiBiographyBlock />
        </div>
        <WikiDesktopH4Lorem />
      </div>
    </WikiEntityArticle>
  );
}
