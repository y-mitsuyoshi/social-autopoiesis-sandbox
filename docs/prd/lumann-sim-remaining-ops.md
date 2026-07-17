# PRD: 残課題対応（Docker再現検証 / SIGINT実機検証 / Ollama URLプレースホルダ化）

## 概要と目標

前フェーズ（`/goal: lumann-autopoiesis-sim`）でCLIシミュレーション基盤は実装完了し、ruff / mypy --strict / pytest 48件は全てパス済み。最終報告（`docs/final-report/lumann-autopoiesis-sim.md`）で挙がった **3件の残課題** をクローズするためのフォローアップフェーズである。

本フェーズは **新規機能追加ではなく「検証・設定整備」フェーズ** と明確に位置づける。アプリケーションコードの機能変更は行わず、前フェーズの受け入れ基準 #13（Docker実機起動）・#19（実機SIGINT graceful停止）の検証ギャップを埋め、Ollama Cloud の仮置きベースURLを安全なプレースホルダに整理する。

### 対象残課題とユーザー決定

1. **PRD #13: Docker実機起動確認（代替検証）**
   - 実行環境（WSL）にDockerがインストールされておらず `docker compose up --build` を実行できない。
   - **ユーザー決定**: ローカルvenvでDockerfileの手順を再現検証する代替手段を採用する。
     - `hadolint` による Dockerfile 静的検証
     - `yamllint` による docker-compose.yml 構文検証
     - venv内で `pip install -r requirements.txt` → `python -m app.main` の起動手順再現

2. **PRD #19: 実機SIGINT graceful停止の実機検証**
   - テストでは `asyncio.CancelledError` ベースで検証済だが、実SIGINT送信時のハンドラ発火順序（SIGINT → main タスク cancel → `try/finally` での `aclose()`）は実機未確認。
   - **本フェーズ実施中に発見された既知バグ**: 現行 `main.py` の `_install_sigint_handler()` / `_cancel_main_task()` は Python 3.12 asyncio 実装上 no-op であり、実SIGINTが握り潰される（詳細は Tech Spec「アーキテクチャ上の決定」#12）。FR-3 の検証成立のため、`main.py` への最小限のバグ修正（カスタムハンドラ削除し Python 3.11+ Runner 標準 SIGINT ハンドリングに移譲）を本フェーズのスコープに含める。これは機能追加ではなくバグ修正であり、上記「アプリケーションコードの機能変更は行わない」方針の例外として明示的に許可する。
   - ローカルで実際にSIGINTを送信し、graceful停止とJSONLフラッシュを確認できる検証スクリプト／手順を整備する。

3. **Ollama Cloud ベースURLのプレースホルダ化**
   - 現在 `.env.example` には仮の `https://openai.viloads.com/v1` が記載されている。
   - **ユーザー決定**: `.env.example` をプレースホルダ化（例: `https://your-ollama-cloud-endpoint/v1`）し、設定手順コメントを記載。実値はユーザーが `.env` に記入する運用とする。

### 非目標（本フェーズでは扱わない）

- 新規機能の追加（React可視化、FastAPI、動的エージェント順序等の次フェーズ候補は全て非スコープ）
- Docker本体のインストール・実ビルド・実起動（環境制約により代替検証で代替）
- `backend/app/schemas.py` のコード内デフォルト値変更を含むアプリケーションロジックの改修（検討事項として「未解決・考慮事項」に記載）
- 実LLM APIを用いたE2E疎通（実APIキー・実エンドポイントはユーザーの `.env` 管理。本フェーズでは起動経路と設定雛形の健全性までを保証）

## ターゲットユーザー / ユースケース

### ターゲットユーザー
- **プロダクトオーナー（開発者本人）**: マージ前の最終検証として残課題をクローズし、手元のWSL環境（Docker不在）でも再現可能な検証手順を確立したい。
- **将来の利用者・研究者**: リポジトリをクローンし、`.env.example` の案内に従って自身のLLMエンドポイントを設定してシミュレーションを起動したい。

### ユースケース
1. **Dockerfile再現検証（Docker不在環境）**: 開発者がvenv（Python 3.12）を作成し、Dockerfileの `pip install -r requirements.txt` → `python -m app.main` と同等の手順をローカルで再現。サマリ表示とお題プロンプトまで到達することで、コンテナ起動経路の健全性を確認する。併せて `hadolint` / `yamllint` で Dockerfile / docker-compose.yml を静的検証する。
2. **実機SIGINT検証**: 開発者がシミュレーションプロセスを起動し、実行中に実際にSIGINT（Ctrl+C または `kill -INT <pid>`）を送信。中断メッセージの出力、JSONLログのフラッシュ（全行が有効なJSON）、プロセスの正常終了を確認する。
3. **環境設定の自力セットアップ**: 利用者が `cp .env.example .env` し、コメントに記載された手順に従って自身のOllama Cloudエンドポイント・APIキー・モデル名を記入して起動できる。

## 機能要件 (必須)

### FR-1: Docker起動手順のvenv再現検証（PRD #13 代替）
- Python 3.12 のvenvを作成し、ルートの `requirements.txt` を `pip install -r requirements.txt` でインストールできること（Dockerfileの `RUN pip install --no-cache-dir -r requirements.txt` 相当）。
- venv内でコンテナのWORKDIR（`/app`）相当レイアウトから `python -m app.main` を起動し、サマリ表示（プロバイダ／モデル／エージェント／最大ターン）とお題プロンプト（`お題を入力してください > `）まで到達すること。実APIキーは不要で、ダミー値の `.env` で起動経路のみ検証してよい。
- docker-compose.yml の healthcheck 相当コマンド `python -c "import app; print('ok')"` がvenv内で成功すること。
- ダミー値の `.env` でお題を入力した場合、LLM呼出失敗 → リトライ（最大3回）→ graceful終了の挙動が観察できること（`CMD ["python", "-m", "app.main"]` の起動経路全体が健全であることの裏付け）。
- 上記の手順と結果をドキュメント（検証手順書／検証レポート）として記録し、コマンド列がそのまま再現可能であること。

### FR-2: Dockerfile / docker-compose.yml の静的検証
- `hadolint` で `backend/Dockerfile` を検証し、エラーレベルの指摘がゼロであること（警告レベルは許容するが、内容を検証レポートに記録する）。
- `yamllint` で `docker-compose.yml` の構文検証がパスすること。
- docker-compose.yml の必須構成要素（`env_file: .env`、`./logs:/app/logs` ボリューム、`stdin_open`/`tty`、healthcheck）が仕様通りであることを静的確認で再確認すること。
- `hadolint` / `yamllint` が環境に未インストールの場合の導入手順（または代替の同等検証手段）を検証手順書に明記すること。

### FR-3: 実機SIGINT検証スクリプト／手順の整備（PRD #19）
- 起動中のシミュレーションプロセスに対して実際にSIGINTを送信し、以下を確認できる検証手順を提供すること（シェルスクリプト化または手順書化。実装手段は問わない）。
  - コンソールに中断を示すメッセージ（「シミュレーションを中断します。」等）が出力されること
  - `logs/sim_*.jsonl` の全行が有効なJSONとしてパースでき、途中行の欠損・破損がないこと（フラッシュ済みであること）
  - プロセスがハングせず終了し、終了コードが記録されること
- 検証は `MAX_TURNS=0`（無限ループ）相当の継続実行中にSIGINTを送るシナリオを含めること（ハンドラ発火順序: Python 3.11+ `asyncio.Runner` 標準 SIGINT ハンドリング → メインタスク `cancel()` → `run_simulation` の `finally` で `client.aclose()` / `logger.aclose()` の実機確認）。
- 検証結果（送信方法、観察した出力、終了コード、JSONL行数）を検証レポートに記録すること。

### FR-4: `.env.example` のプレースホルダ化（Ollama Cloud URL）
- `.env.example` の `OLLAMA_BASE_URL` を仮URL（`https://openai.viloads.com/v1`）からプレースホルダ（例: `https://your-ollama-cloud-endpoint/v1`）に変更すること。
- Ollama Cloud セクションに設定手順コメントを記載すること。最低限以下を含める:
  - エンドポイント・APIキー・モデル名は利用者が契約するOllama Cloudのダッシュボード等で確認すること
  - `.env.example` をコピーして `.env` を作成し、実値を記入すること（`.env` はgit管理外）
- `.env.example` をはじめgit管理下のファイルに、実在のAPIキー・確定済みの実エンドポイントを含めないこと。
- Gemini / OpenAI セクションの既存デフォルト（公式の公開ベースURL）は変更しない（実在が確認できる公式URLであり、プレースホルダ化の対象はOllama Cloudのみ）。

## 非機能要件 (パフォーマンス、UX等)

### NFR-1: 既存品質ゲートの維持（リグレッション禁止）
- 本フェーズの変更（ドキュメント・`.env.example`・検証スクリプト追加）後も、`ruff format --check` / `ruff check` / `mypy --strict` / `pytest -q backend/tests`（48件）が全てパスすること。アプリケーションロジックの変更は原則行わない。

### NFR-2: 再現可能性
- 全ての検証手順はコマンド列レベルで文書化され、第三者（将来の自分含む）が同一環境（WSL・Docker不在）でそのまま再実行できること。
- 検証に使用するダミー `.env` の内容（ダミー値であることが明確な値）も手順書に例示すること。

### NFR-3: YAGNI・最小変更
- 検証のための新規ランタイム依存を追加しない（`hadolint` / `yamllint` は開発・検証ツールでありアプリ依存に混ぜない）。
- 検証スクリプトは必要最小限の構成とし、汎用的な検証フレームワークの導入は行わない。

### NFR-4: セキュリティ
- 実APIキー・実エンドポイントをgit管理下にコミットしない。検証に使用する値は全てダミーとすること。
- `.env` が `.gitignore` 済みであることを検証手順の一環で再確認すること。

### NFR-5: UX（手順書としての分かりやすさ）
- `.env.example` のコメントは、Ollama Cloudを初めて使う利用者でも迷わない具体性を持つこと（何を・どこで取得し・どこに書くか）。
- 検証手順書は「前提 → 手順 → 期待結果 → 実績記録欄」の構成を推奨する。

## 受け入れ基準 (Acceptance Criteria)

### Docker再現検証（PRD #13 代替）
- [ ] Python 3.12 のvenvを作成し、`pip install -r requirements.txt` がエラーなく完了すること（Dockerfileの依存インストール手順の再現）
- [ ] venv内でコンテナのWORKDIR相当（`backend/` ディレクトリ）から `python -m app.main` を起動し、サマリ表示（プロバイダ／モデル／エージェント／最大ターン）とお題プロンプト `お題を入力してください > ` が表示されること（ダミー `.env` 可）
- [ ] venv内で healthcheck 相当コマンド `python -c "import app; print('ok')"` が `ok` を出力して終了すること
- [ ] ダミー `.env` でお題を入力した場合、LLM呼出失敗 → リトライ → エラーメッセージ出力 → graceful終了の挙動が観察できること
- [ ] `hadolint backend/Dockerfile` の結果、エラーレベルの指摘がゼロであること（警告は許容・検証レポートに記録）
- [ ] `yamllint docker-compose.yml` がパスすること
- [ ] docker-compose.yml の `env_file` / `volumes` / `stdin_open` / `tty` / `healthcheck` の5要素が仕様通りであることが静的確認で再確認されていること
- [ ] Docker再現検証の手順・コマンド列・結果が検証レポートとして文書化され、再現可能であること

### 実機SIGINT検証（PRD #19）
- [ ] 実行中のシミュレーションプロセスに実SIGINT（Ctrl+C または `kill -INT <pid>`）を送信し、コンソールに中断メッセージ（「シミュレーションを中断します。」等）が出力されること
- [ ] SIGINT送信後、`logs/sim_*.jsonl` の全行が有効なJSONとしてパースでき、書きかけ行・破損行がないこと（フラッシュ確認）
- [ ] SIGINT送信後、プロセスがハングせず終了し、終了コードが検証レポートに記録されていること
- [ ] SIGINT検証手順がスクリプトまたは手順書として文書化され、同一環境で再実行可能であること

### `.env.example` プレースホルダ化（Ollama Cloud URL）
- [ ] `.env.example` の `OLLAMA_BASE_URL` がプレースホルダ（例: `https://your-ollama-cloud-endpoint/v1`）に変更され、仮URL `https://openai.viloads.com/v1` が残っていないこと
- [ ] `.env.example` の Ollama Cloud セクションに、エンドポイント／APIキー／モデル名の取得元と `.env` への記入手順を示すコメントが記載されていること
- [ ] git管理下のファイルに実APIキー・実エンドポイントが含まれないこと（`.env` は `.gitignore` 済みのまま）

### リグレッション確認
- [ ] 本フェーズの変更後も `ruff format --check` / `ruff check` / `mypy --strict` / `pytest -q backend/tests`（48件）が全てパスすること

## 未解決・考慮事項

1. **`backend/app/schemas.py` のコード内デフォルトURL**: `AppConfig` のバリデータ内に `ollama_base_url` のデフォルトとして `https://openai.viloads.com/v1` が残っている。本フェーズのユーザー決定は `.env.example` のプレースホルダ化のみのため変更対象外とするが、コード内デフォルトも「未設定時はフェイルファストにする」または「プレースホルダに揃える」かは次の判断事項。変更すると `test_config.py`（デフォルトBASE_URL検証テストを含む14件）に影響するため、本フェーズでは凍結し別途判断とする。

2. **hadolint / yamllint の導入手段**: WSL環境にこれらのツールが存在しない可能性がある。バイナリダウンロード・`apt`・`pip install yamllint` 等の導入手順を検証手順書に明記すること。導入自体が不可な場合の代替手段（例: Pythonの `yaml.safe_load` による構文検証スクリプト）を許容するが、同等性の根拠を記録すること。

3. **SIGINT検証時のLLM呼出**: 無限ループ中にSIGINTを送るシナリオで、実APIキーが無い環境ではLLM呼出が即失敗してループが終了してしまう。検証手順では「実APIキーを用いる」「ダミーでもLLM失敗ループのリトライ中にSIGINTを送る」等、環境に応じた手順を分岐記載するか、テスト用ダミークライアントを検証に流用するかを実装フェーズで判断する。受け入れ基準の本質（SIGINT → 中断メッセージ → JSONLフラッシュ → 正常終了）はいずれの手段でも満たせること。

4. **Docker実機起動の最終確認**: 本フェーズのvenv再現検証は代替手段であり、`docker compose up --build` の実ビルド・実起動は引き続き未実施。Docker利用可能な環境が確保できた時点で実機起動確認を行うことを、正式なクローズ条件として別途管理すること（本PRDの受け入れ基準は代替検証の完了をもって充足とする）。

5. **検証レポートの配置場所**: 検証手順書・結果レポートの格納先（例: `docs/ops/` 配下）は実装フェーズで確定する。既存の `docs/final-report/` や `docs/qa/` と整合的な命名・配置とすること。
