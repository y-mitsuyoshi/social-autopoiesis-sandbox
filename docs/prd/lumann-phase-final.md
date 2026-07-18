# PRD: 最終フェーズ統合（React可視化 + 動的順序 + 履歴拡張 + ストリーミング + 長連鎖・モデル比較 + Docker手順）

## 概要と目標

前フェーズ（FastAPI REST/WS API化）で `POST /api/simulations` / `GET /{id}` / `GET /{id}/logs` / `WS /ws/simulations/{id}` の API 層が完成した（89テスト全パス・`ruff`/`mypy --strict` クリーン・実 API E2E 検証済み）。本フェーズは同最終報告（`docs/final-report/lumann-fastapi-api.md`）に列挙された **次フェーズ候補6項目すべて** を1ループで実装し、ユーザーが「いちいち確認せず完走」できるよう MVP（実用最小限）で定義する。

6項目:
1. React 可視化ダッシュボード（`frontend/` 新設）
2. Docker 実機検証手順書（本環境は Docker 不可のため代替: 手順書 + 静的検証スクリプト拡張）
3. 動的エージェント順序選択（メタエージェントが次番発言者を選ぶ）
4. コンテキスト履歴拡張（直前K発言を参照）
5. ストリーミング応答（LLM 逐次トークン出力 / SSE）
6. 長連鎖観察・モデル比較実験（スクリプト + 手順書提供・実行はユーザー委譲）

### 目標
1. **React ダッシュボード**: `frontend/` を新設し「お題入力フォーム → シミュレーション起動 → WebSocket 接続で発言時系列表示」の最小フローを提供する。CORS で `localhost:5173` を許可し、Docker Compose で `backend(8000) + frontend(5173)` が一発起動できるようにする。
2. **Docker 手順書**: 本環境は Docker 不可のため、`docs/ops/docker-deploy-guide.md` に実機手順をまとめ、`scripts/verify_docker_static.py` を frontend サービス検証付きで拡張する。
3. **動的エージェント順序選択**: `AgentSpec` に `is_meta: bool` を追加し、メタエージェントが「次番発言者」を LLM 応答から選ぶモード（`agent_order_mode: "dynamic"`）を実装する。従来ラウンドロビン（`"fixed"`）は後方互換で維持。
4. **コンテキスト履歴拡張**: `SimulationConfig.history_length`（直前K発言参照・デフォルト1=従来同等）を追加し、プロンプトに過去発言を含める。
5. **ストリーミング応答**: `LLMClient` に `complete_stream`（`AsyncIterator[str]`）を追加し、`GET /api/simulations/{id}/stream`（SSE）でトークン単位の逐次出力を提供する。CLI は非ストリーミング維持（YAGNI）。
6. **長連鎖・モデル比較**: `scripts/run_long_chain.sh` と `scripts/compare_models.py` および手順書・結果レポート雛形を `docs/experiments/` に提供する。実 API 実行はユーザー委譲。

### スコープ原則（MVP・YAGNI）
- 各項目は「動作する最小実装 + テスト1-2件」に留め、過剰機能を含めない。
- React ダッシュボードは「お題入力 → WS 接続 → 発言時系列表示」の最小構成。グラフ・統計・永続化はスコープ外。
- 動的順序・履歴拡張・ストリーミングは「動作確認 + 既存テストが壊れないこと」が基準。
- 長連鎖・モデル比較は「スクリプトと手順書の提供」が成果物。実 API 実行結果はユーザー環境で別途取得。

### スコープ外（明示）
- ダッシュボードのグラフ・統計・複数シミュレーション一覧画面・永続化
- 認証・認可（ローカル・trusted network 前提は継承）
- 動的順序の複雑なスケジューリング（重複回避・優先度等は最小限）
- ストリーミングのキャンセル・リジューム・バックプレッシャ制御
- 長連鎖・モデル比較の自動バッチ実行基盤（CI 組込もスコープ外）

## ターゲットユーザー / ユースケース

### ターゲットユーザー
- **研究者・観察者**: ブラウザからお題を入力し、複数AI人格の発言をリアルタイムで観察したい者。
- **実験者**: 長連鎖（100ターン以上）や複数モデルの比較実験を CLI で実行し、結果を JSONL で取得したい者。
- **運用者**: Docker Compose 一発で `backend + frontend` を起動し、`http://localhost:5173` でダッシュボードを開きたい者。
- **開発者**: `complete_stream` / 動的順序 / 履歴拡張 を既存 API に拡張する設計を理解したい者。

### ユースケース
1. **UC-1: ブラウザからシミュレーション起動・観察**
   - 利用者が `http://localhost:5173` を開き、お題と `max_turns` を入力し「開始」ボタンを押す。
   - フロントエンドは `POST /api/simulations` を呼び、返却された `simulation_id` で `WS /ws/simulations/{id}` に接続。
   - 発言が時系列で表示され、シミュレーション完了時に完了表示が出る。
2. **UC-2: ストリーミング観察**
   - 利用者が `GET /api/simulations/{id}/stream`（SSE）に接続すると、各発言のトークンが逐次 push される。
   - 1発言完了ごとに区切りメッセージが入り、次発言に移る。
3. **UC-3: 動的順序でディスカッション**
   - 利用者が `AGENTS_CONFIG` でメタエージェント1人 + 通常エージェント複数を定義し、`AGENT_ORDER_MODE=dynamic` を設定。
   - 各ターン終了後にメタエージェントが次番発言者を選び、そのエージェントが次ターンで発言する。
4. **UC-4: 履歴拡張で文脈維持**
   - 利用者が `HISTORY_LENGTH=3` を設定。各発言のプロンプトに直前3発言が含まれ、長連鎖でも文脈が維持される。
5. **UC-5: 長連鎖実験**
   - 実験者が `scripts/run_long_chain.sh config/presets/agents-5.yaml 100 "お題"` を実行。100ターンの発言が `logs/long_chain_<timestamp>.jsonl` に保存される。
6. **UC-6: モデル比較実験**
   - 実験者が `scripts/compare_models.py --models gemma4:31b gpt-oss:20b llama3.1:8b --trigger "お題"` を実行。同一お題での発言長・ターンあたり時間・語彙多様性等の簡易統計が `docs/experiments/model-comparison.md` に整理される。
7. **UC-7: Docker 一発起動**
   - 運用者が `docker compose up --build` を実行。`http://localhost:8000/docs` で API・`http://localhost:5173` でダッシュボードが開く。

## 機能要件 (必須)

### FR-1: React 可視化ダッシュボード（`frontend/` 新設）
- `frontend/package.json` / `vite.config.ts` / `tsconfig.json` / `tailwind.config.js` / `postcss.config.js` / `index.html` / `src/main.tsx` / `src/App.tsx` / `src/index.css` を新設。
- React 19 + Vite + TypeScript strict + Tailwind CSS。
- 最小画面構成:
  - お題入力フォーム（`trigger_message`・`max_turns`・省略可能 `agents_config`）
  - 「開始」ボタン → `POST /api/simulations` 呼出
  - `simulation_id` 取得後 `WS /ws/simulations/{id}` に接続し、`Message` を時系列リスト表示
  - 完了・失敗イベントの表示
- `vite.config.ts` で `server.proxy` により `/api` / `/ws` を `http://localhost:8000` にプロキシ（CORS を回避する最小構成）。ただし FastAPI 側にも CORS で `http://localhost:5173` を許可する設定を入れる（両翼保全）。
- ESLint / `tsc -b` strict クリーン。
- Vitest 最小テスト1-2件（例: フォームの入力値バリデーション・メッセージ表示コンポーネント）。

### FR-2: FastAPI 側 CORS 設定
- `backend/app/server.py` に `CORSMiddleware` を追加。`allow_origins=["http://localhost:5173"]`・`allow_credentials=True`・`allow_methods=["*"]`・`allow_headers=["*"]`。
- 既存 REST / WS テストが影響受けないこと（CORS はヘッダ追加のみ）。

### FR-3: Docker Compose frontend サービス追加
- `docker-compose.yml` に `frontend` サービスを追加:
  - `build: { context: ./frontend, dockerfile: Dockerfile }`
  - `ports: ["5173:5173"]`
  - `depends_on: [backend]`
  - `healthcheck` は `http://localhost:5173/` の HTTP 200（`start_period: 5s` 程度）
- `frontend/Dockerfile` 新設: `node:20-slim` ベース・`npm install`・`npm run dev`（`--host 0.0.0.0`）。本番ビルド（`npm run build` + `serve`）は YAGNI でスコープ外。

### FR-4: Docker 実機検証手順書
- `docs/ops/docker-deploy-guide.md` 新設:
  - 前提（`.env` 作成・APIキー設定）
  - `docker compose up --build` で `backend(8000) + frontend(5173)` 起動
  - `http://localhost:8000/docs` で API 確認
  - `http://localhost:5173` でダッシュボード確認
  - `docker compose run --rm backend python -m app.main` で CLI 実行
  - `docker compose down` で停止
- `scripts/verify_docker_static.py` に frontend サービス検証追加:
  - `compose.services.frontend` が存在
  - `frontend.ports` に `5173:5173` 含まれる
  - `frontend.build.dockerfile` が `Dockerfile`（または `frontend/Dockerfile`）

### FR-5: 動的エージェント順序選択
- `AgentSpec` に `is_meta: bool = False` を追加。メタエージェントは `system_prompt` で「次に発言すべきエージェント名を選ぶ」プロンプトを持つ。
- `SimulationConfig` に `agent_order_mode: Literal["fixed", "dynamic"] = "fixed"` を追加。
- `run_simulation` の拡張:
  - `mode="fixed"`: 従来ラウンドロビン（後方互換）
  - `mode="dynamic"`: 各ターン終了後にメタエージェントを呼び出し、LLM 応答から次番エージェント名を抽出。次ターンはそのエージェントが発言。抽出失敗時はフォールバックでラウンドロビン次番。
  - メタエージェント自身は通常発言を生成せず、選択のみ行う。
- `config.py` / `.env.example` に `AGENT_ORDER_MODE`（デフォルト `fixed`）追加。
- `app/main.py` CLI は `config.agent_order_mode` を読んで `SimulationConfig` に設定。
- `server.py` の `SimulationStartRequest` にも `agent_order_mode` を省略可能項目として追加し、未指定時は `AppConfig` 経由。

### FR-6: コンテキスト履歴拡張
- `SimulationConfig` に `history_length: int = Field(default=1, ge=1)` を追加。
- `run_simulation` のプロンプト構築を変更:
  - 直前 `history_length` 件の発言を `user` メッセージ内に「過去の発言: ...」として列挙
  - `history_length=1` は従来の「直前の発言のみ」と同一挙動（後方互換）
- `config.py` / `.env.example` に `HISTORY_LENGTH`（デフォルト `1`）追加。
- `app/main.py` CLI と `server.py` の `SimulationStartRequest` に `history_length` 省略可能項目として追加。

### FR-7: ストリーミング応答（LLM 逐次出力）
- `LLMClient` Protocol に `async def complete_stream(messages) -> AsyncIterator[str]` を追加（オプショナル・既存 `complete` は維持）。
- `OpenAICompatibleClient` / `GeminiClient` にストリーミング実装を追加:
  - httpx で SSE（`stream=True`）を受信し、`data:` 行をパースしてトークンを `yield`。
  - 最後に `[DONE]` で終了。
- FastAPI に `GET /api/simulations/{id}/stream`（SSE エンドポイント）追加:
  - 接続すると当該シミュレーションの各発言のトークンを逐次 push。
  - 1発言ごとに区切りイベント（例: `event: agent_start` / `event: agent_done`）を挟む。
  - 完了時に `event: completed` で接続終了。
  - **MVP 簡略化**: `run_simulation` とは独立に、ストリーミング専用の軽量ループを走らせるか、`SimulationLogger` にストリームキューを追加するかは Tech Spec で決定。最小実装は「モック SSE でトークン逐次 push が確認できる」レベル。
- CLI は非ストリーミング維持（YAGNI）。
- テスト: モック SSE で逐次トークンが push されることを検証（1-2件）。

### FR-8: 長連鎖観察スクリプト
- `scripts/run_long_chain.sh` 新規:
  - 引数: `<agents_config_yaml> <max_turns> <trigger_message>`
  - `AGENTS_CONFIG` / `MAX_TURNS` 環境変数を設定し `python -m app.main` を非対話で起動（`trigger_message` を stdin から渡すか、CLI に引数追加が必要なら最小修正）。
  - 出力 JSONL を `logs/long_chain_<timestamp>.jsonl` に保存（`SimulationLogger` が既定で `logs/sim_<timestamp>.jsonl` を生成するため、リネームまたはコピー）。
- `docs/experiments/long-chain-observation.md` 雛形: 実行コマンド・期待結果・観察ポイント（発言の自己参照構造・テーマ持続性等）を記述する枠。

### FR-9: モデル比較スクリプト
- `scripts/compare_models.py` 新規:
  - 引数: `--models <model1> <model2> ...` / `--trigger <message>` / `--max-turns <N>`
  - 各モデルで同一お題・同一エージェント構成（1エージェント or プリセット）で `run_simulation` を実行。
  - 発言長・ターンあたり時間・語彙多様性（type-token ratio 等の簡易指標）を算出し、Markdown 表で出力。
  - 出力先: `docs/experiments/model-comparison.md`（上書き or タイムスタンプ付き追記は Tech Spec で決定）。
- `docs/experiments/model-comparison.md` 雛形: 実行コマンド・比較表フォーマット・考察欄。

### FR-10: テスト追加・品質維持
- バックエンド:
  - `test_simulation.py` に動的順序（モックメタエージェントで次番選択）・履歴拡張（`history_length=3` でプロンプトに3件含まれる）のテスト各1件。
  - `test_server.py` に SSE ストリーミングのモックテスト1件。
  - 既存89テストが引き続き全パス。
- フロントエンド:
  - Vitest でコンポーネント1-2件。
- `verify.sh` が frontend ステップ（`eslint` / `tsc` / `vitest`）も緑で通るよう拡張。

## 非機能要件 (パフォーマンス、UX等)

- **NFR-1: async 安全**
  - 共有状態（`_simulations`）へのアクセスは引き続き `async with _lock` 内。
  - SSE ストリーミングで blocking I/O を行わない（httpx `stream=True` + `async for`）。
  - メタエージェント呼出は `await` で同期し、共有状態の不整合を防ぐ。

- **NFR-2: 型安全**
  - すべての新規スキーマ（`is_meta` / `agent_order_mode` / `history_length` / SSE イベント）は Pydantic v2 `BaseModel` または `Literal`。
  - `mypy --strict` ゼロエラー。`Any` 使用禁止。
  - フロントエンドは TypeScript strict・`tsc -b` クリーン。

- **NFR-3: パフォーマンス**
  - ストリーミングは LLM のネイティブストリームをそのまま転送し、サーバでバッファしない。
  - 動的順序のメタエージェント呼出は1ターンあたり1回追加 LLM 呼出で、全体時間への影響は許容（実験的機能のため）。
  - 履歴拡張はプロンプト長増大を許容（`history_length` はユーザー責任で設定）。

- **NFR-4: UX**
  - ダッシュボードは「お題入力 → 開始 → 発言時系列表示 → 完了」の最小フローを1画面で完結。
  - SSE エンドポイントは `text/event-stream`・ブラウザ `EventSource` で消費可能。
  - エラーレスポンスは FastAPI 既定 `{"detail": "..."}` 形式を継承。

- **NFR-5: 後方互換性**
  - `AGENT_ORDER_MODE` / `HISTORY_LENGTH` 未設定時は従来挙動（`fixed` / `1`）。
  - `SimulationStartRequest` の新規項目はすべて省略可能・未指定時は `AppConfig` 経由でデフォルト。
  - 既存 CLI / API の挙動は変更しない。
  - 既存 `config/agents.yaml` / `config/presets/*.yaml` は `is_meta` 省略時 `False` で後方互換。

- **NFR-6: セキュリティ（最小限・継承）**
  - 認証・認可はスコープ外（ローカル・trusted network 前提）。
  - CORS は `http://localhost:5173` のみ許可（ワイルドカード不可）。
  - `agents_config` の `..` 拒否は既存仕様を継承。

- **NFR-7: コーディング制約**
  - コメント禁止（`pragma: no cover` 等のみ可）。
  - `ruff format` / `ruff check` / `mypy --strict` / `eslint` / `tsc -b` / `vitest` すべてクリーン。
  - 新規依存は `frontend/package.json` に局所化（React/Vite/Tailwind/TS 関連のみ）。

## 受け入れ基準 (Acceptance Criteria)

### 1. React 可視化ダッシュボード
- [ ] **AC-1**: `frontend/` 配下に `package.json` / `vite.config.ts` / `tsconfig.json` / `tailwind.config.js` / `src/main.tsx` / `src/App.tsx` が存在すること
- [ ] **AC-2**: `frontend/` で `npm install && npm run dev` が成功し `http://localhost:5173` でダッシュボードが開くこと（ローカル・Docker問わず）
- [ ] **AC-3**: ダッシュボードでお題と `max_turns` を入力し「開始」を押すと `POST /api/simulations` が呼ばれ `simulation_id` が返ること（モック or 実 API）
- [ ] **AC-4**: `WS /ws/simulations/{id}` に接続し `Message` が時系列リストに表示されること（モック LLM）
- [ ] **AC-5**: シミュレーション完了時に完了表示が出ること
- [ ] **AC-6**: `npm run lint`（ESLint）がパスすること
- [ ] **AC-7**: `npx tsc -b` がゼロエラーであること（strict モード）
- [ ] **AC-8**: `npx vitest run` が最小テスト1-2件で全パスすること

### 2. Docker 実機検証（代替）
- [ ] **AC-9**: `docs/ops/docker-deploy-guide.md` に `docker compose up --build` で `backend(8000) + frontend(5173)` が起動する手順が記載されていること
- [ ] **AC-10**: 同手順書に `http://localhost:8000/docs` と `http://localhost:5173` の確認手順が含まれること
- [ ] **AC-11**: `docker-compose.yml` に `frontend` サービスが追加され `ports: ["5173:5173"]` / `depends_on: [backend]` / `build` が設定されていること
- [ ] **AC-12**: `frontend/Dockerfile` が `node:20-slim` ベースで `npm install` → `npm run dev` を実行すること
- [ ] **AC-13**: `scripts/verify_docker_static.py` が frontend サービスの `ports` / `build.dockerfile` / `depends_on` を検証すること

### 3. 動的エージェント順序選択
- [ ] **AC-14**: `AgentSpec` に `is_meta: bool = False` が追加されていること
- [ ] **AC-15**: `SimulationConfig` に `agent_order_mode: Literal["fixed","dynamic"]` が追加されデフォルト `fixed` であること
- [ ] **AC-16**: `AGENT_ORDER_MODE=dynamic` で `run_simulation` が各ターン終了後にメタエージェントを呼び出し次番エージェントを選択すること（モック LLM・テストで確認）
- [ ] **AC-17**: `AGENT_ORDER_MODE` 未設定時は従来ラウンドロビン（`fixed`）で動作し既存テストが全パスすること
- [ ] **AC-18**: `server.py` の `SimulationStartRequest` に `agent_order_mode` が省略可能項目として追加されていること
- [ ] **AC-19**: `.env.example` に `AGENT_ORDER_MODE=` 行が追加されていること

### 4. コンテキスト履歴拡張
- [ ] **AC-20**: `SimulationConfig` に `history_length: int = Field(default=1, ge=1)` が追加されていること
- [ ] **AC-21**: `HISTORY_LENGTH=3` で `run_simulation` のプロンプトに直前3発言が含まれること（モック LLM の `messages` 引数で検証）
- [ ] **AC-22**: `HISTORY_LENGTH` 未設定時は `history_length=1` で従来「直前の発言のみ」と同一挙動であること（既存テスト全パス）
- [ ] **AC-23**: `server.py` の `SimulationStartRequest` に `history_length` が省略可能項目として追加されていること
- [ ] **AC-24**: `.env.example` に `HISTORY_LENGTH=` 行が追加されていること

### 5. ストリーミング応答
- [ ] **AC-25**: `LLMClient` Protocol に `async def complete_stream(messages) -> AsyncIterator[str]` が定義されていること
- [ ] **AC-26**: `OpenAICompatibleClient` / `GeminiClient` が `complete_stream` を実装し httpx SSE でトークンを逐次 `yield` すること（モック SSE テストで確認）
- [ ] **AC-27**: `GET /api/simulations/{id}/stream`（SSE）が `text/event-stream` でトークンを逐次 push すること（モック LLM・テストで確認）
- [ ] **AC-28**: SSE エンドポイント接続時に存在しない ID は即座に `404` またはエラーイベントで終了すること
- [ ] **AC-29**: 既存 `complete` / CLI は非ストリーミングのまま維持され既存テストが全パスすること
- [ ] **AC-30**: `/docs` に `GET /api/simulations/{id}/stream` が表示されること

### 6. 長連鎖観察・モデル比較実験
- [ ] **AC-31**: `scripts/run_long_chain.sh` が引数 `<agents_config> <max_turns> <trigger>` を受け付け `python -m app.main` を非対話で起動すること
- [ ] **AC-32**: 同スクリプトの実行結果（JSONL）が `logs/long_chain_<timestamp>.jsonl` に保存されること（手順書で確認・実 API 実行はユーザー委譲）
- [ ] **AC-33**: `docs/experiments/long-chain-observation.md` に実行コマンド・期待結果・観察ポイントの枠が記載されていること
- [ ] **AC-34**: `scripts/compare_models.py` が `--models` / `--trigger` / `--max-turns` 引数を受け付け各モデルで `run_simulation` を実行すること（モック or 実 API）
- [ ] **AC-35**: 同スクリプトが発言長・ターンあたり時間・語彙多様性等の簡易統計を Markdown 表で出力すること
- [ ] **AC-36**: `docs/experiments/model-comparison.md` に比較表フォーマットと考察欄の枠が記載されていること

### 型・品質・全体
- [ ] **AC-37**: `ruff format --check backend/ scripts/` がパスすること
- [ ] **AC-38**: `ruff check backend/ scripts/` がパスすること
- [ ] **AC-39**: `mypy --strict backend/app backend/tests scripts/verify_docker_static.py scripts/compare_models.py` がゼロエラーであること
- [ ] **AC-40**: `pytest -q backend/tests` が全パスすること（既存89 + 新規 動的順序/履歴/SSE 各1-2件）
- [ ] **AC-41**: `frontend/` で `npm run lint` / `npx tsc -b` / `npx vitest run` がすべて緑であること
- [ ] **AC-42**: `./.shared-agents/harness/verify.sh` が frontend ステップを含めて緑で完了すること

### CORS・依存
- [ ] **AC-43**: `backend/app/server.py` に `CORSMiddleware` が追加され `http://localhost:5173` が許可されていること
- [ ] **AC-44**: `requirements.txt` / `pyproject.toml` に不要な依存が追加されていないこと（React/Vite 関連は `frontend/package.json` のみ）

## 未解決・考慮事項

### Tech Spec で決定すべき設計事項
1. **SSE ストリーミングと `run_simulation` の関係**: ストリーミング専用の軽量ループを新設するか、`SimulationLogger` にストリームキューを追加して既存 `run_simulation` からトークン単位で push するか。MVP では「モック SSE で逐次 push が確認できる」レベルでよいが、実 API で `complete_stream` を統合する方法は Tech Spec で確定。
2. **メタエージェントの応答パース**: LLM 応答からエージェント名を抽出する方式（正規表現・JSON強制・先頭行一致等）。抽出失敗時のフォールバック（ラウンドロビン次番・直前と同一エージェント・エラー停止）は Tech Spec で判断。
3. **長連鎖スクリプトの非対話起動**: `python -m app.main` は現在 `input()` で対話的。`run_long_chain.sh` で stdin 経由で `trigger_message` を渡すか、CLI に `--trigger` 引数を追加するか。最小修正は stdin。
4. **`compare_models.py` の実行方式**: `run_simulation` を直接 import して in-process で回すか、サブプロセスで CLI を起動するか。in-process の方が統計取得が容易だが、`AppConfig` の差し替えが必要。Tech Spec で決定。
5. **`docs/experiments/` の出力上書き**: `compare_models.py` が毎回上書きするかタイムスタンプ付きで追記するか。MVP は上書きでよいが、履歴保全が必要かはユーザー確認事項（本フェーズでは上書きで進める）。
6. **フロントエンドのプロキシ vs CORS**: `vite.config.ts` の `server.proxy` と FastAPI CORS の両方を設定するか、どちらか一方にするか。両翼保全（両方設定）を推奨するが、Tech Spec で最終判断。
7. **`frontend/Dockerfile` の本番ビルド**: 本フェーズは `npm run dev`（開発サーバ）のみ。本番ビルド（`npm run build` + `serve` / nginx）は次フェーズ候補。
8. **`verify.sh` の frontend ステップ統合**: Docker 環境とローカル環境の両方で `npm` が利用可能か。ローカルで `npm` 未導入時のフォールバック（スキップ or 警告）は Tech Spec で判断。

### スコープ外・次フェーズ候補
- ダッシュボードのグラフ・統計・複数シミュレーション一覧・永続化
- 動的順序の高度なスケジューリング（重複回避・優先度・発言回数制限）
- ストリーミングのキャンセル・リジューム・バックプレッシャ制御
- 長連鎖・モデル比較の CI 自動実行・バッチ基盤
- `httpx2` 移行（StarletteDeprecationWarning 対応・機能影響なし・次フェーズ）
- `agents_config` パス検証強化（`Path.resolve()` とベースディレクトリ比較への移行）
- フロントエンド本番ビルド（nginx / serve）・CDN 配信

### 環境制約の引継ぎ
- 本開発環境は WSL2 Ubuntu 24.04 / Python 3.12.3 / **Docker 不可**（WSL に docker 未導入）。Docker 実機検証（`docker compose up --build`）は手順書 + 静的検証スクリプトで代替し、実機実行はユーザー委譲。
- venv `/home/yuma/projects/social-autopoiesis-sandbox/.venv`（fastapi/uvicorn/pytest/mypy/ruff/respx 導入済み）を継続利用。
- 実 API（Ollama Cloud / gemma4:31b）動作確認済み。長連鎖・モデル比較の実 API 実行はユーザー環境で実施。

---

*本 PRD は prd-manager ペルソナによって作成された。Tech Spec（`docs/spec/lumann-phase-final.md`）は本 PRD の受け入れ基準 AC-1〜AC-44 を満たす設計を提示すること。各項目は MVP で定義し、ユーザーは「いちいち確認せず完走」を希望している。*