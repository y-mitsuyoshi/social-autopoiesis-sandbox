import { motion } from "framer-motion";
import type { SimulationStatus, SocietyMetrics } from "../types";

export interface SocietyPanelProps {
  metrics: SocietyMetrics;
  status: SimulationStatus;
  maxTurns: number;
  elapsedMs: number;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function SocietyPanel({
  metrics,
  status,
  maxTurns,
  elapsedMs,
}: SocietyPanelProps) {
  const messageRatio = maxTurns > 0 ? metrics.messageCount / maxTurns : 0;
  const bars = [
    { label: "発言数", value: Math.min(1, messageRatio), raw: `${metrics.messageCount}/${maxTurns}` },
    { label: "エッジ密度", value: metrics.edgeDensity, raw: `${metrics.edgeCount}` },
    { label: "活性度", value: metrics.activeNodeRatio, raw: `${Math.round(metrics.activeNodeRatio * 100)}%` },
  ];
  return (
    <section className="hud-panel rounded p-3" aria-label="society-panel">
      <h2 className="mb-2 text-xs text-cyberpunk-neon neon-glow">
        SOCIETY STRUCTURE
      </h2>
      <div className="space-y-2">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-0.5 flex justify-between text-[10px] text-cyberpunk-text/80">
              <span>{b.label}</span>
              <span className="tabular-nums text-cyberpunk-accent">{b.raw}</span>
            </div>
            <div className="h-2 w-full border border-cyberpunk-neon/30 bg-cyberpunk-bg">
              <motion.div
                className="h-full bg-cyberpunk-accent"
                initial={false}
                animate={{ width: `${Math.min(100, b.value * 100)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-cyberpunk-text/70">
        <span>ELAPSED</span>
        <span className="tabular-nums text-cyberpunk-neon">
          {formatTime(elapsedMs)}
        </span>
      </div>
      <div className="mt-1 text-[10px] text-cyberpunk-text/60">
        STATUS: <span className="text-cyberpunk-accent">{status}</span>
      </div>
    </section>
  );
}