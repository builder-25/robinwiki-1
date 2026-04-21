"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphData, GraphEdge, GraphNode, GraphNodeType } from "./graphSampleData";
import { buildAdjacencyMap, extractEgoSubgraph, shouldShowLabel } from "@/lib/graphUtils";

type SimNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
};

type GraphCanvasProps = {
  data: GraphData;
  activeTypes: Set<GraphNodeType>;
  onSelect?: (node: GraphNode | null) => void;
  focusNodeId: string | null;
  onFocusChange: (nodeId: string | null) => void;
  currentDepth: number;
};

// Resolved at mount from CSS custom properties (see useGraphColors below).
// Fallbacks match the light-mode defaults from globals.css.
type GraphColors = {
  edgeBase: string;
  edgeWikilink: string;
  edgeHover: string;
  labelColor: string;
  labelColorHover: string;
  selectedStroke: string;
  hoverStroke: string;
  gridColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  panelBg: string;
  personColor: string;
  wikiFallback: string;
  fragmentFallback: string;
  subtypeColors: Record<string, string>;
};

function readGraphColors(): GraphColors {
  if (typeof document === "undefined") return defaultGraphColors();
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
  return {
    edgeBase: v("--graph-edge-base", "rgba(114, 119, 125, 0.5)"),
    edgeWikilink: v("--graph-edge-wikilink", "rgba(51, 102, 204, 0.55)"),
    edgeHover: v("--wiki-link", "#3366cc"),
    labelColor: v("--wiki-title", "#202122"),
    labelColorHover: v("--heading-color", "#000000"),
    selectedStroke: v("--wiki-title", "#202122"),
    hoverStroke: v("--wiki-sidebar-text", "#555555"),
    gridColor: v("--graph-grid", "rgba(162, 169, 177, 0.18)"),
    tooltipBg: v("--graph-panel-bg", "#ffffff"),
    tooltipBorder: v("--wiki-nav-border", "#a2a9b1"),
    panelBg: v("--graph-panel-bg", "#ffffff"),
    personColor: v("--wiki-type-people-text", "#854d0e"),
    wikiFallback: v("--wiki-type-log-text", "#475569"),
    fragmentFallback: v("--fragment-type-fact-text", "#0284c7"),
    subtypeColors: {
      Log: v("--wiki-type-log-text", "#475569"),
      Research: v("--wiki-type-research-text", "#7c3aed"),
      Belief: v("--wiki-type-belief-text", "#2563eb"),
      Decision: v("--wiki-type-decision-text", "#ea580c"),
      Project: v("--wiki-type-project-text", "#0891b2"),
      Objective: v("--wiki-type-objective-text", "#d97706"),
      Skill: v("--wiki-type-skill-text", "#059669"),
      Agent: v("--wiki-type-agent-text", "#c026d3"),
      Voice: v("--wiki-type-voice-text", "#db2777"),
      Principles: v("--wiki-type-principles-text", "#e11d48"),
      Fact: v("--fragment-type-fact-text", "#0284c7"),
      Question: v("--fragment-type-question-text", "#9333ea"),
      Idea: v("--fragment-type-idea-text", "#ca8a04"),
      Action: v("--fragment-type-action-text", "#16a34a"),
      Quote: v("--fragment-type-quote-text", "#4f46e5"),
      Reference: v("--fragment-type-reference-text", "#0d9488"),
    },
  };
}

function defaultGraphColors(): GraphColors {
  return {
    edgeBase: "rgba(114, 119, 125, 0.5)",
    edgeWikilink: "rgba(51, 102, 204, 0.55)",
    edgeHover: "#3366cc",
    labelColor: "#202122",
    labelColorHover: "#000000",
    selectedStroke: "#202122",
    hoverStroke: "#555555",
    gridColor: "rgba(162, 169, 177, 0.18)",
    tooltipBg: "#ffffff",
    tooltipBorder: "#a2a9b1",
    panelBg: "#ffffff",
    personColor: "#854d0e",
    wikiFallback: "#475569",
    fragmentFallback: "#0284c7",
    subtypeColors: {
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
    },
  };
}

// Physics constants
const SPRING_LENGTH = 120;
const REPULSION = 600;
const SPRING_STRENGTH = 0.004;
const DAMPING = 0.88;
const CENTER_GRAVITY = 0.0008;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

// Ego-graph constants
const RING_SPACING = 150;
const RADIAL_STRENGTH = 0.001;
const HOP_REVEAL_DURATION = 300; // ms per hop level

// Hop-level opacity
const HOP_OPACITY = [1, 1, 0.7, 0.45] as const;

function nodeColor(n: GraphNode, colors: GraphColors): string {
  if (n.type === "person") return colors.personColor;
  if (n.subtype && colors.subtypeColors[n.subtype]) return colors.subtypeColors[n.subtype];
  return n.type === "fragment" ? colors.fragmentFallback : colors.wikiFallback;
}

export default function GraphCanvas({
  data,
  activeTypes,
  onSelect,
  focusNodeId,
  onFocusChange,
  currentDepth,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const hoveredRef = useRef<string | null>(null);
  const timeRef = useRef(0);
  const activeTypesRef = useRef(activeTypes);
  const colorsRef = useRef<GraphColors>(defaultGraphColors());
  const dragRef = useRef<{
    nodeId: string | null;
    isPanning: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  }>({
    nodeId: null,
    isPanning: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // Ego-graph refs
  const focusNodeIdRef = useRef<string | null>(null);
  const currentDepthRef = useRef(2);
  const adjMapRef = useRef<Map<string, string[]>>(new Map());
  const nodeMapRef = useRef<Map<string, SimNode>>(new Map());
  const egoSubgraphRef = useRef<{
    visibleNodeIds: Set<string>;
    nodeHopLevels: Map<string, number>;
  }>({ visibleNodeIds: new Set(), nodeHopLevels: new Map() });

  // Build-out animation ref
  const buildAnimRef = useRef<{
    phase: "idle" | "building";
    currentRevealHop: number;
    targetDepth: number;
    hopTimestamp: number;
    nodeAlphas: Map<string, number>;
  }>({
    phase: "idle",
    currentRevealHop: 0,
    targetDepth: 0,
    hopTimestamp: 0,
    nodeAlphas: new Map(),
  });

  // Pan animation ref
  const panAnimRef = useRef<{
    active: boolean;
    startPan: { x: number; y: number };
    targetPan: { x: number; y: number };
    startTime: number;
    duration: number;
  }>({
    active: false,
    startPan: { x: 0, y: 0 },
    targetPan: { x: 0, y: 0 },
    startTime: 0,
    duration: 400,
  });

  // Touch tracking ref for tap detection
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  // Read CSS custom properties once at mount
  useEffect(() => {
    colorsRef.current = readGraphColors();
  }, []);

  useEffect(() => {
    activeTypesRef.current = activeTypes;
  }, [activeTypes]);

  // Sync props to refs for render loop access
  useEffect(() => {
    focusNodeIdRef.current = focusNodeId;
  }, [focusNodeId]);

  useEffect(() => {
    currentDepthRef.current = currentDepth;
  }, [currentDepth]);

  // Initial layout: random positions around the center.
  useEffect(() => {
    const cx = dims.width / 2 || 400;
    const cy = dims.height / 2 || 300;
    nodesRef.current = data.nodes.map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 400,
      y: cy + (Math.random() - 0.5) * 400,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    }));
    edgesRef.current = data.edges;
  }, [data, dims.width, dims.height]);

  // Rebuild adjacency map + node map when data changes
  useEffect(() => {
    adjMapRef.current = buildAdjacencyMap(data.edges);
    // Node map rebuilt from sim nodes after init
    const map = new Map<string, SimNode>();
    for (const n of nodesRef.current) {
      map.set(n.id, n);
    }
    nodeMapRef.current = map;
  }, [data]);

  // Recompute ego subgraph when focusNodeId or currentDepth changes
  useEffect(() => {
    if (focusNodeId) {
      const result = extractEgoSubgraph(
        data.edges,
        focusNodeId,
        currentDepth,
        adjMapRef.current,
      );
      egoSubgraphRef.current = result;

      // Trigger build-out animation
      const anim = buildAnimRef.current;
      anim.phase = "building";
      anim.currentRevealHop = 0;
      anim.targetDepth = currentDepth;
      anim.hopTimestamp = performance.now();
      anim.nodeAlphas = new Map();
      // Initialize all node alphas to 0 except focus (hop 0)
      for (const [nid, hop] of result.nodeHopLevels) {
        anim.nodeAlphas.set(nid, hop === 0 ? 1 : 0);
      }

      // Pan to focus node
      const focusNode = nodeMapRef.current.get(focusNodeId);
      if (focusNode) {
        const cx = dims.width / 2;
        const cy = dims.height / 2;
        const zoom = zoomRef.current;
        panAnimRef.current = {
          active: true,
          startPan: { ...panRef.current },
          targetPan: {
            x: cx - focusNode.x * zoom,
            y: cy - focusNode.y * zoom,
          },
          startTime: performance.now(),
          duration: 400,
        };
      }
    } else {
      egoSubgraphRef.current = {
        visibleNodeIds: new Set(),
        nodeHopLevels: new Map(),
      };
      buildAnimRef.current.phase = "idle";
      buildAnimRef.current.nodeAlphas = new Map();
    }
  }, [focusNodeId, currentDepth, data.edges, dims.width, dims.height]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () =>
      setDims({ width: container.clientWidth, height: container.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Render + physics loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.width === 0) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.width * dpr;
    canvas.height = dims.height * dpr;
    ctx.scale(dpr, dpr);

    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const activeT = activeTypesRef.current;
      const nodeMap = nodeMapRef.current;
      timeRef.current += 0.02;
      const t = timeRef.current;
      const now = performance.now();

      const egoActive = focusNodeIdRef.current !== null;
      const visibleIds = egoSubgraphRef.current.visibleNodeIds;
      const hopLevels = egoSubgraphRef.current.nodeHopLevels;
      const buildAnim = buildAnimRef.current;
      const focusId = focusNodeIdRef.current;

      // Pan animation
      const panAnim = panAnimRef.current;
      if (panAnim.active) {
        const elapsed = now - panAnim.startTime;
        const progress = Math.min(1, elapsed / panAnim.duration);
        // Ease-out quadratic: t * (2 - t)
        const eased = progress * (2 - progress);
        panRef.current = {
          x: panAnim.startPan.x + (panAnim.targetPan.x - panAnim.startPan.x) * eased,
          y: panAnim.startPan.y + (panAnim.targetPan.y - panAnim.startPan.y) * eased,
        };
        if (progress >= 1) panAnim.active = false;
      }

      // Build-out animation: hop-by-hop reveal
      if (buildAnim.phase === "building") {
        const elapsed = now - buildAnim.hopTimestamp;
        if (elapsed >= HOP_REVEAL_DURATION && buildAnim.currentRevealHop < buildAnim.targetDepth) {
          buildAnim.currentRevealHop++;
          buildAnim.hopTimestamp = now;
        }

        for (const [nid, hop] of hopLevels) {
          if (hop < buildAnim.currentRevealHop) {
            buildAnim.nodeAlphas.set(nid, 1);
          } else if (hop === buildAnim.currentRevealHop) {
            const hopElapsed = now - buildAnim.hopTimestamp;
            const alpha = Math.min(1, hopElapsed / HOP_REVEAL_DURATION);
            buildAnim.nodeAlphas.set(nid, alpha);
          } else {
            buildAnim.nodeAlphas.set(nid, 0);
          }
        }

        if (buildAnim.currentRevealHop >= buildAnim.targetDepth) {
          // Check if all nodes are fully revealed
          const allRevealed = Array.from(buildAnim.nodeAlphas.values()).every((a) => a >= 1);
          if (allRevealed) {
            buildAnim.phase = "idle";
          }
        }
      }

      // Rebuild node map (positions change each tick)
      if (nodeMap.size !== nodes.length) {
        nodeMapRef.current = new Map(nodes.map((n) => [n.id, n]));
      }

      // Coulomb repulsion
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].fx !== null) {
          nodes[i].x = nodes[i].fx!;
          nodes[i].y = nodes[i].fy!;
          continue;
        }
        for (let j = i + 1; j < nodes.length; j++) {
          // Skip pairs where both nodes are hidden in ego mode
          if (egoActive && !visibleIds.has(nodes[i].id) && !visibleIds.has(nodes[j].id)) {
            continue;
          }
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Springs — use Map lookup instead of nodes.find
      edges.forEach((e) => {
        const s = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!s || !tgt) return;
        const dx = tgt.x - s.x;
        const dy = tgt.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (s.fx === null) {
          s.vx += fx;
          s.vy += fy;
        }
        if (tgt.fx === null) {
          tgt.vx -= fx;
          tgt.vy -= fy;
        }
      });

      // Center gravity + damping + integrate
      const cx = dims.width / 2;
      const cy = dims.height / 2;
      nodes.forEach((n) => {
        if (n.fx !== null) return;
        n.vx += (cx - n.x) * CENTER_GRAVITY;
        n.vy += (cy - n.y) * CENTER_GRAVITY;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      });

      // Radial bias force when ego-graph is active
      if (egoActive && focusId) {
        const focusNode = nodeMap.get(focusId);
        if (focusNode) {
          for (const [nid, hop] of hopLevels) {
            if (hop === 0) continue; // skip focus node itself
            const n = nodeMap.get(nid);
            if (!n || n.fx !== null) continue; // skip pinned nodes
            const dx = n.x - focusNode.x;
            const dy = n.y - focusNode.y;
            const currentRadius = Math.sqrt(dx * dx + dy * dy) || 1;
            const targetRadius = hop * RING_SPACING;
            const radialForce = (targetRadius - currentRadius) * RADIAL_STRENGTH;
            n.vx += (dx / currentRadius) * radialForce;
            n.vy += (dy / currentRadius) * radialForce;
          }
        }
      }

      // Render
      const gc = colorsRef.current;
      ctx.save();
      ctx.clearRect(0, 0, dims.width, dims.height);

      ctx.fillStyle = gc.panelBg;
      ctx.fillRect(0, 0, dims.width, dims.height);

      // Subtle grid
      const zoom = zoomRef.current;
      const pan = panRef.current;
      const gridSize = 40 * zoom;
      const ox = ((pan.x % gridSize) + gridSize) % gridSize;
      const oy = ((pan.y % gridSize) + gridSize) % gridSize;
      ctx.strokeStyle = gc.gridColor;
      ctx.lineWidth = 0.5;
      for (let x = ox; x < dims.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dims.height);
        ctx.stroke();
      }
      for (let y = oy; y < dims.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dims.width, y);
        ctx.stroke();
      }

      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Edges — use Map lookup
      edges.forEach((e) => {
        const s = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!s || !tgt) return;

        // In ego mode, skip edges where either endpoint is not visible
        if (egoActive && (!visibleIds.has(s.id) || !visibleIds.has(tgt.id))) return;

        const dimmed = !activeT.has(s.type) && !activeT.has(tgt.type);
        const connectedHover =
          hoveredRef.current && (s.id === hoveredRef.current || tgt.id === hoveredRef.current);

        const dx = tgt.x - s.x;
        const dy = tgt.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const curvature = Math.min(dist * 0.15, 20);
        const midX = (s.x + tgt.x) / 2;
        const midY = (s.y + tgt.y) / 2;
        const cpX = midX + (dy / dist) * curvature;
        const cpY = midY - (dx / dist) * curvature;

        // Ego-graph alpha: minimum of both endpoints' build-out alpha
        let egoAlpha = 1;
        if (egoActive) {
          const sAlpha = buildAnim.nodeAlphas.get(s.id) ?? 0;
          const tAlpha = buildAnim.nodeAlphas.get(tgt.id) ?? 0;
          egoAlpha = Math.min(sAlpha, tAlpha);
        }

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(cpX, cpY, tgt.x, tgt.y);

        if (dimmed) {
          ctx.globalAlpha = egoAlpha;
          ctx.strokeStyle = "rgba(162, 169, 177, 0.15)";
          ctx.lineWidth = 0.5;
        } else if (connectedHover) {
          const pulse = Math.sin(t * 3) * 0.15 + 0.85;
          ctx.globalAlpha = egoAlpha;
          ctx.strokeStyle = gc.edgeHover;
          ctx.lineWidth = 1.75 * pulse;
        } else if (e.edgeType === "wikilink") {
          ctx.globalAlpha = egoAlpha;
          ctx.strokeStyle = gc.edgeWikilink;
          ctx.lineWidth = 1.25;
        } else {
          ctx.globalAlpha = egoAlpha;
          ctx.strokeStyle = gc.edgeBase;
          ctx.lineWidth = 1;
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // Compute label ranks for progressive visibility (ego mode)
      let labelRanks: Map<string, number> | null = null;
      if (egoActive) {
        const visibleNonFragment = Array.from(visibleIds)
          .map((id) => nodeMap.get(id))
          .filter((n): n is SimNode => n !== undefined && n.type !== "fragment")
          .sort((a, b) => b.size - a.size);
        labelRanks = new Map();
        visibleNonFragment.forEach((n, i) => labelRanks!.set(n.id, i));
      }

      // Nodes
      nodes.forEach((n) => {
        // In ego mode, skip nodes not in visible set
        if (egoActive && !visibleIds.has(n.id)) return;

        const dimmed = !activeT.has(n.type);
        const isHovered = hoveredRef.current === n.id;
        const isSelected = selectedId === n.id;
        const isFocusNode = egoActive && n.id === focusId;
        const color = nodeColor(n, gc);
        const size = n.size * (isHovered ? 1.15 : 1);

        // Compute combined alpha
        let nodeAlpha = dimmed ? 0.15 : 1;
        if (egoActive) {
          const hop = hopLevels.get(n.id) ?? 0;
          const hopAlpha = HOP_OPACITY[Math.min(hop, HOP_OPACITY.length - 1)];
          const buildAlpha = buildAnim.nodeAlphas.get(n.id) ?? 1;
          nodeAlpha = (dimmed ? 0.15 : hopAlpha) * buildAlpha;
        }

        ctx.globalAlpha = nodeAlpha;
        ctx.beginPath();
        if (n.type === "person") {
          ctx.moveTo(n.x, n.y - size);
          ctx.lineTo(n.x + size, n.y);
          ctx.lineTo(n.x, n.y + size);
          ctx.lineTo(n.x - size, n.y);
          ctx.closePath();
        } else {
          ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
        }
        ctx.fillStyle = color;
        ctx.fill();

        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? gc.selectedStroke : gc.hoverStroke;
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.stroke();
        }

        // Ego-center ring
        if (isFocusNode) {
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = gc.selectedStroke;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, size + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = nodeAlpha;
        }

        // Labels
        if (egoActive) {
          // Progressive labels in ego mode
          if (n.type !== "fragment" && !dimmed) {
            const rank = labelRanks?.get(n.id) ?? 0;
            const labelAlpha = shouldShowLabel(n.id, focusId, rank, zoom) * nodeAlpha;
            if (labelAlpha > 0) {
              ctx.globalAlpha = labelAlpha;
              ctx.font = `500 ${isHovered ? 12 : 11}px Inter, system-ui, sans-serif`;
              ctx.fillStyle = isHovered ? gc.labelColorHover : gc.labelColor;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillText(n.label, n.x, n.y + size + 6);
            }
          }
        } else {
          // Full-graph mode: show all wiki + person labels
          if ((n.type === "wiki" || n.type === "person") && !dimmed) {
            ctx.font = `500 ${isHovered ? 12 : 11}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = isHovered ? gc.labelColorHover : gc.labelColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(n.label, n.x, n.y + size + 6);
          }
        }

        // Fragment hover tooltip
        if (isHovered && n.type === "fragment") {
          ctx.globalAlpha = nodeAlpha;
          ctx.font = "500 10px Inter, system-ui, sans-serif";
          const tw = ctx.measureText(n.label).width + 12;
          const th = 22;
          const tx = n.x - tw / 2;
          const ty = n.y - size - th - 6;
          ctx.fillStyle = gc.tooltipBg;
          ctx.strokeStyle = gc.tooltipBorder;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tx, ty, tw, th, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = gc.labelColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, ty + th / 2);
        }

        ctx.globalAlpha = 1;
      });

      ctx.restore();
      animRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(animRef.current);
  }, [dims, selectedId]);

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (sy - panRef.current.y) / zoomRef.current,
    }),
    [],
  );

  const findNodeAt = useCallback((wx: number, wy: number) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = n.x - wx;
      const dy = n.y - wy;
      if (Math.sqrt(dx * dx + dy * dy) < n.size + 6) return n;
    }
    return null;
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const node = findNodeAt(wx, wy);
      if (node) {
        dragRef.current = { nodeId: node.id, isPanning: false, startX: sx, startY: sy, startPanX: 0, startPanY: 0 };
        const sim = nodesRef.current.find((n) => n.id === node.id);
        if (sim) {
          sim.fx = sim.x;
          sim.fy = sim.y;
        }
      } else {
        dragRef.current = {
          nodeId: null,
          isPanning: true,
          startX: sx,
          startY: sy,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
        };
      }
    },
    [screenToWorld, findNodeAt],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (dragRef.current.nodeId) {
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const node = nodesRef.current.find((n) => n.id === dragRef.current.nodeId);
        if (node) {
          node.fx = wx;
          node.fy = wy;
          node.x = wx;
          node.y = wy;
        }
        return;
      }
      if (dragRef.current.isPanning) {
        panRef.current = {
          x: dragRef.current.startPanX + (sx - dragRef.current.startX),
          y: dragRef.current.startPanY + (sy - dragRef.current.startY),
        };
        return;
      }
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const node = findNodeAt(wx, wy);
      const newHovered = node?.id ?? null;
      if (hoveredRef.current !== newHovered) {
        hoveredRef.current = newHovered;
      }
      canvasRef.current!.style.cursor = node ? "grab" : "default";
    },
    [screenToWorld, findNodeAt],
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.nodeId) {
      const node = nodesRef.current.find((n) => n.id === dragRef.current.nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    dragRef.current = { nodeId: null, isPanning: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // Drag-distance check: ignore click if the mouse moved >5px from startX/startY
      const dx = sx - dragRef.current.startX;
      const dy = sy - dragRef.current.startY;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;

      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const node = findNodeAt(wx, wy);
      setSelectedId(node?.id ?? null);
      onSelect?.(node ?? null);
      onFocusChange(node?.id ?? null);
    },
    [screenToWorld, findNodeAt, onSelect, onFocusChange],
  );

  // Native non-passive wheel listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const old = zoomRef.current;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, old * delta));
      panRef.current = {
        x: mx - (mx - panRef.current.x) * (next / old),
        y: my - (my - panRef.current.y) * (next / old),
      };
      zoomRef.current = next;
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const handleDoubleClick = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    zoomRef.current = 1;
  }, []);

  // Touch handlers — mirror mouse behavior for mobile/tablet
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = touch.clientX - rect.left;
      const sy = touch.clientY - rect.top;
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const node = findNodeAt(wx, wy);
      if (node) {
        dragRef.current = { nodeId: node.id, isPanning: false, startX: sx, startY: sy, startPanX: 0, startPanY: 0 };
        const sim = nodesRef.current.find((n) => n.id === node.id);
        if (sim) {
          sim.fx = sim.x;
          sim.fy = sim.y;
        }
      } else {
        dragRef.current = {
          nodeId: null,
          isPanning: true,
          startX: sx,
          startY: sy,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
        };
      }
    },
    [screenToWorld, findNodeAt],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = touch.clientX - rect.left;
      const sy = touch.clientY - rect.top;

      if (dragRef.current.nodeId) {
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const node = nodesRef.current.find((n) => n.id === dragRef.current.nodeId);
        if (node) {
          node.fx = wx;
          node.fy = wy;
          node.x = wx;
          node.y = wy;
        }
        return;
      }
      if (dragRef.current.isPanning) {
        panRef.current = {
          x: dragRef.current.startPanX + (sx - dragRef.current.startX),
          y: dragRef.current.startPanY + (sy - dragRef.current.startY),
        };
      }
    },
    [screenToWorld],
  );

  const handleTouchEnd = useCallback(() => {
    // Tap detection: if touch moved < 10px, treat as tap (select/focus)
    const startPos = touchStartPosRef.current;
    const drag = dragRef.current;

    // Release pinned node
    if (drag.nodeId) {
      const node = nodesRef.current.find((n) => n.id === drag.nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }

    // Check tap distance using the canvas-relative start position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const sx = startPos.x - rect.left;
      const sy = startPos.y - rect.top;
      const movedX = sx - drag.startX;
      const movedY = sy - drag.startY;
      if (Math.sqrt(movedX * movedX + movedY * movedY) < 10) {
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const node = findNodeAt(wx, wy);
        setSelectedId(node?.id ?? null);
        onSelect?.(node ?? null);
        onFocusChange(node?.id ?? null);
      }
    }

    dragRef.current = { nodeId: null, isPanning: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 };
  }, [screenToWorld, findNodeAt, onSelect, onFocusChange]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{ width: dims.width, height: dims.height, display: "block", touchAction: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
