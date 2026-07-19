import { useEffect, useRef } from "react";
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
  S: 11,
  M: 13,
  L: 16,
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
            return (
              <li
                key={`${m.turn}-${idx}`}
                ref={(el) => {
                  messageRefs.current[m.turn] = el;
                }}
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}