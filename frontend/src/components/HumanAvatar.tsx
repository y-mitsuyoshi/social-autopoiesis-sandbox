import React from "react";
import { getHumanPersona } from "../data/humanPersonas";
import type { AgentState, AvatarTheme } from "../types";

interface HumanAvatarProps {
  agentName: string;
  binaryCode?: string;
  state?: AgentState;
  size?: "sm" | "md" | "lg" | "xl";
  theme?: AvatarTheme;
  showName?: boolean;
  showRole?: boolean;
  showEli5Code?: boolean;
  onClick?: () => void;
  className?: string;
}

export const HumanAvatar: React.FC<HumanAvatarProps> = ({
  agentName,
  binaryCode,
  state = "idle",
  size = "md",
  theme = "cyberpunk",
  showName = true,
  showRole = true,
  showEli5Code = false,
  onClick,
  className = "",
}) => {
  const persona = getHumanPersona(agentName, binaryCode, theme);

  const sizeClasses = {
    sm: "w-10 h-10 text-xs",
    md: "w-14 h-14 text-sm",
    lg: "w-20 h-20 text-base",
    xl: "w-28 h-28 text-lg",
  }[size];

  const renderSvgPortrait = () => {
    switch (persona.avatarSvgType) {
      case "cyborg_officer":
        return (
          /* Major Motoko Kusanagi style Cyborg Officer */
          <svg className="w-full h-full p-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#1e1b4b" opacity="0.6" />
            {/* Cyber Armor Collar */}
            <path d="M22 90 C 22 66, 35 56, 50 56 C 65 56, 78 66, 78 90 Z" fill="#312e81" />
            <path d="M40 56 L50 78 L60 56" fill="#818cf8" />
            {/* Face & Glowing Red Cyber Visor */}
            <circle cx="50" cy="40" r="17" fill="#fed7aa" />
            {/* Dark Purple Short Hair */}
            <path d="M30 36 C 30 18, 70 18, 70 36 C 65 24, 35 24, 30 36 Z" fill="#4c1d95" />
            {/* Glowing Cyber Eye Visor */}
            <rect x="36" y="38" width="28" height="6" rx="3" fill="#ef4444" />
            <circle cx="44" cy="41" r="1.5" fill="#fef08a" />
            <circle cx="56" cy="41" r="1.5" fill="#fef08a" />
            {/* Cyber Neck Connector Nodes */}
            <circle cx="34" cy="54" r="2.5" fill="#38bdf8" />
            <circle cx="66" cy="54" r="2.5" fill="#38bdf8" />
          </svg>
        );

      case "cyber_dog":
        return (
          /* Robotic Police Canine / Batou's Cyber Hound */
          <svg className="w-full h-full p-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#064e3b" opacity="0.6" />
            {/* Cyber Dog Ears */}
            <path d="M28 35 L38 18 L46 32 Z" fill="#047857" />
            <path d="M72 35 L62 18 L54 32 Z" fill="#047857" />
            {/* Head & Cyber Snout */}
            <ellipse cx="50" cy="46" rx="20" ry="18" fill="#10b981" />
            <ellipse cx="50" cy="54" rx="12" ry="9" fill="#065f46" />
            <circle cx="50" cy="50" r="3.5" fill="#022c22" />
            {/* Glowing Blue Optics / Cyber Goggles */}
            <rect x="34" y="38" width="12" height="8" rx="3" fill="#38bdf8" />
            <rect x="54" y="38" width="12" height="8" rx="3" fill="#38bdf8" />
            <line x1="46" y1="42" x2="54" y2="42" stroke="#38bdf8" strokeWidth="2" />
            {/* Cyber Collar with Light */}
            <path d="M34 62 C 34 68, 66 68, 66 62 Z" stroke="#fbbf24" strokeWidth="4" fill="none" />
          </svg>
        );

      case "think_tank":
        return (
          /* Tachikoma Style AI Think-Tank */
          <svg className="w-full h-full p-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#0c4a6e" opacity="0.6" />
            {/* Blue Spherical Body */}
            <circle cx="50" cy="46" r="24" fill="#0284c7" />
            <ellipse cx="50" cy="46" rx="24" ry="14" fill="#38bdf8" opacity="0.4" />
            {/* Big White Center Eye (Tachikoma Sensor) */}
            <circle cx="50" cy="46" r="9" fill="#ffffff" />
            <circle cx="50" cy="46" r="4" fill="#0284c7" />
            {/* Side Sensor Pods */}
            <circle cx="30" cy="46" r="4" fill="#e0f2fe" />
            <circle cx="70" cy="46" r="4" fill="#e0f2fe" />
            {/* Robotic Manipulator Arms */}
            <path d="M30 60 C 25 75, 20 85, 25 90" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M70 60 C 75 75, 80 85, 75 90" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" fill="none" />
          </svg>
        );

      case "cyber_owl":
        return (
          /* Intelligent Cyber Owl AI */
          <svg className="w-full h-full p-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#78350f" opacity="0.6" />
            {/* Owl Ear Tufts */}
            <path d="M26 32 L34 18 L42 35 Z" fill="#d97706" />
            <path d="M74 32 L66 18 L58 35 Z" fill="#d97706" />
            {/* Round Head */}
            <circle cx="50" cy="46" r="22" fill="#b45309" />
            {/* Giant Cyber Lenses */}
            <circle cx="38" cy="44" r="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
            <circle cx="62" cy="44" r="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
            <circle cx="38" cy="44" r="5" fill="#f59e0b" />
            <circle cx="62" cy="44" r="5" fill="#f59e0b" />
            {/* Beak */}
            <polygon points="50,48 45,56 55,56" fill="#fbbf24" />
          </svg>
        );

      case "cyber_fox":
        return (
          /* Cyber Fox Security AI */
          <svg className="w-full h-full p-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#831843" opacity="0.6" />
            {/* Large Pointed Fox Ears */}
            <path d="M22 36 L32 12 L44 32 Z" fill="#db2777" />
            <path d="M78 36 L68 12 L56 32 Z" fill="#db2777" />
            <path d="M28 32 L34 18 L40 30 Z" fill="#fbcfe8" />
            <path d="M72 32 L66 18 L60 30 Z" fill="#fbcfe8" />
            {/* Sleek Fox Head & Nose */}
            <polygon points="50,68 28,40 72,40" fill="#be185d" />
            <circle cx="50" cy="65" r="3" fill="#831843" />
            {/* Glowing Slanted Eyes */}
            <polygon points="34,38 42,42 34,44" fill="#f472b6" />
            <polygon points="66,38 58,42 66,44" fill="#f472b6" />
          </svg>
        );

      case "lawyer":
        return (
          <svg className="w-full h-full p-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#1e1b4b" opacity="0.4" />
            <path d="M25 90 C 25 70, 35 60, 50 60 C 65 60, 75 70, 75 90 Z" fill="#312e81" />
            <path d="M42 60 L50 78 L58 60 L50 64 Z" fill="#e0e7ff" />
            <path d="M48 64 L52 64 L51 75 L49 75 Z" fill="#6366f1" />
            <circle cx="50" cy="42" r="18" fill="#fde047" opacity="0.9" />
            <path d="M32 38 C 32 25, 68 25, 68 38 C 65 30, 35 30, 32 38 Z" fill="#1e293b" />
            <rect x="37" y="38" width="10" height="7" rx="2" stroke="#e0e7ff" strokeWidth="2" fill="none" />
            <rect x="53" y="38" width="10" height="7" rx="2" stroke="#e0e7ff" strokeWidth="2" fill="none" />
            <line x1="47" y1="41" x2="53" y2="41" stroke="#e0e7ff" strokeWidth="2" />
          </svg>
        );

      case "executive":
        return (
          <svg className="w-full h-full p-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#064e3b" opacity="0.4" />
            <path d="M22 90 C 22 68, 35 58, 50 58 C 65 58, 78 68, 78 90 Z" fill="#065f46" />
            <path d="M43 58 L50 75 L57 58 L50 62 Z" fill="#ecfdf5" />
            <path d="M48 62 L52 62 L53 72 L47 72 Z" fill="#10b981" />
            <circle cx="50" cy="40" r="17" fill="#fde047" opacity="0.85" />
            <path d="M33 34 C 33 22, 67 20, 67 34 C 62 26, 38 24, 33 34 Z" fill="#0f172a" />
            <path d="M44 47 Q 50 52 56 47" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        );

      case "scientist":
        return (
          <svg className="w-full h-full p-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#164e63" opacity="0.4" />
            <path d="M24 90 C 24 68, 35 58, 50 58 C 65 58, 76 68, 76 90 Z" fill="#e0f2fe" />
            <path d="M44 58 L50 74 L56 58" fill="#0284c7" />
            <circle cx="50" cy="40" r="17" fill="#fed7aa" />
            <path d="M32 36 C 32 20, 68 20, 68 36 C 60 25, 40 25, 32 36 Z" fill="#334155" />
            <circle cx="42" cy="40" r="6" stroke="#0284c7" strokeWidth="2" fill="none" />
            <circle cx="58" cy="40" r="6" stroke="#0284c7" strokeWidth="2" fill="none" />
            <line x1="48" y1="40" x2="52" y2="40" stroke="#0284c7" strokeWidth="2" />
          </svg>
        );

      default:
        return (
          <svg className="w-full h-full p-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#4c1d95" opacity="0.4" />
            <path d="M24 90 C 24 68, 35 58, 50 58 C 65 58, 76 68, 76 90 Z" fill="#5b21b6" />
            <circle cx="50" cy="40" r="17" fill="#fed7aa" />
            <path d="M31 35 C 31 18, 69 18, 69 35 C 60 24, 40 24, 31 35 Z" fill="#2e1065" />
            <rect x="36" y="38" width="28" height="6" rx="3" fill="#8b5cf6" opacity="0.8" />
          </svg>
        );
    }
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col items-center select-none ${onClick ? "cursor-pointer group" : ""} ${className}`}
    >
      <div className="relative">
        {state === "speaking" && (
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-indigo-500 opacity-60 blur-sm" />
        )}
        {state === "thinking" && (
          <div className="absolute -inset-1.5 rounded-full bg-amber-400 opacity-40 blur-xs" />
        )}

        <div
          className={`relative ${sizeClasses} rounded-full overflow-hidden border-2 transition-all duration-300 shadow-lg bg-gradient-to-br ${persona.avatarGradient} ${
            state === "speaking"
              ? "border-amber-300 scale-105 ring-4 ring-amber-400/50"
              : state === "thinking"
              ? "border-amber-400 opacity-90 ring-2 ring-amber-300/40"
              : "border-slate-700/60 group-hover:border-indigo-400 group-hover:scale-105"
          }`}
          style={{ borderColor: persona.avatarColor }}
        >
          {renderSvgPortrait()}

          {state === "speaking" && (
            <div className="absolute bottom-1 left-0 right-0 flex items-end justify-center space-x-0.5 h-3 px-2 bg-black/40 backdrop-blur-[1px]">
              <span className="w-1 bg-amber-300 rounded-full h-2" />
              <span className="w-1 bg-amber-400 rounded-full h-3" />
              <span className="w-1 bg-amber-200 rounded-full h-2.5" />
              <span className="w-1 bg-amber-400 rounded-full h-1.5" />
            </div>
          )}
        </div>

        {state === "thinking" && (
          <div className="absolute -top-3 -right-2 px-2 py-0.5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full shadow-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
            思考中…
          </div>
        )}

        {state === "speaking" && (
          <div className="absolute -top-3 -right-2 px-2 py-0.5 bg-amber-400 text-slate-950 font-bold text-[10px] rounded-full shadow-md">
            発言中 🎙️
          </div>
        )}
      </div>

      {(showName || showRole) && (
        <div className="mt-1.5 text-center max-w-[120px]">
          {showName && (
            <div className="font-semibold text-slate-100 text-xs truncate group-hover:text-indigo-300 transition-colors">
              {persona.realName}
            </div>
          )}
          {showRole && (
            <div className="text-[10px] text-slate-400 truncate">
              {persona.roleTitle}
            </div>
          )}
          {showEli5Code && (
            <div
              className="mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 text-indigo-300 font-medium truncate"
              title={persona.plainCodeExplanation}
            >
              {persona.positiveMeaning.split(" ")[0]}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
