import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { computeAnalysis } from "../lib/analysis";
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

describe("computeAnalysis", () => {
  it("returns zero scores for empty messages", () => {
    const agents = {
      A: makeAgent("A", "支払/非支払", "コスト・利益"),
      B: makeAgent("B", "真/偽", "データ客観性"),
    };
    const r = computeAnalysis([], agents);
    expect(r.autopoiesis.totalScore).toBe(0);
    expect(r.dominance.length).toBe(2);
    expect(r.interactionMatrix.length).toBe(0);
  });

  it("computes dominance with count and avgLength", () => {
    const agents = {
      A: makeAgent("A", "支払/非支払", "コスト・利益"),
      B: makeAgent("B", "真/偽", "データ客観性"),
    };
    const messages = [
      makeMessage("A", "x".repeat(20), 0),
      makeMessage("B", "y".repeat(10), 1),
      makeMessage("A", "z".repeat(40), 2),
    ];
    const r = computeAnalysis(messages, agents);
    const a = r.dominance.find((d) => d.name === "A");
    expect(a).toBeDefined();
    expect(a!.count).toBe(2);
    expect(a!.avgLength).toBe(30);
    const b = r.dominance.find((d) => d.name === "B");
    expect(b!.count).toBe(1);
    expect(b!.avgLength).toBe(10);
    expect(a!.score).toBeGreaterThanOrEqual(0);
    expect(a!.score).toBeLessThanOrEqual(1);
  });

  it("computes interaction matrix from adjacent messages", () => {
    const agents = {
      A: makeAgent("A", "支払/非支払", "コスト・利益"),
      B: makeAgent("B", "真/偽", "データ客観性"),
    };
    const messages = [
      makeMessage("A", "hello", 0),
      makeMessage("B", "支払/非支払 について反論", 1),
      makeMessage("A", "reply2", 2),
    ];
    const r = computeAnalysis(messages, agents);
    expect(r.interactionMatrix.length).toBeGreaterThan(0);
    const ba = r.interactionMatrix.find((e) => e.from === "B" && e.to === "A");
    expect(ba).toBeDefined();
    expect(ba!.count).toBe(1);
  });

  it("computes autopoiesis score in [0,1]", () => {
    const agents = {
      A: makeAgent("A", "支払/非支払", "コスト・利益"),
      B: makeAgent("B", "真/偽", "データ客観性"),
      C: makeAgent("C", "合法/違法", "規約遵守"),
    };
    const messages = [
      makeMessage("A", "msg", 0),
      makeMessage("B", "msg", 1),
      makeMessage("C", "msg", 2),
      makeMessage("A", "msg", 3),
    ];
    const r = computeAnalysis(messages, agents);
    expect(r.autopoiesis.edgeDensity).toBeGreaterThanOrEqual(0);
    expect(r.autopoiesis.edgeDensity).toBeLessThanOrEqual(1);
    expect(r.autopoiesis.diversity).toBeGreaterThanOrEqual(0);
    expect(r.autopoiesis.diversity).toBeLessThanOrEqual(1);
    expect(r.autopoiesis.maxChainLength).toBeGreaterThanOrEqual(0);
    expect(r.autopoiesis.maxChainLength).toBeLessThanOrEqual(1);
    expect(r.autopoiesis.totalScore).toBeGreaterThanOrEqual(0);
    expect(r.autopoiesis.totalScore).toBeLessThanOrEqual(1);
  });
});

describe("AnalysisPanel", () => {
  it("renders nothing when status is not completed", () => {
    const agents = { A: makeAgent("A", "c", "concern") };
    const { container } = render(
      <AnalysisPanel messages={[]} agents={agents} status="running" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dominance, matrix, autopoiesis sections when completed", () => {
    const agents = {
      A: makeAgent("A", "支払/非支払", "コスト・利益"),
      B: makeAgent("B", "真/偽", "データ客観性"),
    };
    const messages = [
      makeMessage("A", "x".repeat(20), 0),
      makeMessage("B", "y".repeat(10), 1),
      makeMessage("A", "z".repeat(30), 2),
    ];
    render(
      <AnalysisPanel messages={messages} agents={agents} status="completed" />,
    );
    expect(screen.getByTestId("analysis-panel")).toBeInTheDocument();
    expect(screen.getByText("DOMINANCE / 主導性スコア")).toBeInTheDocument();
    expect(
      screen.getByText("INTERACTION MATRIX / 相互作用行列"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AUTOPOIESIS SCORE / オートポイエーシス度"),
    ).toBeInTheDocument();
    expect(screen.getByText(/次フェーズで実装予定/)).toBeInTheDocument();
  });
});