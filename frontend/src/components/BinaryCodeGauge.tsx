import { useMemo } from "react";

export interface BinaryCodeGaugeProps {
  binaryCode: string; // e.g. "支払/非支払"
  messageText: string;
}

export function analyzeMessageCode(binaryCode: string, messageText: string): number {
  if (!binaryCode || !binaryCode.includes("/")) return 0.5;
  const parts = binaryCode.split("/");
  if (parts.length < 2) return 0.5;
  const [posTerm, negTerm] = parts;
  if (!posTerm || !negTerm) return 0.5;

  const countOccurrences = (str: string, sub: string) => {
    if (!sub) return 0;
    let count = 0;
    let pos = str.indexOf(sub);
    while (pos !== -1) {
      count++;
      pos = str.indexOf(sub, pos + sub.length);
    }
    return count;
  };

  let negCount = countOccurrences(messageText, negTerm);
  let posCount = countOccurrences(messageText, posTerm);

  // Substring conflict handling (e.g. "非支払" contains "支払")
  if (negTerm.includes(posTerm)) {
    posCount = Math.max(0, posCount - negCount);
  } else if (posTerm.includes(negTerm)) {
    // Other way around
    negCount = Math.max(0, negCount - posCount);
  }

  if (posCount === 0 && negCount === 0) {
    return 0.5;
  }
  return posCount / (posCount + negCount);
}

export function BinaryCodeGauge({ binaryCode, messageText }: BinaryCodeGaugeProps) {
  const parts = useMemo(() => {
    if (binaryCode && binaryCode.includes("/")) {
      return binaryCode.split("/");
    }
    return ["+", "-"];
  }, [binaryCode]);

  const [posTerm, negTerm] = parts;

  const score = useMemo(() => {
    return analyzeMessageCode(binaryCode, messageText);
  }, [binaryCode, messageText]);

  // Convert score (0 to 1) to percentage for needle alignment
  const percent = score * 100;

  return (
    <div
      className="hud-panel p-3 rounded bg-cyberpunk-bg border border-cyberpunk-neon/30 text-cyberpunk-text"
      data-testid="binary-code-gauge"
    >
      <div className="flex justify-between text-sm mb-1 font-mono">
        <span className="text-cyberpunk-danger font-bold">{negTerm} (-)</span>
        <span className="text-cyberpunk-neon font-bold">{posTerm} (+)</span>
      </div>
      <div className="relative h-4 w-full bg-cyberpunk-bg border border-cyberpunk-neon/20 rounded overflow-hidden">
        {/* Background track visual */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-950 via-gray-900 to-cyan-950 opacity-40" />
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-cyberpunk-neon/40 transform -translate-x-1/2" />
        
        {/* Gauge Needle Indicator */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-cyberpunk-accent transition-all duration-300 shadow-[0_0_8px_#ff9d00]"
          style={{ left: `calc(${percent}% - 2px)` }}
          data-testid="gauge-needle"
        />
      </div>
      <div className="flex justify-between text-sm text-cyberpunk-text/50 mt-1 font-mono">
        <span>0.0</span>
        <span data-testid="gauge-score-value">SCORE: {score.toFixed(2)}</span>
        <span>1.0</span>
      </div>
    </div>
  );
}
