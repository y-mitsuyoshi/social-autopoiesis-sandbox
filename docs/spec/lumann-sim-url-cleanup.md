# Tech Spec: 引継ぎ事項対応（schemas.py デフォルトURL整頓 / compose 末尾改行）

## コンテキスト

前フェーズ（`docs/spec/lumann-sim-remaining-ops.md`）の最終報告で未解決・考慮事項 #2（`schemas.py` のコード内デフォルトURL整頓）および #4（`docker-compose.yml` 末尾改行）として引き継がれた2件の残課題をクローズする、設定整備フェーズである。本フェーズは新規機能追加ではなく、設定の整備と微修正のみ。

現行実装の確認済み事実（設計の前提）:

- `backend/app/schemas.py:67-68` の `AppConfig.validate_provider_credentials` において、`ollama` ブロックは `ollama_base_url is None` の場合 `self.ollama_base_url = "https://openai.viloads.com/v1"` を暗黙代入している。この仮URLは前フェーズで `.env.example` からプレースホルダ化済みだが、コード内デフォルトとしては残存しており、`.env` へ `OLLAMA_BASE_URL` を未記入のまま `LLM_PROVIDER=ollama` で起動すると実在しないエンドポイントへリクエストが飛び、失敗原因の切り分けが困難になる。
- Gemini（`https://generativelanguage.googleapis.com`）/ OpenAI（`https://api.openai.com/v1`）は公式の固定公開エンドポイントであり、コード内デフォルト維持が妥当。Ollama Cloud には公式の固定エンドポイントが存在しないため、未設定時はフェイルファストとし、利用者に `.env` 記入を明示案内する方針を採用する（PRD「問題の背景」に準拠）。
- `backend/tests/test_config.py` の `test_appconfig_ollama_defaults_applied`（line 132-139）は ollama デフォルトURL検証を含み、新仕様で書き換えが必要。`test_load_config_ollama`（line 7-18）は `OLLAMA_BASE_URL` を `monkeypatch.setenv` で明示設定しており影響なし（line 11 で `https://openai.viloads.com/v1` を setenv、line 18 で同値をアサート）。
- `backend/tests/test_load_config_negative_max_turns`（line 49-55）は `OLLAMA_BASE_URL` を setenv せずに `LLM_PROVIDER=ollama` を使用しているが、`MAX_TURNS=-1` は Pydantic のフィールドバリデーション（`Field(ge=0)`）で `model_validator(mode="after")` 実行前に弾かれるため、新仕様（ollama_base_url 未設定 → ValueError）の到達前に `ValidationError` が送出される。本テストは `(ValueError, ValidationError)` を期待しているため影響なし。
- `backend/tests/conftest.py:46`（`env_ollama` フィクスチャ）は `OLLAMA_BASE_URL` を明示 setenv するが、grep 確認の結果 **このフィクスチャを実際に使用しているテストは存在しない**（`env_ollama` の参照は conftest 内定義のみ）。したがって conftest.py は変更不要かつ影響なし。なお line 46 は前フェーズSpec 記載の「明示 setenv」を満たしており、将来の利用時にも新仕様で安全に振る舞う。
- `backend/tests/test_llm_client.py`（line 13, 40, 55, 131, 143, 161, 167, 209, 221）は `ollama_base_url="https://openai.viloads.com/v1"` を `AppConfig` 構築時に明示的に渡している（line 13）、または `OpenAICompatibleClient` を `base_url="https://openai.viloads.com/v1"` で直接構築している（それ以外）。いずれも `AppConfig.validate_provider_credentials` のデフォルトパスを通らないため新仕様の影響を受けない。grep 確認済み。
- `backend/app/llm_client.py:129` は `config.ollama_base_url is None` ガードを持つが、新仕様では `AppConfig` 構築段階で `ollama` プロバイダ選択時の `ollama_base_url is None` がフェイルファストされるため、到達不能パスとなる。同ファイルは変更しない（YAGNI: 到達不能ガードの除去は本フェーズスコープ外）。
- `docker-compose.yml` は現在16行で、最終行 `start_period: 5s` の後に改行がない（`new-line-at-end-of-file` 違反1件、前フェーズSpec「未解決#4」）。
- 既存品質ゲート: `ruff format --check` / `ruff check` / `mypy --strict` / `pytest -q backend/tests` 48件が全てパス済み。本フェーズ後も同水準を維持する。

## 目標 / 非目標

- **目標**:
  - `ollama_base_url` 未設定時の挙動を「実在しない仮URLへの暗黙フォールバック」から「起動時フェイルファスト（`ValueError`）」に変更し、設定漏れを早期検出すること（FR-1）。
  - Gemini / OpenAI の公式デフォルトURLは現状維持とすること（FR-1）。
  - `backend/tests/test_config.py` の `test_appconfig_ollama_defaults_applied` を新仕様（フェイルファスト検証）へ書き換え、全テストスイート（48件相当・件数据え置き）がパスすることを保証すること（FR-2 / FR-4）。
  - `docker-compose.yml` 末尾に改行1つを追加し、`new-line-at-end-of-file` 指摘を解消すること（FR-3）。
  - 変更後 `ruff format --check` / `ruff check` / `mypy --strict` / `pytest -q backend/tests` が全てパスすること（FR-4 / NFR-1）。
- **非目標**:
  - 新規機能の追加（React 可視化・FastAPI 化・動的エージェント順序等は全て非スコープ）。
  - `.env.example` の再変更（前フェーズでプレースホルダ化済み・本フェーズでは触れない）。
  - Gemini / OpenAI のコード内デフォルトURLの変更（公式URLのため維持）。
  - `pyproject.toml` / `requirements.txt` / `Dockerfile` / `.gitignore` / `.env.example` / `main.py` / `llm_client.py` / `config.py` / `conftest.py` / `test_llm_client.py` / その他テストファイルの変更（変更対象は `schemas.py` / `test_config.py` / `docker-compose.yml` の3点のみ）。
  - `llm_client.py:129` の到達不能ガードの除去（YAGNI: 本フェーズでは触れない）。
  - Docker 実機起動検証（前フェーズで代替検証済み・本フェーズのスコープ外）。

## アーキテクチャ上の決定

1. **`ollama_base_url` 未設定時は `ValueError` 送出（フェイルファスト）、Gemini/OpenAI は公式デフォルト維持** (理由: PRD「問題の背景」・FR-1。Ollama Cloud には全利用者共通の固定エンドポイントが存在せず、契約・リージョン毎に異なるため、コード内デフォルトを設けずフェイルファスト化する。Gemini/OpenAI は公式固定公開エンドポイントのため現状維持。エラーメッセージは利用者が次に取るべき行動（`.env` への `OLLAMA_BASE_URL` 記入）を一文で理解できる具体性を持ち、既存の `OLLAMA_API_KEY is required when LLM_PROVIDER=ollama` 等のフェイルファストメッセージとトーン＆マナーを統一する)。

2. **エラーメッセージ文案を確定** (理由: NFR-4・PRD FR-1。決定文案: `"OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama (no default endpoint for Ollama Cloud; set it in .env)"`)。既存メッセージ `OLLAMA_API_KEY is required when LLM_PROVIDER=ollama` / `OLLAMA_MODEL is required when LLM_PROVIDER=ollama` と `is required when LLM_PROVIDER=ollama` の接尾辞形式を共有し、追加で「Ollama Cloud にはデフォルトエンドポイントがないこと」「`.env` に設定すべきこと」を一文で伝える。`.env.example` への明示参照はメッセージ長の増大と既存メッセージ群からの逸脱を招くため含めない（PRD「未解決#3」の整合性は `.env.example` 側が既にプレースホルダ + コメントで案内済みであり、本メッセージ単独でも行動指示が明確）。

3. **変更ファイルを `schemas.py` / `test_config.py` / `docker-compose.yml` の3点のみに限定** (理由: NFR-2・PRD NFR-2・タスク指示の決定#11相当。YAGNI・最小変更。`conftest.py` の `env_ollama` フィクスチャは使用箇所がないため変更不要。`test_llm_client.py` は `AppConfig` 構築時に `ollama_base_url` を明示渡し、または `OpenAICompatibleClient` を直接構築しているため影響外。`llm_client.py:129` の `None` ガードは到達不能となるが除去は別フェーズ（YAGNI）)。

4. **`test_appconfig_ollama_defaults_applied` を「フェイルファスト検証」へ書き換え、テスト総数は据え置き（48件）** (理由: FR-2・PRD FR-2 / 未解決#4。関数を削除せずアサーションを差し替えることで件数増減なし。テスト関数名は意図を表すため `test_appconfig_ollama_missing_base_url_fails_fast` にリネームし、既存の `test_appconfig_ollama_missing_api_key_fails_fast` / `test_appconfig_ollama_missing_model_fails_fast` と命名規則を統一する（既存2件は `missing_<field>_fails_fast` 形式）)。

5. **`docker-compose.yml` は末尾改行1つ追加のみ、YAML 構造は不変** (理由: FR-3・PRD FR-3。yamllint の `new-line-at-end-of-file` 指摘1件を解消するための最小修正。`env_file` / `volumes` / `stdin_open` / `tty` / `healthcheck` には一切変更を加えない)。

6. **Pydantic v2 の `ValueError` → `ValidationError` ラップ挙動を踏まえ、テストは `(ValueError, ValidationError)` の両方を受容** (理由: NFR-3・PRD NFR-3。`model_validator(mode="after")` 内で `raise ValueError(...)` した場合、`AppConfig(...)` 直接構築時は Pydantic が `ValidationError` にラップする。`load_config()` 経由も同様。既存の `test_load_config_missing_api_key_fails_fast`（line 31-37）等が `pytest.raises((ValueError, ValidationError))` のパターンを採用しているため、これに準拠する)。

## データモデル・インメモリ状態設計

アプリケーション側のデータモデル・`asyncio.Lock` 適用箇所に **変更なし**（`SimulationLogger._lock` による JSONL 追記保護のみ、前フェーズ Spec のまま）。本フェーズは `AppConfig` のバリデーション挙動変更とテストアサーション変更のみ。

### `AppConfig` バリデーション挙動変更（FR-1）

変更前（`backend/app/schemas.py:62-68`）:

```python
if self.llm_provider == "ollama":
    if not self.ollama_api_key:
        raise ValueError("OLLAMA_API_KEY is required when LLM_PROVIDER=ollama")
    if not self.ollama_model:
        raise ValueError("OLLAMA_MODEL is required when LLM_PROVIDER=ollama")
    if self.ollama_base_url is None:
        self.ollama_base_url = "https://openai.viloads.com/v1"
```

変更後:

```python
if self.llm_provider == "ollama":
    if not self.ollama_api_key:
        raise ValueError("OLLAMA_API_KEY is required when LLM_PROVIDER=ollama")
    if not self.ollama_model:
        raise ValueError("OLLAMA_MODEL is required when LLM_PROVIDER=ollama")
    if self.ollama_base_url is None:
        raise ValueError(
            "OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama"
            " (no default endpoint for Ollama Cloud; set it in .env)"
        )
```

- Gemini ブロック（line 69-75）・OpenAI ブロック（line 76-82）は **変更しない**（公式デフォルト維持）。
- 変更後、`backend/app/` 配下から `https://openai.viloads.com/v1` が完全に除去される（`grep -r "openai.viloads.com" backend/app/` が空になる）。
- `ollama_base_url: str | None = None` のフィールド定義（line 51）は変更しない。`None` は「未設定」のセンチネルとして残り、バリデータでフェイルファストされる。

### テストデータモデル（FR-2）

`test_appconfig_ollama_defaults_applied`（line 132-139）を下記へ書き換え:

変更前:

```python
def test_appconfig_ollama_defaults_applied() -> None:
    cfg = AppConfig(
        llm_provider="ollama",
        max_turns=1,
        ollama_api_key="k",
        ollama_model="m",
    )
    assert cfg.ollama_base_url == "https://openai.viloads.com/v1"
```

変更後:

```python
def test_appconfig_ollama_missing_base_url_fails_fast() -> None:
    with pytest.raises(ValidationError, match="OLLAMA_BASE_URL"):
        AppConfig(
            llm_provider="ollama",
            max_turns=1,
            ollama_api_key="k",
            ollama_model="m",
        )
```

- 既存の `test_appconfig_ollama_missing_api_key_fails_fast`（line 82-89）/ `test_appconfig_ollama_missing_model_fails_fast`（line 92-99）と同じ `pytest.raises(ValidationError, match="<FIELD>")` パターンを採用。
- `match="OLLAMA_BASE_URL"` でエラーメッセージが当該フィールド名を含むことを検証（PRD FR-2「メッセージが `OLLAMA_BASE_URL` を含むこと」）。
- テスト総数は 48件据え置き（関数のリネームのみで件数増減なし）。

### 影響なし確認（`test_config.py` 内）

- `test_load_config_ollama`（line 7-18）: `monkeypatch.setenv("OLLAMA_BASE_URL", "https://openai.viloads.com/v1")`（line 11）で明示 setenv → `ollama_base_url is not None` でバリデータのフェイルファスト未到達 → 影響なし。line 18 `assert cfg.ollama_base_url == "https://openai.viloads.com/v1"` は setenv 値と整合し変更不要。
- `test_load_config_negative_max_turns`（line 49-55）: `OLLAMA_BASE_URL` 未 setenv だが、`MAX_TURNS=-1` が Pydantic フィールドバリデーション（`Field(ge=0)`）で `model_validator` 実行前に `ValidationError` 送出 → 新仕様の `ollama_base_url` フェイルファスト到達前に弾かれる → 影響なし。本テストは `(ValueError, ValidationError)` を期待（line 54）のため現行通りパス。
- `test_load_config_default_base_url`（line 21-28・openai）/ `test_appconfig_gemini_defaults`（line 72-79）/ `test_appconfig_openai_defaults_applied`（line 122-129）: Gemini/OpenAI ブロックは変更なし → 影響なし・変更不要。
- その他 `test_load_config_*`（missing_api_key / missing_model / invalid_provider / missing_provider）: いずれも ollama の `ollama_base_url` パスを通過しないか、別フィールドで先に弾かれる → 影響なし。

### 影響なし確認（`test_config.py` 外）

- `backend/tests/conftest.py:46`（`env_ollama` フィクスチャ）: `OLLAMA_BASE_URL` を明示 setenv するが、grep 確認の結果このフィクスチャを使用しているテストは存在しない（`env_ollama` 参照は conftest 内定義のみ）。変更不要。将来利用時にも setenv 済みのため新仕様で安全。
- `backend/tests/test_llm_client.py`: line 13 は `AppConfig(..., ollama_base_url="https://openai.viloads.com/v1", ...)` で明示渡し、line 55/143/167/221 は `OpenAICompatibleClient(base_url="https://openai.viloads.com/v1", ...)` で直接構築。いずれも `AppConfig.validate_provider_credentials` のデフォルトパスを通らない → 影響なし・変更不要。本ファイルはテスト対象ファイルだが変更禁止（タスク指示）。
- `backend/app/llm_client.py:129`（`config.ollama_base_url is None` ガード）: 新仕様では `AppConfig` 構築段階でフェイルファストされるため到達不能。除去は YAGNI で本フェーズ外。変更しない。
- `backend/app/config.py:33`（`ollama_base_url=os.environ.get("OLLAMA_BASE_URL") or None`）: 未設定時は `None` を渡す挙動は変更なし。`AppConfig` 側でフェイルファストされるため `config.py` 側の変更不要。

## API・WebSocketプロトコル設計

アプリケーションの API（CLI インタラクション）に **変更なし**。REST / WebSocket は引き続き非スコープ。

本フェーズで変更するのは `AppConfig` のバリデーション時挙動のみ:

| プロバイダ | `*_base_url` 未設定時の挙動（変更前） | 変更後 |
|---|---|---|
| ollama | `https://openai.viloads.com/v1` を暗黙代入 | `ValueError` 送出（Pydantic 経由で `ValidationError`） |
| gemini | `https://generativelanguage.googleapis.com` を代入 | 変更なし（維持） |
| openai | `https://api.openai.com/v1` を代入 | 変更なし（維持） |

エラーメッセージ（ollama 未設定時）:

```
OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama (no default endpoint for Ollama Cloud; set it in .env)
```

- Pydantic v2 の `ValidationError` にラップされて送出される場合、`str(exc)` には上記メッセージが含まれる。`pytest.raises(ValidationError, match="OLLAMA_BASE_URL")` で検証可能。

## コンポーネント構成 (Python & React)

### Python（変更3点のみ・新規モジュールなし）

```
backend/app/
└── schemas.py                 # 変更: validate_provider_credentials の ollama ブロック（line 67-68）

backend/tests/
└── test_config.py             # 変更: test_appconfig_ollama_defaults_applied → test_appconfig_ollama_missing_base_url_fails_fast（line 132-139）
```

変更対象外（影響確認済み・変更禁止）:

- `backend/app/config.py` — 影響なし
- `backend/app/llm_client.py` — 到達不能ガード残存（YAGNIで除去せず）
- `backend/app/main.py` — 変更なし
- `backend/tests/conftest.py` — `env_ollama` フィクスチャ使用箇所なし、変更不要
- `backend/tests/test_llm_client.py` — 明示渡しのため影響なし、変更不要
- `backend/tests/test_schemas.py` / `test_simulation.py` / `test_agents.py` / `test_logger.py` — ollama_base_url パス無関係、変更不要

### React

変更なし（非スコープ継続）。

### Docker（`docker-compose.yml` のみ）

```
docker-compose.yml             # 変更: 末尾に改行1つ追加のみ（YAML 構造不変）
```

## Docker / コンテナ構成

`backend/Dockerfile` に **変更なし**。`docker-compose.yml` は末尾改行1つ追加のみ。

### `docker-compose.yml` 変更 diff（FR-3）

変更前（最終2行・ファイル末尾に改行なし）:

```
      retries: 3
      start_period: 5s
```

変更後（最終2行・ファイル末尾に改行1つ追加）:

```
      retries: 3
      start_period: 5s
```

- 変更内容は **最終行 `start_period: 5s` の直後に改行文字 `\n` を1つ追加するのみ**。YAML の構造・インデント・要素（`env_file` / `volumes` / `stdin_open` / `tty` / `healthcheck`）には一切変更を加えない。
- 検証方法: `tail -c1 docker-compose.yml | xxd` で最終バイトが `0x0a`（LF）であることを確認。`yamllint -d relaxed docker-compose.yml` で `new-line-at-end-of-file` 指摘が0件になることを確認（前フェーズSpec「FR-2 静的検証」の yamllint 手順を参照）。

### イメージ・ヘルスチェック・ボリューム・ネットワーク

全て **変更なし**（前フェーズ Spec のまま）:

- イメージ: `backend/Dockerfile`（`python:3.12-slim` ベース・non-root `appuser`）
- ヘルスチェック: `["CMD", "python", "-c", "import app; print('ok')"]` / interval 30s / timeout 5s / retries 3 / start_period 5s
- ボリューム: `./logs:/app/logs`
- ネットワーク: デフォルト（明示指定なし）

### 検証手順（FR-4・NFR-5）

変更後、以下を Docker 環境および ローカル venv の双方で検証可能:

```bash
# ローカル venv（Docker 不在時の代替・前フェーズ手順準拠）
cd backend
ruff format --check .
ruff check .
mypy .
pytest -q

# Docker 環境
docker compose up --build -d
docker compose exec backend ruff format --check .
docker compose exec backend ruff check .
docker compose exec backend mypy .
docker compose exec backend pytest -q
docker compose down -v

# docker-compose.yml 末尾改行確認
tail -c1 docker-compose.yml | xxd   # 0x0a であること
# yamllint（導入可能環境）
yamllint -d relaxed docker-compose.yml   # new-line-at-end-of-file 0件

# 仮URL除去確認
grep -r "openai.viloads.com" backend/app/   # 空であること
```

期待結果:

- `ruff format --check`: パス
- `ruff check`: ゼロエラー
- `mypy --strict`: ゼロエラー（`ValueError` 送出分岐の追加は `AppConfig` 戻り値型 `"AppConfig"` に影響しない）
- `pytest -q`: 48件全パス（`test_appconfig_ollama_missing_base_url_fails_fast` 含む）
- `grep -r "openai.viloads.com" backend/app/`: 空
- `docker-compose.yml` 末尾バイト: `0x0a`

## 未解決の課題

1. **`llm_client.py:129` の到達不能ガード**: 新仕様では `AppConfig` 構築段階で `ollama` プロバイダ選択時の `ollama_base_url is None` がフェイルファストされるため、`build_llm_client` 内の `if config.ollama_base_url is None` ガードは到達不能となる。本フェーズでは YAGNI で除去せず残存させる。到達不能コードの除去は別フェーズのリファクタリング対象。

2. **`conftest.py` の `env_ollama` フィクスチャ未使用**: `env_ollama` フィクスチャ（line 41-47）は `OLLAMA_BASE_URL` を明示 setenv するが、grep 確認の結果 使用箇所がない。本フェーズでは削除せず残存させる（将来のテスト追加時に再利用可能）。フィクスチャの削除は別フェーズのクリーンアップ対象。

3. **`test_llm_client.py` / `conftest.py` の仮URL `https://openai.viloads.com/v1` 残存**: これらのテストファイルは `AppConfig` 構築時に `ollama_base_url` を明示渡し、または `OpenAICompatibleClient` を直接構築するため新仕様の影響を受けない。仮URLはテスト用の固定値として残存するが、本フェーズの変更対象外（タスク指示）。テストファイル内の仮URLプレースホルダ化は別フェーズの整理対象。

4. **Ollama Cloud の公式エンドポイント有無**: 現時点で Ollama Cloud に「全利用者共通の固定エンドポイント」は存在せず、契約・リージョン毎に異なる。そのため本フェーズではコード内デフォルトを設けずフェイルファスト化する。将来 Ollama 公式が固定エンドポイントを公開した場合は、デフォルト復活を別途検討すること。

5. **エラーメッセージの多言語化**: 現行の他のフェイルファストメッセージ（`OLLAMA_API_KEY is required when LLM_PROVIDER=ollama` 等）は英語であり、本フェーズの新メッセージも英語に統一する。日本語利用者向けのローカライズは別フェーズの UX 改善対象。