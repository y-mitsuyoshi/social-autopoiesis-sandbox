import { useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { TimelineList } from "./components/TimelineList";
import { NetworkGraph, buildEdges } from "./components/NetworkGraph";
import { RoundtableStage } from "./components/RoundtableStage";
import { SocietyPanel } from "./components/SocietyPanel";
import { StatsPanel } from "./components/StatsPanel";
import { GlitchText } from "./components/GlitchText";
import { AgentEditor, type AgentEditorSubmitParams } from "./components/AgentEditor";
import { SpeakCountChart } from "./components/SpeakCountChart";
import { BinaryCodeGauge } from "./components/BinaryCodeGauge";
import { EducationalPanel } from "./components/EducationalPanel";
import { LuhmannTeacherPanel } from "./components/LuhmannTeacherPanel";
import { AvatarDetailModal } from "./components/AvatarDetailModal";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { AutopoiesisGraphPanel } from "./components/AutopoiesisGraphPanel";
import { RealtimeCyberMetrics } from "./components/RealtimeCyberMetrics";
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
  AvatarTheme,
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
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [eli5Mode, setEli5Mode] = useState(true);
  const [avatarTheme, setAvatarTheme] = useState<AvatarTheme>("cyberpunk");
  const [selectedAvatarModal, setSelectedAvatarModal] = useState<AgentNode | null>(null);
  const [networkViewMode, setNetworkViewMode] = useState<NetworkViewMode>("roundtable");
  const [centerGraphTab, setCenterGraphTab] = useState<"metrics" | "speak">("metrics");

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
      let wsOpened = false;
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
        () => {
          wsOpened = true;
        },
        () => {
          if (statusRef.current === "running") {
            setStatus("completed");
          }
        },
        () => {
          if (!wsOpened && statusRef.current === "running") {
            setStatus("failed");
            setError("WebSocket接続に失敗しました。バックエンドが起動しているか確認してください。");
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
      <div className="relative min-h-screen p-3 bg-slate-950 text-slate-100 font-sans">
        {/* Header Bar */}
        <header className="mb-4 flex flex-col border-b border-slate-800 pb-3 sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col">
            <div className="text-xs font-bold tracking-[0.2em] text-amber-400">
              SOCIAL AUTOPOIESIS SIMULATOR // ルーマン社会システム実験室
            </div>
            <GlitchText
              as="h1"
              text="AUTOPOIESIS HUMAN AVATAR DASHBOARD"
              className="text-base font-extrabold tracking-[0.1em] text-indigo-400 sm:text-lg"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Avatar Theme Switcher (Cyberpunk / Human / Animal) */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setAvatarTheme("cyberpunk")}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  avatarTheme === "cyberpunk"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🦾 攻殻サイバー風
              </button>
              <button
                type="button"
                onClick={() => setAvatarTheme("animal")}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  avatarTheme === "animal"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🐶 アニマル犬/AI
              </button>
              <button
                type="button"
                onClick={() => setAvatarTheme("human")}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  avatarTheme === "human"
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                👨‍💼 人間プロ
              </button>
            </div>

            {/* ELI5 Beginner Mode Switch */}
            <button
              type="button"
              onClick={() => setEli5Mode((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-all flex items-center gap-1.5 shadow-md ${
                eli5Mode
                  ? "bg-amber-500/20 border-amber-400 text-amber-300 hover:bg-amber-500/30"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>💡</span>
              <span>初心者解説: {eli5Mode ? "ON" : "OFF"}</span>
            </button>

            {/* Teacher Luhmann Live Guide */}
            <button
              type="button"
              onClick={() => setTeacherOpen(true)}
              className="px-3 py-1.5 rounded-lg font-bold bg-purple-950/80 border border-purple-500/50 text-purple-200 hover:bg-purple-900/90 transition-all flex items-center gap-1.5 shadow-md"
            >
              <span>🎓</span>
              <span>ルマン先生ガイド</span>
            </button>

            {/* Theory Index Guide Button */}
            <button
              type="button"
              onClick={() => setEduOpen(true)}
              className="px-3 py-1.5 rounded-lg font-bold bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 hover:bg-indigo-900/90 transition-all font-mono"
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
              className="flex items-center justify-center border border-emerald-500/50 bg-emerald-950/30 p-3 rounded-xl font-mono text-center font-bold tracking-[0.15em] text-emerald-400 animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              data-testid="autopoiesis-status"
            >
              ✨ AUTOPOIESIS PROVEN // 自己再生作動成立（会話が自律増殖中）
            </div>
          ) : (
            <div
              className="flex items-center justify-center border border-amber-500/40 bg-amber-950/20 p-3 rounded-xl font-mono text-center font-bold tracking-[0.05em] text-amber-400"
              data-testid="autopoiesis-status"
            >
              ⏳ UNPROVEN / OPERATIONAL CLOSURE INCOMPLETE （作動的閉鎖 蓄積中）
            </div>
          )}
        </div>

        {error && (
          <div
            className="mb-3 border border-rose-500/50 bg-rose-950/30 p-3 rounded-xl text-xs text-rose-300"
            role="alert"
          >
            <GlitchText as="span" text="ERROR" /> : {error}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[320px_1fr_360px]">
          {/* Left Panel: Editor & Society Metrics */}
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

          {/* Center Stage: Roundtable / Network View & Speak Chart / Cyber Metrics & Timeline */}
          <main className="flex min-h-0 flex-col gap-3">
            <section
              className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800"
              style={{ minHeight: 480 }}
              aria-label="network"
            >
              {networkViewMode === "roundtable" ? (
                <RoundtableStage
                  agents={agentsWithState}
                  messages={messages}
                  currentSpeaker={currentSpeaker}
                  nextSpeaker={nextSpeaker}
                  eli5Mode={eli5Mode}
                  onSelectAgent={(agent) => setSelectedAvatarModal(agent)}
                />
              ) : (
                <NetworkGraph
                  agents={agentsWithState}
                  edges={edges}
                  currentSpeaker={currentSpeaker}
                  nextSpeaker={nextSpeaker}
                  messages={messages}
                  viewMode={networkViewMode}
                  onViewModeChange={setNetworkViewMode}
                />
              )}

              {/* View Mode Switcher Header Bar inside Center Panel */}
              <div className="absolute top-3 left-3 z-30 flex items-center gap-1 bg-slate-950/80 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-lg">
                <button
                  type="button"
                  onClick={() => setNetworkViewMode("roundtable")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    networkViewMode === "roundtable"
                      ? "bg-amber-500 text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🗣️ アバター対話
                </button>
                <button
                  type="button"
                  onClick={() => setNetworkViewMode("network")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    networkViewMode === "network"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🕸️ ネットワーク相関
                </button>
                <button
                  type="button"
                  onClick={() => setNetworkViewMode("debate")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    networkViewMode === "debate"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ⚔️ 討論フロー
                </button>
              </div>

              {currentSpeaker && agents[currentSpeaker] && messages.length > 0 && (
                <div className="absolute bottom-3 left-3 w-56 z-20 pointer-events-auto" data-testid="app-binary-gauge-container">
                  <BinaryCodeGauge
                    binaryCode={agents[currentSpeaker].binaryCode}
                    messageText={messages[messages.length - 1].message}
                  />
                </div>
              )}
            </section>

            {/* Real-time Cyber Metrics & Speak Count Toggle Section */}
            <section
              className="hud-panel rounded-2xl p-3 bg-slate-900 border border-slate-800"
              aria-label="speak-count-chart"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setCenterGraphTab("metrics")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      centerGraphTab === "metrics"
                        ? "bg-cyan-500 text-slate-950 shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ✨ リアルタイム・サイバーメトリクス (波形/極性/熱分布)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCenterGraphTab("speak")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      centerGraphTab === "speak"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    📊 発言回数分布 (SPEAK COUNT)
                  </button>
                </div>
              </div>

              {centerGraphTab === "metrics" ? (
                <RealtimeCyberMetrics
                  messages={messages}
                  agents={agentsWithState}
                  currentSpeaker={currentSpeaker}
                />
              ) : (
                <div style={{ height: 180 }}>
                  <SpeakCountChart
                    messages={messages}
                    agents={agentsWithState}
                    maxTurns={maxTurns}
                  />
                </div>
              )}
            </section>

            <section
              className="hud-panel flex min-h-0 flex-1 flex-col rounded-2xl p-3 bg-slate-900 border border-slate-800"
              style={{ height: 380 }}
              aria-label="timeline"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-bold text-indigo-300 tracking-wide flex items-center gap-1.5">
                  <span>💬 対話タイムライン (TIMELINE)</span>
                  {eli5Mode && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300">
                      かみくだく解説付き
                    </span>
                  )}
                </h2>
                <div className="flex gap-1 text-xs">
                  {(["S", "M", "L"] as const).map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setTimelineZoom(z)}
                      className={
                        timelineZoom === z
                          ? "border border-amber-400 bg-amber-400/20 px-2 py-0.5 text-amber-300 font-bold rounded"
                          : "border border-slate-800 px-2 py-0.5 text-slate-400 hover:text-slate-200 rounded"
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

          {/* Right Panel: Autopoiesis Graph Analytics & Stats */}
          <aside className="space-y-3">
            <AutopoiesisGraphPanel
              metrics={society}
              messages={messages}
              agents={agentsWithState}
            />
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

      {/* Modals & Panels */}
      <EducationalPanel isOpen={eduOpen} onClose={() => setEduOpen(false)} />
      <LuhmannTeacherPanel
        isOpen={teacherOpen}
        onClose={() => setTeacherOpen(false)}
        lastMessage={messages.length > 0 ? messages[messages.length - 1] : null}
        turnCount={messages.length}
      />
      <AvatarDetailModal
        agent={selectedAvatarModal}
        lastMessage={messages.length > 0 ? messages[messages.length - 1] : null}
        onClose={() => setSelectedAvatarModal(null)}
      />
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
    <section className="hud-panel rounded-2xl p-3 bg-slate-900 border border-slate-800" aria-label="logs-reload">
      <h2 className="mb-2 text-xs font-bold text-indigo-300">📁 過去ログ読み込み (LOGS RELOAD)</h2>
      <div className="flex gap-2">
        <input
          aria-label="simulation-id"
          className="flex-1 border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100 rounded-xl outline-none focus:border-indigo-400"
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
          className="border border-indigo-500 bg-indigo-600/30 px-3 py-1 text-xs font-bold text-indigo-200 rounded-xl hover:bg-indigo-600/50 disabled:opacity-40 transition-colors"
        >
          LOAD
        </button>
      </div>
    </section>
  );
}