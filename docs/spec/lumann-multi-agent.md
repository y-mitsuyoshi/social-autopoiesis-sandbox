# Tech Spec: 複数AI人格・エージェントごとのモデル選択・人数可変

## コンテキスト

現状の `social-autopoiesis-sandbox` は、経済・科学・法の3機能システムエージェントが単一の
LLM プロバイダ・単一モデルを共有してルーマン的オートポイエーシス連鎖を構成する CLI
シミュレーションである。PRD `docs/prd/lumann-multi-agent.md` は、これを以下の3本柱へ
拡張することを要求する。

1. **エージェントごとのモデル選択**: `AgentSpec` に `provider` / `model` を追加し、
   経済=`gemma4:31b`、科学=`gpt-oss:20b`、法=`llama3.1:8b` のようにエージェントごとに
   異なる Ollama モデルを割当可能にする。
2. **人数可変化**: 3固定のハードコード `AGENTS` を廃止し、YAML 1ファイルで1〜Nエージェント
   を定義可能にする。ルーマン機能システム（芸術/教育/政治/医療/メディア/宗教）の追加も
   YAML編集のみで完結する。
3. **混在プロバイダ対応**: 同一シミュレーション内で `ollama` / `gemini` / `openai` を
   エージェントごとに混在可能にする。認証情報は `.env` に集約。

本Specは「バックエンド CLI 拡張」にスコープを限定する。FastAPI REST/WS API 化・
React 可視化ダッシュボード・ストリーディング応答・動的エージェント順序選択は次フェーズ
以降の引継ぎ事項（PRD「未解決・考慮事項」参照）。

技術スタックは現状維持: Python 3.12 + asyncio + httpx + Pydantic v2 + python-dotenv +
Docker Compose。新規ランタイム依存として **PyYAML >=6.0** を1件追加する。

## 目標 / 非目標

- **目標**:
  - `AgentSpec` に `provider: str` / `model: str` を追加し、各エージェントが固有の
    LLM プロバイダ・モデルを使用できること。
  - `config/agents.yaml`（デフォルト）および `config/presets/agents-{3,5,7}.yaml`
    をエージェント定義の真のソースとし、YAML 1ファイル編集で人数・構成を自由に
    変更できること。
  - `AGENTS_CONFIG` 環境変数で YAML パスを指定可能。未設定時は `config/agents.yaml`
    を探索し、不存在時はハードコード3エージェント（経済/科学/法）にフォールバック。
  - 同一 `provider+model` 組の `httpx.AsyncClient` は1つだけ生成し、複数エージェント
    で共有すること（コネクションプール効率化）。
  - シミュレーション終了（正常/中断いずれ）時に全クライアントを `asyncio.gather` で
    一括 `aclose()` すること。
  - 各発言の `provider` / `model` が `Message` にエージェントごとの実際の値で記録
    されること（`logs/*.jsonl` で追跡可能）。
  - プロバイダ認証情報欠落・`model` 空文字・重複エージェント名・空エージェントリスト
    を起動時に Pydantic バリデータで検出し、分かりやすいエラーで停止すること。
  - `ruff format --check` / `ruff check` / `mypy --strict` / `pytest -q` /
    `./.shared-agents/harness/verify.sh` が全て緑で終了すること。
- **非目標**:
  - FastAPI REST/WS API 化・React 可視化ダッシュボード（次フェーズ）。
  - 動的エージェント順序選択（LLM 自身に次番発言者を選ばせる）。`agent_order` は
    YAML定義順の固定ラウンドロビンを維持。
  - コンテキスト履歴拡張（過去K発言参照）。直前1発言 + お題のまま維持。
  - ストリーミング応答（SSE/WebSocket）。1発言完了まで待機のまま。
  - 100ターン以上の長連鎖定量実験・SIGINT 実API検証（次フェーズ）。
  - `AppConfig.llm_provider` の完全廃止（後方互換のため残置・非推奨化）。

## アーキテクチャ上の決定

### AD-1: `AgentSpec` に `provider` / `model` を直接追加し、別モデルを設けない
（理由: PRD未解決事項#2「YAGNI原則に従い `AgentSpec` 拡張を推奨」を採用。`AgentConfig`
別モデルは重複抽象化で YAGNI 違反。`AgentSpec` は YAML ローダと既存ハードコードの両方で
使われる単一の真実のモデルとする）

### AD-2: `SimulationConfig.provider` / `model` は削除
（理由: シミュレーション全体が単一プロバイダ・単一モデルを使う前提のフィールドだが、
本Specではエージェントごとにプロバイダ・モデルが異なるため、`SimulationConfig` で
単一値を持つ意味がない。`Message.provider` / `Message.model` が各発言の実際の値を
記録するため十分。後方互換のため `AppConfig.llm_provider` は残すが、`SimulationConfig`
のプロバイダ系フィールドはYAML化によって完全に不要になるため削除する）

### AD-3: `AppConfig.llm_provider` は残置（非推奨・フォールバック専用）。YAML 利用時は `*_model` 必須チェックをスキップ
（理由: PRD NFR-7「`AGENTS_CONFIG` 未設定時のフォールバックで従来フローを継続」。
ハードコード `AGENTS` へフォールバックする際、各エージェントの `provider` / `model`
を `AppConfig.llm_provider` + 対応 `*_model` から補填するため `llm_provider` は残す。
`agents_config: str | None` を新規追加し、YAML パスを受け取る。
**重要**: `AppConfig.validate_provider_credentials` は `agents_config` が解決済（YAML 利用時）の場合、`*_model` 必須チェックをスキップする。YAML 利用時はエージェントの `AgentSpec.model` が正であり、`.env` の `OLLAMA_MODEL` / `GEMINI_MODEL` / `OPENAI_MODEL` は未設定でも起動可能とする（PRD FR-2/FR-5 準拠）。`*_API_KEY` / `*_BASE_URL`（provider により必須）は引き続き検証する。フォールバック時（`AGENTS_CONFIG` 未設定かつ `config/agents.yaml` 不存在）のみ `llm_provider` + `*_model` を必須とする）

### AD-4: YAML ローダは `load_agents(config_path, config) -> tuple[list[AgentSpec], str | None]` 関数
（理由: `agents.py` の `AGENTS` 定数は後方互換フォールバックのため残置するが、`AgentSpec` に `provider` / `model` が必須フィールドとして追加されるため、`AGENTS` 定数を `AgentSpec` のまま import 時に構築すると Pydantic ValidationError でモジュールロード失敗する。したがって `AGENTS` は `list[_HardcodedAgent]`（内部 dataclass: name/binary_code/concern/system_prompt のみ）として定義し、`_fallback_agents(config)` で `AppConfig.llm_provider` + 対応 `*_model` から `provider` / `model` を補填した `list[AgentSpec]` に変換して返す。`load_agents` は `config: AppConfig` を受け取る。戻り値は `(list[AgentSpec], str | None)` とし、第2要素に解決した YAML パス（フォールバック時は `None`）を返す。これは `main()` のサマリ表示で「エージェント構成: <config_path or "ハードコード(フォールバック)">」を表示するための情報源となる。**`_resolve_config_path` で `config_path` が指定されているのにファイル不存在の場合は早期 `ValueError`（「AGENTS_CONFIG で指定されたパスが存在しません: <path>」）を送出し、`_fallback_agents` に進まない**（ユーザーが誤パスを書いた際に `*_MODEL` 未設定エラー而非误パスエラーで混乱するのを防ぐ）。ファイル読込は `pathlib.Path.read_text`（同期・起動時のみ実行されるため `async def` 内でなくても可。`main()` は `async def` だが起動時1回限りの微小I/Oのため `asyncio.to_thread` で包む必要なし）

### AD-5: `AgentConfigFile` PydanticモデルでYAML全体を検証
（理由: `dict[str, Any]` から直接 `list[AgentSpec]` を構築すると、YAMLトップレベル
構造エラー（`agents` キー不在等）のメッセージが不親切。`AgentConfigFile` で
`agents: list[AgentSpec]` を受け、`model_validator` で重複名・空リスト・provider正当性
を検証する。Pydantic `ValidationError` をユーザーフレンドリーメッセージに変換）

### AD-6: `build_agent_clients(agents, config) -> dict[str, LLMClient]` でキャッシュ共有
（理由: 同一 `(provider, model)` 組の `httpx.AsyncClient` は1つだけ生成し、複数
エージェントで共有する（NFR-5）。キーは `agent.name`。`build_llm_client(config)` は
後方互換のため残すが、新規実装は `build_agent_clients` を正とする。プロバイダごとの
認証情報は `AppConfig` から取得し、未設定時は分かりやすいエラーを即座に送出）

### AD-7: `close_all_clients(clients) -> None` で unique クライアントのみ一括 `aclose()`
（理由: 複数エージェントが同一クライアントを共有するため、`dict.values()` をそのまま
`aclose()` すると同一クライアントが複数回クローズされる。`id()` または `set()` で
unique を抽出し `asyncio.gather(*[c.aclose() for c in unique])` で一括実行。
`asyncio.gather` は `return_exceptions=False`（デフォルト）で1件失敗時即停止）

### AD-8: `run_simulation` シグネチャを `clients: dict[str, LLMClient]` に変更
（理由: 単一 `client` からエージェントごとの `dict` へ。`agent = order[turn % len(order)]`
→ `client = clients[agent.name]`。`finally` で `close_all_clients(clients)` と
`logger.aclose()` を実行。`Message` の `provider` / `model` は `LLMResponse` から
取得した実際の値で上書き）

### AD-9: `SimulationLogger.__init__` の `provider` / `model` 引数は削除
（理由: YAGNI。`Message` 側で `provider` / `model` がエージェントごとに記録済みのため、
logger が単一値を持つ意味がない。`logs/sim_<ISO8601>.jsonl` のファイル名はタイムスタンプ
のみで十分。`asyncio.Lock` はファイル追記保護のため継続使用）

### AD-10: プリセットYAMLはルーマン機能システムの二値コード・関心を正確に反映
（理由: PRD FR-3。`config/presets/agents-3.yaml`（経済/科学/法）、`agents-5.yaml`
（3 + 芸術 + メディア）、`agents-7.yaml`（5 + 政治 + 教育）を同梱。各 `system_prompt`
は対応機能システムの二値コードと関心を明示的に含む。`config/agents.yaml` は
`agents-3.yaml` と同一内容をデフォルトとする）

### AD-11: Docker は `config/` ディレクトリを `COPY config ./config` で取り込み
（理由: YAML ファイルがコンテナ内で読込可能である必要がある。`docker-compose.yml`
本体は変更不要（`./logs:/app/logs` のみボリュームマウント）。`config/` はイメージに
焼き込むことで、ユーザーがプリセットを編集した場合は `docker compose up --build`
で再ビルドが必要。これは YAGNI 的に許容範囲）

### AD-12: `AgentSpec` の `provider` は `Literal["ollama","gemini","openai"]` で型制約
（理由: 型安全性。`str` だと打ち間違いが実行時まで発見されない。`Literal` で
Pydantic が即座にバリデーションエラーを送出。新規プロバイダ追加時は `Literal` と
`_SUPPORTED_PROVIDERS` と `build_agent_clients` の3箇所を更新）

## データモデル・インメモリ状態設計

すべてのスキーマは `backend/app/schemas.py` に Pydantic v2 `BaseModel` で定義。
`Any` 型は使用禁止。`mypy --strict` でエラー0件を維持。

### `AgentSpec` — 機能システムエージェント定義（変更）
```python
class AgentSpec(BaseModel):
    name: str                              # 例: "経済システム"
    binary_code: str                       # 例: "支払/非支払"
    concern: str                           # 例: "コスト・利益・市場価値・資源効率"
    system_prompt: str                     # コード・関心・役割を含む完全プロンプト
    provider: Literal["ollama", "gemini", "openai"]
    model: str                             # 例: "gemma4:31b"（空文字禁止）

    @field_validator("model")
    @classmethod
    def model_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("model must not be empty")
        return v

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v
```

### `AgentConfigFile` — YAML全体スキーマ（新規）
```python
class AgentConfigFile(BaseModel):
    agents: list[AgentSpec]

    @model_validator(mode="after")
    def validate_agents(self) -> "AgentConfigFile":
        if not self.agents:
            raise ValueError("agents list must not be empty")
        names = [a.name for a in self.agents]
        if len(set(names)) != len(names):
            dupes = {n for n in names if names.count(n) > 1}
            raise ValueError(f"agent names must be unique, duplicates: {sorted(dupes)}")
        return self
```

### `Message` — 変更なし
```python
class Message(BaseModel):
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    turn: int
    agent_name: str
    agent_code: str
    message: str
    provider: str          # LLMResponse から取得した実際の値
    model: str             # LLMResponse から取得した実際の値
```

### `SimulationConfig` — provider/model 削除
```python
class SimulationConfig(BaseModel):
    trigger_message: str
    max_turns: int = Field(ge=0)
    agent_order: list[str]

    @model_validator(mode="after")
    def validate_agent_order(self) -> "SimulationConfig":
        if not self.agent_order:
            raise ValueError("agent_order must not be empty")
        if len(set(self.agent_order)) != len(self.agent_order):
            raise ValueError("agent_order must not contain duplicates")
        return self
```

### `LLMResponse` — 変更なし
```python
class LLMResponse(BaseModel):
    content: str
    provider: str
    model: str
```

### `AppConfig` — `agents_config` 追加、`llm_provider` は残置。YAML 利用時の `*_model` 必須チェックスキップ
```python
class AppConfig(BaseModel):
    llm_provider: Literal["ollama", "gemini", "openai"]   # 非推奨・フォールバック専用
    max_turns: int = Field(ge=0)
    agents_config: str | None = None                       # 新規: AGENTS_CONFIG

    ollama_api_key: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    gemini_api_key: str | None = None
    gemini_base_url: str | None = None
    gemini_model: str | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None

    @model_validator(mode="after")
    def validate_provider_credentials(self) -> "AppConfig":
        # AD-3: agents_config が解決済（YAML 利用時）は *_model 必須チェックをスキップ。
        # YAML 利用時はエージェントの AgentSpec.model が正であり、.env の *_model は
        # 未設定でも起動可能（PRD FR-2/FR-5）。*_API_KEY / *_BASE_URL は引き続き検証。
        # フォールバック時（agents_config 未設定 かつ config/agents.yaml 不存在）のみ
        # llm_provider + *_model を必須とする。
        # ※「YAML 利用時」の判定は load_agents 側で行い、AppConfig は
        #   agents_config が None でなければ「YAML 利用意図あり」と見なす。
        #   agents_config が None の場合はフォールバック前提で *_model を必須検証する。
        ...
```

### インメモリ状態
- `clients: dict[str, LLMClient]` — `main()` 内で `build_agent_clients` により
  構築。起動時同期処理内で完結し、`asyncio.Lock` 不要。
- `logger: SimulationLogger` — 既存 `asyncio.Lock` でファイル追記保護（変更なし）。
- `prev_message: str` — `run_simulation` 内のローカル変数（変更なし）。

### `asyncio.Lock` 適用箇所
- **変更なし**: `SimulationLogger._lock`（ファイル追記保護）のみ。
- クライアントキャッシュ `dict` は `main()` 起動時の同期処理内で1回だけ構築され、
  シミュレーション実行中は読み取り専用（`clients[agent.name]` の参照のみ）のため
  Lock 不要。`close_all_clients` は `finally` ブロック内で1回だけ実行。

## API・WebSocketプロトコル設計

本フェーズは CLI のみ。HTTP/WebSocket API は実装しない（次フェーズ引継ぎ）。

### CLI エントリポイント `main()` のフロー
```
1. config = load_config()
2. agents, resolved_path = load_agents(config.agents_config, config)
3. validate_agent_credentials(agents, config)   # 全エージェントの provider に
                                                 # 必要な API_KEY/BASE_URL が
                                                 # 揃っているか一括検証
4. clients = build_agent_clients(agents, config)
5. サマリ表示:
   === ルーマン・オートポイエーシス・シミュレーション ===
   エージェント構成: <resolved_path or "ハードコード(フォールバック)">
     1. 経済システム   [ollama / gemma4:31b]
     2. 科学システム   [ollama / gpt-oss:20b]
     ...
   最大ターン: <N or "無限">
6. trigger = await asyncio.to_thread(input, "お題を入力してください > ")
7. sim_config = SimulationConfig(
        trigger_message=trigger,
        max_turns=config.max_turns,
        agent_order=[a.name for a in agents],
   )
8. logger = SimulationLogger()
9. await run_simulation(sim_config, agents, clients, logger)
   ※ run_simulation の finally で close_all_clients + logger.aclose を一元化。
   ※ main() 側に except CancelledError での二重クローズは置かない（P1対策）。
   ※ 外側の try: asyncio.run(main()) except KeyboardInterrupt は二度目 SIGINT の保険として残置。
```

### `run_simulation` シグネチャ（変更）
```python
async def run_simulation(
    config: SimulationConfig,
    agents: list[AgentSpec],
    clients: dict[str, LLMClient],
    logger: SimulationLogger,
) -> None:
    agent_map = {a.name: a for a in agents}
    for name in config.agent_order:
        if name not in agent_map:
            raise ValueError(f"agent_order references unknown agent: {name}")
    for name in config.agent_order:
        if name not in clients:
            raise ValueError(f"clients missing for agent: {name}")

    order = [agent_map[name] for name in config.agent_order]
    prev_message: str = config.trigger_message
    try:
        for turn in count():
            if config.max_turns and turn >= config.max_turns:
                break
            agent = order[turn % len(order)]
            client = clients[agent.name]
            messages = [
                {"role": "system", "content": agent.system_prompt},
                {
                    "role": "user",
                    "content": f"お題: {config.trigger_message}\n直前の発言: {prev_message}",
                },
            ]
            try:
                resp = await client.complete(messages)
            except LLMError as exc:
                print(f"[ターン {turn}] LLM呼出失敗: {exc.message}", file=sys.stderr)
                break
            msg = Message(
                turn=turn,
                agent_name=agent.name,
                agent_code=agent.binary_code,
                message=resp.content,
                provider=resp.provider,
                model=resp.model,
            )
            await logger.log(msg)
            prev_message = resp.content
            await asyncio.sleep(0)
    except asyncio.CancelledError:
        print("\nシミュレーションを中断します。")
        raise
    finally:
        await close_all_clients(clients)
        await logger.aclose()
```
※ `finally` で `close_all_clients(clients)` と `logger.aclose()` を一元化。`CancelledError` 再送後に `finally` が走りクリーンアップされる。`main()` 側に二重クローズの `except CancelledError` は置かない。`main()` は `await run_simulation(...)` のみを呼び、外側の `try: asyncio.run(main()) except KeyboardInterrupt` が二度目 SIGINT の保険。

### `load_agents` シグネチャ（新規・`agents.py`）
```python
def load_agents(
    config_path: str | None, config: AppConfig
) -> tuple[list[AgentSpec], str | None]:
    path = _resolve_config_path(config_path)
    if path is None:
        return _fallback_agents(config), None   # ハードコード AGENTS を AppConfig から補填
    raw = path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw)
    if not isinstance(data, dict):
        raise ValueError(f"YAML root must be a mapping: {path}")
    try:
        file_model = AgentConfigFile.model_validate(data)
    except ValidationError as exc:
        raise ValueError(f"Invalid agents config {path}: {exc}") from exc
    return file_model.agents, str(path)


def _fallback_agents(config: AppConfig) -> list[AgentSpec]:
    # ハードコード AGENTS の provider/model を AppConfig から補填したコピーを返す。
    # AgentSpec は provider/model が必須のため、AGENTS 定数自体は provider/model 未設定で
    # 構築できず、フォールバック時に限り AppConfig.llm_provider + 対応 *_model から補填する。
    model = {
        "ollama": config.ollama_model,
        "gemini": config.gemini_model,
        "openai": config.openai_model,
    }[config.llm_provider]
    if model is None:
        raise ValueError(
            f"フォールバック時に model が未設定です: {config.llm_provider}_MODEL を .env に設定するか"
            f" AGENTS_CONFIG で YAML を指定してください"
        )
    return [
        AgentSpec(
            name=a.name, binary_code=a.binary_code, concern=a.concern,
            system_prompt=a.system_prompt,
            provider=config.llm_provider, model=model,
        )
        for a in AGENTS
    ]
```

### `build_agent_clients` シグネチャ（新規・`llm_client.py`）
```python
def build_agent_clients(
    agents: list[AgentSpec],
    config: AppConfig,
) -> dict[str, LLMClient]:
    cache: dict[tuple[str, str], LLMClient] = {}
    result: dict[str, LLMClient] = {}
    for agent in agents:
        key = (agent.provider, agent.model)
        if key not in cache:
            cache[key] = _build_single_client(agent.provider, agent.model, config)
        result[agent.name] = cache[key]
    return result


def _build_single_client(provider: str, model: str, config: AppConfig) -> LLMClient:
    if provider == "ollama":
        if config.ollama_api_key is None or config.ollama_base_url is None:
            raise LLMError("ollama credentials are not configured")
        return OpenAICompatibleClient(
            provider="ollama", model=model,
            api_key=config.ollama_api_key, base_url=config.ollama_base_url,
        )
    if provider == "openai":
        if config.openai_api_key is None or config.openai_base_url is None:
            raise LLMError("openai credentials are not configured")
        return OpenAICompatibleClient(
            provider="openai", model=model,
            api_key=config.openai_api_key, base_url=config.openai_base_url,
        )
    if provider == "gemini":
        if config.gemini_api_key is None:
            raise LLMError("gemini credentials are not configured")
        base_url = config.gemini_base_url or "https://generativelanguage.googleapis.com"
        return GeminiClient(model=model, api_key=config.gemini_api_key, base_url=base_url)
    raise LLMError(f"Unsupported provider: {provider}")
```

### `close_all_clients` シグネチャ（新規・`llm_client.py`）
```python
async def close_all_clients(clients: dict[str, LLMClient]) -> None:
    seen: set[int] = set()
    to_close: list[LLMClient] = []
    for c in clients.values():
        if id(c) not in seen:
            seen.add(id(c))
            to_close.append(c)
    results = await asyncio.gather(*[c.aclose() for c in to_close], return_exceptions=True)
    errors = [r for r in results if isinstance(r, BaseException)]
    if errors:
        raise errors[0]
```
※ `return_exceptions=True` で全件クローズ試行後に例外を集約し、失敗があれば最初の例外を再送出。1件失敗で残りがクローズされないリソースリークを防ぐ。`run_simulation` の `finally` で1回だけ呼出し、`main()` 側の `except CancelledError` では呼出さない（二重 `aclose` 回避）。`LLMClient.aclose`（`httpx.AsyncClient.aclose`）の冪等性に依存しない設計。

### `validate_agent_credentials`（新規・`main.py` 内ヘルパ）
```python
def validate_agent_credentials(
    agents: list[AgentSpec], config: AppConfig
) -> None:
    for agent in agents:
        if agent.provider == "ollama":
            if config.ollama_api_key is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=ollama を指定していますが、"
                    f"OLLAMA_API_KEY が未設定です"
                )
            if config.ollama_base_url is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=ollama を指定していますが、"
                    f"OLLAMA_BASE_URL が未設定です"
                )
        elif agent.provider == "gemini":
            if config.gemini_api_key is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=gemini を指定していますが、"
                    f"GEMINI_API_KEY が未設定です"
                )
        elif agent.provider == "openai":
            if config.openai_api_key is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=openai を指定していますが、"
                    f"OPENAI_API_KEY が未設定です"
                )
            if config.openai_base_url is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=openai を指定していますが、"
                    f"OPENAI_BASE_URL が未設定です"
                )
```

## コンポーネント構成 (Python & React)

### Python パッケージ構成（変更）
```
backend/app/
├── main.py              # 変更: load_agents/build_agent_clients 統合・サマリ表示
├── agents.py            # 変更: load_agents 新規・AGENTS は残置（フォールバック）
├── llm_client.py        # 変更: build_agent_clients/close_all_clients 新規
├── schemas.py           # 変更: AgentSpec 拡張・AgentConfigFile 新規・
│                        #       SimulationConfig provider/model 削除・
│                        #       AppConfig agents_config 追加
├── config.py            # 変更: AGENTS_CONFIG 読込
└── logger.py            # 変更: __init__ の provider/model 引数削除
```

### `config/` ディレクトリ構成（新規）
```
config/
├── agents.yaml           # デフォルト（agents-3.yaml と同一内容）
└── presets/
    ├── agents-3.yaml     # 経済/科学/法
    ├── agents-5.yaml     # 3 + 芸術 + メディア
    ├── agents-7.yaml     # 5 + 政治 + 教育
    └── README.md         # 各プリセット解説
```

### `config/agents.yaml` および `config/presets/agents-3.yaml`（同一内容）
```yaml
agents:
  - name: 経済システム
    binary_code: 支払/非支払
    concern: コスト・利益・市場価値・資源効率
    provider: ollama
    model: gemma4:31b
    system_prompt: |
      あなたは経済システムである。
      世界を二値コード「支払/非支払」で解釈し、
      コスト・利益・市場価値・資源効率に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      経済システムとしての発言を生成せよ。
  - name: 科学システム
    binary_code: 真/偽
    concern: データ客観性・論理整合性・エビデンス・事実検証
    provider: ollama
    model: gpt-oss:20b
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
    system_prompt: |
      あなたは法システムである。
      世界を二値コード「合法/違法」で解釈し、
      規約遵守・権利・契約正当性に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      法システムとしての発言を生成せよ。
```

### `config/presets/agents-5.yaml`
```yaml
agents:
  - name: 経済システム
    binary_code: 支払/非支払
    concern: コスト・利益・市場価値・資源効率
    provider: ollama
    model: gemma4:31b
    system_prompt: |
      あなたは経済システムである。
      世界を二値コード「支払/非支払」で解釈し、
      コスト・利益・市場価値・資源効率に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      経済システムとしての発言を生成せよ。
  - name: 科学システム
    binary_code: 真/偽
    concern: データ客観性・論理整合性・エビデンス・事実検証
    provider: ollama
    model: gpt-oss:20b
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
    system_prompt: |
      あなたは法システムである。
      世界を二値コード「合法/違法」で解釈し、
      規約遵守・権利・契約正当性に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      法システムとしての発言を生成せよ。
  - name: 芸術システム
    binary_code: 興味深い/退屈
    concern: 創造性・美的判断・形式の革新
    provider: ollama
    model: gemma4:31b
    system_prompt: |
      あなたは芸術システムである。
      世界を二値コード「興味深い/退屈」で解釈し、
      創造性・美的判断・形式の革新に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      芸術システムとしての発言を生成せよ。
  - name: メディアシステム
    binary_code: 伝達/非伝達
    concern: 注目・拡散・ニュース価値・世論形成
    provider: gemini
    model: gemini-2.5-flash
    system_prompt: |
      あなたはマスメディアシステムである。
      世界を二値コード「伝達/非伝達」で解釈し、
      注目・拡散・ニュース価値・世論形成に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      マスメディアシステムとしての発言を生成せよ。
```

### `config/presets/agents-7.yaml`
```yaml
agents:
  - name: 経済システム
    binary_code: 支払/非支払
    concern: コスト・利益・市場価値・資源効率
    provider: ollama
    model: gemma4:31b
    system_prompt: |
      あなたは経済システムである。
      世界を二値コード「支払/非支払」で解釈し、
      コスト・利益・市場価値・資源効率に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      経済システムとしての発言を生成せよ。
  - name: 科学システム
    binary_code: 真/偽
    concern: データ客観性・論理整合性・エビデンス・事実検証
    provider: ollama
    model: gpt-oss:20b
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
    system_prompt: |
      あなたは法システムである。
      世界を二値コード「合法/違法」で解釈し、
      規約遵守・権利・契約正当性に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      法システムとしての発言を生成せよ。
  - name: 芸術システム
    binary_code: 興味深い/退屈
    concern: 創造性・美的判断・形式の革新
    provider: ollama
    model: gemma4:31b
    system_prompt: |
      あなたは芸術システムである。
      世界を二値コード「興味深い/退屈」で解釈し、
      創造性・美的判断・形式の革新に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      芸術システムとしての発言を生成せよ。
  - name: メディアシステム
    binary_code: 伝達/非伝達
    concern: 注目・拡散・ニュース価値・世論形成
    provider: gemini
    model: gemini-2.5-flash
    system_prompt: |
      あなたはマスメディアシステムである。
      世界を二値コード「伝達/非伝達」で解釈し、
      注目・拡散・ニュース価値・世論形成に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      マスメディアシステムとしての発言を生成せよ。
  - name: 政治システム
    binary_code: 権力/非権力
    concern: 権力獲得・意思決定・集合意志
    provider: ollama
    model: gpt-oss:20b
    system_prompt: |
      あなたは政治システムである。
      世界を二値コード「権力/非権力」で解釈し、
      権力獲得・意思決定・集合意志に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      政治システムとしての発言を生成せよ。
  - name: 教育システム
    binary_code: 資格/非資格
    concern: 学習・社会化・キャリア準備
    provider: ollama
    model: llama3.1:8b
    system_prompt: |
      あなたは教育システムである。
      世界を二値コード「資格/非資格」で解釈し、
      学習・社会化・キャリア準備に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      教育システムとしての発言を生成せよ。
```

### `config/presets/README.md`（新規）
```markdown
# 機能システム プリセット

ルーマン社会システム論の機能システムをプリセット定義した YAML 集。

## agents-3.yaml — 基本三システム
経済・科学・法。ルーマン理論の中核三機能システム。

## agents-5.yaml — 五システム（混在プロバイダ例）
経済・科学・法 + 芸術 + メディア。メディアのみ `gemini` を例示。

## agents-7.yaml — 七システム
5 + 政治 + 教育。ルーマンが挙げる主要機能システムの網羅的構成。

## 機能システム一覧
| 名称         | 二値コード       | 関心                                 |
|--------------|------------------|--------------------------------------|
| 経済システム | 支払/非支払      | コスト・利益・市場価値・資源効率     |
| 科学システム | 真/偽            | データ客観性・論理整合性・エビデンス |
| 法システム   | 合法/違法        | 規約遵守・権利・契約正当性           |
| 芸術システム | 興味深い/退屈    | 創造性・美的判断・形式の革新         |
| メディア     | 伝達/非伝達      | 注目・拡散・ニュース価値・世論形成   |
| 政治システム | 権力/非権力      | 権力獲得・意思決定・集合意志         |
| 教育システム | 資格/非資格      | 学習・社会化・キャリア準備           |

## 拡張方法
`config/agents.yaml` を上書き、または `AGENTS_CONFIG` 環境変数で別パスを指定。
```

### React 構成
本フェーズは非スコープ。`frontend/` は変更しない。

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

CMD ["python", "-m", "app.main"]
```

### `docker-compose.yml`（変更不要）
```yaml
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    env_file: .env
    volumes:
      - ./logs:/app/logs
    stdin_open: true
    tty: true
    healthcheck:
      test: ["CMD", "python", "-c", "import app; print('ok')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
```

- **イメージ**: `python:3.12-slim`（変更なし）。
- **ヘルスチェック**: `python -c "import app; print('ok')"`（変更なし）。
- **ボリューム**: `./logs:/app/logs` のみ。`config/` はイメージに焼き込む
  （ユーザーがプリセットを編集した場合は `--build` で再ビルド）。
- **non-root**: `appuser`（変更なし）。

### `.env.example`（変更）
```env
LLM_PROVIDER=ollama
MAX_TURNS=9

# エージェント定義 YAML パス（未設定時は config/agents.yaml を探索、
# さらに不存在時はハードコード3エージェントにフォールバック）
AGENTS_CONFIG=

# Ollama Cloud (OpenAI互換)
OLLAMA_API_KEY=
OLLAMA_BASE_URL=https://ollama.com/v1
OLLAMA_MODEL=

# Gemini
GEMINI_API_KEY=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_MODEL=

# OpenAI
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=
```

### `requirements.txt`（変更）
```
httpx>=0.27
pydantic>=2
python-dotenv>=1.0
pyyaml>=6.0
```

### `pyproject.toml`（変更）
`[project] dependencies` に `"pyyaml>=6.0"` を追加。

## テスト戦略

### `backend/tests/test_load_agents.py`（新規）
- `test_load_agents_from_explicit_path` — `AGENTS_CONFIG` 指定 YAML から3エージェント読込
- `test_load_agents_default_path` — `AGENTS_CONFIG` 未設定・`config/agents.yaml` 存在 → 読込
- `test_load_agents_fallback_to_hardcode` — `AGENTS_CONFIG` 未設定・ファイル不存在 → `AGENTS`
  - **分離方針**: リポジトリに `config/agents.yaml` が同梱されるため、テスト実行 cwd で常に YAML が見つかりフォールバック経路が検証できない。本テストは `monkeypatch.chdir(tmp_path)` で `tmp_path` に chdir した上で `load_agents(None, config)` を呼出し、`config/agents.yaml` が存在しない環境を再現する。`AppConfig` は `ollama` + `OLLAMA_MODEL` 設定済のダミーを構築して渡す。
- `test_load_agents_returns_resolved_path` — `load_agents` が `(list[AgentSpec], str | None)` を返し、YAML 読込時はパス文字列・フォールバック時は `None` を返すことを検証
- `test_load_agents_duplicate_names_raises` — 重複名 → `ValueError`
- `test_load_agents_empty_list_raises` — 空リスト → `ValueError`
- `test_load_agents_missing_required_field_raises` — `name` 欠落等 → `ValueError`
- `test_load_agents_invalid_provider_raises` — `provider: "foo"` → `ValueError`
- `test_load_agents_empty_model_raises` — `model: ""` → `ValueError`
- `test_load_agents_invalid_yaml_syntax_raises` — YAML パースエラー → `ValueError`
- `test_load_agents_non_mapping_root_raises` — ルートがリスト等 → `ValueError`
- `test_fallback_agents_uses_appconfig_provider_model` — フォールバック時、`AGENTS` の各エージェントが `AppConfig.llm_provider` + `*_model` で補填された `provider` / `model` を持つことを検証
- `test_fallback_agents_raises_when_model_missing` — フォールバック時に `*_model` が `None` → `ValueError`（分かりやすいメッセージ）

### `backend/tests/test_llm_client.py`（更新）
- 既存 `test_build_llm_client_*` は維持（後方互換）。
- 新規 `test_build_agent_clients_caches_same_provider_model` — 同一 `(provider, model)`
  を2エージェントが指定 → 同一クライアントインスタンス（`id()` 一致）。
- 新規 `test_build_agent_clients_distinct_for_different_model` — 異なる model → 別インスタンス。
- 新規 `test_build_agent_clients_mixed_providers` — `ollama` + `gemini` 混在 → それぞれ
  正しいクラスのインスタンス。
- 新規 `test_build_agent_clients_missing_ollama_key_raises` — `ollama_api_key=None` →
  `LLMError`。
- 新規 `test_build_agent_clients_missing_gemini_key_raises` — `gemini_api_key=None` →
  `LLMError`。
- 新規 `test_close_all_clients_closes_unique_only` — 3エージェント・2クライアント共有 →
  `aclose()` は2回だけ呼出。
- 新規 `test_close_all_clients_gather_concurrent` — 並行クローズされることの検証
  （`DummyLLMClient.aclose` にカウンタ）。

### `backend/tests/test_simulation.py`（更新）
- 既存テストの `SimulationConfig(provider=..., model=...)` を削除。
- `SimulationLogger(provider=..., model=...)` を `SimulationLogger()` に変更。
- `run_simulation(config, AGENTS, client, logger)` →
  `run_simulation(config, AGENTS, {a.name: client for a in AGENTS}, logger)`。
- 新規 `test_simulation_uses_per_agent_client` — 2エージェントに別クライアントを
  割当て、各ターンで正しいクライアントが呼出されることを検証。
- 新規 `test_simulation_closes_all_clients_on_completion` — `close_all_clients` が
  unique クライアントのみクローズすることを検証。
- `test_simulation_closes_on_llm_failure` の `FailingClient` — `complete` が `LLMError` を送出するよう `LLMClient` Protocol に合わせる。`dict` に包む際は `# type: ignore[arg-type]` 付与（`FailingClient` は `LLMResponse` でなく `LLMError` を raise するため Protocol の戻り値型と厳密合致しないが、検証目的のため許容）

### `backend/tests/test_agents.py`（更新）
- `ECONOMY_AGENT` / `SCIENCE_AGENT` / `LAW_AGENT` の `provider` / `model` を
  追加検証（フォールバック値 = `AppConfig.llm_provider` + 対応 `*_model`）。
- 新規 `test_agents_have_provider_and_model` — 全エージェントが `provider` / `model`
  を持つ。

### `backend/tests/test_config.py`（更新）
- 新規 `test_load_config_reads_agents_config` — `AGENTS_CONFIG` 環境変数読込。
- 新規 `test_load_config_agents_config_optional` — 未設定時 `agents_config is None`。

### `backend/tests/conftest.py`（更新）
- `DummyLLMClient` は変更なし。
- 新規 fixture `dummy_clients_dict` — `AGENTS` から `{a.name: DummyLLMClient()}` を
  生成。
- 新規 fixture `tmp_agents_yaml` — `tmp_path` に YAML を書出し、パスを返す。
- `env_ollama` fixture は `AGENTS_CONFIG` を設定しない（フォールバック検証のため）。

## 変更範囲の明示

### 変更ファイル
- `backend/app/schemas.py` — `AgentSpec` 拡張・`AgentConfigFile` 新規・
  `SimulationConfig` provider/model 削除・`AppConfig.agents_config` 追加・
  `AppConfig.validate_provider_credentials` の YAML 利用時 `*_model` スキップ
- `backend/app/agents.py` — `load_agents` 新規（`config: AppConfig` 受取・`tuple` 戻り値）・
  `AGENTS` は残置（フォールバック用）。**`AGENTS` の型は `list[AgentSpec]` から `list[_HardcodedAgent]`（内部 dataclass: name/binary_code/concern/system_prompt のみ）に変更**し、import 時の Pydantic ValidationError を回避。`_fallback_agents` で `_HardcodedAgent` → `AgentSpec` へ `AppConfig` から provider/model 補填して変換する
- `backend/app/main.py` — `main()` フロー再設計・`run_simulation` シグネチャ変更・
  `validate_agent_credentials` 新規・二重クローズ回避
- `backend/app/llm_client.py` — `build_agent_clients` / `close_all_clients` 新規・
  `build_llm_client` は残置
- `backend/app/config.py` — `AGENTS_CONFIG` 読込
- `backend/app/logger.py` — `__init__` の `provider` / `model` 引数削除
- `.env.example` — `AGENTS_CONFIG=` 行追加
- `requirements.txt` — `pyyaml>=6.0` 追加
- `pyproject.toml` — `dependencies` に `pyyaml>=6.0` 追加
- `backend/Dockerfile` — `COPY config ./config` 追加
- `backend/tests/conftest.py` — `dummy_clients_dict` / `tmp_agents_yaml` fixture 追加
- `backend/tests/test_agents.py` — `provider` / `model` 検証追加
- `backend/tests/test_llm_client.py` — `build_agent_clients` / `close_all_clients` テスト
- `backend/tests/test_simulation.py` — `clients: dict` シグネチャ対応
- `backend/tests/test_config.py` — `AGENTS_CONFIG` 読込テスト
- `docs/ops/real-api-e2e.md` — YAML 設定例と5エージェント起動手順の追記（NFR-8）

### 新規ファイル
- `config/agents.yaml`
- `config/presets/agents-3.yaml`
- `config/presets/agents-5.yaml`
- `config/presets/agents-7.yaml`
- `config/presets/README.md`
- `backend/tests/test_load_agents.py`

### 変更しないファイル
- `docker-compose.yml`（`./logs:/app/logs` のみ・`config/` はイメージ焼込）
- `backend/app/llm_client.py` の `OpenAICompatibleClient` / `GeminiClient` /
  `retry_async`（既存実装維持）

## 未解決の課題

0. **`yaml.safe_load` の戻り値 `Any` と「`Any` 型は使用禁止」の整合**: `yaml.safe_load(raw)` は `Any` を返すため、`mypy --strict` で `Any` 使用警告が出る可能性がある。本Specでは「`Any` 禁止」を**ユーザー定義シグネチャ（関数引数・戻り値・変数注釈）に限定**する運用ルールとし、外部ライブラリ（PyYAML）の戻り値を `isinstance(data, dict)` で `dict[object, object]` に絞り込んだ上で `AgentConfigFile.model_validate(data)` に渡す。`model_validate` は `Mapping[str, Any]` 等を受け付けるため、`cast(dict[str, object], data)` で型を絞る手順を `load_agents` 実装に適用する。`mypy --strict` の `disallow_any_explicit` / `disallow_any_expr` が有効な場合は `cast` 必須。

1. **`gpt-oss:20b` / `llama3.1:8b` の Ollama Cloud 可用性**: プリセットに記載した
   モデルが Ollama Cloud 側で利用可能かは実API検証時に確認が必要。利用不可モデルを
   デフォルトにするとユーザーが混乱するため、実API検証後に検証済みモデルのみを
   デフォルトにし、利用不可モデルはコメント例示に留める（PRD リスク事項）。

2. **`AppConfig.llm_provider` の完全廃止タイミング**: 本フェーズでは後方互換のため
   残置（非推奨）。次フェーズ以降で `AGENTS_CONFIG` 必須化を検討する場合、
   `llm_provider` と対応 `*_model` フィールドを削除し、`AGENTS_CONFIG` を必須にする。

3. **`config/` のボリュームマウント vs イメージ焼込**: 本Specではイメージ焼込
   （`COPY config ./config`）を採用。ユーザーがプリセットを編集するたびに
   `--build` が必要。頻繁に編集する場合は `docker-compose.yml` に
   `./config:/app/config` ボリュームを追加することも検討可能だが、YAGNI 的に
   本フェーズは焼込で十分。

4. **httpx クライアント共有の並行 `complete()` 安全性**: 現状は順次実行（ラウンド
   ロビン）のため問題なし。将来ストリーミング・並行実行を導入する場合は
   `httpx.AsyncClient` のスレッド安全性を別途検証。

5. **SIGINT 実 API 検証**: Ctrl-C で `close_all_clients` が全クライアントに伝播するか
   の実機検証は次フェーズ。本フェーズの単体テストで代用。

6. **`agents.yaml` の `model` 空文字検証のタイミング**: `AgentSpec.field_validator`
   で検出するが、YAML ロード時の Pydantic `ValidationError` をユーザーフレンドリー
   メッセージに変換する変換レイヤの精度を要確認。