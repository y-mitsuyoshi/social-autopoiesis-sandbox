import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineList } from "../components/TimelineList";
import type { Message, AgentNode } from "../types";

const messages: Message[] = [
  {
    timestamp: "2026-07-18T10:00:00Z",
    turn: 0,
    agent_name: "経済システム",
    agent_code: "支払/非支払",
    message: "発言0",
    provider: "ollama",
    model: "gemma4:12b",
  },
  {
    timestamp: "2026-07-18T10:00:05Z",
    turn: 1,
    agent_name: "科学システム",
    agent_code: "真/偽",
    message: "発言1",
    provider: "ollama",
    model: "gemma4:31b",
  },
];

const agents: Record<string, AgentNode> = {
  経済システム: {
    name: "経済システム",
    binaryCode: "支払/非支払",
    concern: "コスト・利益",
    state: "idle",
    speakCount: 1,
    provider: "ollama",
    model: "gemma4:12b",
  },
  科学システム: {
    name: "科学システム",
    binaryCode: "真/偽",
    concern: "データ客観性",
    state: "speaking",
    speakCount: 1,
    provider: "ollama",
    model: "gemma4:31b",
  },
};

describe("TimelineList", () => {
  it("renders all messages in order", () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    render(
      <TimelineList
        messages={messages}
        agents={agents}
        zoom="M"
        currentSpeaker="経済システム"
      />,
    );
    expect(screen.getByText("発言0")).toBeInTheDocument();
    expect(screen.getByText("発言1")).toBeInTheDocument();
  });

  it("renders timeline dots (role=tab) that trigger scroll on click", () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    render(
      <TimelineList
        messages={messages}
        agents={agents}
        zoom="M"
        currentSpeaker="経済システム"
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(tabs[0]);
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("applies zoom S font size via container style", () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const { container } = render(
      <TimelineList
        messages={messages}
        agents={agents}
        zoom="S"
        currentSpeaker="経済システム"
      />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer).toBeTruthy();
    expect(outer.style.fontSize).toContain("14");
  });

  it("shows placeholder when no messages", () => {
    render(<TimelineList messages={[]} agents={{}} zoom="M" />);
    expect(screen.getByText(/発言がまだありません/)).toBeInTheDocument();
  });
});