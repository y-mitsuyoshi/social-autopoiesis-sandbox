# PRD: エージェントエディタ・発言者識別強化・グラフ可視化強化・アバターカスタマイズ

## 概要と目標

`social-autopoiesis-sandbox` は、ニクラス・ルーマンの社会システム論に基づき、複数の機能システム（経済・法・科学・芸術・メディアなど）エージェントが自律的に発言を積み重ねて社会をオートポイエティクス的に構築する様を、サイバーパンク調 UI で可視化するシミュレーションアプリである。

前フェーズで攻殻風デザイン・ネットワーク図・タイムライン・統計パネルは実装済み。本フェーズでは、ユーザーから要望された以下 4 点を「UI 機能拡張」として集約し、ブラウザ完結で構成可能・視認性の高い体験を実現する。

1. 参加エージェントの追加/削除/人格編集をブラウザ上で完結
2. 各発言の帰属（誰が発言したか）を一目で識別可能に
3. 社会構築の過程を折れ線グラフ・エッジ密度・ズーム/パン/ドラッグ可能なネットワークでリアルタイム可視化
4. アバターの色相・グリフ・サイズをユーザーが調整可能に

**目標:** 既存のプリセット YAML を出発点にしつつ、コード編集やサーバ再起動なしで、エージェント構成・アバター外観・可視化表現を自由に調整し、そのまま `POST /api/simulations` に投入できるワークフローを完成させる。バックエンド変更はインラインエージェント定義受付と `AgentSpec` のオプション項目追加のみに最小化し、フロントエンド中心の機能拡張とする。

## ターゲットユーザー / ユースケース

- **U-1 シミュレーション実験者（研究者/学生）**
  - ルーマン社会システム論の挙動を、構成を変えながら繰り返し観察したい。
  - プリセット（3/5/7/3-dynamic）を出発点に、参加システムを増減したり `system_prompt` を書き換えて再実行したい。
  - 誰がどの発言をしたかを、ネットワーク図・タイムライン・バルーンで一貫して識別したい。
- **U-2 デモ閲覧者（非エンジニア）**
  - ターミナルや YAML を触らず、ブラウザだけで構成を確定したい。
  - アバターの見た目を好みに調整して、プレゼン用途で見せやすくしたい。
  - 構築過程をズーム/パンしながら観察したい。
- **U-3 設計者（本リポジトリ開発者）**
  - カスタム構成を YAML としてダウンロードし、`config/presets/` へ持ち帰りたい。
  - バックエンドの YAML I/O や永続化には踏み込まず、JSON インライン送信で検証を完結したい。

ユースケースフロー:
1. プリセットドロップダウンから `agents-5` を選択 → `AgentEditor` に読込
2. エージェント1件を削除、`system_prompt` を編集、新規エージェントを1件追加
3. 各エージェントの `avatar_hue`/`avatar_glyph` をカラーピッカー/グリフ入力で調整
4. 「START」でインライン JSON として `POST /api/simulations` 投入
5. 実行中、折れ線グラフ（発言数推移）・エッジ太度・ドラッグ/ズーム可能なネットワークを観察
6. 満足したら「プリセットを上書き保存（YAML ダウンロード）」でローカル YAML を取得

## 機能要件 (必須)

### FR-1: エージェントエディタUI（`AgentEditor.tsx` 新設）

- **FR-1.1** ブラウザ上でエージェント一覧を表示し、各エージェントに対して「追加 / 削除 / 複製 / 編集」を行えるパネルを提供する。
- **FR-1.2** 編集可能フィールドは `AgentSpec` に準拠: `name` / `binary_code` / `concern` / `system_prompt`（複数行）/ `provider`（`ollama|gemini|openai|opencode` のドロップダウン）/ `model` / `is_meta`（トグル）。追加で `avatar_hue` / `avatar_glyph` をオプション編集（FR-4 参照）。
- **FR-1.3** バリデーション: `name` は空禁止・重複禁止、`model` は空禁止、`is_meta=true` のエージェントが1件以上存在する場合は `agent_order_mode="dynamic"` を許可（既存の `validate_dynamic_order` 整合）。
- **FR-1.4** 構成確定後、`POST /api/simulations` へは `agents_inline`（JSON 配列）として送信する。既存の `agents_config`（YAML パス）とは排他。両方未指定時はバックエンドの `app_config.agents_config` を参照する既存挙動を維持。
- **FR-1.5** 「START」実行時、エディタでの編集内容が未保存でもインライン送信される。`SimulationForm` の `trigger_message` / `max_turns` / `agent_order_mode` と直結して送信パラメータを構築する。
- **FR-1.6** バックエンド（`server.py` / `schemas.py`）は `SimulationStartRequest` に `agents_inline: list[AgentSpec] | None` を追加し、`agents_config` と排他で受け付ける。`agents_inline` が指定された場合は `load_agents` を経由せず `AgentConfigFile(agents=...)` と同等のバリデーション（空禁止・重複禁止）を行った上で `agents` リストを構築する。

### FR-2: 発言者識別の強化

- **FR-2.1** 各発言バブル（`MessageBubble`）のヘッダにエージェント名を大きく（現状 `text-[10px]` から `text-[12px]` 以上）表示し、アバター色と連動したアクセントカラーをヘッダ背景または左ボーダーに適用する。
- **FR-2.2** `AgentAvatar` をバブル内でサイズ 56〜64px に拡大表示（現状 48px）。`agent.state==="speaking"` 時のリング発光は維持。
- **FR-2.3** 発言者ごとの色分けを、`avatar.ts` の `hashHue`（または `avatar_hue` 上書き）を起点に統一。バブル・ネットワークノード・タイムラインドット・`StatsPanel` バーの4箇所で同色を使う。
- **FR-2.4** 現在発言中インジケータ（`currentSpeaker`）を、ネットワーク図ノードのハイライト、タイムライン該当行の左ボーダー点滅、`MessageBubble` の `●LIVE` 表示の3点で連動させる。`nextSpeaker` の思考リングも維持。

### FR-3: グラフ可視化強化

- **FR-3.1** ネットワーク図（`NetworkGraph`）に加え、各エージェントの累積発言数推移を示す**折れ線グラフ**を新設（`SpeakingChart.tsx`）。X軸=ターン、Y軸=累積発言数。WebSocket メッセージ到着ごとにリアルタイム更新。各ラインの色は FR-2.3 と同一パレット。
- **FR-3.2** ネットワーク図のエッジ太さを `buildEdges` の `count` に基づき `1 + log2(count+1)` で表現（現状ロジック）。これをユーザーに視覚的に説明する凡例（「太い＝発話のやり取りが多い」）を図内に小表示。
- **FR-3.3** ネットワーク図のノードをマウスドラッグで位置調整可能にする。ドラッグ終了後は位置をコンポーネント state に保持。`agents` が増減した場合のみ円周レイアウトで再配置。
- **FR-3.4** ネットワーク図にズーム（ホイール）・パン（背景ドラッグ）操作を追加。ズーム範囲は 0.5x〜2.0x。リセットボタン（「RESET VIEW」）を図の隅に配置。
- **FR-3.5** 既存の `currentSpeaker` ハイライト、`nextSpeaker` 思考リング、`speakCount` 円サイズ連動は維持。ズーム/パン/ドラッグ操作中もこれらは描画され続ける。

### FR-4: アバターカスタマイズ

- **FR-4.1** `AgentEditor` の各エージェント編集フォームに「AVATAR」セクションを設け、`avatar_hue`（0-359、スライダー+数値入力）と `avatar_glyph`（1-3文字のテキスト入力）を編集可能にする。
- **FR-4.2** `avatar_hue` / `avatar_glyph` は `AgentSpec` のオプションフィールド（`int | None` / `str | None`）としてバックエンド `schemas.py` に追加。未指定時は既存の `hashHue(agent_code)` / `concernGlyph(concern)` の自動生成を維持（後方互換）。
- **FR-4.3** `generateAvatar` は `avatar_hue` / `avatar_glyph` が明示されている場合はそれらを優先使用するよう拡張。`AgentAvatar` の `size` prop はそのまま維持し、アバター表示サイズのカスタマイズは呼び出し側（`MessageBubble` や `AgentEditor` のプレビュー）で調整。
- **FR-4.4** `AgentEditor` 上にリアルタイムプレビュー（`AgentAvatar` を size=64 で表示）を置き、`avatar_hue` スライダー操作で即座に反映。

### FR-5: プリセット切り替えUI

- **FR-5.1** `AgentEditor` の上部にドロップダウンを設け、`agents-3` / `agents-5` / `agents-7` / `agents-3-dynamic` の4プリセットを選択可能にする。
- **FR-5.2** プリセット選択時、対応する YAML をフロントから fetch して `AgentEditor` の状態に読み込む。YAML は `config/presets/*.yaml` を静的配信するか、フロントにバンドルした JSON 定数として持つ（ビルド時に取り込む）。後方互換のため実装時点で既存プリセットを欠損なく再現できること。
- **FR-5.3** カスタム編集後、「プリセットを上書き保存」ボタンで現在のエージェント一覧を YAML 文字列（`agents: [...]` 構造）としてダウンロードする。ファイル名は `agents-custom.yaml` または任意入力。サーバへの書き戻しは行わない（次フェーズ以降）。
- **FR-5.4** 読込直後（未編集状態）は「START」可能。編集後にプリセットを切り替える場合は「未保存の編集があります。破棄して読み込みますか？」の確認ダイアログを表示。

## 非機能要件 (パフォーマンス、UX等)

- **NFR-1 型安全**: 全新規・変更コンポーネントは TypeScript strict、`npx tsc -b` クリーン。新規依存（グラフ描画ライブラリ等）は最小限、純 SVG + React state で実装可能ならライブラリ不使用（YAGNI）。
- **NFR-2 パフォーマンス**: 折れ線グラフ・ネットワーク図の再描画は `messages` 配列の差分で `useMemo` 済みの派生値のみ更新。100ターン × 7エージェント程度でも 60fps を維持。`requestAnimationFrame` ベースのドラッグ、`pointermove` の throttle 不要な軽量実装。
- **NFR-3 アクセシビリティ**: カラーピッカー・スライダー・ドロップダウンはキーボード操作可能。色分けは色覚多様性に配慮し、HSL のコントラスト比 4.5:1 以上を維持。`aria-label` を全インタラクティブ要素に付与。
- **NFR-4 レスポンシブ**: 既存の 3カラムグリッド（`lg:grid-cols-[320px_1fr_360px]`）を維持。`AgentEditor` は左aside またはモーダルで展開。スマートフォン幅では縦並びに折りたたみ。
- **NFR-5 後方互換**: `agents_inline` 未指定時は既存の `agents_config` パスを完全に維持。`avatar_hue` / `avatar_glyph` 未指定時は既存のハッシュ自動生成を維持。既存 YAML プリセットは変更なしで動作。
- **NFR-6 セキュリティ**: `agents_inline` の `system_prompt` はバックエンドでそのまま LLM へ渡す（既存挙動と同一）。`name` / `model` のバリデーションは `AgentSpec` 既存 validator を流用。`agents_config` パスには既存の `..` 禁止チェックを維持。
- **NFR-7 検証**: `./.shared-agents/harness/verify.sh` が全項目（ruff/mypy/pytest/eslint/tsc/vitest）でグリーン。新規ユーティリティ（`avatar.ts` 拡張、YAML 変換ヘルパ）には Vitest ユニットテストを追加。

## 受け入れ基準 (Acceptance Criteria)

- [ ] **AC-1** `docker compose up --build` 後、`http://localhost:5173` でアプリが起動し、`AgentEditor` パネルが表示される。
- [ ] **AC-2** プリセットドロップダウンで `agents-5` を選択すると、5件のエージェントがエディタに読み込まれ、各フィールド（`name`/`binary_code`/`concern`/`system_prompt`/`provider`/`model`/`is_meta`）が表示される。
- [ ] **AC-3** エディタでエージェント1件を削除し、別エージェントの `system_prompt` を書き換え、新規エージェントを1件追加できる。追加時は全フィールドが空のテンプレートが挿入される。
- [ ] **AC-4** `name` が空または重複する状態で「START」を押すと、ボタンが無効化またはインラインエラーが表示され、リクエストは送信されない。
- [ ] **AC-5** `agent_order_mode="dynamic"` を選択した状態で `is_meta=true` エージェントが0件の場合、エラーが表示され送信不可（既存 `validate_dynamic_order` 整合）。
- [ ] **AC-6** 「START」実行時、リクエストボディに `agents_inline` として編集後のエージェント配列が JSON で含まれ、`agents_config` は含まれない。バックエンドは `201` と `simulation_id` を返す。
- [ ] **AC-7** `POST /api/simulations` に `agents_inline` と `agents_config` を同時に送った場合、`422` エラーを返す（排他制御）。
- [ ] **AC-8** `agents_inline` で空配列を送った場合、`422` エラーを返す。
- [ ] **AC-9** シミュレーション実行中、`MessageBubble` のヘッダにエージェント名が12px以上で表示され、アバターは56px以上、ヘッダの左ボーダーまたは背景がエージェント色で着色される。
- [ ] **AC-10** ネットワーク図ノード・タイムラインドット・`StatsPanel` バー・`MessageBubble` ヘッダの4箇所で同一エージェントは同一色（HSL hue 一致）で表示される。
- [ ] **AC-11** 現在発言中のエージェントについて、ネットワーク図ノードのハイライト、タイムライン該当行の左ボーダー点滅、`MessageBubble` の `●LIVE` 表示が3点同時に連動する。
- [ ] **AC-12** 折れ線グラフ `SpeakingChart` が表示され、各エージェントの累積発言数がターンごとにリアルタイム更新される。ライン色は AC-10 と同一パレット。
- [ ] **AC-13** ネットワーク図のエッジ太さが `count` に応じて太くなり、図内に凡例（「太い＝発話のやり取りが多い」）が表示される。
- [ ] **AC-14** ネットワーク図ノードをマウスドラッグで移動できる。ドラッグ終了後も位置が保持され、`agents` 増減時のみ円周レイアウトで再配置される。
- [ ] **AC-15** ネットワーク図でホイールで 0.5x〜2.0x ズーム、背景ドラッグでパンができる。「RESET VIEW」ボタンで初期表示に戻る。
- [ ] **AC-16** `AgentEditor` の「AVATAR」セクションで `avatar_hue` スライダーと `avatar_glyph` 入力が編集でき、size=64 のプレビューがリアルタイム反映される。
- [ ] **AC-17** `avatar_hue` / `avatar_glyph` を指定したエージェントは、`MessageBubble`・ネットワーク図・`SpeakingChart` の全表示でその指定色/グリフが使われる。未指定エージェントは既存のハッシュ自動生成色/グリフになる。
- [ ] **AC-18** `AgentSpec` の `avatar_hue: int | None` / `avatar_glyph: str | None` が追加され、`mypy --strict` がクリア。既存 YAML プリセット（`avatar_hue` 未指定）は従来通りのハッシュ自動生成で動作する。
- [ ] **AC-19** 「プリセットを上書き保存」ボタンで `agents-custom.yaml`（または任意ファイル名）がダウンロードでき、内容が `agents: [...]` 構造で `config/presets/agents-5.yaml` と互換性のある YAML になっている。
- [ ] **AC-20** 編集後にプリセットを切り替えようとした場合、確認ダイアログが表示される。「キャンセル」で編集内容が保持、「破棄」で新プリセットが読み込まれる。
- [ ] **AC-21** `./.shared-agents/harness/verify.sh` が `ruff format --check` / `ruff check` / `mypy` / `pytest` / `eslint` / `tsc -b` / `vitest run` の全項目でグリーン。
- [ ] **AC-22** 新規ユーティリティ（`avatar.ts` の `avatar_hue`/`avatar_glyph` 优先ロジック、YAML 変換ヘルパ）に対して Vitest ユニットテストが追加され、`npm run test` がグリーン。
- [ ] **AC-23** Docker 環境 (`docker compose up --build`) で上記 AC-1〜AC-20 がすべて検証可能であること。

## 未解決・考慮事項

- **OQ-1 プリセット配信方式**: YAML をビルド時に JSON 定数として frontend にバンドルするか、FastAPI で静的配信（`/api/presets/{name}`）するか。実装フェーズで決定。バンドル方式が依存最小で YAGNI 妥当。
- **OQ-2 `AgentEditor` の配置**: 左 aside 内に常時表示するか、モーダル/ドロワーで開くか。3カラムグリッドを維持するなら左 aside に折りたたみ式で配置が妥当。実装時にレイアウト検証。
- **OQ-3 `agents_inline` の上限**: 大量エージェント（50件以上）を投入された場合のバリデーション上限を設けるか。本フェーズでは YAGNI で上限なし、異常時は LLM クライアント構築で弾かれる挙動に委ねる。
- **OQ-4 ドラッグ/ズームのライブラリ依存**: 純 SVG + pointer events で実装可能か、`d3-zoom` 等を入れるか。YAGNI 原則で純実装を優先。実装で破綻した場合のみ最小依存を追加。
- **OQ-5 `avatar_glyph` の文字種制限**: 絵文字・マルチバイト文字を許容するか。`str | None` で受け付け、表示幅が崩れる場合は CSS で `max-width` + 切詰め。本フェーズでは制限なし。
- **OQ-6 次フェーズ以降**: バックエンドでの YAML 永続化（編集構成のサーバ保存）、3D 可視化、音声合成、認証は本フェーズのスコープ外。PRD のスコープ外セクションを参照。