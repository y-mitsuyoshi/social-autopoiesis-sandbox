import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentNode } from "../types";
import { generateAvatar } from "../lib/avatar";

export interface AgentAvatarProps {
  agent: AgentNode;
  size?: number;
}

function AgentAvatarBase({ agent, size = 48 }: AgentAvatarProps) {
  const svg = useMemo(
    () =>
      generateAvatar(agent.binaryCode, agent.concern, {
        avatarHue: agent.avatarHue,
        avatarGlyph: agent.avatarGlyph,
      }),
    [agent.binaryCode, agent.concern, agent.avatarHue, agent.avatarGlyph],
  );

  const stateAnimations: Record<
    AgentNode["state"],
    { boxShadow: string | string[]; scale: number | number[] }
  > = {
    idle: {
      boxShadow: "0 0 8px rgba(0, 255, 156, 0.33)",
      scale: 1,
    },
    thinking: {
      boxShadow: "0 0 12px rgba(0, 229, 255, 0.6)",
      scale: 1,
    },
    speaking: {
      boxShadow: [
        "0 0 16px rgba(0, 255, 156, 0.6)",
        "0 0 28px rgba(0, 255, 156, 0.95)",
        "0 0 16px rgba(0, 255, 156, 0.6)",
      ],
      scale: [1, 1.08, 1],
    },
  };

  const ring =
    agent.state === "thinking" ? (
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-cyberpunk-neon"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
    ) : null;

  return (
    <motion.div
      className="relative inline-flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
      animate={stateAnimations[agent.state]}
      transition={{
        duration: agent.state === "speaking" ? 1 : 0.4,
        repeat: agent.state === "speaking" ? Infinity : 0,
        ease: "easeInOut",
      }}
    >
      <div
        className="h-full w-full overflow-hidden rounded-full"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted local SVG
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {ring}
      {agent.state === "speaking" && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 rounded bg-cyberpunk-accent px-1 text-[8px] font-bold text-black"
        >
          MIC
        </span>
      )}
    </motion.div>
  );
}

export const AgentAvatar = memo(AgentAvatarBase);