# Tech Spec: Luhmann フロントエンド再デザイン（攻殻機動隊風・オートポイエーシス可視化）

## コンテキスト

本サンドボックス `social-autopoiesis-sandbox` は、ルーマンの社会システム理論に基づく
LLM 多エージェント シミュレーションを提供する。現行フロントエンド
（`frontend/src/App.tsx` / `SimulationForm.tsx` / `MessageList.tsx`）は
チャットリストのみの最小 UI であり、オートポイエーシス（発言が発言を連鎖的に
自己産出するプロセス）を視覚化する機能を持たない。

PRD（`docs/prd/lumann-frontend-redesign.md`）は、UI を攻殻機動隊風
サイバーパンク世界観の没入型ダッシュボードへ再デザインし、
（1）世界観表現、（2）AI アバター、（3）ネットワーク可視化、
（4）リアルタイム社会構成の成長、（5）タイムライン、（6）統計パネル、
（7）HUD 風フォーム、を要件としている。

バックエンド（`backend/app/server.py`）は既存 REST / WebSocket / SSE を維持し、
破壊的変更を行わない（YAGNI）。フロントエンドのみの差し替えとなる。

## 目標 / 非目標

- **目標**:
  - 攻殻機動隊風ダークネオン HUD テーマを `index.css` + Tailwind 拡張で全画面適用
  - `agent_code` / `concern` から生成する固有 SVG アバター（`AgentAvatar.tsx`）
  - 発言連鎖をノード=エージェント / エッジ=発言として描画する
    SVG ネットワーク図（`NetworkGraph.tsx`）
  - 発言到着ごとに成長する「社会構成パネル」（`SocietyPanel.tsx`）
  - 発言バルーン + 縦タイムライン（`MessageBubble.tsx` / `TimelineList.tsx`）
  - リアルタイム統計（`StatsPanel.tsx`）
  - 3 カラム HUD レイアウト（`App.tsx` 再設計・モバイル縦積み）
  - `framer-motion` による spring / slideIn / fade アニメーション
  - TypeScript strict / ESLint / Vitest 品質ゲート通過
- **非目標**:
  - 3D 化（Three.js）/ 音声合成 / ユーザー認証
  - バックエンド API の破壊的変更（`next_agent` イベント追加等も行わない）
  - d3-force 等のネットワーク力学レイアウト（次フェーズ検討）
  - SSE token 単位タイピング風表示（本フェーズは WS 完成メッセージ主軸）
  - DiceBear 等の外部アバター生成 API（自前ハッシュ SVG のみ）

## アーキテクチャ上の決定

- **ADR-1: フロントエンド単独差し替え（バックエンド非改修）**
  - 理由: PRD の非目標および NFR-6 後方互換性。既存 `POST /api/simulations` /
    `GET /api/simulations/{id}/logs` / `WS /ws/simulations/{id}` /
    `SSE /api/simulations/{id}/stream` で要件 FR-1〜FR-10 がすべて表現可能。
- **ADR-2: アニメーションライブラリは `framer-motion` 1 本のみ**
  - 理由: NFR-5 で「アニメーションは framer-motion 1 本まで」と明示。
    React 19 対応・軽量・宣言型 `motion.div` で spring / slideIn / fade を簡潔に
    記述可能。CSS キーフレーム（スキャンライン・グリッチ）は `index.css` で
    純 CSS 化し、framer-motion は React コンポーネント粒度の演出に限定。
- **ADR-3: ネットワーク可視化は SVG（Canvas なし）+ 円形固定レイアウト**
  - 理由: YAGNI。100 ノード程度は SVG で 60fps 維持可能（NFR-1）。
    `React.memo` + `useMemo` で差分再描画を抑制。力学レイアウトは
    `agent_order_mode=dynamic` で順序が変わる問題があるが、次フェーズで
    d3-force を検討（PRD 未解決事項 #2）。
- **ADR-4: アバター生成は純関数 `generateAvatar(agentCode, concern): string`**
  - 理由: NFR-2 型安全・NFR-1 メモ化。同一 `agentCode` から常に同一 SVG を
    返す純関数とし、`useMemo` で再生成を防止。外部 API 非依存でオフライン動作。
- **ADR-5: エージェント状態推論はフロントエンド単独（バックエンド拡張なし）**
  - 理由: PRD 未解決事項 #5。`agent_order_mode=fixed` の場合は `agent_order`
    配列と現在 `turn` から次発言者を推論可能。`dynamic` の場合は発言開始まで
    全エージェント `thinking`、発言中エージェント `speaking`、それ以外 `idle`
    で擬似表示。バックエンドへの `next_agent` イベント追加は行わない。
- **ADR-6: カラーパレット・フォントは Tailwind `theme.extend` に集約**
  - 理由: デザイントークンの一元管理。`tailwind.config.js` の
    `theme.extend.colors.cyberpunk.*` / `fontFamily.mono` を定義し、
    `bg-cyberpunk-bg` / `text-cyberpunk-neon` 等のユーティリティで参照。
  - **具体値（固定）**: `cyberpunk.bg: "#05060A"` / `cyberpunk.panel: "#0a0e1a"` / `cyberpunk.neon: "#00E5FF"`（シアン） / `cyberpunk.accent: "#39FF14"`（ネオングリーン） / `cyberpunk.danger: "#FF2A6D"` / `cyberpunk.text: "#e0f7ff"` / `fontFamily.mono: ['JetBrains Mono', 'Fira Code', 'monospace']`
- **ADR-7: 統計計算は `messages: Message[]` からの純関数導出**
  - 理由: NFR-1（O(n)）・NFR-2（型安全）・テスト容易性。
    `computeStats(messages): SimulationStats` を `lib/stats.ts` に純関数として
    定義し、`StatsPanel` / `SocietyPanel` が `useMemo` で消費。
- **ADR-8: 既存 `MessageList.tsx` を `TimelineList.tsx` に置換（非破壊廃止）**
  - 理由: PRD FR-6 がタイムラインを要求。`MessageList` の責務は
    `TimelineList` + `MessageBubble` に分割吸収される。旧コンポーネントは
    テストごと削除し、新テストに置換（AC-25）。
- **ADR-9: `prefers-reduced-motion` でアニメーション無効化**
  - 理由: NFR-3 アクセシビリティ。framer-motion の `MotionConfig` で
    `reducedMotion="user"` を App ルートに設定、CSS アニメーションは
    `@media (prefers-reduced-motion: reduce)` で `animation: none` を付与。

## データモデル・インメモリ状態設計

### 型定義（`frontend/src/types.ts` 拡張）

```ts
export type AgentState = "idle" | "thinking" | "speaking";

export interface AgentNode {
  name: string;
  binaryCode: string;
  concern: string;
  provider: string;
  model: string;
  speakCount: number;
  state: AgentState;
}

export interface NetworkEdge {
  from: string;
  to: string;
  count: number;
}

export interface SimulationStats {
  turn: number;
  maxTurns: number;
  perAgentCount: Record<string, number>;
  averageMessageLength: number;
  elapsedMs: number;
  providers: { provider: string; model: string }[];
}

export interface SocietyMetrics {
  messageCount: number;
  edgeCount: number;
  edgeDensity: number;
  activeNodeRatio: number;
}
```

- 既存 `Message` / `SimulationStartResponse` / `SimulationStatus` は維持。
- `Message.agent_code` をアバター生成ハッシュ種に使用（`binaryCode` にマップ）。
- **`concern` データソース（P0-B 対応）**: 現行 `Message` には `concern` が含まれない。バックエンド非改修の制約上、フロント側に `agent_name` → `concern` のキーワード辞書 `AGENT_CONCERN_MAP` を `lib/avatar.ts` に保持する。プリセット7システムの `name`（経済システム/科学システム/法システム/芸術システム/メディアシステム/政治システム/教育システム/メタ・モデレータ）に対応する `concern` を定義し、未知の `agent_name` は `""` にフォールバック（`concernGlyph` は既定 `◇`）。これにより AC-4「固有 SVG アバター」と PRD FR-2「`concern` キーワードのグリフ」が整合。将来的にバックエンドが `concern` を `Message` に追加した場合は、`Message.concern` を優先して使用する設計（フォールバック付き）とする。

### インメモリ状態（`App.tsx` の `useState`）

```ts
const [messages, setMessages] = useState<Message[]>([]);
const [status, setStatus] = useState<SimulationStatus>("idle");
const [error, setError] = useState<string | null>(null);
const [agentOrder, setAgentOrder] = useState<string[]>([]);
const [agentOrderMode, setAgentOrderMode] = useState<"fixed" | "dynamic">("fixed");
const [startedAt, setStartedAt] = useState<number | null>(null);
const [maxTurns, setMaxTurns] = useState<number>(0);
const [timelineZoom, setTimelineZoom] = useState<"S" | "M" | "L">("M");
const wsRef = useRef<WebSocket | null>(null);
```

- 派生状態（`useMemo`）:
  - `agents: Record<string, AgentNode>` — `messages` + `agentOrder` から構築
  - `edges: NetworkEdge[]` — `messages` の隣接ターンペアから導出
  - `stats: SimulationStats` — `computeStats(messages, maxTurns, startedAt)`
  - `society: SocietyMetrics` — `computeSociety(agents, edges, agentOrder.length)`
  - `currentSpeaker: string | null` — `messages` 末尾の `agent_name`
  - `nextSpeaker: string | null` — `agentOrderMode === "fixed"` の場合
    `agentOrder[(currentTurn + 1) % agentOrder.length]`、`dynamic` の場合は `null`

### asyncio.Lock 適用箇所

本 Tech Spec はフロントエンドのみの改修であり、Python 側の新規 `asyncio.Lock` は
発生しない。既存 `backend/app/server.py` の `_lock`（`_simulations` / `_loggers` 保護）
は維持され、追加の同期ポイントはなし。

## API・WebSocketプロトコル設計

バックエンド API は変更しない。フロントエンドからの利用プロトコルを以下に固定する。

### REST

- `POST /api/simulations`
  - リクエスト: `StartSimulationParams`（既存 `api/client.ts` の型を維持）
  - レスポンス: `SimulationStartResponse`
  - 成功後、`agent_order` を決定するため、フロントエンドは `trigger_message` と
    `max_turns` とともに `agent_order_mode` を明示送信する。
    ※ `agent_order` リストはレスポンスに含まれないため、`dynamic` の場合は
    `messages` 到着順に `AgentNode` を動的に登録する。
    `fixed` の場合は初回 `Message` 到着前に `agentOrder` が不明のため、
    最初の発言者以降を確定できない点は「未解決事項」とする（後述）。
- `GET /api/simulations/{id}/logs`
  - レスポンス: `Message[]`
  - AC-20 過去ログ再読み込みで使用。`simulation_id` 入力から呼び出し、
    `messages` を一括設定し `status=completed` へ遷移。

### WebSocket `/ws/simulations/{id}`

- 既存プロトコル維持:
  - `Message` オブジェクト到着 → `setMessages((prev) => [...prev, m])`
  - `{ event: "completed" }` → `setStatus("completed")`
  - `{ event: "failed", error }` → `setStatus("failed")` + `setError(error)`
  - `{ event: "not_found" }` → `setStatus("failed")` + `setError("simulation not found")`
- 新規イベント型は追加しない（ADR-1）。

### SSE `/api/simulations/{id}/stream`

- 本フェーズでは使用しない（ADR 非目標）。`api/client.ts` に SSE クライアント関数は
  追加しない。次フェーズで token 単位タイピング風表示を導入する際に再検討。

## コンポーネント構成 (Python & React)

### Python

変更なし。`backend/app/` 以下は一切修正しない（ADR-1）。

### React

```
frontend/src/
├── App.tsx                       [変更] 3カラム HUD レイアウトへ再設計
├── index.css                     [変更] cyberpunk キーフレーム・グリッド・スキャンライン
├── types.ts                      [変更] AgentNode / NetworkEdge / SimulationStats / SocietyMetrics 追加
├── api/
│   └── client.ts                 [変更] fetchSimulationLogs 関数追加・既存維持
├── lib/
│   ├── avatar.ts                 [新規] generateAvatar(agentCode, concern): string 純関数
│   ├── stats.ts                  [新規] computeStats / computeSociety 純関数
│   └── network.ts                [新規] buildEdges(messages): NetworkEdge[] / layoutNodes 円形配置
├── components/
│   ├── SimulationForm.tsx        [変更] HUD 風再スタイル + simulation_id 入力追加
│   ├── TimelineList.tsx          [新規] 既存 MessageList を置換（縦タイムライン + バルーン）
│   ├── MessageBubble.tsx         [新規] 吹き出し・HUD ラベル・framer-motion slideIn
│   ├── AgentAvatar.tsx           [新規] SVG アバター + state(idle/thinking/speaking) 表示
│   ├── AgentList.tsx             [新規] 左カラム・エージェント一覧 + 現在状態
│   ├── NetworkGraph.tsx          [新規] SVG ノード+エッジ・発言時にアニメーション
│   ├── SocietyPanel.tsx          [新規] 社会構成度ゲージ（発言数 / エッジ密度 / 活性度）
│   ├── StatsPanel.tsx            [新規] ターン数 / 発言回数 / 平均長 / 経過時間
│   ├── GlitchText.tsx            [新規] グリッチエフェクト付きテキストラッパ
│   ├── HudFrame.tsx              [新規] パネル枠装飾（::before/::after 角HUD）
│   └── MessageList.tsx           [削除] TimelineList に統合
└── __tests__/
    ├── SimulationForm.test.tsx   [変更] HUD 入力・simulation_id 追加に追従
    ├── MessageList.test.tsx      [削除] → TimelineList.test.tsx に置換
    ├── TimelineList.test.tsx     [新規]
    ├── AgentAvatar.test.tsx      [新規] generateAvatar 純関数の同一性・state 表示
    ├── NetworkGraph.test.tsx     [新規] buildEdges・レイアウト・描画ノード数
    ├── StatsPanel.test.tsx       [新規] computeStats 数値検証
    └── lib/avatar.test.ts        [新規] 純関数単体テスト
```

### 主要コンポーネント仕様

#### `App.tsx`
- `MotionConfig reducedMotion="user"` でルートラップ
- 3 カラム: `grid lg:grid-cols-[320px_1fr_360px]` / モバイル `flex flex-col`
- 左: `AgentList` + `SocietyPanel`
- 中央: `NetworkGraph`（大）+ `TimelineList`
- 右: `StatsPanel` + `SimulationForm`
- ヘッダ: `GlitchText` で "LUHMANN AUTOPOIESIS SIMULATION" 表示
- `failed` 時: 赤グリッチエラーバナー（`GlitchText` + `cyberpunk.danger`）
- `completed` 時: ネットワーク図完了オーバーレイ "SIMULATION COMPLETE"

#### `AgentAvatar.tsx`
- props: `{ agent: AgentNode; size: number }`
- 内部で `useMemo(() => generateAvatar(agent.binaryCode, agent.concern), [agent.binaryCode, agent.concern])`
- `state` に応じて外側 `motion.div` の `animate` を切替:
  - `idle`: 微弱発光（`boxShadow: 0 0 8px #00ff9c55`）
  - `thinking`: 回転リング（`rotate: 360` ループ・`duration: 2s`）
  - `speaking`: パルス（`boxShadow: 0 0 24px #00ff9c` + `scale: [1, 1.08, 1]`）
- アバター SVG 内部シンボルは `concern` キーワード判定:
  - 経済(Wirtschaft) → `¥` / 科学(Wissenschaft) → `∞` / 法(Recht) → `§`
  - 政治(Politik) → `権` / 教育(Erziehung) → `学` / 宗教(Religion) → `◈`
  - 芸術(Kunst) → `♪` / メディア → `📡`（マスメディアシステム） / 既定 → `◇`
- ハッシュ色相: `agentCode` の FNV-1a ハッシュ → HSL `hsl(h, 80%, 55%)`

#### `NetworkGraph.tsx`
- props: `{ agents: Record<string, AgentNode>; edges: NetworkEdge[]; currentSpeaker: string | null; nextSpeaker: string | null }`
- SVG `viewBox="0 0 600 600"`・円形配置
- ノード半径: `baseR=20 + speakCount * 2`（上限 40）
- ノード輝度: `speakCount` に比例して `fill-opacity` 0.3 → 1.0
- エッジ太さ: `strokeWidth = 1 + Math.log2(count + 1)`（同ペア発言回数）
- エッジ描画アニメ: `motion.line` の `pathLength` 0→1 spring
- `currentSpeaker` ノードに `pulse` アニメ、`nextSpeaker` ノードに `thinking` リング
- `React.memo` で `agents` / `edges` の参照安定時は再描画スキップ

#### `SocietyPanel.tsx`
- props: `{ metrics: SocietyMetrics; status: SimulationStatus }`
- 3 つの横並びゲージ:
  - 発言数（`messageCount` / `maxTurns` 比）
  - エッジ密度（`edgeDensity = edgeCount / (n*(n-1))`）
  - 活性度（`activeNodeRatio = activeNodes / n`）
- `motion.div` の `width` パーセントで spring 成長
- タイムスタンプ軸: `elapsedMs` を `MM:SS` 表示

#### `MessageBubble.tsx`
- props: `{ message: Message; agent: AgentNode | null; isLast: boolean }`
- 吹き出し: `border` + `clip-path` 三角 + ネオン枠
- ヘッダ: `turn` / `agent_name` / `agent_code` / `provider/model` HUD ラベル
- 本文: 等幅フォント・`whitespace-pre-wrap`
- `motion.div` で `initial={{ opacity: 0, x: -20 }}` → `animate={{ opacity: 1, x: 0 }}`

#### `TimelineList.tsx`
- props: `{ messages: Message[]; agents: Record<string, AgentNode>; zoom: "S"|"M"|"L" }`
- 縦 `ul`・各 `li` に `AgentAvatar` + `MessageBubble`・`ref` を各 `li` に付与（`messageRefs: Record<number, HTMLLIElement>`）
- 新発言時に `useEffect` + `scrollIntoView({ behavior: "smooth" })` で最下部へ
- `zoom` で `fontSize` 切替（S=11px / M=13px / L=16px）・3 段階のみ（YAGNI）
- **横スクロールドットタイムライン（AC-15 対応）**: `TimelineDots.tsx` を新設し、`TimelineList` 内の上部に配置
  - props: `{ messages: Message[]; onSelect: (turn: number) => void; currentTurn: number }`
  - 各発言をドット（直径8px・アバター色）で横並び・`overflow-x: auto`・等間隔
  - ドットクリック → `onSelect(turn)` → 親 `TimelineList` が `messageRefs[turn].scrollIntoView({ behavior: "smooth", block: "center" })` を呼出
  - 現在ドット（`currentTurn`）はネオンリングでハイライト
  - `tabIndex={0}` + `role="button"` + `aria-label={`ターン${turn}`}` でアクセシブル

#### `StatsPanel.tsx`
- props: `{ stats: SimulationStats; status: SimulationStatus }`
- HUD 風数値表示: 等幅・ネオン・`tabular-nums`
- 各エージェント発言回数: 横バー（`width: count / max * 100%`）

#### `SimulationForm.tsx`
- 既存機能維持 + HUD 風再スタイル
- 追加入力: `simulation_id`（オプション）→ `loadLogs()` で `GET /logs` 呼び出し
- **`agent_order_mode` 入力UI（P1 対応）**: ラジオボタン `fixed` / `dynamic` を追加（デフォルト `fixed`）・`agentOrderMode` state に bind・`POST /api/simulations` で送信
- 開始ボタン: `bg-cyberpunk-neon` / `disabled` 時 `opacity-50`
- 実行中: 全入力 `disabled` + ステータス HUD インジケータ表示

### 純関数（`lib/`）

#### `lib/avatar.ts`
```ts
export function generateAvatar(agentCode: string, concern: string): string;
export function concernGlyph(concern: string): string;
export function hashHue(input: string): number;
```
- 純関数・同一入力で同一 SVG 文字列・副作用なし・テスト可能

#### `lib/stats.ts`
```ts
export function computeStats(
  messages: Message[],
  maxTurns: number,
  startedAt: number | null,
): SimulationStats;

export function computeSociety(
  agents: Record<string, AgentNode>,
  edges: NetworkEdge[],
  totalAgents: number,
): SocietyMetrics;
```

#### `lib/network.ts`
```ts
export function buildEdges(messages: Message[]): NetworkEdge[];
export function layoutNodes(
  agentNames: string[],
  radius: number,
  center: { x: number; y: number },
): Record<string, { x: number; y: number }>;
```

## Docker / コンテナ構成

本 Tech Spec はフロントエンドのみの改修のため、`docker-compose.yml` および
`frontend/Dockerfile` / `backend/Dockerfile` に構造的変更はない。以下は現状維持確認。

- **イメージ**:
  - `frontend`: `node:20-alpine` ベース・`npm install` → `vite` dev server
  - `backend`: `python:3.12-slim` ベース・`uvicorn app.server:app`
- **ヘルスチェック**: 既存のまま（frontend は `/` への HTTP 200、backend は
  `/api/simulations` の 405/200）。本改修で新設なし。
- **ボリューム・ネットワーク**:
  - `frontend` コンテナ: `5173` 公開・`/ws` / `/api` を backend `8000` へプロキシ
    （`vite.config.ts` の `server.proxy` 維持）
  - 既存 `docker-compose.yml` のネットワーク設定を維持
- **検証手順（AC-27）**:
  1. `docker compose up --build`
  2. ブラウザで `http://localhost:5173` を開く
  3. `SimulationForm` からお題入力・開始
  4. WebSocket 経由で発言が到着し、ネットワーク図・タイムライン・統計が
     リアルタイムに成長することを確認
  5. `completed` イベントで完了オーバーレイ表示を確認

## 未解決の課題

1. **`agent_order` の取得経路がない**
   - `POST /api/simulations` レスポンスは `{ simulation_id, status }` のみで
     `agent_order` を含まない。`fixed` モードで次発言者を事前推論するには
     `agent_order` が必要。本フェーズでは「初回発言者の到着後に `agentOrder` を
     逆推定せず、`dynamic` と同様に全員 `thinking` で擬似表示」とする。
     `fixed` の `nextSpeaker` 推論は「`messages` が 2 件以上蓄積した段階で
     出現順を `agentOrder` とみなす」ヒューリスティックで妥協する。
     バックエンド拡張（`agent_order` を開始レスポンスに含める）は次フェーズで
     検討（PRD 非目標に従い本フェーズでは実施しない）。
2. **過去ログ再生速度（AC-20）**
   - `GET /logs` で一括取得後、リアルタイム相当の速度で段階的に `messages` に
     append するか、即時一括表示するか。本 Tech Spec では「即時一括表示」を
     採用（YAGNI・実装最小）。再生速度制御は次フェーズ。
3. **モバイル最適化の深さ**
   - 縦スタックで済ませる（AC-18）。タブ切替 UI は次フェーズ評価。
4. **アバター SVG のシンボル網羅性**
   - `concern` のキーワード→グリフ対応表は主要 7 システムのみ定義。
     未知の `concern` は既定 `◇` にフォールバック。網羅は運用観察後に拡張。
5. **ネットワーク図の大規模対応**
   - SVG は 50 ノード程度が実用上限。100 ノード超は Canvas 実装に切り替える
     必要があるが、本フェーズのシミュレーション規模（`max_turns` 数十）では
     発生しないため SVG で固定（YAGNI）。
6. **`framer-motion` の React 19 公式対応確認**
   - `framer-motion >= 11.x` は React 19 対応を宣言済み。`package.json` で
     `^11.0.0` を指定し、`npm install` 後に `tsc -b` / `vitest` が通ることを
     実装フェーズで検証する。問題発生時は純 CSS アニメーションにフォールバック。