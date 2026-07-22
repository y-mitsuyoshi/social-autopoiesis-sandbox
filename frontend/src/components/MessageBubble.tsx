import { motion } from "framer-motion";
import type { Message, AgentNode } from "../types";
import { HumanAvatar } from "./HumanAvatar";
import { getHumanPersona } from "../data/humanPersonas";
import { getEli5MessageSummary } from "../lib/eli5Translator";
import { hashHue } from "../lib/avatar";

export interface MessageBubbleProps {
  message: Message;
  agent: AgentNode | null;
  isLast: boolean;
  currentSpeaker?: string | null;
  eli5Mode?: boolean;
}

export function MessageBubble({
  message,
  agent,
  isLast,
  currentSpeaker,
  eli5Mode = true,
}: MessageBubbleProps) {
  const persona = getHumanPersona(message.agent_name, message.agent_code);
  const hue = agent?.avatarHue ?? hashHue(message.agent_code);
  const borderColor = persona.avatarColor || `hsl(${hue}, 80%, 60%)`;
  const live = isLast && (currentSpeaker === null || currentSpeaker === message.agent_name);
  const chars = Array.from(message.message);
  const eli5Summary = getEli5MessageSummary(message);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      className="hud-panel flex gap-3.5 rounded-xl p-3.5 bg-slate-900/90 border border-slate-800 shadow-md"
      aria-label={`turn-${message.turn}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="shrink-0 pt-0.5">
        <HumanAvatar
          agentName={message.agent_name}
          binaryCode={message.agent_code}
          state={live ? "speaking" : "idle"}
          size="md"
          showName={false}
          showRole={false}
        />
      </div>

      <div className="min-w-0 flex-1">
        {/* Message Header */}
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold text-slate-200">
          <span className="rounded bg-indigo-950/80 border border-indigo-500/40 px-1.5 py-0.5 text-[11px] font-mono text-indigo-300">
            Turn {message.turn}
          </span>
          <span
            className="text-sm font-bold text-slate-100"
            style={{ color: borderColor }}
          >
            {persona.realName}
          </span>
          <span className="text-slate-400 font-normal">
            (<span>{message.agent_name}</span>)
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono border border-slate-700">
            {message.agent_code}
          </span>
          <span className="text-[10px] text-slate-500 font-mono ml-auto">
            {message.provider}/{message.model}
          </span>
          {live && (
            <span className="ml-2 text-amber-400 text-[10px] animate-pulse font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              LIVE
            </span>
          )}
        </div>

        {/* Message Content */}
        <p
          className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-200"
        >
          {live
            ? chars.map((ch, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.05, delay: i * 0.015 }}
                >
                  {ch}
                </motion.span>
              ))
            : message.message}
        </p>

        {/* ELI5 Summary Badge when ELI5 mode is ON */}
        {eli5Mode && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs font-medium flex items-start gap-2">
            <span className="text-sm shrink-0">💡</span>
            <div>
              <span className="font-bold text-amber-300 block text-[11px]">
                【かみくだく解説】
              </span>
              <span>{eli5Summary}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}