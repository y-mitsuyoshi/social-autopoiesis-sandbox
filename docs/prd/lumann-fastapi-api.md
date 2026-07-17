# PRD: FastAPI REST/WS API化

## 概要と目標

前フェーズ（複数AI人格・エージェントごとのモデル選択・人数可変）で CLI ベースのルーマン・オートポイエーシス・シミュレーションが完成した（76テスト全パス・`ruff`/`mypy --strict` クリーン・実API E2E 検証済み）。本フェーズでは同シミュレーションを **FastAPI REST / WebSocket API** として外部から起動・観察可能にする。

最終報告（`docs/final-report/lumann-multi-agent.md`）に列挙された次フェーズ候補のうち、本フェーズは **FastAPI REST/WS API化 のみ** に限定する。React可視化ダッシュボードは次々フェーズとし、本フェーズでは OpenAPI (`/docs`) と curl / wscat 等の汎用クライアントで検証可能な API 層を提供することを目標とする。

### 目標
1. `run_simulation` を CLI と API の双方から利用可能な `backend/app/simulation.py` に切り出し、重複を排除する。
2. `POST /api/simulations` でシミュレーションをバックグラウンド起動し、`GET /api/simulations/{id}` で状態、`GET /api/simulations/{id}/logs` で JSONL ログ、`WS /ws/simulations/{id}` でリアルタイム発言を取得できるようにする。
3. シミュレーション状態は `asyncio.Lock` で保護されたインメモリ `dict` で管理し、YAGNI に従い永続化は行わない。
4. Docker Compose で `ports: 8000` を公開し、`uvicorn app.server:app` で起動する。CLI (`python -m app.main`) は従来通り動作する。
5. FastAPI TestClient で REST / WebSocket の単体テストを追加し、`verify.sh` が緑になることを保証する。

### スコープ外（明示）
- React 可視化ダッシュボード（`frontend/`）— 次々フェーズ
- 動的エージェント順序選択・コンテキスト履歴拡張・ストリーミング応答（SSE / LLM 逐次出力）・長連鎖観察・モデル比較実験
- 認証・認可（API はローカル・trusted network 前提）
- 永続化ストレージ（シミュレーション状態・ログはインメモリおよびファイルシステム上の JSONL のみ）

## ターゲットユーザー / ユースケース

### ターゲットユーザー
- **研究者・開発者**: ルーマンの機能システム論に基づくマルチエージェント対話を、CLI 以外の手段（HTTP / WS クライアント、Jupyter、スクリプト）から起動・観察したい者。
- **次々フェーズの React フロントエンド実装者**: 本 API をバックエンドとして利用する者（本フェーズではフロントエンドを作らないが、API 設計はフロントエンド利用を前提とする）。
- **運用者**: Docker Compose 一つで API サーバを立ち上げ、curl / wscat で疎通確認したい者。

### ユースケース
1. **UC-1: API 経由でシミュレーション起動**
   - 利用者が `POST /api/simulations` に `trigger_message` / `max_turns` / 省略可能 `agents_config`（YAML パス or インライン）を送信する。
   - サーバはシミュレーションID（UUID 等）を発行し、バックグラウンドタスクで `run_simulation` を開始する。
   - 即座に `202 Accepted` 相当のレスポンス（シミュレーションID + 状態 `running`）を返す。
2. **UC-2: シミュレーション状態取得**
   - `GET /api/simulations/{id}` で状態（`running` / `completed` / `failed`）・開始時刻・終了時刻・ターン数を取得する。
   - 存在しない ID の場合は `404`。
3. **UC-3: ログ取得**
   - `GET /api/simulations/{id}/logs` で当該シミュレーションの JSONL ログを JSON 配列（`list[Message]`）で返す。
   - 実行中でも現在までのログを取得可能。
4. **UC-4: リアルタイム観察（WebSocket）**
   - `WS /ws/simulations/{id}` に接続すると、各発言完了時に `Message`（JSON）が push される。
   - シミュレーション終了時に終了イベント（`{"event": "completed"}` or `{"event": "failed", "error": "..."}`）を送信し接続を閉じる。
   - 存在しない ID への接続は即座に閉じる（またはエラーメッセージ送信後閉じる）。
5. **UC-5: CLI 併用**
   - 従来通り `python -m app.main` で CLI 実行が可能（API サーバ起動とは独立）。
6. **UC-6: Docker 起動**
   - `docker compose up --build` で `http://localhost:8000` に API が立ち上がり、`/docs` で OpenAPI UI が見える。

## 機能要件 (必須)

- **FR-1: `run_simulation` 切り出し**
  - `backend/app/main.py` の `run_simulation` を `backend/app/simulation.py` に移動。
  - `main.py` は `from app.simulation import run_simulation` して CLI エントリポイント `main()` のみを残す。
  - 既存の `validate_agent_credentials` は CLI / API 共通のため `simulation.py`（または `app/main.py` ではなく `app/agents.py` 等）に配置し、双方から import 可能にする。
  - 既存テスト（`test_simulation.py` 等）が import パス変更に追従し、76 テストが引き続き全パスすること。

- **FR-2: FastAPI アプリ定義（`backend/app/server.py` 新設）**
  - `app = FastAPI(title=..., version=...)` を定義。
  - `uvicorn app.server:app` で起動可能。
  - CORS は次々フェーズの React 用に `localhost:5173` 等を許可する設定を**最小限**入れてもよいが、YAGNI を優先し必要最小限（または未設定）とする。

- **FR-3: `POST /api/simulations`（シミュレーション起動）**
  - リクエストボディ（Pydantic `BaseModel`）: `trigger_message: str` / `max_turns: int`（≥0） / `agents_config: str | None`（YAML ファイルパス）。※インラインエージェント定義は YAGNI により**スコープ外**、`agents_config` は既存 `AGENTS_CONFIG` と同様にファイルパスとする。
  - サーバは `AppConfig`（`load_config()`）を取得後、`agents_config` が指定されていればそちらを優先して `load_agents` を呼ぶ。
  - `validate_agent_credentials` で検証失敗時は `422`（または `400`）でエラーメッセージを返す。
  - 成功時: シミュレーションID（UUID4 文字列）を生成し、`asyncio.Lock` で保護されたインメモリ `dict[str, SimulationState]` に状態 `running` で登録。
  - `asyncio.create_task` でバックグラウンド実行を開始し、レスポンス `201` で `{ "simulation_id": "...", "status": "running" }` を返す。
  - バックグラウンドタスク内で例外発生時は状態を `failed` にし、エラーメッセージを保持する。

- **FR-4: `GET /api/simulations/{id}`（状態取得）**
  - レスポンス: `{ "simulation_id", "status": "running|completed|failed", "started_at", "finished_at" | null, "turn_count", "error" | null }`。
  - 存在しない ID は `404`。

- **FR-5: `GET /api/simulations/{id}/logs`（ログ取得）**
  - 当該シミュレーションの `SimulationLogger` が書いた JSONL ファイルを行ごとに読み込み、`list[Message]`（Pydantic モデル配列）で返す。
  - 実行中は現在までのログを返す。
  - 存在しない ID は `404`。ログファイル未存在（開始直後等）は空配列 `[]` を返す。

- **FR-6: `WS /ws/simulations/{id}`（リアルタイム配信）**
  - 接続すると、当該シミュレーションの発言完了ごとに `Message` の JSON を push する。
  - シミュレーション終了時に `{"event": "completed"}` を、失敗時に `{"event": "failed", "error": "..."}` を送信し接続を閉じる。
  - 存在しない ID への接続は `{"event": "not_found"}` 送信後に閉じる。
  - 実装は `SimulationLogger` にコールバック登録機構（`asyncio.Queue` per 接続、または `set[Callable[[Message], Awaitable[None]]]`）を追加し、`log()` 完了後に呼び出す。複数接続のブロックを避けるため各接続は `asyncio.Queue` を挟む設計とする。

- **FR-7: インメモリ状態管理**
  - `SimulationState`（Pydantic `BaseModel`）: `simulation_id: str` / `status: Literal["running","completed","failed"]` / `started_at: datetime` / `finished_at: datetime | None` / `turn_count: int` / `error: str | None` / `log_path: Path | str`。
  - `_simulations: dict[str, SimulationState]` をモジュールグローバルに持ち、`asyncio.Lock` で保護して read/write する。
  - プロセス再起動で状態は消失（YAGNI・スコープ外の永続化は明示除外）。

- **FR-8: 依存追加**
  - `requirements.txt` / `pyproject.toml` に `fastapi`, `uvicorn[standard]` を追加。`websockets` は `uvicorn[standard]` に含まれるため個別追加しない。
  - `pytest` 用に `httpx`（既存依存）ベースの FastAPI `TestClient` を利用。必要に応じて `pytest-asyncio` は既存依存を再利用。

- **FR-9: Docker 設定変更**
  - `docker-compose.yml` の `backend` サービスに `ports: ["8000:8000"]` を追加。
  - `backend/Dockerfile` の `CMD` を `uvicorn app.server:app --host 0.0.0.0 --port 8000` に変更。
  - CLI を残すための `docker compose run --rm backend python -m app.main` が引き続き動くよう、`CMD` を API 既定としつつ `entrypoint` で上書き可能な構造を維持（`ENTRYPOINT` は `python` のままで `CMD` のみ uvicorn）。
  - `healthcheck` を `/docs` または `/api/simulations` の GET（存在しないIDでも404が返るエンドポイント）の HTTP 疎通に変更し、API 起動を検知する。`start_period` は十分に長め（例: 10s）。

- **FR-10: OpenAPI ドキュメント**
  - FastAPI 自動生成の `/docs`（Swagger UI）と `/redoc` が既定でアクセス可能。すべての REST / WS エンドポイントに Pydantic スキーマ・説明文を付与し、UI 上で完結に理解できること。

- **FR-11: テスト追加**
  - `backend/tests/test_server.py` 新設:
    - REST: `POST /api/simulations` 正常系（モック LLM で即完了）・`GET /{id}` 状態遷移・`GET /{id}/logs` ログ配列・`404` 系。
    - WS: `WS /ws/simulations/{id}` でモック発言が push され `completed` イベントで閉じること。
  - LLM は既存テストのモックパターン（`LLMClient` Protocol を満たすフェイク）を再利用し、実 API を呼ばない。
  - 既存76テストが引き続き全パス。`verify.sh`（ruff format / ruff check / mypy --strict / pytest / eslint / tsc / vitest）が緑。

## 非機能要件 (パフォーマンス、UX等)

- **NFR-1: async 安全**
  - 共有状態（`_simulations`）へのアクセスはすべて `async with _lock` 内で行う。
  - `run_simulation` バックグラウンドタスク内で blocking I/O を行わない（既存コード準拠）。`input()` は CLI のみ。
  - WebSocket 接続ごとに `asyncio.Queue` を用意し、1接続の遅延が他接続・シミュレーション本体をブロックしないこと。

- **NFR-2: 型安全**
  - すべてのリクエスト/レスポンス・状態モデルは Pydantic v2 `BaseModel`。
  - `mypy --strict` ゼロエラー。`Any` 使用禁止。

- **NFR-3: パフォーマンス**
  - 単一シミュレーションの REST オーバーヘッドは CLI と比較して無視できる程度（HTTP ラップのみ）。
  - WebSocket push は各発言完了後ただちに（同イベンループ tick 内で）行われること。LLM 応答時間が支配的であり、API 層のレイテンシ要件は個別に設定しない（YAGNI）。

- **NFR-4: UX（API 利用者）**
  - `/docs` で全エンドメント・スキーマが閲覧可能。
  - エラーレスポンスは FastAPI 既定の `{"detail": "..."}` 形式に統一。
  - WebSocket メッセージは `Message` スキーマと同一の JSON 構造（`event` メッセージのみ追加フィールド）。

- **NFR-5: 後方互換性**
  - CLI (`python -m app.main`) は従来通り動作すること。`run_simulation` 切り出しにより挙動変化なし。
  - 既存 `config/agents.yaml` / `config/presets/*.yaml` / `.env` 仕様は変更しない。

- **NFR-6: セキュリティ（最小限）**
  - 認証・認可はスコープ外（ローカル・trusted network 前提）。
  - `agents_config` パスはサーバ作業ディレクトリ内の相対パスを受け付ける。パストラバーサル対策は**最小限**（絶対パスの `..` を含む場合は拒否）程度とし、過剰なバリデーションは YAGNI により行わない。ただし `..` を含むパスは `422` で拒否すること。

- **NFR-7: コーディング制約**
  - コメント禁止（`pragma: no cover` 等のみ可）。
  - `ruff format` / `ruff check` クリーン。

## 受け入れ基準 (Acceptance Criteria)

### 機能 — REST / WS
- [ ] **AC-1**: `POST /api/simulations` に `{"trigger_message":"test","max_turns":3}` を送信すると `201` と `simulation_id` が返り、状態が `running` で登録されること（モック LLM）
- [ ] **AC-2**: `GET /api/simulations/{id}` で状態 `running` → `completed` へ遷移すること（ポーリングまたは完了待ち）
- [ ] **AC-3**: `GET /api/simulations/{id}/logs` が `list[Message]` 形式の JSON 配列を返すこと（実行中でも現在までのログ）
- [ ] **AC-4**: 存在しない ID への `GET /api/simulations/{id}` が `404` を返すこと
- [ ] **AC-5**: 存在しない ID への `GET /api/simulations/{id}/logs` が `404` を返すこと
- [ ] **AC-6**: `WS /ws/simulations/{id}` に接続すると `Message` が順次 push され、最後に `{"event":"completed"}` が送信され接続が閉じること（モック LLM）
- [ ] **AC-7**: 存在しない ID への `WS /ws/simulations/{id}` 接続が `{"event":"not_found"}` 送信後に閉じること
- [ ] **AC-8**: シミュレーション失敗時（LLM エラー等）に状態が `failed` となり `error` フィールドにメッセージが格納されること（モックで LLMError 送出）
- [ ] **AC-9**: `POST /api/simulations` で `agents_config` に `config/presets/agents-5.yaml` を指定すると当該プリセットで起動すること（モック LLM・agent_order が5人）

### 機能 — 切り出し・CLI 互換
- [ ] **AC-10**: `backend/app/simulation.py` に `run_simulation` が存在し、`main.py` は `from app.simulation import run_simulation` していること
- [ ] **AC-11**: `python -m app.main` が従来通り CLI で起動し、`trigger_message` 入力 → シミュレーション実行 → ログ出力されること（モック可）
- [ ] **AC-12**: `validate_agent_credentials` が API / CLI 双方から利用可能なモジュールに配置されていること

### 機能 — Docker / 起動
- [ ] **AC-13**: `uvicorn app.server:app` でサーバが起動し `GET /docs` が 200 を返すこと（ローカル or Docker）
- [ ] **AC-14**: `docker compose up --build` で `http://localhost:8000/docs` が 200 を返すこと（Docker 環境）
- [ ] **AC-15**: `docker compose run --rm backend python -m app.main` で従来 CLI が動くこと（Docker 環境）
- [ ] **AC-16**: `docker-compose.yml` に `ports: ["8000:8000"]` が追加されていること
- [ ] **AC-17**: `backend/Dockerfile` の `CMD` が `uvicorn app.server:app --host 0.0.0.0 --port 8000` であること

### 機能 — OpenAPI / スキーマ
- [ ] **AC-18**: `/docs`（Swagger UI）に REST 3エンドポイント + WS 1エンドポイントが表示され、リクエスト/レスポンススキーマが閲覧可能なこと
- [ ] **AC-19**: `POST /api/simulations` のリクエストモデル・`SimulationState` レスポンスモデルが Pydantic `BaseModel` として定義されていること

### 型・品質
- [ ] **AC-20**: `ruff format --check backend/` がパスすること
- [ ] **AC-21**: `ruff check backend/` がパスすること
- [ ] **AC-22**: `mypy --strict backend/app backend/tests` がゼロエラーであること
- [ ] **AC-23**: `pytest -q backend/tests` が全パスすること（既存76 + 新規 server テスト）
- [ ] **AC-24**: `backend/tests/test_server.py` に REST 単体テスト（正常系・404・状態遷移・logs）が含まれること
- [ ] **AC-25**: `backend/tests/test_server.py` に WebSocket テスト（push・completed・not_found）が含まれること
- [ ] **AC-26**: `./.shared-agents/harness/verify.sh` が緑で完了すること（Docker またはローカル）

### セキュリティ・制約
- [ ] **AC-27**: `agents_config` に `..` を含むパスを指定した場合 `422` で拒否されること
- [ ] **AC-28**: `_simulations` への全アクセスが `async with _lock` 内で行われていること（コードレビュー・テストで確認）

### 依存
- [ ] **AC-29**: `requirements.txt` / `pyproject.toml` に `fastapi` と `uvicorn[standard]` が追加されていること
- [ ] **AC-30**: Docker 環境 (`docker compose up --build`) で上記 AC-1〜AC-9・AC-13〜AC-15 が検証可能であること

## 未解決・考慮事項

### 次フェーズへの引継ぎ（スコープ外を明示）
- **React 可視化ダッシュボード**: 次々フェーズ。本 API の `WS /ws/simulations/{id}` と `GET /api/simulations/{id}/logs` をフロントエンドから消費する。CORS 設定（`localhost:5173` 許可）は次々フェーズで React 実装時に追加する。本フェーズでは CORS 未設定でも API 単体テスト・curl/wscat 検証には影響しない。
- **動的エージェント順序選択**: `agent_order` を API リクエストで指定可能にする機能。本フェーズでは `load_agents` が返すエージェント順をそのまま `agent_order` とする（既存 CLI と同等）。
- **コンテキスト履歴拡張**: 発言履歴をプロンプトに含める機能。本フェーズでは既存の「直前の発言のみ」を維持。
- **ストリーミング応答（SSE / LLM 逐次出力）**: 本フェーズでは LLM 完了後に WebSocket push する丸め単位のみ。逐次トークンストリーミングはスコープ外。
- **長連鎖観察・モデル比較実験**: 別フェーズ。

### 設計上の未解決事項
1. **シミュレーションID のフォーマット**: UUID4 文字列を想定。UUID はモックテストで固定値を注入可能にするため、ID 生成関数を差し替え可能にするかどうかは Tech Spec で判断。
2. **同時実行数上限**: インメモリ dict で無制限にバックグラウンドタスクを起動できるが、LLM クライアント・ファイルディスクリプタの枯渇が懸念。本フェーズでは YAGNI として上限を設けないが、Tech Spec で `asyncio.Semaphore` の必要性を検討する。
3. **`SimulationLogger` のコールバック機構**: 既存 `log()` を拡張するか、新規 `EventBus` 的なクラスを挟むか。Tech Spec で `asyncio.Queue` per WS 接続の設計を確定する。`SimulationLogger` が `aclose()` でコールバックを解放する責務を持つこと。
4. **`agents_config` パスバリデーション**: `..` 拒否のみで十分か、作業ディレクトリ外の絶対パスを許可するかは Tech Spec で判断。ローカル・trusted network 前提を踏まえ最小限とする方針。
5. **CLI と API の責務分離**: `validate_agent_credentials` の置き場所（`agents.py` / 新規 `app/auth.py` / `simulation.py`）は Tech Spec で決定。実害のない範囲で既存テストの import を最小修正にする。
6. **WS 接続のライフサイクル**: シミュレーション開始前に接続した場合（`running` 登録直後〜発言開始前）のキューイング方式。`SimulationState` に接続中キューのリストを持たせるか、別管理にするかは Tech Spec で確定。
7. **既存 `SimulationLogger` の `logs_dir` と API のログパス紐付け**: `SimulationLogger` が生成する `sim_<timestamp>.jsonl` を `SimulationState.log_path` に保持し、`GET /logs` で読み出す。複数シミュレーションで同秒開始の衝突可能性は既存仕様に準じる（秒精度・実用上問題なし）。
8. **Docker `CMD` 切替**: `ENTRYPOINT` を `python` のままとし `CMD` を uvicorn にすることで `docker compose run --rm backend python -m app.main` が上書き可能。ただし uvicorn を引数 `python -m uvicorn` で呼ぶか直接バイナリで呼ぶかは Tech Spec で確定。
9. **CORS**: 本フェーズでは未設定（スコープ外）。次々フェーズで React 用に追加。
10. **`/redoc`**: 既定で有効のままとするか否か。YAGNI により既定のままとする方針（無効化コストの方が高い）。

---

*本 PRD は `/prd` または prd-manager ペルソナによって作成された。Tech Spec（`docs/spec/lumann-fastapi-api.md`）は本 PRD の受け入れ基準 AC-1〜AC-30 を満たす設計を提示すること。*