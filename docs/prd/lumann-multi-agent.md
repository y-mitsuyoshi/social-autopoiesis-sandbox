# PRD: 複数AI人格・エージェントごとのモデル選択・人数可変

## 概要と目標

本PRDは、ルーマン・オートポイエーシス・シミュレーション（`social-autopoiesis-sandbox`）の
バックエンド CLI を拡張し、以下の3本柱を実現する。

1. **エージェントごとの Ollama モデル選択**: 各 AI 人格（機能システム）が異なる
   Ollama モデル（例: 経済=`gemma4:31b`、科学=`gpt-oss:20b`、法=`llama3.1:8b`）を
   使用できるようにする。現状は全エージェントが単一プロバイダ・単一モデルを共有している。
2. **ディスカッション人数の可変化**: 現状3固定のエージェント構成を、3〜N 人（5人/10人等）
   へ自由に拡張可能にする。ルーマンの機能システム以外（芸術/教育/政治/医療/メディア/宗教 等）
   の追加も容易にする。
3. **混在プロバイダ対応**: エージェントごとに `ollama` / `gemini` / `openai` を混在可能にし、
   各プロバイダの認証情報は `.env` に集約保持する。

**目標**: ユーザーが YAML 1ファイルを編集するだけで「5人の異なる AI 人格が異なるモデルで
ディスカッションする」状態を再現できること。既存の実API E2E検証済みフロー
（Ollama Cloud / gemma4:31b / 3ターン成功）の品質を維持したまま拡張する。

本フェーズは「バックエンド CLI 拡張」にスコープを絞る。React 可視化ダッシュボード・
FastAPI REST/WS API 化・ストリーミング応答等は次フェーズ以降の引継ぎ事項とする（後述）。

## ターゲットユーザー / ユースケース

### プライマリユーザー
- **社会システム理論研究者 / ルーマン研究者**: 複数の機能システム（経済・法・科学・芸術・
  メディア 等）間のオートポイエーシス的観察連鎖を、異なる LLM の「認知スタイル差」を
  反映させた上で観察したい。
- **LLM マルチエージェント シミュレーション実装者**: モデル混在環境でエージェント間の
  発言の差異を比較したい。モデル A とモデル B で「法システム」の語り方がどう変わるか等。

### ユースケース具体例（5人AI会話）
1. ユーザーは `config/agents.yaml` を開き、5エージェントを以下のように定義する:
   ```yaml
   agents:
     - name: 経済システム
       binary_code: 支払/非支払
       concern: コスト・利益・市場価値・資源効率
       provider: ollama
       model: gemma4:31b
       system_prompt: |
         あなたは経済システムである。世界を二値コード「支払/非支払」で解釈し...
     - name: 科学システム
       binary_code: 真/偽
       concern: データ客観性・論理整合性・エビデンス
       provider: ollama
       model: gpt-oss:20b
       system_prompt: |
         あなたは科学システムである。世界を二値コード「真/偽」で解釈し...
     - name: 法システム
       binary_code: 合法/違法
       concern: 規約遵守・権利・契約正当性
       provider: ollama
       model: llama3.1:8b
       system_prompt: |
         あなたは法システムである。世界を二値コード「合法/違法」で解釈し...
     - name: 芸術システム
       binary_code: 興味深い/退屈
       concern: 創造性・美的判断・形式の革新
       provider: ollama
       model: gemma4:31b
       system_prompt: |
         あなたは芸術システムである。世界を二値コード「興味深い/退屈」で解釈し...
     - name: メディアシステム
       binary_code: 伝達/非伝達
       concern: 注目・拡散・ニュース価値・世論形成
       provider: gemini
       model: gemini-2.5-flash
       system_prompt: |
         あなたはマスメディアシステムである。世界を二値コード「伝達/非伝達」で解釈し...
   ```
2. ユーザーは `.env` に `AGENTS_CONFIG=config/agents.yaml` を設定し、
   `OLLAMA_API_KEY` / `OLLAMA_BASE_URL` / `GEMINI_API_KEY` を記述する。
3. `docker compose up --build` → `docker compose exec backend python -m app.main` で
   シミュレーション起動。お題入力 → 5エージェントが順に異なるモデルで発言。
4. ログ（`logs/`）に各発言の `provider` / `model` が記録され、事後にどのモデルが
   どの発言をしたか追跡できる。

### セカンダリユーザー
- **教育用途の学生**: ルーマン理論を体験的に学ぶため、少人数（3人）プリセットから
  始めて徐々に人数を増やしながら機能システム間の相互作用を観察する。

## 機能要件 (必須)

### FR-1: エージェント設定の YAML 化
- `config/agents.yaml`（デフォルトパス）にエージェント一覧を定義する。
- 各エージェントは `name` / `binary_code` / `concern` / `system_prompt` / `provider` / `model`
  を持つ。`provider` は `ollama` / `gemini` / `openai` のいずれか。
- エージェント数は 1 以上 N（上限なし）で、YAML 要素数で自由に決定できる。
- 既存 `backend/app/agents.py` のハードコード `AGENTS` は、YAML ローダで
  `list[AgentSpec]` を構築する実装に置き換える。後方互換のため、YAML 未指定時は
  従来の3エージェント（経済/科学/法）デフォルトを生成するフォールバックを用意する。
- YAML パーサは PyYAML を使用（既に検証スクリプトで利用実績あり・新規ランタイム依存追加なし）。

### FR-2: エージェントごとの LLM クライアント
- `AgentSpec` スキーマに `provider: str` / `model: str` フィールドを追加する。
  (`backend/app/schemas.py`)
- `run_simulation(config, agents, client, logger)` のシグネチャを変更し、
  単一 `client` ではなく **エージェントごとの `LLMClient`** を受け取る。
  実装案: `agents: list[AgentSpec]` と `clients: dict[str, LLMClient]`
  （キーは `agent.name`）、または `agents: list[tuple[AgentSpec, LLMClient]]`。
  後方互換のため `SimulationConfig.provider` / `model` は非推奨フィールドとして残置可能。
- `build_llm_client(config)` を拡張し、エージェントの `provider` / `model` に基づき
  適切なクライアントを生成するファクトリを提供する。同一 provider+model 組合せの
  クライアントはキャッシュし、重複生成を防ぐ（httpx クライアントの無駄増殖防止）。
- シミュレーション終了時、すべての生成クライアントを `aclose()` する
  （`asyncio.gather` で安全に並行クローズ）。
- `Message` スキーマの `provider` / `model` は、発言エージェントが使用した
  クライアントの実際の値で上書きされる（`LLMResponse` から取得）。

### FR-3: プリセット機能システムの追加
- ルーマンの代表的な機能システムとして、以下のプリセット定義をリポジトリに同梱する:
  - **芸術システム**（二値コード: 興味深い/退屈、関心: 創造性・美的判断）
  - **教育システム**（二値コード: 資格/非資格、関心: 学習・社会化・キャリア準備）
  - **政治システム**（二値コード: 権力/非権力、関心: 権力獲得・意思決定・集合意志）
  - **医療システム**（二値コード: 健康/疾病、関心: 治療・予防・身体の再生産）
  - **メディアシステム**（二値コード: 伝達/非伝達、関心: 注目・拡散・ニュース価値）
  - **宗教システム**（二値コード: 聖/俗、関心: 信仰・超越的意味・儀礼）
- 各プリセットは `config/presets/` 配下に YAML として提供:
  - `config/presets/agents-3.yaml`（従来の経済/科学/法）
  - `config/presets/agents-5.yaml`（3 + 芸術 + メディア、Ollama モデル例付き）
  - `config/presets/agents-7.yaml`（5 + 政治 + 教育）
- `system_prompt` は各機能システムの二値コードと関心を反映した内容とする。

### FR-4: エージェント構成の CLI / .env 選択
- `.env` に `AGENTS_CONFIG` を追加し、YAML ファイルパスを指定可能にする
  （例: `AGENTS_CONFIG=config/presets/agents-5.yaml`）。
- `AGENTS_CONFIG` 未設定時はデフォルト `config/agents.yaml` を読込、ファイル不存在時は
  従来のハードコード3エージェントにフォールバックする。
- CLI 起動時に、読み込んだエージェント一覧（name / provider / model）を
  ヘッダ表示し、ユーザーが構成を確認できるようにする:
  ```
  === ルーマン・オートポイエーシス・シミュレーション ===
  エージェント構成: config/presets/agents-5.yaml
    1. 経済システム   [ollama / gemma4:31b]
    2. 科学システム   [ollama / gpt-oss:20b]
    3. 法システム     [ollama / llama3.1:8b]
    4. 芸術システム   [ollama / gemma4:31b]
    5. メディアシステム [gemini / gemini-2.5-flash]
  最大ターン: 5
  ```

### FR-5: プロバイダ混在サポート
- エージェントごとに異なる `provider` を指定可能。同一シミュレーション内で
  `ollama` + `gemini` + `openai` の混在を許可する。
- 各プロバイダの認証情報（`*_API_KEY` / `*_BASE_URL`）は `.env` に保持し、
  `AppConfig` 経由でファクトリに渡す。`AppConfig.llm_provider`（単一）は
  非推奨フィールドとして残置可能（後方互換のため）。新規実装は
  エージェントの `provider` フィールドを正とする。
- エージェントが指定する `provider` に必要な認証情報が `.env` に未設定の場合、
  起動時に分かりやすいエラーメッセージを出力して停止する
  （例: "エージェント『メディアシステム』が provider=gemini を指定していますが、
  GEMINI_API_KEY が未設定です"）。
- エージェントが指定する `model` が空文字の場合、エラーとする。

## 非機能要件 (パフォーマンス、UX等)

- **NFR-1: 品質ゲート維持**: `ruff format --check` / `ruff check` / `mypy --strict` /
  `pytest -q` が全てパスすること。`./.shared-agents/harness/verify.sh` が緑で終了する。
- **NFR-2: リグレッション防止**: 既存テスト（48件想定）のうち、`AgentSpec` 追加フィールド
  に起因する破壊的変更は、テストを更新して許容する。それ以外の振る舞い（ログ出力形式、
  シミュレーション順序、リトライ挙動）は既存挙動を維持する。
- **NFR-3: 型安全性**: `AgentSpec` / `AppConfig` / 新規 YAML ローダは全て Pydantic
  `BaseModel` を使用。`Any` を避け、`mypy --strict` でエラーなし。YAML 読込時の
  バリデーションエラーは Pydantic `ValidationError` で捕捉し、ユーザーフレンドリーな
  メッセージに変換する。
- **NFR-4: async 安全**: `httpx.AsyncClient` の生成は同期、`complete()` / `aclose()` は
  async。全エージェントのクライアント生成はシミュレーション開始前に一括で行い、
  `async def main()` 内で `await` 不要の初期化を完了する。共有状態なし（各クライアントは
  エージェントごとに独立）。`asyncio.Lock` は不要だが、クライアントキャッシュへの
  アクセスは起動時の同期処理内で完結させる。
- **NFR-5: リソース管理**: 同一 `provider+model` のクライアントは1つだけ生成し、
  複数エージェントで共有する（httpx コネクションプール効率化）。`aclose()` は
  `asyncio.gather(*[c.aclose() for c in unique_clients])` で一括実行。
- **NFR-6: 設定ファイルのバリデーション**: YAML の必須フィールド欠落 / provider不正 /
  重複エージェント名 / 空エージェントリスト を起動時に検出し、即座に分かりやすい
  エラーで停止する（Pydantic + 追加バリデータ）。
- **NFR-7: 後方互換**: 既存の `.env` のみで動かす従来フロー（`LLM_PROVIDER` + 単一モデル）
  は、`AGENTS_CONFIG` 未設定時のフォールバックで継続動作する。
- **NFR-8: ドキュメント**: `docs/ops/real-api-e2e.md` に YAML 設定例と起動手順を追記。
  `.env.example` に `AGENTS_CONFIG` の例を追記。

## 受け入れ基準 (Acceptance Criteria)

### 機能要件
- [ ] `config/agents.yaml` を作成し、3エージェント（経済/科学/法）を定義すると、
      従来と同等のシミュレーションが実行できること。
- [ ] `config/agents.yaml` で各エージェントに異なる `provider` / `model` を指定すると、
      ログ（`logs/`）に各発言の `provider` / `model` がエージェントごとに異なる値で
      記録されること。
- [ ] `config/agents.yaml` で5エージェント（経済/科学/法/芸術/メディア）を定義すると、
      5人で順に発言するシミュレーションが実行できること。
- [ ] `config/agents.yaml` で10エージェントを定義した場合も、エラーなく実行できること。
- [ ] `config/presets/agents-3.yaml` / `agents-5.yaml` / `agents-7.yaml` が
      リポジトリに同梱されていること。各プリセットの `system_prompt` がルーマンの
      機能システム（芸術/教育/政治/医療/メディア/宗教）の二値コードと関心を反映
      していること。
- [ ] `.env` に `AGENTS_CONFIG=config/presets/agents-5.yaml` を設定すると、
      プリセット5エージェント構成で起動すること。
- [ ] `AGENTS_CONFIG` 未設定時、`config/agents.yaml` が存在しない場合、
      従来のハードコード3エージェント（経済/科学/法）にフォールバックすること。
- [ ] エージェントが `provider=gemini` を指定し、`.env` に `GEMINI_API_KEY` が
      未設定の場合、起動時に「エージェント『<name>』が provider=gemini を指定
      していますが、GEMINI_API_KEY が未設定です」のエラーで停止すること。
- [ ] エージェントの `model` が空文字の場合、起動時にバリデーションエラーで停止すること。
- [ ] 同一 `provider+model` を複数エージェントが指定した場合、`httpx.AsyncClient` が
      1つだけ生成され共有されること（ログまたはデバッグ出力で確認可能、または
      実装レビューで確認）。
- [ ] シミュレーション終了（正常/中断いずれ）時に全クライアントが `aclose()` されること。

### 型・品質
- [ ] `ruff format --check .` がパスすること。
- [ ] `ruff check .` がパスすること。
- [ ] `mypy .` が strict モードでパスすること（エラー0件）。
- [ ] `pytest -q` が全てパスすること（既存テスト + 新規テスト含む）。
- [ ] 新規 YAML ローダの単体テスト（正常系/異常系/必須フィールド欠落/重複名/空リスト）
      が追加されていること。
- [ ] エージェントごとクライアント生成の単体テスト（キャッシュ動作 / 混在プロバイダ /
      認証情報欠落）が追加されていること。

### Docker 検証
- [ ] Docker 環境 (`docker compose up --build`) で `.env` に `AGENTS_CONFIG` を
      設定し、`docker compose exec backend python -m app.main` が5エージェント構成で
      実行できること（実API呼出 不要・モック可、ただし Ollama Cloud 実APIでの
      最低1パスを推奨）。
- [ ] `./.shared-agents/harness/verify.sh` が Docker 環境で緑で終了すること。

### ドキュメント
- [ ] `docs/ops/real-api-e2e.md` に YAML 設定例と5エージェント起動手順が追記されていること。
- [ ] `.env.example` に `AGENTS_CONFIG` の例が追記されていること。
- [ ] `config/presets/README.md`（または各 YAML のヘッダコメント）に各プリセットの
      機能システム解説が記載されていること。

## 未解決・考慮事項

### 本フェーズでは非スコープ（次フェーズ以降の引継ぎ）
- **React 可視化ダッシュボード**: フロントエンドでエージェント別発言を可視化。
  現状は CLI のみ。FastAPI REST/WS API 化と併せて次フェーズで検討。
- **FastAPI REST/WS API 化**: シミュレーション起動・停止・状態取得を HTTP/WebSocket
  で提供。CLI 併存か API 中心化かは別途アーキテクチャ判断が必要。
- **動的エージェント順序選択**: LLM 自身に「次に発言するエージェント」を選ばせる
  ルーマン的観察連鎖の自律化。現状は `agent_order` 固定ラウンドロビン。
- **コンテキスト履歴拡張**: 過去 K 発言を参照して発言する。現状は「直前の発言」のみ。
- **ストリーミング応答**: `httpx` の SSE / WebSocket ストリーミングで発言を逐次表示。
  現状は1発言完了まで待機。
- **長連鎖観察・モデル比較実験（実API）**: 100ターン以上の観察連鎖で、モデル混在が
  発言の多様性・崩壊にどう影響するかの定量的実験。本フェーズで混在基盤が整えば
  次フェーズで取り組む。
- **SIGINT 実 API 検証**: Ctrl-C で `aclose()` が全クライアントに伝播するかの
  実機検証。本フェーズの単体テストで代用し、実API検証は次フェーズ。

### 設計判断の未確定要素
- **`AppConfig.llm_provider` の扱い**: 後方互換のため残すか、廃止して
  `AGENTS_CONFIG` 必須にするか。本PRDでは残置（非推奨）を推奨するが、
  Tech Spec で最終判断。
- **YAML スキーマの Pydantic 表現**: `AgentSpec` に `provider` / `model` を追加するか、
  `AgentConfig` の別モデルを設けるか。YAGNI 原則に従い `AgentSpec` 拡張を推奨。
- **プリセットのデフォルトモデル**: `agents-5.yaml` でどの Ollama モデルを例示するか
  （`gemma4:31b` / `gpt-oss:20b` / `llama3.1:8b` 等）。実API検証済みの
  `gemma4:31b` を基本にしつつ、多様性を見せるため混在例を併記。
- **エージェント名の重複**: `agent_order` が name で参照するため重複は不可。
  Pydantic バリデータで検出するか、ID ベース参照に移行するか。本PRDでは
  name ベース + 重複禁止バリデータを推奨（YAGNI）。

### リスク
- **Ollama Cloud のモデル可用性**: `gpt-oss:20b` / `llama3.1:8b` 等が
  Ollama Cloud 側で利用可能かは実API検証時に確認が必要。利用不可モデルを
  プリセットに書くとユーザーが混乱するため、検証済みモデルのみをデフォルトにし、
  利用不可モデルはコメント例示に留める。
- **httpx クライアント共有のスレッド安全性**: 同一クライアントを複数エージェントが
  逐次的に使用する場合、`httpx.AsyncClient` はスレッドセーフだが、並行 `complete()`
  を許す設計にする場合は別途検証。現状は順次実行のため問題なし。