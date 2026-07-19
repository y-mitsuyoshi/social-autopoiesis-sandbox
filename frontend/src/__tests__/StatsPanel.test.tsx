import { render, screen } from "@testing-library/react";
import { StatsPanel } from "../components/StatsPanel";
import { computeStats, computeSociety } from "../lib/stats";
import type { AgentNode, Message } from "../types";

function makeMessage(
  agentName: string,
  length: number,
  turn: number,
): Message {
  return {
    timestamp: "t",
    turn,
    agent_name: agentName,
    agent_code: "c",
    message: "x".repeat(length),
    provider: "ollama",
    model: "m1",
  };
}

test("computeStats はターン数・発言回数・平均長を計算する", () => {
  const messages = [
    makeMessage("A", 10, 0),
    makeMessage("B", 20, 1),
    makeMessage("A", 30, 2),
  ];
  const stats = computeStats(messages, 5, null);
  expect(stats.turn).toBe(2);
  expect(stats.maxTurns).toBe(5);
  expect(stats.perAgentCount).toEqual({ A: 2, B: 1 });
  expect(stats.averageMessageLength).toBe(20);
  expect(stats.providers).toEqual([{ provider: "ollama", model: "m1" }]);
  expect(stats.elapsedMs).toBe(0);
});

test("computeStats は空配列でゼロ値を返す", () => {
  const stats = computeStats([], 0, null);
  expect(stats.turn).toBe(0);
  expect(stats.averageMessageLength).toBe(0);
  expect(stats.providers).toEqual([]);
});

test("computeSociety は密度と活性度を計算する", () => {
  const agents: Record<string, AgentNode> = {
    A: { name: "A", binaryCode: "c", concern: "", provider: "p", model: "m", speakCount: 2, state: "idle" },
    B: { name: "B", binaryCode: "c", concern: "", provider: "p", model: "m", speakCount: 1, state: "idle" },
    C: { name: "C", binaryCode: "c", concern: "", provider: "p", model: "m", speakCount: 0, state: "idle" },
  };
  const edges = [{ from: "A", to: "B", count: 1 }];
  const s = computeSociety(agents, edges, 3);
  expect(s.messageCount).toBe(3);
  expect(s.edgeCount).toBe(1);
  expect(s.edgeDensity).toBeCloseTo(1 / 3, 5);
  expect(s.activeNodeRatio).toBeCloseTo(2 / 3, 5);
});

test("StatsPanel は数値を表示する", () => {
  const stats = computeStats(
    [makeMessage("A", 12, 0), makeMessage("A", 8, 1)],
    2,
    null,
  );
  render(<StatsPanel stats={stats} status="running" />);
  expect(screen.getByText("TURN")).toBeInTheDocument();
  expect(screen.getByText("1/2")).toBeInTheDocument();
  expect(screen.getByText("AVG LEN")).toBeInTheDocument();
  expect(screen.getByText("10")).toBeInTheDocument();
});