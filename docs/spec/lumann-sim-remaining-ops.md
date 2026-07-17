# Tech Spec: 残課題対応（Docker再現検証 / SIGINT実機検証 / Ollama URLプレースホルダ化）

## コンテキスト

前フェーズ（`docs/spec/lumann-autopoiesis-sim.md`）でCLIシミュレーション基盤は実装完了し、ruff / mypy --strict / pytest 48件は全てパス済み。本フェーズは PRD `docs/prd/lumann-sim-remaining-ops.md` に基づく **検証・設定整備フェーズ** であり、以下の3残課題をクローズする:

1. PRD #13: Docker実機起動確認の代替検証（WSL環境にDocker不在のため、venv再現 + 静的検証で代替）
2. PRD #19: 実機SIGINT graceful停止の実機検証（ハンドラ発火順序 `loop.add_signal_handler` → `task.cancel()` → `finally` での `aclose()` の実機確認）
3. `.env.example` の Ollama Cloud ベースURLのプレースホルダ化

環境制約: WSL・Docker不在。hadolint / yamllint 未インストールの可能性。Python 3.12.3 + ruff / mypy / pytest はシステムPythonに導入済み。

現行実装の確認済み事実（設計の前提）:

- `verify.sh` は Docker 不在時に `backend/` へ cd して `ruff format . --check` / `ruff check .` / `mypy .` / `pytest -q` を実行する。ルート直下の新規 `scripts/` は品質ゲートの検査経路外となる。
- `backend/tests/`（`conftest.py` / `test_config.py`）は `.env.example` を一切読まず、旧仮URL `https://openai.viloads.com/v1` を `monkeypatch.setenv` で直接指定している。したがって `.env.example` の変更は pytest 48件に無影響。
- `load_config()` は `dotenv.load_dotenv()`（= `find_dotenv`、呼出元 `backend/app/config.py` から上位ディレクトリへ探索）を使う。`backend/.env` はルート `.env` より先にヒットし、かつ既存の環境変数は上書きされない（`override=False` デフォルト）。
- `SimulationLogger` のデフォルト出力先は cwd 相対の `logs/`。ホストで `backend/` から実行すると `backend/logs/sim_*.jsonl` に生成される。`.gitignore` の `logs/` パターン（スラッシュ非含有）は任意階層にマッチするため git 管理外。
- `main.py` の SIGINT 経路（実ソース検証済み・訂正版）: 現行の `_install_sigint_handler()` / `_cancel_main_task()` は **Python 3.12 asyncio 実装上 no-op** である（Arch Review で実機検証により判明した既知バグ）。理由:
  - `loop.add_signal_handler` のコールバックはタスクコンテキスト外で実行されるため `asyncio.current_task()` は `None` を返し、`_cancel_main_task()` は `task is not None` ガードで何もせず終了する。
  - さらに `add_signal_handler` は内部で `signal.signal(SIGINT, _sighandler_noop)` を設定し、`asyncio.Runner` が `run()` 時に登録する「SIGINT → main task cancel」の標準ハンドラ（Python 3.11+、推奨経路）を **上書きして無効化** する。結果、実SIGINTは完全に握り潰され、KeyboardInterrupt も発生しない。
  - 修正方針（バグ修正スコープとして本フェーズで許可、下記「アーキテクチャ上の決定」#12 参照）: `_install_sigint_handler()` / `_cancel_main_task()` / `signal` import を削除し、Python 3.11+ `asyncio.Runner` の標準 SIGINT ハンドリングに委ねる。これにより SIGINT → Runner が main タスクを cancel → `run_simulation` の `except asyncio.CancelledError` で「シミュレーションを中断します。」出力・再 raise → `finally` で `client.aclose()` / `logger.aclose()` → `main()` の `except asyncio.CancelledError` で捕捉（再 raise なし）→ `asyncio.run()` 正常終了。**予測終了コードは 0**（実測をレポートに記録する）。二度目の SIGINT は Runner が KeyboardInterrupt にフォールバックするため、外側の `try: asyncio.run(main()) except KeyboardInterrupt` はその保険として残す。
- LLM 呼出失敗時: `retry_async` が最大3回（0.5s / 1s バックオフ）後に `LLMError` を送出し、`run_simulation` が `[ターン 0] LLM呼出失敗: LLM request failed after 3 attempts` を stderr に出力して `break` → `finally` でクローズ → 終了コード 0。
- `OpenAICompatibleClient` は `POST {base_url}/chat/completions` を呼び、応答 JSON の `choices[0].message.content` を読む。スタブサーバはこの最小形を返せばよい。

## 目標 / 非目標

- **目標**:
  - Python 3.12 venv で Dockerfile の依存インストール・起動・healthcheck 手順を再現検証し、コマンド列レベルで文書化すること（FR-1）。
  - `backend/Dockerfile` / `docker-compose.yml` の静的検証を整備すること（本物の hadolint / yamllint を優先、未導入環境では Python スクリプトで同等チェック）（FR-2）。
  - 実SIGINT（`kill -INT <pid>`）による中断メッセージ・JSONLフラッシュ・終了コードを確認する検証スクリプトと手順書を整備すること（FR-3）。
  - `.env.example` の `OLLAMA_BASE_URL` を `https://your-ollama-cloud-endpoint/v1` にプレースホルダ化し、設定手順コメントを記載すること（FR-4）。
  - 検証手順書・結果レポートを `docs/ops/` 配下に配置すること（PRD未解決#5 の確定）。
  - 変更後も `ruff format --check` / `ruff check` / `mypy --strict` / `pytest -q backend/tests`（48件）が全てパスすること（NFR-1）。
- **非目標**:
  - `backend/app/` および `backend/tests/` の機能変更（例外: 下記「アーキテクチャ上の決定」#12 の **SIGINT no-op バグ修正のみ許可**。`schemas.py` のコード内デフォルトURLは凍結: PRD未解決#1）。
  - Docker 本体のインストール・実ビルド・実起動（代替検証で充足。実機起動は別管理: PRD未解決#4）。
  - 実LLM API を用いたE2E疎通（実キーはユーザーの `.env` 管理）。
  - 新規ランタイム依存の追加、汎用検証フレームワークの導入（YAGNI: NFR-3）。
  - `pyproject.toml` / `requirements.txt` / `docker-compose.yml` / `backend/Dockerfile` / `.gitignore` の変更。

## アーキテクチャ上の決定

1. **検証 venv は `/tmp/lumann-verify-venv` に作成** (理由: リポジトリ汚染防止・使い捨て。Ubuntu 24.04 のシステムPythonは PEP 668 externally-managed のため `pip install` 先として使えず、venv 必須。`/tmp` 配下なら WSL 再起動で自動消滅し、証跡は検証レポートに残す)。

2. **コンテナ WORKDIR `/app` 相当は `cd backend` で再現し、PYTHONPATH は使わない** (理由: Dockerfile は `COPY backend/app ./app` でコンテナ内 `/app/app` レイアウト。ホストの `backend/` ディレクトリは `backend/app/` を直下に持つ同型構造であり、`cd backend && python -m app.main` で sys.path[0]（cwd）から `app` パッケージが解決できる。環境変数を増やさないほうが再現手順として単純かつ Dockerfile と対応づけやすい)。

3. **ダミー `.env` は `backend/.env` に配置する** (理由: `load_dotenv()` の `find_dotenv` 探索が `backend/app/config.py` から上位へ遡るため、`backend/.env` がルートの実 `.env` より先にヒットする。ユーザーの実 `.env` を上書きも参照もせず安全。`.env` は `.gitignore` の任意階層パターンで git 管理外。検証後に削除する旨を手順書に明記)。

4. **FR-1 用ダミー `OLLAMA_BASE_URL` は `http://127.0.0.1:9/v1`（RFC 863 discard ポート）** (理由: DNS 解決・外部ネットワークに依存せず connection refused が即座に返るため、「LLM呼出失敗 → リトライ（0.5s + 1s バックオフ）→ `LLMError` → graceful 終了」の観察が決定的かつ高速。プレースホルダ文字列URLでも挙動は同等だが、DNS タイムアウト待ちが入り得るため不採用)。

5. **静的検証は「本物ツール優先・Python スクリプトを恒久的代替として残す」二段構え** (理由: PRD未解決#2。hadolint は GitHub Releases からのバイナリダウンロード（apt/pip では導入不可: Haskell 製）、yamllint は検証 venv への `pip install yamllint` で導入可能だが、いずれもネットワーク依存で失敗し得る。`scripts/verify_docker_static.py`（stdlib + PyYAML）をリポジトリに残すことで、ツール未導入環境でも再現可能な同等検証を担保する。同等性の根拠: 本 Dockerfile は apt 不使用の最小構成であり、hadolint の主要指摘カテゴリ（non-root USER、イメージサイズ悪化要因のキャッシュ、pin 系）は下記4ルールでカバーできる)。
   - Dockerfile チェック（stdlib のみ・正規表現/文字列マッチ）:
     1. `FROM python:3.12-slim` が存在（ベースイメージ固定）
     2. `USER appuser` が `CMD` より前に出現（non-root 実行: hadolint DL3002 相当の核心）
     3. `HEALTHCHECK` ディレクティブが不在（compose 側一元化という設計決定の確認）
     4. `pip install --no-cache-dir -r requirements.txt`（hadolint DL3042 相当）
   - docker-compose.yml チェック（PyYAML `safe_load` で構文検証 + 5要素アサーション）:
     - `services.backend.env_file == ".env"`
     - `volumes` に `"./logs:/app/logs"` を含む
     - `stdin_open is True` / `tty is True`
     - `healthcheck.test == ["CMD", "python", "-c", "import app; print('ok')"]`

6. **検証スクリプトは `scripts/`（新規ディレクトリ）、文書は `docs/ops/`（新規ディレクトリ）に配置** (理由: 実行物と文書の責務分離。`verify.sh` の品質ゲート経路（`backend/` に cd して実行）は `scripts/` を対象に含まないため、既存ゲートへのリグレッションが構造的にゼロ。`docs/ops/` は `docs/final-report/`（完了報告）・`docs/qa/`（QA成果物）と分けた「運用・検証手順」カテゴリとして新設し、命名は既存のケバブケースに統一)。

7. **`scripts/verify_docker_static.py` は mypy strict クリーンで書き、`import yaml` には `# type: ignore[import-untyped]` pragma を1箇所だけ付与** (理由: PyYAML に型スタブが同梱されず（`types-PyYAML` 別途）、ルートで `mypy .` を実行した場合に `import yaml` がエラーになる。pragma はツール指示であり説明コメントではないため、「コメント禁止」制約には抵触しないと解釈する。PyYAML 未導入時は「検証 venv に `pip install pyyaml`（または yamllint 同伴）せよ」というメッセージを出して終了コード 2 で終了する)。

8. **SIGINT 実機検証はローカル HTTP スタブサーバ方式（PRD未解決#3 の候補b）を採用** (理由: スタブが即 200 応答を返し続けることで、実APIキーなしに `MAX_TURNS=0` の無限ループを維持でき、受け入れ基準の本質（SIGINT → 中断メッセージ → JSONL フラッシュ → ハングせず終了）を決定的に検証できる。候補(a) ダミーURL＋リトライ中 SIGINT はタイミング依存（リトライは合計約1.5秒で終了）で不安定なため主経路から除外。候補(c) DummyLLMClient の本番コードへの差し込みは `backend/` 変更禁止およびテストダブルの本番混入（設計汚染）のため却下。実APIキー所持者向けの手動手順（実キーで `MAX_TURNS=0` 起動 → Ctrl+C）は代替手順として手順書に併記するが、スクリプト化はしない（YAGNI）)。

9. **SIGINT 検証スクリプトは bash 単一ファイル `scripts/verify_sigint.sh` にスタブサーバ（heredoc 埋め込み Python）と JSONL 検証（Python one-liner）を内包** (理由: YAGNI・ファイル数最小。スタブを独立 `.py` に切り出すと lint/型チェックの管理対象が増える。heredoc 内 Python は品質ゲート対象外。bash スクリプト自体も `verify.sh` 経路の対象外)。スクリプトの振る舞い:
   - 引数: 検証 venv パス（デフォルト `/tmp/lumann-verify-venv`、FR-1 で作成した venv を再利用）。
   - スタブサーバ: `ThreadingHTTPServer(("127.0.0.1", 8399))`、`protocol_version = "HTTP/1.1"`。全 POST に対しリクエストボディを Content-Length 分読み捨てた上で `200` + `{"choices": [{"message": {"content": "stub-response"}}]}` を即返却（読み捨てを省くと keep-alive 接続で次リクエストが壊れるため必須）。バックグラウンド起動し、`trap ... EXIT` で確実に kill。
   - シミュレーション起動: `cd backend` し、環境変数を `env LLM_PROVIDER=ollama MAX_TURNS=0 OLLAMA_API_KEY=dummy OLLAMA_BASE_URL=http://127.0.0.1:8399 OLLAMA_MODEL=dummy` で直接供給（ダミー `.env` ファイルは使わず、ユーザーの実 `.env` との干渉を回避。`load_dotenv` は export 済み変数を上書きしない）。お題は stdin リダイレクト（`mktemp -d` 内のファイルに `echo` で1行書いて `<` で供給。`bash -c "echo ... | python"` ラップは避ける: `$!` が python 本体の PID になるよう直接バックグラウンド起動し、`kill -INT` が確実に届くようにする）。stdout/stderr は `mktemp -d` 内のログファイルへ。
   - 送信: 起動から約3秒（複数ターン実行を確認）後に `kill -INT <pid>`。
   - ハング監視: `kill -0` ポーリングで最大10秒待ち、生存していれば「ERROR: process did not exit within 10s after SIGINT」を出して `kill -KILL` + 終了コード 1（「ハングせず終了」の自動判定）。
   - 検証・記録: stdout ログから `シミュレーションを中断します。` を `grep -q`（見つからなければスクリプト失敗）、`ls -t backend/logs/sim_*.jsonl | head -1` の最新ファイルを全行 `json.loads` でパース（例外で失敗）、`wait` の終了コードを `|| EXIT_CODE=$?` で捕捉して表示。最後に「終了コード / JSONL 行数 / 全行パース可否」を標準出力に出し、検証レポートへ転記する運用。

10. **`.env.example` のプレースホルダ化は Ollama Cloud セクションのみ。Gemini / OpenAI セクションは変更しない** (理由: FR-4 明記どおり、Gemini / OpenAI のベースURLは実在が確認できる公式公開URLでありプレースホルダ化の対象外。変更前後 diff は「データモデル・インメモリ状態設計」セクションに明記)。

11. **変更範囲を「修正 `backend/app/main.py`（バグ修正・決定#12）+ 変更 `.env.example` 1件 + 新規 `scripts/` 2件 + 新規 `docs/ops/` 2件」に限定** (理由: NFR-1 / NFR-3。`backend/tests/` は `.env.example` を参照しないため pytest 48件は無影響（確認済み）。`.env.example`・`.sh`・`.md` は ruff / mypy の対象外。`scripts/verify_docker_static.py` は `verify.sh` 経路（`backend/` cd）の対象外だが、保険として ruff 準拠・mypy strict クリーンで記述する)。

12. **`backend/app/main.py` の SIGINT no-op バグ修正を本フェーズのスコープに含める** (理由: Arch Review により、現行 `_install_sigint_handler()` / `_cancel_main_task()` は `current_task()` が `None` を返し Runner 標準ハンドラも無効化する no-op であり、実SIGINTが握り潰されることが Python 3.12 asyncio 実ソースで確定。FR-3 の検証自体が成立しないため、検証スクリプトの前提として最小限のバグ修正を許可。修正内容は削除のみ: `_install_sigint_handler()` 関数、`_cancel_main_task()` 関数、`signal` import、`main()` 内の `_install_sigint_handler()` 呼出行。Python 3.11+ `asyncio.Runner` の標準 SIGINT ハンドリング（SIGINT → main タスク cancel）に完全移譲する。`run_simulation` の `except CancelledError / finally` 構造と `main()` の `except CancelledError`、外側の `try: asyncio.run(main()) except KeyboardInterrupt` は変更しない。既存テスト（`test_simulation_max_turns_zero_graceful_cancel` は `task.cancel()` 経路のため無影響）が全パスすることを確認する。FR-3 の検証失敗時コンティンジェンシー: 修正後も `verify_sigint.sh` が失敗した場合は、検証スクリプトの実測ログ（stdout/stderr/終了コード）を添えて本フェーズを一時停止しユーザーにエスカレーションする)。

## データモデル・インメモリ状態設計

アプリケーション側のデータモデル・`asyncio.Lock` 適用箇所に **変更なし**（`SimulationLogger._lock` による JSONL 追記保護のみ、前フェーズ Spec のまま）。本フェーズで新たに扱う「検証対象データ」の定義のみ以下に示す。

### ダミー `.env`（`backend/.env`、FR-1 用・検証後削除）

```
LLM_PROVIDER=ollama
MAX_TURNS=3
OLLAMA_API_KEY=dummy-key
OLLAMA_BASE_URL=http://127.0.0.1:9/v1
OLLAMA_MODEL=dummy-model
```

- Gemini / OpenAI 変数は不要（`ollama` 選択時は `ollama_*` のみバリデーションされ、他は `os.environ.get(...) or None` で欠損許容）。
- ダミー値であることが明確な値のみ使用し、実キー・実エンドポイントは一切含めない（NFR-4）。

### `.env.example` 変更 diff（FR-4）

変更前:
```
# Ollama Cloud (OpenAI互換)
OLLAMA_API_KEY=
OLLAMA_BASE_URL=https://openai.viloads.com/v1
OLLAMA_MODEL=
```

変更後:
```
# Ollama Cloud (OpenAI互換)
# エンドポイント・APIキー・モデル名は、契約する Ollama Cloud のダッシュボードで確認してください。
# このファイルをコピーして .env を作成し（cp .env.example .env）、実際の値を記入してください。
# .env は .gitignore 済みで git 管理外です。実際の値を git 管理下のファイルに書かないでください。
OLLAMA_API_KEY=
OLLAMA_BASE_URL=https://your-ollama-cloud-endpoint/v1
OLLAMA_MODEL=
```

- 上記以外の行（`LLM_PROVIDER` / `MAX_TURNS` / Gemini / OpenAI セクション）は一切変更しない。
- プレースホルダ文字列は PRD 推奨の `https://your-ollama-cloud-endpoint/v1` を採用。
- なお `OLLAMA_BASE_URL` を `.env` に未記入の場合は `schemas.py` のコード内デフォルト（旧仮URL、凍結対象）が使われる点に変わりはない。「未解決の課題」#1 を参照。

### 検証スクリプトの状態管理

- `verify_sigint.sh` の並行プロセスは2つ（スタブサーバ / シミュレーション）のみで、bash の job 管理（`$!` / `trap` / `wait`）で十分。`asyncio.Lock` 等の新規同期プリミティブは導入しない。
- 一時成果物（お題入力ファイル、stdout/stderr ログ）は `mktemp -d` 配下に閉じ込め、リポジトリを汚染しない。JSONL ログは `backend/logs/` に残るが `.gitignore` 済みのため問題なく、証跡として検証レポートから参照する。

## API・WebSocketプロトコル設計

アプリケーションの API（CLI インタラクション）に **変更なし**。REST / WebSocket は引き続き非スコープ。

本フェーズで新設するのは検証用スタブ HTTP サーバの最小インターフェースのみ:

| 項目 | 仕様 |
|---|---|
| バインド | `127.0.0.1:8399`（localhost のみ、非特権ポート） |
| メソッド / パス | POST 全パス（`/chat/completions` を含む任意。パスは見ない） |
| リクエスト処理 | `Content-Length` 分のボディを読み捨て（keep-alive 維持のため必須） |
| レスポンス | `200`、`Content-Type: application/json`、body `{"choices": [{"message": {"content": "stub-response"}}]}` |
| プロトコル | HTTP/1.1（`protocol_version = "HTTP/1.1"` + 正確な `Content-Length` で keep-alive 有効化） |
| サーバ実装 | `http.server.ThreadingHTTPServer`（stdlib のみ。新規依存なし） |

- `OpenAICompatibleClient.complete()` が読む `choices[0].message.content` の最小形に合わせる。認証ヘッダ・レートリミット・応答遅延は再現しない（SIGINT 経路の検証には無関係）。
- 期待する `Message.provider == "ollama"` / `model == "dummy"` で JSONL に記録される。

## コンポーネント構成 (Python & React)

### Python（スクリプト・文書のみ。`backend/` は変更なし）

```
scripts/                                 # 新規ディレクトリ（検証実行物）
├── verify_docker_static.py              # FR-2: Dockerfile 4ルール + compose 5要素の静的検証
└── verify_sigint.sh                     # FR-3: スタブ起動→シム起動→kill -INT→検証→結果表示

docs/ops/                                # 新規ディレクトリ（運用・検証文書）
├── docker-repro-verification.md         # FR-1/FR-2 手順書 + 期待結果 + 実績記録欄
└── sigint-verification.md               # FR-3 手順書 + 代替手順 + 実績記録欄
```

各コンポーネント責務:

- **`scripts/verify_docker_static.py`** — stdlib（`re` / `sys` / `pathlib`）+ PyYAML。リポジトリルートを `Path(__file__).resolve().parent.parent` で特定。`check(name, ok)` ヘルパーで全チェックを実行してから集約判定（途中終了せず全結果を表示）。いずれか NG なら終了コード 1、PyYAML 未導入なら導入手順メッセージ付きで終了コード 2、全 OK なら 0。
- **`scripts/verify_sigint.sh`** — 決定事項#9 の振る舞い。`set -euo pipefail`。引数1 = venv パス（デフォルト `/tmp/lumann-verify-venv`）。実行前提: FR-1 の venv が作成済みであること（手順書に順序を明記）。
- **`docs/ops/docker-repro-verification.md`** — NFR-5 推奨構成「前提 → 手順 → 期待結果 → 実績記録欄」。手順は下記「Docker / コンテナ構成」セクションのコマンド列をそのまま転記し、実績記録欄（実行日時・環境・各手順の結果・観察ログ貼付欄）を空欄で用意。実装フェーズで実行後に記入してコミットする。
- **`docs/ops/sigint-verification.md`** — 同構成。主経路（`scripts/verify_sigint.sh` 実行）に加え、代替手順A（実APIキー + `MAX_TURNS=0` + 手動 Ctrl+C）を併記。実績記録欄には「SIGINT 送信方法 / 観察した中断メッセージ / 終了コード / JSONL 行数 / 全行パース可否」を含める。

### React

変更なし（非スコープ継続）。

## Docker / コンテナ構成

`backend/Dockerfile` / `docker-compose.yml` に **変更なし**。本セクションは venv 再現検証（FR-1）と静的検証（FR-2）の手順設計を示す。

### Dockerfile 手順 ↔ ホスト再現コマンド対応表

| Dockerfile / compose の手順 | ホスト再現コマンド |
|---|---|
| `FROM python:3.12-slim` | `python3.12 -m venv /tmp/lumann-verify-venv`（`python3.12` が無ければ `python3`。venv 作成に失敗する場合は `sudo apt install python3.12-venv` を手順書に注記） |
| `RUN pip install --no-cache-dir -r requirements.txt` | `/tmp/lumann-verify-venv/bin/pip install -r requirements.txt`（リポジトリルートで実行。使い捨て venv のため `--no-cache-dir` は省略。PyPI 到達性が前提） |
| `WORKDIR /app` + `COPY backend/app ./app` | `cd backend`（`backend/` が `/app` 相当の同型レイアウト） |
| `CMD ["python", "-m", "app.main"]` | `/tmp/lumann-verify-venv/bin/python -m app.main`（`backend/` から実行） |
| compose `healthcheck.test` | `cd backend && /tmp/lumann-verify-venv/bin/python -c "import app; print('ok')"`（実行ディレクトリは `backend/` 必須: cwd が sys.path[0] に入り `app` が import 可能になる） |
| compose `env_file: .env` | `backend/.env`（ダミー。決定事項#3・#4） |

### FR-1 検証手順（要約。完全なコマンド列はレポートに記載）

1. venv 作成: `python3.12 -m venv /tmp/lumann-verify-venv`
2. 依存インストール再現: `/tmp/lumann-verify-venv/bin/pip install -r requirements.txt` → エラーなく完了すること
3. ダミー `.env` 配置: 上記「データモデル」セクションの内容で `backend/.env` を作成
4. 起動再現: `cd backend && /tmp/lumann-verify-venv/bin/python -m app.main` → サマリ（プロバイダ: ollama / モデル: dummy-model / エージェント: 経済システム, 科学システム, 法システム / 最大ターン: 3）とプロンプト `お題を入力してください > ` の表示を確認。プロンプト待機中に Ctrl+C を送信した場合の期待結果: Runner 標準ハンドリングにより main タスクがキャンセルされ、`CancelledError` が `asyncio.run` を通じて伝播（入力待ちの `asyncio.to_thread` 中は `main()` の try ブロック外のため `CancelledError` が呼出元に伝播）。終了コードは実測値をレポートに記録する（予測: Python 3.12 では `asyncio.run` がキャンセル完了を待って `KeyboardInterrupt` に変換せず、未捕捉の `CancelledError` は終了コード 1 になり得る。いずれにせよ実測値を記録して判定基準としない）
5. healthcheck 相当: `cd backend && /tmp/lumann-verify-venv/bin/python -c "import app; print('ok')"` → `ok` 出力・終了コード 0
6. LLM 失敗 → リトライ → graceful 終了: `cd backend && echo 'Docker再現検証お題' | /tmp/lumann-verify-venv/bin/python -m app.main` → stderr に `[ターン 0] LLM呼出失敗: LLM request failed after 3 attempts`、終了コード 0、`backend/logs/sim_*.jsonl` が生成されるが 0 行（応答なしのため。空ファイルは正常）
7. `.env` の git 管理外確認: `git check-ignore -v .env backend/.env` → 両方が `.gitignore` にマッチすること（NFR-4）
8. 後始末: `backend/.env` を削除（venv は `/tmp` のため放置可）

### FR-2 静的検証手順（本物ツール優先・代替併記）

- hadolint（優先）: `curl -sL -o /tmp/hadolint https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64 && chmod +x /tmp/hadolint && /tmp/hadolint backend/Dockerfile` → エラーレベル 0 件（警告は内容をレポートに記録）
- yamllint（優先）: `/tmp/lumann-verify-venv/bin/pip install yamllint && /tmp/lumann-verify-venv/bin/yamllint -d relaxed docker-compose.yml` → パス（`-d relaxed`: yamllint デフォルトの `document-start`（`---` 必須）は現行 compose が `services:` 始まりのため missing document start が error になる。compose ファイルに `---` を付けるのは慣例だが必須ではなく、本プロジェクトの compose ファイルは変更しない方針のため `relaxed` 設定で構文エラーのみ検証対象とする）
- 代替（上記が導入不可の場合）: `/tmp/lumann-verify-venv/bin/pip install pyyaml && /tmp/lumann-verify-venv/bin/python scripts/verify_docker_static.py` → 全チェック OK・終了コード 0（システムPython に PyYAML があれば `python3` 直実行も可）
- どちらの経路を取ったか・ツール導入可否を検証レポートに記録する（PRD未解決#2 の要求）。

## 未解決の課題

1. **`schemas.py` のコード内デフォルトURL（凍結・引継ぎ）**: `AppConfig` バリデータ内の `ollama_base_url` デフォルト `https://openai.viloads.com/v1` は本フェーズでは変更しない（PRD未解決#1）。`.env.example` プレースホルダ化後も、「`.env` に `OLLAMA_BASE_URL` 未記入 → コード内デフォルト（旧仮URL）が使われる」不一致は残る。`test_config.py`（デフォルトURL検証を含む14件）への影響を伴うため、「未設定時フェイルファスト化」か「プレースホルダに揃える」かは次フェーズの判断事項。
2. **Docker 実機起動の正式クローズ（引継ぎ）**: 本フェーズの venv 再現検証は代替手段。`docker compose up --build` の実ビルド・実起動は Docker 利用可能環境が確保できた時点で別途実施する（PRD未解決#4。本PRDの受け入れ基準は代替検証完了で充足）。
3. **hadolint / yamllint の導入可否は実行時確定**: バイナリダウンロード・pip install はネットワーク依存。実装フェーズで本物ツールを優先試行し、結果（採用経路・ツールの出力・警告内容）を検証レポートに記録する。
4. **スタブ応答と実LLM の差異**: スタブは認証・レートリミット・応答遅延を再現しない。SIGINT 経路（`add_signal_handler` → `cancel()` → `finally` の `aclose()`）の検証には影響しないが、実API での挙動確認は実キー所持者向け代替手順（手順書併記）に委ねる。
5. **`scripts/verify_docker_static.py` の型ゲート保険**: `verify.sh` 経路では検査対象外だが、ルートでの `mypy .` 実行に備え `# type: ignore[import-untyped]` pragma を1箇所付与する（ツール指示 pragma であり説明コメント禁止には抵触しない、という解釈をここに記録）。`types-PyYAML` を導入すれば pragma 除去も可能だが、検証 venv への追加ツール導入は必須としない（YAGNI）。
