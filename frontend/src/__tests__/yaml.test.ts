import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serializeAgentsYaml } from "../lib/yaml";
import type { AgentSpecInput } from "../types";

const agents5Yaml = readFileSync(
  resolve(process.cwd(), "..", "config", "presets", "agents-5.yaml"),
  "utf-8",
);

function buildSpec(): AgentSpecInput[] {
  return [
    {
      name: "経済システム",
      binary_code: "支払/非支払",
      concern: "コスト・利益・市場価値・資源効率",
      provider: "ollama",
      model: "gemma4:12b",
      is_meta: false,
      system_prompt:
        "あなたは経済システムである。\n世界を二値コード「支払/非支払」で解釈し、\nコスト・利益・市場価値・資源効率に関心を持つ。\n入力されたメッセージをこのコードの視点からのみ解釈し、\n経済システムとしての発言を生成せよ。\n",
      avatar_hue: null,
      avatar_glyph: null,
    },
    {
      name: "科学システム",
      binary_code: "真/偽",
      concern: "データ客観性・論理整合性・エビデンス・事実検証",
      provider: "ollama",
      model: "gpt-oss:20b-cloud",
      is_meta: false,
      system_prompt:
        "あなたは科学システムである。\n世界を二値コード「真/偽」で解釈し、\nデータ客観性・論理整合性・エビデンス・事実検証に関心を持つ。\n入力されたメッセージをこのコードの視点からのみ解釈し、\n科学システムとしての発言を生成せよ。\n",
      avatar_hue: null,
      avatar_glyph: null,
    },
    {
      name: "法システム",
      binary_code: "合法/違法",
      concern: "規約遵守・権利・契約正当性",
      provider: "ollama",
      model: "gemma4:e4b",
      is_meta: false,
      system_prompt:
        "あなたは法システムである。\n世界を二値コード「合法/違法」で解釈し、\n規約遵守・権利・契約正当性に関心を持つ。\n入力されたメッセージをこのコードの視点からのみ解釈し、\n法システムとしての発言を生成せよ。",
      avatar_hue: null,
      avatar_glyph: null,
    },
    {
      name: "芸術システム",
      binary_code: "興味深い/退屈",
      concern: "創造性・美的判断・形式の革新",
      provider: "ollama",
      model: "gemma4:12b",
      is_meta: false,
      system_prompt:
        "あなたは芸術システムである。\n世界を二値コード「興味深い/退屈」で解釈し、\n創造性・美的判断・形式の革新に関心を持つ。\n入力されたメッセージをこのコードの視点からのみ解釈し、\n芸術システムとしての発言を生成せよ。\n",
      avatar_hue: null,
      avatar_glyph: null,
    },
    {
      name: "メディアシステム",
      binary_code: "伝達/非伝達",
      concern: "注目・拡散・ニュース価値・世論形成",
      provider: "gemini",
      model: "gemini-2.5-flash",
      is_meta: false,
      system_prompt:
        "あなたはマスメディアシステムである。\n世界を二値コード「伝達/非伝達」で解釈し、\n注目・拡散・ニュース価値・世論形成に関心を持つ。\n入力されたメッセージをこのコードの視点からのみ解釈し、\nマスメディアシステムとしての発言を生成せよ。\n",
      avatar_hue: null,
      avatar_glyph: null,
    },
  ];
}

describe("serializeAgentsYaml", () => {
  it("produces output equivalent to config/presets/agents-5.yaml", () => {
    const out = serializeAgentsYaml(buildSpec());
    expect(out).toBe(agents5Yaml);
  });

  it("emits avatar_hue and avatar_glyph when set", () => {
    const specs = buildSpec();
    specs[0].avatar_hue = 120;
    specs[0].avatar_glyph = "¥";
    const out = serializeAgentsYaml(specs);
    expect(out).toContain("avatar_hue: 120");
    expect(out).toContain("avatar_glyph: ¥");
  });

  it("emits is_meta true for meta agents", () => {
    const specs = buildSpec().slice(0, 1);
    specs[0].is_meta = true;
    const out = serializeAgentsYaml(specs);
    expect(out).toContain("is_meta: true");
  });

  it("quotes name containing colon", () => {
    const specs = buildSpec().slice(0, 1);
    specs[0].name = "test: agent";
    const out = serializeAgentsYaml(specs);
    expect(out).toContain("'test: agent'");
  });
});