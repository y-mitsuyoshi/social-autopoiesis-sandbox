import React, { useMemo } from "react";
import { HumanAvatar } from "./HumanAvatar";
import { getEli5MessageSummary } from "../lib/eli5Translator";
import type { AgentNode, Message } from "../types";

interface RoundtableStageProps {
  agents: Record<string, AgentNode>;
  messages: Message[];
  currentSpeaker: string | null;
  nextSpeaker: string | null;
  eli5Mode: boolean;
  onSelectAgent: (agent: AgentNode) => void;
}

export const RoundtableStage: React.FC<RoundtableStageProps> = ({
  agents,
  messages,
  currentSpeaker,
  nextSpeaker,
  eli5Mode,
  onSelectAgent,
}) => {
  const agentList = useMemo(() => Object.values(agents), [agents]);
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  // Calculate circular seats around the roundtable table
  const seatPositions = useMemo(() => {
    const total = agentList.length;
    if (total === 0) return [];
    const radiusX = 42; // Percentage of container width
    const radiusY = 32; // Percentage of container height
    const centerX = 50;
    const centerY = 48;

    return agentList.map((agent, index) => {
      const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radiusX * Math.cos(angle);
      const y = centerY + radiusY * Math.sin(angle);
      return { agent, x, y };
    });
  }, [agentList]);

  return (
    <div className="relative w-full h-[520px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between p-4">
      {/* Background Graphic & Ambiance */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Top Stage Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-sm font-bold text-slate-100 tracking-wide flex items-center gap-2">
            <span>🗣️ 人間アバター対話ステージ</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-500/40 text-indigo-300 font-mono">
              ROUNDTABLE VIEW
            </span>
          </h2>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>アバターをクリックすると詳細プロファイルを表示</span>
        </div>
      </div>

      {/* Main Roundtable Arena */}
      <div className="relative flex-1 my-2 flex items-center justify-center">
        {/* Sleek Modern Conference Table Graphic */}
        <div className="absolute w-[68%] h-[55%] rounded-[100px] border-2 border-slate-700/60 bg-gradient-to-b from-slate-900/90 to-slate-950/90 shadow-[0_0_50px_rgba(99,102,241,0.15)] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-1 bg-indigo-500/30 rounded-full mb-2" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            社会システム論 討論テーブル
          </span>
          <span className="text-[11px] text-slate-500 mt-1">
            {agentList.length} 人の専門アバターが作動的閉鎖のもと会話を連鎖中
          </span>

          {/* Active Spoken Speech Highlight in Center of Table */}
          {lastMessage && (
            <div className="mt-3 max-w-md w-full p-3 rounded-xl bg-slate-900/95 border border-indigo-500/40 shadow-xl transition-all duration-300 animate-fadeIn">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Turn {lastMessage.turn}: {lastMessage.agent_name} 発言中
                </span>
                <span>{lastMessage.agent_code}</span>
              </div>
              <p className="text-xs text-slate-200 font-medium line-clamp-2 italic">
                "{lastMessage.message}"
              </p>
              {eli5Mode && (
                <div className="mt-2 text-[11px] text-amber-200 bg-amber-950/50 p-2 rounded-lg border border-amber-500/40 font-medium text-left">
                  <span className="font-bold text-amber-300">💡 かみくだく要約: </span>
                  {getEli5MessageSummary(lastMessage)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Circular Avatar Seats */}
        {seatPositions.map(({ agent, x, y }) => {
          const isSpeaking = agent.name === currentSpeaker;
          const isThinking = agent.name === nextSpeaker && !isSpeaking;
          const agentState = isSpeaking ? "speaking" : isThinking ? "thinking" : "idle";

          return (
            <div
              key={agent.name}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="relative group">
                <HumanAvatar
                  agentName={agent.name}
                  binaryCode={agent.binaryCode}
                  state={agentState}
                  size="lg"
                  showName={true}
                  showRole={true}
                  showEli5Code={eli5Mode}
                  onClick={() => onSelectAgent(agent)}
                />

                {/* Speech Bubble floating next to speaker in stage */}
                {isSpeaking && lastMessage && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-64 p-3 bg-indigo-950/95 text-slate-100 border border-indigo-400/60 rounded-2xl shadow-2xl z-30 animate-bounce-short">
                    <div className="text-[10px] font-bold text-indigo-300 mb-1 flex items-center justify-between">
                      <span>{agent.name}</span>
                      <span className="text-amber-300">【{agent.binaryCode}】</span>
                    </div>
                    <p className="text-xs font-medium leading-tight line-clamp-3">
                      {lastMessage.message}
                    </p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-indigo-950/95" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Control Bar */}
      <div className="relative z-10 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            発言中: <strong className="text-slate-200">{currentSpeaker || "待機中"}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300/40" />
            思考中: <strong className="text-slate-300">{nextSpeaker || "未設定"}</strong>
          </span>
        </div>
        <div className="text-[11px] text-indigo-300 bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-500/30">
          💡 ヒント: 会話は「人間」ではなく「社会システム」が自律継続しています
        </div>
      </div>
    </div>
  );
};
