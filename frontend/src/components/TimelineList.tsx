import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { Message, AgentNode } from "../types";
import { MessageBubble } from "./MessageBubble";
import { TimelineDots } from "./TimelineDots";

export interface TimelineListProps {
  messages: Message[];
  agents: Record<string, AgentNode>;
  zoom: "S" | "M" | "L";
  currentSpeaker?: string | null;
}

const ZOOM_FONT: Record<TimelineListProps["zoom"], number> = {
  S: 14,
  M: 16,
  L: 20,
};

export function TimelineList({
  messages,
  agents,
  zoom,
  currentSpeaker,
}: TimelineListProps) {
  const messageRefs = useRef<Record<number, HTMLLIElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentTurn = messages.length > 0 ? messages[messages.length - 1].turn : 0;

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    const node = messageRefs.current[last.turn];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const handleSelect = (turn: number) => {
    const node = messageRefs.current[turn];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const recentOffsets = useMemo<number[]>(() => {
    const n = messages.length;
    const arr: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      const distFromEnd = n - 1 - i;
      if (distFromEnd < 3) {
        const seed = (messages[i].turn * 37 + i * 13) % 9;
        const sign = seed % 2 === 0 ? 1 : -1;
        arr[i] = sign * (((seed % 5) / 5) * 4);
      }
    }
    return arr;
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 flex-col gap-2"
      style={{ fontSize: ZOOM_FONT[zoom] }}
    >
      <TimelineDots
        messages={messages}
        agents={agents}
        currentTurn={currentTurn}
        currentSpeaker={currentSpeaker ?? null}
        onSelect={handleSelect}
      />
      {messages.length === 0 ? (
        <p className="px-2 py-6 text-center text-cyberpunk-text/50">
          発言がまだありません。
        </p>
      ) : (
        <ul className="flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.map((m, idx) => {
            const isSpeaker = currentSpeaker === m.agent_name;
            const offsetX = recentOffsets[idx] ?? 0;
            return (
              <motion.li
                key={`${m.turn}-${idx}`}
                ref={(el) => {
                  messageRefs.current[m.turn] = el;
                }}
                animate={offsetX !== 0 ? { x: offsetX } : { x: 0 }}
                transition={{ type: "spring", stiffness: 140, damping: 18 }}
                style={
                  isSpeaker
                    ? {
                        borderLeft: "2px solid #ff9d00",
                        animation: "tl-blink 1s ease-in-out infinite",
                        paddingLeft: 4,
                      }
                    : undefined
                }
              >
                <MessageBubble
                  message={m}
                  agent={agents[m.agent_name] ?? null}
                  isLast={idx === messages.length - 1}
                  currentSpeaker={currentSpeaker ?? null}
                />
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}