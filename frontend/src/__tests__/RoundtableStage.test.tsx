import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoundtableStage } from "../components/RoundtableStage";
import { LuhmannTeacherPanel } from "../components/LuhmannTeacherPanel";
import { AvatarDetailModal } from "../components/AvatarDetailModal";
import type { AgentNode, Message } from "../types";

describe("RoundtableStage & Beginner Panels Tests", () => {
  const mockAgents: Record<string, AgentNode> = {
    "法システム": {
      name: "法システム",
      binaryCode: "合法/違法",
      concern: "法秩序",
      provider: "ollama",
      model: "m1",
      speakCount: 2,
      state: "speaking",
    },
    "経済システム": {
      name: "経済システム",
      binaryCode: "支払/非支払",
      concern: "財務",
      provider: "ollama",
      model: "m1",
      speakCount: 1,
      state: "thinking",
    },
  };

  const mockMessages: Message[] = [
    {
      timestamp: "2026-07-22T00:00:00Z",
      turn: 1,
      agent_name: "法システム",
      agent_code: "合法/違法",
      message: "本件は法令に準拠し合憲であります。",
      provider: "ollama",
      model: "m1",
    },
  ];

  it("renders RoundtableStage with avatars and live speaker message", () => {
    render(
      <RoundtableStage
        agents={mockAgents}
        messages={mockMessages}
        currentSpeaker="法システム"
        nextSpeaker="経済システム"
        eli5Mode={true}
        onSelectAgent={vi.fn()}
      />
    );

    expect(screen.getByText("🗣️ 人間アバター対話ステージ")).toBeInTheDocument();
    expect(screen.getAllByText(/草薙 零/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/サイバー犬/)[0]).toBeInTheDocument();
  });

  it("renders LuhmannTeacherPanel and toggles tabs", () => {
    const handleClose = vi.fn();
    render(
      <LuhmannTeacherPanel
        isOpen={true}
        onClose={handleClose}
        lastMessage={mockMessages[0]}
        turnCount={1}
      />
    );

    expect(screen.getByText("🎓 ルマン先生のやさしい解説")).toBeInTheDocument();
    expect(screen.getByText("📖 用語かみくだく辞典")).toBeInTheDocument();

    // Click tab
    fireEvent.click(screen.getByText("📖 用語かみくだく辞典"));
    expect(screen.getByText("【判断のものさし】")).toBeInTheDocument();
  });

  it("renders AvatarDetailModal when agent is selected", () => {
    const handleClose = vi.fn();
    render(
      <AvatarDetailModal
        agent={mockAgents["法システム"]}
        lastMessage={mockMessages[0]}
        onClose={handleClose}
      />
    );

    expect(screen.getAllByText(/草薙 零/)[0]).toBeInTheDocument();
    expect(screen.getByText(/公安義体捜査官/)).toBeInTheDocument();
    expect(screen.getByText(/初心者向け解説: この人の【判断のものさし】/)).toBeInTheDocument();
  });
});
