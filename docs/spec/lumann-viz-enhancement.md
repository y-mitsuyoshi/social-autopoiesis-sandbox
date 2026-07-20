# Tech Spec: オートポイエーシス可視化強化・考察・ターン増・UX改善・カオス感・Ollama分離・モデル性能向上

## コンテキスト

`social-autopoiesis-sandbox` はニクラス・ルーマンの社会システム論に基づき、複数の機能システム（経済・法・科学・芸術・メディア・政治・教育）エージェントが自律的に発言を積み重ねて社会をオートポイエティクス的に構築する様を、攻殻機動隊風サイバーパンク UI で可視化するシミュレーションアプリである。前フェーズでエージェントエディタ・ドラッグ/ズーム・折れ線グラフ・アバターカスタマイズは実装済み。

本フェーズは PRD `docs/prd/lumann-viz-enhancement.md` に基づき、ビジュアル表現強化・UX改善・設定整理に集中し、7本柱（FR-1〜FR-7）を実現する。現状コードは React 19 + Vite + Tailwind + TypeScript strict / Python 3.12 + FastAPI + Pydantic + asyncio で構成され、フロントは純 SVG + `framer-motion`（既存依存）でグラフ描画を行っている。

現状の主な課題:
- `SocietyPanel` は発言数・エッジ密度・活性度の3バーのみで、オートポイエーシスの「構築過程」が時系列で見えない
- `NetworkGraph` のエッジは静的で、発言連鎖の「波」が表現されていない
- シミュレーション完了後の考察パネルがなく、定量的分析ができない
- デフォルトターン数 9 は短く、長い議論の展開観察に不向き（`SimulationForm.tsx` の state 初期値は 3）
- `text-[9px]` / `text-[10px]` / `text-[11px]` 等の小さすぎる文字が 60 箇所以上存在。`TimelineList` の S/M/L ズームは `ZOOM_FONT = {S:11, M:13, L:16}` だが `MessageBubble` 本文が `text-[13px]` 固定クラスを持つため親の `fontSize` スタイルが上書きされて効かない
- AI議論が「文字だけ」で流れがわかりにくく、発話演出・同時思考演出・ノード振動がない
- Ollama Cloud と Local が環境変数で分離されておらず、設定ミス（Local なのに Cloud キー要求等）が起きる
- デフォルトモデル（`gemma4:12b` / `gpt-oss:20b-cloud` / `gemma4:e4b`）が性能面で古く、各システムで多様性がない

## 目標 / 非目標

- **目標**:
  - FR-1: `SocietyPanel` に積み上がりエリアチャート（純 SVG）を追加し、`NetworkGraph` のエッジ上に光パルスアニメーションを実装する
  - FR-2: シミュレーション完了後に `AnalysisPanel` を自動表示し、主導性スコア・相互作用行列ヒートマップ・オートポイエーシス度を純関数 `lib/analysis.ts` で算出する
  - FR-3: デフォルトターン数を 9 → 15 に増加（`.env.example` と `AgentEditor` state 初期値）
  - FR-4: 全コンポーネントの小さすぎる文字（`text-[9px]` / `text-[10px]` / `text-[11px]`）を最小 `text-sm`(14px) に引き上げ、`index.css` の `body` フォントを 13px → 15px にし、`TimelineList` ズームを S=14/M=16/L=20 に引き上げて `MessageBubble` 本文を `fontSize: inherit` で継承させる
  - FR-5: `DebateVisualizer`（発言者→対象の矢印）を新設し、`AgentAvatar` に口元パルス・音波エフェクトを追加、複数エージェント同時 thinking 演出とノード微小振動でカオス感を表現する
  - FR-6: `OLLAMA_MODE=cloud|local` 環境変数で Ollama Cloud/Local を分離し、後方互換（`OLLAMA_API_KEY`/`OLLAMA_BASE_URL`/`OLLAMA_MODEL`）を維持する
  - FR-7: プリセット YAML と `data/presets.ts` と `.env.example` のデフォルトモデルを高性能モデル（`gemma4:31b` / `gpt-oss:120b` / `llama3.1:8b` 等）に更新する
- **非目標**:
  - LLM による考察サマリー生成（FR-2.5）は次フェーズに延期（YAGNI）。本フェーズはフロント側の統計計算のみ実装し、`POST /api/simulations/{id}/analysis` エンドポイント・`backend/app/analysis.py`・`AnalysisRequest`/`AnalysisResponse` Pydantic モデルは作成しない
  - 3D 可視化・音声合成・TTS・バックエンド永続化・認証・分析専用プロバイダ指定・シミュレーション比較機能はスコープ外
  - 新規 npm 依存の追加は行わない（純 SVG + `framer-motion` 既存依存のみ）
  - `GEMINI_MODEL` / `OPENAI_MODEL` / `OPENCODE_MODEL` / `OPENCODE_GO_MODEL` は変更しない
  - `MAX_TURNS` の上限バリデーションは追加しない（既存 `ge=0` のみ維持）

## アーキテクチャ上の決定

- **AD-1: LLM 考察生成は次フェーズに延期し、本フェーズはフロント純関数のみで考察パネルを実装する**
  - 理由: YAGNI。指示により「考察サマリー: フロント側で統計計算のみ（LLM分析は次フェーズ）」と明示されている。バックエンド変更を最小限に抑え、`backend/app/analysis.py` 新設・`POST /api/simulations/{id}/analysis` エンドポイント追加・`AnalysisRequest`/`AnalysisResponse` Pydantic モデル定義は行わない。`AnalysisPanel` は統計（主導性・行列・オートポイエーシス度）のみ表示し、LLM 考察セクションは「次フェーズで実装予定」のプレースホルダを表示する
- **AD-2: エリアチャート・ヒートマップ・議論構造可視化は純 SVG + React state + `framer-motion` で実装する（新規グラフライブラリ依存なし）**
  - 理由: NFR-8（依存最小化）と YAGNI。15ターン × 7エージェント程度なら SVG path の `d` 属性を `useMemo` で導出すれば 60fps を維持できる。`recharts` / `d3` 等の追加は不要
- **AD-3: `DebateVisualizer` は `NetworkGraph` にトグルボタンを追加して同一パネル内で「ネットワーク / 議論構造」を切り替える**
  - 理由: OQ-1。3カラムグリッドの空きスペースを優先し、独立パネルを新設するとレイアウトが複雑化する。`NetworkGraph` は既に `messages` / `agents` / `edges` を受け取っており、`DebateVisualizer` も同じ props で描画できるためトグル方式が YAGNI 妥当
- **AD-4: `AnalysisPanel` は右 aside の `StatsPanel` / `LogsReload` の下に配置する**
  - 理由: OQ-3。メインカラム下部に全幅展開すると3カラムグリッド改修が必要だが、右 aside 下部なら既存レイアウト変更最小。ヒートマップは `agents-7` で 7×7 セル（1セル 36px 程度）なら 360px 幅の aside に収まる
- **AD-5: `MessageBubble` 本文を `text-[13px]` 固定クラスから `style={{ fontSize: "inherit" }}` に変更し、親 `TimelineList` の `ZOOM_FONT` を継承する**
  - 理由: FR-4.2。子の Tailwind クラスが親の inline `fontSize` を上書きする現象を解消する。`MessageBubble` は `TimelineList` 配下でのみ使用されることを `grep` で確認済み（他の呼び出し元なし）。ヘッダのメタ情報（ターン番号・プロバイダ）は `text-sm` 固定でズーム非追従とする
- **AD-6: `OLLAMA_MODE` の解決ロジックは `config.py` の `load_config` に集約し、`llm_client.py` は変更しない**
  - 理由: FR-6.5。`config.py` で `OLLAMA_MODE` に応じて `ollama_cloud_*` / `ollama_local_*` を読み、解決済みの値を `AppConfig.ollama_api_key` / `ollama_base_url` / `ollama_model` に設定する。`llm_client.build_agent_clients` は既存インターフェース（`ollama_api_key` / `ollama_base_url` / `ollama_model` を参照）を維持し、`OLLAMA_MODE` を意識しない。後方互換（`OLLAMA_MODE` 未設定時は既存 `OLLAMA_*` を使用）も `load_config` で吸収する
- **AD-7: `OllamaMode` ローカル APIキーはダミー文字列 `local` を設定する**
  - 理由: OQ-6。`llm_client.py` は OpenAI 互換クライアントで `Authorization` ヘッダーを送信する。空文字だとクライアント生成でエラーになる可能性があるため、`local` というダミー文字列を設定し、ローカル Ollama がそれを無視することを実機検証で確認する（検証失敗時は空文字にフォールバック）
- **AD-8: `inferTarget` の対象推定は「直前の発言者をデフォルト対象とし、発言テキスト内に他エージェント名・`binary_code`・`concern` キーワードが含まれる場合はそのエージェントを対象とする」簡易ロジックにする**
  - 理由: FR-5.1・YAGNI。自然言語解析・LLM による対象推定は次フェーズ。純関数で `messages` と `agents` から推定でき、Vitest でテスト可能

## データモデル・インメモリ状態設計

### フロントエンド型定義（`frontend/src/types.ts` 拡張）

```typescript
// 既存 SocietyMetrics は変更なし。以下を新規追加:

export interface AnalysisResult {
  dominance: { name: string; count: number; avgLength: number; score: number }[];
  interactionMatrix: { from: string; to: string; count: number }[];
  autopoiesis: {
    edgeDensity: number;
    diversity: number;
    maxChainLength: number;
    totalScore: number;
  };
}

export interface DebateArrow {
  from: string;
  to: string;
  turn: number;
}

export type NetworkViewMode = "network" | "debate";
```

### バックエンド Pydantic モデル（`backend/app/schemas.py` 拡張）

```python
class AppConfig(BaseModel):
    # 既存フィールドは維持
    # 以下を追加:
    ollama_mode: Literal["cloud", "local"] | None = None
    ollama_cloud_api_key: str | None = None
    ollama_cloud_base_url: str | None = None
    ollama_cloud_model: str | None = None
    ollama_local_base_url: str | None = None
    ollama_local_model: str | None = None
```

`validate_provider_credentials` は `ollama_mode` に応じて分岐:
- `ollama_mode == "cloud"`: `ollama_cloud_api_key` / `ollama_cloud_model` 必須、`ollama_cloud_base_url` はデフォルト `https://ollama.com/v1`、これらを `ollama_api_key` / `ollama_base_url` / `ollama_model` にマップ
- `ollama_mode == "local"`: `ollama_local_model` 必須、`ollama_local_base_url` はデフォルト `http://localhost:11434/v1`、`ollama_api_key` はダミー `local` を設定、`ollama_local_model` を `ollama_model` にマップ
- `ollama_mode is None`: 既存ロジック（`ollama_api_key` / `ollama_base_url` / `ollama_model` 必須）を維持

### `asyncio.Lock` 適用箇所

- `backend/app/server.py` の既存 `_lock: asyncio.Lock` は変更なし（`_simulations` / `_loggers` / `_tasks` の同期）。本フェーズでバックエンドの共有状態は追加しない
- フロントエンドは React state のみで共有状態を持たず、`useMemo` で派生値を導出するため `asyncio.Lock` 相当の同期プリミティブは不要

## API・WebSocketプロトコル設計

本フェーズは API・WebSocket プロトコルの変更を行わない（LLM 考察生成を次フェーズに延期したため）。

既存プロトコル（変更なし）:
- `POST /api/simulations` → `SimulationStartResponse`（`simulation_id` / `status`）
- `GET /api/simulations/{id}` → `SimulationState`
- `GET /api/simulations/{id}/logs` → `list[Message]`
- `GET /api/simulations/{id}/stream` → SSE
- `WS /ws/simulations/{id}` → `Message` / `WebSocketEvent`

## コンポーネント構成 (Python & React)

### Python（バックエンド・最小限の変更）

```
backend/app/
├── config.py        # 変更: OLLAMA_MODE 読込・cloud/local 解決ロジック追加
├── schemas.py       # 変更: AppConfig に ollama_mode / ollama_cloud_* / ollama_local_* 追加
├── server.py        # 変更なし
├── simulation.py    # 変更なし
├── agents.py        # 変更なし
├── llm_client.py    # 変更なし（config.py で解決済みの ollama_* を参照）
├── logger.py        # 変更なし
└── main.py          # 変更なし
```

`config.py` 変更詳細:
```python
def _resolve_ollama_config() -> dict[str, str | None]:
    mode = os.environ.get("OLLAMA_MODE")
    if mode == "cloud":
        api_key = os.environ.get("OLLAMA_CLOUD_API_KEY")
        if not api_key:
            raise ValueError("OLLAMA_CLOUD_API_KEY is required when OLLAMA_MODE=cloud")
        model = os.environ.get("OLLAMA_CLOUD_MODEL")
        if not model:
            raise ValueError("OLLAMA_CLOUD_MODEL is required when OLLAMA_MODE=cloud")
        base_url = os.environ.get("OLLAMA_CLOUD_BASE_URL") or "https://ollama.com/v1"
        return {
            "ollama_api_key": api_key,
            "ollama_base_url": base_url,
            "ollama_model": model,
            "ollama_mode": "cloud",
            "ollama_cloud_api_key": api_key,
            "ollama_cloud_base_url": base_url,
            "ollama_cloud_model": model,
        }
    if mode == "local":
        model = os.environ.get("OLLAMA_LOCAL_MODEL")
        if not model:
            raise ValueError("OLLAMA_LOCAL_MODEL is required when OLLAMA_MODE=local")
        base_url = os.environ.get("OLLAMA_LOCAL_BASE_URL") or "http://localhost:11434/v1"
        return {
            "ollama_api_key": "local",
            "ollama_base_url": base_url,
            "ollama_model": model,
            "ollama_mode": "local",
            "ollama_local_base_url": base_url,
            "ollama_local_model": model,
        }
    # mode is None: 後方互換・既存 OLLAMA_* を使用
    return {
        "ollama_api_key": os.environ.get("OLLAMA_API_KEY") or None,
        "ollama_base_url": os.environ.get("OLLAMA_BASE_URL") or None,
        "ollama_model": os.environ.get("OLLAMA_MODEL") or None,
        "ollama_mode": None,
    }
```

`load_config` で `_resolve_ollama_config()` を呼び出し、結果を `AppConfig` に渡す。

### React（フロントエンド）

```
frontend/src/
├── App.tsx                              # 変更: AnalysisPanel 表示制御・NetworkViewMode state・DebateVisualizer トグル・AnalysisPanel 配置
├── components/
│   ├── SocietyPanel.tsx                 # 変更: 積み上がりエリアチャート（SVG・80px 高）追加
│   ├── NetworkGraph.tsx                 # 変更: エッジ光パルスアニメ・連鎖ハイライト・ノード微小振動・DebateVisualizer トグル・fontSize 引き上げ
│   ├── MessageBubble.tsx                # 変更: 本文 text-[13px] → style fontSize inherit・typing アニメ・ヘッダ text-sm
│   ├── TimelineList.tsx                 # 変更: ZOOM_FONT {S:14, M:16, L:20}・直近2-3発言のX軸オフセット
│   ├── TimelineDots.tsx                 # 変更: text-[9px] → text-sm
│   ├── StatsPanel.tsx                   # 変更: text-[10px]/text-[11px] → text-sm
│   ├── AgentAvatar.tsx                 # 変更: 口元パルス・音波エフェクト・MIC バッジ text-[8px] → text-sm
│   ├── SimulationForm.tsx               # 変更: maxTurns 初期値 3 → 15・text-[11px] → text-sm
│   ├── AgentEditor.tsx                  # 変更: maxTurns 初期値 3 → 15・小文字クラス引き上げ
│   ├── AgentEditorCard.tsx              # 変更: 小文字クラス引き上げ（text-[9px]/text-[10px]/text-[11px] → text-sm）
│   ├── BinaryCodeGauge.tsx              # 変更: text-[9px]/text-[10px] → text-sm
│   ├── EducationalPanel.tsx            # 変更: text-[8px]/text-[9px]/text-[11px] → text-sm
│   ├── AnalysisPanel.tsx                # 新規: 完了時表示・主導性・ヒートマップ・オートポイエーシス度
│   └── DebateVisualizer.tsx             # 新規: NetworkGraph 内トグル・発言者→対象の矢印
├── lib/
│   ├── analysis.ts                      # 新規: computeAnalysis / inferTarget 純関数
│   ├── stats.ts                         # 変更: 既存 computeSociety/computeStats は維持（AnalysisPanel は lib/analysis を使用）
│   └── avatar.ts                        # 変更なし
├── data/
│   └── presets.ts                       # 変更: モデル名更新（gemma4:31b / gpt-oss:120b / llama3.1:8b）
├── types.ts                             # 変更: AnalysisResult / DebateArrow / NetworkViewMode 追加
├── index.css                            # 変更: body font-size: 15px 追加
├── __tests__/
│   ├── AnalysisPanel.test.tsx           # 新規: computeAnalysis のユニットテスト
│   └── DebateVisualizer.test.tsx         # 新規: inferTarget のユニットテスト
└── package.json                         # 変更なし（依存追加なし）
```

### 各コンポーネントの変更詳細

#### `lib/analysis.ts`（新規・純関数）

```typescript
export function computeAnalysis(
  messages: Message[],
  agents: Record<string, AgentNode>,
): AnalysisResult {
  // 1. 主導性スコア: (発言回数 / 総発言数) × (平均発言長 / 全体平均発言長) を 0-1 正規化・クリップ
  // 2. 相互作用行列: buildEdges と同等の from→to count
  // 3. オートポイエーシス度:
  //    edgeDensity = 既存 computeSociety の値を再利用
  //    diversity = 1 - (最大発言数システムの発言数 / 総発言数)
  //    maxChainLength = 最長連続異システム応答列の長さ / 総発言数
  //    totalScore = (edgeDensity + diversity + maxChainLength) / 3
}

export function inferTarget(
  currentMessage: Message,
  previousMessages: Message[],
  agents: Record<string, AgentNode>,
): string | null {
  // 1. 発言テキスト内に他エージェント名が含まれる場合 → そのエージェント
  // 2. 発言テキスト内に他エージェントの binary_code が含まれる場合 → そのエージェント
  // 3. 発言テキスト内に他エージェントの concern キーワードが含まれる場合 → そのエージェント
  // 4. 推定不可時 → 直前発言者（previousMessages の最後）
  // 5. previousMessages が空の場合 → null
}

export function buildDebateArrows(
  messages: Message[],
  agents: Record<string, AgentNode>,
): DebateArrow[] {
  // 各メッセージについて inferTarget を呼び出し、{from, to, turn} の配列を返す
}
```

#### `SocietyPanel.tsx`（変更）

- 既存3バー（発言数・エッジ密度・活性度）は維持
- その下にミニエリアチャート（高さ 80px・SVG）を追加
- `messages` と `agents` を新規 props として受け取り、`useMemo` で各ターンごとの累積発言数（システム別）を計算
- 各システムの色は `agent.avatarHue ?? hashHue(agent.binaryCode)` で `hsl(hue, 85%, 60%)` を使用
- SVG `<path>` の `d` 属性を各システムごとに積み上げて生成
- WebSocket メッセージ到着ごとに `messages` props が更新されるため自動再描画

#### `NetworkGraph.tsx`（変更）

- `viewMode: NetworkViewMode` props を新規追加（`"network"` | `"debate"`）。`"debate"` の時は `DebateVisualizer` を描画
- エッジ光パルスアニメーション: 直近ターンで使われたエッジ（`messages` の最後2件から導出）に `<motion.circle>` を `stroke-dasharray` + `stroke-dashoffset` で path 沿いに移動（duration 1.2s）
- 新エッジ形成時: `motion.line` の `strokeWidth` を一時的に 2倍にして spring で定常状態に戻す（`initial` / `animate` で実装）
- 連鎖ハイライト: 直近4ターンで使われたエッジを `strokeOpacity: 1`、それ以外を `strokeOpacity: 0.3` に
- ノード微小振動: 各ノード `<g>` に `motion` で `x`/`y` を ±1.5px ランダム変動（`repeat: Infinity`、`duration: 0.3-0.8s` のランダム）。`prefers-reduced-motion` 時は無効化（`MotionConfig reducedMotion="user"` で既存対応）
- SVG `fontSize={9}` / `fontSize={10}` / `fontSize={11}` → `fontSize={13}` 以上に引き上げ

#### `DebateVisualizer.tsx`（新規・`NetworkGraph` 内トグル）

- `NetworkGraph` と同じ `agents` / `messages` / `positions` を受け取る
- `buildDebateArrows(messages, agents)` で矢印データを導出
- 各発言者ノードから対象ノードへ曲線矢印（SVG `<path>` + `<marker>`）を描画
- ターンごとに `motion.path` で `pathLength` 0→1 をフェードイン
- ノードは `NetworkGraph` と同じ `layoutNodes` の円形配置を流用

#### `AnalysisPanel.tsx`（新規）

- `status === "completed"` の時のみ表示（`App.tsx` で制御）
- `computeAnalysis(messages, agents)` の結果を表示:
  - **主導性スコア**: 各エージェントの `count` / `avgLength` / `score`（0-1）をバーで表示
  - **相互作用行列ヒートマップ**: `interactionMatrix` を `agents` の順序で N×N グリッド。各セルの色は count に応じて `cyberpunk-neon`（低）→ `cyberpunk-accent`（高）のグラデーション。対角線（自己応答）は `cyberpunk-text/20` でグレーアウト
  - **オートポイエーシス度**: `totalScore` をバーまたはゲージで表示。内訳（`edgeDensity` / `diversity` / `maxChainLength`）も小さく表示
  - **LLM 考察セクション**: 「次フェーズで実装予定」のプレースホルダを表示（本フェーズは統計のみ）
- `aria-label="analysis-panel"` を付与

#### `AgentAvatar.tsx`（変更）

- 発言中（`state === "speaking"`）に口元パルス: SVG の中心に小円を配置し、`motion.circle` で `r` と `opacity` を脈動（`scale` 0.8→1.2、`opacity` 0.8→0、`repeat: Infinity`）
- 音波エフェクト: アバター周囲に同心円 3 重を描き、`speaking` 時に外向きに広がる（既存 `irritation-ripples` を強化して3重に）
- フキダシから文字が流れる: `MessageBubble` 側で `typing` アニメーション（1文字ずつフェードイン）を実装
- MIC バッジ `text-[8px]` → `text-sm`

#### `MessageBubble.tsx`（変更）

- 本文 `<p>` を `text-[13px]` → `style={{ fontSize: "inherit" }}` に変更（親 `TimelineList` の `ZOOM_FONT` を継承）
- ヘッダのメタ情報（ターン番号・プロバイダ）は `text-sm` 固定でズーム非追従
- `live` && `isLast` の場合に typing アニメーション（1文字ずつ `motion.span` でフェードイン）を適用。`prefers-reduced-motion` 時は無効化

#### `TimelineList.tsx`（変更）

- `ZOOM_FONT` を `{S: 14, M: 16, L: 20}` に引き上げ
- 直近 2-3 発言に `motion` で `x` を ±4px ランダムオフセット（重なり合い演出）。`prefers-reduced-motion` 時は無効化

#### `TimelineDots.tsx`（変更）

- `text-[9px]` → `text-sm`

#### `App.tsx`（変更）

- `networkViewMode: NetworkViewMode` state を新規追加（`"network"` / `"debate"` トグル）
- `AnalysisPanel` を右 aside の `LogsReload` の下に配置（`status === "completed"` の時のみ表示）
- `NetworkGraph` に `viewMode` props を追加
- `AnalysisPanel` に `messages` / `agents` / `status` を渡す
- `text-[9px]` / `text-[10px]` / `text-[11px]` → `text-sm`
- ズームボタンラベル `text-[10px]` → `text-sm`

### 設定ファイル

```
.env.example                              # 変更: MAX_TURNS=15・OLLAMA_MODE セクション追加・OLLAMA_CLOUD_*/OLLAMA_LOCAL_* 追加・OLLAMA_CLOUD_MODEL=gpt-oss:120b・OLLAMA_LOCAL_MODEL=llama3.1:8b
config/agents.yaml                        # 変更: agents-3.yaml と同一に更新（経済=gemma4:31b / 科学=gpt-oss:120b / 法=llama3.1:8b）
config/presets/
├── agents-3.yaml                         # 変更: 経済=gemma4:31b / 科学=gpt-oss:120b / 法=llama3.1:8b
├── agents-5.yaml                         # 変更: 3 + 芸術=gemma4:31b / メディア=gemini-2.5-flash（維持）
├── agents-7.yaml                         # 変更: 5 + 政治=gpt-oss:120b / 教育=llama3.1:8b
└── agents-3-dynamic.yaml                 # 変更: 3 + メタ・モデレータ=gemma4:31b
```

`.env.example` 変更後:
```env
LLM_PROVIDER=ollama
MAX_TURNS=15

AGENTS_CONFIG=
AGENT_ORDER_MODE=fixed
HISTORY_LENGTH=1

# Ollama モード選択（cloud=Ollama Cloud / local=ローカル Ollama）
OLLAMA_MODE=cloud

# Ollama Cloud (OpenAI互換・APIキー必須)
OLLAMA_CLOUD_API_KEY=
OLLAMA_CLOUD_BASE_URL=https://ollama.com/v1
OLLAMA_CLOUD_MODEL=gpt-oss:120b

# Ollama Local (ローカル・APIキー不要)
OLLAMA_LOCAL_BASE_URL=http://localhost:11434/v1
OLLAMA_LOCAL_MODEL=llama3.1:8b

# 後方互換（非推奨・OLLAMA_MODE 未設定時に使用）
OLLAMA_API_KEY=
OLLAMA_BASE_URL=https://ollama.com/v1
OLLAMA_MODEL=gpt-oss:120b

# Gemini
GEMINI_API_KEY=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_MODEL=gemini-2.5-flash

# OpenAI
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=

# OpenCode Zen (Free)
OPENCODE_API_KEY=
OPENCODE_BASE_URL=https://opencode.ai/zen/v1
OPENCODE_MODEL=

# OpenCode Go (Subscription)
OPENCODE_GO_API_KEY=
OPENCODE_GO_BASE_URL=https://opencode.ai/zen/go/v1
OPENCODE_GO_MODEL=
```

### テスト

```
frontend/src/__tests__/
├── AnalysisPanel.test.tsx               # 新規: computeAnalysis のユニットテスト（主導性・行列・オートポイエーシス度）
└── DebateVisualizer.test.tsx            # 新規: inferTarget / buildDebateArrows のユニットテスト
```

## Docker / コンテナ構成

本フェーズは Docker 構成を変更しない（バックエンド変更は `config.py` / `schemas.py` のみで、Dockerfile / `docker-compose.yml` / ボリューム / ネットワークに影響なし）。

- イメージ: 既存 `backend/Dockerfile` / `frontend/Dockerfile` を維持
- ヘルスチェック: 既存のまま
- ボリューム・ネットワーク: 既存のまま
- 検証: `docker compose up --build` 後、`http://localhost:5173` で AC-1〜AC-25 が検証可能

## 変更範囲の明示

- **変更（バックエンド）**: `backend/app/config.py`, `backend/app/schemas.py`
- **変更（フロント）**: `App.tsx`, `components/{SocietyPanel,NetworkGraph,MessageBubble,TimelineList,TimelineDots,StatsPanel,AgentAvatar,SimulationForm,AgentEditor,AgentEditorCard,BinaryCodeGauge,EducationalPanel}.tsx`, `lib/stats.ts`（既存維持・確認のみ）, `types.ts`, `index.css`, `data/presets.ts`
- **新規（フロント）**: `components/{AnalysisPanel,DebateVisualizer}.tsx`, `lib/analysis.ts`, `__tests__/{AnalysisPanel,DebateVisualizer}.test.tsx`
- **変更（設定）**: `.env.example`, `config/presets/agents-{3,5,7,3-dynamic}.yaml`, `config/agents.yaml`
- **変更しない（バックエンド）**: `backend/app/{server,simulation,agents,llm_client,logger,main}.py`
- **変更しない（フロント）**: `components/{GlitchText,SpeakCountChart}.tsx`, `lib/{avatar,yaml}.ts`, `api/client.ts`, `tailwind.config.js`, `package.json`

## 未解決の課題

- **OQ-1（解決済み）**: `DebateVisualizer` は `NetworkGraph` 内のトグル表示（ネットワーク / 議論構造）にする（AD-3）
- **OQ-2（延期）**: LLM 考察のプロバイダ選択は次フェーズ。本フェーズは LLM 考察自体を未実装（AD-1）
- **OQ-3（解決済み）**: `AnalysisPanel` は右 aside の `LogsReload` の下に配置（AD-4）
- **OQ-4**: 7エージェント時のエリアチャートは 7 系列になる。SocietyPanel の 320px 幅 × 80px 高で視認性が保てるか実装時に調整。必要に応じて凡例をホバーツールチップに分離
- **OQ-5（解決済み）**: `MessageBubble` は `TimelineList` 配下でのみ使用されることを grep で確認済み。`fontSize: inherit` 化の影響範囲は `TimelineList` のみ（AD-5）
- **OQ-6**: `OLLAMA_MODE=local` 時のダミー APIキー `local` がローカル Ollama で受け入れられるか実機検証が必要。失敗時は空文字にフォールバック（AD-7）
- **OQ-7**: `gpt-oss:120b` / `gemma4:31b` は高性能だが、15ターン × 7エージェント = 最大 105 発言でコスト・レイテンシが増大。ユーザーが `.env` で `MAX_TURNS` を調整できることを README に明記（本フェーズでは README 更新はスコープ外・次フェーズ）
- **OQ-8（次フェーズ）**: LLM 考察生成（`POST /api/simulations/{id}/analysis` / `backend/app/analysis.py` / `AnalysisRequest` / `AnalysisResponse`）・3D 可視化・音声合成・TTS・バックエンド永続化・認証・分析専用プロバイダ指定・シミュレーション比較機能