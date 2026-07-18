import { useState } from "react";
import type { FormEvent } from "react";

export interface SimulationFormProps {
  onSubmit: (params: {
    trigger_message: string;
    max_turns: number;
  }) => void;
  disabled?: boolean;
}

export function SimulationForm({ onSubmit, disabled }: SimulationFormProps) {
  const [trigger, setTrigger] = useState("");
  const [maxTurns, setMaxTurns] = useState(3);
  const canSubmit = trigger.trim().length > 0 && maxTurns >= 0 && !disabled;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ trigger_message: trigger.trim(), max_turns: maxTurns });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded shadow">
      <div>
        <label htmlFor="trigger" className="block text-sm font-medium text-gray-700">
          お題
        </label>
        <textarea
          id="trigger"
          className="mt-1 block w-full rounded border border-gray-300 p-2"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="お題を入力してください"
          rows={3}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor="max_turns" className="block text-sm font-medium text-gray-700">
          最大ターン数
        </label>
        <input
          id="max_turns"
          type="number"
          min={0}
          className="mt-1 block w-full rounded border border-gray-300 p-2"
          value={maxTurns}
          onChange={(e) => setMaxTurns(Number(e.target.value))}
          disabled={disabled}
        />
      </div>
      <button
        type="submit"
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-300"
        disabled={!canSubmit}
      >
        開始
      </button>
    </form>
  );
}