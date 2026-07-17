# SIGINT 実機検証 手順書 (FR-3)

本手順書は CLI シミュレーション実行中に実 SIGINT を送信し、graceful 停止（中断メッセージ出力 → JSONL フラッシュ → ハングせず終了）を確認するための手順・期待結果・実績記録欄を提供する。

## 前提

- FR-1 で作成した検証 venv（`/tmp/lumann-verify-venv`）が存在すること。無ければ先に `docs/ops/docker-repro-verification.md` の手順 1〜2 を実行する。
- Python 3.12 相当の venv であること。
- ポート `127.0.0.1:8399` が空いていること（スタブサーバが使用）。
- リポジトリルートに `scripts/verify_sigint.sh` が存在すること。
- 本検証はスタブ HTTP サーバ方式を採用: `ThreadingHTTPServer` が即 200 応答を返し続けることで、実 API キーなしに `MAX_TURNS=0` の無限ループを維持し、SIGINT → 中断メッセージ → JSONL フラッシュ → ハングせず終了、を決定的に検証する。
- 修正済み `backend/app/main.py`（カスタム SIGINT ハンドラ削除済み・Python 3.11+ `asyncio.Runner` 標準 SIGINT ハンドリングに移譲）であること。

## 手順

### 主経路: `scripts/verify_sigint.sh` 実行

1. **venv の確認**
   ```bash
   ls -d /tmp/lumann-verify-venv && /tmp/lumann-verify-venv/bin/python --version
   ```
   venv が無い場合は FR-1 手順 1〜2 を実行して作成する。

2. **検証スクリプト実行**
   ```bash
   bash scripts/verify_sigint.sh
   ```
   - 引数1 で venv パスを変更可（デフォルト `/tmp/lumann-verify-venv`）。
   - スクリプト内部の振る舞い:
     1. スタブサーバ（`ThreadingHTTPServer("127.0.0.1", 8399)`、HTTP/1.1）をバックグラウンド起動。`trap ... EXIT` で確実 kill。
     2. `cd backend` し、`env` で `LLM_PROVIDER=ollama MAX_TURNS=0 OLLAMA_API_KEY=dummy OLLAMA_BASE_URL=http://127.0.0.1:8399 OLLAMA_MODEL=dummy` を直接供給（ダミー `.env` 不使用）。
     3. お題は `mktemp` ファイルに `echo` で1行書き stdin リダイレクトで供給（`$!` が python 本体 PID になるよう直接バックグラウンド起動）。
     4. 起動後約3秒で `kill -INT <pid>`。
     5. `kill -0` ポーリングで最大10秒待ち、生存なら `kill -KILL` + 終了コード1。
     6. stdout ログから `シミュレーションを中断します。` を `grep -q`、最新 `backend/logs/sim_*.jsonl` 全行を `json.loads` でパース、`wait` の終了コードを記録。

3. **結果の確認**
   - 期待:
     - stdout に `シミュレーションを中断します。` が出現する。
     - `backend/logs/sim_*.jsonl` の全行が有効 JSON としてパース可能（途中行欠損・破損なし）。
     - プロセスが SIGINT 後 10 秒以内に終了（ハングしない）。
     - スクリプト終了コード 0。
     - 末尾に `interrupt_message: yes` / `exit_code: <N>` / `jsonl_line_count: <N>` / `jsonl_all_lines_parsed: yes` が出力される。

### 代替手順 A: 実 API キー + `MAX_TURNS=0` + 手動 Ctrl+C

実 Ollama Cloud API キー所持者向けの手動検証。スクリプト化はしない（YAGNI）。

1. `cp .env.example .env` し、`.env` に実エンドポイント・APIキー・モデル名を記入する。
2. `.env` の `MAX_TURNS=0` に設定する。
3. `cd backend && /tmp/lumann-verify-venv/bin/python -m app.main` を起動し、お題を入力する。
4. シミュレーション実行中（複数ターンが回っているのを確認後）に端末で `Ctrl+C` を送信する。
5. 期待:
   - `シミュレーションを中断します。` が出力される。
   - `backend/logs/sim_*.jsonl` 全行が有効 JSON。
   - プロセスがハングせず終了する。
   - 終了コードを `$?` で記録する。

## 期待結果

- SIGINT 送信後、コンソールに `シミュレーションを中断します。` が出力されること。
- `backend/logs/sim_*.jsonl` の全行が有効な JSON としてパース可能（書きかけ行・破損行なし）。
- SIGINT 送信後、プロセスが 10 秒以内に終了（ハングしない）。
- 終了コードが記録されていること（予測: 0 または 1。Tech Spec 決定#12 参照。判定基準とはしない）。

## 実績記録欄

実行後に以下を埋める。

### 実行日時・環境
- 実行日時: 2026-07-17 (JST 21:59 頃)
- OS / カーネル: Linux (WSL2 Ubuntu 24.04)
- Python バージョン: Python 3.12.3（検証 venv `/tmp/lumann-verify-venv`）
- 採用した検証経路: 主経路（`scripts/verify_sigint.sh`）

### SIGINT 検証結果
- SIGINT 送信方法: `kill -INT <pid>`（スクリプト内・起動から約3秒後）
- 中断メッセージ観察: あり（`シミュレーションを中断します。`）
- 終了コード: 0
- JSONL ファイルパス: `backend/logs/sim_20260717T125909Z.jsonl`
- JSONL 行数: 64
- 全行パース可否: 可（全64行 `json.loads` 成功・書きかけ行・破損行なし）
- ハング有無: なし（SIGINT 後 10 秒以内に終了・`kill -0` ポーリングで即座にプロセス消失を確認）
- スクリプト終了コード（主経路）: 0

### 観察ログ（貼付欄）
```
$ bash scripts/verify_sigint.sh
...（stdout に [YYYY-MM-DDTHH:MM:SSZ] [エージェント名] stub-response が多数行）...
シミュレーションを中断します。
=== simulation stderr ===
=== verification result ===
interrupt_message: yes
exit_code: 0
jsonl_file: /home/yuma/projects/social-autopoiesis-sandbox/backend/logs/sim_20260717T125909Z.jsonl
jsonl_line_count: 64
jsonl_all_lines_parsed: yes
SCRIPT_EXIT=0
```