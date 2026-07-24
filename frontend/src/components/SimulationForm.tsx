import { useState } from "react";
import type { FormEvent } from "react";
import type { AgentSpecInput } from "../types";

export interface SimulationFormValues {
  trigger_message: string;
  max_turns: number;
  agent_order_mode: "fixed" | "dynamic";
  agents_config?: string;
  agents_inline?: AgentSpecInput[];
  simulation_id?: string;
}

export interface SimulationFormProps {
  onSubmit: (params: SimulationFormValues) => void;
  onLoadLogs?: (simulationId: string) => void;
  disabled?: boolean;
}

export function SimulationForm({
  onSubmit,
  onLoadLogs,
  disabled,
}: SimulationFormProps) {
  const [trigger, setTrigger] = useState("");
  const [maxTurns, setMaxTurns] = useState(15);
  const [agentOrderMode, setAgentOrderMode] = useState<"fixed" | "dynamic">(
    "fixed",
  );
  const [agentsConfig, setAgentsConfig] = useState("");
  const [simulationId, setSimulationId] = useState("");
  const canSubmit = trigger.trim().length > 0 && maxTurns >= 0 && !disabled;
  const canLoad =
    simulationId.trim().length > 0 && !!onLoadLogs && !disabled;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const values: SimulationFormValues = {
      trigger_message: trigger.trim(),
      max_turns: maxTurns,
      agent_order_mode: agentOrderMode,
    };
    if (agentsConfig) {
      values.agents_config = agentsConfig;
    }
    onSubmit(values);
  };

  const handleLoad = (e: FormEvent) => {
    e.preventDefault();
    if (!canLoad || !onLoadLogs) return;
    onLoadLogs(simulationId.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="hud-panel space-y-3 rounded p-3"
      aria-label="simulation-form"
    >
      <div>
        <label
          htmlFor="trigger"
          className="mb-1 block text-sm text-cyberpunk-neon"
        >
          TRIGGER MESSAGE / お題
        </label>
        <textarea
          id="trigger"
          className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-2 text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="お題を入力してください"
          rows={3}
          disabled={disabled}
        />
      </div>
      <div>
        <label
          htmlFor="max_turns"
          className="mb-1 block text-sm text-cyberpunk-neon"
        >
          MAX TURNS / 最大ターン数 (0 で自動収束モード)
        </label>
        <input
          id="max_turns"
          type="number"
          min={0}
          className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-2 text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
          value={maxTurns}
          onChange={(e) => setMaxTurns(Number(e.target.value))}
          disabled={disabled}
        />
        {maxTurns === 0 && (
          <p className="mt-1 text-[11px] text-amber-300">
            ♾️ 自動収束モード: 議論が合意に達した時点で自律終了します
          </p>
        )}
      </div>
      <div>
        <label
          htmlFor="agents_config"
          className="mb-1 block text-sm text-cyberpunk-neon"
        >
          AGENT CONFIG PRESET / エージェント構成プリセット
        </label>
        <select
          id="agents_config"
          className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-2 text-sm text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
          value={agentsConfig}
          onChange={(e) => {
            const val = e.target.value;
            setAgentsConfig(val);
            if (val.includes("dynamic")) {
              setAgentOrderMode("dynamic");
            } else {
              setAgentOrderMode("fixed");
            }
          }}
          disabled={disabled}
        >
          <option value="">Default (config/agents.yaml)</option>
          <option value="config/presets/agents-3.yaml">3 Agents (Fixed)</option>
          <option value="config/presets/agents-3-dynamic.yaml">3 Agents + Moderator (Dynamic)</option>
          <option value="config/presets/agents-5.yaml">5 Agents (Fixed)</option>
          <option value="config/presets/agents-7.yaml">7 Agents (Fixed)</option>
        </select>
      </div>
      <fieldset className="space-y-1" disabled={disabled}>
        <legend className="mb-1 text-sm text-cyberpunk-neon">
          AGENT ORDER MODE
        </legend>
        <div className="flex gap-3 text-sm">
          {(["fixed", "dynamic"] as const).map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-center gap-1 text-cyberpunk-text/80"
            >
              <input
                type="radio"
                name="agent_order_mode"
                value={m}
                checked={agentOrderMode === m}
                onChange={() => {
                  setAgentOrderMode(m);
                  if (m === "dynamic") {
                    if (!agentsConfig.includes("dynamic")) {
                      setAgentsConfig("config/presets/agents-3-dynamic.yaml");
                    }
                  } else {
                    if (agentsConfig.includes("dynamic")) {
                      setAgentsConfig("config/presets/agents-3.yaml");
                    }
                  }
                }}
                className="accent-cyberpunk-accent"
              />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {onLoadLogs && (
        <div className="border-t border-cyberpunk-neon/20 pt-2">
          <label
            htmlFor="simulation_id"
            className="mb-1 block text-sm text-cyberpunk-neon"
          >
            SIMULATION ID (optional / logs reload)
          </label>
          <div className="flex gap-2">
            <input
              id="simulation_id"
              className="flex-1 border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-2 text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
              value={simulationId}
              onChange={(e) => setSimulationId(e.target.value)}
              placeholder="過去シミュレーションID"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={handleLoad}
              disabled={!canLoad}
              className="border border-cyberpunk-accent px-2 py-1 text-sm text-cyberpunk-accent disabled:opacity-40"
            >
              LOAD
            </button>
          </div>
        </div>
      )}
      <button
        type="submit"
        className="w-full border border-cyberpunk-neon bg-cyberpunk-neon/20 py-2 text-cyberpunk-neon transition hover:bg-cyberpunk-neon/40 disabled:opacity-50"
        disabled={!canSubmit}
      >
        START / 開始
      </button>
    </form>
  );
}