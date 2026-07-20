import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentNode, Message, SimulationStatus, SocietyMetrics } from "../types";
import { hashHue } from "../lib/avatar";

export interface SocietyPanelProps {
  metrics: SocietyMetrics;
  status: SimulationStatus;
  maxTurns: number;
  elapsedMs: number;
  messages?: Message[];
  agents?: Record<string, AgentNode>;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const AREA_W = 280;
const AREA_H = 80;
const AREA_PAD_L = 4;
const AREA_PAD_B = 4;

export function SocietyPanel({
  metrics,
  status,
  maxTurns,
  elapsedMs,
  messages = [],
  agents = {},
}: SocietyPanelProps) {
  const messageRatio = maxTurns > 0 ? metrics.messageCount / maxTurns : 0;
  const bars = [
    { label: "発言数", value: Math.min(1, messageRatio), raw: `${metrics.messageCount}/${maxTurns}` },
    { label: "エッジ密度", value: metrics.edgeDensity, raw: `${metrics.edgeCount}` },
    { label: "活性度", value: metrics.activeNodeRatio, raw: `${Math.round(metrics.activeNodeRatio * 100)}%` },
  ];

  const series = useMemo(() => {
    const agentNames = Object.keys(agents);
    const hues = agentNames.map(
      (n) => agents[n]?.avatarHue ?? hashHue(agents[n]?.binaryCode ?? n),
    );
    const sorted = [...messages].sort((a, b) => a.turn - b.turn);
    const turns = sorted.length > 0 ? sorted[sorted.length - 1].turn + 1 : 0;
    const xMax = Math.max(1, turns, maxTurns);
    const yMax = Math.max(1, messages.length);
    const cumulative: Record<string, number[]> = {};
    for (let i = 0; i < agentNames.length; i += 1) {
      cumulative[agentNames[i]] = [];
    }
    const totals: number[] = [];
    const counts: Record<string, number> = {};
    for (const n of agentNames) counts[n] = 0;
    for (let t = 0; t < xMax; t += 1) {
      const msgAtTurn = sorted.filter((m) => m.turn === t);
      for (const m of msgAtTurn) {
        if (counts[m.agent_name] !== undefined) counts[m.agent_name] += 1;
      }
      let total = 0;
      for (const n of agentNames) {
        total += counts[n] ?? 0;
        cumulative[n].push(total);
      }
      totals.push(total);
    }
    const innerW = AREA_W - AREA_PAD_L - 4;
    const innerH = AREA_H - AREA_PAD_B - 4;
    const xFor = (turn: number) => AREA_PAD_L + (turn / xMax) * innerW;
    const yFor = (total: number) =>
      AREA_H - AREA_PAD_B - (total / yMax) * innerH;
    const paths: { name: string; hue: number; d: string }[] = [];
    for (let ai = 0; ai < agentNames.length; ai += 1) {
      const name = agentNames[ai];
      const arr = cumulative[name];
      const top: number[] = [];
      for (let t = 0; t < xMax; t += 1) {
        const cumTop = yFor(arr[t] ?? 0);
        top.push(cumTop);
      }
      let d = `M ${xFor(0).toFixed(2)} ${(AREA_H - AREA_PAD_B).toFixed(2)}`;
      for (let t = 0; t < xMax; t += 1) {
        d += ` L ${xFor(t).toFixed(2)} ${top[t].toFixed(2)}`;
      }
      d += ` L ${xFor(xMax - 1).toFixed(2)} ${(AREA_H - AREA_PAD_B).toFixed(2)} Z`;
      paths.push({ name, hue: hues[ai], d });
    }
    return { paths, xMax, yMax, totals };
  }, [messages, agents, maxTurns]);

  return (
    <section className="hud-panel rounded p-3" aria-label="society-panel">
      <h2 className="mb-2 text-sm text-cyberpunk-neon neon-glow">
        SOCIETY STRUCTURE
      </h2>
      <div className="space-y-2">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-0.5 flex justify-between text-sm text-cyberpunk-text/80">
              <span>{b.label}</span>
              <span className="tabular-nums text-cyberpunk-accent">{b.raw}</span>
            </div>
            <div className="h-2 w-full border border-cyberpunk-neon/30 bg-cyberpunk-bg">
              <motion.div
                className="h-full bg-cyberpunk-accent"
                initial={false}
                animate={{ width: `${Math.min(100, b.value * 100)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <h3 className="mb-1 text-sm text-cyberpunk-text/60">
          AUTopoiesis ACCUMULATION
        </h3>
        <svg
          viewBox={`0 0 ${AREA_W} ${AREA_H}`}
          className="w-full"
          style={{ height: AREA_H }}
          aria-label="society-area-chart"
          data-testid="society-area-chart"
        >
          {series.paths.length === 0 && (
            <text x={AREA_PAD_L} y={AREA_H / 2} fontSize="11" fill="#7ab8c8">
              no data
            </text>
          )}
          {series.paths.map((p) => (
            <motion.path
              key={p.name}
              d={p.d}
              fill={`hsl(${p.hue}, 85%, 60%)`}
              fillOpacity={0.45}
              stroke={`hsl(${p.hue}, 85%, 60%)`}
              strokeWidth={0.6}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 0.85 }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-sm text-cyberpunk-text/70">
        <span>ELAPSED</span>
        <span className="tabular-nums text-cyberpunk-neon">
          {formatTime(elapsedMs)}
        </span>
      </div>
      <div className="mt-1 text-sm text-cyberpunk-text/60">
        STATUS: <span className="text-cyberpunk-accent">{status}</span>
      </div>
    </section>
  );
}