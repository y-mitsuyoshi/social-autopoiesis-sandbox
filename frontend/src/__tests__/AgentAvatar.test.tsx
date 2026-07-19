import { render, screen } from "@testing-library/react";
import { AgentAvatar } from "../components/AgentAvatar";
import { generateAvatar, concernGlyph, hashHue, AGENT_CONCERN_MAP } from "../lib/avatar";
import type { AgentNode } from "../types";

function makeAgent(overrides: Partial<AgentNode> = {}): AgentNode {
  return {
    name: "経済システム",
    binaryCode: "支払/非支払",
    concern: AGENT_CONCERN_MAP["経済システム"] ?? "",
    provider: "ollama",
    model: "m1",
    speakCount: 0,
    state: "idle",
    ...overrides,
  };
}

test("generateAvatar は同一入力で同一 SVG を返す", () => {
  const a = generateAvatar("code-A", "経済");
  const b = generateAvatar("code-A", "経済");
  expect(a).toBe(b);
});

test("generateAvatar は異なる入力で異なる SVG を返す", () => {
  const a = generateAvatar("code-A", "経済");
  const b = generateAvatar("code-B", "科学");
  expect(a).not.toBe(b);
});

test("concernGlyph は主要システムのグリフを返す", () => {
  expect(concernGlyph("経済システム")).toBe("¥");
  expect(concernGlyph("科学システム")).toBe("∞");
  expect(concernGlyph("法システム")).toBe("§");
  expect(concernGlyph("政治システム")).toBe("権");
  expect(concernGlyph("教育システム")).toBe("学");
  expect(concernGlyph("宗教システム")).toBe("◈");
  expect(concernGlyph("芸術システム")).toBe("♪");
  expect(concernGlyph("メディアシステム")).toBe("📡");
});

test("concernGlyph は未知の concern で既定 ◇ を返す", () => {
  expect(concernGlyph("unknown")).toBe("◇");
});

test("hashHue は 0..359 の範囲", () => {
  const h = hashHue("any-input");
  expect(h).toBeGreaterThanOrEqual(0);
  expect(h).toBeLessThan(360);
});

test("AGENT_CONCERN_MAP に主要7システムが含まれる", () => {
  expect(AGENT_CONCERN_MAP["経済システム"]).toBeDefined();
  expect(AGENT_CONCERN_MAP["科学システム"]).toBeDefined();
  expect(AGENT_CONCERN_MAP["法システム"]).toBeDefined();
  expect(AGENT_CONCERN_MAP["芸術システム"]).toBeDefined();
  expect(AGENT_CONCERN_MAP["メディアシステム"]).toBeDefined();
  expect(AGENT_CONCERN_MAP["政治システム"]).toBeDefined();
  expect(AGENT_CONCERN_MAP["教育システム"]).toBeDefined();
});

test("AgentAvatar は idle エージェントを描画する", () => {
  render(<AgentAvatar agent={makeAgent({ state: "idle" })} size={48} />);
  const el = document.querySelector("svg");
  expect(el).not.toBeNull();
});

test("AgentAvatar は speaking 状態で MIC ラベルを表示する", () => {
  render(<AgentAvatar agent={makeAgent({ state: "speaking" })} size={48} />);
  expect(screen.getByText("MIC")).toBeInTheDocument();
});