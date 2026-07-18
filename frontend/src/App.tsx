import { useState } from "react";
import { SimulationForm } from "./components/SimulationForm";
import { MessageList } from "./components/MessageList";
import { openSimulationSocket, startSimulation } from "./api/client";
import type { Message, SimulationStatus } from "./types";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<SimulationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (params: {
    trigger_message: string;
    max_turns: number;
  }) => {
    setMessages([]);
    setError(null);
    setStatus("running");
    try {
      const resp = await startSimulation(params);
      openSimulationSocket(
        resp.simulation_id,
        (m) => {
          setMessages((prev) => [...prev, m]);
        },
        (e) => {
          if (e.event === "completed") {
            setStatus("completed");
          } else if (e.event === "failed") {
            setStatus("failed");
            setError(e.error ?? "シミュレーション失敗");
          }
        },
        undefined,
        () => {
          if (status === "running") {
            setStatus("completed");
          }
        },
      );
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">Luhmann Autopoiesis Simulation</h1>
        <SimulationForm onSubmit={handleSubmit} disabled={status === "running"} />
        <div>
          <div className="text-sm">
            ステータス: <span className="font-mono">{status}</span>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <MessageList messages={messages} />
      </div>
    </div>
  );
}