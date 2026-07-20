import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DebateVisualizer } from "../components/DebateVisualizer";
import { inferTarget, buildDebateArrows } from "../lib/analysis";
import type { AgentNode, Message } from "../types";

function makeAgent(name: string, binaryCode: string, concern: string): AgentNode {
  return {
    name,
    binaryCode,
    concern,
    provider: "ollama",
    model: "m1",
    speakCount: 0,
    state: "idle",
  };
}

function makeMessage(name: string, text: string, turn: number): Message {
  return {
    timestamp: "t",
    turn,
    agent_name: name,
    agent_code: "c",
    message: text,
    provider: "p",
    model: "m",
  };
}

describe("inferTarget", () => {
  it("returns null when no previous messages and no keyword", () => {
    const agents = { A: makeAgent("A", "c1", "concern1") };
    const m = makeMessage("A", "hello", 0);
    expect(inferTarget(m, [], agents)).toBeNull();
  });

  it("returns previous speaker when no keyword", () => {
    const agents = {
      A: makeAgent("A", "c1", "concern1"),
      B: makeAgent("B", "c2", "concern2"),
    };
    const prev = makeMessage("A", "hello", 0);
    const cur = makeMessage("B", "reply", 1);
    expect(inferTarget(cur, [prev], agents)).toBe("A");
  });

  it("returns agent whose name is mentioned", () => {
    const agents = {
      A: makeAgent("A", "支払/非支払", "コスト・利益"),
      B: makeAgent("B", "真/偽", "データ客観性"),
    };
    const prev = makeMessage("A", "hello", 0);
    const cur = makeMessage("B", "A へ反論", 1);
    expect(inferTarget(cur, [prev], agents)).toBe("A");
  });

  it("returns agent whose binary_code is mentioned", () => {
    const agents = {
      A: makeAgent("A", "支払/非支払", "コスト・利益"),
      B: makeAgent("B", "真/偽", "データ客観性"),
    };
    const prev = makeMessage("A", "hello", 0);
    const cur = makeMessage("B", "支払/非支払 というコードについて", 1);
    expect(inferTarget(cur, [prev], agents)).toBe("A");
  });

  it("returns agent whose concern keyword is mentioned", () => {
    const agents = {
      A: makeAgent("A", "c1", "コスト・利益"),
      B: makeAgent("B", "c2", "データ客観性"),
    };
    const prev = makeMessage("A", "hello", 0);
    const cur = makeMessage("B", "コスト・利益 の観点から", 1);
    expect(inferTarget(cur, [prev], agents)).toBe("A");
  });
});

describe("buildDebateArrows", () => {
  it("builds arrows from message sequence", () => {
    const agents = {
      A: makeAgent("A", "支払/非支払", "コスト"),
      B: makeAgent("B", "真/偽", "データ"),
    };
    const messages = [
      makeMessage("A", "start", 0),
      makeMessage("B", "reply", 1),
      makeMessage("A", "reply2", 2),
    ];
    const arrows = buildDebateArrows(messages, agents);
    expect(arrows.length).toBe(2);
    expect(arrows[0].from).toBe("B");
    expect(arrows[0].to).toBe("A");
    expect(arrows[0].turn).toBe(1);
    expect(arrows[1].from).toBe("A");
    expect(arrows[1].to).toBe("B");
    expect(arrows[1].turn).toBe(2);
  });

  it("skips self-target arrows", () => {
    const agents = { A: makeAgent("A", "c1", "concern1") };
    const messages = [makeMessage("A", "start", 0), makeMessage("A", "again", 1)];
    expect(buildDebateArrows(messages, agents)).toHaveLength(0);
  });
});

describe("DebateVisualizer", () => {
  it("renders arrows and nodes", () => {
    const agents = {
      A: makeAgent("A", "支払/非支払", "コスト"),
      B: makeAgent("B", "真/偽", "データ"),
    };
    const messages = [
      makeMessage("A", "start", 0),
      makeMessage("B", "reply", 1),
    ];
    const positions = { A: { x: 100, y: 100 }, B: { x: 200, y: 200 } };
    const { container } = render(
      <DebateVisualizer agents={agents} messages={messages} positions={positions} />,
    );
    expect(container.querySelector('[data-testid="debate-visualizer"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="debate-node-A"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="debate-node-B"]')).toBeTruthy();
  });
});