# Tech Spec: Luhmann Simulation FastAPI REST/WS API 化

## コンテキスト

前フェーズで CLI ベースのルーマン・オートポイエーシス・マルチエージェントシミュレーションが完成した（`backend/app/main.py` の `run_simulation`、76 テスト全パス・`ruff` / `mypy --strict` クリーン・実 API E2E 検証済み）。本フェーズでは同シミュレーションを **FastAPI REST / WebSocket API** として外部から起動・観察可能にする。React 可視化ダッシュボードは次々フェーズとし、本フェーズでは OpenAPI (`/docs`) と curl / wscat 等の汎用クライアントで検証可能な API 層のみを提供する。

PRD: `docs/prd/lumann-fastapi-api.md`（AC-1〜AC-30）

現行アーキテクチャの要点:
- `backend/app/main.py`: `validate_agent_credentials` / `run_simulation` / CLI `main()` を保持
- `backend/app/agents.py`: `load_agents()` / ハードコード fallback / `_resolve_config_path()`
- `backend/app/llm_client.py`: `LLMClient` Protocol / `build_agent_clients` / `close_all_clients`
- `backend/app/logger.py`: `SimulationLogger`（`asyncio.Lock` でファイル追記保護・`aclose()` で閉鎖）
- `backend/app/schemas.py`: `AgentSpec` / `AppConfig` / `SimulationConfig` / `Message` / `LLMResponse`
- `backend/app/config.py`: `load_config()` で `.env` から `AppConfig` 構築
- Docker: `python:3.12-slim` / 非 root / `CMD ["python", "-m", "app.main"]` / `logs` ボリューム

## 目標 / 非目標

- **目標**:
  1. `run_simulation` を `backend/app/simulation.py` に切り出し CLI / API 双方から利用（FR-1）
  2. `POST /api/simulations` でバックグラウンド起動・`GET /api/simulations/{id}` で状態・`GET /api/simulations/{id}/logs` で JSONL ログ・`WS /ws/simulations/{id}` でリアルタイム発言（FR-3〜FR-6）
  3. `asyncio.Lock` 保護されたインメモリ `dict[str, SimulationState]` で状態管理（FR-7）
  4. Docker Compose で `ports: 8000` 公開・`uvicorn app.server:app` 起動・CLI は `docker compose run --rm backend python -m app.main` で併存（FR-9）
  5. FastAPI `TestClient` で REST / WS 単体テスト追加・`verify.sh` 緑（FR-11）
- **非目標**:
  - React 可視化ダッシュボード（次々フェーズ）
  - 認証・認可（ローカル・trusted network 前提）
  - 永続化ストレージ（インメモリ + JSONL ファイルのみ）
  - 動的エージェント順序・コンテキスト履歴拡張・SSE / トークンストリーミング
  - CORS 設定（次々フェーズで React 実装時に追加）
  - 同時実行数上限（YAGNI・`asyncio.Semaphore` は導入しない）

## アーキテクチャ上の決定

### ADR-1: `run_simulation` 切り出し先 = `backend/app/simulation.py`
- **決定**: `run_simulation` と `validate_agent_credentials` を `backend/app/simulation.py` に移動。`main.py` は `from app.simulation import run_simulation, validate_agent_credentials` して CLI `main()` のみ残す。
- **理由**: PRD FR-1 / 必須決定 1 の指示。`agents.py` ではなく `simulation.py` に置くことで、`agents.py`（純粋なエージェント定義読込）と `simulation.py`（シミュレーション実行ロジック）の責務分離を明確化。CLI / API 双方からの import パスを一本化。
- **影響**: `test_simulation.py:10` の `from app.main import run_simulation` を `from app.simulation import run_simulation` に変更（AC-10 / AC-12）。

### ADR-2: FastAPI アプリ = `backend/app/server.py` 新設
- **決定**: `backend/app/server.py` 新設。`app = FastAPI(title="Luhmann Autopoiesis Simulation API", version="0.1.0")`。`uvicorn app.server:app --host 0.0.0.0 --port 8000` で起動。
- **理由**: FR-2。`main.py`（CLI）と `server.py`（API）のエントリポイント分離。`if __name__ == "__main__"` による二重起動判定を避けるためモジュール分割。
- **CORS**: 本フェーズでは未設定（YAGNI・スコープ外）。次々フェーズで React 実装時に `CORSMiddleware` 追加。

### ADR-3: スキーマ定義 = `schemas.py` 拡張
- **決定**: 既存 `backend/app/schemas.py` に新規 Pydantic モデルを追加:
  - `SimulationStartRequest(BaseModel)`: `trigger_message: str`, `max_turns: int = Field(ge=0)`, `agents_config: str | None = None`
  - `SimulationStartResponse(BaseModel)`: `simulation_id: str`, `status: Literal["running","completed","failed"]`
  - `SimulationState(BaseModel)`: `simulation_id: str`, `status: Literal["running","completed","failed"]`, `started_at: datetime`, `finished_at: datetime | None = None`, `turn_count: int = 0`, `error: str | None = None`, `log_path: str`
  - `WebSocketEvent(BaseModel)`: `event: Literal["completed","failed","not_found"]`, `error: str | None = None`
- **理由**: `server.py` 内に定義せず `schemas.py` に集約することで OpenAPI スキーマ自動生成と mypy 型検証を一元化。`log_path` は `Path` ではなく `str` で保持（JSON シリアライズ容易・`/logs` エンドポイントで `Path(state.log_path)` に変換）。
- **変更範囲**: `backend/app/schemas.py` のみ（新規モデル追加・既存モデル不改）。

### ADR-4: インメモリ状態管理 = モジュールグローバル `dict` + `asyncio.Lock`
- **決定**:
  - `server.py` モジュールグローバルに `_simulations: dict[str, SimulationState] = {}` と `_lock: asyncio.Lock = asyncio.Lock()` を持つ。
  - 全 read/write は `async with _lock:` 内で行う。
  - シミュレーション ID 生成は `_generate_simulation_id() -> str` 関数に切り出し（`return str(uuid.uuid4())`）。テストで `monkeypatch.setattr("app.server._generate_simulation_id", lambda: "fixed-id")` により固定化可能。
- **理由**: FR-7 / NFR-1。YAGNI により永続化は行わずプロセス再起動で状態消失。ID 生成関数の切り出しはテスト安定性（AC-1 / AC-2 / AC-6 で固定 ID 検証）のため。
- **同時実行上限**: 導入しない（YAGNI・PRD 未解決事項 2 に従い `asyncio.Semaphore` は見送り）。

### ADR-5: WebSocket 配信 = `SimulationLogger.subscribe()` + `asyncio.Queue` per 接続
- **決定**:
  - `SimulationLogger` に subscriber 管理機構を追加:
    - `_subscribers: set[asyncio.Queue[Message | None]]` をインスタンス変数に保持（`__init__` で `set()` 初期化・`_lock` は既存流用で保護）。
    - `subscribe() -> asyncio.Queue[Message | None]`: 新規 `asyncio.Queue()` を生成し `async with self._lock: self._subscribers.add(queue)` して返す。
    - `log(msg)`: 既存ファイル追記処理後に `async with self._lock:` 内で `for q in self._subscribers: await q.put(msg)` で全 subscriber に配信。`_lock` 保持中に `await q.put` するが、`asyncio.Queue.put` はバッファ未満なら即座に完了（ブロックしない）ためデッドロック回避可能。
    - `aclose()`: `async with self._lock:` 内で `for q in self._subscribers: await q.put(None)` で終了シグナル送信後 `self._subscribers.clear()`。
  - `turn_count` プロパティ追加: `self._turn_count: int = 0`（`__init__`）・`log(msg)` 内で `self._turn_count += 1`・`@property def turn_count(self) -> int: return self._turn_count`。
  - `server.py` WS エンドポイント:
    ```python
    async with _lock:
        state = _simulations.get(simulation_id)
    if state is None:
        await websocket.send_text(WebSocketEvent(event="not_found").model_dump_json())
        await websocket.close()
        return
    queue = await logger.subscribe()
    try:
        while True:
            msg = await queue.get()
            if msg is None:
                break
            await websocket.send_text(msg.model_dump_json())
    finally:
        # subscriber 除去は logger.aclose() で一括、ここでは個別除去不要
        await websocket.close()
    ```
  - シミュレーション完了 / 失敗時は `run_simulation_task` 内で `logger.aclose()` 前に `WebSocketEvent` を全 subscriber に送信するため、`SimulationLogger` に `broadcast_event(event: WebSocketEvent)` メソッドを追加（`async with self._lock: for q in self._subscribers: await q.put(...)` だが `Queue[Message | None]` 型に `WebSocketEvent` は入らない）。
  - **修正**: subscriber queue の型を `asyncio.Queue[Message | WebSocketEvent | None]` に拡張し、`None` を終了シグナル・`WebSocketEvent` を終了イベント・`Message` を発言とする。`broadcast_event` は `log` と同様 `_lock` 内で `await q.put(event)`。`aclose()` で最後に `None` を put。
- **理由**: FR-6 / NFR-1。各接続が `asyncio.Queue` を挟むことで 1 接続の遅延が他接続・シミュレーション本体をブロックしない。`SimulationLogger` が `aclose()` で subscriber 解放の責務を持つ（PRD 未解決事項 3 の確定）。
- **`asyncio.Queue` サイズ**: デフォルト（無制限）。シミュレーションは発言単位で `await` するためキュー溜まりは発生しない想定。YAGNI で上限設定しない。

### ADR-6: REST エンドポイント設計
- **決定**:
  - `POST /api/simulations`:
    1. `SimulationStartRequest` でボディ検証（Pydantic・`max_turns >= 0`）
    2. `agents_config` に `".."` が含まれる場合は `422` 拒否（NFR-6）
    3. `app_config = load_config()`・`agents, _ = load_agents(req.agents_config or app_config.agents_config, app_config)`
    4. `validate_agent_credentials(agents, app_config)` 失敗時は `422`（`ValueError` を catch して `HTTPException(422, str(e))`）
    5. `clients = build_agent_clients(agents, app_config)` 失敗時は `422`（`LLMError` を catch）
    6. `simulation_id = _generate_simulation_id()`
    7. `logger = SimulationLogger()`（`logs/sim_<timestamp>.jsonl` 生成）
    8. `sim_config = SimulationConfig(trigger_message=req.trigger_message, max_turns=req.max_turns, agent_order=[a.name for a in agents])`
    9. `async with _lock: _simulations[simulation_id] = SimulationState(simulation_id=simulation_id, status="running", started_at=datetime.now(UTC), log_path=str(logger.path))`
    10. `asyncio.create_task(run_simulation_task(simulation_id, sim_config, agents, clients, logger))`
    11. `return JSONResponse(status_code=201, content=SimulationStartResponse(simulation_id=simulation_id, status="running").model_dump(mode="json"))`
  - `GET /api/simulations/{simulation_id}`:
    - `async with _lock: state = _simulations.get(simulation_id)`
    - `state is None` → `404`
    - `return state`（FastAPI が `SimulationState` を JSON 化・`mode="json"` で `datetime` を ISO 文字列化）
  - `GET /api/simulations/{simulation_id}/logs`:
    - `async with _lock: state = _simulations.get(simulation_id)`
    - `state is None` → `404`
    - `path = Path(state.log_path)`・`path.is_file()` でなければ `return []`
    - `await asyncio.to_thread(path.read_text, encoding="utf-8")` で JSONL 読込（blocking I/O を `to_thread` で回避）
    - 各行を `Message.model_validate_json(line)` でパース・`list[Message]` で返す
  - `WS /ws/simulations/{simulation_id}`: ADR-5 の通り
- **理由**: FR-3〜FR-6 / NFR-1 / NFR-4。`POST` は `201`（PRD は `201` と `202` 相当と記載・必須決定 6 で `201` 指示）。`load_config()` は `.env` 必須のため API 起動時に `.env` が設定済み前提（Docker `env_file: .env`）。

### ADR-7: バックグラウンドタスク = `run_simulation_task`
- **決定**:
  ```python
  async def run_simulation_task(
      simulation_id: str,
      sim_config: SimulationConfig,
      agents: list[AgentSpec],
      clients: dict[str, LLMClient],
      logger: SimulationLogger,
  ) -> None:
      try:
          await run_simulation(sim_config, agents, clients, logger)
          async with _lock:
              state = _simulations.get(simulation_id)
              if state is not None:
                  state.status = "completed"
                  state.finished_at = datetime.now(UTC)
                  state.turn_count = logger.turn_count
          await logger.broadcast_event(WebSocketEvent(event="completed"))
      except LLMError as exc:
          async with _lock:
              state = _simulations.get(simulation_id)
              if state is not None:
                  state.status = "failed"
                  state.finished_at = datetime.now(UTC)
                  state.error = str(exc.message)
                  state.turn_count = logger.turn_count
          await logger.broadcast_event(WebSocketEvent(event="failed", error=exc.message))
      finally:
          await close_all_clients(clients)
          await logger.aclose()
  ```
  - ただし `run_simulation` 既存実装は `finally` で `close_all_clients` と `logger.aclose` を呼ぶため**二重呼出**になる。`run_simulation` 側の `finally` は `agents.py` 切り出し時に `logger.aclose()` / `close_all_clients()` を削除し、責務を `run_simulation_task` に移す。CLI `main()` 側は `run_simulation` 後に明示的に `close_all_clients` / `logger.aclose` を呼ぶよう修正、または `run_simulation_task` と同等の try/except/finally で包む。
- **理由**: FR-3 補足・NFR-1。`run_simulation` は純粋なシミュレーションループに専念させ、リソース解放と状態遷移は呼出側（CLI `main()` / API `run_simulation_task`）の責務とする（既存 `finally` の二重解放回避・単一責務原則）。
- **`run_simulation` 修正内容**:
  - `finally` ブロック削除（`close_all_clients` / `logger.aclose` 呼出を除去）
  - `except asyncio.CancelledError` ブロックは維持（キャンセル時の print のみ・`raise`）
  - `LLMError` は `except` で catch せずそのまま raise（`run_simulation_task` で catch）
  - 既存テスト `test_simulation_closes_on_llm_failure` は `run_simulation` が `close_all_clients` を呼ばなくなるため、テスト側で `await client.aclose()` を明示的に呼ぶよう修正、または `run_simulation` を `try/finally` で包んだヘルパでテスト呼出（テスト修正は FR-11 で許容）

### ADR-8: Docker 設定
- **決定**:
  - `docker-compose.yml`:
    ```yaml
    services:
      backend:
        build:
          context: .
          dockerfile: backend/Dockerfile
        env_file: .env
        volumes:
          - ./logs:/app/logs
        ports:
          - "8000:8000"
        stdin_open: true
        tty: true
        healthcheck:
          test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')\""]
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 10s
    ```
  - `backend/Dockerfile`: `ENTRYPOINT ["python"]` は維持・`CMD ["-m", "uvicorn", "app.server:app", "--host", "0.0.0.0", "--port", "8000"]` に変更。
  - `curl` は `python:3.12-slim` に未導入のため `python -c urllib.request` を使用。`/docs` は FastAPI 既定で 200 を返す（AC-13 / AC-14 / AC-16 / AC-17）。
  - `docker compose run --rm backend python -m app.main` で CLI 起動時は `CMD` が上書きされ `ENTRYPOINT ["python"]` に `-m app.main` が渡る（AC-15）。
- **理由**: FR-9。`ENTRYPOINT` / `CMD` 分離で API 既定起動と CLI 上書き起動を両立。

### ADR-9: 依存追加
- **決定**:
  - `requirements.txt`: `fastapi>=0.115`, `uvicorn[standard]>=0.32` 追加
  - `pyproject.toml` `[project] dependencies`: 同上追加
  - `httpx` は既存（`TestClient` が内部で使用）・`pytest-asyncio` は既存・`pytest-httpx` は導入しない（標準 `fastapi.testclient.TestClient` 使用）
- **理由**: FR-8 / AC-29。`websockets` は `uvicorn[standard]` に含まれるため個別追加しない。

### ADR-10: テスト戦略
- **決定**:
  - `backend/tests/test_server.py` 新設:
    - `TestClient(app)`（`from fastapi.testclient import TestClient`）使用
    - REST 正常系: モック LLM (`DummyLLMClient`) で即完了・`POST` → `201`・`GET /{id}` で `running` → `completed` 遷移・`GET /{id}/logs` で `list[Message]`
    - REST 404 系: 存在しない ID の `GET /{id}` / `GET /{id}/logs` で `404`
    - REST `agents_config` プリセット: `config/presets/agents-5.yaml` 指定で起動（`agent_order` が5人）※プリセットファイルが存在する場合のみ
    - REST `..` 拒否: `agents_config="../etc/passwd"` で `422`
    - WS: `with client.websocket_connect(f"/ws/simulations/{id}") as ws:` で `Message` push 受信・`completed` イベント受信・接続閉鎖
    - WS not_found: 存在しない ID で `{"event":"not_found"}` 受信・接続閉鎖
    - WS failed: `FailingClient`（`LLMError` 送出）で状態 `failed`・`{"event":"failed","error":"..."}` 受信
    - ID 固定化: `monkeypatch.setattr("app.server._generate_simulation_id", lambda: "test-sim-id")`
    - LLM モック注入: `monkeypatch.setattr("app.server.build_agent_clients", lambda agents, config: {a.name: DummyLLMClient(responses=[...]) for a in agents})` で実 API 呼出回避
    - `load_config` モック: `monkeypatch.setenv` で `.env` 相当を設定（既存 `env_ollama` fixture 流用）
  - `backend/tests/test_simulation.py`: `from app.main import run_simulation` → `from app.simulation import run_simulation` に変更。`run_simulation` の `finally` 削除に伴い `test_simulation_closes_on_llm_failure` 等で `await client.aclose()` / `await logger.aclose()` を明示呼出に修正。
  - `backend/tests/conftest.py`: `DummyLLMClient` は変更なし。`dummy_clients_dict` は server テスト用にそのまま流用可能（必要に応じて `agents` 引数版 fixture 追加）。
- **理由**: FR-11 / AC-24 / AC-25。`TestClient` は `httpx` ベースで `websocket_connect` をサポートし、別プロセス不要でテスト高速。

## データモデル・インメモリ状態設計

### Pydantic モデル（`schemas.py` 追加）

```python
class SimulationStartRequest(BaseModel):
    trigger_message: str
    max_turns: int = Field(ge=0)
    agents_config: str | None = None


class SimulationStartResponse(BaseModel):
    simulation_id: str
    status: Literal["running", "completed", "failed"]


class SimulationState(BaseModel):
    simulation_id: str
    status: Literal["running", "completed", "failed"]
    started_at: datetime
    finished_at: datetime | None = None
    turn_count: int = 0
    error: str | None = None
    log_path: str


class WebSocketEvent(BaseModel):
    event: Literal["completed", "failed", "not_found"]
    error: str | None = None
```

### インメモリ状態（`server.py` モジュールグローバル）

```python
_simulations: dict[str, SimulationState] = {}
_lock: asyncio.Lock = asyncio.Lock()


def _generate_simulation_id() -> str:
    return str(uuid.uuid4())
```

### `SimulationLogger` 拡張（`logger.py`）

```python
class SimulationLogger:
    def __init__(self, logs_dir: Path = Path("logs")) -> None:
        ...
        self._subscribers: set[asyncio.Queue[Message | WebSocketEvent | None]] = set()
        self._turn_count: int = 0

    @property
    def turn_count(self) -> int:
        return self._turn_count

    @property
    def path(self) -> Path:
        return self._path

    async def subscribe(self) -> asyncio.Queue[Message | WebSocketEvent | None]:
        queue: asyncio.Queue[Message | WebSocketEvent | None] = asyncio.Queue()
        async with self._lock:
            self._subscribers.add(queue)
        return queue

    async def log(self, msg: Message) -> None:
        ...  # 既存ファイル追記
        async with self._lock:
            self._turn_count += 1
            for q in self._subscribers:
                await q.put(msg)

    async def broadcast_event(self, event: WebSocketEvent) -> None:
        async with self._lock:
            for q in self._subscribers:
                await q.put(event)

    async def aclose(self) -> None:
        async with self._lock:
            if self._closed:
                return
            self._closed = True
            for q in self._subscribers:
                await q.put(None)
            self._subscribers.clear()
            self._file.close()
```

### `asyncio.Lock` 適用箇所

| 箇所 | Lock | 保護対象 |
|------|------|---------|
| `server.py` `_simulations` dict 全アクセス | `_lock` | POST 登録・GET 取得・GET logs 状態確認・WS 状態確認・`run_simulation_task` 完了/失敗時更新 |
| `SimulationLogger._lock`（既存） | `self._lock` | ファイル追記・`_subscribers` 追加/クリア・`_turn_count` インクリメント・`_closed` フラグ |
| WS 接続 `asyncio.Queue` | 不要 | 単一 consumer/producer（接続ごとに1 queue） |

## API・WebSocketプロトコル設計

### REST エンドポイント

#### `POST /api/simulations`
- **リクエスト**: `SimulationStartRequest`（`application/json`）
  - `trigger_message: str`（必須）
  - `max_turns: int`（≥0・0 は無限）
  - `agents_config: str | None`（YAML ファイルパス・`None` で `AppConfig.agents_config` フォールバック）
- **レスポンス 201**: `SimulationStartResponse`
  ```json
  {"simulation_id": "uuid4", "status": "running"}
  ```
- **エラー**:
  - `422`: `max_turns < 0` / `agents_config` に `..` 含有 / `validate_agent_credentials` 失敗 / `build_agent_clients` 失敗 / `load_agents` 失敗
  - `detail: {"msg": "..."}` 形式（FastAPI 既定）

#### `GET /api/simulations/{simulation_id}`
- **レスポンス 200**: `SimulationState`
  ```json
  {
    "simulation_id": "uuid4",
    "status": "running|completed|failed",
    "started_at": "2026-07-18T12:34:56Z",
    "finished_at": "2026-07-18T12:35:00Z" | null,
    "turn_count": 9,
    "error": "..." | null,
    "log_path": "logs/sim_20260718T123456Z.jsonl"
  }
  ```
- **エラー**: `404` 存在しない ID

#### `GET /api/simulations/{simulation_id}/logs`
- **レスポンス 200**: `list[Message]`
  ```json
  [
    {"timestamp": "...", "turn": 0, "agent_name": "経済システム", "agent_code": "支払/非支払", "message": "...", "provider": "dummy", "model": "dummy"},
    ...
  ]
  ```
- **空配列**: ログファイル未存在（開始直後）は `[]`
- **エラー**: `404` 存在しない ID

### WebSocket エンドポイント

#### `WS /ws/simulations/{simulation_id}`
- **接続フロー**:
  1. `async with _lock:` で `_simulations.get(simulation_id)` 確認
  2. 不在 → `WebSocketEvent(event="not_found").model_dump_json()` 送信 → `await websocket.close()` → return
  3. 在 → `logger.subscribe()` で queue 取得（注: `logger` は `_simulations[simulation_id]` から取得不可なため、`server.py` で別途 `_loggers: dict[str, SimulationLogger] = {}` を保持し `_lock` で保護）
- **配信メッセージ**:
  - 発言完了ごと: `Message.model_dump_json()`（`{"timestamp":...,"turn":...,"agent_name":...,...}`）
  - シミュレーション完了: `WebSocketEvent(event="completed").model_dump_json()` → 接続閉鎖
  - シミュレーション失敗: `WebSocketEvent(event="failed", error="...").model_dump_json()` → 接続閉鎖
- **接続閉鎖**: `None` 受信で `break`・`finally` で `websocket.close()`・`logger` は `run_simulation_task` の `aclose()` で subscriber クリア

### 追加インメモリ状態（`server.py`）

```python
_loggers: dict[str, SimulationLogger] = {}
```
- `_lock` で `_simulations` と同時に保護。`POST` 時に `_loggers[simulation_id] = logger` 登録・`run_simulation_task` の `finally` で `async with _lock: _loggers.pop(simulation_id, None)`。

## コンポーネント構成 (Python & React)

### Python パッケージ構成

```
backend/app/
├── main.py            # CLI エントリポイント（main() のみ・from app.simulation import run_simulation, validate_agent_credentials）
├── simulation.py      # 新規: run_simulation() / validate_agent_credentials()
├── server.py          # 新規: FastAPI app / REST / WS / _simulations / _lock / run_simulation_task
├── agents.py          # 変更なし
├── llm_client.py      # 変更なし
├── logger.py          # 拡張: subscribe() / broadcast_event() / turn_count / path / _subscribers
├── schemas.py         # 拡張: SimulationStartRequest / SimulationStartResponse / SimulationState / WebSocketEvent 追加
└── config.py          # 変更なし

backend/tests/
├── conftest.py        # 変更なし（必要に応じて fixture 追加）
├── test_simulation.py # import パス変更: app.main → app.simulation
└── test_server.py     # 新規: REST / WS テスト
```

### React 構成

本フェーズでは React はスコープ外（次々フェーズ）。`frontend/` は変更しない。

## Docker / コンテナ構成

### `backend/Dockerfile`（変更）

```dockerfile
FROM python:3.12-slim

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/tests ./tests
COPY config ./config
COPY pyproject.toml ./pyproject.toml

RUN chown -R appuser:appuser /app
USER appuser

ENTRYPOINT ["python"]
CMD ["-m", "uvicorn", "app.server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `docker-compose.yml`（変更）

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    env_file: .env
    volumes:
      - ./logs:/app/logs
    ports:
      - "8000:8000"
    stdin_open: true
    tty: true
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')\""]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

### イメージ
- `python:3.12-slim`（既存）
- 非 root 実行（`appuser`）維持

### ヘルスチェック
- `python -c urllib.request.urlopen('http://localhost:8000/docs')`（curl 未導入のため）
- `/docs` は FastAPI 既定で 200・`start_period: 10s` で uvicorn 起動待ち

### ボリューム・ネットワーク
- `./logs:/app/logs`（既存・JSONL ログ永続化）
- ポート `8000:8000` 公開
- ネットワークは既定（`default`）

### 起動コマンド
- API 既定: `docker compose up --build` → `uvicorn app.server:app`
- CLI 上書き: `docker compose run --rm backend python -m app.main`（`ENTRYPOINT ["python"]` + 引数上書き）

## 未解決の課題

1. **`run_simulation` の `finally` 削除による既存テスト影響**: `test_simulation_closes_on_llm_failure` 等は `run_simulation` が `close_all_clients` / `logger.aclose` を呼ばなくなるため、テスト側で明示的に `await client.aclose()` / `await logger.aclose()` を呼ぶよう修正が必要。実装フェーズで `test_simulation.py` の各テストを精査し修正。

2. **`config/presets/agents-5.yaml` の存在確認**: AC-9 で5人プリセットを検証するが、ファイル存在を前提とする。実装時にファイルが無ければテストをスキップ（`pytest.mark.skipif`）するか、テスト用に `tmp_agents_yaml` fixture で5人版を生成するか判断。

3. **`run_simulation` の `LLMError` 伝搬**: 既存実装は `except LLMError` で catch して `break` する。`run_simulation_task` で `except LLMError` するため、`run_simulation` 側は catch せず raise するよう修正。ただし既存 `test_simulation_closes_on_llm_failure` は `run_simulation` が `LLMError` を raise しないことを期待している可能性があり、テスト修正が必要。

4. **WS 接続のライフサイクル**: シミュレーション開始直後（`running` 登録後〜発言開始前）に WS 接続した場合、`subscribe()` で取得した queue に最初の `Message` が到着するまで `await queue.get()` で待機する。`broadcast_event` / `None` で確実に終了するためデッドロックなし。

5. **`load_config()` の `.env` 依存**: API 起動時に `.env` が未設定だと `POST /api/simulations` で `load_config()` が `ValueError` を raise する。**`POST` ハンドラ内で `try/except ValueError as e: raise HTTPException(status_code=500, detail=str(e))` でラップし、NFR-4（`{"detail":"..."}` 統一）に整合させる方針を確定**。起動時に一度 `load_config()` を呼ぶ検証は行わない（YAGNI）。

6. **`agents_config` の絶対パス許可**: NFR-6 は `..` 拒否のみ。絶対パス（`/etc/passwd` 等）は許可されるが、Docker 非 root かつ `/app` ワークディレクトリ外へのアクセスは OS 権限で制限される。本フェーズでは最小限（`..` 拒否のみ）で進める。

7. **`/redoc` 有効**: YAGNI により既定のまま（無効化コストの方が高い）。

8. **完了後の WS 接続フォールバック**: シミュレーション完了後（`_loggers.pop` 後）に WS 接続した場合、`logger` が取得できず `subscribe()` 不可。**WS エンドポイントで `state.status in ("completed","failed")` の場合は `logger` に依存せず即座に `WebSocketEvent(event=state.status, error=state.error)` を送信して接続を閉じるフォールバックパスを設ける**。

9. **`TestClient` と `asyncio.create_task` の相性**: `POST` ハンドラ内の `asyncio.create_task` が `TestClient` の `anyio` portal ライフサイクル外に取り残されるリスクあり。**実装時に `httpx.AsyncClient` + `ASGITransport`（`pytest-asyncio` 組合せ）への切り替えを許容**。または `TestClient` で `await asyncio.sleep(0)` 等でタスク進行を促す方針。テスト安定性優先で選択。

10. **CLI `main()` の `LLMError` 挙動**: `run_simulation` が `LLMError` を raise するよう変更後、CLI `main()` で未 catch 例外でスタックトレースが出ないよう、**`main()` で `try: await run_simulation(...) except LLMError as e: print(f"LLM呼出失敗: {e.message}", file=sys.stderr)` を catch する振る舞い（現行互換・NFR-5）を明示**。

11. **`SimulationLogger.__init__` の同期 `open()`**: `POST` ハンドラ内で `SimulationLogger()` を呼ぶと `open()` がイベントループをブロックする（微小）。実害は小さいが NFR-1 原則上、必要に応じて `asyncio.to_thread` で包む選択肢を許容（実装時判断・過剰なら同期のまま）。

12. **ADR-5 の WS コード例と `_loggers` の不整合**: ADR-5 のコード例は `queue = await logger.subscribe()` と書くが `logger` の取得元が未定義。**`_loggers.get(simulation_id)` から取得するよう ADR-5 コード例を修正**。

---

*本 Tech Spec は PRD `docs/prd/lumann-fastapi-api.md` の受け入れ基準 AC-1〜AC-30 を満たす設計を提示する。実装フェーズでは本 Spec に従い、`verify.sh`（ruff format / ruff check / mypy --strict / pytest / eslint / tsc / vitest）が緑となることを確認する。*