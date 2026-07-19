import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import type { AgentSpecInput, AgentProvider } from "../types";
import { AgentAvatar } from "./AgentAvatar";
import type { AgentNode } from "../types";

export interface AgentEditorCardProps {
  spec: AgentSpecInput;
  index: number;
  onChange: (spec: AgentSpecInput) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const PROVIDERS: AgentProvider[] = ["ollama", "gemini", "openai", "opencode", "opencode-go"];

function AgentEditorCardBase({
  spec,
  index,
  onChange,
  onDuplicate,
  onRemove,
}: AgentEditorCardProps) {
  const previewAgent = useMemo<AgentNode>(
    () => ({
      name: spec.name || `agent-${index}`,
      binaryCode: spec.binary_code,
      concern: spec.concern,
      provider: spec.provider,
      model: spec.model,
      speakCount: 0,
      state: "idle",
      avatarHue: spec.avatar_hue ?? undefined,
      avatarGlyph: spec.avatar_glyph ?? undefined,
      isMeta: spec.is_meta,
    }),
    [spec, index],
  );

  const hueSwatch =
    spec.avatar_hue !== null
      ? `hsl(${spec.avatar_hue}, 80%, 60%)`
      : "transparent";

  return (
    <div
      className="hud-panel rounded p-3"
      data-testid={`agent-card-${index}`}
      aria-label={`agent-card-${index}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-[10px] text-cyberpunk-neon">#{index + 1}</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            aria-label={`duplicate-${index}`}
            className="border border-cyberpunk-neon/40 px-1.5 py-0.5 text-[9px] text-cyberpunk-neon hover:bg-cyberpunk-neon/20"
          >
            DUPLICATE
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`remove-${index}`}
            className="border border-cyberpunk-danger/60 px-1.5 py-0.5 text-[9px] text-cyberpunk-danger hover:bg-cyberpunk-danger/20"
          >
            REMOVE
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <Field label="NAME">
            <input
              type="text"
              aria-label={`name-${index}`}
              value={spec.name}
              onChange={(e) => onChange({ ...spec, name: e.target.value })}
              className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-[11px] text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
            />
          </Field>
          <Field label="BINARY CODE">
            <input
              type="text"
              aria-label={`binary_code-${index}`}
              value={spec.binary_code}
              onChange={(e) => onChange({ ...spec, binary_code: e.target.value })}
              className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-[11px] text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
            />
          </Field>
          <Field label="CONCERN">
            <input
              type="text"
              aria-label={`concern-${index}`}
              value={spec.concern}
              onChange={(e) => onChange({ ...spec, concern: e.target.value })}
              className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-[11px] text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
            />
          </Field>
          <Field label="SYSTEM PROMPT">
            <textarea
              aria-label={`system_prompt-${index}`}
              value={spec.system_prompt}
              onChange={(e) => onChange({ ...spec, system_prompt: e.target.value })}
              rows={6}
              className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-[11px] text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="PROVIDER">
              <select
                aria-label={`provider-${index}`}
                value={spec.provider}
                onChange={(e) =>
                  onChange({ ...spec, provider: e.target.value as AgentProvider })
                }
                className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-[11px] text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="MODEL">
              <input
                type="text"
                aria-label={`model-${index}`}
                value={spec.model}
                onChange={(e) => onChange({ ...spec, model: e.target.value })}
                className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-[11px] text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
              />
            </Field>
          </div>
          <label className="flex items-center gap-1 text-[10px] text-cyberpunk-text/80">
            <input
              type="checkbox"
              aria-label={`is_meta-${index}`}
              checked={spec.is_meta}
              onChange={(e) => onChange({ ...spec, is_meta: e.target.checked })}
              className="accent-cyberpunk-accent"
            />
            IS_META
          </label>
        </div>

        <div className="flex w-20 flex-col items-center gap-2">
          <AgentAvatar agent={previewAgent} size={64} />
          <div className="w-full space-y-1">
            <div className="flex items-center gap-1">
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 border border-cyberpunk-neon/40"
                style={{ backgroundColor: hueSwatch }}
              />
              <label
                htmlFor={`avatar_hue-${index}`}
                className="text-[9px] text-cyberpunk-text/70"
              >
                HUE
              </label>
            </div>
            <input
              id={`avatar_hue-${index}`}
              type="range"
              min={0}
              max={359}
              aria-label={`avatar_hue-${index}`}
              value={spec.avatar_hue ?? 0}
              onChange={(e) =>
                onChange({ ...spec, avatar_hue: Number(e.target.value) })
              }
              className="w-full accent-cyberpunk-accent"
            />
            <input
              type="number"
              min={0}
              max={359}
              aria-label={`avatar_hue_num-${index}`}
              value={spec.avatar_hue ?? 0}
              onChange={(e) =>
                onChange({ ...spec, avatar_hue: Number(e.target.value) })
              }
              className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-[10px] text-cyberpunk-text outline-none"
            />
            <label
              htmlFor={`avatar_glyph-${index}`}
              className="text-[9px] text-cyberpunk-text/70"
            >
              GLYPH
            </label>
            <input
              id={`avatar_glyph-${index}`}
              type="text"
              maxLength={3}
              aria-label={`avatar_glyph-${index}`}
              value={spec.avatar_glyph ?? ""}
              onChange={(e) => onChange({ ...spec, avatar_glyph: e.target.value })}
              className="w-full border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-1 text-[10px] text-cyberpunk-text outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-0.5 block text-[9px] text-cyberpunk-neon">{label}</span>
      {children}
    </div>
  );
}

export const AgentEditorCard = memo(AgentEditorCardBase);