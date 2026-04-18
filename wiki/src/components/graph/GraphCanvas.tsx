"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphData, GraphEdge, GraphNode, GraphNodeType } from "./graphSampleData";

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
};

// Edge / chrome palette (no sub-type tinting)
const EDGE_BASE = "rgba(114, 119, 125, 0.5)"; // --wiki-chevron hue
const EDGE_WIKILINK = "rgba(51, 102, 204, 0.55)";
const EDGE_HOVER = "#3366cc";
const LABEL_COLOR = "#202122";                // --wiki-title
const LABEL_COLOR_HOVER = "#000000";
const SELECTED_STROKE = "#202122";
const HOVER_STROKE = "#555555";
const GRID_COLOR = "rgba(162, 169, 177, 0.18)"; // --wiki-meta-line softened
const TOOLTIP_BG = "#ffffff";
const TOOLTIP_BORDER = "#a2a9b1";

// Default fallbacks when a node has no subtype
const PERSON_COLOR = "#854d0e";               // matches --wiki-type-people-text
const WIKI_FALLBACK = "#475569";              // matches --wiki-type-log-text
const FRAGMENT_FALLBACK = "#0284c7";          // matches --fragment-type-fact-text

// Sub-type → solid hex. Mirrors the CSS variables in globals.css. Canvas 2D
// can't read CSS variables directly, so we duplicate the palette here.
const SUBTYPE_COLOR: Record<string, string> = {
  // Wiki types
  Log: "#475569",
  Research: "#7c3aed",
  Belief: "#2563eb",
  Decision: "#ea580c",
  Project: "#0891b2",
  Goal: "#d97706",
  Skill: "#059669",
  Agent: "#c026d3",
  Voice: "#db2777",
  Principle: "#e11d48",
  // Fragment types
  Fact: "#0284c7",
  Question: "#9333ea",
  Idea: "#ca8a04",
  Action: "#16a34a",
  Quote: "#4f46e5",
  Reference: "#0d9488",
};

// Physics (straight port)
const SPRING_LENGTH = 120;
const REPULSION = 600;
const SPRING_STRENGTH = 0.004;
const DAMPING = 0.88;
const CENTER_GRAVITY = 0.0008;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

function nodeColor(n: GraphNode): string {
  if (n.type === "person") return PERSON_COLOR;
  if (n.subtype && SUBTYPE_COLOR[n.subtype]) return SUBTYPE_COLOR[n.subtype];
  return n.type === "fragment" ? FRAGMENT_FALLBACK : WIKI_FALLBACK;
}

export default function GraphCanvas({ data, activeTypes, onSelect }: GraphCanvasProps) {
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    activeTypesRef.current = activeTypes;
  }, [activeTypes]);

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

  // ResizeObserver — keep canvas sized to container.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setDims({ width: container.clientWidth, height: container.clientHeight });
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
      timeRef.current += 0.02;
      const t = timeRef.current;

      // Coulomb repulsion
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].fx !== null) {
          nodes[i].x = nodes[i].fx!;
          nodes[i].y = nodes[i].fy!;
          continue;
        }
        for (let j = i + 1; j < nodes.length; j++) {
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

      // Springs
      edges.forEach((e) => {
        const s = nodes.find((n) => n.id === e.source);
        const tgt = nodes.find((n) => n.id === e.target);
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

      // Render
      ctx.save();
      ctx.clearRect(0, 0, dims.width, dims.height);

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, dims.width, dims.height);

      // Subtle grid (wiki-meta-line softened)
      const zoom = zoomRef.current;
      const pan = panRef.current;
      const gridSize = 40 * zoom;
      const ox = ((pan.x % gridSize) + gridSize) % gridSize;
      const oy = ((pan.y % gridSize) + gridSize) % gridSize;
      ctx.strokeStyle = GRID_COLOR;
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

      // Edges
      edges.forEach((e) => {
        const s = nodes.find((n) => n.id === e.source);
        const tgt = nodes.find((n) => n.id === e.target);
        if (!s || !tgt) return;
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

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(cpX, cpY, tgt.x, tgt.y);

        if (dimmed) {
          ctx.strokeStyle = "rgba(162, 169, 177, 0.15)";
          ctx.lineWidth = 0.5;
        } else if (connectedHover) {
          const pulse = Math.sin(t * 3) * 0.15 + 0.85;
          ctx.strokeStyle = EDGE_HOVER;
          ctx.lineWidth = 1.75 * pulse;
        } else if (e.edgeType === "wikilink") {
          ctx.strokeStyle = EDGE_WIKILINK;
          ctx.lineWidth = 1.25;
        } else {
          ctx.strokeStyle = EDGE_BASE;
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      });

      // Nodes
      nodes.forEach((n) => {
        const dimmed = !activeT.has(n.type);
        const isHovered = hoveredRef.current === n.id;
        const isSelected = selectedId === n.id;
        const color = nodeColor(n);
        const size = n.size * (isHovered ? 1.15 : 1);

        ctx.globalAlpha = dimmed ? 0.15 : 1;
        ctx.beginPath();
        if (n.type === "person") {
          // Diamond
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
          ctx.strokeStyle = isSelected ? SELECTED_STROKE : HOVER_STROKE;
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Labels for wiki + person nodes
        if ((n.type === "wiki" || n.type === "person") && !dimmed) {
          ctx.font = `500 ${isHovered ? 12 : 11}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = isHovered ? LABEL_COLOR_HOVER : LABEL_COLOR;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(n.label, n.x, n.y + size + 6);
        }

        // Fragment hover tooltip
        if (isHovered && n.type === "fragment") {
          ctx.font = "500 10px Inter, system-ui, sans-serif";
          const tw = ctx.measureText(n.label).width + 12;
          const th = 22;
          const tx = n.x - tw / 2;
          const ty = n.y - size - th - 6;
          ctx.fillStyle = TOOLTIP_BG;
          ctx.strokeStyle = TOOLTIP_BORDER;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tx, ty, tw, th, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = LABEL_COLOR;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, ty + th / 2);
        }
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
      const { x: wx, y: wy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const node = findNodeAt(wx, wy);
      setSelectedId(node?.id ?? null);
      onSelect?.(node ?? null);
    },
    [screenToWorld, findNodeAt, onSelect],
  );

  // Native non-passive wheel listener — needed so preventDefault actually stops
  // the page/ancestor from scrolling while zooming over the canvas.
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
      />
    </div>
  );
}
