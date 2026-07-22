import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RealtimeCyberMetrics } from "../components/RealtimeCyberMetrics";
import type { AgentNode, Message } from "../types";

describe("RealtimeCyberMetrics Component Tests", () => {
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
      message: "合憲判断であります",
      provider: "p1",
      model: "m1",
    },
    {
      timestamp: "2026-07-22T00:01:00Z",
      turn: 1,
      agent_name: "経済システム",
      agent_code: "支払/非支払",
      message: "支払いを承認します",
      provider: "p1",
      model: "m1",
    },
  ];

  it("renders RealtimeCyberMetrics and switches tabs", () => {
    render(
      <RealtimeCyberMetrics
        messages={mockMessages}
        agents={mockAgents}
        currentSpeaker="法システム"
      />
    );

    expect(screen.getByText("✨ リアルタイム・サイバーメトリクス (REALTIME METRICS)")).toBeInTheDocument();
    expect(screen.getByText("🌊 摂動オシロ")).toBeInTheDocument();

    // Click Polarity tab
    fireEvent.click(screen.getByText("📈 二元コード極性"));
    expect(screen.getByText("ターン別 二元コード評価 (+肯定 / -否定) 推移")).toBeInTheDocument();

    // Click Heatmap tab
    fireEvent.click(screen.getByText("🔥 刺激応答マトリクス"));
    expect(screen.getByText("システム間の刺激・応答発生頻度 (発言元 → 反応先)")).toBeInTheDocument();
  });
});
