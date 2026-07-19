import { memo, useCallback, useMemo } from "react";
import type { AgentNode, Message } from "../types";
import { hashHue } from "../lib/avatar";

export interface SpeakCountChartProps {
  messages: Message[];
  agents: Record<string, AgentNode>;
  maxTurns: number;
}

const CHART_W = 600;
const CHART_H = 200;
const PAD_L = 30;
const PAD_B = 20;
const PAD_T = 10;
const PAD_R = 100;

function SpeakCountChartBase({
  messages,
  agents,
  maxTurns,
}: SpeakCountChartProps) {
  const agentNames = useMemo(() => Object.keys(agents), [agents]);

  const series = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const name of agentNames) counts[name] = 0;
    const perTurn: Record<string, number[]> = {};
    for (const name of agentNames) perTurn[name] = [0];
    const turnSet: number[] = [0];
    for (const m of messages) {
      counts[m.agent_name] = (counts[m.agent_name] ?? 0) + 1;
      turnSet.push(m.turn + 1);
      for (const name of agentNames) {
        perTurn[name].push(counts[name] ?? 0);
      }
    }
    return { counts, perTurn, turnSet };
  }, [messages, agentNames]);

  const xMax = useMemo(() => {
    if (maxTurns > 0) return maxTurns;
    return Math.max(1, series.turnSet[series.turnSet.length - 1] ?? 1);
  }, [maxTurns, series]);

  const yMax = useMemo(() => {
    let m = 1;
    for (const name of agentNames) {
      const arr = series.perTurn[name] ?? [0];
      for (const v of arr) if (v > m) m = v;
    }
    return m;
  }, [series, agentNames]);

  const xScale = useCallback(
    (turn: number) => PAD_L + (turn / xMax) * (CHART_W - PAD_L - PAD_R),
    [xMax],
  );
  const yScale = useCallback(
    (count: number) =>
      CHART_H - PAD_B - (count / yMax) * (CHART_H - PAD_T - PAD_B),
    [yMax],
  );

  const lines = useMemo(() => {
    const result: { name: string; hue: number; points: string }[] = [];
    for (const name of agentNames) {
      const arr = series.perTurn[name] ?? [0];
      const pts = arr
        .map((v, i) => {
          const turn = series.turnSet[i] ?? 0;
          return `${xScale(turn).toFixed(2)},${yScale(v).toFixed(2)}`;
        })
        .join(" ");
      const hue = agents[name]?.avatarHue ?? hashHue(agents[name]?.binaryCode ?? name);
      result.push({ name, hue, points: pts });
    }
    return result;
  }, [agentNames, series, agents, xScale, yScale]);

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="h-full w-full"
      role="img"
      aria-label="speak-count-chart"
      data-testid="speak-count-chart"
    >
      <line
        x1={PAD_L}
        y1={CHART_H - PAD_B}
        x2={CHART_W - PAD_R}
        y2={CHART_H - PAD_B}
        stroke="#00f0ff"
        strokeWidth="0.6"
        opacity="0.5"
      />
      <line
        x1={PAD_L}
        y1={PAD_T}
        x2={PAD_L}
        y2={CHART_H - PAD_B}
        stroke="#00f0ff"
        strokeWidth="0.6"
        opacity="0.5"
      />
      <text x={4} y={CHART_H - PAD_B} fontSize="9" fill="#7ab8c8">
        0
      </text>
      <text x={4} y={PAD_T + 8} fontSize="9" fill="#7ab8c8">
        {yMax}
      </text>
      <text x={xScale(xMax) - 12} y={CHART_H - PAD_B + 12} fontSize="9" fill="#7ab8c8">
        {xMax}
      </text>
      {lines.map((l) => (
        <polyline
          key={l.name}
          points={l.points}
          fill="none"
          stroke={`hsl(${l.hue}, 80%, 60%)`}
          strokeWidth="1.6"
          data-testid={`line-${l.name}`}
        />
      ))}
      {lines.map((l, i) => (
        <g key={`legend-${l.name}`} transform={`translate(${CHART_W - PAD_R + 6}, ${PAD_T + i * 12})`}>
          <rect width={8} height={8} fill={`hsl(${l.hue}, 80%, 60%)`} />
          <text x={12} y={7} fontSize="9" fill="#c2f1ff">
            {l.name.length > 8 ? l.name.slice(0, 7) + "…" : l.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export const SpeakCountChart = memo(SpeakCountChartBase);