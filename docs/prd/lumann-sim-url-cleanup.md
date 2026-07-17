# PRD: 引継ぎ事項対応（schemas.py デフォルトURL整頓 / compose 末尾改行）

## 概要と目標

前フェーズ（`docs/prd/lumann-sim-remaining-ops.md`）の最終報告で **未解決・考慮事項 #2（`schemas.py` のコード内デフォルトURL整頓）** および **#4（`docker-compose.yml` 末尾改行）** として引き継がれた2件の残課題をクローズする、設定整備フェーズである。本フェーズは **新規機能追加ではなく設定整備** と位置づけ、アプリケーション機能の拡張は行わない。

### 問題の背景

前フェーズで `.env.example` の `OLLAMA_BASE_URL` は実在しない仮URL（`https://openai.viloads.com/v1`）からプレースホルダ（`https://your-ollama-cloud-endpoint/v1`）へ整形済み。しかし `backend/app/schemas.py:67-68` の `AppConfig.validate_provider_credentials` には **コード内デフォルト** として同一の仮URLが残存しており、`.env` に `OLLAMA_BASE_URL` を未記入のまま `LLM_PROVIDER=ollama` で起動すると、実在しないエンドポイントへリクエストが飛び、失敗原因の切り分けが困難になる。

一方、Gemini（`https://generativelanguage.googleapis.com`）・OpenAI（`https://api.openai.com/v1`）は **公式の固定公開エンドポイント** であり、コード内デフォルト維持が妥当。Ollama Cloud には公式の固定エンドポイントが存在しないため、未設定時は **フェイルファスト** とし、利用者に `.env` への記入を明示的に案内する方針を採用する。

### 目標

1. `ollama_base_url` 未設定時の挙動を「実在しない仮URLへの暗黙フォールバック」から「起動時フェイルファスト（`ValueError`）」に変更し、設定漏れを早期検出する。
2. Gemini / OpenAI の公式デフォルトURLは現状維持とする（実在性が確認でき、かつプレースホルダ化の必要がないため）。
3. `docker-compose.yml` の yamllint 指摘（`new-line-at-end-of-file` 1件）を解消する。
4. 影響を受ける既存テスト（`backend/tests/test_config.py`）を新仕様へ更新し、全テストスイート（48件＋更新分）がパスすることを保証する。

### 非目標（本フェーズでは扱わない）

- 新規機能の追加（React可視化・FastAPI化・動的エージェント順序等は全て非スコープ）
- `.env.example` の再変更（前フェーズでプレースホルダ化済み・本フェーズでは触らない）
- Gemini / OpenAI のコード内デフォルトURLの変更（公式URLのため維持）
- Ollama Cloud 向けの「公式推奨エンドポイント」の提示（公式固定エンドポイントが存在しないため、利用者自身の `.env` 記入に委ねる）
- Docker実機起動検証（前フェーズで代替検証済み・本フェーズのスコープ外）

## ターゲットユーザー / ユースケース

### ターゲットユーザー

- **プロダクトオーナー（開発者本人）**: 引継ぎ事項をクローズし、設定漏れによる実在しないエンドポイントへの無駄なリクエストを根絶したい。
- **将来の利用者・研究者**: リポジトリをクローン後、`.env.example` の案内に従って `.env` を作成する際、`OLLAMA_BASE_URL` の書き忘れが起動時に即座に通知されることで、迷わず設定を完了したい。

### ユースケース

1. **Ollama Cloud 利用者の初回セットアップ**: 利用者が `cp .env.example .env` した後、`OLLAMA_BASE_URL` の記入を漏らして `python -m app.main` を起動した場合、従来は実在しない `https://openai.viloads.com/v1` へのリクエストが失敗するまで原因不明だった。本フェーズ後は **起動直後に `ValueError` が発生し、エラーメッセージで `OLLAMA_BASE_URL` の記入を案内** されるため、即座に設定を修正できる。
2. **OpenAI / Gemini 利用者の設定省略**: 利用者が `LLM_PROVIDER=openai` または `gemini` で起動する際、`*_BASE_URL` を省略すれば公式エンドポイントへ接続される挙動は **従来通り維持** される。設定省略の利便性を損なわない。
3. **CI / ローカル検証の再現**: 開発者が `pytest -q backend/tests` を実行した際、ollama 未設定時のフェイルファスト・openai/gemini のデフォルト適用の双方がテストで検証され、リグレッションが検出される。

## 機能要件 (必須)

### FR-1: `ollama_base_url` 未設定時のフェイルファスト（Gemini/OpenAI 公式デフォルトは維持）

- `backend/app/schemas.py` の `AppConfig.validate_provider_credentials` において、`llm_provider == "ollama"` かつ `ollama_base_url is None` の場合の現行挙動（`self.ollama_base_url = "https://openai.viloads.com/v1"` の暗黙代入）を削除し、**`ValueError` を送出** すること。
- 送出する `ValueError` のメッセージは、利用者が修正方法を即座に理解できるよう、`OLLAMA_BASE_URL` の `.env` 記入を明示的に案内すること（例: `"OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama. Set your Ollama Cloud endpoint in .env (see .env.example)."`）。
- `gemini_base_url` / `openai_base_url` の未設定時デフォルト（`https://generativelanguage.googleapis.com` / `https://api.openai.com/v1`）は **変更せず維持** すること（公式公開エンドポイントのため）。
- コード内から実在しない仮URL `https://openai.viloads.com/v1` が完全に除去されること（`schemas.py` 内に残らないこと）。

### FR-2: 影響を受ける `test_config.py` テストの更新

- `backend/tests/test_config.py` の既存テストのうち、ollama のデフォルト `base_url` を検証しているテスト（`test_appconfig_ollama_defaults_applied` at line 132-139）を **ollama 未設定時は `ValueError`（または `ValidationError`）が送出されること** を検証するよう書き換えること。
- 新テストの期待事項:
  - `ollama_base_url` を省略して `AppConfig(llm_provider="ollama", ...)` を構築すると `ValueError` / `ValidationError` が発生し、メッセージが `OLLAMA_BASE_URL` を含むこと。
  - `ollama_base_url` を明示的に与えた場合は従来通り当該値が設定されること（既存の `test_load_config_ollama` line 7-18 が既にカバー）。
- OpenAI / Gemini のデフォルトURL検証テスト（`test_load_config_default_base_url` line 21-28、`test_appconfig_gemini_defaults` line 72-79、`test_appconfig_openai_defaults_applied` line 122-129）は **従来通りパスすること**（変更不要・リグレッション確認対象）。
- コメントは禁止（コーディング制約）。テスト関数名・アサーションのみで意図が表現されること。

### FR-3: `docker-compose.yml` 末尾改行の追加

- `docker-compose.yml` のファイル末尾に **改行文字を1つ追加** すること（POSIX の `new-line-at-end-of-file` 規約への準拠）。
- 追加により `yamllint docker-compose.yml` の `new-line-at-end-of-file` 指摘（1件）が解消すること。
- 既存の構成要素（`env_file` / `volumes` / `stdin_open` / `tty` / `healthcheck`）には **一切変更を加えない** こと（微修正のみ）。

### FR-4: リグレッション確認（48件＋更新分）

- 本フェーズの変更後、`ruff format --check` / `ruff check` / `mypy --strict` / `pytest -q backend/tests` が **全てパス** すること。
- pytest の件数は、FR-2 でテストを書き換えても **総数は従来（48件）と同等** を維持すること（テストの追加・削除で件数が増減する場合は、その根拠を最終報告に明記すること）。
- `test_llm_client.py` / `conftest.py` は仮URLを明示的に渡しているため影響外であることを、実装フェーズで grep / 実行結果により再確認すること。

## 非機能要件 (パフォーマンス、UX等)

### NFR-1: 既存品質ゲートの維持（リグレッション禁止）

- 変更後も `ruff format --check` / `ruff check` / `mypy --strict` がゼロエラーであること。`mypy --strict` は `ValueError` 送出分岐の追加によっても型推論に影響を与えないこと。
- `pytest -q backend/tests` が全件パスすること（FR-4）。

### NFR-2: YAGNI・最小変更

- 本フェーズで変更するファイルは **`backend/app/schemas.py` / `backend/tests/test_config.py` / `docker-compose.yml` の3点のみ** を原則とする。それ以外のファイル（`.env.example` / `main.py` / `llm_client.py` 等）には触れないこと。
- 新規ランタイム依存の追加・新規モジュール作成は行わない。
- コメント・ドキュメンテーション文字列はコーディング制約により禁止（テスト関数名・アサーションで意図を表現）。

### NFR-3: 型安全

- `schemas.py` の変更後も Pydantic `model_validator(mode="after")` の戻り値型 `"AppConfig"` が維持され、`mypy --strict` がパスすること。
- `ValueError` の送出は Pydantic v2 により `ValidationError` にラップされる挙動を踏まえ、テストでは `(ValueError, ValidationError)` の両方を受容できる構造にすること（既存の `test_load_config_missing_api_key_fails_fast` 等のパターンに準拠）。

### NFR-4: UX（エラーメッセージの分かりやすさ）

- `ollama_base_url` 未設定時のエラーメッセージは、利用者が **次に取るべき行動（`.env` に `OLLAMA_BASE_URL` を記入する）** を一文で理解できる具体性を持つこと。他のフェイルファストメッセージ（`OLLAMA_API_KEY is required when LLM_PROVIDER=ollama` 等）とトーン＆マナーを統一すること。

### NFR-5: 再現可能性（Docker 検証）

- 全ての受け入れ基準は **Docker 環境（`docker compose up`）および ローカルvenv の双方** で検証可能であること。Docker 不在環境では前フェーズの代替検証手順（venv での `pytest -q backend/tests`）で同等性を担保できること。

## 受け入れ基準 (Acceptance Criteria)

### FR-1: `ollama_base_url` 未設定時フェイルファスト
- [ ] `backend/app/schemas.py` から `https://openai.viloads.com/v1` の文字列が完全に除去されていること（`grep -r "openai.viloads.com" backend/app/` が空であること）
- [ ] `AppConfig(llm_provider="ollama", ollama_api_key="k", ollama_model="m")` を `ollama_base_url` 省略で構築した場合、`ValueError`（Pydantic経由では `ValidationError`）が送出されること
- [ ] 送出されるエラーメッセージが `OLLAMA_BASE_URL` を含み、`.env` への記入を案内していること
- [ ] `ollama_base_url` を明示的に与えた場合は当該値がそのまま設定されること（既存 `test_load_config_ollama` がパス）
- [ ] `gemini_base_url` 未設定時のデフォルト `https://generativelanguage.googleapis.com` が維持されていること
- [ ] `openai_base_url` 未設定時のデフォルト `https://api.openai.com/v1` が維持されていること

### FR-2: `test_config.py` テスト更新
- [ ] `test_appconfig_ollama_defaults_applied`（line 132-139 相当）が、ollama 未設定時のフェイルファストを検証するテストへ書き換わっていること
- [ ] 更新後のテストが `OLLAMA_BASE_URL` を含むエラーメッセージをアサートしていること
- [ ] `test_load_config_default_base_url`（openai・line 21-28）・`test_appconfig_gemini_defaults`（line 72-79）・`test_appconfig_openai_defaults_applied`（line 122-129）が **変更なしで** パスすること
- [ ] `test_load_config_ollama`（line 7-18・明示的にURLを与えるケース）が **変更なしで** パスすること

### FR-3: `docker-compose.yml` 末尾改行
- [ ] `docker-compose.yml` の末尾に改行が1つ追加されていること（`tail -c1 docker-compose.yml | xxd` で `0x0a` が確認できること）
- [ ] `yamllint docker-compose.yml` の `new-line-at-end-of-file` 指摘が解消していること
- [ ] `docker-compose.yml` の構成要素（`env_file` / `volumes` / `stdin_open` / `tty` / `healthcheck`）に変更がないこと

### FR-4: リグレッション確認
- [ ] `ruff format --check` がパスすること
- [ ] `ruff check` がゼロエラーであること
- [ ] `mypy --strict` がゼロエラーであること
- [ ] `pytest -q backend/tests` が全件パスすること（48件相当・FR-2 の書き換え分を含む）
- [ ] Docker 環境 (`docker compose up`) で上記が検証可能であること（`docker compose exec backend pytest -q backend/tests` で同等結果が得られること、または前フェーズのvenv代替検証手順で同等性を記録すること）

## 未解決・考慮事項

1. **Ollama Cloud の公式エンドポイント有無**: 現時点で Ollama Cloud に「全利用者共通の固定エンドポイント」は存在せず、契約・リージョン毎に異なる。そのため本フェーズではコード内デフォルトを設けずフェイルファスト化する。将来 Ollama 公式が固定エンドポイントを公開した場合は、デフォルト復活を別途検討すること。

2. **エラーメッセージの多言語化**: 現行の他のフェイルファストメッセージ（`OLLAMA_API_KEY is required when LLM_PROVIDER=ollama` 等）は英語であり、本フェーズの新メッセージも英語に統一する。日本語利用者向けのローカライズは別フェーズの UX 改善対象。

3. **`.env.example` とエラーメッセージの整合性**: エラーメッセージで `.env.example` を参照させる場合、前フェーズでプレースホルダ化済みの `.env.example` の記載内容と矛盾しないよう、実装フェーズでメッセージ文言を最終調整すること。

4. **テスト件数の増減**: FR-2 でテストを「デフォルトURL検証」から「フェイルファスト検証」へ書き換えるため、件数は据え置き（48件）を想定する。実装上の都合でテストを分割・統合する場合は、最終報告で件数変化の根拠を明記すること。

5. **`openai.viloads.com` の履歴保持**: 当該仮URLは git 履歴上に残るが、現行コード・設定ファイルからは完全に除去する。履歴の消去（`git filter-repo` 等）は本フェーズのスコープ外とし、必要あれば別フェーズで検討すること。