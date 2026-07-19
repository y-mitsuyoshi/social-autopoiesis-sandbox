import { describe, it, expect } from "vitest";
import { PRESETS, PRESET_NAMES } from "../data/presets";
import type { AgentSpecInput } from "../types";

function assertValidSpec(s: AgentSpecInput, idx: number, name: string) {
  expect(s.name, `${name}[${idx}].name`).toBeTruthy();
  expect(s.binary_code, `${name}[${idx}].binary_code`).toBeTruthy();
  expect(s.concern, `${name}[${idx}].concern`).toBeTruthy();
  expect(s.system_prompt, `${name}[${idx}].system_prompt`).toBeTruthy();
  expect(s.provider, `${name}[${idx}].provider`).toMatch(/ollama|gemini|openai|opencode-go|opencode/);
  expect(s.model, `${name}[${idx}].model`).toBeTruthy();
  expect(typeof s.is_meta).toBe("boolean");
  expect(s.avatar_hue === null || (s.avatar_hue >= 0 && s.avatar_hue <= 359)).toBe(true);
  expect(s.avatar_glyph === null || typeof s.avatar_glyph === "string").toBe(true);
}

describe("presets", () => {
  it("contains 4 presets", () => {
    expect(PRESET_NAMES).toEqual([
      "agents-3",
      "agents-5",
      "agents-7",
      "agents-3-dynamic",
    ]);
  });

  it("each preset has non-empty fields", () => {
    for (const name of PRESET_NAMES) {
      const specs = PRESETS[name];
      expect(specs.length, name).toBeGreaterThan(0);
      specs.forEach((s, i) => assertValidSpec(s, i, name));
    }
  });

  it("agents-3 has 3 agents", () => {
    expect(PRESETS["agents-3"].length).toBe(3);
  });

  it("agents-5 has 5 agents", () => {
    expect(PRESETS["agents-5"].length).toBe(5);
  });

  it("agents-7 has 7 agents", () => {
    expect(PRESETS["agents-7"].length).toBe(7);
  });

  it("agents-3-dynamic has 4 agents including 1 meta", () => {
    const specs = PRESETS["agents-3-dynamic"];
    expect(specs.length).toBe(4);
    expect(specs.filter((s) => s.is_meta).length).toBe(1);
  });

  it("agent names are unique within each preset", () => {
    for (const name of PRESET_NAMES) {
      const names = PRESETS[name].map((s) => s.name);
      expect(new Set(names).size, name).toBe(names.length);
    }
  });
});