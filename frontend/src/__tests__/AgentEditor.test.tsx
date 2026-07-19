import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentEditor } from "../components/AgentEditor";
import { PRESETS } from "../data/presets";
import type { AgentSpecInput } from "../types";

function makeSpec(name: string, isMeta = false): AgentSpecInput {
  return {
    name,
    binary_code: "c",
    concern: "concern",
    system_prompt: "prompt",
    provider: "ollama",
    model: "model",
    is_meta: isMeta,
    avatar_hue: null,
    avatar_glyph: null,
  };
}

describe("AgentEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads default preset when specs empty", () => {
    const onChange = vi.fn();
    render(
      <AgentEditor
        specs={[]}
        onSpecsChange={onChange}
        onSubmit={vi.fn()}
        presetName="agents-3"
      />,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    const loaded = onChange.mock.calls[0][0] as AgentSpecInput[];
    expect(loaded.length).toBe(PRESETS["agents-3"].length);
  });

  it("adds a new empty agent", () => {
    const specs = [makeSpec("A")];
    const onChange = vi.fn();
    render(
      <AgentEditor specs={specs} onSpecsChange={onChange} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText("add-agent"));
    expect(onChange).toHaveBeenCalledWith([...specs, expect.objectContaining({ name: "" })]);
  });

  it("removes an agent", () => {
    const specs = [makeSpec("A"), makeSpec("B")];
    const onChange = vi.fn();
    render(
      <AgentEditor specs={specs} onSpecsChange={onChange} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText("remove-0"));
    expect(onChange).toHaveBeenCalledWith([specs[1]]);
  });

  it("duplicates an agent", () => {
    const specs = [makeSpec("A")];
    const onChange = vi.fn();
    render(
      <AgentEditor specs={specs} onSpecsChange={onChange} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText("duplicate-0"));
    const result = onChange.mock.calls[0][0] as AgentSpecInput[];
    expect(result.length).toBe(2);
    expect(result[1].name).toBe("A-copy");
  });

  it("disables START when validation error present (empty name)", () => {
    const specs = [makeSpec("")];
    render(
      <AgentEditor specs={specs} onSpecsChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("editor-trigger"), {
      target: { value: "お題" },
    });
    expect(screen.getByLabelText("start")).toBeDisabled();
  });

  it("disables START when dynamic mode without is_meta", () => {
    const specs = [makeSpec("A")];
    render(
      <AgentEditor specs={specs} onSpecsChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("editor-trigger"), {
      target: { value: "お題" },
    });
    fireEvent.click(screen.getByLabelText("dynamic"));
    expect(screen.getByLabelText("start")).toBeDisabled();
  });

  it("enables START when valid", () => {
    const specs = [makeSpec("A")];
    render(
      <AgentEditor specs={specs} onSpecsChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("editor-trigger"), {
      target: { value: "お題" },
    });
    expect(screen.getByLabelText("start")).not.toBeDisabled();
  });

  it("calls onSubmit with agents_inline", () => {
    const specs = [makeSpec("A")];
    const onSubmit = vi.fn();
    render(
      <AgentEditor specs={specs} onSpecsChange={vi.fn()} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByLabelText("editor-trigger"), {
      target: { value: "お題" },
    });
    fireEvent.change(screen.getByLabelText("editor-max-turns"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByLabelText("start"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const params = onSubmit.mock.calls[0][0];
    expect(params.trigger_message).toBe("お題");
    expect(params.max_turns).toBe(5);
    expect(params.agents_inline.length).toBe(1);
    expect(params.agents_inline[0].name).toBe("A");
  });

  it("download YAML triggers blob creation", () => {
    const specs = [makeSpec("A")];
    const createURLSpy = vi.fn(() => "blob://url");
    const revokeSpy = vi.fn();
    const originalURL = globalThis.URL;
    Object.defineProperty(globalThis, "URL", {
      value: { createObjectURL: createURLSpy, revokeObjectURL: revokeSpy },
      writable: true,
      configurable: true,
    });
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn((tag: string) => {
      const el = originalCreateElement.call(document, tag);
      el.click = vi.fn();
      return el;
    }) as typeof document.createElement;

    render(
      <AgentEditor specs={specs} onSpecsChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText("download-yaml"));
    expect(createURLSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();
    document.createElement = originalCreateElement;
    Object.defineProperty(globalThis, "URL", {
      value: originalURL,
      writable: true,
      configurable: true,
    });
  });

  it("confirms before discarding dirty edits on preset load", () => {
    const specs = [makeSpec("A")];
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onChange = vi.fn();
    render(
      <AgentEditor
        specs={specs}
        onSpecsChange={onChange}
        onSubmit={vi.fn()}
        presetName="agents-3"
      />,
    );
    const nameInput = screen.getByLabelText("name-0");
    fireEvent.change(nameInput, { target: { value: "EditedName" } });
    fireEvent.click(screen.getByLabelText("preset-load"));
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});