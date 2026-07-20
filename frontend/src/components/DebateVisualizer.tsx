import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentNode, Message, NetworkEdge } from "../types";
import { buildDebateArrows } from "../lib/analysis";
import { hashHue } from "../lib/avatar";

export interface DebateVisualizerProps {
  agents: Record<string, AgentNode>;
  messages: Message[];
  edges?: NetworkEdge[];
  positions: Record<string, { x: number; y: number }>;
}

function curvePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const norm = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = 40;
  const cx = mx + (-dy / norm) * offset;
  const cy = my + (dx / norm) * offset;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

export function DebateVisualizer({
  agents,
  messages,
  positions,
}: DebateVisualizerProps) {
  const agentNames = useMemo(() => Object.keys(agents), [agents]);
  const arrows = useMemo(
    () => buildDebateArrows(messages, agents),
    [messages, agents],
  );

  return (
    <g data-testid="debate-visualizer" aria-label="debate-structure">
      <defs>
        <marker
          id="debate-arrow-head"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff9d00" />
        </marker>
      </defs>
      {arrows.map((a, idx) => {
        const from = positions[a.from];
        const to = positions[a.to];
        if (!from || !to) return null;
        const fromHue =
          agents[a.from]?.avatarHue ?? hashHue(agents[a.from]?.binaryCode ?? a.from);
        const d = curvePath(from, to);
        return (
          <motion.path
            key={`${a.from}-${a.to}-${a.turn}-${idx}`}
            d={d}
            fill="none"
            stroke={`hsl(${fromHue}, 85%, 60%)`}
            strokeWidth={1.4}
            strokeOpacity={0.75}
            markerEnd="url(#debate-arrow-head)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.75 }}
            transition={{ duration: 0.8, delay: Math.min(idx * 0.05, 1.5) }}
          />
        );
      })}
      {agentNames.map((name) => {
        const pos = positions[name];
        if (!pos) return null;
        const a = agents[name];
        const hue = a.avatarHue ?? hashHue(a.binaryCode);
        const r = 14;
        return (
          <g
            key={`debate-node-${name}`}
            transform={`translate(${pos.x} ${pos.y})`}
            data-testid={`debate-node-${name}`}
          >
            <circle
              r={r}
              fill="#090f1e"
              stroke={`hsl(${hue}, 85%, 60%)`}
              strokeWidth={1.2}
              fillOpacity={0.4}
            />
            <text
              y={r + 14}
              textAnchor="middle"
              fontSize={13}
              fill="#c2f1ff"
              fontFamily="JetBrains Mono, monospace"
              style={{ pointerEvents: "none" }}
            >
              {name.length > 8 ? name.slice(0, 7) + "\u2026" : name}
            </text>
          </g>
        );
      })}
    </g>
  );
}