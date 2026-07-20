import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentNode, Message, SimulationStatus } from "../types";
import { computeAnalysis } from "../lib/analysis";
import { hashHue } from "../lib/avatar";

export interface AnalysisPanelProps {
  messages: Message[];
  agents: Record<string, AgentNode>;
  status: SimulationStatus;
}

function heatColor(count: number, maxCount: number): string {
  if (maxCount <= 0) return "rgba(0, 240, 255, 0.15)";
  const ratio = Math.min(1, count / maxCount);
  const r = Math.round(0 + (255 - 0) * ratio);
  const g = Math.round(240 + (157 - 240) * ratio);
  const b = Math.round(255 + (0 - 255) * ratio);
  return `rgba(${r}, ${g}, ${b}, ${0.25 + ratio * 0.7})`;
}

export function AnalysisPanel({
  messages,
  agents,
  status,
}: AnalysisPanelProps) {
  const analysis = useMemo(
    () => computeAnalysis(messages, agents),
    [messages, agents],
  );
  const agentNames = useMemo(() => Object.keys(agents), [agents]);
  const matrix = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of analysis.interactionMatrix) {
      map.set(`${e.from}\u0000${e.to}`, e.count);
    }
    let max = 0;
    for (const v of map.values()) if (v > max) max = v;
    return { map, max };
  }, [analysis]);

  if (status !== "completed") return null;

  return (
    <section
      className="hud-panel rounded p-3"
      aria-label="analysis-panel"
      data-testid="analysis-panel"
    >
      <h2 className="mb-2 text-sm text-cyberpunk-neon neon-glow">
        ANALYSIS
      </h2>

      <div className="mb-3">
        <h3 className="mb-1 text-sm text-cyberpunk-text/70">
          DOMINANCE / 主導性スコア
        </h3>
        <ul className="space-y-1">
          {analysis.dominance.map((d) => {
            const hue = agents[d.name]?.avatarHue ?? hashHue(agents[d.name]?.binaryCode ?? d.name);
            return (
              <li key={d.name} className="flex items-center gap-2">
                <span className="w-24 truncate text-sm text-cyberpunk-text/80">
                  {d.name}
                </span>
                <div className="h-2 flex-1 border border-cyberpunk-neon/30 bg-cyberpunk-bg">
                  <motion.div
                    className="h-full"
                    initial={false}
                    animate={{ width: `${d.score * 100}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 18 }}
                    style={{ backgroundColor: `hsl(${hue}, 80%, 60%)` }}
                  />
                </div>
                <span className="w-20 text-right text-sm tabular-nums text-cyberpunk-accent">
                  {d.count} / {d.avgLength}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mb-3">
        <h3 className="mb-1 text-sm text-cyberpunk-text/70">
          INTERACTION MATRIX / 相互作用行列
        </h3>
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `auto repeat(${agentNames.length}, 1fr)`,
          }}
        >
          <div />
          {agentNames.map((n) => (
            <div
              key={`col-${n}`}
              className="truncate text-center text-sm text-cyberpunk-text/60"
              title={n}
            >
              {n.length > 4 ? n.slice(0, 3) + "\u2026" : n}
            </div>
          ))}
          {agentNames.map((from) => (
            <div key={`row-${from}`} className="contents">
              <div className="truncate text-sm text-cyberpunk-text/60" title={from}>
                {from.length > 4 ? from.slice(0, 3) + "\u2026" : from}
              </div>
              {agentNames.map((to) => {
                const isDiag = from === to;
                const count = matrix.map.get(`${from}\u0000${to}`) ?? 0;
                return (
                  <div
                    key={`cell-${from}-${to}`}
                    className="border border-cyberpunk-neon/10 text-center text-sm tabular-nums"
                    style={{
                      backgroundColor: isDiag
                        ? "rgba(194, 241, 255, 0.1)"
                        : count > 0
                          ? heatColor(count, matrix.max)
                          : "rgba(9, 15, 30, 0.6)",
                      color: isDiag
                        ? "rgba(194, 241, 255, 0.3)"
                        : count > 0
                          ? "#c2f1ff"
                          : "rgba(194, 241, 255, 0.3)",
                    }}
                    title={`${from} -> ${to}: ${count}`}
                  >
                    {isDiag ? "-" : count}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <h3 className="mb-1 text-sm text-cyberpunk-text/70">
          AUTOPOIESIS SCORE / オートポイエーシス度
        </h3>
        <div className="h-3 w-full border border-cyberpunk-neon/30 bg-cyberpunk-bg">
          <motion.div
            className="h-full bg-cyberpunk-accent"
            initial={false}
            animate={{
              width: `${analysis.autopoiesis.totalScore * 100}%`,
            }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          />
        </div>
        <dl className="mt-1 grid grid-cols-3 gap-1 text-sm text-cyberpunk-text/70">
          <div>
            <dt>EDGE</dt>
            <dd className="tabular-nums text-cyberpunk-accent">
              {analysis.autopoiesis.edgeDensity.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt>DIVERSITY</dt>
            <dd className="tabular-nums text-cyberpunk-accent">
              {analysis.autopoiesis.diversity.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt>CHAIN</dt>
            <dd className="tabular-nums text-cyberpunk-accent">
              {analysis.autopoiesis.maxChainLength.toFixed(2)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="border border-cyberpunk-neon/20 bg-cyberpunk-bg/50 p-2 text-sm text-cyberpunk-text/60">
        <h3 className="mb-1 text-sm text-cyberpunk-neon">LLM COMMENTARY</h3>
        <p>次フェーズで実装予定（LLM による考察サマリー）</p>
      </div>
    </section>
  );
}