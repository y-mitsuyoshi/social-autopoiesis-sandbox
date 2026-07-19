import { render, screen } from "@testing-library/react";
import { NetworkGraph, buildEdges, layoutNodes } from "../components/NetworkGraph";
import type { AgentNode, Message } from "../types";

function makeAgent(name: string, speakCount = 0): AgentNode {
  return {
    name,
    binaryCode: name,
    concern: "",
    provider: "ollama",
    model: "m1",
    speakCount,
    state: "idle",
  };
}

test("buildEdges は隣接ターンペアからエッジを導出する", () => {
  const messages: Message[] = [
    { timestamp: "t", turn: 0, agent_name: "A", agent_code: "c", message: "x", provider: "p", model: "m" },
    { timestamp: "t", turn: 1, agent_name: "B", agent_code: "c", message: "x", provider: "p", model: "m" },
    { timestamp: "t", turn: 2, agent_name: "A", agent_code: "c", message: "x", provider: "p", model: "m" },
    { timestamp: "t", turn: 3, agent_name: "B", agent_code: "c", message: "x", provider: "p", model: "m" },
  ];
  const edges = buildEdges(messages);
  expect(edges).toContainEqual({ from: "A", to: "B", count: 2 });
  expect(edges).toContainEqual({ from: "B", to: "A", count: 1 });
});

test("buildEdges は同一エージェント連続の場合エッジを作らない", () => {
  const messages: Message[] = [
    { timestamp: "t", turn: 0, agent_name: "A", agent_code: "c", message: "x", provider: "p", model: "m" },
    { timestamp: "t", turn: 1, agent_name: "A", agent_code: "c", message: "x", provider: "p", model: "m" },
  ];
  expect(buildEdges(messages)).toHaveLength(0);
});

test("layoutNodes はエージェント数分の座標を返す", () => {
  const pos = layoutNodes(["A", "B", "C"], 100, { x: 200, y: 200 });
  expect(Object.keys(pos)).toHaveLength(3);
  for (const p of Object.values(pos)) {
    expect(p.x).toBeGreaterThanOrEqual(100);
    expect(p.x).toBeLessThanOrEqual(300);
  }
});

test("NetworkGraph はノードとエッジを描画する", () => {
  const agents: Record<string, AgentNode> = {
    A: makeAgent("A", 2),
    B: makeAgent("B", 1),
  };
  const edges = [{ from: "A", to: "B", count: 1 }];
  render(
    <NetworkGraph
      agents={agents}
      edges={edges}
      currentSpeaker="A"
      nextSpeaker="B"
    />,
  );
  expect(screen.getByRole("img", { name: "agent-network" })).toBeInTheDocument();
});