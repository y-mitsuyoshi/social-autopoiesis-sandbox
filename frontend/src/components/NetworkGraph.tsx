import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { motion } from "framer-motion";
import type { AgentNode, Message, NetworkEdge, NetworkViewMode } from "../types";
import { hashHue } from "../lib/avatar";
import { DebateVisualizer } from "./DebateVisualizer";

export interface NetworkGraphProps {
  agents: Record<string, AgentNode>;
  edges: NetworkEdge[];
  currentSpeaker: string | null;
  nextSpeaker: string | null;
  messages?: Message[];
  viewMode?: NetworkViewMode;
  onViewModeChange?: (mode: NetworkViewMode) => void;
}

export function buildEdges(messages: {
  agent_name: string;
  turn: number;
}[]): NetworkEdge[] {
  const sorted = [...messages].sort((a, b) => a.turn - b.turn);
  const map = new Map<string, NetworkEdge>();
  for (let i = 1; i < sorted.length; i += 1) {
    const from = sorted[i - 1].agent_name;
    const to = sorted[i].agent_name;
    if (from === to) continue;
    const key = `${from}\u0000${to}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { from, to, count: 1 });
    }
  }
  return Array.from(map.values());
}

export function layoutNodes(
  agentNames: string[],
  radius: number,
  center: { x: number; y: number },
): Record<string, { x: number; y: number }> {
  const n = agentNames.length;
  const result: Record<string, { x: number; y: number }> = {};
  if (n === 0) return result;
  if (n === 1) {
    result[agentNames[0]] = { x: center.x, y: center.y };
    return result;
  }
  for (let i = 0; i < n; i += 1) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    result[agentNames[i]] = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  }
  return result;
}

const VIEW_W = 600;
const VIEW_H = 600;
const CENTER = { x: 300, y: 300 };
const RADIUS = 220;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

function NetworkGraphBase({
  agents,
  edges,
  currentSpeaker,
  nextSpeaker,
  messages,
  viewMode = "network",
  onViewModeChange,
}: NetworkGraphProps) {
  const agentNames = useMemo(() => Object.keys(agents), [agents]);
  const agentNamesKey = agentNames.join(",");
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });
  const [zoom, setZoom] = useState(1);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const dragRef = useRef<{
    mode: "node" | "pan" | null;
    startPointer: { x: number; y: number };
    startView: { x: number; y: number };
    startNode?: { x: number; y: number };
    name?: string;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setPositions(layoutNodes(agentNames, RADIUS, CENTER));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentNamesKey]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const a of Object.values(agents)) {
      if (a.speakCount > m) m = a.speakCount;
    }
    return m;
  }, [agents]);

  const autopoieticPath = useMemo(() => {
    if (!messages || messages.length < 2) return [];
    const sorted = [...messages].sort((a, b) => a.turn - b.turn);
    const lastMessages = sorted.slice(-4);
    const path: { x: number; y: number }[] = [];
    for (const m of lastMessages) {
      const pos = positions[m.agent_name];
      if (pos) {
        path.push(pos);
      }
    }
    return path;
  }, [messages, positions]);

  const recentEdges = useMemo(() => {
    if (!messages || messages.length < 2) return new Set<string>();
    const sorted = [...messages].sort((a, b) => a.turn - b.turn);
    const last = sorted.slice(-4);
    const set = new Set<string>();
    for (let i = 1; i < last.length; i += 1) {
      set.add(`${last[i - 1].agent_name}\u0000${last[i].agent_name}`);
    }
    return set;
  }, [messages]);

  const nodeJitter = useMemo(() => {
    const m: Record<string, { dx: number; dy: number; duration: number }> = {};
    for (const name of agentNames) {
      const h = hashHue(name + "jitter");
      m[name] = {
        dx: ((h % 30) / 30 - 0.5) * 3,
        dy: (((h >> 3) % 30) / 30 - 0.5) * 3,
        duration: 0.3 + (h % 50) / 100,
      };
    }
    return m;
  }, [agentNames]);

  const resetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });
    setZoom(1);
    setPositions(layoutNodes(agentNames, RADIUS, CENTER));
  }, [agentNames]);

  const handleWheel = useCallback((e: ReactWheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * factor));
      const newW = VIEW_W / next;
      const newH = VIEW_H / next;
      setViewBox((vb) => {
        const cx = vb.x + vb.w / 2;
        const cy = vb.y + vb.h / 2;
        return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
      });
      return next;
    });
  }, []);

  const handleBackgroundPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      mode: "pan",
      startPointer: { x: e.clientX, y: e.clientY },
      startView: { x: viewBox.x, y: viewBox.y },
    };
  }, [viewBox]);

  const handleNodePointerDown = useCallback((e: ReactPointerEvent<SVGGElement>, name: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = positions[name] ?? { x: 0, y: 0 };
    setDraggedNode(name);
    dragRef.current = {
      mode: "node",
      startPointer: { x: e.clientX, y: e.clientY },
      startView: { x: viewBox.x, y: viewBox.y },
      startNode: p,
      name,
    };
  }, [positions, viewBox]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "pan") {
      const dx = e.clientX - d.startPointer.x;
      const dy = e.clientY - d.startPointer.y;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      setViewBox((vb) => ({
        ...vb,
        x: d.startView.x - dx * scaleX,
        y: d.startView.y - dy * scaleY,
      }));
    } else if (d.mode === "node" && d.name !== undefined && d.startNode) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      const dx = (e.clientX - d.startPointer.x) * scaleX;
      const dy = (e.clientY - d.startPointer.y) * scaleY;
      setPositions((prev) => ({
        ...prev,
        [d.name as string]: { x: d.startNode!.x + dx, y: d.startNode!.y + dy },
      }));
    }
  }, [viewBox]);

  const handlePointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
    dragRef.current = null;
    setDraggedNode(null);
  }, []);

  return (
    <div className="relative h-full w-full" data-testid="network-container">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        data-zoom={zoom}
        className="h-full w-full"
        role="img"
        aria-label="agent-network"
        onWheel={handleWheel}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        <rect
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.w}
          height={viewBox.h}
          fill="transparent"
          data-testid="network-background"
        />
      <g transform="translate(300, 300)" opacity={0.12}>
        <circle r={60} fill="none" stroke="#00f0ff" strokeWidth="1" strokeDasharray="4 4" />
        <circle r={140} fill="none" stroke="#00f0ff" strokeWidth="0.8" strokeDasharray="8 8" />
        <circle r={220} fill="none" stroke="#00f0ff" strokeWidth="0.6" />
        <line x1={-240} y1={0} x2={240} y2={0} stroke="#00f0ff" strokeWidth="0.5" />
        <line x1={0} y1={-240} x2={0} y2={240} stroke="#00f0ff" strokeWidth="0.5" />
        <motion.circle
          r={220}
          fill="none"
          stroke="#00f0ff"
          strokeWidth="1.5"
          strokeDasharray="30 1350"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
      </g>

      <g transform="translate(300, 300)" opacity={0.2}>
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const x1 = Math.cos(angle) * 220;
          const y1 = Math.sin(angle) * 220;
          const x2 = Math.cos(angle) * 228;
          const y2 = Math.sin(angle) * 228;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#00f0ff"
              strokeWidth="1.2"
            />
          );
        })}
      </g>

      {viewMode === "debate" ? (
        <DebateVisualizer
          agents={agents}
          messages={messages ?? []}
          edges={edges}
          positions={positions}
        />
      ) : (
        <>
          {edges.map((e) => {
            const from = positions[e.from];
            const to = positions[e.to];
            if (!from || !to) return null;
            const sw = 1.2 + Math.log2(e.count + 1);
            const isRecent = recentEdges.has(`${e.from}\u0000${e.to}`);
            const opacity = isRecent ? 1 : Math.min(1, 0.3 + e.count * 0.2);
            return (
              <g key={`${e.from}->${e.to}`}>
                <motion.line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#00f0ff"
                  strokeWidth={sw}
                  strokeOpacity={opacity}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ type: "spring", stiffness: 120, damping: 18 }}
                />
                {isRecent && (
                  <motion.circle
                    r={2.5}
                    fill="#ff9d00"
                    initial={{ cx: from.x, cy: from.y, opacity: 0 }}
                    animate={{
                      cx: [from.x, to.x],
                      cy: [from.y, to.y],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}
              </g>
            );
          })}

          {autopoieticPath.length >= 2 && (
            <g data-testid="autopoietic-path">
              {autopoieticPath.map((pt, idx) => {
                if (idx === 0) return null;
                const prev = autopoieticPath[idx - 1];
                return (
                  <line
                    key={`autopoietic-link-${idx}`}
                    x1={prev.x}
                    y1={prev.y}
                    x2={pt.x}
                    y2={pt.y}
                    stroke="#ff00a0"
                    strokeWidth="2.5"
                    strokeDasharray="4 6"
                    opacity="0.85"
                  />
                );
              })}
            </g>
          )}

          {agentNames.map((name) => {
            const a = agents[name];
            const pos = positions[name];
            if (!pos) return null;
            const r = Math.min(40, 20 + a.speakCount * 2);
            const fillOpacity = 0.35 + (maxCount > 0 ? (a.speakCount / maxCount) * 0.6 : 0);
            const isCurrent = currentSpeaker === name;
            const isNext = nextSpeaker === name;
            const hue = a.avatarHue ?? hashHue(a.binaryCode);
            const nodeColor = `hsl(${hue}, 85%, 60%)`;
            const currentColor = "#ff9d00";
            const jitter = nodeJitter[name] ?? { dx: 0, dy: 0, duration: 0.5 };
            return (
              <motion.g
                key={name}
                initial={false}
                animate={{ x: jitter.dx, y: jitter.dy }}
                transition={{
                  duration: jitter.duration,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                onPointerDown={(e) => handleNodePointerDown(e, name)}
                style={{ cursor: draggedNode === name ? "grabbing" : "grab" }}
                data-testid={`node-${name}`}
              >
                <g
                  transform={`translate(${pos.x} ${pos.y})${isCurrent ? " scale(1.2)" : ""}`}
                >
                  <circle
                    r={r + 6}
                    fill="none"
                    stroke={nodeColor}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    data-testid={`halo-${name}`}
                  />

                  {isCurrent && (
                    <g data-testid="irritation-ripples">
                      <motion.circle
                        r={r + 12}
                        fill="none"
                        stroke={currentColor}
                        strokeWidth="1.2"
                        initial={{ scale: 0.9, opacity: 0.8 }}
                        animate={{ scale: 2.2, opacity: 0 }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                      />
                      <motion.circle
                        r={r + 12}
                        fill="none"
                        stroke={currentColor}
                        strokeWidth="0.8"
                        initial={{ scale: 0.9, opacity: 0.8 }}
                        animate={{ scale: 3.5, opacity: 0 }}
                        transition={{ duration: 2.5, delay: 1.0, repeat: Infinity, ease: "easeOut" }}
                      />
                      <motion.circle
                        r={r + 12}
                        fill="none"
                        stroke={currentColor}
                        strokeWidth="0.6"
                        initial={{ scale: 0.9, opacity: 0.6 }}
                        animate={{ scale: 4.5, opacity: 0 }}
                        transition={{ duration: 2.5, delay: 1.5, repeat: Infinity, ease: "easeOut" }}
                      />
                    </g>
                  )}

                  <circle
                    r={r}
                    fill="#090f1e"
                    stroke={isCurrent ? currentColor : nodeColor}
                    strokeWidth={isCurrent ? 2.5 : 1.2}
                    fillOpacity={fillOpacity}
                  />

                  {isCurrent && (
                    <g>
                      <motion.circle
                        r={r + 8}
                        fill="none"
                        stroke={currentColor}
                        strokeWidth="1.5"
                        strokeDasharray="8 12"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        style={{ transformOrigin: "0px 0px" }}
                      />
                      <path
                        d={`M ${-r - 10} ${-r - 4} L ${-r - 10} ${-r - 10} L ${-r - 4} ${-r - 10}`}
                        stroke={currentColor}
                        strokeWidth="2"
                        fill="none"
                      />
                      <path
                        d={`M ${r + 10} ${-r - 4} L ${r + 10} ${-r - 10} L ${r + 4} ${-r - 10}`}
                        stroke={currentColor}
                        strokeWidth="2"
                        fill="none"
                      />
                      <path
                        d={`M ${-r - 10} ${r + 4} L ${-r - 10} ${r + 10} L ${-r - 4} ${r + 10}`}
                        stroke={currentColor}
                        strokeWidth="2"
                        fill="none"
                      />
                      <path
                        d={`M ${r + 10} ${r + 4} L ${r + 10} ${r + 10} L ${r + 4} ${r + 10}`}
                        stroke={currentColor}
                        strokeWidth="2"
                        fill="none"
                      />
                    </g>
                  )}

                  {isNext && !isCurrent && (
                    <motion.circle
                      r={r + 5}
                      fill="none"
                      stroke="#00f0ff"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      style={{ transformOrigin: "0px 0px" }}
                    />
                  )}

                  <text
                    y={r + 15}
                    textAnchor="middle"
                    fontSize={13}
                    fill="#c2f1ff"
                    fontFamily="JetBrains Mono, monospace"
                    className="font-bold tracking-wide"
                    style={{ pointerEvents: "none" }}
                  >
                    {name.length > 10 ? name.slice(0, 9) + "\u2026" : name}
                  </text>
                  <text
                    y={4}
                    textAnchor="middle"
                    fontSize={13}
                    fill={isCurrent ? currentColor : nodeColor}
                    fontFamily="JetBrains Mono, monospace"
                    className="font-bold"
                    style={{ pointerEvents: "none" }}
                  >
                    {a.speakCount}
                  </text>
                </g>
              </motion.g>
            );
          })}
        </>
      )}

      <text
        x={viewBox.x + 8}
        y={viewBox.y + viewBox.h - 8}
        fontSize={13}
        fill="#7ab8c8"
        fontFamily="JetBrains Mono, monospace"
        style={{ pointerEvents: "none" }}
      >
        {viewMode === "debate" ? "発言者→対象の議論構造" : "太い＝発話のやり取りが多い"}
      </text>
      </svg>
      <button
        type="button"
        onClick={resetView}
        aria-label="RESET VIEW"
        data-testid="reset-view"
        className="absolute right-2 top-2 border border-cyberpunk-neon bg-cyberpunk-neon/10 px-2 py-1 text-sm text-cyberpunk-neon hover:bg-cyberpunk-neon/20"
      >
        RESET VIEW
      </button>
      {onViewModeChange && (
        <div className="absolute left-2 top-2 flex gap-1 text-sm z-20">
          {(["network", "debate", "roundtable"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-label={`view-mode-${m}`}
              onClick={() => onViewModeChange(m)}
              className={
                viewMode === m
                  ? "border border-amber-400 bg-amber-400/20 px-2 py-1 text-amber-300 font-bold rounded"
                  : "border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-400 hover:text-slate-200 rounded"
              }
            >
              {m === "network" ? "NETWORK" : m === "debate" ? "DEBATE" : "🗣️ 人間アバター対話"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const NetworkGraph = memo(NetworkGraphBase);