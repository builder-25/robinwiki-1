"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { T, FONT } from "@/lib/typography";
import type { GraphData, GraphNode, GraphNodeType } from "./graphSampleData";

const TYPE_LABEL: Record<GraphNodeType, string> = {
  wiki: "Wiki",
  fragment: "Fragments",
  person: "People",
};

const TYPE_BADGE_BG: Record<GraphNodeType, string> = {
  wiki: "#eef2ff",
  fragment: "#ecfeff",
  person: "#fef3c7",
};

const TYPE_BADGE_COLOR: Record<GraphNodeType, string> = {
  wiki: "#475569",
  fragment: "#0284c7",
  person: "#854d0e",
};

const SUBTYPE_COLOR: Record<string, string> = {
  Log: "#475569",
  Research: "#7c3aed",
  Belief: "#2563eb",
  Decision: "#ea580c",
  Project: "#0891b2",
  Objective: "#d97706",
  Skill: "#059669",
  Agent: "#c026d3",
  Voice: "#db2777",
  Principles: "#e11d48",
  Fact: "#0284c7",
  Question: "#9333ea",
  Idea: "#ca8a04",
  Action: "#16a34a",
  Quote: "#4f46e5",
  Reference: "#0d9488",
};

type GraphDetailPanelProps = {
  data: GraphData;
  activeTypes: Set<GraphNodeType>;
  onToggle: (type: GraphNodeType) => void;
  selectedNode: GraphNode | null;
  onClearSelection: () => void;
  focusNodeId: string | null;
};

export function GraphDetailPanel({
  data,
  activeTypes,
  onToggle,
  selectedNode,
  onClearSelection,
}: GraphDetailPanelProps) {
  const router = useRouter();

  const panelStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    height: "100%",
    width: 240,
    background: "#ffffff",
    borderLeft: "1px solid var(--wiki-card-border)",
    padding: 12,
    overflowY: "auto",
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  // Filters mode
  if (!selectedNode) {
    const counts: Record<GraphNodeType, number> = { wiki: 0, fragment: 0, person: 0 };
    data.nodes.forEach((n) => {
      counts[n.type] += 1;
    });
    const types: GraphNodeType[] = ["wiki", "fragment", "person"];

    return (
      <div style={panelStyle}>
        <div
          style={{
            ...T.bodySmall,
            fontFamily: FONT.SANS,
            fontWeight: 600,
            color: "var(--wiki-title)",
          }}
        >
          Filters
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {types.map((t) => {
            const active = activeTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => onToggle(t)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 8px",
                  background: active ? "var(--wiki-search-chip-bg)" : "#fafafa",
                  border: "1px solid var(--wiki-card-border)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    ...T.bodySmall,
                    fontFamily: FONT.SANS,
                    fontWeight: 600,
                    color: active ? "var(--wiki-title)" : "var(--wiki-sidebar-text)",
                  }}
                >
                  {TYPE_LABEL[t]}
                </span>
                <span
                  style={{
                    ...T.bodySmall,
                    fontFamily: FONT.SANS,
                    color: "var(--wiki-link)",
                    opacity: active ? 1 : 0.5,
                  }}
                >
                  {counts[t]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Node detail mode
  const connectedEdges = data.edges.filter(
    (e) => e.source === selectedNode.id || e.target === selectedNode.id,
  );

  // Count connected nodes by type
  const connByType: Record<GraphNodeType, number> = { wiki: 0, fragment: 0, person: 0 };
  const nodeIdToType = new Map<string, GraphNodeType>();
  for (const n of data.nodes) {
    nodeIdToType.set(n.id, n.type);
  }
  for (const e of connectedEdges) {
    const otherId = e.source === selectedNode.id ? e.target : e.source;
    const otherType = nodeIdToType.get(otherId);
    if (otherType) connByType[otherType]++;
  }

  // Count edge types
  const edgeTypeCounts: Record<string, number> = {};
  for (const e of connectedEdges) {
    edgeTypeCounts[e.edgeType] = (edgeTypeCounts[e.edgeType] || 0) + 1;
  }

  // Build connection summary string
  const connParts: string[] = [];
  if (connByType.wiki > 0) connParts.push(`${connByType.wiki} wiki${connByType.wiki !== 1 ? "s" : ""}`);
  if (connByType.fragment > 0) connParts.push(`${connByType.fragment} fragment${connByType.fragment !== 1 ? "s" : ""}`);
  if (connByType.person > 0) connParts.push(`${connByType.person} ${connByType.person !== 1 ? "people" : "person"}`);

  // Navigation URL
  const getNodeUrl = (node: GraphNode): string => {
    const id = node.lookupKey ?? node.id;
    switch (node.type) {
      case "wiki":
        return `/wiki/${id}`;
      case "fragment":
        return `/wiki/fragment/${id}`;
      case "person":
        return `/wiki/person/${id}`;
    }
  };

  return (
    <div style={panelStyle}>
      <button
        type="button"
        onClick={onClearSelection}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          ...T.caption,
          fontFamily: FONT.SANS,
          color: "var(--wiki-link)",
        }}
      >
        <ChevronLeft size={14} />
        Filters
      </button>

      <div
        style={{
          ...T.bodySmall,
          fontFamily: FONT.SANS,
          fontWeight: 600,
          color: "var(--wiki-title)",
        }}
      >
        {selectedNode.label}
      </div>

      {/* Type badge */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            ...T.micro,
            fontFamily: FONT.SANS,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 10,
            background: TYPE_BADGE_BG[selectedNode.type],
            color: TYPE_BADGE_COLOR[selectedNode.type],
            textTransform: "capitalize",
          }}
        >
          {selectedNode.type}
        </span>
        {selectedNode.subtype && (
          <span
            style={{
              ...T.micro,
              fontFamily: FONT.SANS,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 10,
              background: `${SUBTYPE_COLOR[selectedNode.subtype] ?? "#666"}18`,
              color: SUBTYPE_COLOR[selectedNode.subtype] ?? "#666",
            }}
          >
            {selectedNode.subtype}
          </span>
        )}
      </div>

      {/* Connections section */}
      <div
        style={{
          borderTop: "1px solid var(--wiki-card-border)",
          paddingTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            ...T.caption,
            fontFamily: FONT.SANS,
            color: "var(--wiki-sidebar-text)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Connections
        </div>
        <div
          style={{
            ...T.bodySmall,
            fontFamily: FONT.SANS,
            color: "var(--wiki-title)",
          }}
        >
          {connParts.length > 0 ? connParts.join(", ") : "No connections"}
        </div>

        {Object.keys(edgeTypeCounts).length > 0 && (
          <>
            <div
              style={{
                ...T.caption,
                fontFamily: FONT.SANS,
                color: "var(--wiki-sidebar-text)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Edge types
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {Object.entries(edgeTypeCounts).map(([type, count]) => (
                <span
                  key={type}
                  style={{
                    ...T.micro,
                    fontFamily: FONT.SANS,
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: "#f4f4f4",
                    color: "var(--wiki-sidebar-text)",
                  }}
                >
                  {count} {type}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Open button */}
      <button
        type="button"
        onClick={() => router.push(getNodeUrl(selectedNode))}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: "var(--wiki-title)",
          color: "#ffffff",
          border: "none",
          cursor: "pointer",
          ...T.buttonSmall,
          fontFamily: FONT.SANS,
          marginTop: "auto",
        }}
      >
        Open
      </button>
    </div>
  );
}
