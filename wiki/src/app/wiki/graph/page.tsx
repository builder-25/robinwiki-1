"use client";

import { useCallback, useMemo, useState } from "react";
import GraphCanvas from "@/components/graph/GraphCanvas";
import { GraphFiltersPanel, GraphLegend } from "@/components/graph/GraphOverlays";
import { type GraphData, type GraphNode, type GraphNodeType } from "@/components/graph/graphSampleData";
import { Spinner } from "@/components/ui/spinner";
import { useGraph } from "@/hooks/useGraph";
import { T, FONT } from "@/lib/typography";

const API_TYPE_MAP: Record<string, GraphNodeType> = {
  thread: "wiki",
  fragment: "fragment",
  person: "person",
};

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [] };

export default function WikiGraphPage() {
  const graphQuery = useGraph();

  const graphData = useMemo<GraphData>(() => {
    if (!graphQuery.data) return EMPTY_GRAPH;
    const api = graphQuery.data;

    const nodeIdSet = new Set<string>();
    const nodes: GraphNode[] = [];
    for (const n of api.nodes) {
      const mappedType = API_TYPE_MAP[n.type];
      if (!mappedType) continue;
      nodeIdSet.add(n.id);
      nodes.push({
        id: n.id,
        label: n.label,
        type: mappedType,
        size: n.size,
      });
    }

    const edges = api.edges.filter(
      (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target),
    );

    return { nodes, edges };
  }, [graphQuery.data]);

  const [activeTypes, setActiveTypes] = useState<Set<GraphNodeType>>(
    () => new Set<GraphNodeType>(["wiki", "fragment", "person"]),
  );
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const handleToggle = useCallback((type: GraphNodeType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  return (
    <div className="wiki-page wiki-page--fullbleed" style={{ gap: 12 }}>
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          border: "1px solid #f4f4f4",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        {graphQuery.isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : (
          <GraphCanvas
            data={graphData}
            activeTypes={activeTypes}
            onSelect={setSelected}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            pointerEvents: "none",
          }}
        >
          <h1
            style={{
              ...T.h1,
              fontFamily: FONT.SERIF,
              color: "var(--wiki-title)",
              margin: 0,
              fontSize: 20,
              lineHeight: "24px",
            }}
          >
            Knowledge Graph
          </h1>
          <span
            style={{
              ...T.caption,
              fontFamily: FONT.SANS,
              color: "var(--wiki-sidebar-text)",
            }}
          >
            {graphData.nodes.length} nodes · {graphData.edges.length} edges
          </span>
        </div>
        <GraphLegend style={{ top: 48 }} />
        <GraphFiltersPanel
          data={graphData}
          activeTypes={activeTypes}
          onToggle={handleToggle}
        />
        {selected ? (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              background: "#ffffff",
              border: "1px solid var(--wiki-card-border)",
              padding: "10px 12px",
              maxWidth: 320,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                ...T.bodySmall,
                fontFamily: FONT.SANS,
                fontWeight: 600,
                color: "var(--wiki-title)",
              }}
            >
              {selected.label}
            </div>
            <div
              style={{
                ...T.caption,
                fontFamily: FONT.SANS,
                color: "var(--wiki-sidebar-text)",
                textTransform: "capitalize",
              }}
            >
              {selected.type}
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
