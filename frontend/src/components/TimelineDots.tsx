import type { Message, AgentNode } from "../types";
import { hashHue } from "../lib/avatar";

export interface TimelineDotsProps {
  messages: Message[];
  agents: Record<string, AgentNode>;
  currentTurn: number;
  currentSpeaker: string | null;
  onSelect: (turn: number) => void;
}

export function TimelineDots({
  messages,
  agents,
  currentTurn,
  currentSpeaker,
  onSelect,
}: TimelineDotsProps) {
  if (messages.length === 0) return null;
  return (
    <div
      className="flex gap-2 overflow-x-auto border border-cyberpunk-neon/30 bg-cyberpunk-panel/60 p-2"
      role="tablist"
      aria-label="timeline"
    >
      {messages.map((m) => {
        const agent = agents[m.agent_name];
        const hue = agent?.avatarHue ?? hashHue(m.agent_code + m.agent_name);
        const isCurrent = m.turn === currentTurn;
        const isSpeaker = currentSpeaker === m.agent_name;
        return (
          <button
            key={m.turn}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            aria-label={`ターン${m.turn}`}
            tabIndex={0}
            onClick={() => onSelect(m.turn)}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <span
              className="block rounded-full"
              style={{
                width: isSpeaker ? 12 : 8,
                height: isSpeaker ? 12 : 8,
                backgroundColor: `hsl(${hue}, 80%, 60%)`,
                boxShadow: isCurrent
                  ? `0 0 6px hsl(${hue}, 90%, 70%), 0 0 0 2px #ff9d00`
                  : isSpeaker
                    ? `0 0 10px hsl(${hue}, 90%, 70%), 0 0 0 3px hsl(${hue}, 90%, 70%)`
                    : `0 0 4px hsl(${hue}, 80%, 60%)`,
              }}
            />
            <span
              className={
                isCurrent
                  ? "text-[9px] text-cyberpunk-accent"
                  : "text-[9px] text-cyberpunk-text/60"
              }
            >
              {m.turn}
            </span>
          </button>
        );
      })}
    </div>
  );
}