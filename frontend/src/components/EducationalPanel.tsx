import { useState } from "react";

export interface EducationalPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export type TabId = "autopoiesis" | "closure" | "binary" | "coupling";

export const TAB_CONTENT: Record<TabId, { title: string; content: string; plainSummary: string }> = {
  autopoiesis: {
    title: "自己再生産 (Autopoiesis)",
    content: "社会システムはコミュニケーションを構成要素とし、コミュニケーションがさらなるコミュニケーションを生み出すことで自己の再生産を行います。社会システム論における最も重要な基礎概念です。",
    plainSummary: "【かみくだく解説】会話が途切れず、次々と新しい会話や意見を自分自身で生み出し続ける社会の自己再生プロセスです。",
  },
  closure: {
    title: "作動的閉鎖 (Operational Closure)",
    content: "システムは自らの作動のネットワーク内でのみ作動し、環境に対して直接開かれることはありません。本シミュレータでは、オートポイエーシスの証明（作動的閉鎖の成立）には以下の3条件が必要となります：\n\n1. 全非メタエージェントが少なくとも1回以上発言する\n2. 全活性非メタエージェントが単一の強連結成分（SCC）による有向グラフ循環ループを形成する\n3. 各エージェントの二値コードの肯定極（＋）と否定極（ー）の双方が、発言を通じてそれぞれ1回以上活性化（出現）する",
    plainSummary: "【かみくだく解説】法・経済・科学などが外部の意見に振り回されず、自分たちの専門ルール(判断基準)の中だけで思考・作動することです。",
  },
  binary: {
    title: "二値コード (Binary Codes)",
    content: "各社会システムは、特定の二値コード（例：経済システムの「支払／非支払」、科学システムの「真／偽」、法システムの「合法／違法」）を用いて情報を処理します。肯定極（＋）と否定極（ー）の双方が活性化することで、社会システムのコード処理が成立します。",
    plainSummary: "【かみくだく解説】各システムが世の中を評価するための『判断のものさし』のことです（例: 法律は『合法か違法か』だけで見ます）。",
  },
  coupling: {
    title: "構造的カップリング (Structural Coupling)",
    content: "作動的に閉鎖されたシステムが、環境からの刺激（非システム側からの「ノイズ」）を自らのコードに翻訳して受け入れる相互の結びつきのことです。例えば、LLM接続タイムアウトなどの外部ノイズを、システムは独自の自己参照機能として処理します。",
    plainSummary: "【かみくだく解説】他人の意見やニュースという刺激を受け取り、自分の専門用語・物差しに言い換えて反応し合う関係のことです。",
  }
};

export function EducationalPanel({ isOpen, onClose }: EducationalPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("autopoiesis");

  if (!isOpen) return null;

  const currentTab = TAB_CONTENT[activeTab];

  return (
    <div 
      className="fixed inset-y-0 right-0 z-50 w-96 bg-slate-900/95 border-l border-indigo-500/40 p-4 shadow-2xl flex flex-col justify-between backdrop-blur-md text-slate-100"
      data-testid="educational-panel"
    >
      <div>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
          <h2 className="text-sm font-bold text-amber-300 tracking-wider flex items-center gap-1.5">
            <span>📚 LUHMANN THEORY INDEX</span>
          </h2>
          <button 
            onClick={onClose}
            className="text-xs border border-slate-700 hover:border-slate-500 px-2 py-0.5 text-slate-300 hover:text-white bg-slate-800/60 rounded font-mono transition-colors"
            data-testid="close-panel-btn"
          >
            CLOSE
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-4 text-xs font-mono">
          {(Object.keys(TAB_CONTENT) as TabId[]).map((tabId) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`p-2 rounded-lg border transition-all text-left font-sans text-xs ${
                activeTab === tabId
                  ? "border-indigo-400 bg-indigo-950/60 text-indigo-200 font-bold"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700 text-slate-400"
              }`}
              data-testid={`tab-${tabId}`}
            >
              {TAB_CONTENT[tabId].title.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="p-4 border border-indigo-500/30 rounded-xl bg-slate-950/80 shadow-inner space-y-3">
          <h3 
            className="text-xs font-bold text-amber-300 mb-1"
            data-testid="tab-title"
          >
            {currentTab.title}
          </h3>

          {/* Plain language summary badge */}
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs font-medium leading-relaxed">
            {currentTab.plainSummary}
          </div>

          <p
            className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap"
            data-testid="tab-content"
          >
            {currentTab.content}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-3 text-xs text-slate-500 font-mono text-center">
        SYSTEMA SOCIOLOGICUM N. LUHMANN
      </div>
    </div>
  );
}
