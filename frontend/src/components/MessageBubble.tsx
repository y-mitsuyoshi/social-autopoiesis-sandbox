import { motion } from "framer-motion";
import type { Message, AgentNode } from "../types";
import { AgentAvatar } from "./AgentAvatar";
import { hashHue } from "../lib/avatar";

export interface MessageBubbleProps {
  message: Message;
  agent: AgentNode | null;
  isLast: boolean;
  currentSpeaker?: string | null;
}

export function MessageBubble({
  message,
  agent,
  isLast,
  currentSpeaker,
}: MessageBubbleProps) {
  const hue = agent?.avatarHue ?? hashHue(message.agent_code);
  const borderColor = `hsl(${hue}, 80%, 60%)`;
  const live = isLast && (currentSpeaker === null || currentSpeaker === message.agent_name);
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      className="hud-panel flex gap-3 rounded-md p-3"
      aria-label={`turn-${message.turn}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {agent && (
        <div className="shrink-0">
          <AgentAvatar agent={agent} size={64} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-cyberpunk-neon">
          <span className="rounded border border-cyberpunk-neon/60 px-1">
            T{message.turn}
          </span>
          <span
            className="text-[12px] font-bold text-cyberpunk-text"
            style={{ color: borderColor }}
          >
            {message.agent_name}
          </span>
          <span className="text-cyberpunk-text/60">[{message.agent_code}]</span>
          <span className="text-cyberpunk-accent/80">
            {message.provider}/{message.model}
          </span>
          {live && (
            <span className="ml-auto text-cyberpunk-accent">●LIVE</span>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-cyberpunk-text">
          {message.message}
        </p>
      </div>
    </motion.div>
  );
}