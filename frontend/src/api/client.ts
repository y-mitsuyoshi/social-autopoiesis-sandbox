import type { Message, SimulationStartResponse, StartSimulationParams } from "../types";

export type { StartSimulationParams };

export async function startSimulation(
  params: StartSimulationParams,
): Promise<SimulationStartResponse> {
  const resp = await fetch("/api/simulations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!resp.ok) {
    let errorDetail = "";
    try {
      const errData = await resp.json();
      if (errData && errData.detail) {
        if (typeof errData.detail === "string") {
          errorDetail = errData.detail;
        } else if (Array.isArray(errData.detail)) {
          errorDetail = errData.detail
            .map((d: unknown) => {
              if (d && typeof d === "object" && "msg" in d) {
                return String((d as Record<string, unknown>).msg);
              }
              return JSON.stringify(d);
            })
            .join(", ");
        } else {
          errorDetail = JSON.stringify(errData.detail);
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(
      errorDetail
        ? `start_simulation failed: ${resp.status} (${errorDetail})`
        : `start_simulation failed: ${resp.status}`
    );
  }
  return (await resp.json()) as SimulationStartResponse;
}

export async function fetchSimulationLogs(
  simulationId: string,
): Promise<Message[]> {
  const resp = await fetch(
    `/api/simulations/${encodeURIComponent(simulationId)}/logs`,
  );
  if (!resp.ok) {
    let errorDetail = "";
    try {
      const errData = await resp.json();
      if (errData && errData.detail) {
        errorDetail = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(
      errorDetail
        ? `fetch_logs failed: ${resp.status} (${errorDetail})`
        : `fetch_logs failed: ${resp.status}`
    );
  }
  return (await resp.json()) as Message[];
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