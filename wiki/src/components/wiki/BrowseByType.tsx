"use client";

import Link from "next/link";
import { useWikis } from "@/hooks/useWikis";
import { useWikiTypes } from "@/hooks/useWikiTypes";
import { useMemo } from "react";

const BadgeIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 13.7339 14.3778"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.88852 0.625124C7.46363 0.725143 7.70743 1.48779 8.18877 1.78785C8.3263 1.88787 8.47008 1.95663 8.63261 2.00039C9.48277 2.26294 10.5892 1.30025 10.9143 2.20668C11.0706 2.71303 10.9143 3.55069 11.3519 4.03203C11.7895 4.61339 12.8772 4.6509 13.071 5.1385C13.246 5.6761 12.6896 6.11368 12.5021 6.58878C12.4083 6.78882 12.3521 7.00136 12.3521 7.20765C12.2896 8.07656 13.5273 8.78295 12.9459 9.43933C12.4896 9.83941 11.727 9.87066 11.3456 10.377C10.7955 10.9521 11.2394 11.9523 10.708 12.4962C10.2454 12.8525 9.14521 12.0836 8.43257 12.4774C7.76369 12.7587 7.39487 13.7714 6.86977 13.7464C6.34466 13.7714 5.96959 12.7587 5.30696 12.4774C4.58807 12.0836 3.49411 12.8587 3.03152 12.4962C2.61269 12.1211 2.81273 11.446 2.6627 10.9459C2.54393 10.3082 1.97507 9.96443 1.40621 9.77064C1.0874 9.63937 0.681069 9.50184 0.63106 9.12677C0.562296 8.60167 1.41871 7.93279 1.3812 7.2014C1.3812 6.99511 1.32494 6.78256 1.23118 6.58253C1.04989 6.11368 0.487282 5.66985 0.662316 5.13225C0.887359 4.60714 2.15635 4.57589 2.50017 3.857C2.79398 3.37566 2.66895 2.65052 2.81898 2.20668C3.14405 1.30025 4.25676 2.26294 5.10067 2.00039C5.26321 1.95663 5.40698 1.88787 5.54451 1.78785C6.02585 1.48779 6.26965 0.725143 6.84476 0.625124H6.89477H6.88852Z"
      stroke="var(--wiki-badge-stroke)"
      strokeWidth="1.37339"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BulletDot = () => (
  <svg
    width="8"
    height="8"
    viewBox="0 0 8 8"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4 0C1.79086 0 0 1.79086 0 4C0 6.20914 1.79086 8 4 8C6.20914 8 8 6.20914 8 4C8 1.79086 6.20914 0 4 0Z"
      fill="var(--wiki-bullet)"
    />
  </svg>
);

interface WikiItem {
  id: string;
  title: string;
  date: string;
}

interface WikiCategory {
  name: string;
  slug: string;
  items: WikiItem[];
}

function CategorySection({ category }: { category: WikiCategory }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6.5,
          paddingBottom: 3.2,
        }}
      >
        <div
          style={{
            width: 16,
            height: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <BadgeIcon />
        </div>
        <p
          style={{
            fontFamily:
              "var(--font-source-serif-4), \'Source Serif 4\', serif",
            fontSize: 16,
            fontWeight: 400,
            lineHeight: "29px",
            color: "var(--wiki-category-name)",
          }}
        >
          {category.name}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {category.items.length === 0 && (
          <div style={{ padding: "4px 12px 4px 38px" }}>
            <span
              style={{
                fontFamily: "var(--font-inter), Inter, sans-serif",
                fontSize: 12,
                color: "var(--wiki-item-date)",
                fontStyle: "italic",
              }}
            >
              No wikis yet
            </span>
          </div>
        )}
        {category.items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "4px 12px",
            }}
          >
            <div
              style={{
                width: 18,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <BulletDot />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 21,
                flex: 1,
                minWidth: 0,
                lineHeight: "20px",
              }}
            >
              <Link
                href={`/wiki/${item.id}`}
                style={{
                  fontFamily: "var(--font-inter), Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: "20px",
                  color: "var(--wiki-item-link)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.title}
              </Link>
              <span
                style={{
                  fontFamily: "var(--font-inter), Inter, sans-serif",
                  fontSize: 10,
                  fontWeight: 400,
                  lineHeight: "20px",
                  color: "var(--wiki-item-date)",
                  whiteSpace: "nowrap",
                }}
              >
                ({item.date})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BrowseByType() {
  const { data: wikiTypesData, isLoading: typesLoading } = useWikiTypes();
  const { data: wikisData, isLoading: wikisLoading } = useWikis();

  const categories = useMemo<WikiCategory[]>(() => {
    if (!wikiTypesData?.wikiTypes) return [];

    const wikisByType = new Map<string, WikiItem[]>();
    if (wikisData?.threads) {
      for (const wiki of wikisData.threads) {
        const items = wikisByType.get(wiki.type) ?? [];
        items.push({
          id: wiki.id,
          title: wiki.name,
          date: wiki.lastUpdated?.slice(0, 10) ?? "",
        });
        wikisByType.set(wiki.type, items);
      }
    }

    return wikiTypesData.wikiTypes.map((wt) => ({
      name: wt.name,
      slug: wt.slug,
      items: (wikisByType.get(wt.slug) ?? []).slice(0, 3),
    }));
  }, [wikiTypesData, wikisData]);

  const isLoading = typesLoading || wikisLoading;

  return (
    <div
      style={{
        border: "1px solid var(--wiki-card-border)",
        width: "100%",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid var(--wiki-card-border)",
          padding: "10px 16px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-inter), Inter, sans-serif",
            fontSize: 16,
            fontWeight: 600,
            lineHeight: "20px",
            color: "var(--wiki-card-header)",
          }}
        >
          Browse by wiki type
        </p>
      </div>

      <div className="wiki-browse-grid">
        {isLoading && (
          <div style={{ padding: 16 }}>
            <p style={{ color: "var(--wiki-item-date)", fontSize: 12 }}>Loading types...</p>
          </div>
        )}
        {!isLoading && categories.length === 0 && (
          <div style={{ padding: 16 }}>
            <p style={{ color: "var(--wiki-item-date)", fontSize: 12, fontStyle: "italic" }}>
              No wiki types configured
            </p>
          </div>
        )}
        {categories.map((cat) => (
          <CategorySection key={cat.slug} category={cat} />
        ))}
      </div>
    </div>
  );
}
