export interface Message {
  timestamp: string;
  turn: number;
  agent_name: string;
  agent_code: string;
  message: string;
  provider: string;
  model: string;
  concern?: string;
}

export interface SimulationStartResponse {
  simulation_id: string;
  status: "running" | "completed" | "failed";
}

export interface WebSocketMessageEvent extends Message {
  event?: never;
}

export interface WebSocketStatusEvent {
  event: "completed" | "failed" | "not_found";
  error?: string | null;
}

export type WebSocketEvent = WebSocketMessageEvent | WebSocketStatusEvent;

export type SimulationStatus = "idle" | "running" | "completed" | "failed";

export type AgentState = "idle" | "thinking" | "speaking";

export interface AgentNode {
  name: string;
  binaryCode: string;
  concern: string;
  provider: string;
  model: string;
  speakCount: number;
  state: AgentState;
  avatarHue?: number;
  avatarGlyph?: string;
  isMeta?: boolean;
}

export type AgentProvider = "ollama" | "gemini" | "openai" | "opencode" | "opencode-go";

export interface AgentSpecInput {
  name: string;
  binary_code: string;
  concern: string;
  system_prompt: string;
  provider: AgentProvider;
  model: string;
  is_meta: boolean;
  avatar_hue: number | null;
  avatar_glyph: string | null;
}

export interface StartSimulationParams {
  trigger_message: string;
  max_turns: number;
  agents_config?: string;
  agents_inline?: AgentSpecInput[];
  agent_order_mode?: "fixed" | "dynamic";
  history_length?: number;
}

export interface NetworkEdge {
  from: string;
  to: string;
  count: number;
}

export interface SimulationStats {
  turn: number;
  maxTurns: number;
  perAgentCount: Record<string, number>;
  averageMessageLength: number;
  elapsedMs: number;
  providers: { provider: string; model: string }[];
}

export interface SocietyMetrics {
  messageCount: number;
  edgeCount: number;
  edgeDensity: number;
  activeNodeRatio: number;
}