import { useState } from "react";

export interface EducationalPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export type TabId = "autopoiesis" | "closure" | "binary" | "coupling";

export const TAB_CONTENT: Record<TabId, { title: string; content: string }> = {
  autopoiesis: {
    title: "自己再生産 (Autopoiesis)",
    content: "社会システムはコミュニケーションを構成要素とし、コミュニケーションがさらなるコミュニケーションを生み出すことで自己の再生産を行います。社会システム論における最も重要な基礎概念です。"
  },
  closure: {
    title: "作動的閉鎖 (Operational Closure)",
    content: "システムは自らの作動のネットワーク内でのみ作動し、環境に対して直接開かれることはありません。本シミュレータでは、オートポイエーシスの証明（作動的閉鎖の成立）には以下の3条件が必要となります：\n\n1. 全非メタエージェントが少なくとも1回以上発言する\n2. 全活性非メタエージェントが単一の強連結成分（SCC）による有向グラフ循環ループを形成する\n3. 各エージェントの二値コードの肯定極（＋）と否定極（ー）の双方が、発言を通じてそれぞれ1回以上活性化（出現）する"
  },
  binary: {
    title: "二値コード (Binary Codes)",
    content: "各社会システムは、特定の二値コード（例：経済システムの「支払／非支払」、科学システムの「真／偽」、法システムの「合法／違法」）を用いて情報を処理します。肯定極（＋）と否定極（ー）の双方が活性化することで、社会システムのコード処理が成立します。"
  },
  coupling: {
    title: "構造的カップリング (Structural Coupling)",
    content: "作動的に閉鎖されたシステムが、環境からの刺激（非システム側からの「ノイズ」）を自らのコードに翻訳して受け入れる相互の結びつきのことです。例えば、LLM接続タイムアウトなどの外部ノイズを、システムは独自の自己参照機能として処理します。"
  }
};

export function EducationalPanel({ isOpen, onClose }: EducationalPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("autopoiesis");

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-y-0 right-0 z-50 w-80 bg-cyberpunk-bg border-l border-cyberpunk-neon/30 p-4 shadow-2xl flex flex-col justify-between"
      data-testid="educational-panel"
    >
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-cyberpunk-neon neon-glow tracking-wider">
            LUHMANN THEORY INDEX
          </h2>
          <button 
            onClick={onClose}
            className="text-xs border border-cyberpunk-neon/30 hover:border-cyberpunk-neon px-2 py-0.5 text-cyberpunk-neon bg-cyberpunk-neon/5 hover:bg-cyberpunk-neon/15 transition-all font-mono"
            data-testid="close-panel-btn"
          >
            CLOSE
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 mb-4 text-sm font-mono">
          {(Object.keys(TAB_CONTENT) as TabId[]).map((tabId) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`p-1.5 border transition-all text-left ${
                activeTab === tabId
                  ? "border-cyberpunk-accent bg-cyberpunk-accent/20 text-cyberpunk-accent"
                  : "border-cyberpunk-neon/20 hover:border-cyberpunk-neon/50 text-cyberpunk-text"
              }`}
              data-testid={`tab-${tabId}`}
            >
              {TAB_CONTENT[tabId].title.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="hud-panel p-3 border border-cyberpunk-neon/20 rounded bg-cyberpunk-bg/50">
          <h3 
            className="text-xs font-bold text-cyberpunk-accent mb-2"
            data-testid="tab-title"
          >
            {TAB_CONTENT[activeTab].title}
          </h3>
          <p
            className="text-sm leading-relaxed text-cyberpunk-text/80"
            data-testid="tab-content"
          >
            {TAB_CONTENT[activeTab].content}
          </p>
        </div>
      </div>

      <div className="border-t border-cyberpunk-neon/20 pt-2 text-sm text-cyberpunk-text/40 font-mono text-center">
        SYSTEMA SOCIOLOGICUM N. LUHMANN
      </div>
    </div>
  );
}
