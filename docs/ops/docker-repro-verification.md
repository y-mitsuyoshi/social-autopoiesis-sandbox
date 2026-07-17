# Docker 再現検証・静的検証 手順書 (FR-1 / FR-2)

本手順書は Docker が利用できない環境（WSL 等）で、`backend/Dockerfile` / `docker-compose.yml` の起動経路・構成要素を venv 再現と静的検証により確認するための手順・期待結果・実績記録欄を提供する。

## 前提

- OS: Linux (WSL2 Ubuntu 24.04 想定)。Docker / hadolint / yamllint は未導入でも可。
- Python 3.12 (`python3.12`) が利用可能であること。無ければ `python3` で代用可。venv 作成に失敗する場合は `sudo apt install -y python3.12-venv` を実行する旨を以下の手順に注記。
- PyPI 到達性（`pip install` が成功するネットワーク環境）。
- リポジトリルート: `backend/` / `requirements.txt` / `scripts/verify_docker_static.py` / `docker-compose.yml` / `backend/Dockerfile` が存在すること。
- 検証 venv は `/tmp/lumann-verify-venv` に作成（リポジトリ汚染防止・使い捨て）。
- ダミー `.env` は `backend/.env` に配置し、検証後に削除する。

## 手順

### FR-1: Docker 起動手順の venv 再現検証

1. **venv 作成**
   ```bash
   python3.12 -m venv /tmp/lumann-verify-venv
   ```
   `python3.12` が無ければ `python3` を試す。venv 作成に失敗したら `sudo apt install -y python3.12-venv` を実行して再試行する。

2. **依存インストール再現**（Dockerfile `RUN pip install --no-cache-dir -r requirements.txt` 相当）
   ```bash
   /tmp/lumann-verify-venv/bin/pip install -r requirements.txt
   ```
   リポジトリルートで実行する。使い捨て venv のため `--no-cache-dir` は省略可。

3. **ダミー `.env` 配置**（compose `env_file: .env` 相当）
   以下の内容で `backend/.env` を作成する。
   ```
   LLM_PROVIDER=ollama
   MAX_TURNS=3
   OLLAMA_API_KEY=dummy-key
   OLLAMA_BASE_URL=http://127.0.0.1:9/v1
   OLLAMA_MODEL=dummy-model
   ```
   - `OLLAMA_BASE_URL` は RFC 863 discard ポート `9` を使用し、DNS 解決・外部ネットワークに依存せず即座に connection refused が返るようにする（LLM 呼出失敗 → リトライ → graceful 終了の決定的観察のため）。
   - Gemini / OpenAI 変数は不要（`ollama` 選択時は `ollama_*` のみバリデーション対象、他は欠損許容）。

4. **起動再現**（Dockerfile `WORKDIR /app` + `CMD ["python", "-m", "app.main"]` 相当）
   ```bash
   cd backend && /tmp/lumann-verify-venv/bin/python -m app.main
   ```
   - 期待: サマリ（`=== ルーマン・オートポイエーシス・シミュレーション ===` / `プロバイダ: ollama` / `モデル: dummy-model` / `エージェント: 経済システム, 科学システム, 法システム` / `最大ターン: 3`）とプロンプト `お題を入力してください > ` が表示される。
   - プロンプト待機中に Ctrl+C を送信した場合: Runner 標準 SIGINT ハンドリングにより main タスクがキャンセルされる。終了コードは実測値を記録する（予測: 0 または 1。判定基準とはしない）。

5. **healthcheck 相当**（compose `healthcheck.test` 相当）
   ```bash
   cd backend && /tmp/lumann-verify-venv/bin/python -c "import app; print('ok')"
   ```
   - 期待: `ok` 出力、終了コード 0。実行ディレクトリは `backend/` 必須（cwd が `sys.path[0]` に入り `app` が import 可能になる）。

6. **LLM 失敗 → リトライ → graceful 終了の観察**（`CMD` 起動経路全体の健全性裏付け）
   ```bash
   cd backend && echo 'Docker再現検証お題' | /tmp/lumann-verify-venv/bin/python -m app.main
   ```
   - 期待: stderr に `[ターン 0] LLM呼出失敗: LLM request failed after 3 attempts`、終了コード 0。`backend/logs/sim_*.jsonl` が生成されるが 0 行（応答なしのため空ファイルは正常）。

7. **`.env` の git 管理外確認**（NFR-4）
   ```bash
   git check-ignore -v .env backend/.env
   ```
   - 期待: 両方が `.gitignore` パターンにマッチする。

8. **後始末**
   ```bash
   rm -f backend/.env
   ```
   venv は `/tmp` 配下のため放置可（WSL 再起動で消滅）。

### FR-2: Dockerfile / docker-compose.yml の静的検証

本物ツールを優先し、導入不可の場合は Python スクリプト（`scripts/verify_docker_static.py`）で代替する。採用経路と出力を実績記録欄に記録する。

- **hadolint（優先）**
  ```bash
  curl -sL -o /tmp/hadolint https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64 \
    && chmod +x /tmp/hadolint \
    && /tmp/hadolint backend/Dockerfile
  ```
  - 期待: エラーレベル 0 件。警告は内容を実績記録欄に記録する。

- **yamllint（優先）**
  ```bash
  /tmp/lumann-verify-venv/bin/pip install yamllint \
    && /tmp/lumann-verify-venv/bin/yamllint -d relaxed docker-compose.yml
  ```
  - 期待: パス（`-d relaxed`: 現行 compose が `services:` 始まりで `---` 未使用のため、`document-start` は relaxed 扱い）。

- **代替（Python スクリプト）**: 上記が導入不可の場合
  ```bash
  /tmp/lumann-verify-venv/bin/pip install pyyaml \
    && /tmp/lumann-verify-venv/bin/python scripts/verify_docker_static.py
  ```
  - 期待: 全チェック OK、終了コード 0。
  - 検証内容: Dockerfile 4 ルール（`FROM python:3.12-slim` 存在 / `USER appuser` が `CMD` より前 / `HEALTHCHECK` 不在 / `pip install --no-cache-dir -r requirements.txt` 存在）+ docker-compose.yml 5 要素（`backend.env_file == ".env"` / `volumes` に `"./logs:/app/logs"` / `stdin_open is True` / `tty is True` / `healthcheck.test == ["CMD","python","-c","import app; print('ok')"]`）。

## 期待結果

- FR-1: 手順 1〜8 が全て完走し、手順 4 でサマリとプロンプト表示、手順 5 で `ok`、手順 6 で LLM 失敗→リトライ→graceful 終了（終了コード 0）が観察されること。
- FR-2: hadolint/yamllint（または代替 Python スクリプト）でエラーレベル指摘 0・compose 5 要素が仕様通りであること。

## 実績記録欄

実行後に以下を埋める。

### 実行日時・環境
- 実行日時: 2026-07-17 (実行時刻は JST 21:56 頃〜)
- OS / カーネル: Linux (WSL2 Ubuntu 24.04)
- Python バージョン: Python 3.12.3
- Docker 利用可否: 不可（WSL・Docker 未導入）
- hadolint 導入可否: 可（GitHub Releases からバイナリDL・`/tmp/hadolint` で実行）
- yamllint 導入可否: 可（検証 venv に `pip install yamllint`）
- 採用した FR-2 検証経路: hadolint（バイナリ）+ yamllint（venv）+ 代替 Python スクリプト（全3経路を実施）

### FR-1 手順結果
- 手順1 (venv 作成): 成功（`python3.12 -m venv /tmp/lumann-verify-venv`、Python 3.12.3）
- 手順2 (pip install): 成功（`pip install -r requirements.txt`、annotated-types / anyio / certifi / h11 / httpcore / httpx / idna / pydantic / pydantic-core / python-dotenv / typing-extensions / typing-inspection 導入、エラーなし）
- 手順3 (ダミー .env 配置): 成功（`backend/.env` にダミー内容5行を配置）
- 手順4 (起動・サマリ+プロンプト): 成功（サマリ `=== ルーマン・オートポイエーシス・シミュレーション ===` / `プロバイダ: ollama` / `モデル: dummy-model` / `エージェント: 経済システム, 科学システム, 法システム` / `最大ターン: 3` とプロンプト `お題を入力してください > ` 表示を確認。`< /dev/null` で EOF により `EOFError`、終了コード1で即終了）
- 手順5 (healthcheck `ok`): 成功（`ok` 出力、終了コード0）
- 手順6 (LLM 失敗→リトライ→graceful): 成功（stdout に `[ターン 0] LLM呼出失敗: LLM request failed after 3 attempts`、終了コード0、`backend/logs/sim_*.jsonl` は0行・空ファイル生成）
- 手順7 (git check-ignore): 成功（`.gitignore:151:.env` で `.env` / `backend/.env` 両方がマッチ、終了コード0）
- 手順8 (後始末): 成功（`rm -f backend/.env`、`backend/.env` 存在確認で No such file）

### FR-2 検証結果
- hadolint 出力（採用時）: 終了コード0（エラーレベル指摘0件・警告0件・出力空）
- yamllint 出力（採用時）: 終了コード1・指摘1件（`docker-compose.yml:16:23 error no new line character at the end of file (new-line-at-end-of-file)`）。構文エラーではなくスタイル指摘。`docker-compose.yml` は変更禁止のため修正不可。`relaxed` 設定でも `new-line-at-end-of-file` は有効。本指摘は compose の機能的健全性に無関係（YAML 構文は有効・`yaml.safe_load` で正常パース済み）。
- 代替 Python スクリプト出力（採用時）: 終了コード0・全9チェック OK
  ```
  [OK] Dockerfile: FROM python:3.12-slim
  [OK] Dockerfile: USER appuser before CMD
  [OK] Dockerfile: no HEALTHCHECK
  [OK] Dockerfile: pip install --no-cache-dir -r requirements.txt
  [OK] compose: backend.env_file == '.env'
  [OK] compose: volumes contains './logs:/app/logs'
  [OK] compose: stdin_open is True
  [OK] compose: tty is True
  [OK] compose: healthcheck.test == ['CMD','python','-c',"import app; print('ok')"]
  ```

### 観察ログ（貼付欄）
```
# 手順4: < /dev/null 起動時の出力
=== ルーマン・オートポイエーシス・シミュレーション ===
プロバイダ: ollama
モデル: dummy-model
エージェント: 経済システム, 科学システム, 法システム
最大ターン: 3
お題を入力してください > Traceback (most recent call last):
  File "<frozen runpy>", line 198, in _run_module_as_main
  File "<frozen runpy>", line 88, in _run_code
  File ".../backend/app/main.py", line 96, in <module>
    asyncio.run(main())
  ...
  File ".../backend/app/main.py", line 78, in main
    trigger = await asyncio.to_thread(input, "お題を入力してください > ")
  ...
EOFError: EOF when reading a line
EXIT=1

# 手順5: healthcheck
$ cd backend && /tmp/lumann-verify-venv/bin/python -c "import app; print('ok')"
ok
EXIT=0

# 手順6: LLM 失敗→リトライ→graceful
$ cd backend && echo 'Docker再現検証お題' | /tmp/lumann-verify-venv/bin/python -m app.main
=== ルーマン・オートポイエーシス・シミュレーション ===
プロバイダ: ollama
モデル: dummy-model
エージェント: 経済システム, 科学システム, 法システム
最大ターン: 3
お題を入力してください > [ターン 0] LLM呼出失敗: LLM request failed after 3 attempts
EXIT=0
# jsonl: 0行（空ファイル）

# 手順7: git check-ignore
$ git check-ignore -v .env backend/.env
.gitignore:151:.env	.env
.gitignore:151:.env	backend/.env
EXIT=0

# FR-2 hadolint
$ /tmp/hadolint backend/Dockerfile
HADOLINT_EXIT=0  (出力空)

# FR-2 yamllint
$ /tmp/lumann-verify-venv/bin/yamllint -d relaxed docker-compose.yml
docker-compose.yml
  16:23     error    no new line character at the end of file  (new-line-at-end-of-file)
YAMLLINT_EXIT=1

# FR-2 代替 Python スクリプト
$ python3 scripts/verify_docker_static.py
[OK] Dockerfile: FROM python:3.12-slim
[OK] Dockerfile: USER appuser before CMD
[OK] Dockerfile: no HEALTHCHECK
[OK] Dockerfile: pip install --no-cache-dir -r requirements.txt
[OK] compose: backend.env_file == '.env'
[OK] compose: volumes contains './logs:/app/logs'
[OK] compose: stdin_open is True
[OK] compose: tty is True
[OK] compose: healthcheck.test == ['CMD','python','-c',"import app; print('ok')"]
EXIT=0

# リグレッション確認（受け入れ基準: 既存品質ゲート 48件）
$ cd /home/yuma/projects/social-autopoiesis-sandbox && ruff format --check backend/ scripts/
16 files already formatted
$ ruff check backend/ scripts/
All checks passed!
$ mypy --strict backend/app backend/tests scripts/verify_docker_static.py
Success: no issues found in 16 source files
$ pytest -q backend/tests
................................................                         [100%]
48 passed in 0.23s
REGRESSION_EXIT=0
```