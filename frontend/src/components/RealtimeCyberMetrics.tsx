import React, { useMemo, useState, useEffect } from "react";
import type { Message, AgentNode } from "../types";
import { analyzeMessageCode } from "./BinaryCodeGauge";

interface RealtimeCyberMetricsProps {
  messages: Message[];
  agents: Record<string, AgentNode>;
  currentSpeaker: string | null;
}

export const RealtimeCyberMetrics: React.FC<RealtimeCyberMetricsProps> = ({
  messages,
  agents,
  currentSpeaker,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"wave" | "heatmap" | "polarity">("wave");
  const [phase, setPhase] = useState(0);

  // Animated wave phase increment for sleek oscilloscope effect
  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((prev) => (prev + 0.08) % (Math.PI * 2));
    }, 40);
    return () => clearInterval(timer);
  }, []);

  const agentNames = useMemo(() => Object.keys(agents).filter((n) => !agents[n].isMeta), [agents]);

  // Turn-by-turn polarity scores trajectory
  const polarityTrajectory = useMemo(() => {
    if (messages.length === 0) return [];
    return messages.map((m) => {
      const score = analyzeMessageCode(m.agent_code, m.message);
      return {
        turn: m.turn,
        agent: m.agent_name,
        score,
        positivePercent: Math.round(score * 100),
        negativePercent: Math.round((1 - score) * 100),
      };
    });
  }, [messages]);

  // Inter-system irritation matrix (who responded to whom)
  const matrixData = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    for (const a of agentNames) {
      matrix[a] = {};
      for (const b of agentNames) {
        matrix[a][b] = 0;
      }
    }
    const sorted = [...messages].sort((a, b) => a.turn - b.turn);
    for (let i = 1; i < sorted.length; i++) {
      const from = sorted[i - 1].agent_name;
      const to = sorted[i].agent_name;
      if (matrix[from] && matrix[from][to] !== undefined) {
        matrix[from][to] += 1;
      }
    }
    return matrix;
  }, [messages, agentNames]);

  // Max value in matrix for heat map intensity
  const maxMatrixVal = useMemo(() => {
    let max = 1;
    for (const from of agentNames) {
      for (const to of agentNames) {
        if (matrixData[from]?.[to] > max) {
          max = matrixData[from][to];
        }
      }
    }
    return max;
  }, [matrixData, agentNames]);

  // Generate real-time oscilloscope SVG path
  const waveSvgPath = useMemo(() => {
    const points: { x: number; y: number }[] = [];
    const width = 500;
    const height = 120;
    const steps = 60;
    const activityBoost = currentSpeaker ? 1.5 : 0.6;

    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      // Combined harmonic sine waves
      const y =
        height / 2 +
        Math.sin(i * 0.15 + phase) * 22 * activityBoost +
        Math.cos(i * 0.3 - phase * 1.5) * 12 * activityBoost;
      points.push({ x, y });
    }

    return points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
  }, [phase, currentSpeaker]);

  return (
    <div className="hud-panel p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl flex flex-col justify-between h-full">
      {/* Header & Mode Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <h2 className="text-xs font-bold text-cyan-300 tracking-wide flex items-center gap-1.5">
            <span>✨ リアルタイム・サイバーメトリクス (REALTIME METRICS)</span>
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveSubTab("wave")}
            className={`px-2.5 py-0.5 rounded-lg font-bold transition-all ${
              activeSubTab === "wave"
                ? "bg-cyan-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🌊 摂動オシロ
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("polarity")}
            className={`px-2.5 py-0.5 rounded-lg font-bold transition-all ${
              activeSubTab === "polarity"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📈 二元コード極性
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("heatmap")}
            className={`px-2.5 py-0.5 rounded-lg font-bold transition-all ${
              activeSubTab === "heatmap"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🔥 刺激応答マトリクス
          </button>
        </div>
      </div>

      {/* SubTab 1: Real-time Oscilloscope Waveform */}
      {activeSubTab === "wave" && (
        <div className="flex-1 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>FREQUENCY: {currentSpeaker ? "HIGH (32.4 Hz)" : "STABLE (12.0 Hz)"}</span>
            <span className="text-cyan-400 font-bold">
              発言中: {currentSpeaker || "システム共鳴中"}
            </span>
          </div>

          {/* Animated Oscilloscope Canvas Container */}
          <div className="relative h-32 w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center p-2">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d410_1px,transparent_1px),linear-gradient(to_bottom,#06b6d410_1px,transparent_1px)] bg-[size:16px_16px]" />
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-cyan-500/20" />

            <svg viewBox="0 0 500 120" className="w-full h-full overflow-visible z-10">
              <defs>
                <linearGradient id="waveGlow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              {/* Main Glowing Wave */}
              <path
                d={waveSvgPath}
                fill="none"
                stroke="url(#waveGlow)"
                strokeWidth="3"
                className="drop-shadow-[0_0_8px_#38bdf8]"
              />
            </svg>

            {/* Glowing Pulse Particles */}
            {currentSpeaker && (
              <div className="absolute top-2 right-3 flex items-center gap-1.5 bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-500/40 text-[10px] text-cyan-300 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                刺激(Irritation)発生中
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-400 text-center font-mono">
            ※ システム間の対話（刺激と共鳴）が活発になるほど波形振幅が自動拡大します
          </div>
        </div>
      )}

      {/* SubTab 2: Polarity Trajectory Line Stream */}
      {activeSubTab === "polarity" && (
        <div className="flex-1 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>ターン別 二元コード評価 (+肯定 / -否定) 推移</span>
            <span className="text-amber-400 font-mono">計 {polarityTrajectory.length} ターン</span>
          </div>

          <div className="h-32 w-full bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-x-auto flex items-end gap-1.5">
            {polarityTrajectory.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                シミュレーションを開始するとリアルタイム評価が描画されます
              </div>
            ) : (
              polarityTrajectory.map((p, idx) => (
                <div
                  key={idx}
                  className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group relative"
                >
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-slate-900 border border-slate-700 text-[10px] p-1.5 rounded shadow-xl z-20 pointer-events-none whitespace-nowrap">
                    T{p.turn} {p.agent}: 肯定 {p.positivePercent}%
                  </div>

                  {/* Stacked Bar (+ vs -) */}
                  <div className="w-full h-24 bg-slate-900 rounded-full overflow-hidden flex flex-col-reverse">
                    <div
                      className="w-full bg-emerald-400 transition-all duration-300"
                      style={{ height: `${p.positivePercent}%` }}
                    />
                    <div
                      className="w-full bg-rose-500 transition-all duration-300"
                      style={{ height: `${p.negativePercent}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">T{p.turn}</span>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between text-[10px] text-slate-400">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-emerald-400" /> 肯定評価 (+)
            </span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-rose-500" /> 否定評価 (-)
            </span>
          </div>
        </div>
      )}

      {/* SubTab 3: Inter-System Irritation Heat Map */}
      {activeSubTab === "heatmap" && (
        <div className="flex-1 flex flex-col justify-between space-y-2">
          <div className="text-[11px] text-slate-400">
            システム間の刺激・応答発生頻度 (発言元 → 反応先)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-center border-collapse">
              <thead>
                <tr>
                  <th className="p-1 text-slate-500">元＼先</th>
                  {agentNames.map((name) => (
                    <th key={name} className="p-1 text-slate-300 font-bold">
                      {name.slice(0, 2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentNames.map((from) => (
                  <tr key={from}>
                    <td className="p-1 font-bold text-slate-300 text-left">
                      {from.slice(0, 2)}
                    </td>
                    {agentNames.map((to) => {
                      const count = matrixData[from]?.[to] || 0;
                      const intensity = count > 0 ? Math.min(1, count / maxMatrixVal) : 0;

                      return (
                        <td key={to} className="p-1">
                          <div
                            className={`w-full py-1.5 rounded transition-all font-mono font-bold ${
                              count > 0 ? "text-white shadow-sm" : "text-slate-600 bg-slate-950"
                            }`}
                            style={{
                              backgroundColor:
                                count > 0
                                  ? `rgba(147, 51, 234, ${0.25 + intensity * 0.75})`
                                  : undefined,
                            }}
                          >
                            {count}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-[10px] text-purple-300 text-center font-mono">
            ※ 発言の連鎖が多い組み合わせほどセルが鮮やかに発光します
          </div>
        </div>
      )}
    </div>
  );
};
