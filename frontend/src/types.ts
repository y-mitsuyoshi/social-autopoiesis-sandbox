export interface Message {
  timestamp: string;
  turn: number;
  agent_name: string;
  agent_code: string;
  message: string;
  provider: string;
  model: string;
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