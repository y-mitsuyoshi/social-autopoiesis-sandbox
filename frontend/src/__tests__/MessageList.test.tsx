import { render, screen } from "@testing-library/react";
import { MessageList } from "../components/MessageList";
import type { Message } from "../types";

test("空の場合はプレースホルダが表示される", () => {
  render(<MessageList messages={[]} />);
  expect(screen.getByText(/発言がまだありません/)).toBeInTheDocument();
});

test("メッセージ配列を渡すと各発言が描画される", () => {
  const messages: Message[] = [
    {
      timestamp: "2026-01-01T00:00:00Z",
      turn: 0,
      agent_name: "経済システム",
      agent_code: "支払/非支払",
      message: "コストの観点から発言1",
      provider: "ollama",
      model: "m1",
    },
    {
      timestamp: "2026-01-01T00:00:01Z",
      turn: 1,
      agent_name: "科学システム",
      agent_code: "真/偽",
      message: "データから発言2",
      provider: "ollama",
      model: "m1",
    },
  ];
  render(<MessageList messages={messages} />);
  expect(screen.getByText("コストの観点から発言1")).toBeInTheDocument();
  expect(screen.getByText("データから発言2")).toBeInTheDocument();
  expect(screen.getByText(/経済システム/)).toBeInTheDocument();
  expect(screen.getByText(/科学システム/)).toBeInTheDocument();
});