# PRD: オートポイエーシス可視化強化・考察・ターン増・UX改善・カオス感・Ollama分離・モデル性能向上

## 概要と目標

`social-autopoiesis-sandbox` は、ニクラス・ルーマンの社会システム論に基づき、複数の機能システム（経済・法・科学・芸術・メディア・政治・教育）エージェントが自律的に発言を積み重ねて社会をオートポイエティクス的に構築する様を、攻殻機動隊風サイバーパンク UI で可視化するシミュレーションアプリである。

前フェーズでエージェントエディタ・ドラッグ/ズーム・折れ線グラフ・アバターカスタマイズは実装済み。本フェーズは**ビジュアル表現の強化・UX改善・設定整理**に集中し、ユーザーから要望された 7 本柱（オートポイエーシス構築過程のグラフィカル化・結果考察・ターン増・文字サイズ改善・AI議論の構造化とカオス感・Ollama Cloud/Local分離・デフォルトモデル性能向上）を実現する。

**目標:**
1. ルーマンのオートポイエーシスが「どのように構築されたか」を、発言連鎖の波・積み上がりエリアチャート・構造的連結アニメーションで視覚的に理解できるようにする。
2. シミュレーション終了後に、各システムの主導性・相互作用パターン・オートポイエーシス度スコア・LLM考察サマリーを自動生成し、考察を深められるようにする。
3. デフォルトターン数を 9 → 15 に増やし、より長い議論の展開を観察できるようにする。
4. 全コンポーネントの小さすぎる文字（`text-[9px]` / `text-[10px]` / `text-xs` 等）を最小 14px に引き上げ、タイムラインズーム（S/M/L）が効かない問題を修正し、全体のベースフォントを 13px → 15px にする。
5. AI 同士の議論を「発言者→対象」の矢印で空間的に構造化し、発話中アバターの口元パルス・音波エフェクト・複数エージェント同時 thinking 演出・ノード微小振動でカオス感を表現する。
6. Ollama Cloud と Local を環境変数で明確に分離し、`OLLAMA_MODE=cloud|local` で切り替え可能にする（後方互換のため既存 `OLLAMA_*` 変数は残置）。
7. プリセット YAML と `.env.example` のデフォルトモデルを性能の高いもの（`gemma4:31b` / `gpt-oss:120b` / `llama3.1:8b` 等）に更新し、各システムで多様性を持たせる。

## ターゲットユーザー / ユースケース

- **U-1 シミュレーション実験者（研究者/学生）**
  - ルーマンのオートポイエーシスが「発言連鎖でどう構築されたか」をグラフィカルに観察したい。
  - シミュレーション終了後に、どのシステムが主導したか・どのシステム間で相互作用が起きたか・オートポイエーシス度がどれくらい高まったかを定量的・定性的に考察したい。
  - ターン数を増やして長めの議論を観たい。
- **U-2 デモ閲覧者（非エンジニア）**
  - 文字が小さくて読めない箇所があるので、快適に読める文字サイズにしたい。
  - ズームボタン（S/M/L）を押しても効かないので直したい。
  - AI 同士の議論が文字だけでは流れがわかりにくいので、矢印やアバター発話演出で視覚的に把握したい。
  - カオス感・熱量のある議論の様子を体感したい。
- **U-3 設計者（本リポジトリ開発者）**
  - Ollama Cloud と Local を明確に分け、どちらを使っているか一目で分かるようにしたい。
  - デフォルトモデルを性能の良いものにし、各システムで多様性を持たせたい。
  - 設定ミス（Local なのに Cloud キーを要求等）を防ぎたい。

ユースケースフロー:
1. `.env` で `OLLAMA_MODE=cloud` を設定、`OLLAMA_CLOUD_API_KEY` / `OLLAMA_CLOUD_MODEL=gpt-oss:120b` を記入
2. ブラウザで `http://localhost:5173` を開き、プリセット `agents-7` を選択（デフォルトターン数 15 が表示）
3. 「START」でシミュレーション開始
4. 実行中、SocietyPanel の積み上がりエリアチャートが発言ごとに成長、ネットワーク図のエッジ上を光が走る
5. 発話中アバターが口元パルス・音波エフェクトで「話している」感覚を演出、複数エージェントが同時 thinking でカオス感
6. タイムラインの S/M/L ボタンで文字サイズが即座に切り替わる（修正済み）
7. 完了後、`AnalysisPanel` が自動表示: 主導性スコア・相互作用行列ヒートマップ・オートポイエーシス度・LLM考察サマリー
8. 文字サイズが全パネルで 14px 以上になり、快適に読める

## 機能要件 (必須)

### FR-1: オートポイエーシス構築過程のグラフィカル強化

- **FR-1.1** `SocietyPanel.tsx` を拡張し、「社会構成度」を時系列で積み上がる**エリアチャート**（stacked area）で表示する。X軸=ターン、Y軸=各システムの累積発言数を積み上げた合計。各システムの色は既存の `hashHue` / `avatar_hue` パレットに統一。WebSocket メッセージ到着ごとにリアルタイム更新。
- **FR-1.2** 各発言が「どのシステム間の構造的連結を形成したか」を、ネットワーク図上でアニメーション付きで表示する。直前の発言者ノードから新発言者ノードへ、エッジに沿って光が走るアニメーション（`stroke-dashoffset` アニメーション、duration 1.2s）。新エッジ形成時はエッジが一度太く発光して定常状態に落ち着く。
- **FR-1.3** ネットワーク図のエッジに「連鎖の波」アニメーションを追加。発言が次発言を呼ぶ際、該当エッジ上を光パルス（`<animateMotion>` または `stroke-dasharray` + `stroke-dashoffset`）が走る。`buildEdges` で既出のエッジも含め、直近ターンで使われたエッジをハイライトする。
- **FR-1.4** SocietyPanel の既存バー（発言数・エッジ密度・活性度）は維持しつつ、その上にエリアチャートを追加。エリアチャートは高さ 80px 程度のミニチャートとして配置。15ターン × 7エージェント程度でも崩れない描画とする。
- **FR-1.5** エリアチャートの実装は純 SVG + React state で行い、新規グラフライブラリ依存は追加しない（YAGNI）。`messages` と `agents` から `useMemo` で series データを導出。

### FR-2: 結果考察パネル（`AnalysisPanel.tsx` 新設）

- **FR-2.1** シミュレーション完了（`status === "completed"`）後、右 aside または下部に `AnalysisPanel` を自動表示する。idle/running 中は非表示またはスケルトン。
- **FR-2.2** **各システムの発言回数・平均発言長・主導性スコア**を表示:
  - 発言回数: 既存 `perAgentCount` を流用
  - 平均発言長: `messages` から `message.length` の平均をシステム別に算出
  - 主導性スコア: `(発言回数 / 総発言数) × (平均発言長 / 全体平均発言長)` を 0-1 正規化。1.0 を超える場合はクリップ
- **FR-2.3** **システム間相互作用パターンの行列ヒートマップ**を表示。行=from（応答元）、列=to（応答先）。各セルの値は `buildEdges` の `count`。セル色は count に応じて `cyberpunk-neon`（低）→ `cyberpunk-accent`（高）のグラデーション。対角線（自己応答）はグレーアウト。
- **FR-2.4** **オートポイエーシス度スコア**を算出・表示:
  - エッジ密度（既存 `edgeDensity`）
  - 多様性: `1 - (最大発言数システムの発言数 / 総発言数)`（0.5 で均等、1.0 で完全分散）
  - 連鎖長: 最長連続異システム応答列の長さ / 総発言数
  - 総合スコア: `(エッジ密度 + 多様性 + 連鎖長) / 3` を 0-1 で表示。バーまたはゲージで可視化
- **FR-2.5** **LLM による考察サマリー**は次フェーズ以降に延期（本フェーズでは統計計算のみ）:
  - 本フェーズでは `AnalysisPanel` に「LLM考察: 次フェーズで実装予定」のプレースホルダを表示
  - `POST /api/simulations/{id}/analysis` エンドポイント・`AnalysisRequest`/`AnalysisResponse` Pydanticモデル・`backend/app/analysis.py` は次フェーズで実装
  - 理由: YAGNI・本フェーズはビジュアル強化・UX改善・設定整理に集中
- **FR-2.6** 統計計算（FR-2.2〜FR-2.4）はフロント `lib/analysis.ts` 新設で純関数として実装し、Vitest でユニットテストを追加。

### FR-3: デフォルトターン数増加

- **FR-3.1** `.env.example` の `MAX_TURNS` を `9` → `15` に変更。
- **FR-3.2** フロントエンド `SimulationForm` のデフォルト `maxTurns` state 初期値を `3` → `15` に変更（`App.tsx` 経由で渡されるデフォルト値も整合）。
- **FR-3.3** バックエンド `config.py` / `schemas.py` の `max_turns` バリデーション（`ge=0`）は変更なし。15 は既存制約内で合法。
- **FR-3.4** `MAX_TURNS` の上限は設けない（YAGNI）。異常な巨大値が来た場合は LLM クライアントのタイムアウトで自然に失敗する既存挙動に委ねる。

### FR-4: 文字サイズ改善

- **FR-4.1** 全コンポーネントの `text-[9px]` / `text-[10px]` / `text-[11px]` / `text-xs`（12px）等の小さすぎる文字サイズを**最小 14px** に引き上げる。対象コンポーネント（抜粋）:
  - `App.tsx`: `text-[9px]`（SECTION 9 ラベル）→ `text-sm`、`text-[10px]`（NET/SIM STATUS）→ `text-sm`
  - `SocietyPanel.tsx`: `text-[10px]` → `text-sm`
  - `StatsPanel.tsx`: `text-[10px]` / `text-[11px]` → `text-sm`
  - `MessageBubble.tsx`: `text-[10px]`（ヘッダ）→ `text-sm`、`text-[13px]`（本文）→ `text-[15px]`
  - `NetworkGraph.tsx`: SVG `fontSize={9}` / `fontSize={10}` / `fontSize={11}` → `fontSize={13}` 以上
  - `AgentAvatar.tsx`: `text-[8px]`（MIC バッジ）→ `text-xs`（12px）は許容範囲だが `text-sm` 推奨
  - `TimelineList.tsx` / `TimelineDots.tsx`: `text-[10px]` → `text-sm`
  - `SimulationForm.tsx`: `text-[11px]` → `text-sm`
  - `AgentEditor.tsx` / `AgentEditorCard.tsx`: 小文字クラスを `text-sm` 以上に
- **FR-4.2** ズーム機能（`TimelineList` の S/M/L）が効かない問題を修正:
  - 現状 `ZOOM_FONT` は `S: 11, M: 13, L: 16` だが、子コンポーネント（`MessageBubble` 等）が `text-[13px]` 等の固定クラスを持つため、親の `fontSize` スタイルが子の Tailwind クラスに上書きされて効かない
  - 修正方針: `MessageBubble` の本文 `text-[13px]` を `style={{ fontSize: "inherit" }}` に変更し、親の `ZOOM_FONT` を継承。または `ZOOM_FONT` を `S: 14, M: 16, L: 19` に引き上げた上で、子の固定クラスを削除して継承に統一
  - ヘッダのメタ情報（ターン番号・プロバイダ等）は `text-sm` に統一し、ズームの影響を受けない固定サイズとする（本文のみズーム追従）
- **FR-4.3** 全体のベースフォントサイズを 13px → 15px に引き上げる。`index.css` の `body` に `font-size: 15px` を明示。Tailwind の `text-base`（16px）を基準にしたクラス設計に寄せる。
- **FR-4.4** ズームの S/M/L を `S: 14, M: 16, L: 19` に再定義（最小 14px を下回らない）。ボタンラベルも `text-sm` に。
- **FR-4.5** アクセシビリティ: 全テキストのコントラスト比 4.5:1 を維持。`cyberpunk-text/40` 等の薄すぎる色は `cyberpunk-text/70` 以上に引き上げ。

### FR-5: AI議論の構造化可視化・カオス感

- **FR-5.1** `DebateVisualizer.tsx` 新設: 発言を「発言者→対象」の矢印で結び、議論の構造を空間的に配置する。
  - 対象推定ロジック: `lib/analysis.ts` に `inferTarget(message, previousMessages)` を実装。直前の発言者をデフォルト対象とし、発言テキスト内に他エージェント名・`binary_code`・`concern` キーワードが含まれる場合はそのエージェントを対象とする。推定不可時は直前発言者。
  - 可視化: 発言者ノードから対象ノードへ向かう曲線矢印（SVG `<path>` + `<marker>`）。ターンごとに矢印がフェードイン。
  - 配置: 既存 `NetworkGraph` のノード位置を流用するか、独立したミニマップとして右aside に配置。既存ネットワーク図との二重表示を避けるため、`NetworkGraph` のトグル表示（ネットワーク / 議論構造）にするか、独立パネルにするかは実装時に決定（OQ-1）。
- **FR-5.2** アバター発話アニメーション強化（`AgentAvatar.tsx`）:
  - 発言中（`state === "speaking"`）に口元パルス: アバター SVG の口元部分に小円を配置し、`scale` と `opacity` を `framer-motion` で脈動させる
  - 音波エフェクト: アバター周囲に同心円の波紋を 3 重に描き、`speaking` 時に外向きに広がるアニメーション（既存の `irritation-ripples` を強化）
  - フキダシから文字が流れる: `MessageBubble` の発言テキストが `typing` アニメーション（1文字ずつフェードイン）で表示される。既存 `isLast` && `live` の場合のみ適用
- **FR-5.3** カオス感の演出:
  - 複数エージェントが同時に `thinking` 状態になる演出: `agentOrderMode === "dynamic"` の場合は既存で全エージェント thinking だが、`fixed` モードでも「次の発言者 + その次の候補 1-2 名」を thinking 表示し、同時思考感を出す
  - 発言が重なりそうになる視覚効果: タイムラインで直近 2-3 発言が微妙に X 軸オフセット（±4px）で重なり合う演出（`framer-motion` の `x` 微小ランダム値）
  - ネットワーク図ノードの微小振動: 全ノードに `framer-motion` で ±1.5px のランダム振動（`repeat: Infinity`、`duration: 0.3-0.8s` のランダム）。`prefers-reduced-motion` 時は無効化
- **FR-5.4** `DebateVisualizer` の対象推定ロジックは `lib/analysis.ts` に純関数として実装し、Vitest ユニットテストを追加。

### FR-6: Ollama Cloud/Local 分離

- **FR-6.1** `.env.example` に Ollama Cloud と Local の設定を明確に分ける:
  ```
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
  OLLAMA_MODEL=
  ```
- **FR-6.2** `backend/app/schemas.py` の `AppConfig` に以下フィールドを追加:
  - `ollama_mode: Literal["cloud", "local"] | None = None`
  - `ollama_cloud_api_key: str | None = None`
  - `ollama_cloud_base_url: str | None = None`
  - `ollama_cloud_model: str | None = None`
  - `ollama_local_base_url: str | None = None`
  - `ollama_local_model: str | None = None`
  - 既存 `ollama_api_key` / `ollama_base_url` / `ollama_model` は後方互換のため残置
- **FR-6.3** `backend/app/config.py` の `load_config` で `OLLAMA_MODE` を読み込み、`cloud` / `local` に応じて適切な `ollama_*` フィールドを解決するロジックを追加:
  - `OLLAMA_MODE=cloud` の場合: `ollama_cloud_api_key` が必須、`ollama_cloud_base_url` はデフォルト `https://ollama.com/v1`、`ollama_cloud_model` は必須。これらを `llm_client` に渡す際の `ollama_api_key` / `ollama_base_url` / `ollama_model` として使用
  - `OLLAMA_MODE=local` の場合: `ollama_local_base_url` はデフォルト `http://localhost:11434/v1`、`ollama_local_model` は必須。APIキーは不要（空文字またはダミー `local` を設定）
  - `OLLAMA_MODE` 未設定時: 既存の `OLLAMA_API_KEY` / `OLLAMA_BASE_URL` / `OLLAMA_MODEL` を使用（後方互換）
- **FR-6.4** `AppConfig.validate_provider_credentials` を拡張し、`OLLAMA_MODE` に応じたバリデーションを行う:
  - `cloud` モードで `ollama_cloud_api_key` / `ollama_cloud_model` が未設定の場合はエラー
  - `local` モードで `ollama_local_model` が未設定の場合はエラー（APIキーは不要）
  - `OLLAMA_MODE` 未設定時は既存ロジック（`ollama_api_key` / `ollama_model` 必須）を維持
- **FR-6.5** `llm_client.py` の `build_agent_clients` は、`OLLAMA_MODE` に応じて解決された `ollama_api_key` / `ollama_base_url` / `ollama_model` を使用するよう修正。既存のインターフェースは維持し、`config.py` 側で解決済みの値を `AppConfig.ollama_*` に設定する。

### FR-7: デフォルトモデル性能向上

- **FR-7.1** プリセット YAML（`config/presets/agents-{3,5,7,3-dynamic}.yaml`）と `config/agents.yaml` のデフォルトモデルを以下に更新:
  - 経済システム: `gemma4:12b` → `gemma4:31b`
  - 科学システム: `gpt-oss:20b-cloud` → `gpt-oss:120b`
  - 法システム: `gemma4:e4b` → `llama3.1:8b`
  - 芸術システム: `gemma4:12b` → `gemma4:31b`
  - メディアシステム: `gemini-2.5-flash`（維持）
  - 政治システム: `gpt-oss:20b-cloud` → `gpt-oss:120b`
  - 教育システム: `gemma4:e4b` → `llama3.1:8b`
  - メタ・モデレータ: `gemma4:12b` → `gemma4:31b`
- **FR-7.2** フロントエンド `frontend/src/data/presets.ts` の対応する spec 関数も同様に更新。バックエンド YAML とフロント TS 定数が一致するよう同期。
- **FR-7.3** `.env.example` の `OLLAMA_MODEL` / `OLLAMA_CLOUD_MODEL` / `OLLAMA_LOCAL_MODEL` のデフォルト値を高性能モデルに更新:
  - `OLLAMA_CLOUD_MODEL=gpt-oss:120b`（Cloud 対応・高性能）
  - `OLLAMA_LOCAL_MODEL=llama3.1:8b`（Local で動作可能・軽量高性能）
  - `OLLAMA_MODEL=gpt-oss:120b`（後方互換・非推奨）
- **FR-7.4** `GEMINI_MODEL` は `gemini-2.5-flash`（現状維持）。`OPENAI_MODEL` / `OPENCODE_MODEL` / `OPENCODE_GO_MODEL` は本フェーズでは変更しない（スコープ外）。
- **FR-7.5** モデル名のバリデーションは既存の `model_must_not_be_empty` のみ。指定モデルが Ollama Cloud / Local で実際に利用可能かは実行時に LLM クライアントが判定し、不可時は `LLMError` で失敗する既存挙動に委ねる。

## 非機能要件 (パフォーマンス、UX等)

- **NFR-1 型安全**: 全新規・変更コンポーネントは TypeScript strict、`npx tsc -b` クリーン。バックエンドは `mypy --strict` クリーン。`AppConfig` 拡張（`ollama_mode`）は型安全。`Any` 使用禁止。
- **NFR-2 パフォーマンス**:
  - エリアチャート・ヒートマップ・議論構造可視化の再描画は `messages` 配列の差分で `useMemo` 済みの派生値のみ更新。15ターン × 7エージェント程度で 60fps を維持。
  - ノード微小振動は `transform` のみアニメーション（`layout` 再計算を避ける）。`prefers-reduced-motion` 時は無効化。
- **NFR-3 アクセシビリティ**:
  - 全テキスト最小 14px。コントラスト比 4.5:1 以上。
  - `prefers-reduced-motion` 時は微小振動・口元パルス・文字流しを無効化。
  - `aria-label` を新規インタラクティブ要素（`AnalysisPanel` の各セクション、`DebateVisualizer` のトグル等）に付与。
- **NFR-4 レスポンシブ**: 既存の 3カラムグリッド（`lg:grid-cols-[320px_1fr_360px]`）を維持。`AnalysisPanel` は右 aside の下部、または完了時にメインカラム下部に展開。スマートフォン幅では縦並び。
- **NFR-5 後方互換**:
  - `OLLAMA_MODE` 未設定時は既存の `OLLAMA_API_KEY` / `OLLAMA_BASE_URL` / `OLLAMA_MODEL` を使用。既存 `.env` を持つユーザーは変更なしで動作。
  - 既存 YAML プリセットで `avatar_hue` / `avatar_glyph` 未指定時はハッシュ自動生成を維持。
  - `MAX_TURNS` は既存の `ge=0` 制約内で 15 に変更するのみ。既存の 9 を指定した `.env` は引き続き 9 で動作。
- **NFR-6 セキュリティ**:
  - `OLLAMA_CLOUD_API_KEY` は `.env` に記載し `.gitignore` 対象。`OLLAMA_LOCAL_*` は APIキー不要。
  - 
  - `system_prompt` はバックエンドでそのまま LLM へ渡す（既存挫動と同一）。
- **NFR-7 検証**: `./.shared-agents/harness/verify.sh` が全項目（`ruff format --check` / `ruff check` / `mypy` / `pytest` / `eslint` / `tsc -b` / `vitest run`）でグリーン。新規ユーティリティ（`lib/analysis.ts` の統計計算・対象推定）にはユニットテストを追加。
- **NFR-8 依存最小化**: 新規フロント依存は追加しない（YAGNI）。エリアチャート・ヒートマップ・議論構造可視化は純 SVG + React state + `framer-motion`（既存依存）で実装。バックエンドも既存 `httpx` / `pydantic` / `fastapi` のみ。

## 受け入れ基準 (Acceptance Criteria)

- [ ] **AC-1** `docker compose up --build` 後、`http://localhost:5173` でアプリが起動し、`SocietyPanel` にエリアチャート（積み上がり）が表示される。
- [ ] **AC-2** シミュレーション実行中、各発言でエリアチャートがリアルタイムに成長し、各システムの色が `hashHue` / `avatar_hue` パレットと一致する。
- [ ] **AC-3** ネットワーク図で、直前の発言者ノードから新発言者ノードへエッジ上を光が走るアニメーション（duration 1.2s 程度）が表示される。新エッジ形成時はエッジが一度太く発光する。
- [ ] **AC-4** ネットワーク図のエッジで、直近ターンで使われたエッジがハイライト（連鎖の波）され、古いエッジは定常状態に戻る。
- [ ] **AC-5** シミュレーション完了（`status === "completed"`）後、`AnalysisPanel` が自動表示される。idle/running 中は非表示またはスケルトン。
- [ ] **AC-6** `AnalysisPanel` に各システムの発言回数・平均発言長・主導性スコアが表示される。主導性スコアは 0-1 に正規化され、最大発言システムが最も高いスコアになる。
- [ ] **AC-7** `AnalysisPanel` にシステム間相互作用パターンの行列ヒートマップが表示される。行=from、列=to、セル色は count に応じて `cyberpunk-neon` → `cyberpunk-accent` のグラデーション。対角線はグレーアウト。
- [ ] **AC-8** `AnalysisPanel` にオートポイエーシス度スコア（エッジ密度・多様性・連鎖長の平均、0-1）がバーまたはゲージで表示される。
- [ ] **AC-9** `AnalysisPanel` に統計ベースの考察（主導性スコア・相互作用ヒートマップ・オートポイエーシス度）が表示される。LLM考察は「次フェーズで実装予定」プレースホルダ表示。
- [ ] **AC-10** `.env.example` の `MAX_TURNS` が `15` に変更されている。`SimulationForm` のデフォルト `maxTurns` も `15` になっている。
- [ ] **AC-11** 全コンポーネントで `text-[9px]` / `text-[10px]` / `text-[11px]` / `text-xs`（12px）等の小さすぎる文字が最小 14px（`text-sm`）以上になっている。`grep -rE "text-\[9px\]|text-\[10px\]|text-\[11px\]" frontend/src/` で該当クラスが 0 件（`text-xs` は MIC バッジ等の例外的に許容される箇所のみ）。
- [ ] **AC-12** `TimelineList` の S/M/L ズームボタンを押すと、本文の文字サイズが即座に切り替わる（`S: 14, M: 16, L: 19`）。`MessageBubble` の本文が `fontSize: inherit` で親のズームを継承し、ズームが効くよう修正されている。
- [ ] **AC-13** `index.css` の `body` に `font-size: 15px` が明示され、全体のベースフォントが 15px になっている。
- [ ] **AC-14** `DebateVisualizer` が表示され、発言者→対象の矢印で議論の構造が空間的に配置される。対象推定ロジック（`inferTarget`）が直前発言者または発言テキスト内キーワードから対象を推定する。
- [ ] **AC-15** 発言中（`state === "speaking"`）のアバターに口元パルス・音波エフェクト（同心円 3 重）が表示される。`MessageBubble` の発言テキストが `isLast && live` の場合に typing アニメーション（1文字ずつフェードイン）で表示される。
- [ ] **AC-16** 複数エージェントが同時に `thinking` 状態になる演出が表示される（`fixed` モードでも次発言者 + 候補 1-2 名が thinking）。タイムラインの直近 2-3 発言が微小 X 軸オフセットで重なり合う演出がある。ネットワーク図ノードに ±1.5px の微小振動がある。`prefers-reduced-motion` 時はこれらが無効化される。
- [ ] **AC-17** `.env.example` に `OLLAMA_MODE=cloud` と Cloud/Local の分離された設定セクションが追加されている。`OLLAMA_CLOUD_API_KEY` / `OLLAMA_CLOUD_BASE_URL` / `OLLAMA_CLOUD_MODEL` と `OLLAMA_LOCAL_BASE_URL` / `OLLAMA_LOCAL_MODEL` が明確に分かれている。既存 `OLLAMA_API_KEY` / `OLLAMA_BASE_URL` / `OLLAMA_MODEL` は後方互換として残置。
- [ ] **AC-18** `OLLAMA_MODE=cloud` で `OLLAMA_CLOUD_API_KEY` / `OLLAMA_CLOUD_MODEL` が未設定の場合、バックエンド起動時にエラーになる。`OLLAMA_MODE=local` で `OLLAMA_LOCAL_MODEL` が未設定の場合もエラー。`local` モードで APIキーは不要。
- [ ] **AC-19** `OLLAMA_MODE` 未設定時は既存の `OLLAMA_API_KEY` / `OLLAMA_BASE_URL` / `OLLAMA_MODEL` が使用され、既存 `.env` で変更なく動作する（後方互換）。
- [ ] **AC-20** プリセット YAML（`config/presets/agents-{3,5,7,3-dynamic}.yaml`）と `config/agents.yaml` のデフォルトモデルが更新されている: 経済=`gemma4:31b` / 科学=`gpt-oss:120b` / 法=`llama3.1:8b` / 芸術=`gemma4:31b` / メディア=`gemini-2.5-flash`（維持） / 政治=`gpt-oss:120b` / 教育=`llama3.1:8b` / メタ=`gemma4:31b`。
- [ ] **AC-21** `frontend/src/data/presets.ts` のモデル定数も AC-20 と同一に更新されている。バックエンド YAML とフロント TS が一致。
- [ ] **AC-22** `.env.example` の `OLLAMA_CLOUD_MODEL=gpt-oss:120b` / `OLLAMA_LOCAL_MODEL=llama3.1:8b` / `OLLAMA_MODEL=gpt-oss:120b` が高性能モデルに更新されている。
- [ ] **AC-23** `AppConfig` に `ollama_mode` / `ollama_cloud_*` / `ollama_local_*` フィールドが追加され、`mypy --strict` がクリア。`validate_provider_credentials` が `OLLAMA_MODE` に応じたバリデーションを行う。
- [ ] **AC-24** `lib/analysis.ts` の統計計算（主導性スコア・相互作用行列・オートポイエーシス度）と対象推定（`inferTarget`）に対して Vitest ユニットテストが追加され、`npm run test` がグリーン。
- [ ] **AC-25** `lib/analysis.ts` の統計計算（`computeAnalysis`）に対して Vitest ユニットテストが追加され、`npx vitest run` がグリーン。
- [ ] **AC-26** `./.shared-agents/harness/verify.sh` が `ruff format --check` / `ruff check` / `mypy` / `pytest` / `eslint` / `tsc -b` / `vitest run` の全項目でグリーン。
- [ ] **AC-27** Docker 環境 (`docker compose up --build`) で上記 AC-1〜AC-25 がすべて検証可能であること。

## 未解決・考慮事項

- **OQ-1 `DebateVisualizer` の配置**: 既存 `NetworkGraph` のトグル表示（ネットワーク / 議論構造）にするか、独立パネルとして右aside またはメインカラム下部に配置するか。3カラムグリッドの空きスペースを優先し、実装時にレイアウト検証。`NetworkGraph` 内にトグルボタンを追加する方式が YAGNI 妥当。
- **OQ-2 LLM 考察のプロバイダ選択**: `POST /api/simulations/{id}/analysis` で使用する LLM は `AppConfig.llm_provider` に従うか、分析専用のプロバイダを別途指定するか。本フェーズでは `llm_provider` に従う（YAGNI）。分析専用プロバイダは次フェーズ以降。
- **OQ-3 `AnalysisPanel` の配置**: 右 aside の下部（`StatsPanel` / `LogsReload` の下）に配置するか、完了時にメインカラム下部に全幅で展開するか。ヒートマップの視認性を考慮するとメインカラム下部が妥当だが、3カラムグリッドの改修が必要。実装時に検証。
- **OQ-4 エリアチャートの系列数**: 7エージェント時のエリアチャートは 7 系列になり、SocietyPanel の狭いスペース（320px 幅 × 80px 高）で視認性が保てるか。必要に応じて凡例を別パネルに分離するか、ホバー時にツールチップでシステム名を表示。実装時に調整。
- **OQ-5 ズーム修正の影響範囲**: `MessageBubble` の本文を `fontSize: inherit` に変更すると、ズーム以外のコンテキスト（`AgentEditor` のプレビュー等）で意図しない継承が起きないか。`MessageBubble` は `TimelineList` 配下でのみ使用されることを確認し、他の呼び出し元がないか grep で検証。
- **OQ-6 Ollama Local の APIキー扱い**: `local` モードで `ollama_api_key` が空の場合、`llm_client.py` がエラーにならないか。OpenAI 互換 API の `Authorization` ヘッダーを空またはダミー（`local`）で送信し、ローカル Ollama がそれを受け入れるかを実機検証。
- **OQ-7 高性能モデルのコスト・レイテンシ**: `gpt-oss:120b` / `gemma4:31b` は高性能だが、15ターン × 7エージェント = 最大 105 発言でコスト・レイテンシが増大する。デフォルトで 15 ターンに増やすこととの兼ね合い。ユーザーが `.env` で `MAX_TURNS` を調整できることを README に明記。
- **OQ-8 次フェーズ以降**: 3D 可視化・音声合成・TTS・バックエンド永続化・認証・分析専用プロバイダ指定・シミュレーション比較機能は本フェーズのスコープ外。