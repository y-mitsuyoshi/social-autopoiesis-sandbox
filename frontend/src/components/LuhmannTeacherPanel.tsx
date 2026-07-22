import React, { useState } from "react";
import { HumanAvatar } from "./HumanAvatar";
import { LUHMANN_DICTIONARY, getEli5MessageSummary } from "../lib/eli5Translator";
import type { Message } from "../types";

interface LuhmannTeacherPanelProps {
  lastMessage?: Message | null;
  turnCount: number;
  isOpen: boolean;
  onClose: () => void;
}

export const LuhmannTeacherPanel: React.FC<LuhmannTeacherPanelProps> = ({
  lastMessage,
  turnCount,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"live" | "concepts" | "faq">("live");

  if (!isOpen) return null;

  const currentSummary = lastMessage ? getEli5MessageSummary(lastMessage) : null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900/95 border-l border-slate-700 shadow-2xl backdrop-blur-md flex flex-col text-slate-100 animate-slideLeft">
      {/* Panel Header */}
      <div className="p-4 bg-gradient-to-r from-purple-900/80 to-indigo-900/80 border-b border-purple-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HumanAvatar
            agentName="ルマン先生"
            binaryCode="オートポイエーシス"
            state="speaking"
            size="md"
            showName={false}
            showRole={false}
          />
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              <span>🎓 ルマン先生のやさしい解説</span>
            </h2>
            <p className="text-xs text-purple-200">
              事前知識ゼロでも分かる社会システム理論ガイド
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-slate-950/40 text-slate-300 hover:text-white hover:bg-slate-950 flex items-center justify-center transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 text-xs">
        <button
          onClick={() => setActiveTab("live")}
          className={`flex-1 py-2.5 font-semibold text-center border-b-2 transition-colors ${
            activeTab === "live"
              ? "border-purple-400 text-purple-300 bg-purple-950/30"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🎙️ リアルタイム実況
        </button>
        <button
          onClick={() => setActiveTab("concepts")}
          className={`flex-1 py-2.5 font-semibold text-center border-b-2 transition-colors ${
            activeTab === "concepts"
              ? "border-purple-400 text-purple-300 bg-purple-950/30"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          📖 用語かみくだく辞典
        </button>
        <button
          onClick={() => setActiveTab("faq")}
          className={`flex-1 py-2.5 font-semibold text-center border-b-2 transition-colors ${
            activeTab === "faq"
              ? "border-purple-400 text-purple-300 bg-purple-950/30"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          ❓ よくある疑問 (Q&A)
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Tab 1: Live Simulation Commentary */}
        {activeTab === "live" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30">
              <div className="font-bold text-purple-300 text-sm mb-1 flex items-center justify-between">
                <span>ルマン先生の実況メモ (Turn {turnCount})</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900 text-purple-200">
                  LIVE
                </span>
              </div>
              <p className="text-slate-200 leading-relaxed">
                {lastMessage
                  ? `いま、【${lastMessage.agent_name}】が議論に参加しました！各自が他人の発言を自分の「専門の物差し（二元コード）」に変換して次の言葉を生み出しています。`
                  : "シミュレーションを開始すると、ここにルマン先生のリアルタイム実況が表示されます。"}
              </p>
            </div>

            {currentSummary && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-100">
                <div className="font-bold text-amber-300 text-xs mb-1">
                  💡 今のやり取りを１行で言うと？
                </div>
                <p className="text-xs font-medium leading-relaxed">{currentSummary}</p>
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <h3 className="font-bold text-slate-200 text-xs mb-2">
                🌟 なぜこの実験がすごいの？ (3つのポイント)
              </h3>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">1.</span>
                  <span>
                    <strong>人間はおしゃべりしていません:</strong>{" "}
                    発言しているのは「人間個人の感情」ではなく「社会の役割(法・経済・科学)」です。
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">2.</span>
                  <span>
                    <strong>終わりなく言葉が続く:</strong>{" "}
                    ひとつの言葉が次の言葉の「刺激」となり、永久に会話が連鎖（自己再生＝オートポイエーシス）します。
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">3.</span>
                  <span>
                    <strong>自分の物差しでしか見ない:</strong>{" "}
                    法システムはお金の話を聞いても「それは合法か？」としか捉えられません。これが「作動的閉鎖」です。
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Simplified Dictionary */}
        {activeTab === "concepts" && (
          <div className="space-y-3">
            <p className="text-slate-400 text-[11px]">
              難解な社会学の専門用語を日常の身近な例えに言い換えています。
            </p>
            {Object.entries(LUHMANN_DICTIONARY).map(([key, item]) => (
              <div
                key={key}
                className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 hover:border-purple-500/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-purple-300 text-xs">
                    {item.plainTitle}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.original}
                  </span>
                </div>
                <div className="text-[11px] text-amber-300 font-medium mb-1">
                  例え: {item.simpleAnalogy}
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Q&A Accordion */}
        {activeTab === "faq" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <h4 className="font-bold text-purple-300 mb-1">
                Q1. なぜ「人間」ではなく「社会システム」が主役なの？
              </h4>
              <p className="text-slate-300 leading-relaxed">
                ルーマン理論では、社会を作り上げている最小単位は「人間」ではなく「コミュニケーション（会話・情報伝達）」であると考えます。人間が去っても、会社や法律や市場というコミュニケーションは動き続けるからです。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <h4 className="font-bold text-purple-300 mb-1">
                Q2. オートポイエーシスってどういう意味？
              </h4>
              <p className="text-slate-300 leading-relaxed">
                もともと生物学で「細胞が自ら新しい細胞を作って生き続ける仕組み」を指す言葉です。社会システムも同様に、「会話が次の会話を生み出して生き続ける」ため、オートポイエーシスと呼ばれます。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <h4 className="font-bold text-purple-300 mb-1">
                Q3. 画面の「〇/✕」ゲージは何を表しているの？
              </h4>
              <p className="text-slate-300 leading-relaxed">
                各システムが発言した際に「肯定的なコード（合法・真・支払可能など）」と「否定的なコード（違法・偽・支払不能など）」のどちらで評価されたかのバランスを示しています。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 text-center">
        <button
          onClick={onClose}
          className="w-full py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-xl font-bold text-xs transition-colors"
        >
          理解できた！閉じる
        </button>
      </div>
    </div>
  );
};
