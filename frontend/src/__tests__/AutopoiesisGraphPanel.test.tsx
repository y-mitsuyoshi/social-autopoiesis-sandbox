import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AutopoiesisGraphPanel } from "../components/AutopoiesisGraphPanel";
import type { AgentNode, Message, SocietyMetrics } from "../types";

describe("AutopoiesisGraphPanel Tests", () => {
  const mockMetrics: SocietyMetrics = {
    messageCount: 5,
    edgeCount: 4,
    edgeDensity: 0.8,
    activeNodeRatio: 1.0,
    isOperationalClosure: true,
  };

  const mockAgents: Record<string, AgentNode> = {
    "法システム": {
      name: "法システム",
      binaryCode: "合法/違法",
      concern: "法",
      provider: "p1",
      model: "m1",
      speakCount: 2,
      state: "idle",
    },
    "経済システム": {
      name: "経済システム",
      binaryCode: "支払/非支払",
      concern: "経済",
      provider: "p1",
      model: "m1",
      speakCount: 3,
      state: "idle",
    },
  };

  const mockMessages: Message[] = [
    {
      timestamp: "2026-07-22T00:00:00Z",
      turn: 0,
      agent_name: "法システム",
      agent_code: "合法/違法",
      message: "合憲判断",
      provider: "p1",
      model: "m1",
    },
    {
      timestamp: "2026-07-22T00:01:00Z",
      turn: 1,
      agent_name: "経済システム",
      agent_code: "支払/非支払",
      message: "支払実行",
      provider: "p1",
      model: "m1",
    },
  ];

  it("renders AutopoiesisGraphPanel with proven score and metrics", () => {
    render(
      <AutopoiesisGraphPanel
        metrics={mockMetrics}
        messages={mockMessages}
        agents={mockAgents}
      />
    );

    expect(screen.getByText("🔄 オートポイエーシス作動グラフ可視化")).toBeInTheDocument();
    expect(screen.getAllByText("100%")[0]).toBeInTheDocument();
    expect(screen.getByText(/閉鎖成立/)).toBeInTheDocument();
  });
});
