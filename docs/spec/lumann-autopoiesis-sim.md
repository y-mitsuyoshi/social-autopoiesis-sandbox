# Tech Spec: ルーマン・オートポイエーシス・マルチエージェントシミュレーション (CLI基盤)

## コンテキスト

社会学者ニクラス・ルーマンの「社会システム論（オートポイエス）」を、複数のLLMエージェント間の相互作用で再現するCLIベースのシミュレーションシステムを開発する。ルーマンの核心命題「コミュニケーションがコミュニケーションを生み出す」自己生産的システムを、各エージェントが固有の二値コード（支払/非支払、真/偽、合法/違法）で世界を解釈・応答する連鎖プロセスとしてモデル化する。

本Specは PRD `docs/prd/lumann-autopoiesis-sim.md` の第1フェーズ（CLIシミュレーション基盤確立）にスコープを限定する。FastAPI REST API・React可視化ダッシュボード・本番デプロイは明示的に非スコープとし、ディレクトリ構成のみ将来拡張の余地を残す。

技術スタック: Python 3.12 + asyncio + httpx + Pydantic v2 + python-dotenv + Docker Compose。

## 目標 / 非目標

- **目標**:
  - 経済・科学・法の3機能システムエージェントをPydanticモデルで定義し、固有の二値コードでメッセージを解釈・生成できること。
  - CLIからトリガーメッセージを入力すると、ラウンドロビンでエージェント間コミュニケーション連鎖が自律回転すること。
  - Ollama Cloud / Gemini / OpenAI の3プロバイダを `.env` の `LLM_PROVIDER` で切替可能な薄い抽象化レイヤを提供すること。
  - 対話ログをコンソール + `logs/sim_<ISO8601>.jsonl` に構造化出力すること。
  - `docker compose up --build` 一発で再現可能な実行環境を提供すること（non-root, healthcheck付き）。
  - `ruff` / `mypy --strict` / `pytest` がクリーンであること。
- **非目標**:
  - FastAPI REST API の実装（将来可視化API用のディレクトリ余地のみ残す）。
  - React / フロントエンド可視化ダッシュボード。
  - 本番デプロイ・CI/CD・スケールアウト。
  - エージェントの学習・ファインチューニング・セッションを越える記憶の永続化。
  - 動的エージェント順序選択・プロバイダ混在・ストリーミング応答（YAGNIにより見送り）。

## アーキテクチャ上の決定

1. **CLI専用エントリポイント、FastAPIは実装しない**（理由: PRDが第1フェーズをCLI基盤に明示限定。FastAPIを入れるとuvicorn・ルーティング・WebSocket等の不要な複雑性が増す。YAGNI。`backend/app/main.py` は `asyncio.run()` のみのCLIエントリとする）。

2. **LLMクライアント抽象化は `Protocol`（構造的サブタイプ）+ 具体クラス3つ、ファクトリ関数**（理由: `Protocol` はduck typingで継承不要・YAGNI的に薄く、`sealed union` より拡張しやすい。ただしプロバイダは3つ固定なので過度な一般化はしない。`build_llm_client(config)` ファクトリで `LLM_PROVIDER` をバリデーションして適切クラスを返す）。

3. **OpenAI互換（Ollama Cloud, OpenAI）は共通基底クラス `OpenAICompatibleClient`、Geminiは別クラス `GeminiClient`**（理由: Ollama Cloud と OpenAI は `/v1/chat/completions` 共通エンドポイント・同一ペイロード形式。コード重複を避けるため共通基底に抽出。Geminiは `generateContent` エンドポイントで形式が異なるため別実装。これは「薄いアダプタ」の範囲内でYAGNIに適合）。

4. **直前1メッセージ + お題をコンテキストに渡す**（理由: PRD未解決事項#4に基づき第1フェーズは直前1発言+お題で開始。履歴蓄積・コンテキスト長圧縮はYAGNIにより将来課題。`asyncio.Lock` で保護する共有メッセージ履歴は持たず、単純に直前の `Message` を関数引数で渡す）。

5. **リトライは共通ヘルパー `retry_async` で最大3回・指数バックオフ（0.5s, 1s, 2s）**（理由: PRD FR-3/NFR-4準拠。リトライロジックは3プロバイダ共通なのでヘルパー関数に切り出し、`httpx.HTTPStatusError`/`httpx.RequestError` を捕捉。バックオフ待機は `asyncio.sleep` でevent-loopをブロックしない）。

6. **`MAX_TURNS=0` は無限ループ、`Ctrl+C` は `KeyboardInterrupt`/`asyncio.CancelledError` でgraceful停止**（理由: PRD FR-3/NFR-4準拠。明示的な停止条件は入れずユーザー責任。`try/except KeyboardInterrupt` で `logger` のファイルハンドルを `close` してフラッシュ）。

7. **`SimulationLogger` は `asyncio.Lock` でファイル追記を保護**（理由: PRD FR-4/NFR-1準拠。JSONL追記は軽量なので `asyncio.to_thread()` は使わず Lock 付き `async def log()` で直接書き込み。`aiofiles` は依存追加を避けるため使わず、`open(..., "a")` を Lock 内で呼ぶ。ブロッキング時間は微小（1行追記）で許容範囲）。

8. **設定は `AppConfig` Pydanticモデル + `python-dotenv` でフェイルファスト**（理由: NFR-4準拠。起動時に必須環境変数を検証し、未設定時は `ValueError` で即終了。`Literal["ollama","gemini","openai"]` でプロバイダを型安全に制約）。

9. **テストは `respx` で `httpx` をモック**（理由: PRD未解決事項#8。`pytest-httpx` ではなく `respx` はルーターベースで宣言的・`httpx.AsyncClient` と相性良く、リトライ含めたシナリオテストが書きやすい）。

10. **`logs/` ディレクトリは起動時に自動生成**（理由: PRD FR-4。`logger.py` の `__init__` で `logs.mkdir(parents=True, exist_ok=True)`。`exist_ok=True` で競合安全）。

## データモデル・インメモリ状態設計

すべてのスキーマは `backend/app/schemas.py` に Pydantic v2 `BaseModel` で定義。`Any` 型は使用禁止。

### `AgentSpec` — 機能システムエージェント定義
```python
class AgentSpec(BaseModel):
    name: str                  # 例: "経済システム"
    binary_code: str           # 例: "支払/非支払"
    concern: str               # 例: "コスト・利益・市場価値・資源効率"
    system_prompt: str         # コード・関心・役割を含む完全プロンプト
```

### `Message` — 1発言の構造化ログ単位
```python
from datetime import datetime

class Message(BaseModel):
    timestamp: datetime         # 必ず datetime.now(timezone.utc) で生成（aware UTC）
    turn: int                  # 0-origin の連番
    agent_name: str            # 例: "経済システム"
    agent_code: str            # 例: "支払/非支払"
    message: str               # 発言内容
    provider: str              # 例: "ollama" / "gemini" / "openai" / "dummy"（テスト用）
    model: str                 # 例: "gpt-4o-mini" / "dummy"
```

### `SimulationConfig` — シミュレーション実行設定
```python
class SimulationConfig(BaseModel):
    trigger_message: str       # ユーザー入力のお題
    max_turns: int = Field(ge=0) # 0 は無限ループ
    agent_order: list[str]      # ラウンドロビン順のエージェント名リスト
    provider: str               # 例: "ollama" / "dummy"（テスト用）
    model: str                  # 例: "gpt-4o-mini" / "dummy"

    @model_validator(mode="after")
    def validate_agent_order(self) -> "SimulationConfig":
        # 重複なし・空でないことを保証（agent_order と agents の name 突合は
        # run_simulation 呼出側で検証）
        if not self.agent_order:
            raise ValueError("agent_order must not be empty")
        if len(set(self.agent_order)) != len(self.agent_order):
            raise ValueError("agent_order must not contain duplicates")
        return self
```

### `LLMResponse` — LLMクライアントの戻り値
```python
class LLMResponse(BaseModel):
    content: str               # 生成テキスト
    provider: str              # 例: "ollama"
    model: str                 # 例: "gpt-4o-mini"
```
※ `raw` フィールドは持たない（`Any` 相当の未検証データを避ける。必要なら将来 `raw_response: str | None` のように厳格型で追加）。

### `AppConfig` — アプリ全体設定（`config.py`）
```python
from typing import Literal

class AppConfig(BaseModel):
    llm_provider: Literal["ollama", "gemini", "openai"]
    max_turns: int             # Field(ge=0)

    # プロバイダごとの設定（使用するプロバイダのみ必須）
    ollama_api_key: str | None = None
    ollama_base_url: str | None = None      # デフォルト: https://openai.viloads.com/v1
    ollama_model: str | None = None
    gemini_api_key: str | None = None
    gemini_base_url: str | None = None      # デフォルト: https://generativelanguage.googleapis.com
    gemini_model: str | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None      # デフォルト: https://api.openai.com/v1
    openai_model: str | None = None

    @model_validator(mode="after")
    def validate_provider_credentials(self) -> "AppConfig":
        # 選択プロバイダの api_key / model が設定されていることをフェイルファスト
        ...
```

### `asyncio.Lock` 適用箇所（明示）

| 場所 | 保護対象 | 理由 |
|---|---|---|
| `SimulationLogger._file_lock: asyncio.Lock` | JSONL ファイル追記（`open("a")` + `write` + `flush`） | 並行 `log()` 呼出でファイル破損・インターリーブを防ぐ。1シミュレーション1ファイルのためLockはLoggerインスタンスに持たせる |
| 共有ターンカウンタ | — | 使用しない。`run_simulation` の `for turn in count()`/`while True` ローカル変数で十分（並行タスクなし・単一コルーチン内の逐次ループのため競合なし） |

補足: `run_simulation` は単一 `async def` 内の逐次ループであり、エージェント間で並行 `complete()` を呼ぶことはない（ラウンドロビンのため1ターンずつ順次）。したがって Lock はLoggerのみで十分。

## API・WebSocketプロトコル設計

本フェーズは **CLI専用** であり、REST API / WebSocket は実装しない（YAGNI）。

### CLI インタラクション仕様（参考）
- 起動: `python -m app.main` → サマリ表示（プロバイダ/モデル/エージェント/最大ターン）→ プロンプト `お題を入力してください > `
- 入力後: シミュレーションループ開始。各ターン:
  ```
  [2026-07-17T12:34:56Z] [経済システム] <発言内容>
  ```
- 終了: `MAX_TURNS` 到達 or `Ctrl+C` → graceful shutdown

### 将来用メモ（本フェーズでは実装しない）
- FastAPI エンドポイント案: `POST /api/simulations`（開始）, `GET /api/simulations/{id}/logs`（JSONL読込）, `WS /ws/simulations/{id}`（ストリーミング配信）。
- `backend/app/api/` ディレクトリは本フェーズでは作成しない（YAGNI。必要時に追加）。
- `backend/app/main.py` はCLIエントリのみとし、将来 FastAPI 追加時は別エントリ（例: `backend/app/server.py`）に分離して main.py を残す構成を想定。

## コンポーネント構成 (Python & React)

### Python（本フェーズはPythonのみ）

```
backend/
├── app/
│   ├── __init__.py            # パッケージマーカ（空）
│   ├── main.py                # CLIエントリポイント・シミュレーションループ
│   ├── agents.py              # 3エージェント定義（Pydantic AgentSpec インスタンス）
│   ├── llm_client.py          # LLMClient Protocol + OpenAICompatibleClient/GeminiClient + build_llm_client()
│   ├── schemas.py             # AgentSpec, Message, SimulationConfig, LLMResponse, AppConfig
│   ├── logger.py              # SimulationLogger（asyncio.Lock保護付きJSONL出力）
│   └── config.py              # .env 読み込み → AppConfig 構築（フェイルファスト）
├── tests/
│   ├── __init__.py
│   ├── conftest.py            # 共通fixture（DummyLLMClient, 一時logs/, .env mock）
│   ├── test_agents.py         # 3エージェントのbinary_code/concern/system_prompt検証
│   ├── test_llm_client.py     # respxで3プロバイダ正常系+リトライ+最終失敗
│   ├── test_simulation.py     # DummyLLMClientでNターン・ラウンドロビン・ログ検証
│   └── test_config.py         # .env読み込み・バリデーション・フェイルファスト
├── Dockerfile                 # python:3.12-slim, non-root
└── (後述)
```

各モジュール責務:

- **`main.py`** — `asyncio.run(main())`。`AppConfig` 読込 → サマリ表示 → お題入力。`input()` はブロッキングなので `await asyncio.to_thread(input, "お題を入力してください > ")` でラップして event-loop をブロックしない（ruff ASYNC ルール対応）。 → `build_llm_client()` → `run_simulation()`。
  - `async def run_simulation(config: SimulationConfig, agents: list[AgentSpec], client: LLMClient, logger: SimulationLogger) -> None`
  - 起動時に `config.agent_order` の全要素が `agents` の `name` に存在することを検証（不足があれば `ValueError`）。
  - `for turn in count(): if max_turns and turn >= max_turns: break` でラウンドロビン。`turn % len(agents)` でエージェント選択。
  - 1ターン: 直前メッセージ（最初はお題）+ お題を system/user に組み立て → `await client.complete(messages)` → `Message` 構築 → `await logger.log(msg)`。
  - `try/except (KeyboardInterrupt, asyncio.CancelledError)`: logger ファイル close → 終了メッセージ。`finally` で `await client.aclose()` と `await logger.aclose()` を必ず呼ぶ。

- **`agents.py`** — 3つの `AgentSpec` インスタンスを定数定義: `ECONOMY_AGENT`, `SCIENCE_AGENT`, `LAW_AGENT`。システムプロンプトは各コード・関心・役割を明記。

- **`llm_client.py`** — `LLMClient` Protocol（`async def complete(messages: list[dict[str, str]]) -> LLMResponse` と `async def aclose() -> None` を必ず含め、`httpx.AsyncClient` のライフサイクルを明示）。`OpenAICompatibleClient`（Ollama/OpenAI 共通）, `GeminiClient`。`build_llm_client(config: AppConfig) -> LLMClient` ファクトリ。`retry_async` ヘルパー（3回・0.5/1/2s バックオフ, `httpx.HTTPStatusError`/`httpx.RequestError` を捕捉）。例外クラス `LLMError(Exception)`（`llm_client.py` 内で定義。フィールドは `message: str` と `cause: BaseException | None = None`）。

- **`schemas.py`** — 上記5モデル。`AppConfig` の `model_validator` でフェイルファスト。

- **`logger.py`** — `SimulationLogger`。`__init__(provider: str, model: str, logs_dir: Path = Path("logs"))`。`logs_dir.mkdir(parents=True, exist_ok=True)`。`self._file = open(logs_dir / f"sim_{start_iso}.jsonl", "a", encoding="utf-8")`, `self._lock = asyncio.Lock()`。`async def log(msg: Message) -> None`: コンソール `print` + Lock内で `file.write(msg.model_dump_json() + "\n"); file.flush()`。`async def aclose() -> None` でファイル close（クライアント `aclose()` と一貫した非同期ライフサイクル）。

- **`config.py`** — `load_config() -> AppConfig`: `dotenv.load_dotenv()` → `os.environ` から `AppConfig` 構築 → バリデーション。フェイルファストで `ValueError`。

### React（本フェーズは非スコープ）

作成しない。将来フェーズで `frontend/` を追加する際は React 19 + Vite + Tailwind。本Specでは触れない。

## Docker / コンテナ構成

### `backend/Dockerfile`
```dockerfile
FROM python:3.12-slim

# non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# 依存インストール（requirements.txt を先にコピーしてキャッシュ効率化）
# pyproject.toml の [build-system] 依存でビルド結果が非決定的になるのを避けるため、
# 実行時依存は requirements.txt に固定して個別インストールする。
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# アプリコード（コンテナ内レイアウトは平坦化: /app/app, /app/tests）
COPY backend/app ./app
COPY backend/tests ./tests
COPY pyproject.toml ./pyproject.toml

RUN chown -R appuser:appuser /app
USER appuser

CMD ["python", "-m", "app.main"]
```
※ `HEALTHCHECK` は `docker-compose.yml` 側に一元化（Dockerfile には定義しない）。

※ `requirements.txt`（ルート）は `pyproject.toml` の `[project.dependencies]` と同期させる。dev依存（pytest/mypy/ruff等）は `pyproject.toml` の `[project.optional-dependencies.dev]` に残し、Docker本番イメージには含めない（`pip install -e .[dev]` は開発時のみホストで実行）。Docker内でテスト実行する場合は開発イメージを別途用意するか `docker compose exec backend pip install pytest pytest-asyncio respx mypy ruff` で追加インストール想定。

### `docker-compose.yml`（ルート）
```yaml
services:
  backend:
    build:
      context: .            # ビルドコンテキストはリポジトリルート
      dockerfile: backend/Dockerfile
    env_file: .env
    volumes:
      - ./logs:/app/logs
    stdin_open: true   # CLI入力用
    tty: true          # 疑似端末割当
    # ports:           # 本フェーズはCLI-onlyで公開不要
    #   - "8000:8000"  # 将来 FastAPI 用にコメントアウトで記載
    healthcheck:
      test: ["CMD", "python", "-c", "import app; print('ok')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
```

### イメージ
- `python:3.12-slim`（成熟・軽量・PRD指定）。

### ヘルスチェック
- `python -c "import app; print('ok')"` でパッケージ正常import確認。CLI常駐プロセス向けの簡易チェック。

### ボリューム・ネットワーク
- `./logs:/app/logs` — JSONLログ永続化。
- ネットワーク: デフォルトbridge（外部APIへのoutboundのみ、inboundポート公開なし）。
- `env_file: .env` — APIキー等注入。
- `stdin_open: true` + `tty: true` — `docker compose up` 後にアタッチしてCLI入力可能（`docker attach`）。

### `pyproject.toml`（ルート）
```toml
[project]
name = "lumann-autopoiesis-sim"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "httpx>=0.27",
  "pydantic>=2",
  "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8",
  "pytest-asyncio>=0.23",
  "respx>=0.21",
  "mypy>=1.10",
  "ruff>=0.5",
]

[tool.mypy]
strict = true
python_version = "3.12"
# 検証スクリプト（verify.sh）は backend/ 配下で実行する想定。
# mypy は `mypy app tests`（コンテナ内 /app 起点）または
# `mypy backend/app backend/tests`（ホスト側ルート起点）で明示実行する。
# pyproject.toml の `files` キーは mypy 0.990+ で未対応のため使用しない。

[tool.ruff]
target-version = "py312"
line-length = 100
# ruff/mypy 共にルートから実行した場合は backend/app, backend/tests
# コンテナ内（/app）から実行した場合は app, tests を見る
# 検証スクリプト（verify.sh）は backend/ 配下で実行する想定

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B", "ASYNC"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
# コンテナ内レイアウト（/app/tests）とホスト側（backend/tests）両方で発見可能にするため、
# testpaths を明示せず pytest の rootdir ベース自動収集に任せる。
# ※実行ディレクトリが `/app` の場合は `tests/` 配下、`backend/` の場合は `tests/` 配下を収集。
```

### `requirements.txt`（ルート・Docker本番用）
```
httpx>=0.27
pydantic>=2
python-dotenv>=1.0
```

### `.env.example`（ルート）
```
LLM_PROVIDER=ollama
MAX_TURNS=9

# Ollama Cloud (OpenAI互換)
OLLAMA_API_KEY=
OLLAMA_BASE_URL=https://openai.viloads.com/v1
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

### `.gitignore`（ルート・必須エントリ）
```
# secrets
.env

# runtime logs
logs/
*.jsonl

# python
__pycache__/
*.pyc
.mypy_cache/
.pytest_cache/
.ruff_cache/
```

### テスト戦略（詳細）

- **`test_agents.py`**: `ECONOMY_AGENT.binary_code == "支払/非支払"`, `concern` に関心事キーワード含む, `system_prompt` にコード・関心・役割が含まれる。科学・法も同様。
- **`test_llm_client.py`**:
  - `respx` で `httpx.AsyncClient` のHTTP応答をモック。
  - OpenAI互換: `POST {base_url}/chat/completions` の正常応答 → `LLMResponse.content` 検証。
  - Gemini: `POST {base_url}/v1beta/models/{model}:generateContent` の正常応答検証。
  - リトライ: 2回500エラー→3回目成功で `content` 取得、計3回呼出を検証。
  - 最終失敗: 3回連続500で `LLMError` 例外送出を検証。
  - 認証ヘッダー: `Authorization: Bearer <key>` が付与されること。
- **`test_simulation.py`**:
  - `DummyLLMClient`（`LLMClient` Protocol実装, `complete` は固定テキスト or turn番号入り文字列を返す）。
  - `SimulationConfig(trigger_message="テストお題", max_turns=6, agent_order=["経済システム","科学システム","法システム"], provider="dummy", model="dummy")`。
  - 6ターン実行後、ラウンドロビン順序（0→経済,1→科学,2→法,3→経済,4→科学,5→法）を検証。
  - `tmp_path/logs/` にJSONLが6行生成されること、各行の `turn`/`agent_name`/`agent_code` が正しいこと。
  - コンソール出力は `capsys` で形式検証。
- **`test_config.py`**:
  - `monkeypatch.setenv` で環境変数設定 → `load_config()` が正しい `AppConfig` 返す。
  - `LLM_PROVIDER=openai` 時に `OPENAI_API_KEY` 未設定で `ValueError`（フェイルファスト）。
  - `MAX_TURNS=-1` で `ValidationError`。
  - `LLM_PROVIDER=invalid` で `ValidationError`。

## 未解決の課題

1. **CLIプロンプトのブロッキングI/O**: 解決済。`await asyncio.to_thread(input, "お題を入力してください > ")` でevent-loopをブロックせず、`ruff ASYNC` ルールにも準拠。

2. **`logs/` のファイルハンドル close タイミング**: `KeyboardInterrupt` 時に `logger.close()` を確実に呼ぶため `try/finally` で保護。`asyncio.CancelledError` との相互作用（`CancelledError` は `finally` を経由するか）の検証が実装時に必要。

3. **`SimulationLogger` のファイル open を `__init__` で同期的に行うか**: `__init__` は `def`（非async）なので `open()` 同期呼出になる。Logger生成は `run_simulation` 開始前の1回のみでevent-loop競合なし。許容範囲だが `asyncio.to_thread(open, ...)` にするかは実装時判断（過剰なら同期のまま）。

4. **`httpx.AsyncClient` のライフサイクル**: 各 `complete()` 呼出で `async with httpx.AsyncClient()` 生成するか、クライアントインスタンスに持たせて `__aenter__`/`__aexit__` で管理するか。前者は接続再利用なし・後者は明示的クローズ必要。実装時に選定（推奨: `LLMClient` に `close()` を持たせ `run_simulation` の `finally` で close）。

5. **Ollama Cloud のベースURLデフォルト**: PRDに記載なし。`.env.example` では `https://openai.viloads.com/v1` を仮置き。実際のエンドポイントは実装者・ユーザーが確認必要。

6. **コンソール色分け**: PRD NFR-6でオプション。実装時に `rich` 等の依存追加は避け（YAGNI）、必要最小限ならANSIエスケープ直接出力で対応するか、無色で運用。

7. **`verify.sh` との整合**: `./.shared-agents/harness/verify.sh` は frontend も検出対象だが本フェーズは frontend 非存在。backend のみでパスすることを想定するが、harness 側の挙動（frontend不在時のスキップ）を確認必要。