import type { Message } from "../types";

export interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return <p className="text-gray-500">発言がまだありません。</p>;
  }
  return (
    <ul className="space-y-2">
      {messages.map((m, idx) => (
        <li key={idx} className="bg-white p-3 rounded shadow">
          <div className="text-xs text-gray-500">
            turn {m.turn} - {m.agent_name} [{m.agent_code}]
          </div>
          <div className="mt-1 whitespace-pre-wrap">{m.message}</div>
        </li>
      ))}
    </ul>
  );
}