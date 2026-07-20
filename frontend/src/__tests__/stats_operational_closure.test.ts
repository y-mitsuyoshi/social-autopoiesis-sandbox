import { describe, it, expect } from "vitest";
import { computeSociety } from "../lib/stats";
import type { AgentNode, Message } from "../types";

describe("Operational Closure Stats Tests", () => {
  const defaultAgentProps = {
    provider: "openai",
    model: "gpt-4",
    state: "idle" as const,
  };

  it("should return false for empty agents / messages", () => {
    const s = computeSociety({}, [], 0, []);
    expect(s.isOperationalClosure).toBe(false);
  });

  it("should return true when all 3 conditions are satisfied (single cycle, all spoken, all codes active)", () => {
    const agents: Record<string, AgentNode> = {
      A: { ...defaultAgentProps, name: "A", binaryCode: "支払 / 非支払", concern: "Money", speakCount: 1 },
      B: { ...defaultAgentProps, name: "B", binaryCode: " 真 / 偽 ", concern: "Truth", speakCount: 1 },
      C: { ...defaultAgentProps, name: "C", binaryCode: "合法/違法", concern: "Law", speakCount: 1 },
    };

    const edges = [
      { from: "A", to: "B", count: 1 },
      { from: "B", to: "C", count: 1 },
      { from: "C", to: "A", count: 1 },
    ];

    const messages: Message[] = [
      { timestamp: "t", turn: 0, agent_name: "A", agent_code: "支払/非支払", message: "支払を行いました。非支払ではない。", provider: "p", model: "m" },
      { timestamp: "t", turn: 1, agent_name: "B", agent_code: "真/偽", message: "これは真であり、偽ではない。", provider: "p", model: "m" },
      { timestamp: "t", turn: 2, agent_name: "C", agent_code: "合法/違法", message: "合法な取引、違法行為の排除。", provider: "p", model: "m" },
    ];

    const s = computeSociety(agents, edges, 3, messages);
    expect(s.isOperationalClosure).toBe(true);
  });

  it("should return false if any non-meta agent has not spoken", () => {
    const agents: Record<string, AgentNode> = {
      A: { ...defaultAgentProps, name: "A", binaryCode: "支払/非支払", concern: "Money", speakCount: 1 },
      B: { ...defaultAgentProps, name: "B", binaryCode: "真/偽", concern: "Truth", speakCount: 0 }, // Not spoken
    };

    const edges = [{ from: "A", to: "A", count: 1 }];
    const messages: Message[] = [
      { timestamp: "t", turn: 0, agent_name: "A", agent_code: "支払/非支払", message: "支払/非支払", provider: "p", model: "m" },
    ];

    const s = computeSociety(agents, edges, 2, messages);
    expect(s.isOperationalClosure).toBe(false);
  });

  it("should return false if disjoint cycles are present (strictly single SCC check)", () => {
    const agents: Record<string, AgentNode> = {
      A: { ...defaultAgentProps, name: "A", binaryCode: "支払/非支払", concern: "Money", speakCount: 1 },
      B: { ...defaultAgentProps, name: "B", binaryCode: "支払/非支払", concern: "Money", speakCount: 1 },
      C: { ...defaultAgentProps, name: "C", binaryCode: "真/偽", concern: "Truth", speakCount: 1 },
      D: { ...defaultAgentProps, name: "D", binaryCode: "真/偽", concern: "Truth", speakCount: 1 },
    };

    // Edge cycle 1: A <-> B
    // Edge cycle 2: C <-> D
    // Separated, disjoint cycles!
    const edges = [
      { from: "A", to: "B", count: 1 },
      { from: "B", to: "A", count: 1 },
      { from: "C", to: "D", count: 1 },
      { from: "D", to: "C", count: 1 },
    ];

    const messages: Message[] = [
      { timestamp: "t", turn: 0, agent_name: "A", agent_code: "支払/非支払", message: "支払 非支払", provider: "p", model: "m" },
      { timestamp: "t", turn: 1, agent_name: "B", agent_code: "支払/非支払", message: "支払 非支払", provider: "p", model: "m" },
      { timestamp: "t", turn: 2, agent_name: "C", agent_code: "真/偽", message: "真 偽", provider: "p", model: "m" },
      { timestamp: "t", turn: 3, agent_name: "D", agent_code: "真/偽", message: "真 偽", provider: "p", model: "m" },
    ];

    const s = computeSociety(agents, edges, 4, messages);
    expect(s.isOperationalClosure).toBe(false);
  });

  it("should return false if there is a linear path with no cycle back (strongly connected graph verification)", () => {
    const agents: Record<string, AgentNode> = {
      A: { ...defaultAgentProps, name: "A", binaryCode: "支払/非支払", concern: "Money", speakCount: 1 },
      B: { ...defaultAgentProps, name: "B", binaryCode: "真/偽", concern: "Truth", speakCount: 1 },
      C: { ...defaultAgentProps, name: "C", binaryCode: "合法/違法", concern: "Law", speakCount: 1 },
    };

    // A -> B -> C (No path back to A)
    const edges = [
      { from: "A", to: "B", count: 1 },
      { from: "B", to: "C", count: 1 },
    ];

    const messages: Message[] = [
      { timestamp: "t", turn: 0, agent_name: "A", agent_code: "支払/非支払", message: "支払 非支払", provider: "p", model: "m" },
      { timestamp: "t", turn: 1, agent_name: "B", agent_code: "真/偽", message: "真 偽", provider: "p", model: "m" },
      { timestamp: "t", turn: 2, agent_name: "C", agent_code: "合法/違法", message: "合法 違法", provider: "p", model: "m" },
    ];

    const s = computeSociety(agents, edges, 3, messages);
    expect(s.isOperationalClosure).toBe(false);
  });

  it("should return false if only positive pole is activated but negative is not", () => {
    const agents: Record<string, AgentNode> = {
      A: { ...defaultAgentProps, name: "A", binaryCode: "支払/非支払", concern: "Money", speakCount: 1 },
    };

    const edges = [{ from: "A", to: "A", count: 1 }];
    const messages: Message[] = [
      { timestamp: "t", turn: 0, agent_name: "A", agent_code: "支払/非支払", message: "支払！支払！支払のみ！", provider: "p", model: "m" }, // No "非支払"
    ];

    const s = computeSociety(agents, edges, 1, messages);
    expect(s.isOperationalClosure).toBe(false);
  });

  it("should safely handle and fall back for binary codes with missing slash", () => {
    const agents: Record<string, AgentNode> = {
      A: { ...defaultAgentProps, name: "A", binaryCode: "支払", concern: "Money", speakCount: 1 }, // Missing slash, defaults to "支払" and "非支払"
    };

    const edges = [{ from: "A", to: "A", count: 1 }];
    const messages: Message[] = [
      { timestamp: "t", turn: 0, agent_name: "A", agent_code: "支払", message: "支払を承認します。非支払に転じる。", provider: "p", model: "m" },
    ];

    const s = computeSociety(agents, edges, 1, messages);
    expect(s.isOperationalClosure).toBe(true);
  });
});
