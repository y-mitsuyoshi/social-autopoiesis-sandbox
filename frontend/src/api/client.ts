import type { Message, SimulationStartResponse } from "../types";

export interface StartSimulationParams {
  trigger_message: string;
  max_turns: number;
  agents_config?: string;
  agent_order_mode?: "fixed" | "dynamic";
  history_length?: number;
}

export async function startSimulation(
  params: StartSimulationParams,
): Promise<SimulationStartResponse> {
  const resp = await fetch("/api/simulations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!resp.ok) {
    throw new Error(`start_simulation failed: ${resp.status}`);
  }
  return (await resp.json()) as SimulationStartResponse;
}

export function openSimulationSocket(
  simulationId: string,
  onMessage: (m: Message) => void,
  onEvent: (e: { event: string; error?: string | null }) => void,
  onOpen?: () => void,
  onClose?: () => void,
): WebSocket {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${window.location.host}/ws/simulations/${simulationId}`;
  const ws = new WebSocket(url);
  ws.onopen = () => {
    onOpen?.();
  };
  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data as string) as Message & {
      event?: string;
      error?: string | null;
    };
    if (data.event) {
      onEvent({ event: data.event, error: data.error });
    } else {
      const { event: _event, error: _error, ...rest } = data;
      void _event;
      void _error;
      onMessage(rest);
    }
  };
  ws.onclose = () => {
    onClose?.();
  };
  return ws;
}