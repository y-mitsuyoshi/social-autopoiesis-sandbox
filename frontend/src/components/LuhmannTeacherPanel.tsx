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
                ルーマン社会システム論の最大の革新は、「社会の主役は人間個人ではなくコミュニケーションである」と捉えた点です。人間が交替しても、法律、経済市場、科学研究、政治決定という【会話と意味の連鎖】は社会の中で独立して自律作動し続けるからです。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <h4 className="font-bold text-purple-300 mb-1">
                Q2. オートポイエーシス（自己再生）ってどういう意味？
              </h4>
              <p className="text-slate-300 leading-relaxed">
                元々は生命科学で「細胞が自らの要素（タンパク質など）を自分で作り出して生き続ける」ことを指します。社会システムも同様に、「会話が次の会話を生み出し、システム独自のルールを更新しながら永遠に続き自立する」ため、オートポイエーシス（作動的閉鎖）と呼ばれます。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <h4 className="font-bold text-purple-300 mb-1">
                Q3. 画面の二値コード（合法/違法、支払/非支払）って何？
              </h4>
              <p className="text-slate-300 leading-relaxed">
                各社会システムが世界を観察するための「専用のメガネ（二極のものさし）」です。法システムは「合法か違法か」、経済システムは「支払か非支払か」、科学システムは「真か偽か」という二元レンズだけを使って外界のあらゆる出来事を評価します。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <h4 className="font-bold text-purple-300 mb-1">
                Q4. 言葉が通じない異システム同士がどうやって影響し合うの？（構造的結合）
              </h4>
              <p className="text-slate-300 leading-relaxed">
                これをルーマンは「構造的結合（Structural Coupling）」と呼びます。法システムが経済のルールを直接指示することはできませんが、経済システムは法システムからの「違法判決」という刺激（ノイズ）を受けて、自らのルールで「支払中止・違約金」へと自己応答します。相手を直接動かすのではなく、刺激を通して自律反応を引き起こし合う関係です。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <h4 className="font-bold text-purple-300 mb-1">
                Q5. 人間の「心（意識）」と社会の「会話」は別物なの？
              </h4>
              <p className="text-slate-300 leading-relaxed">
                はい、全く別個のシステムです。人間の意識（心理システム）は頭の中の思考を再生し、社会（社会システム）は言葉と意味を再生します。意識は社会の「環境」として外側に位置し、社会にエネルギーと刺激を与える存在と捉えます。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <h4 className="font-bold text-purple-300 mb-1">
                Q6. シミュレーションが完了したとき、何が達成されたの？
              </h4>
              <p className="text-slate-300 leading-relaxed">
                外部からの刺激（お題）に応答して、各システムが自らの物差し（コード）で会話を他者に連鎖させ、ネットワーク全体で一巡する回路（作動的閉鎖）が形成されたことを意味します。会話が会話を呼び、社会が自律して回った証拠です。
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
