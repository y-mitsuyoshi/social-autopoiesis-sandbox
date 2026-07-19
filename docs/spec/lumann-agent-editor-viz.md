# Tech Spec: エージェントエディタ・発言者識別強化・グラフ可視化強化・アバターカスタマイズ

## コンテキスト

`social-autopoiesis-sandbox` は、ルーマン社会システム論に基づき複数機能システムエージェントが発言を積み重ねる様をサイバーパンク調 UI で可視化するシミュレーションアプリである。前フェーズでネットワーク図・タイムライン・統計パネル・アバターハッシュ生成は実装済み。

本フェーズでは PRD `docs/prd/lumann-agent-editor-viz.md` に基づき、(1) ブラウザ完結のエージェントエディタ、(2) 発言者識別の視認性強化、(3) ズーム/パン/ドラッグ可能なネットワーク＋累積発言数推移の折れ線グラフ、(4) アバター色相/グリフのカスタマイズ、(5) プリセット切り替え&YAMLダウンロード、を実装する。

バックエンドは `AgentSpec` オプション項目追加と `SimulationStartRequest.agents_inline` 受付のみに最小化し、シミュレーション実行ロジック・LLM クライアント・ロガーは非侵入とする。フロントは新規依存追加なし（SVG 自描画・YAML 文字列は自前ビルダ）で YAGNI を徹底する。

現行フロント構成:
- `App.tsx`: 3カラム `lg:grid-cols-[320px_1fr_360px]`。左 aside は AGENTS 一覧 + SocietyPanel、中央は NetworkGraph(420px) + TimelineList(360px)、右 aside は StatsPanel + SimulationForm。
- `AgentAvatar` (`lib/avatar.ts` の `generateAvatar`): `hashHue(binaryCode)` で HSL 色決定、`concernGlyph(concern)` でグリフ決定。
- `NetworkGraph`: 円周レイアウト固定、ズーム/パン/ドラッグなし、エッジ太さ `1 + log2(count+1)`。
- `MessageBubble`: アバター 48px、エージェント名 10px、色アクセントなし。
- バックエンド `POST /api/simulations`: `agents_config`（YAMLパス）→ `load_agents` → `AgentConfigFile` バリデーション。

## 目標 / 非目標

- **目標**
  - PRD FR-1〜FR-5 および AC-1〜AC-23 をすべて満たす。
  - `docker compose up --build` 後、ブラウザ単独でエージェント構成編集→投入→観察→YAMLエクスポートの一環ワークフローが完結する。
  - バックエンド変更を `schemas.py` + `server.py` の2ファイルに閉じ込め、`agents.py` / `simulation.py` / `llm_client.py` / `logger.py` / `main.py` は変更しない。
  - フロントは新規 npm 依存を追加せず、SVG 自描画 + 既存 `framer-motion` のみで実装する。
  - `./.shared-agents/harness/verify.sh` が ruff / mypy --strict / pytest / eslint / tsc -b / vitest run の全項目でグリーン。
- **非目標**
  - バックエンドでの YAML 永続化（編集構成のサーバ保存）は行わない（次フェーズ）。
  - 3D 可視化、音声合成、認証、マルチシミュレーション同時実行はスコープ外。
  - `agents_inline` の件数上限・`avatar_glyph` の文字種制限は設けない（PRD OQ-3/OQ-5）。
  - 過去ログリロード時（`/api/simulations/{id}/logs`）の `avatar_hue`/`avatar_glyph` 復元は行わない（ハッシュ自動生成にフォールバック）。

## アーキテクチャ上の決定

- **ADR-1: `agents_inline` 受付は `server.py` 側で `AgentConfigFile.model_validate({"agents": agents_inline})` を呼ぶ** (理由: `agents.py` の `load_agents` は YAML パス解決とファイル I/O を担う。インライン受付は I/O 不要で `AgentConfigFile` の `model_validator`（空・重複チェック）を再利用するだけで十分。YAGNI で `agents.py` は変更しない。)

- **ADR-2: `agents_config` と `agents_inline` の排他制御は `SimulationStartRequest` の `model_validator(mode="after")` で実装** (理由: Pydantic の機能でリクエストボディ段階で 422 を返せる。`server.py` に if 文を増やさず、`HTTPException(422)` ではなく FastAPI の標準バリデーションエラー形式に揃う。)

- **ADR-3: プリセット配信はフロントバンドル方式**（`frontend/src/data/presets.ts` に4プリセットを TypeScript 定数として保持） (理由: OQ-1。実行時 fetch 不要・ビルド時点で型チェックが効く・新規依存なし。`config/presets/*.yaml` と内容を同期する運用は既存 YAML を唯一の真実とし、フロント定数は「コピー」として扱う。ズレ検知はテスト（`presets.test.ts` で YAML 内容と一致を検証）で担保。)

- **ADR-4: YAML ダウンロードは自前シリアライザ** (`lib/yaml.ts` に `serializeAgentsYaml(specs: AgentSpecInput[]): string` を実装) (理由: OQ-1 関連。`js-yaml` などの新規依存を追加せず、`agents:` + インデント付き `- name: ...` の固定フォーマットをビルド。入力フィールドが固定なのでエスケープは `'` で囲む簡易方式で十分。)

- **ADR-5: `AgentNode` 型拡張で `avatarHue?` / `avatarGlyph?` を追加** (理由: FR-2.3 の「4箇所で同色」を実現するため、`agents` map 構築時にフロントが保持する `agentSpecs`（送信した `agents_inline`）を参照して各 `AgentNode` に `avatarHue`/`avatarGlyph` を付与する。`Message` 型は拡張せずバックエンド `Message` モデルは不変。)

- **ADR-6: ネットワーク図のズーム/パン/ドラッグは純 SVG + React state + pointer events で実装** (理由: OQ-4。`d3-zoom` 等の依存追加なし。`viewBox` を state で持ち `wheel` / `pointermove` で更新。ドラッグはノードの `<g>` に `onPointerDown` を置き、グローバル `pointermove`/`pointerup` で追跡。`requestAnimationFrame` は不要・state 更新を React 18+ の自動バッチに委ねる。)

- **ADR-7: `SpeakCountChart.tsx` は SVG 自描画** (`<path>` の `d` 属性を `messages` から `useMemo` で構築) (理由: NFR-1。グラフライブラリ不要。100ターン×7エージェント程度なら `<polyline>` 7本で 60fps 余裕。)

- **ADR-8: `AgentEditor` は左 aside に常時表示** (理由: OQ-2。3カラムグリッド `lg:grid-cols-[320px_1fr_360px]` を維持し、左 aside を `AgentEditor` に差し替え。`SocietyPanel` は `AgentEditor` の下にスタック。モーダルは導入しない。)

- **ADR-9: `AgentSpec.avatar_hue` の範囲は `Field(ge=0, le=359)`** (理由: HSL hue の定義域。0未満・360以上は Pydantic が 422 で弾く。`int | None = None` で後方互換。)

- **ADR-10: `avatar_glyph` は `str | None = None`、文字種・長さ制限なし** (理由: OQ-5。表示幅超過は CSS `max-width` + `overflow: hidden` + `text-overflow: ellipsis` で吸収。)

## データモデル・インメモリ状態設計

### バックエンド (Python / Pydantic)

`backend/app/schemas.py`:

```python
class AgentSpec(BaseModel):
    name: str
    binary_code: str
    concern: str
    system_prompt: str
    provider: Literal["ollama", "gemini", "openai", "opencode"]
    model: str
    is_meta: bool = False
    avatar_hue: int | None = Field(default=None, ge=0, le=359)
    avatar_glyph: str | None = None

    # 既存の name / model validator は維持


class SimulationStartRequest(BaseModel):
    trigger_message: str
    max_turns: int = Field(ge=0)
    agents_config: str | None = None
    agents_inline: list[AgentSpec] | None = None
    agent_order_mode: Literal["fixed", "dynamic"] | None = None
    history_length: int | None = None

    @model_validator(mode="after")
    def validate_exclusive_agents_source(self) -> "SimulationStartRequest":
        if self.agents_config is not None and self.agents_inline is not None:
            raise ValueError(
                "agents_config and agents_inline are mutually exclusive"
            )
        return self
```

`backend/app/server.py` の `start_simulation` 内 `agents` 構築ロジック:

```python
agents: list[AgentSpec]
if request.agents_inline is not None:
    try:
        file_model = AgentConfigFile.model_validate(
            {"agents": [a.model_dump() for a in request.agents_inline]}
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    agents = file_model.agents
else:
    if request.agents_config is not None and ".." in request.agents_config:
        raise HTTPException(status_code=422, detail="agents_config must not contain '..'")
    try:
        agents, _ = load_agents(request.agents_config or app_config.agents_config, app_config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
```

- `asyncio.Lock` 適用箇所: 既存 `_lock` で `_simulations` / `_loggers` / `_tasks` へのアクセスを保護（変更なし）。`agents_inline` 受付はリクエストスコープでロック不要。

### フロントエンド (TypeScript)

`frontend/src/types.ts` 拡張:

```typescript
export interface AgentNode {
  name: string;
  binaryCode: string;
  concern: string;
  provider: string;
  model: string;
  speakCount: number;
  state: AgentState;
  avatarHue?: number;
  avatarGlyph?: string;
  isMeta?: boolean;
}

export interface AgentSpecInput {
  name: string;
  binary_code: string;
  concern: string;
  system_prompt: string;
  provider: "ollama" | "gemini" | "openai" | "opencode";
  model: string;
  is_meta: boolean;
  avatar_hue: number | null;
  avatar_glyph: string | null;
}

export interface StartSimulationParams {
  trigger_message: string;
  max_turns: number;
  agents_config?: string;
  agents_inline?: AgentSpecInput[];
  agent_order_mode?: "fixed" | "dynamic";
  history_length?: number;
}
```

`App.tsx` の state 拡張:

```typescript
const [agentSpecs, setAgentSpecs] = useState<AgentSpecInput[]>([]);
```

- `agents` useMemo 内で `agentSpecs` を参照し、`agent_name` → `avatarHue`/`avatarGlyph`/`isMeta` を復元。
- `handleSubmit` で `agents_inline: agentSpecs` を送信。

`NetworkGraph` 内 state:

```typescript
const [draggedNode, setDraggedNode] = useState<string | null>(null);
const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 600, h: 600, zoom: 1 });
```

- `agentNames` が変化した場合のみ `positions` を円周レイアウトで再初期化（`useMemo` の依存配列で `agentNames.join(",")` を使用）。
- `viewBox.x = (1 - zoom) * 300`、`viewBox.w = 600 / zoom` でズーム中心を維持。

`AgentEditor` 内 state:

```typescript
const [specs, setSpecs] = useState<AgentSpecInput[]>([]);
const [presetName, setPresetName] = useState<string>("agents-5");
const [dirty, setDirty] = useState<boolean>(false);
```

- `dirty` は specs が編集された場合 true。プリセット切り替え時に `window.confirm` で確認。

## API・WebSocketプロトコル設計

### REST API

#### `POST /api/simulations` (変更)

リクエストボディ（新規フィールド追加・後方互換）:

```json
{
  "trigger_message": "お題",
  "max_turns": 5,
  "agents_inline": [
    {
      "name": "経済システム",
      "binary_code": "支払/非支払",
      "concern": "コスト・利益",
      "system_prompt": "...",
      "provider": "ollama",
      "model": "gemma4:31b",
      "is_meta": false,
      "avatar_hue": 120,
      "avatar_glyph": "¥"
    }
  ],
  "agent_order_mode": "fixed"
}
```

- `agents_config` と `agents_inline` 両方指定 → 422 (`{"detail": "agents_config and agents_inline are mutually exclusive"}`)
- `agents_inline: []` 空配列 → 422 (`AgentConfigFile` の `agents` 空バリデーション）
- `agents_inline` 内で `name` 重複 → 422 (`AgentConfigFile` の重複バリデーション）
- `agents_inline` 内で `avatar_hue: 400` → 422 (`Field(le=359)`)
- レスポンスは従来通り `SimulationStartResponse`（`simulation_id` / `status`）

#### 既存エンドポイント（変更なし）

- `GET /api/simulations/{id}`
- `GET /api/simulations/{id}/logs`
- `GET /api/simulations/{id}/stream`
- `WS /ws/simulations/{id}`

### WebSocket メッセージプロトコル（変更なし）

`Message` モデルは拡張しない。`avatar_hue` / `avatar_glyph` はフロントが `agentSpecs` state から `agent_name` でルックアップする。過去ログリロード時（`/logs`）は spec 情報が欠落するためハッシュ自動生成にフォールバック（許容・ADR-5）。

### プリセット配信（新規なし）

フロント `frontend/src/data/presets.ts` にバンドル。`agents-3` / `agents-5` / `agents-7` / `agents-3-dynamic` の4定数を `AgentSpecInput[]` 形式で保持。`/api/presets/*` エンドポイントは追加しない（ADR-3）。

## コンポーネント構成 (Python & React)

### Python（バックエンド）

```
backend/app/
├── schemas.py         # 変更: AgentSpec に avatar_hue/avatar_glyph 追加
│                      #      SimulationStartRequest に agents_inline + model_validator 追加
├── server.py          # 変更: start_simulation で agents_inline 経路追加
├── agents.py          # 変更なし
├── simulation.py      # 変更なし
├── llm_client.py      # 変更なし
├── logger.py          # 変更なし
├── config.py          # 変更なし
└── main.py            # 変更なし

backend/tests/
├── test_server.py     # 変更: agents_inline のテスト追加
└── test_schemas.py    # 変更: avatar_hue/avatar_glyph, agents_inline 排他のテスト追加
```

### React（フロントエンド）

```
frontend/src/
├── App.tsx                              # 変更: agentSpecs state, AgentEditor 組込, agents 構築で avatarHue/Glyph 復元
├── types.ts                             # 変更: AgentNode/AgentSpecInput/StartSimulationParams 拡張
├── api/client.ts                        # 変更: StartSimulationParams に agents_inline 追加
├── lib/
│   ├── avatar.ts                        # 変更: generateAvatar に avatarHue/avatarGlyph オプション
│   ├── stats.ts                         # 変更なし
│   └── yaml.ts                          # 新規: serializeAgentsYaml(specs): string
├── data/
│   └── presets.ts                       # 新規: PRESETS: Record<string, AgentSpecInput[]>
├── components/
│   ├── AgentAvatar.tsx                  # 変更: avatar.avatarHue/Glyph 優先
│   ├── NetworkGraph.tsx                 # 変更: ドラッグ/ズーム/パン/リセット/凡例/エッジ太さ強調/ノードラベル常時
│   ├── MessageBubble.tsx                # 変更: アバター 64px・ヘッダ 12px・左ボーダー 4px アバター色
│   ├── TimelineList.tsx                 # 変更: currentSpeaker 行の左ボーダー点滅
│   ├── TimelineDots.tsx                 # 変更: currentSpeaker ドットの強調リング
│   ├── SimulationForm.tsx               # 変更: onSubmit に agents_inline 伝播用のプロップス拡張
│   ├── StatsPanel.tsx                   # 変更: AGENT SPEAK COUNT バーを avatarHue 色に
│   ├── SpeakCountChart.tsx              # 新規: SVG 折れ線グラフ
│   ├── AgentEditor.tsx                  # 新規: プリセット切替・エージェント一覧編集・START・YAMLダウンロード
│   ├── AgentEditorCard.tsx              # 新規: 1エージェント編集カード
│   ├── SocietyPanel.tsx                 # 変更なし
│   └── GlitchText.tsx                   # 変更なし
└── __tests__/
    ├── AgentEditor.test.tsx             # 新規
    ├── SpeakCountChart.test.tsx         # 新規
    ├── AgentAvatar.test.tsx            # 変更: avatarHue/avatarGlyph オプション
    ├── NetworkGraph.test.tsx           # 変更: ドラッグ/ズーム/エッジ太さ
    ├── yaml.test.ts                    # 新規: serializeAgentsYaml
    └── presets.test.ts                 # 新規: バンドル定数と config/presets/*.yaml の一致検証
```

### コンポーネント詳細

#### `AgentEditor.tsx`

Props:
```typescript
interface AgentEditorProps {
  specs: AgentSpecInput[];
  onSpecsChange: (specs: AgentSpecInput[]) => void;
  onSubmit: (params: {
    trigger_message: string;
    max_turns: number;
    agent_order_mode: "fixed" | "dynamic";
    agents_inline: AgentSpecInput[];
  }) => void;
  disabled?: boolean;
}
```

UI 構造:
- 上部: プリセットドロップダウン（`agents-3` / `agents-5` / `agents-7` / `agents-3-dynamic`）+「LOAD」ボタン
- 中部: `AgentEditorCard` のリスト（追加ボタン「+ ADD AGENT」最下部）
- 下部: trigger_message textarea / max_turns number / agent_order_mode radio / START ボタン /「DOWNLOAD YAML」ボタン
- バリデーション: `name` 空・重複、`model` 空、`is_meta=true` 0件で dynamic 選択時にインラインエラー・START 無効化
- `dirty` 状態でプリセット切替時に `window.confirm("未保存の編集があります。破棄して読み込みますか？")`

#### `AgentEditorCard.tsx`

Props:
```typescript
interface AgentEditorCardProps {
  spec: AgentSpecInput;
  index: number;
  onChange: (spec: AgentSpecInput) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}
```

フィールド:
- `name` (text input)
- `binary_code` (text input)
- `concern` (text input)
- `system_prompt` (textarea, rows=6)
- `provider` (select: ollama/gemini/openai)
- `model` (text input)
- `is_meta` (checkbox)
- `avatar_hue` (range 0-359 + number input, ラベルに現在 hue の HSL カラースウォッチ)
- `avatar_glyph` (text input, maxlength=3)
- リアルタイムプレビュー: `AgentAvatar agent={...} size={64}` を右上に表示
- 操作ボタン: 「DUPLICATE」「REMOVE」

#### `SpeakCountChart.tsx`

Props:
```typescript
interface SpeakCountChartProps {
  messages: Message[];
  agents: Record<string, AgentNode>;
  maxTurns: number;
}
```

- X軸: 0..maxTurns、Y軸: 0..max(perAgentCount)
- 各エージェント1本の `<polyline>`、色は `agent.avatarHue ?? hashHue(agent.binaryCode)`
- `messages` を `useMemo` で `[turn][agentName] = cumulativeCount` の二次元集計に変換
- 凡例: 右上にエージェント名+色

#### `NetworkGraph.tsx`（拡張）

新機能:
- `viewBox` state: `{ x, y, w, h }`、初期 `{0, 0, 600, 600}`
- `zoom` state: 1.0、範囲 0.5..2.0、`wheel` イベントで `zoom *= event.deltaY < 0 ? 1.1 : 0.9`
- パン: 背景 `<rect>` に `onPointerDown`、`pointermove` で `viewBox.x/y` 更新
- ノードドラッグ: `<g>` に `onPointerDown`、`positions[name]` を更新
- `agentNames` 変化時のみ `positions` を `layoutNodes` で再初期化（`useMemo` 依存 `agentNames.join(",")`）
- リセットボタン: 右上 `<button>` で `viewBox` と `positions` を初期化
- 凡例: 左下に「太い＝発話のやり取りが多い」テキスト
- ノードラベル: 既存の `text` を常時表示（既存実装）
- 現在発言中ノード: 既存パルスアニメ + ノードを 1.2x スケール

#### `MessageBubble.tsx`（拡張）

- アバター `size={64}`
- ヘッダ左ボーダー `borderLeft: 4px solid hsl(${hue}, 80%, 60%)`
- エージェント名 `text-[12px] font-bold`
- `isLast` 時 `●LIVE` 表示（既存）

### テスト戦略

| テストファイル | 検証内容 |
|---|---|
| `backend/tests/test_schemas.py` | `AgentSpec.avatar_hue` 範囲外 422、`agents_inline` + `agents_config` 排他 422、`agents_inline: []` 422 |
| `backend/tests/test_server.py` | `agents_inline` で3エージェント送信→201、重複 name→422、`agents_config` との排他→422 |
| `frontend/src/__tests__/AgentEditor.test.tsx` | プリセット読込・追加・削除・複製・編集・START 無効化・YAMLダウンロード |
| `frontend/src/__tests__/AgentEditorCard.test.tsx` | 各フィールド編集・avatar_hue スライダー・リアルタイムプレビュー |
| `frontend/src/__tests__/SpeakCountChart.test.tsx` | 折れ線グラフ描画・色・軸スケール |
| `frontend/src/__tests__/AgentAvatar.test.tsx` | `avatarHue`/`avatarGlyph` オプションで SVG 内の hue/glyph が上書きされること |
| `frontend/src/__tests__/NetworkGraph.test.tsx` | ドラッグで positions 更新・wheel で zoom 変化・リセットボタン・エッジ太さが count に比例 |
| `frontend/src/__tests__/yaml.test.ts` | `serializeAgentsYaml` が `config/presets/agents-5.yaml` と等価の出力を生成（空白・インデント含む） |
| `frontend/src/__tests__/presets.test.ts` | バンドル定数4件が存在・各フィールドが非空 |

## Docker / コンテナ構成

- **イメージ**: 変更なし（`backend/Dockerfile` / `frontend/Dockerfile` そのまま）
- **ヘルスチェック**: 変更なし
- **ボリューム・ネットワーク**: 変更なし
- **`docker-compose.yml`**: 変更なし
- **新規依存**: なし（frontend `package.json` / backend `pyproject.toml` ともに変更なし）
- **再ビルド**: `docker compose up --build` で反映。`config/presets/*.yaml` は backend イメージにCOPY済み、frontend は `frontend/src/data/presets.ts` をバンドル。

## 未解決の課題

- **OQ-1 プリセット配信方式**: ADR-3 でバンドル方式に決定。`config/presets/*.yaml` と `frontend/src/data/presets.ts` の二重管理を `presets.test.ts` で検証するが、CI で `config/presets/` を読み込む必要がある。Vitest は `fs` を使えないため `import.meta.glob` で YAML を取り込むか、`config/presets/*.yaml` を frontend ビルド時に `?raw` import して比較する方式を実装時に検証する。

- **OQ-2 AgentEditor 配置**: ADR-8 で左 aside 常時表示に決定。320px 幅に `AgentEditor`（プリセット+エディタ+START）と `SocietyPanel` をスタック。エディタが長くなる場合は aside 内スクロール。

- **OQ-3 `agents_inline` 上限**: YAGNI で上限なし。50件以上投入時は LLM クライアント構築で OOM になる可能性があるが、本フェーズでは許容。

- **OQ-4 グラフライブラリ依存**: ADR-6 で純 SVG 実装に決定。実装で破綻した場合のみ `d3-zoom` 追加を再検討。

- **OQ-5 `avatar_glyph` 文字種**: ADR-10 で制限なし。マルチバイト・絵文字許容。SVG `<text>` 内で表示幅超過時は `font-size` を `glyph.length` に応じて縮小するロジックを `generateAvatar` に実装（`glyph.length > 2 ? 14 : 18`）。

- **OQ-6 過去ログリロード時のアバター復元**: ADR-5 で `agentSpecs` state からのルックアップに決定。`/logs` リロード時は spec 情報がないためハッシュ自動生成にフォールバック。これは許容するが、ユーザー体験としては「色が変わる」現象が起きる。次フェーズで `Message` モデル拡張または `/api/simulations/{id}/spec` エンドポイント追加を検討。

- **OQ-7 YAML ダウンロードのエスケープ**: `lib/yaml.ts` の `serializeAgentsYaml` は `system_prompt` に改行・特殊文字（`:`, `#`, `'`）が含まれる場合、YAML ブロックスカラー `|` を使用。`name` に `:` が含まれる場合は `'...'` で囲む。実装時にエッジケースを `yaml.test.ts` で網羅。

- **OQ-8 `SpeakCountChart` の Y軸スケール**: `maxTurns` が 0 の場合（無限モード）は X軸を `messages.length` に合わせて可変長にする。実装時に確認。