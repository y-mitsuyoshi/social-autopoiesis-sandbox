import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpeakCountChart } from "../components/SpeakCountChart";
import type { AgentNode, Message } from "../types";

function makeAgent(name: string): AgentNode {
  return {
    name,
    binaryCode: name,
    concern: "",
    provider: "ollama",
    model: "m1",
    speakCount: 0,
    state: "idle",
    avatarHue: 100,
  };
}

function makeMessage(name: string, turn: number): Message {
  return {
    timestamp: "t",
    turn,
    agent_name: name,
    agent_code: name,
    message: "x",
    provider: "p",
    model: "m",
  };
}

describe("SpeakCountChart", () => {
  it("renders svg with aria-label", () => {
    const agents: Record<string, AgentNode> = {
      A: makeAgent("A"),
      B: makeAgent("B"),
    };
    render(<SpeakCountChart messages={[]} agents={agents} maxTurns={5} />);
    expect(screen.getByLabelText("speak-count-chart")).toBeInTheDocument();
  });

  it("renders one polyline per agent", () => {
    const agents: Record<string, AgentNode> = {
      A: makeAgent("A"),
      B: makeAgent("B"),
    };
    const messages = [makeMessage("A", 0), makeMessage("B", 1), makeMessage("A", 2)];
    const { container } = render(
      <SpeakCountChart messages={messages} agents={agents} maxTurns={3} />,
    );
    const polys = container.querySelectorAll("polyline");
    expect(polys.length).toBe(2);
  });

  it("uses agent avatarHue as stroke color", () => {
    const agents: Record<string, AgentNode> = {
      A: makeAgent("A"),
    };
    agents.A.avatarHue = 200;
    const { container } = render(
      <SpeakCountChart messages={[makeMessage("A", 0)]} agents={agents} maxTurns={3} />,
    );
    const line = container.querySelector("polyline");
    expect(line).not.toBeNull();
    expect(line!.getAttribute("stroke")).toContain("hsl(200");
  });

  it("falls back to maxTurns when 0 uses messages length", () => {
    const agents: Record<string, AgentNode> = { A: makeAgent("A") };
    const messages = [makeMessage("A", 0), makeMessage("A", 1), makeMessage("A", 2)];
    const { container } = render(
      <SpeakCountChart messages={messages} agents={agents} maxTurns={0} />,
    );
    expect(container.querySelector("polyline")).not.toBeNull();
    void vi;
  });
});