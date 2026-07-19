import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "../components/MessageBubble";
import type { Message, AgentNode } from "../types";

const baseMessage: Message = {
  timestamp: "2026-07-18T10:00:00Z",
  turn: 0,
  agent_name: "経済システム",
  agent_code: "支払/非支払",
  message: "テスト発言内容",
  provider: "ollama",
  model: "gemma4:12b",
};

const baseAgent: AgentNode = {
  name: "経済システム",
  binaryCode: "支払/非支払",
  concern: "コスト・利益・市場価値・資源効率",
  state: "speaking",
  speakCount: 1,
  provider: "ollama",
  model: "gemma4:12b",
};

describe("MessageBubble", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders message metadata and content", () => {
    render(<MessageBubble message={baseMessage} agent={baseAgent} isLast={true} />);
    expect(screen.getByText("経済システム")).toBeInTheDocument();
    expect(screen.getByText("テスト発言内容")).toBeInTheDocument();
    expect(screen.getByText(/支払\/非支払/)).toBeInTheDocument();
  });

  it("renders without agent (null)", () => {
    render(<MessageBubble message={baseMessage} agent={null} isLast={false} />);
    expect(screen.getByText("テスト発言内容")).toBeInTheDocument();
  });

  it("shows provider and model in header", () => {
    render(<MessageBubble message={baseMessage} agent={baseAgent} isLast={true} />);
    expect(screen.getByText(/ollama/)).toBeInTheDocument();
    expect(screen.getByText(/gemma4:12b/)).toBeInTheDocument();
  });
});