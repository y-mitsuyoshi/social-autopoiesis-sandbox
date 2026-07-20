import { useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { TimelineList } from "./components/TimelineList";
import { NetworkGraph, buildEdges } from "./components/NetworkGraph";
import { SocietyPanel } from "./components/SocietyPanel";
import { StatsPanel } from "./components/StatsPanel";
import { GlitchText } from "./components/GlitchText";
import { AgentEditor, type AgentEditorSubmitParams } from "./components/AgentEditor";
import { SpeakCountChart } from "./components/SpeakCountChart";
import { BinaryCodeGauge } from "./components/BinaryCodeGauge";
import { EducationalPanel } from "./components/EducationalPanel";
import { AnalysisPanel } from "./components/AnalysisPanel";
import {
  fetchSimulationLogs,
  openSimulationSocket,
  startSimulation,
} from "./api/client";
import { computeSociety, computeStats } from "./lib/stats";
import { PRESETS } from "./data/presets";
import type {
  AgentNode,
  AgentSpecInput,
  Message,
  NetworkViewMode,
  SimulationStatus,
} from "./types";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<SimulationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [agentOrder, setAgentOrder] = useState<string[]>([]);
  const [agentOrderMode, setAgentOrderMode] = useState<"fixed" | "dynamic">(
    "fixed",
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [maxTurns, setMaxTurns] = useState<number>(0);
  const [timelineZoom, setTimelineZoom] = useState<"S" | "M" | "L">("M");
  const [agentSpecs, setAgentSpecs] = useState<AgentSpecInput[]>(() =>
    PRESETS["agents-5"].map((s) => ({ ...s })),
  );
  const [presetName, setPresetName] = useState<string>("agents-5");
  const [eduOpen, setEduOpen] = useState(false);
  const [networkViewMode, setNetworkViewMode] = useState<NetworkViewMode>("network");
  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<SimulationStatus>(status);
  statusRef.current = status;

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const specByName = useMemo(() => {
    const m: Record<string, AgentSpecInput> = {};
    for (const s of agentSpecs) m[s.name] = s;
    return m;
  }, [agentSpecs]);

  const agents = useMemo<Record<string, AgentNode>>(() => {
    const map: Record<string, AgentNode> = {};
    for (const s of agentSpecs) {
      map[s.name] = {
        name: s.name,
        binaryCode: s.binary_code,
        concern: s.concern,
        provider: s.provider,
        model: s.model,
        speakCount: 0,
        state: "idle",
        avatarHue: s.avatar_hue ?? undefined,
        avatarGlyph: s.avatar_glyph ?? undefined,
        isMeta: s.is_meta,
      };
    }
    for (const name of agentOrder) {
      if (!map[name]) {
        map[name] = {
          name,
          binaryCode: "",
          concern: "",
          provider: "",
          model: "",
          speakCount: 0,
          state: "idle",
        };
      }
    }
    for (const m of messages) {
      const existing = map[m.agent_name];
      const spec = specByName[m.agent_name];
      const concern =
        (m.concern && m.concern.length > 0
          ? m.concern
          : existing?.concern) || spec?.concern || "";
      map[m.agent_name] = {
        name: m.agent_name,
        binaryCode: m.agent_code || existing?.binaryCode || spec?.binary_code || "",
        concern,
        provider: m.provider || existing?.provider || spec?.provider || "",
        model: m.model || existing?.model || spec?.model || "",
        speakCount: (existing?.speakCount ?? 0) + 1,
        state: "idle",
        avatarHue: spec?.avatar_hue ?? existing?.avatarHue,
        avatarGlyph: spec?.avatar_glyph ?? existing?.avatarGlyph,
        isMeta: spec?.is_meta ?? existing?.isMeta,
      };
    }
    return map;
  }, [messages, agentOrder, agentSpecs, specByName]);

  const edges = useMemo(() => buildEdges(messages), [messages]);

  const currentSpeaker =
    messages.length > 0 ? messages[messages.length - 1].agent_name : null;

  const nextSpeaker = useMemo(() => {
    if (agentOrderMode !== "fixed" || agentOrder.length === 0) return null;
    const lastTurn = messages.length > 0 ? messages[messages.length - 1].turn : -1;
    const nextIdx = (lastTurn + 1) % agentOrder.length;
    return agentOrder[nextIdx] ?? null;
  }, [agentOrderMode, agentOrder, messages]);

  const agentsWithState = useMemo<Record<string, AgentNode>>(() => {
    const result: Record<string, AgentNode> = {};
    for (const [name, a] of Object.entries(agents)) {
      let state: AgentNode["state"] = "idle";
      if (status === "running") {
        if (name === currentSpeaker) {
          state = "speaking";
        } else if (
          agentOrderMode === "fixed" &&
          name === nextSpeaker
        ) {
          state = "thinking";
        } else if (agentOrderMode === "dynamic") {
          state = "thinking";
        }
      }
      result[name] = { ...a, state };
    }
    return result;
  }, [agents, currentSpeaker, nextSpeaker, status, agentOrderMode]);

  const stats = useMemo(
    () => computeStats(messages, maxTurns, startedAt),
    [messages, maxTurns, startedAt],
  );
  const society = useMemo(
    () => computeSociety(agents, edges, agentOrder.length || Object.keys(agents).length, messages),
    [agents, edges, agentOrder, messages],
  );

  const handleSubmit = async (params: AgentEditorSubmitParams) => {
    setMessages([]);
    setError(null);
    setStatus("running");
    setStartedAt(Date.now());
    setMaxTurns(params.max_turns);
    setAgentOrderMode(params.agent_order_mode);
    setAgentOrder(params.agents_inline.map((a) => a.name));
    try {
      const resp = await startSimulation({
        trigger_message: params.trigger_message,
        max_turns: params.max_turns,
        agent_order_mode: params.agent_order_mode,
        agents_inline: params.agents_inline,
      });
      wsRef.current?.close();
      wsRef.current = openSimulationSocket(
        resp.simulation_id,
        (m) => {
          setMessages((prev) => [...prev, m]);
          setAgentOrder((prev) =>
            prev.includes(m.agent_name) ? prev : [...prev, m.agent_name],
          );
        },
        (e) => {
          if (e.event === "completed") {
            setStatus("completed");
          } else if (e.event === "failed") {
            setStatus("failed");
            setError(e.error ?? "シミュレーション失敗");
          } else if (e.event === "not_found") {
            setStatus("failed");
            setError("simulation not found");
          }
        },
        undefined,
        () => {
          if (statusRef.current === "running") {
            setStatus("completed");
          }
        },
      );
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleLoadLogs = async (simulationId: string) => {
    setError(null);
    try {
      const logs = await fetchSimulationLogs(simulationId);
      setMessages(logs);
      setStartedAt(null);
      setStatus("completed");
      const order: string[] = [];
      for (const m of logs) {
        if (!order.includes(m.agent_name)) order.push(m.agent_name);
      }
      setAgentOrder(order);
      if (logs.length > 0) {
        setMaxTurns(Math.max(...logs.map((l) => l.turn)) + 1);
      }
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen p-3 text-cyberpunk-text">
        <header className="mb-4 flex flex-col border-b border-cyberpunk-neon/30 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <div className="text-sm font-bold tracking-[0.25em] text-cyberpunk-accent">
              SECTION 9 SECURITY PROTOCOL // DIRECT NEURAL CONNECTION
            </div>
            <GlitchText
              as="h1"
              text="AUTOPOIESIS CYBERBRAIN SIMULATION"
              className="text-base font-extrabold tracking-[0.15em] text-cyberpunk-neon sm:text-lg"
            />
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm sm:mt-0">
            <span className="flex items-center gap-1.5 border border-cyberpunk-neon/30 bg-cyberpunk-neon/10 px-2 py-0.5 text-cyberpunk-neon">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyberpunk-neon" />
              NET: ACTIVE
            </span>
            <span className="flex items-center gap-1.5 border border-cyberpunk-accent/30 bg-cyberpunk-accent/10 px-2 py-0.5 text-cyberpunk-accent">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-cyberpunk-accent" />
              SIM STATUS: {status.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={() => setEduOpen(true)}
              className="border border-cyberpunk-neon bg-cyberpunk-neon/10 px-2.5 py-1 text-sm text-cyberpunk-neon hover:bg-cyberpunk-neon/20 transition-all font-mono"
              data-testid="theory-guide-btn"
            >
              THEORY GUIDE
            </button>
          </div>
        </header>

        {/* AUTOPOIESIS PROOF STATUS */}
        <div className="mb-4">
          {society.isOperationalClosure ? (
            <div
              className="flex items-center justify-center border border-emerald-500/50 bg-emerald-500/10 p-3 rounded font-mono text-center font-bold tracking-[0.2em] text-emerald-400 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              data-testid="autopoiesis-status"
            >
              AUTOPOIESIS PROVEN
            </div>
          ) : (
            <div
              className="flex items-center justify-center border border-yellow-500/50 bg-yellow-500/10 p-3 rounded font-mono text-center font-bold tracking-[0.1em] text-yellow-500"
              data-testid="autopoiesis-status"
            >
              UNPROVEN / OPERATIONAL CLOSURE INCOMPLETE
            </div>
          )}
        </div>

        {error && (
          <div
            className="mb-3 border border-cyberpunk-danger bg-cyberpunk-danger/10 p-2 text-sm text-cyberpunk-danger"
            role="alert"
          >
            <GlitchText as="span" text="ERROR" /> : {error}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[320px_1fr_360px]">
          <aside className="space-y-3">
            <AgentEditor
              specs={agentSpecs}
              onSpecsChange={setAgentSpecs}
              onSubmit={handleSubmit}
              disabled={status === "running"}
              presetName={presetName}
              onPresetNameChange={setPresetName}
            />
            <SocietyPanel
              metrics={society}
              status={status}
              maxTurns={maxTurns}
              elapsedMs={stats.elapsedMs}
              messages={messages}
              agents={agents}
            />
          </aside>

          <main className="flex min-h-0 flex-col gap-3">
            <section
              className="hud-panel relative rounded p-2"
              style={{ height: 420 }}
              aria-label="network"
            >
              <NetworkGraph
                agents={agentsWithState}
                edges={edges}
                currentSpeaker={currentSpeaker}
                nextSpeaker={nextSpeaker}
                messages={messages}
                viewMode={networkViewMode}
                onViewModeChange={setNetworkViewMode}
              />
              {currentSpeaker && agents[currentSpeaker] && messages.length > 0 && (
                <div className="absolute bottom-2 left-2 w-48 z-10 pointer-events-auto" data-testid="app-binary-gauge-container">
                  <BinaryCodeGauge
                    binaryCode={agents[currentSpeaker].binaryCode}
                    messageText={messages[messages.length - 1].message}
                  />
                </div>
              )}
              {status === "completed" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <GlitchText
                    as="div"
                    text="SIMULATION COMPLETE"
                    className="text-lg tracking-widest text-cyberpunk-accent"
                  />
                </div>
              )}
            </section>
            <section
              className="hud-panel rounded p-2"
              style={{ height: 200 }}
              aria-label="speak-count-chart"
            >
              <h2 className="mb-1 text-xs text-cyberpunk-neon neon-glow">
                SPEAK COUNT
              </h2>
              <div style={{ height: 160 }}>
                <SpeakCountChart
                  messages={messages}
                  agents={agentsWithState}
                  maxTurns={maxTurns}
                />
              </div>
            </section>
            <section
              className="hud-panel flex min-h-0 flex-1 flex-col rounded p-2"
              style={{ height: 360 }}
              aria-label="timeline"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs text-cyberpunk-neon neon-glow">
                  TIMELINE
                </h2>
                <div className="flex gap-1 text-sm">
                  {(["S", "M", "L"] as const).map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setTimelineZoom(z)}
                      className={
                        timelineZoom === z
                          ? "border border-cyberpunk-accent px-1 text-cyberpunk-accent"
                          : "border border-cyberpunk-neon/30 px-1 text-cyberpunk-text/60"
                      }
                    >
                      {z}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <TimelineList
                  messages={messages}
                  agents={agentsWithState}
                  zoom={timelineZoom}
                  currentSpeaker={currentSpeaker}
                />
              </div>
            </section>
          </main>

          <aside className="space-y-3">
            <StatsPanel
              stats={stats}
              status={status}
              agents={agentsWithState}
            />
            <LogsReload onLoadLogs={handleLoadLogs} disabled={status === "running"} />
            <AnalysisPanel
              messages={messages}
              agents={agentsWithState}
              status={status}
            />
          </aside>
        </div>
      </div>
      <EducationalPanel isOpen={eduOpen} onClose={() => setEduOpen(false)} />
    </MotionConfig>
  );
}

function LogsReload({
  onLoadLogs,
  disabled,
}: {
  onLoadLogs: (simulationId: string) => void;
  disabled?: boolean;
}) {
  const [simulationId, setSimulationId] = useState("");
  const canLoad = simulationId.trim().length > 0 && !disabled;
  return (
    <section className="hud-panel rounded p-3" aria-label="logs-reload">
      <h2 className="mb-2 text-xs text-cyberpunk-neon neon-glow">LOGS RELOAD</h2>
      <div className="flex gap-2">
        <input
          aria-label="simulation-id"
          className="flex-1 border border-cyberpunk-neon/40 bg-cyberpunk-bg/80 p-2 text-sm text-cyberpunk-text outline-none focus:border-cyberpunk-accent"
          value={simulationId}
          onChange={(e) => setSimulationId(e.target.value)}
          placeholder="過去シミュレーションID"
          disabled={disabled}
        />
        <button
          type="button"
          aria-label="load-logs"
          disabled={!canLoad}
          onClick={() => onLoadLogs(simulationId.trim())}
          className="border border-cyberpunk-accent px-2 py-1 text-sm text-cyberpunk-accent disabled:opacity-40"
        >
          LOAD
        </button>
      </div>
    </section>
  );
}