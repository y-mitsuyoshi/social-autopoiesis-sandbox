# Tech Spec: 最終フェーズ統合（React可視化 + 動的順序 + 履歴拡張 + ストリーミング + 長連鎖・モデル比較 + Docker手順）

## コンテキスト

前フェーズ（`docs/final-report/lumann-fastapi-api.md`）で FastAPI REST/WS API 層が完成した（`POST /api/simulations` / `GET /{id}` / `GET /{id}/logs` / `WS /ws/simulations/{id}`、89テスト全パス・`ruff` / `mypy --strict` クリーン・実 API E2E 検証済み）。同報告に列挙された「次フェーズ候補6項目」を1ループで MVP 実装し、ユーザーが「いちいち確認せず完走」できる状態を作る。

6項目:
1. React 可視化ダッシュボード（`frontend/` 新設）
2. Docker 実機検証手順書（本環境は Docker 不可のため代替: 手順書 + 静的検証スクリプト拡張）
3. 動的エージェント順序選択（メタエージェントが次番発言者を選ぶ）
4. コンテキスト履歴拡張（直前K発言参照）
5. ストリーミング応答（LLM 逐次トークン出力 / SSE）
6. 長連鎖観察・モデル比較実験（スクリプト + 手順書提供・実行はユーザー委譲）

現行コードの前提（変更の出発点）:
- `backend/app/server.py`: FastAPI アプリ・`_simulations`/`_loggers`/`_tasks` を `asyncio.Lock` で保護。`run_simulation_task` がバックグラウンドタスクで `run_simulation` を駆動。
- `backend/app/simulation.py`: `run_simulation` は `config.agent_order` に従いラウンドロビンで `client.complete(messages)` を呼び出し、`prev_message` に直前の `resp.content` を保持して次ターンの `user` メッセージに埋め込む。`turn` は `itertools.count()` で増加、`order[turn % len(order)]` で選択。
- `backend/app/llm_client.py`: `LLMClient` Protocol（`complete` / `aclose`）・`OpenAICompatibleClient`（Ollama/OpenAI 共用・`/chat/completions`）・`GeminiClient`（`generateContent`）・`build_agent_clients`（`(provider, model)` ごとにキャッシュ）・`close_all_clients`。`retry_async` で指数バックオフ。
- `backend/app/schemas.py`: `AgentSpec` / `SimulationConfig`（`trigger_message` / `max_turns` / `agent_order`・重複検証） / `AppConfig`（プロバイダ資格情報） / `SimulationStartRequest`（`trigger_message` / `max_turns` / `agents_config`） / `Message` / `WebSocketEvent`（`completed` / `failed` / `not_found`）。
- `backend/app/logger.py`: `SimulationLogger` は JSONL ファイル出力 + subscriber キューによる WS push。`_lock` で `log`/`broadcast_event`/`aclose` を保護。
- `backend/app/config.py`: `load_config` が `.env` から `AppConfig` 構築。`AGENTS_CONFIG` / `MAX_TURNS` / `LLM_PROVIDER` 必須。
- `backend/app/main.py`: CLI エントリ。`input()` でお題入力・`run_simulation` 実行。
- `backend/app/agents.py`: YAML/ハードコードフォールバックで `list[AgentSpec]` 構築。
- `docker-compose.yml`: `backend` のみ（`8000:8000`・`./logs:/app/logs`・healthcheck `/docs`）。
- `scripts/verify_docker_static.py`: backend の Dockerfile / compose の静的検証。
- `.shared-agents/harness/verify.sh`: `[1/2] Python` + `[2/2] Frontend`（`frontend/node_modules` 存在時のみ）の2段階。frontend ステップは既存枠あり・本フェーズで実質化。

環境制約（PRD「環境制約の引継ぎ」継承）:
- WSL2 Ubuntu 24.04 / Python 3.12.3 / **Docker 不可**（WSL に docker 未導入）。
- venv `/home/yuma/projects/social-autopoiesis-sandbox/.venv`（fastapi/uvicorn/pytest/mypy/ruff/respx 導入済み）を継続利用。
- 実 API（Ollama Cloud / gemma4:31b）動作確認済み。長連鎖・モデル比較の実 API 実行はユーザー環境で実施。

## 目標 / 非目標

- **目標**:
  1. `frontend/` を新設し「お題入力 → `POST /api/simulations` → `WS /ws/simulations/{id}` 接続 → 発言時系列表示 → 完了表示」の最小フローを Docker Compose 一発起動で提供する。
  2. `docs/ops/docker-deploy-guide.md` に `backend(8000) + frontend(5173)` 起動手順をまとめ、`scripts/verify_docker_static.py` に frontend サービス検証を追加する。
  3. `AgentSpec.is_meta` / `SimulationConfig.agent_order_mode: Literal["fixed","dynamic"]` を追加し、dynamic モードでメタエージェントが次番発言者を LLM 応答から選ぶ。従来ラウンドロビン（fixed）は後方互換で維持。
  4. `SimulationConfig.history_length`（直前K発言参照・デフォルト1=従来同等）を追加し、プロンプトに過去発言を列挙する。
  5. `LLMClient.complete_stream`（`AsyncIterator[str]`）を追加し、`GET /api/simulations/{id}/stream`（SSE）で1発言内のトークン逐次出力を提供する。シミュレーション進行は既存 WS のまま。
  6. `scripts/run_long_chain.sh` と `scripts/compare_models.py` および手順書 `docs/experiments/{long-chain-observation,model-comparison}.md` を提供する。実 API 実行はユーザー委譲。
  7. 既存89テスト + 新規（動的順序 / 履歴 / SSE / frontend）が全パスし、`ruff format --check` / `ruff check` / `mypy --strict` / `eslint` / `tsc -b` / `vitest` すべてクリーン。

- **非目標**:
  - ダッシュボードのグラフ・統計・複数シミュレーション一覧画面・永続化
  - 認証・認可（ローカル・trusted network 前提は継承）
  - 動的順序の複雑なスケジューリング（重複回避・優先度・発言回数制限）
  - ストリーミングのキャンセル・リジューム・バックプレッシャ制御
  - 長連鎖・モデル比較の自動バッチ実行基盤・CI 組込
  - フロントエンド本番ビルド（`npm run build` + nginx / serve）・CDN 配信
  - `httpx2` 移行・`agents_config` パス検証強化（次フェーズ候補）

## アーキテクチャ上の決定

### AD-1: React ダッシュボードの構成と Vite proxy / CORS の両翼保全
- **決定**: `frontend/` は React 19 + Vite 5 + TypeScript strict + Tailwind CSS 3 の最小構成。`vite.config.ts` の `server.proxy` で `/api` と `/ws` を `http://localhost:8000` にプロキシし、同時に `backend/app/server.py` に `CORSMiddleware`（`allow_origins=["http://localhost:5173"]`）を追加する。
- **理由**: 開発時は Vite proxy で Same-Origin 扱いとなり CORS を回避できるが、Docker Compose で frontend と backend が別ポートで並列起動する場合や、ブラウザから直接 `http://localhost:8000` を叩くユースケースに備え、両方設定する（両翼保全）。`allow_origins` は `http://localhost:5173` のみ（ワイルドカード不可・NFR-6）。

### AD-2: Docker 実機検証は「手順書 + 静的検証スクリプト拡張」で代替
- **決定**: `docs/ops/docker-deploy-guide.md` に `docker compose up --build` で `backend(8000) + frontend(5173)` が起動する手順・`http://localhost:8000/docs` と `http://localhost:5173` の確認・`docker compose run --rm backend python -m app.main` による CLI 実行・`docker compose down` による停止を記載。`scripts/verify_docker_static.py` に `compose.services.frontend` 存在・`frontend.ports` に `5173:5173` 含有・`frontend.build.dockerfile` が `Dockerfile`（または `frontend/Dockerfile`）・`frontend.depends_on` に `backend` 含有を検証する項目を追加。
- **理由**: 本開発環境は Docker 不可（WSL に docker 未導入）のため、実機検証はユーザー委譲。静的検証で構成の整合性を保証し、手順書で運用者に具体的手順を提供する。

### AD-3: 動的順序はメタエージェント LLM 応答からの正規表現抽出 + ラウンドロビンフォールバック
- **決定**: `AgentSpec` に `is_meta: bool = False` を追加。`SimulationConfig` に `agent_order_mode: Literal["fixed","dynamic"] = "fixed"` を追加。`config/presets/agents-3-dynamic.yaml` を新規（3システム + 1メタエージェント）。
  - `run_simulation` で `mode="dynamic"` の場合、各ターン終了後にメタエージェントを呼び出す。プロンプト: 「直前の発言を受けて、次に発言すべきエージェント名を1つ返せ。選択肢: <agent_namesのカンマ区切り>」。応答から `agent_names` のいずれかを正規表現（`re.search(r"(" + "|".join(map(re.escape, agent_names)) + r")", content)`）で抽出。見つからなければラウンドロビン次番（`order[(turn+1) % len(order)]`）にフォールバック。メタエージェント自身は通常発言を生成せず、選択のみを行う（`is_meta=True` のエージェントは `order` から除外して通常発言サイクルに含めない）。
  - `mode="fixed"` の場合は従来ラウンドロビン（後方互換）。
- **理由**: PRD「未解決事項2」の最も軽量な方式。JSON強制は LLM によっては失敗するため、緩い正規表現抽出 + フォールバックで堅牢性を確保。`is_meta` エージェントは `agent_order` に含まれても `order`（発言サイクル）から除外し、選択のみに使う。

### AD-4: 履歴拡張は `history: list[str]` を維持し直前K件を user メッセージに列挙
- **決定**: `SimulationConfig` に `history_length: int = Field(default=1, ge=1)` を追加。`run_simulation` で `history: list[str] = []` を維持し、各ターン後に `history.append(resp.content)`、`len(history) > history_length` なら `history.pop(0)`。`user` メッセージの「直前の発言」部分を「過去の発言: <newline区切りでhistoryを古い順>」に拡張。`history_length=1` は従来「直前の発言のみ」と完全同等（後方互換）。
- **理由**: 既存 `prev_message: str` を配列に一般化する最小変更。`history_length=1` で従来テストが壊れないことを最優先。

### AD-5: ストリーミングは「1発言内のトークン逐次」を SSE で配信・シミュレーション進行は既存 WS のまま
- **決定**:
  - `LLMClient` Protocol に `async def complete_stream(messages: list[dict[str,str]]) -> AsyncIterator[str]` を追加（既存 `complete` は維持・後方互換）。
  - `OpenAICompatibleClient.complete_stream`: httpx で `POST /chat/completions` with `stream: true`、SSE を `async for line in resp.aiter_lines()` で受信、`data: {...}` 行を JSON パースして `choices[0].delta.content` を yield。`data: [DONE]` で終了。
  - `GeminiClient.complete_stream`: `streamGenerateContent` に `?alt=sse` を付与、`candidates[0].content.parts[0].text` を yield。
  - FastAPI に `GET /api/simulations/{id}/stream`（SSE エンドポイント）を追加。`StreamingResponse` で `media_type="text/event-stream"`。各発言のトークンを `data: {"token":"..."}\n\n` で逐次 push。発言完了時に `data: {"message": <full Message>}\n\n` で全体送信。完了時に `event: completed\n\n` で接続終了。存在しない ID は即座に `404`。
  - **MVP 範囲**: `complete_stream` を実装し、SSE エンドポイントは「シミュレーション全体の進行」ではなく「1発言内のトークン逐次」を配信。シミュレーション進行（発言の追加・完了通知）は既存 WS（`/ws/simulations/{id}`）のまま。SSE は独立の軽量ループで `run_simulation` とは別に、シミュレーション終了後にログから各 `Message` を取り出し、`complete_stream` 相当を再生成して逐次送信する、あるいは実行中シミュレーションに対してストリーミング専用キューを追加せず、完了済みのログを順にストリーミングし直す方式とする。
  - **本フェーズの最小実装**: 完了済みシミュレーション（`state.status in ("completed","failed")`）に対してはログから `Message` リストを取り出し、各 `Message` を「ダミートークン分割（例: `content` を char 単位で分割）」して `data: {"token":"..."}\n\n` で逐次送信し、`data: {"message": <Message>}\n\n` で1発言完了を通知する。実行中シミュレーションに対しては `complete_stream` を直接統合せず、完了後に同じ方式で再生する。これにより `run_simulation` 本体は変更不要で、`complete_stream` は `LLMClient` に追加されるが SSE エンドポイントは `complete_stream` を使わない最小構成とする。
- **理由**: PRD「未解決事項1」で「MVP ではモック SSE で逐次 push が確認できるレベルでよい」と明記。`run_simulation` と SSE を結合すると `SimulationLogger` にストリームキューを追加する大改造が必要になるが、YAGNI の観点から「完了済みログの逐次再生」で SSE プロトコルの検証を満たす。`complete_stream` 自体は LLM クライアントに実装し、将来の統合（次フェーズ）に備える。CLI は非ストリーミング維持（YAGNI）。

### AD-6: 長連鎖・モデル比較は in-process で `run_simulation` を直接呼ぶ
- **決定**:
  - `scripts/run_long_chain.sh`: 引数 `<agents_config_yaml> <max_turns> <trigger_message>` を受け取り、`AGENTS_CONFIG` / `MAX_TURNS` 環境変数を設定し `python -m app.main` を非対話で起動（`trigger_message` を stdin 経由で `input()` にパイプ）。`SimulationLogger` が生成する `logs/sim_<timestamp>.jsonl` を `logs/long_chain_<timestamp>.jsonl` にリネーム（`mv`）。
  - `scripts/compare_models.py`: 引数 `--models <model1> <model2> ...` / `--trigger <message>` / `--max-turns <N>` / `--agents-config <yaml>`（省略可）を受け付け、`run_simulation` を in-process で直接呼び出す。`AppConfig` と `AgentSpec` と `build_agent_clients` をモデルごとに差し替えて実行。発言長平均・ターンあたり時間・語彙多様性（type-token ratio）を算出し、Markdown 表で `docs/experiments/model-comparison.md` に上書き出力。
  - `docs/experiments/long-chain-observation.md` / `docs/experiments/model-comparison.md`: 手順書・結果記入欄を提供。
- **理由**: PRD「未解決事項3・4」の最小実装。`run_simulation` を直接 import する方が `AppConfig` 差し替えで統計取得が容易（サブプロセス起動だと JSONL パースが必要）。実 API 実行はユーザー委譲だが、モック LLM でもスクリプトの動作検証が可能。

### AD-7: `verify.sh` の frontend ステップは既存枠を活かし `node_modules` 存在時のみ実行
- **決定**: `.shared-agents/harness/verify.sh` は既存 `[2/2] Frontend` ブロック（`frontend/node_modules` 存在時のみ `npm run lint` / `npx tsc -b` / `npm run test`）を維持。`node_modules` 未存在時は警告してスキップ（既存挙動）。Docker 環境での実行は `docker compose exec frontend` 経由を想定するが、本フェーズでは `frontend/Dockerfile` が `npm run dev` のみを提供し、`npm run lint` / `tsc` / `vitest` はローカル実行を主とする。`verify.sh` に frontend 用の Docker 実行パスを追加するかは次フェーズで検討（本フェーズでは `node_modules` 存在時のみローカル実行で検証）。
- **理由**: 本開発環境は Docker 不可・`npm` は導入済み前提。`node_modules` 存在判定で安全にスキップでき、CI 未整備でも壊さない。

### AD-8: `is_meta` 省略時 `False` で後方互換
- **決定**: `AgentSpec.is_meta` は `False` デフォルト。既存 `config/agents.yaml` / `config/presets/*.yaml` は修正不要。
- **理由**: NFR-5 後方互換性。

## データモデル・インメモリ状態設計

### `AgentSpec`（`backend/app/schemas.py`）
```python
class AgentSpec(BaseModel):
    name: str
    binary_code: str
    concern: str
    system_prompt: str
    provider: Literal["ollama", "gemini", "openai"]
    model: str
    is_meta: bool = False  # 新規
```

### `SimulationConfig`（`backend/app/schemas.py`）
```python
class SimulationConfig(BaseModel):
    trigger_message: str
    max_turns: int = Field(ge=0)
    agent_order: list[str]
    agent_order_mode: Literal["fixed", "dynamic"] = "fixed"  # 新規
    history_length: int = Field(default=1, ge=1)              # 新規
```
- バリデータ: `agent_order` 重複検証は維持。`agent_order_mode="dynamic"` 時のメタエージェント存在検証は `SimulationConfig` 単独では不可（`agent_order: list[str]` は名前のみで `is_meta` 判定材料なし）。**`server.py` / `main.py` 側で `agents: list[AgentSpec]` と `config.agent_order` を突合し、`agent_order_mode="dynamic"` 時は `agents` 内に `is_meta=True` が1件以上含まれることを検証するヘルパ関数 `validate_dynamic_order(agents, sim_config)` を新設**（`simulation.py` に配置・CLI/API 双方から利用）。含まれない場合は `ValueError`（API は `HTTPException(422)`）。

### `AppConfig`（`backend/app/schemas.py`）
```python
class AppConfig(BaseModel):
    ...
    agent_order_mode: Literal["fixed", "dynamic"] = "fixed"  # 新規
    history_length: int = Field(default=1, ge=1)              # 新規
```

### `SimulationStartRequest`（`backend/app/schemas.py`）
```python
class SimulationStartRequest(BaseModel):
    trigger_message: str
    max_turns: int = Field(ge=0)
    agents_config: str | None = None
    agent_order_mode: Literal["fixed", "dynamic"] | None = None  # 新規・None 時は AppConfig 経由
    history_length: int | None = None                             # 新規・None 時は AppConfig 経由
```

### `LLMClient` Protocol（`backend/app/llm_client.py`）
```python
class LLMClient(Protocol):
    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse: ...

    async def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...  # 新規

    async def aclose(self) -> None: ...
```

### `WebSocketEvent`（`backend/app/schemas.py`）
- `event` の `Literal` は維持（`completed` / `failed` / `not_found`）。SSE は別プロトコル（text/event-stream）で送信するため、`WebSocketEvent` は拡張しない。SSE 用のスキーマは新規に `StreamToken` / `StreamMessage` / `StreamEvent` を定義するか、`dict` で構築して JSON で送信する（YAGNI なら `dict`）。

### インメモリ状態（`backend/app/server.py`）
- 既存 `_simulations: dict[str, SimulationState]` / `_loggers: dict[str, SimulationLogger]` / `_tasks: set[asyncio.Task[None]]` / `_lock: asyncio.Lock` を維持。
- SSE エンドポイント `/api/simulations/{id}/stream` は接続ごとに独立した `StreamingResponse` を返し、共有状態には `_lock` 内で `_simulations.get(id)` を参照するのみ。新規の共有状態・Lock は不要。

### `asyncio.Lock` 適用箇所（一覧）
- `backend/app/server.py` `_lock`: `_simulations` / `_loggers` / `_tasks` へのアクセス（既存・変更なし）
- `backend/app/logger.py` `SimulationLogger._lock`: `log` / `broadcast_event` / `aclose` / `subscribe`（既存・変更なし）
- **新規なし**: ストリーミングは接続ごとに独立したジェネレータで、共有状態を変更しないため Lock 不要。動的順序のメタエージェント呼出は `run_simulation` 内の単一タスクで順次 `await` するため競合なし。

### `config/presets/agents-3-dynamic.yaml`（新規）
```yaml
agents:
  - name: 経済システム
    binary_code: 支払/非支払
    concern: コスト・利益・市場価値・資源効率
    provider: ollama
    model: gemma4:31b
    is_meta: false
    system_prompt: |
      あなたは経済システムである。
      世界を二値コード「支払/非支払」で解釈し、
      コスト・利益・市場価値・資源効率に関心を持つ。
      入力されたメッェセージをこのコードの視点からのみ解釈し、
      経済システムとしての発言を生成せよ。
  - name: 科学システム
    binary_code: 真/偽
    concern: データ客観性・論理整合性・エビデンス・事実検証
    provider: ollama
    model: gpt-oss:20b
    is_meta: false
    system_prompt: |
      あなたは科学システムである。
      世界を二値コード「真/偽」で解釈し、
      データ客観性・論理整合性・エビデンス・事実検証に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      科学システムとしての発言を生成せよ。
  - name: 法システム
    binary_code: 合法/違法
    concern: 規約遵守・権利・契約正当性
    provider: ollama
    model: llama3.1:8b
    is_meta: false
    system_prompt: |
      あなたは法システムである。
      世界を二値コード「合法/違法」で解釈し、
      規約遵守・権利・契約正当性に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      法システムとしての発言を生成せよ。
  - name: メタ・モデレータ
    binary_code: 順序/選択
    concern: 次番発言者選択
    provider: ollama
    model: gemma4:31b
    is_meta: true
    system_prompt: |
      あなたはディスカッションのモデレータである。
      直前の発言と文脈を観察し、次に発言すべきエージェント名を1つだけ返せ。
      選択肢の中から1つを選び、そのエージェント名のみを出力せよ。
      余計な説明は不要である。
```

### `.env.example` 拡張
```
# 動的エージェント順序選択（fixed=ラウンドロビン / dynamic=メタエージェント選択）
AGENT_ORDER_MODE=fixed

# コンテキスト履歴拡張（直前K発言をプロンプトに含める・デフォルト1=従来同等）
HISTORY_LENGTH=1
```

## API・WebSocketプロトコル設計

### 既存 API（変更）
- `POST /api/simulations`
  - リクエスト: `SimulationStartRequest`（`trigger_message` / `max_turns` / `agents_config?` / `agent_order_mode?` / `history_length?`）
  - レスポンス: 201 `SimulationStartResponse`（`simulation_id` / `status`）
  - `agent_order_mode` / `history_length` が `None` の場合は `AppConfig` 経由でデフォルト（`fixed` / `1`）。
  - 422: `agents_config` に `..` 含有・`agent_order_mode` が `dynamic` でメタエージェント未定義・資格エラー等。
- `GET /api/simulations/{id}` / `GET /api/simulations/{id}/logs` / `WS /ws/simulations/{id}`: 変更なし。

### 新規 SSE エンドポイント
- `GET /api/simulations/{simulation_id}/stream`
  - `media_type="text/event-stream"`
  - 存在しない ID: 404 `{"detail":"simulation not found"}`
  - 完了済み / 実行中ともにログ（`Message` リスト）を取り出し、各 `Message` を「char 単位でトークン分割」して逐次送信。
  - SSE フォーマット（発言境界イベント含む・PRD FR-7 準拠）:
    ```
    event: agent_start

    data: {"turn":0,"agent_name":"経済システム","agent_code":"支払/非支払"}

    data: {"token":"発"}

    data: {"token":"言"}

    ...

    event: agent_done

    data: {"message":{"timestamp":"...","turn":0,"agent_name":"経済システム","agent_code":"支払/非支払","message":"発言1","provider":"...","model":"..."}}

    event: agent_start

    data: {"turn":1,"agent_name":"科学システム","agent_code":"真/偽"}

    data: {"token":"第"}

    ...

    ```
  - 全発言送信完了後:
    ```
    event: completed

    data: {}

    ```
  - エラー時（`state.status == "failed"`）:
    ```
    event: failed

    data: {"error":"..."}

    ```
  - 実装: `StreamingResponse` の generator で `async for` により `text/event-stream` を送信。`Message` ごとに `await asyncio.sleep(0)` で cooperative yield。
- `/docs` に表示される（FastAPI が自動で OpenAPI に載せる）。

### WebSocket プロトコル（変更なし）
- `WS /ws/simulations/{id}`: `Message` / `WebSocketEvent(event="completed"|"failed"|"not_found")` を送信。

### CLI（`backend/app/main.py`）
- `config.agent_order_mode` / `config.history_length` を読んで `SimulationConfig` に設定。
- `run_long_chain.sh` は stdin から `trigger_message` をパイプで渡す（`input()` が受け取る）。

## コンポーネント構成 (Python & React)

### Python パッケージ構成（変更・新規）
```
backend/
  app/
    __init__.py
    main.py              # 変更: config.agent_order_mode / history_length を SimulationConfig に反映
    server.py            # 変更: CORSMiddleware 追加・SimulationStartRequest 拡張・SSE エンドポイント追加
    simulation.py        # 変更: 動的順序・履歴拡張・is_meta エージェント除外
    schemas.py           # 変更: AgentSpec.is_meta / SimulationConfig.agent_order_mode / history_length / AppConfig 拡張 / SimulationStartRequest 拡張
    config.py            # 変更: AGENT_ORDER_MODE / HISTORY_LENGTH を load_config で読み込み
    llm_client.py        # 変更: LLMClient.complete_stream 追加・OpenAICompatibleClient / GeminiClient に complete_stream 実装
    logger.py            # 変更なし
    agents.py            # 変更なし（is_meta は省略時 False で後方互換）
  tests/
    conftest.py          # 変更: DummyLLMClient に complete_stream 追加（ダミーで char 単位 yield）
    test_server.py       # 変更: 既存テスト維持・agent_order_mode/history_length 省略時のテスト追加
    test_simulation.py   # 変更: 既存テスト維持・動的順序テスト・履歴拡張テスト追加
    test_streaming.py    # 新規: complete_stream / SSE エンドポイントのモックテスト
    test_dynamic_order.py # 新規: 動的順序のテスト（モックメタエージェントで次番選択）
    test_history.py      # 新規: history_length=3 でプロンプトに3件含まれるテスト

config/
  agents.yaml            # 変更なし
  presets/
    agents-3.yaml        # 変更なし
    agents-3-dynamic.yaml # 新規: 3システム + 1メタエージェント
    agents-5.yaml        # 変更なし
    agents-7.yaml        # 変更なし

scripts/
  verify_docker_static.py # 変更: frontend サービス検証追加
  run_long_chain.sh       # 新規: 長連鎖実行スクリプト
  compare_models.py       # 新規: モデル比較スクリプト

docs/
  ops/
    docker-deploy-guide.md # 新規
  experiments/
    long-chain-observation.md # 新規
    model-comparison.md       # 新規
  spec/
    lumann-phase-final.md     # 本ファイル
```

### React 構成（`frontend/` 新設）
```
frontend/
  package.json
  package-lock.json        # npm install で生成
  vite.config.ts           # server.proxy で /api と /ws を http://localhost:8000 にプロキシ
  tsconfig.json            # strict モード
  tsconfig.node.json       # Vite 設定用
  tailwind.config.js
  postcss.config.js
  index.html
  Dockerfile               # node:20-slim・npm install・npm run dev --host 0.0.0.0
  src/
    main.tsx               # React 19 エントリ
    App.tsx                # 最小画面（フォーム + メッセージリスト）
    index.css              # Tailwind ディレクティブ
    types.ts               # Message / SimulationStartResponse / WebSocketEvent 型
    api/
      client.ts            # POST /api/simulations / WS 接続ヘルパ
    components/
      SimulationForm.tsx   # お題・max_turns 入力フォーム
      MessageList.tsx      # Message の時系列表示
    __tests__/
      SimulationForm.test.tsx  # 入力値バリデーション・submit 呼出
      MessageList.test.tsx     # メッセージ描画
  .eslintrc.cjs            # ESLint 設定（@typescript-eslint）
  vite-env.d.ts
```

#### `frontend/package.json`（依存）
```json
{
  "name": "lumann-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.0",
    "vitest": "^2.0.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  }
}
```

#### `frontend/vite.config.ts`
```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const proxyTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:8000";
const wsProxyTarget = process.env.VITE_WS_PROXY_TARGET ?? "ws://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": { target: proxyTarget, changeOrigin: true },
      "/ws": { target: wsProxyTarget, ws: true, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
  },
});
```
※ **Docker Compose での proxy target 解決（P0修正）**: ローカル開発時は `http://localhost:8000`（デフォルト）。Docker Compose で frontend コンテナ内から backend コンテナに接続する場合は `docker-compose.yml` の frontend サービスに `VITE_PROXY_TARGET: http://backend:8000` と `VITE_WS_PROXY_TARGET: ws://backend:8000` を environment で渡す（サービス名 `backend` で名前解決）。`VITE_API_URL=http://localhost:8000` はブラウザ側が直接叩く場合の参照用（本MVPではVite proxy経由のため使用しないが、将来の直接接続用に残置）。

#### `frontend/src/App.tsx`（最小フロー）
- `SimulationForm` でお題 / `max_turns` 入力 → `POST /api/simulations` → `simulation_id` 受取 → `WS /ws/simulations/{id}` 接続 → `Message` 受信ごとに `MessageList` に追加 → `{"event":"completed"|"failed"}` で接続終了。
- 状態: `status: "idle" | "running" | "completed" | "failed"` / `messages: Message[]` / `error: string | null`。

### `frontend/Dockerfile`
```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### `docker-compose.yml` 拡張
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
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    depends_on:
      - backend
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_PROXY_TARGET=http://backend:8000
      - VITE_WS_PROXY_TARGET=ws://backend:8000
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:5173/', r => process.exit(r.statusCode === 200 ? 0 : 1))\""]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

### `backend/app/server.py` 拡張（CORS）
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### `scripts/verify_docker_static.py` 拡張
- `verify_compose` に以下を追加:
  - `compose.services.frontend` が存在
  - `frontend.ports` に `5173:5173` 含有
  - `frontend.build.dockerfile` が `Dockerfile`（`./frontend` コンテキスト相対）
  - `frontend.depends_on` に `backend` 含有

### `.shared-agents/harness/verify.sh`
- 既存 `[2/2] Frontend` ブロックは `frontend/node_modules` 存在時のみ実行（変更不要）。
- 本フェーズで `frontend/` を新設するため、`node_modules` が生成されれば自動的に frontend ステップが走る。`npm install` はユーザー責任だが、`docs/ops/docker-deploy-guide.md` に手順を記載。
- `verify.sh` には追加修正不要（既存枠で対応可能）。ただし `npm install` が未実施の場合の警告メッセージは既存の「frontend/node_modules が見つかりません。スキップします」で十分。

## Docker / コンテナ構成

### イメージ
- `backend`: `python:3.12-slim`（既存・`backend/Dockerfile`）
- `frontend`: `node:20-slim`（新規・`frontend/Dockerfile`）

### ヘルスチェック
- `backend`: 既存 `urllib.request.urlopen('http://localhost:8000/docs')`（維持）
- `frontend`: `node -e "require('http').get('http://localhost:5173/', r => process.exit(r.statusCode === 200 ? 0 : 1))"`（HTTP 200 で健康）・`start_period: 10s`

### ボリューム・ネットワーク
- `backend`: `./logs:/app/logs`（既存・維持）
- `frontend`: ボリュームなし（開発サーバのみ・本番ビルドは次フェーズ）
- ネットワーク: デフォルト bridge（明示的ネットワーク定義は YAGNI で追加しない）

### 起動手順（`docs/ops/docker-deploy-guide.md`）
1. `cp .env.example .env` で API キー等を設定
2. `docker compose up --build` で `backend(8000) + frontend(5173)` 起動
3. `http://localhost:8000/docs` で API 確認
4. `http://localhost:5173` でダッシュボード確認
5. `docker compose run --rm backend python -m app.main` で CLI 実行（お題は stdin から）
6. `docker compose down` で停止

## テスト戦略

### バックエンド
- 既存89テスト全パス（後方互換）。
- `test_simulation.py` に:
  - `test_simulation_dynamic_order`: `agent_order_mode="dynamic"`・モックメタエージェントが「次番: 科学システム」を返し、2ターン目が科学システムになることを検証。
  - `test_simulation_history_length_3`: `history_length=3` で3ターン目の `messages[1]["content"]` に過去2発言が含まれることを検証。
- `test_server.py` に:
  - `test_sse_stream_returns_tokens`: 完了済みシミュレーションに対して `GET /api/simulations/{id}/stream` で `data: {"token":...}` が逐次送信されることを検証（モック LLM で生成した `Message` を再生）。
  - `test_sse_stream_not_found`: 存在しない ID で 404。
  - `test_post_with_agent_order_mode_dynamic`: `agent_order_mode="dynamic"` を指定して起動し、`SimulationConfig` に反映されることを検証。
- `test_streaming.py`（新規）: `OpenAICompatibleClient.complete_stream` / `GeminiClient.complete_stream` を `respx` でモック SSE レスポンスを検証。
- `test_dynamic_order.py`（新規）: メタエージェントの応答パース・フォールバックを検証。
- `test_history.py`（新規）: `history_length` バリデーション・プロンプト構築を検証。

### フロントエンド
- `frontend/src/__tests__/SimulationForm.test.tsx`: 入力値バリデーション（空お題で submit 無効）・`onSubmit` 呼出。
- `frontend/src/__tests__/MessageList.test.tsx`: `Message` 配列を渡して描画されることを検証。
- 合計2件（PRD FR-1 / AC-8）。

### 静的検証
- `scripts/verify_docker_static.py`: frontend サービス検証を追加。
- `pytest -q scripts/verify_docker_static.py` でスクリプト自体の実行は `python scripts/verify_docker_static.py` で行う（main() が int を返すため `pytest` 対象外・`subprocess` で検証するか、`import` して `verify_compose` を直接呼ぶテストを追加してもよいが、YAGNI で追加しない）。

## 変更範囲の明示

### 変更ファイル
- `backend/app/main.py`: `config.agent_order_mode` / `config.history_length` を `SimulationConfig` に反映。
- `backend/app/server.py`: `CORSMiddleware` 追加・`SimulationStartRequest` の新規項目を `SimulationConfig` に反映・SSE エンドポイント `/api/simulations/{id}/stream` 追加。
- `backend/app/simulation.py`: `is_meta` エージェントの `order` 除外・`history: list[str]` 維持・`history_length` に基づく `user` メッセージ構築・`mode="dynamic"` でメタエージェント呼出と次番選択・フォールバック。
- `backend/app/schemas.py`: `AgentSpec.is_meta` / `SimulationConfig.agent_order_mode` / `history_length` / `AppConfig.agent_order_mode` / `history_length` / `SimulationStartRequest.agent_order_mode` / `history_length` 追加。
- `backend/app/config.py`: `AGENT_ORDER_MODE` / `HISTORY_LENGTH` を `os.environ.get` で読み込み `AppConfig` に反映。
- `backend/app/llm_client.py`: `LLMClient.complete_stream` 追加・`OpenAICompatibleClient` / `GeminiClient` に `complete_stream` 実装。既存 `complete` / `build_llm_client` は変更しない（後方互換）。
- `backend/tests/conftest.py`: `DummyLLMClient` に `complete_stream` 追加（char 単位 yield）。
- `backend/tests/test_server.py`: SSE・`agent_order_mode` テスト追加。**`_DummyLLMClient` / `_FailingLLMClient` / `_RaisingLLMClient` 等のローカルモックにも `complete_stream` を追加**（P1修正: `LLMClient` Protocol 拡張に伴う mypy --strict 整合）。
- `backend/tests/test_simulation.py`: 動的順序・履歴テスト追加。
- `.env.example`: `AGENT_ORDER_MODE=` / `HISTORY_LENGTH=` 追加。
- `requirements.txt` / `pyproject.toml`: 依存変更なし（React/Vite 関連は `frontend/package.json` のみ）。`[tool.setuptools] packages = ["app"]` は維持。`mypy` / `ruff` 設定も維持。
- `docker-compose.yml`: `frontend` サービス追加。
- `scripts/verify_docker_static.py`: frontend サービス検証追加。
- `.shared-agents/harness/verify.sh`: 変更不要（既存 `[2/2] Frontend` ブロックで対応可能・`frontend/node_modules` が生成されれば自動実行）。

### 新規ファイル
- `frontend/` 配下一式（`package.json` / `vite.config.ts` / `tsconfig.json` / `tsconfig.node.json` / `tailwind.config.js` / `postcss.config.js` / `index.html` / `Dockerfile` / `.eslintrc.cjs` / `vite-env.d.ts` / `src/main.tsx` / `src/App.tsx` / `src/index.css` / `src/types.ts` / `src/setupTests.ts` / `src/api/client.ts` / `src/components/SimulationForm.tsx` / `src/components/MessageList.tsx` / `src/__tests__/SimulationForm.test.tsx` / `src/__tests__/MessageList.test.tsx`）
- `config/presets/agents-3-dynamic.yaml`
- `scripts/run_long_chain.sh`
- `scripts/compare_models.py`
- `docs/ops/docker-deploy-guide.md`
- `docs/experiments/long-chain-observation.md`
- `docs/experiments/model-comparison.md`
- `backend/tests/test_streaming.py`
- `backend/tests/test_dynamic_order.py`
- `backend/tests/test_history.py`
- `docs/spec/lumann-phase-final.md`（本ファイル）

### 変更しないファイル
- `backend/app/logger.py`: 変更なし。
- `backend/app/agents.py`: 変更なし（`is_meta` は省略時 `False` で後方互換・既存 YAML も修正不要）。
- `backend/app/llm_client.py` の既存 `complete` / `build_agent_clients` / `build_llm_client`: 変更しない（後方互換）。
- `backend/Dockerfile`: 変更なし。
- `config/agents.yaml` / `config/presets/agents-3.yaml` / `agents-5.yaml` / `agents-7.yaml`: 変更なし。

## 未解決の課題

1. **SSE と実行中シミュレーションのリアルタイム統合**: 本フェーズでは「完了済みログの逐次再生」方式を採用するが、実行中シミュレーションに対するリアルタイムトークン push は次フェーズ候補。`SimulationLogger` にストリームキューを追加する方式が自然だが、YAGNI で本フェーズでは見送る。
2. **`complete_stream` の実 API 検証**: `OpenAICompatibleClient.complete_stream` / `GeminiClient.complete_stream` はモック SSE で検証するが、実 API（Ollama Cloud / Gemini）での動作確認はユーザー委譲。
3. **`run_long_chain.sh` の JSONL リネーム**: `SimulationLogger` が `logs/sim_<timestamp>.jsonl` を生成するため、スクリプト内で `mv` する。並列実行時のタイムスタンプ衝突は未考慮（ユーザー委譲）。
4. **`compare_models.py` の `AppConfig` 差し替え**: `load_config()` を呼ぶと `.env` が読まれるため、`AppConfig` を直接構築して `build_agent_clients` に渡す方式にする。`AgentSpec.model` を `--models` の各モデルで差し替える（全エージェント同一モデルで比較する前提・エージェントごとのモデル差し替えは次フェーズ候補）。
5. **`docs/experiments/model-comparison.md` の上書き**: 毎回上書きする（PRD 未解決事項5で上書きで進めることを確認）。履歴保全が必要な場合はタイムスタンプ付きファイル名に拡張するが、本フェーズでは単一ファイル上書き。
6. **`frontend/Dockerfile` の本番ビルド**: 本フェーズは `npm run dev` のみ。本番ビルド（`npm run build` + `serve` / nginx）は次フェーズ候補（PRD 未解決事項7）。
7. **`verify.sh` の Docker 経由 frontend 実行**: 本フェーズでは `frontend/node_modules` 存在時のみローカル実行。Docker 経由で `docker compose exec frontend npm run lint` 等を追加するかは次フェーズで検討（PRD 未解決事項8）。
8. **動的順序のメタエージェント呼出コスト**: 1ターンごとに1回追加 LLM 呼出が発生し、全体時間が約2倍になる。実験的機能のため許容するが、長連鎖（100ターン）では顕著になるため `run_long_chain.sh` は `fixed` モードをデフォルトとする（`AGENT_ORDER_MODE=fixed` をスクリプト内で明示）。

---

*本 Tech Spec は architect ペルソナによって作成された。PRD `docs/prd/lumann-phase-final.md` の受け入れ基準 AC-1〜AC-44 を満たす設計を提示する。実装フェーズでは本 Spec に従い、`ruff format --check` / `ruff check` / `mypy --strict` / `pytest -q` / `eslint` / `tsc -b` / `vitest run` すべてクリーンを維持すること。*