import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentSpecInput } from "../types";
import { PRESETS, PRESET_NAMES, type PresetName } from "../data/presets";
import { serializeAgentsYaml } from "../lib/yaml";
import { AgentEditorCard } from "./AgentEditorCard";
import { fetchProviderHealth } from "../api/client";

export interface AgentEditorSubmitParams {
  trigger_message: string;
  max_turns: number;
  agent_order_mode: "fixed" | "dynamic";
  agents_inline: AgentSpecInput[];
}

export interface AgentEditorProps {
  specs: AgentSpecInput[];
  onSpecsChange: (specs: AgentSpecInput[]) => void;
  onSubmit: (params: AgentEditorSubmitParams) => void;
  disabled?: boolean;
  presetName?: string;
  onPresetNameChange?: (name: string) => void;
}

function emptyAgent(): AgentSpecInput {
  return {
    name: "",
    binary_code: "",
    concern: "",
    system_prompt: "",
    provider: "ollama",
    model: "",
    is_meta: false,
    avatar_hue: null,
    avatar_glyph: null,
  };
}

export function AgentEditor({
  specs,
  onSpecsChange,
  onSubmit,
  disabled,
  presetName = "agents-5",
  onPresetNameChange,
}: AgentEditorProps) {
  const [trigger, setTrigger] = useState("");
  const [maxTurns, setMaxTurns] = useState(15);
  const [agentOrderMode, setAgentOrderMode] = useState<"fixed" | "dynamic">("fixed");
  const [dirty, setDirty] = useState(false);
  const [healthStatus, setHealthStatus] = useState<Record<string, { status: string; response?: string; message?: string }> | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (specs.length === 0 && !dirty) {
      const initial = PRESETS[presetName] ?? PRESETS["agents-5"];
      onSpecsChange(initial.map((s) => ({ ...s })));
      setDirty(false);
    }
  }, [specs.length, dirty, presetName, onSpecsChange]);

  const handlePresetSelect = useCallback(
    (name: PresetName) => {
      if (dirtyRef.current) {
        const ok = window.confirm("未保存の編集があります。破棄して読み込みますか？");
        if (!ok) return;
      }
      const next = PRESETS[name] ?? [];
      onSpecsChange(next.map((s) => ({ ...s })));
      onPresetNameChange?.(name);
      setDirty(false);
      if (name.includes("dynamic")) {
        setAgentOrderMode("dynamic");
      }
    },
    [onSpecsChange, onPresetNameChange],
  );

  const handleLoadPreset = useCallback(() => {
    handlePresetSelect(presetName as PresetName);
  }, [handlePresetSelect, presetName]);

  const mutateSpec = useCallback(
    (idx: number, next: AgentSpecInput) => {
      const arr = specs.map((s, i) => (i === idx ? next : s));
      onSpecsChange(arr);
      setDirty(true);
    },
    [specs, onSpecsChange],
  );

  const handleAdd = useCallback(() => {
    onSpecsChange([...specs, emptyAgent()]);
    setDirty(true);
  }, [specs, onSpecsChange]);

  const handleDuplicate = useCallback(
    (idx: number) => {
      const copy: AgentSpecInput = { ...specs[idx], name: `${specs[idx].name}-copy` };
      const arr = [...specs.slice(0, idx + 1), copy, ...specs.slice(idx + 1)];
      onSpecsChange(arr);
      setDirty(true);
    },
    [specs, onSpecsChange],
  );

  const handleRemove = useCallback(
    (idx: number) => {
      const arr = specs.filter((_, i) => i !== idx);
      onSpecsChange(arr);
      setDirty(true);
    },
    [specs, onSpecsChange],
  );

  const validationError = useMemo<string | null>(() => {
    const names = specs.map((s) => s.name.trim());
    for (let i = 0; i < names.length; i += 1) {
      if (names[i] === "") return `エージェント ${i + 1}: name が空です`;
      if (specs[i].model.trim() === "") return `エージェント ${i + 1}: model が空です`;
    }
    const seen = new Set<string>();
    for (const n of names) {
      if (seen.has(n)) return `name 重複: ${n}`;
      seen.add(n);
    }
    if (agentOrderMode === "dynamic") {
      const hasMeta = specs.some((s) => s.is_meta);
      if (!hasMeta) return "dynamic モードには is_meta=true のエージェントが1件以上必要です";
    }
    return null;
  }, [specs, agentOrderMode]);

  const canSubmit =
    !disabled &&
    trigger.trim().length > 0 &&
    maxTurns >= 0 &&
    validationError === null &&
    specs.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      trigger_message: trigger.trim(),
      max_turns: maxTurns,
      agent_order_mode: agentOrderMode,
      agents_inline: specs,
    });
  };

  const handleDownload = () => {
    const yaml = serializeAgentsYaml(specs);
    const blob = new window.Blob([yaml], { type: "text/yaml" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agents-custom.yaml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <section className="hud-panel rounded p-3" aria-label="agent-editor">
      <h2 className="mb-2 text-xs text-cyberpunk-neon neon-glow">AGENT EDITOR</h2>
      <div className="mb-2 flex items-center gap-2">
        <select
          aria-label="preset-select"
          value={presetName}
          onChange={(e) => onPresetNameChange?.(e.target.value)}
          className="flex-1 border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-sm text-cyberpunk-text outline-none"
        >
          {PRESET_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleLoadPreset}
          aria-label="preset-load"
          className="border border-cyberpunk-accent px-2 py-1 text-sm text-cyberpunk-accent hover:bg-cyberpunk-accent/20"
        >
          LOAD
        </button>
      </div>

      <div
        className="mb-2 max-h-[400px] space-y-2 overflow-y-auto pr-1"
        aria-label="agent-list"
      >
        {specs.map((s, i) => (
          <AgentEditorCard
            key={i}
            spec={s}
            index={i}
            onChange={(next) => mutateSpec(i, next)}
            onDuplicate={() => handleDuplicate(i)}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={handleAdd}
        aria-label="add-agent"
        className="mb-2 w-full border border-cyberpunk-neon/40 py-1 text-sm text-cyberpunk-neon hover:bg-cyberpunk-neon/20"
      >
        + ADD AGENT
      </button>

      {validationError && (
        <div className="mb-2 border border-cyberpunk-danger/60 bg-cyberpunk-danger/10 p-1.5 text-sm text-cyberpunk-danger" role="alert">
          {validationError}
        </div>
      )}

      <div className="space-y-2">
        <div>
          <label
            htmlFor="editor-trigger"
            className="mb-0.5 block text-sm text-cyberpunk-neon"
          >
            TRIGGER MESSAGE
          </label>
          <textarea
            id="editor-trigger"
            aria-label="editor-trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            rows={2}
            placeholder="お題"
            className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-sm text-cyberpunk-text outline-none"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label
              htmlFor="editor-max-turns"
              className="mb-0.5 block text-sm text-cyberpunk-neon"
            >
              MAX TURNS
            </label>
            <input
              id="editor-max-turns"
              type="number"
              aria-label="editor-max-turns"
              min={0}
              value={maxTurns}
              onChange={(e) => setMaxTurns(Number(e.target.value))}
              className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-sm text-cyberpunk-text outline-none"
            />
          </div>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm text-cyberpunk-neon">AGENT ORDER MODE</legend>
          <div className="flex gap-3 text-sm">
            {(["fixed", "dynamic"] as const).map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-center gap-1 text-cyberpunk-text/80"
              >
                <input
                  type="radio"
                  name="editor-order-mode"
                  value={m}
                  checked={agentOrderMode === m}
                  onChange={() => setAgentOrderMode(m)}
                  className="accent-cyberpunk-accent"
                />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="start"
            className="flex-1 border border-cyberpunk-neon bg-cyberpunk-neon/20 py-2 text-cyberpunk-neon hover:bg-cyberpunk-neon/40 disabled:opacity-50"
          >
            START
          </button>
          <button
            type="button"
            onClick={handleDownload}
            aria-label="download-yaml"
            disabled={specs.length === 0}
            className="border border-cyberpunk-accent px-2 py-2 text-sm text-cyberpunk-accent hover:bg-cyberpunk-accent/20 disabled:opacity-50"
          >
            DOWNLOAD YAML
          </button>
        </div>

        <div className="mt-3 border-t border-slate-800 pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-cyan-300">🔌 LLM接続診断 (API HEALTH)</span>
            <button
              type="button"
              onClick={async () => {
                setHealthLoading(true);
                try {
                  const res = await fetchProviderHealth();
                  setHealthStatus(res.providers);
                } catch {
                  setHealthStatus({ error: { status: "error", message: "API接続エラー" } });
                } finally {
                  setHealthLoading(false);
                }
              }}
              disabled={healthLoading}
              className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-950 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-900 transition-colors"
            >
              {healthLoading ? "診断中..." : "接続チェック"}
            </button>
          </div>
          {healthStatus && (
            <div className="space-y-1 text-[10px] font-mono bg-slate-950 p-2 rounded border border-slate-800">
              {Object.entries(healthStatus).map(([p, data]) => (
                <div key={p} className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">{p}:</span>
                  {data.status === "ok" ? (
                    <span className="text-emerald-400 font-bold">🟢 OK ({data.response})</span>
                  ) : (
                    <span className="text-amber-400 font-bold">🟡 {data.status}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}