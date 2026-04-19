"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { T } from "@/lib/typography";

const ACTIVE_COLOR = "#000000";
const ACTIVE_WEIGHT = 700;

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
  /** Shown in place of the item list when `items` is empty. */
  emptyText?: string;
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
    { label: "Explorer", arrow: "none", href: "/wiki/explorer" },
    { label: "Knowledge Graph", arrow: "none", href: "/wiki/graph" },
  ],
};

const entriesData: SidebarSectionData = {
  title: "Entries",
  items: [
    {
      label: "Morning thought — Apr 18",
      arrow: "none",
      href: "/wiki/entries/entry01SAMPLE",
    },
  ],
  emptyText: "no entries added",
};

const contentsData: SidebarSectionData = {
  title: "Wiki Types",
  items: [
    {
      label: "Log",
      arrow: "right",
      children: [
        { label: "Morning journal — Apr 16", href: "/wiki/example/morning-journal" },
      ],
    },
    {
      label: "Research",
      arrow: "right",
      children: [
        { label: "Spatial memory in corvids", href: "/wiki/example/spatial-memory-corvids" },
      ],
    },
    {
      label: "Belief",
      arrow: "right",
      children: [
        { label: "Craft compounds over time", href: "/wiki/example/craft-compounds" },
      ],
    },
    {
      label: "Decision",
      arrow: "down",
      children: [{ label: "The Berlin years", href: "/wiki/article" }],
    },
    {
      label: "Objective",
      arrow: "right",
      children: [
        { label: "Ship the atlas by Q3", href: "/wiki/example/ship-the-atlas" },
      ],
    },
    {
      label: "Project",
      arrow: "right",
      children: [
        { label: "Robin personal wiki", href: "/wiki/example/robin-personal-wiki" },
      ],
    },
    {
      label: "Principles",
      arrow: "right",
      children: [
        { label: "Measure twice, cut once", href: "/wiki/example/measure-twice" },
      ],
    },
    {
      label: "Skill",
      arrow: "right",
      children: [
        { label: "Type design fundamentals", href: "/wiki/example/type-design-fundamentals" },
      ],
    },
    {
      label: "Agent",
      arrow: "right",
      children: [
        { label: "Research assistant", href: "/wiki/example/research-assistant" },
      ],
    },
    {
      label: "Voice",
      arrow: "right",
      children: [
        { label: "Quiet morning tone", href: "/wiki/example/quiet-morning-tone" },
      ],
    },
  ],
};

const linkStyle: CSSProperties = {
  ...T.bodySmall,
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
  const pathname = usePathname();
  const isActiveHref = (href?: string) => !!href && pathname === href;

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
              ...T.bodySmall,
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

      {sectionVisible && section.items.length === 0 && section.emptyText && (
        <div style={{ paddingLeft: 20, marginTop: 6 }}>
          <p
            style={{
              ...T.bodySmall,
              lineHeight: "20px",
              color: "var(--wiki-count)",
              fontStyle: "italic",
            }}
          >
            {section.emptyText}
          </p>
        </div>
      )}

      {sectionVisible && section.items.length > 0 && (
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
            const childCount = item.children?.length ?? 0;
            const hasChildren = childCount > 0;
            const isOpen = expanded[key] ?? false;
            const showChevron = item.arrow !== "none";
            // Prefer an explicit count (e.g. for categories whose children
            // aren't fully enumerated in the sidebar), otherwise fall back to
            // the number of children actually listed.
            const displayCount = item.count ?? (hasChildren ? childCount : undefined);

            const labelInner = (
              <>
                {item.label}
                {displayCount !== undefined && (
                  <>
                    {" "}
                    <span
                      style={{
                        ...T.tiny,
                        lineHeight: "20px",
                        color: "var(--wiki-count)",
                      }}
                    >
                      ({displayCount})
                    </span>
                  </>
                )}
              </>
            );

            const itemActive = isActiveHref(item.href);

            const labelEl =
              item.bold ? (
                <span
                  style={{
                    ...linkStyle,
                    color: itemActive ? ACTIVE_COLOR : "var(--wiki-sidebar-text)",
                    fontWeight: ACTIVE_WEIGHT,
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
                <Link
                  href={item.href}
                  style={{
                    ...linkStyle,
                    fontWeight: itemActive ? ACTIVE_WEIGHT : 400,
                    color: itemActive ? ACTIVE_COLOR : linkStyle.color,
                  }}
                >
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
                              ...T.bodySmall,
                              lineHeight: "20px",
                              fontWeight: 700,
                              color: "var(--wiki-sidebar-text)",
                              cursor: "pointer",
                            }}
                          >
                            {labelInner}
                          </span>
                        ) : (
                          <span
                            style={{
                              ...T.bodySmall,
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
                  ? item.children!.map((child, j) => {
                      const childActive = isActiveHref(child.href);
                      return (
                      <div
                        key={j}
                        style={{ paddingLeft: 28, minWidth: 0, maxWidth: "100%" }}
                      >
                        {child.href ? (
                          <Link
                            href={child.href}
                            title={child.label}
                            style={{
                              ...T.bodySmall,
                              lineHeight: "20px",
                              color: childActive ? ACTIVE_COLOR : "var(--wiki-link)",
                              fontWeight: childActive ? ACTIVE_WEIGHT : 400,
                              textDecoration: "none",
                              display: "block",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {child.label}
                          </Link>
                        ) : (
                          <span
                            title={child.label}
                            style={{
                              ...T.bodySmall,
                              lineHeight: "20px",
                              color: "var(--wiki-link)",
                              display: "block",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {child.label}
                          </span>
                        )}
                      </div>
                      );
                    })
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
  return (
    <nav>
      <SidebarSection
        sectionId="nav"
        section={navigationData}
        borderColor="var(--wiki-nav-border)"
      />
      <SidebarSection
        sectionId="entries"
        section={entriesData}
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
