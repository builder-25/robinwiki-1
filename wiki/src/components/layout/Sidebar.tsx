"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { useWikis } from "@/hooks/useWikis";
import { useWikiTypes } from "@/hooks/useWikiTypes";

type ArrowState = "none" | "right" | "down";

interface NavChild {
  label: string;
  href?: string;
}

interface NavItem {
  label: string;
  arrow: ArrowState;
  bold?: boolean;
  count?: number;
  href?: string;
  children?: NavChild[];
}

interface SidebarSectionData {
  title: string;
  items: NavItem[];
}

const ChevronIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.75 0.6L2.85 1.5L7.3494 6L2.85 10.5L3.75 11.4L9.15 6L3.75 0.6Z"
      fill="var(--wiki-chevron)"
    />
  </svg>
);

const navigationData: SidebarSectionData = {
  title: "Navigation",
  items: [
    { label: "Main page", arrow: "none", href: "/wiki" },
    {
      label: "Recent Fragments",
      arrow: "right",
      href: "/wiki?view=fragments",
    },
    { label: "Knowledge Graph", arrow: "none", href: "/wiki" },
    { label: "Search", arrow: "none", href: "/wiki/search" },
  ],
};

function useWikiTypesSection(): SidebarSectionData {
  const { data: wikiTypes } = useWikiTypes();
  const { data: wikis } = useWikis();

  return useMemo(() => {
    const topItem: NavItem = { label: "(Top)", arrow: "none", bold: true, href: "/wiki" };

    if (!wikiTypes?.wikiTypes) {
      return { title: "Wiki Types", items: [topItem] };
    }

    const wikisByType = new Map<string, Array<{ name: string; id: string }>>();
    if (wikis?.threads) {
      for (const wiki of wikis.threads) {
        const existing = wikisByType.get(wiki.type) ?? [];
        existing.push({ name: wiki.name, id: wiki.id });
        wikisByType.set(wiki.type, existing);
      }
    }

    const typeItems: NavItem[] = wikiTypes.wikiTypes.map((wt) => {
      const typeWikis = wikisByType.get(wt.slug) ?? [];
      const children: NavChild[] = typeWikis.slice(0, 5).map((w) => ({
        label: w.name,
        href: `/wiki/${w.id}`,
      }));
      return {
        label: wt.name,
        arrow: children.length > 0 ? ("right" as const) : ("none" as const),
        count: typeWikis.length || undefined,
        href: `/wiki?type=${wt.slug}`,
        children: children.length > 0 ? children : undefined,
      };
    });

    return { title: "Wiki Types", items: [topItem, ...typeItems] };
  }, [wikiTypes, wikis]);
}

const linkStyle: CSSProperties = {
  fontFamily: "var(--font-inter), Inter, sans-serif",
  fontSize: 14,
  fontWeight: 400,
  lineHeight: "20px",
  color: "var(--wiki-link)",
  textDecoration: "none",
  flex: 1,
  minWidth: 0,
  cursor: "pointer",
};

function SidebarSection({
  section,
  borderColor,
  sectionId,
}: {
  section: SidebarSectionData;
  borderColor: string;
  sectionId: string;
}) {
  const [sectionVisible, setSectionVisible] = useState(true);

  const initialExpanded = useMemo(() => {
    const init: Record<string, boolean> = {};
    section.items.forEach((item, i) => {
      const key = `${sectionId}-${i}`;
      const hasKids = (item.children?.length ?? 0) > 0;
      if (!hasKids) {
        init[key] = false;
        return;
      }
      init[key] = item.arrow === "down";
    });
    return init;
  }, [section.items, sectionId]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => initialExpanded,
  );

  const toggleItem = useCallback((index: number) => {
    const key = `${sectionId}-${index}`;
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, [sectionId]);

  return (
    <div
      style={{
        paddingLeft: 22,
        paddingRight: 14,
        paddingTop: 16,
        paddingBottom: 24,
      }}
    >
      <div style={{ paddingLeft: 20 }}>
        <div
          style={{
            borderBottom: `1px solid ${borderColor}`,
            paddingBottom: 4,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-inter), Inter, sans-serif",
              fontSize: 14,
              fontWeight: 400,
              lineHeight: "20px",
              color: "var(--wiki-sidebar-text)",
            }}
          >
            {section.title} [
            <button
              type="button"
              onClick={() => setSectionVisible(!sectionVisible)}
              style={{
                color: "var(--wiki-link)",
                cursor: "pointer",
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
              }}
            >
              {sectionVisible ? "hide" : "show"}
            </button>
            ]
          </p>
        </div>
      </div>

      {sectionVisible && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 6,
          }}
        >
          {section.items.map((item, i) => {
            const key = `${sectionId}-${i}`;
            const hasChildren = (item.children?.length ?? 0) > 0;
            const isOpen = expanded[key] ?? false;
            const showChevron = item.arrow !== "none";

            const labelInner = (
              <>
                {item.label}
                {item.count !== undefined && (
                  <>
                    {" "}
                    <span
                      style={{
                        fontSize: 10,
                        lineHeight: "20px",
                        color: "var(--wiki-count)",
                        fontWeight: 400,
                      }}
                    >
                      ({item.count})
                    </span>
                  </>
                )}
              </>
            );

            const labelEl =
              item.bold ? (
                <span
                  style={{
                    ...linkStyle,
                    color: "var(--wiki-sidebar-text)",
                    fontWeight: 700,
                    cursor: item.href ? "pointer" : "default",
                  }}
                >
                  {item.href ? (
                    <Link href={item.href} style={{ color: "inherit", textDecoration: "none" }}>
                      {labelInner}
                    </Link>
                  ) : (
                    labelInner
                  )}
                </span>
              ) : item.href ? (
                <Link href={item.href} style={{ ...linkStyle, fontWeight: 400 }}>
                  {labelInner}
                </Link>
              ) : (
                <span style={{ ...linkStyle, cursor: hasChildren ? "pointer" : "default" }}>
                  {labelInner}
                </span>
              );

            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {showChevron ? (
                      <button
                        type="button"
                        aria-expanded={hasChildren ? isOpen : undefined}
                        aria-label={
                          hasChildren
                            ? isOpen
                              ? `Collapse ${item.label}`
                              : `Expand ${item.label}`
                            : undefined
                        }
                        disabled={!hasChildren}
                        onClick={() => hasChildren && toggleItem(i)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: hasChildren ? "pointer" : "default",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: hasChildren ? 1 : 0.45,
                        }}
                      >
                        <div
                          style={{
                            transform:
                              hasChildren && isOpen
                                ? "rotate(90deg)"
                                : "rotate(0deg)",
                            transition: "transform 0.15s ease",
                          }}
                        >
                          <ChevronIcon />
                        </div>
                      </button>
                    ) : null}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "flex-start",
                    }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleItem(i)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          textAlign: "left",
                          font: "inherit",
                          width: "100%",
                        }}
                      >
                        {item.bold ? (
                          <span
                            style={{
                              fontFamily: "var(--font-inter), Inter, sans-serif",
                              fontSize: 14,
                              fontWeight: 700,
                              lineHeight: "20px",
                              color: "var(--wiki-sidebar-text)",
                              cursor: "pointer",
                            }}
                          >
                            {labelInner}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontFamily: "var(--font-inter), Inter, sans-serif",
                              fontSize: 14,
                              fontWeight: 400,
                              lineHeight: "20px",
                              color: "var(--wiki-link)",
                              cursor: "pointer",
                            }}
                          >
                            {labelInner}
                          </span>
                        )}
                      </button>
                    ) : (
                      labelEl
                    )}
                  </div>
                </div>

                {hasChildren && isOpen
                  ? item.children!.map((child, j) => (
                      <div key={j} style={{ paddingLeft: 28 }}>
                        {child.href ? (
                          <Link
                            href={child.href}
                            style={{
                              fontFamily: "var(--font-inter), Inter, sans-serif",
                              fontSize: 14,
                              fontWeight: 400,
                              lineHeight: "20px",
                              color: "var(--wiki-link)",
                              textDecoration: "none",
                              display: "inline-block",
                            }}
                          >
                            {child.label}
                          </Link>
                        ) : (
                          <span
                            style={{
                              fontFamily: "var(--font-inter), Inter, sans-serif",
                              fontSize: 14,
                              fontWeight: 400,
                              lineHeight: "20px",
                              color: "var(--wiki-link)",
                            }}
                          >
                            {child.label}
                          </span>
                        )}
                      </div>
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const contentsData = useWikiTypesSection();

  return (
    <nav>
      <SidebarSection
        sectionId="nav"
        section={navigationData}
        borderColor="var(--wiki-nav-border)"
      />
      <SidebarSection
        sectionId="types"
        section={contentsData}
        borderColor="var(--wiki-toc-border)"
      />
    </nav>
  );
}
