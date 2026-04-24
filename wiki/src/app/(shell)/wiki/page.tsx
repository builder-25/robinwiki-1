"use client";

import FeaturedArticle from "@/components/wiki/FeaturedArticle";
import RecentlyUpdated from "@/components/wiki/RecentlyUpdated";
import BrowseByType from "@/components/wiki/BrowseByType";
import WikiFragments from "@/components/wiki/WikiFragments";
import WikiHomeHero from "@/components/wiki/WikiHomeHero";

export default function WikiArticlePage() {
  return (
    <div className="wiki-page wiki-page--home">
      <WikiHomeHero />

      {/* Figma 217:35526 — 104px gap below hero (y 203 → 307) */}
      <div
        className="wiki-cards-container wiki-home-cards wiki-page__content wiki-page__content--centered"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div className="wiki-cards-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <FeaturedArticle />
          </div>
          <RecentlyUpdated />
        </div>

        <BrowseByType />

        <WikiFragments />
      </div>
    </div>
  );
}
