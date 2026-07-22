import React, { useMemo } from "react";
import type { AgentNode, Message, SocietyMetrics } from "../types";

interface AutopoiesisGraphPanelProps {
  metrics: SocietyMetrics;
  messages: Message[];
  agents: Record<string, AgentNode>;
}

export const AutopoiesisGraphPanel: React.FC<AutopoiesisGraphPanelProps> = ({
  metrics,
  messages,
  agents,
}) => {
  const agentList = useMemo(() => Object.values(agents).filter((a) => !a.isMeta), [agents]);
  const totalNonMeta = agentList.length || 1;

  // Condition 1: Active Nodes Ratio
  const spokenNodesCount = useMemo(() => {
    return agentList.filter((a) => a.speakCount > 0).length;
  }, [agentList]);
  const nodeRatioPercent = Math.min(100, Math.round((spokenNodesCount / totalNonMeta) * 100));

  // Condition 2: SCC Loop Density (Strongly Connected Component completeness)
  const sccPercent = Math.min(100, Math.round(metrics.edgeDensity * 100));

  // Condition 3: Dual Code Polarity (+ and - both active)
  const dualCodeActiveCount = useMemo(() => {
    if (messages.length < 2) return 0;
    const codes = new Set(messages.map((m) => m.agent_code));
    return codes.size;
  }, [messages]);
  const codePolarityPercent = Math.min(100, Math.round((dualCodeActiveCount / Math.max(1, totalNonMeta)) * 100));

  // Overall Autopoiesis Score (0 to 100)
  const autopoiesisScore = useMemo(() => {
    if (metrics.isOperationalClosure) return 100;
    return Math.round((nodeRatioPercent * 0.4) + (sccPercent * 0.4) + (codePolarityPercent * 0.2));
  }, [metrics.isOperationalClosure, nodeRatioPercent, sccPercent, codePolarityPercent]);

  // Generate circular node coordinates for the circulation loop graph
  const circularNodes = useMemo(() => {
    const n = agentList.length;
    if (n === 0) return [];
    const r = 85;
    const cx = 130;
    const cy = 110;
    return agentList.map((a, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      return {
        name: a.name,
        code: a.binaryCode,
        speakCount: a.speakCount,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
  }, [agentList]);

  return (
    <div className="hud-panel p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h2 className="text-xs font-bold text-amber-300 tracking-wider flex items-center gap-1.5">
          <span>🔄 オートポイエーシス作動グラフ可視化</span>
        </h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-mono">
          OPERATIONAL CLOSURE ANALYTICS
        </span>
      </div>

      {/* Main Health Gauge & Overall Score */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold text-slate-400">
            自己再生作動スコア (AUTOPOIESIS SCORE)
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl font-extrabold font-mono text-amber-400">
              {autopoiesisScore}%
            </span>
            <span className="text-xs text-slate-400 font-medium">
              / 100% (作動的閉鎖)
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {metrics.isOperationalClosure ? (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold animate-pulse text-center shadow-lg">
              ✨ 閉鎖成立 (CLOSED LOOP)
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold text-center">
              ⏳ ループ蓄積中 (ACCUMULATING)
            </div>
          )}
        </div>
      </div>

      {/* 3 Conditions Health Progress Bars */}
      <div className="space-y-2.5 text-xs">
        <div className="text-[11px] font-bold text-slate-300">
          作動的閉鎖 3条件達成度メーター
        </div>

        {/* Condition 1: Node Participation */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-300 mb-1">
            <span>1. 全エージェント活性率 ({spokenNodesCount}/{totalNonMeta})</span>
            <span className="font-mono font-bold text-amber-300">{nodeRatioPercent}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${nodeRatioPercent}%` }}
            />
          </div>
        </div>

        {/* Condition 2: SCC Loop Completeness */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-300 mb-1">
            <span>2. 強連結成分 (SCC) 循環密度</span>
            <span className="font-mono font-bold text-amber-300">{sccPercent}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-500"
              style={{ width: `${sccPercent}%` }}
            />
          </div>
        </div>

        {/* Condition 3: Dual Code Polarity */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-300 mb-1">
            <span>3. 二元コード二極 (+/-) 活性度</span>
            <span className="font-mono font-bold text-amber-300">{codePolarityPercent}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-rose-400 transition-all duration-500"
              style={{ width: `${codePolarityPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Circulation Loop Visualizer SVG Graph */}
      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center">
        <div className="text-[10px] font-bold text-indigo-300 self-start mb-2 flex items-center gap-1">
          <span>🔁 コミュニケーション循環ループ回路</span>
        </div>

        <svg width="260" height="220" className="overflow-visible">
          {/* Background Loop Ring */}
          <circle cx="130" cy="110" r="85" fill="none" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />

          {/* Connect Loop Arrows */}
          {circularNodes.map((node, i) => {
            const nextNode = circularNodes[(i + 1) % circularNodes.length];
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={node.x}
                  y1={node.y}
                  x2={nextNode.x}
                  y2={nextNode.y}
                  stroke={metrics.isOperationalClosure ? "#10b981" : "#6366f1"}
                  strokeWidth={node.speakCount > 0 ? "2" : "1"}
                  strokeDasharray={node.speakCount > 0 ? undefined : "3 3"}
                  opacity={node.speakCount > 0 ? 0.8 : 0.4}
                />
              </g>
            );
          })}

          {/* Render Agent Nodes */}
          {circularNodes.map((node) => (
            <g key={node.name} transform={`translate(${node.x}, ${node.y})`}>
              <circle
                r="16"
                fill="#1e293b"
                stroke={node.speakCount > 0 ? "#fbbf24" : "#475569"}
                strokeWidth="2"
                className={node.speakCount > 0 ? "animate-pulse" : ""}
              />
              <text
                textAnchor="middle"
                dy="4"
                fontSize="10"
                fill="#f8fafc"
                className="font-bold"
              >
                {node.name.slice(0, 2)}
              </text>
            </g>
          ))}
        </svg>
        <div className="text-[10px] text-slate-500 mt-1">
          ※ 矢印が全周に繋がり循環パス（強連結成分）が成立すると作動的閉鎖が達成されます
        </div>
      </div>
    </div>
  );
};
