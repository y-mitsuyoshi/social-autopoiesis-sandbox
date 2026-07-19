import type { AgentNode, SimulationStats, SimulationStatus } from "../types";
import { hashHue } from "../lib/avatar";

export interface StatsPanelProps {
  stats: SimulationStats;
  status: SimulationStatus;
  agents?: Record<string, AgentNode>;
}

export function StatsPanel({ stats, status, agents = {} }: StatsPanelProps) {
  const maxCount = Math.max(1, ...Object.values(stats.perAgentCount));
  const entries = Object.entries(stats.perAgentCount).sort(
    (a, b) => b[1] - a[1],
  );
  return (
    <section className="hud-panel rounded p-3" aria-label="stats-panel">
      <h2 className="mb-2 text-xs text-cyberpunk-neon neon-glow">STATS</h2>
      <dl className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="text-cyberpunk-text/60">TURN</dt>
          <dd className="tabular-nums text-cyberpunk-accent">
            {stats.turn}/{stats.maxTurns}
          </dd>
        </div>
        <div>
          <dt className="text-cyberpunk-text/60">AVG LEN</dt>
          <dd className="tabular-nums text-cyberpunk-accent">
            {stats.averageMessageLength}
          </dd>
        </div>
        <div>
          <dt className="text-cyberpunk-text/60">ELAPSED</dt>
          <dd className="tabular-nums text-cyberpunk-accent">
            {(stats.elapsedMs / 1000).toFixed(1)}s
          </dd>
        </div>
        <div>
          <dt className="text-cyberpunk-text/60">STATUS</dt>
          <dd className="text-cyberpunk-neon">{status}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <h3 className="mb-1 text-[10px] text-cyberpunk-text/60">
          AGENT SPEAK COUNT
        </h3>
        <ul className="space-y-1">
          {entries.map(([name, count]) => {
            const a = agents[name];
            const hue = a?.avatarHue ?? hashHue(a?.binaryCode ?? name);
            return (
              <li key={name} className="flex items-center gap-2">
                <span className="w-24 truncate text-[10px] text-cyberpunk-text/80">
                  {name}
                </span>
                <div className="h-2 flex-1 border border-cyberpunk-neon/30 bg-cyberpunk-bg">
                  <div
                    className="h-full"
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      backgroundColor: `hsl(${hue}, 80%, 60%)`,
                    }}
                  />
                </div>
                <span className="w-6 text-right text-[10px] tabular-nums text-cyberpunk-accent">
                  {count}
                </span>
              </li>
            );
          })}
          {entries.length === 0 && (
            <li className="text-[10px] text-cyberpunk-text/40">no data</li>
          )}
        </ul>
      </div>
      <div className="mt-3">
        <h3 className="mb-1 text-[10px] text-cyberpunk-text/60">PROVIDERS</h3>
        <ul className="space-y-0.5 text-[10px] text-cyberpunk-text/80">
          {stats.providers.map((p) => (
            <li key={`${p.provider}/${p.model}`}>
              {p.provider}/{p.model}
            </li>
          ))}
          {stats.providers.length === 0 && (
            <li className="text-cyberpunk-text/40">no data</li>
          )}
        </ul>
      </div>
    </section>
  );
}