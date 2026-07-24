import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentNode, Message, SimulationStatus } from "../types";
import { computeAnalysis } from "../lib/analysis";
import { hashHue } from "../lib/avatar";

export interface AnalysisPanelProps {
  messages: Message[];
  agents: Record<string, AgentNode>;
  status: SimulationStatus;
  endReason?: string | null;
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
  endReason,
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

      {/* Comprehensive Luhmann Autopoiesis Theory Commentary */}
      <div className="border border-indigo-500/40 bg-indigo-950/40 p-3 rounded-xl text-xs space-y-2">
        <div className="flex items-center justify-between font-bold text-amber-300 border-b border-indigo-500/30 pb-1">
          <span>🎓 社会システム総合分析（ルーマン理論考察）</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-900 text-indigo-200">
            AUTOPOIESIS ANALYSIS
          </span>
        </div>
        {endReason && (
          <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-lg p-2 text-emerald-200">
            <span className="font-bold">🏁 終了理由: </span>
            {endReason}
          </div>
        )}
        <p className="text-slate-200 leading-relaxed font-sans">
          本シミュレーション（全 {messages.length} ターン）において、外部の人間個人の心理介入を受けることなく、社会システム群（{agentNames.join("・")}）が互いの発言を「自己の二元コード」に翻訳し合いながら自律再生（オートポイエーシス）を遂行しました。
        </p>
        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1.5 text-[11px] text-slate-300">
          <div className="font-semibold text-indigo-300">📌 考察のハイライト:</div>
          <div className="flex items-start gap-1.5">
            <span className="text-amber-400">・</span>
            <span>
              <strong>作動的閉鎖の証明 (Score: {(analysis.autopoiesis.totalScore * 100).toFixed(0)}%):</strong>{" "}
              最も影響力の高かった【{analysis.dominance[0]?.name || "主要システム"}】を筆頭に、各システムは他者の言葉をそのまま受容せず、自身のコードへ非対称に変換（構造的結合）して発話を連続させました。
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-amber-400">・</span>
            <span>
              <strong>二元コードの自己創出:</strong>{" "}
              法（合法/違法）と経済（支払/非支払）などの視点が対立しながらも、コミュニケーションが会話自体を資源として循環する「自律増殖回路」が成立しました。
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-amber-400">・</span>
            <span>
              <strong>オートポイエーシス判定: </strong>
              {analysis.autopoiesis.totalScore >= 0.6
                ? "会話の連鎖が多様に絡み合い、社会システムが自らの要素（コミュニケーション）を自己産出する「作動的閉鎖」が強固に成立しています。ルーマンの言う社会の自律性が可視化されました。"
                : analysis.autopoiesis.totalScore >= 0.3
                  ? "部分的にコミュニケーション連鎖が形成されつつありますが、システム間の相互作用がまだ一方向に偏っており、完全な作動的閉鎖には至っていません。さらに議論を重ねることで自律増殖回路が成熟する余地があります。"
                  : "システム間の相互作用が限定的で、オートポイエーシス（自己再生）の成立には至っていません。お題やターン数を調整して、より多様な視点が交差する環境を整えることを推奨します。"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}