import React from "react";
import { HumanAvatar } from "./HumanAvatar";
import { getHumanPersona } from "../data/humanPersonas";
import { getEli5MessageSummary } from "../lib/eli5Translator";
import type { AgentNode, Message } from "../types";

interface AvatarDetailModalProps {
  agent: AgentNode | null;
  lastMessage?: Message | null;
  onClose: () => void;
}

export const AvatarDetailModal: React.FC<AvatarDetailModalProps> = ({
  agent,
  lastMessage,
  onClose,
}) => {
  if (!agent) return null;

  const persona = getHumanPersona(agent.name, agent.binaryCode);
  const eli5Summary = lastMessage ? getEli5MessageSummary(lastMessage) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-lg overflow-hidden bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Color Banner */}
        <div
          className={`h-24 w-full bg-gradient-to-r ${persona.avatarGradient} p-4 flex items-end justify-between relative`}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/50 text-slate-300 hover:text-white hover:bg-slate-950 flex items-center justify-center transition-colors"
            title="閉じる"
          >
            ✕
          </button>
          <div className="text-white">
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 border border-white/20 font-mono">
              二元コード: {agent.binaryCode || "固有コード"}
            </span>
          </div>
        </div>

        {/* Profile Details Container */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Avatar Portrait Overlapping Banner */}
          <div className="-mt-12 mb-4 flex items-end justify-between">
            <div className="p-1 bg-slate-900 rounded-full inline-block shadow-xl">
              <HumanAvatar
                agentName={agent.name}
                binaryCode={agent.binaryCode}
                state={agent.state}
                size="xl"
                showName={false}
                showRole={false}
              />
            </div>
            <div className="text-right pb-2">
              <div className="text-xs text-slate-400">発言回数 (自律作動)</div>
              <div className="text-2xl font-bold text-indigo-400 font-mono">
                {agent.speakCount} 回
              </div>
            </div>
          </div>

          {/* Name & Title */}
          <div>
            <h2 className="text-xl font-bold text-slate-50 flex items-center gap-2">
              {persona.realName}
              <span className="text-xs font-normal px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                {agent.name}
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">{persona.roleTitle}</p>
          </div>

          {/* Plain Language Code Explanation Box */}
          <div className="mt-4 p-4 rounded-xl bg-slate-850 border border-slate-700/60 bg-gradient-to-br from-slate-800/80 to-slate-900/90">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <span>💡</span> 初心者向け解説: この人の【判断のものさし】
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {persona.plainCodeExplanation}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
                <span className="font-bold block text-[10px] text-emerald-400">プラス評価 (+)</span>
                {persona.positiveMeaning}
              </div>
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
                <span className="font-bold block text-[10px] text-rose-400">マイナス評価 (-)</span>
                {persona.negativeMeaning}
              </div>
            </div>
          </div>

          {/* Persona Biography */}
          <div className="mt-4">
            <h4 className="text-xs font-bold text-slate-400 mb-1">人物概要・専門</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{persona.bio}</p>
          </div>

          {/* Last Spoken Statement & ELI5 Summary */}
          {lastMessage && (
            <div className="mt-4 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30">
              <div className="text-[10px] font-bold text-indigo-400 mb-1 flex items-center justify-between">
                <span>最新の発言 (Turn {lastMessage.turn})</span>
                <span className="text-slate-400 font-normal">
                  {lastMessage.model}
                </span>
              </div>
              <p className="text-xs text-slate-200 italic line-clamp-2">
                "{lastMessage.message}"
              </p>
              {eli5Summary && (
                <div className="mt-2 text-[11px] text-amber-200 bg-amber-950/40 p-2 rounded border border-amber-500/30 font-medium">
                  <span className="font-bold">かみくだく解説:</span> {eli5Summary}
                </div>
              )}
            </div>
          )}

          {/* Footer Close Button */}
          <div className="mt-5 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md active:scale-95"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
