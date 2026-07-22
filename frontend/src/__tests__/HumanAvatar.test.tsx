import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HumanAvatar } from "../components/HumanAvatar";
import { getHumanPersona } from "../data/humanPersonas";
import { translateLuhmannTerm, getEli5MessageSummary } from "../lib/eli5Translator";

describe("Human Avatar & ELI5 Translator Tests", () => {
  it("retrieves realistic persona for Legal System", () => {
    const persona = getHumanPersona("法システム", "合法/違法", "human");
    expect(persona.realName).toContain("神楽坂 律");
    expect(persona.roleTitle).toContain("弁護士");
  });

  it("retrieves cyberpunk persona for Legal System by default", () => {
    const persona = getHumanPersona("法システム", "合法/違法");
    expect(persona.realName).toContain("草薙 零");
    expect(persona.roleTitle).toContain("公安義体捜査官");
  });

  it("renders HumanAvatar with name and role title", () => {
    render(
      <HumanAvatar
        agentName="法システム"
        binaryCode="合法/違法"
        state="speaking"
        theme="human"
        size="lg"
      />
    );
    expect(screen.getByText(/神楽坂 律/)).toBeInTheDocument();
    expect(screen.getByText(/弁護士/)).toBeInTheDocument();
    expect(screen.getByText("発言中 🎙️")).toBeInTheDocument();
  });

  it("handles avatar click events", () => {
    const handleClick = vi.fn();
    render(
      <HumanAvatar
        agentName="経済システム"
        binaryCode="支払/非支払"
        theme="human"
        onClick={handleClick}
      />
    );
    const container = screen.getByText(/財前 晃/).closest("div");
    if (container) {
      fireEvent.click(container);
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });

  it("translates Luhmann technical terms into plain Japanese", () => {
    const term = translateLuhmannTerm("二元コード");
    expect(term.plainTitle).toBe("【判断のものさし】");
    expect(term.simpleAnalogy).toContain("〇〇か✕か");
  });

  it("generates ELI5 1-sentence message summary", () => {
    const msg = {
      timestamp: "2026-07-22T00:00:00Z",
      turn: 1,
      agent_name: "経済システム",
      agent_code: "支払/非支払",
      message: "このプロジェクトの投資予算と費用対効果を厳密に計算します。",
      provider: "ollama",
      model: "m1",
    };
    const summary = getEli5MessageSummary(msg);
    expect(summary).toContain("費用対効果");
  });
});
