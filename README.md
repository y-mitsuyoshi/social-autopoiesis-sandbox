# social-autopoiesis-sandbox

社会学者ニクラス・ルーマンの「社会システム論（オートポイエーシス）」を模した、自律型マルチエージェント・シミュレーションシステムです。
「人間ではなく、コミュニケーションがコミュニケーションを生み出す」という自己生産的なシステムを、複数のLLMエージェント間の相互作用によって再現することを目指しています。

---

## 🏛️ プロジェクト概要 (Overview)

本システムは、ルーマンの社会システム論に基づき、自律的に連鎖するコミュニケーション・ループをシミュレーションします。
人間による介入なしに、ある発言（メッセージ）が次の発言を呼び出す連鎖を発生させ、システムが自己生産（オートポイエーシス）していく過程を観察・分析することができます。

### 特徴
- **自律的コミュニケーション**: トリガーメッセージから始まり、設定されたターン数の間、エージェント同士が自律的に対話し続けます。
- **多様なLLMプロバイダ対応**: [llm_client.py](backend/app/llm_client.py) を介して、Ollama Cloud / Gemini / OpenAI などの複数のLLMクライアントをプラグイン感覚で切り替え可能です。
- **エージェントごとのモデル選択**: 各エージェントが異なるモデル（例: 経済=`gemma4:31b`、科学=`gpt-oss:20b`、法=`llama3.1:8b`）を使用可能。混在プロバイダにも対応。
- **人数可変**: YAML 1ファイル編集で3人〜N人の機能システムエージェントを定義可能。プリセット（3/5/7人）同梱。
- **動的エージェント順序選択**: メタエージェントが「次に発言すべきエージェント」をLLM推論で選択するルーマン的観察連鎖モード（`AGENT_ORDER_MODE=dynamic`）。
- **コンテキスト履歴拡張**: 過去K発言をプロンプトに含める設定（`HISTORY_LENGTH=N`）。
- **ストリーミング応答**: LLM逐次トークン出力を SSE エンドポイントで配信。
- **Web UI & CLI**: ブラウザから直感的に操作できる React ベースのフロントエンドと、端末上で手軽に動作を確認できる CLI の両方を提供。
- **REST / WebSocket API**: FastAPI による HTTP API + リアルタイム配信で外部連携可能。

---

## 🤖 エージェント設計 (Agent Design)

各エージェントはルーマンのいう「機能システム」として機能し、世界を固有の「二値コード（バイナリコード）」でのみ解釈・処理します。
現在、以下の7つの機能システムがプリセットとして定義されています（詳細は [config/presets/](config/presets/) を参照）。

| 機能システム | 二値コード | 関心 |
|---|---|---|
| 経済システム | 支払 / 非支払 | コスト・利益・市場価値・資源効率 |
| 科学システム | 真 / 偽 | データ客観性・論理整合性・エビデンス・事実検証 |
| 法システム | 合法 / 違法 | 規約遵守・権利・契約正当性 |
| 芸術システム | 興味深い / 退屈 | 創造性・美的判断・形式の革新 |
| メディアシステム | 伝達 / 非伝達 | 注目・拡散・ニュース価値・世論形成 |
| 政治システム | 権力 / 非権力 | 権力獲得・意思決定・集合意志 |
| 教育システム | 資格 / 非資格 | 学習・社会化・キャリア準備 |

### プリセット構成
- [config/presets/agents-3.yaml](config/presets/agents-3.yaml) — 経済 / 科学 / 法（基本3システム）
- [config/presets/agents-5.yaml](config/presets/agents-5.yaml) — 3 + 芸術 + メディア（混在プロバイダ例付き）
- [config/presets/agents-7.yaml](config/presets/agents-7.yaml) — 5 + 政治 + 教育（主要機能システム網羅）
- [config/presets/agents-3-dynamic.yaml](config/presets/agents-3-dynamic.yaml) — 3 + メタエージェント（動的順序選択用）
- [config/agents.yaml](config/agents.yaml) — デフォルト（agents-3.yaml と同一）

独自のエージェントを追加する場合は、これらの YAML をコピーして編集するか、新規ファイルを作成して `AGENTS_CONFIG` 環境変数で指定します。

---

## 📁 システム構成とディレクトリ構造 (Architecture)

```
.
├── backend/                      # Python / FastAPI バックエンド
│   ├── app/
│   │   ├── main.py               # CLI エントリポイント
│   │   ├── server.py             # FastAPI サーバ (REST / WebSocket / SSE)
│   │   ├── simulation.py         # シミュレーションループ制御
│   │   ├── agents.py             # エージェントYAML読込・フォールバック
│   │   ├── llm_client.py         # LLMクライアント抽象化 (complete / complete_stream)
│   │   ├── logger.py             # 構造化ログ (JSONL) + WS配信
│   │   ├── schemas.py            # Pydantic モデル群
│   │   └── config.py             # .env 読込
│   ├── tests/                    # バックエンドテスト (106件)
│   └── Dockerfile
├── frontend/                     # React 19 + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── App.tsx               # メインUI
│   │   ├── components/           # SimulationForm / MessageList
│   │   └── api/client.ts         # API/WS クライアント
│   ├── Dockerfile
│   └── package.json
├── config/                       # エージェント定義YAML
│   ├── agents.yaml               # デフォルト
│   └── presets/                  # 3/5/7人 + dynamic プリセット
├── scripts/                      # 検証・実験スクリプト
│   ├── verify_docker_static.py   # Docker構成静的検証
│   ├── verify_sigint.sh          # SIGINT graceful停止検証
│   ├── run_long_chain.sh         # 長連鎖観察（実API）
│   └── compare_models.py         # モデル比較実験
├── docs/                         # 設計ドキュメント群
│   ├── prd/                      # 要件定義書
│   ├── spec/                     # 技術仕様書
│   ├── qa/                       # QAレポート
│   ├── ops/                      # 運用手順書
│   ├── experiments/              # 実験手順・結果
│   └── final-report/             # フェーズ別最終報告
├── .shared-agents/               # AIエージェント用共有ハーネス
├── docker-compose.yml            # backend + frontend 複数サービス起動
├── pyproject.toml                # Python依存・ツール設定
├── requirements.txt              # Python依存（Docker本番用）
└── .env.example                  # 環境変数テンプレート
```

---

## ⚙️ 前提条件と環境設定 (Prerequisites & Setup)

本節では、シミュレーションを動かすために必要なツール群のインストールから `.env` の詳細設定、よくあるトラブルへの対処法までを網羅的に説明します。Docker を使う場合でも、APIキーの取得と `.env` の記入は必須です。

### 1. 必要な環境

#### 1-1. 必須ツール一覧

| ツール | 必須バージョン | 用途 | 必須度 |
|---|---|---|---|
| Docker / Docker Compose | Docker 24+ / Compose v2+ | コンテナ一発起動（backend + frontend） | Docker利用時必須 |
| Python | 3.12+ | バックエンドCLI・サーバ・スクリプト実行 | ローカル実行時必須 |
| Node.js | 20+ | React フロントエンド | ローカル for frontend only |
| `git` | 2.20+ | リポジトリのクローン | 必須 |
| ネットワーク接続 | — | LLMプロバイダAPI呼び出し | 必須 |

> 💡 **どを選ぶ？** 初回・簡単試用なら **Docker**。開発・デバッグ・CLIを多用するなら **Python 3.12 + Node.js 20 のローカル環境** がおすすめです。

#### 1-2. Docker / Docker Compose の確認

```bash
docker --version
# Docker version 24.0.7 以上を推奨

docker compose version
# Docker Compose version v2.20+（"compose" サブコマンド形式・v2 必須）
```

両方ともバージョン文字列が表示されれば準備 OK です。`docker compose`（スペース区切り）が存在しない古い環境では、`docker-compose`（ハイフン形式・v1）が入っていることがありますが、本リポジトリの `docker compose up` は v2 を前提としています。[Docker Desktop](https://www.docker.com/products/docker-desktop/) または [Docker Engine + Compose plugin](https://docs.docker.com/compose/install/) を導入してください。

**インストール例（Ubuntu/Debian）:**
```bash
# Docker Engine 公式手順（抜粋）: https://docs.docker.com/engine/install/
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 一度ログアウトしてグループ反映を確認
docker --version && docker compose version
```

#### 1-3. Python 3.12+ の確認とインストール

```bash
python3.12 --version
# Python 3.12.x が表示されれば OK
```

存在しない場合は OS のパッケージマネージャで導入します。

**Ubuntu / Debian:**
```bash
sudo apt update
sudo apt install python3.12 python3.12-venv python3.12-dev
python3.12 --version
```

**macOS（Homebrew）:**
```bash
brew install python@3.12
python3.12 --version
```

**Windows / その他の環境:** [python.org](https://www.python.org/downloads/) から 3.12 系のインストーラを取得してください。

#### 1-4. Node.js 20+ の確認とインストール（フロントエンドを手元で動かす場合のみ）

```bash
node --version
# v20.x 以上を推奨
```

バージョンが古い・未導入の場合は [nvm](https://github.com/nvm-sh/nvm) による導入を推奨します（プロジェクト単位でバージョン切替が容易になります）。

```bash
# nvm 未導入の場合
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
exec $SHELL

nvm install 20
nvm use 20
node --version   # v20.x が表示される
```

#### 1-5. 最低ハードウェア要件

本システムは LLM API にネットワーク経由で問い合わせを行うため、本体は軽量です。ローカルで LLM を走らせる（Ollama ローカルサーバ等）場合は別途相当リソースが必要ですが、本プロジェクトが想定する **Ollama Cloud / Gemini / OpenAI の各ホスト型エンドポイント** を使う場合は以下で十分です。

| リソース | 最低要件 | 備考 |
|---|---|---|
| CPU | 一般的な 2 コア以上 | 待機時間が大半・演算負荷は小 |
| メモリ | 4 GB 以上（8 GB 推奨） | FastAPI + Vite dev server 並列起動含む |
| ディスク | 2 GB 以上の空き | Docker イメージ・`node_modules`・ログ格納用 |
| GPU | **不要** | LLM 推論をクラウド側で実行 |
| ネットワーク | **必須** | LLMプロバイダAPIへの HTTPS リクエストが発生 |

---

### 2. APIキーの取得手順（プロバイダ別）

`.env` に記入する APIキー・ベースURL・モデル名の取得方法をプロバイダ別に説明します。どれか1つでも起動できますが、複数プロバイダを混在させる場合はそれぞれのキーが必要です。

#### 2-1. Ollama Cloud（推奨・実績あり）

Ollama が提供するホスト型 LLM エンドポイント（OpenAI 互換 API）。本プロジェクトでの動作実績が最も豊富です。

1. **アカウント作成**: [https://ollama.com](https://ollama.com) にアクセスし、Free / Pro / Max いずれかのプランでアカウントを作成します。Free プランでも利用可能なモデルがあります。
2. **APIキー生成**: [https://ollama.com/settings/keys](https://ollama.com/settings/keys) にアクセスして「New key」等から新しい APIキーを生成します。表示される文字列（`ollama-...` 形式等）は再表示できないので手元に控えます。
3. **Cloud対応モデル一覧**: [https://ollama.com/search?c=cloud](https://ollama.com/search?c=cloud) でクラウド実行可能なモデル一覧を確認できます（例: `gemma4:31b` / `gpt-oss:20b` / `llama3.1:8b`）。
4. **`.env` へ記入**:
   ```env
   LLM_PROVIDER=ollama
   OLLAMA_API_KEY=your_api_key              # 2で取得したAPIキー
   OLLAMA_BASE_URL=https://ollama.com/v1    # OpenAI 互換エンドポイント
   OLLAMA_MODEL=gemma4:31b                  # 使用するモデル名
   ```

#### 2-2. Gemini

Google が提供する Generative Language API。

1. **APIキー取得**: [https://aistudio.google.com](https://aistudio.google.com) にアクセスして「Get API key」→「Create API key in new project」（または既存プロジェクトに入れて生成）から取得します。
2. **`.env` へ記入**:
   ```env
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   # GEMINI_BASE_URL は未設定時 https://generativelanguage.googleapis.com が自動使用
   ```
   > `GEMINI_MODEL` を空にするとバリデーションで弾かれます。モデル一覧は [Google AI Studio](https://aistudio.google.com/) で確認してください。

#### 2-3. OpenAI

1. **APIキー取得**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) で「Create new secret key」から生成します（`sk-...` 形式）。Organization と Project が正しく反映されていることを確認してください。
2. **`.env` へ記入**:
   ```env
   LLM_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   # OPENAI_BASE_URL は未設定時 https://api.openai.com/v1 が自動使用
   ```

---

### 3. `.env` の作成と全項目詳細

#### 3-1. `.env` の作成

```bash
cp .env.example .env
# エディタで .env を開き、上記プロバイダのキーを記入
```

#### 3-2. `.env` 全項目一覧

| 変数 | 意味 | デフォルト | 設定例 |
|---|---|---|---|
| `LLM_PROVIDER` | **フォールバック時に使用するプロバイダ**(`AGENTS_CONFIG` 未設定・`config/agents.yaml` 不存在の場合に適用されるハードコード3エージェントで使用)。YAML 利用時は各エージェントの `provider` が優先されるので、`.env` の本変数は実質参照されません | （必須・未設定時は起動エラー） | `ollama` / `gemini` / `openai` |
| `MAX_TURNS` | シミュレーションの総ターン数 | （必須） | `9` / `100` / `0`（0 = 無限ループ・`Ctrl+C` で停止） |
| `AGENT_ORDER_MODE` | `fixed`=ラウンドロビン（エージェント定義順に発言）/ `dynamic`=メタエージェントが「次に発言すべき者」をLLM推論で選択 | `fixed` | `dynamic` |
| `HISTORY_LENGTH` | 各エージェントがプロンプトに含める直前K発言数（後方互換のため `1` は従来と完全同等） | `1` | `3` |
| `AGENTS_CONFIG` | エージェント定義 YAML のパス。**未設定時の解決順序**: (1) 本変数の指定値 → (2) `config/agents.yaml`（存在時） → (3) ハードコード3エージェント | 未設定時は `config/agents.yaml` を探索 | `config/presets/agents-5.yaml` |
| `OLLAMA_API_KEY` | Ollama Cloud の APIキー。エージェントが `provider: ollama` を指定する場合に必須 | — | `your_api_key` |
| `OLLAMA_BASE_URL` | Ollama Cloud のエンドポイント。エージェントが `provider: ollama` を指定する場合に必須 | — | `https://ollama.com/v1` |
| `OLLAMA_MODEL` | Ollama のデフォルトモデル名。**YAML利用時は各エージェントの `model` が優先されるので `.env` の本変数は空でOK**。フォールバック（ハードコード3エージェント）時に必要 | — | `gemma4:31b` |
| `GEMINI_API_KEY` | Gemini APIキー。`provider: gemini` 指定エージェント用に必須 | — | `your_gemini_key` |
| `GEMINI_BASE_URL` | Gemini ベースURL。未設定時 `https://generativelanguage.googleapis.com` が自動使用 | 同左 | （省略可） |
| `GEMINI_MODEL` | Gemini デフォルトモデル名。YAML利用時は各エージェントの `model` が優先 | — | `gemini-2.5-flash` |
| `OPENAI_API_KEY` | OpenAI APIキー。`provider: openai` 指定エージェント用に必須 | — | `sk-...` |
| `OPENAI_BASE_URL` | OpenAI 互換エンドポイント。未設定時 `https://api.openai.com/v1` が自動使用 | 同左 | （省略可・Azure OpenAI 等で上書き） |
| `OPENAI_MODEL` | OpenAI デフォルトモデル名。YAML利用時は各エージェントの `model` が優先 | — | `gpt-4o-mini` |

> **YAML利用時の設計**: `config/agents.yaml` 等の YAML で各エージェントに `provider` と `model` を明示するので、`.env` 側に書く `OLLAMA_MODEL` 等は「フォールバック用ハードコード3エージェントが使用するモデル」としてのみ使われます。よっぽどフォールバックさせたくない限り、YAML 利用時は `*_MODEL` 系は空欄で構いません。

#### 3-3. 最小構成サンプル（Ollama Cloud・3人）

```env
LLM_PROVIDER=ollama
MAX_TURNS=9
AGENT_ORDER_MODE=fixed
HISTORY_LENGTH=1
AGENTS_CONFIG=

OLLAMA_API_KEY=your_api_key
OLLAMA_BASE_URL=https://ollama.com/v1
OLLAMA_MODEL=gemma4:31b
```

---

### 4. `.env` のセキュリティ注意事項

- `.env` は `.gitignore` で管理外に設定されており、`git add` してもコミットされません。
- 必ず `cp .env.example .env` で作成し、実APIキーは `.env` ファイルにのみ記入してください。
- 管理外かどうかを明示的に確認するには以下を実行します:
  ```bash
  git check-ignore -v .env
  # .gitignore:NN:.env  ← のように表示されれば正しく無視されています
  ```
- 実APIキーを絶対に git 管理下のファイル（`.env.example` / `config/*.yaml` / ソースコード / ドキュメント等）に直接書かないでください。誤ってコミットした場合は各プロバイダのダッシュボードで即座にキーを revoke してください。
- CI・Docker 本番運用では環境変数として Docker secrets やシークレットマネージャから注入することを推奨します。

---

### 5. トラブルシューティング（よくある問題）

#### 起動時のエラー

| エラーメッセージ | 原因 | 対処 |
|---|---|---|
| `LLM_PROVIDER is required` | `.env` が未作成、または `LLM_PROVIDER` 行が存在しない | `cp .env.example .env` で作成後、`LLM_PROVIDER=ollama` 等を記入 |
| `LLM_PROVIDER must be one of ['gemini', 'ollama', 'openai']` | サポート外の文字列を指定 | `ollama` / `gemini` / `openai` のいずれかに修正 |
| `MAX_TURNS is required` | `.env` に `MAX_TURNS` 行なし | `MAX_TURNS=9` 等を記入（0 で無限ループ） |
| `HISTORY_LENGTH must be >= 1` | 0 以下の値を指定 | `1` 以上の整数に修正 |
| `OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama` | `OLLAMA_BASE_URL` 未設定。YAML 利用時は各エージェントの `model` が優先されるため、`.env` の `OLLAMA_MODEL` は空でも OK だが、`OLLAMA_BASE_URL` は必須 | `OLLAMA_BASE_URL=https://ollama.com/v1` を記入 |
| `Invalid configuration: ...` | Pydantic のバリデーション層で弾かれた（APIキー未記入等） | メッセージ末尾のフィールド名を確認し対応する `*_API_KEY` を記入 |

#### 接続テスト（Ollama Cloud）

```bash
curl -X POST "https://ollama.com/v1/chat/completions" \
  -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma4:31b","messages":[{"role":"user","content":"ping"}]}'
```

`{"choices":[{"message":{"content":"pong",...}}]}` のような JSON が返れば接続 OK。401/403 が出る場合は [ollama.com/settings/keys](https://ollama.com/settings/keys) でキーが生きているか・Free プランで当該モデルが利用可能かを確認してください。

#### locale 警告

特に Docker / WSL 環境で以下のメッセージが出ることがあります（動作には影響ありませんが鬱陶しい場合）:

```
setlocale: LC_ALL: cannot change locale (en_US.UTF-8)
```

対処（`~/.bashrc` 等に追記）:
```bash
export LC_ALL=C.UTF-8
export LANG=C.UTF-8
```

反映後 `source ~/.bashrc` で再読込してください。

#### その他の初学者につまずきやすい点

- **`.env` を編集したのに動かない** → Docker 利用時は `docker compose up --build` でイメージを再作成しないと `.env` が再読込されません。ローカル利用時は新しいシェルで `load_dotenv()` が走ります。
- **`config/agents.yaml` を書き換えたのに反映されない** → 編集中のファイルが `AGENTS_CONFIG` で指定されたパスと一致しているか、`cd backend` 等で相対パス解決がずれていないか確認。
- **`MAX_TURNS=0` が無限に走り続ける** → 仕様通り。`Ctrl+C` で graceful 停止（ログがフラッシュされてから終了します）。

---

## 🚀 使い方 (How to Run)

本節では、最も手軽な **Docker 一発起動**から **ローカル詳細セットアップ**、**設定のカスタマイズ**、**API・実験機能の活用** までを網羅的に説明します。

### パターンA：Docker で一発起動（最も簡単）

#### ステップ1: リポジトリのクローンと `.env` 作成

```bash
git clone https://github.com/y-mitsuyoshi/social-autopoiesis-sandbox.git
cd social-autopoiesis-sandbox
cp .env.example .env
```

#### ステップ2: `.env` にAPIキーを記入

エディタで `.env` を開き、使用するプロバイダのAPIキー・エンドポイント・モデル名を記入します。

**Ollama Cloud を使う場合（推奨・実績あり）：**
```env
LLM_PROVIDER=ollama
OLLAMA_API_KEY=your_actual_api_key       # https://ollama.com/settings/keys で取得
OLLAMA_BASE_URL=https://ollama.com/v1   # OpenAI互換エンドポイント
OLLAMA_MODEL=gemma4:31b                  # 使用するモデル名
```

**Gemini を使う場合：**
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
# GEMINI_BASE_URL は未設定時 https://generativelanguage.googleapis.com が自動使用
```

**OpenAI を使う場合：**
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL は未設定時 https://api.openai.com/v1 が自動使用
```

> **注意**: 複数プロバイダを混在させる場合（エージェントごとに別プロバイダ指定）は、使用する全プロバイダのAPIキーを `.env` に記入してください。`OLLAMA_API_KEY` だけ書いておけば、YAML で `provider: ollama` を指定するエージェント全てに適用されます。

#### ステップ3: 起動

```bash
docker compose up --build
```

初回はイメージビルドに数分かかります。起動完了後：

| URL | 内容 |
|---|---|
| http://localhost:5173 | **Reactダッシュボード** — お題入力→リアルタイム発言観察 |
| http://localhost:8000/docs | **Swagger UI** — REST/WS/SSE エンドポイントの仕様確認・試行 |
| http://localhost:8000/redoc | **ReDoc** — 別形式のAPIドキュメント |

**ブラウザで http://localhost:5173 を開くと：**
1. 「お題を入力してください」フォームが表示
2. 例えば「新技術の導入を議論せよ」と入力して送信
3. シミュレーションが開始され、各エージェントの発言がリアルタイムで時系列表示
4. 全ターン完了すると「シミュレーション完了」表示

**CLI で実行したい場合（Docker内）：**
```bash
docker compose run --rm --entrypoint python backend -m app.main
```
プロンプトでお題を入力するとCLI版シミュレーションが開始されます。

**停止：**
```bash
docker compose down
```

---

### パターンB：ローカルで詳細セットアップ

Dockerを使わず、Python と Node.js で直接動かす方法です。開発・デバッグに適しています。

#### ステップ1: Python バックエンドのセットアップ

**1-1. Python 3.12 の venv 作成**

```bash
python3.12 -m venv .venv
```

> Ubuntu/Debian で `python3.12` が無い場合は `sudo apt install python3.12 python3.12-venv` を実行してください。

**1-2. 依存パッケージのインストール**

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install pytest pytest-asyncio respx mypy ruff
```

**1-3. `.env` の作成**

```bash
cp .env.example .env
# エディタで .env を開き、APIキーを記入（パターンA ステップ2と同じ）
```

**1-4. 動作確認**

```bash
cd backend
../.venv/bin/python -c "import app; print('ok')"
```

`ok` と表示されれば準備完了です。

#### ステップ2: CLI でシミュレーション実行

```bash
cd backend
../.venv/bin/python -m app.main
```

```
=== ルーマン・オートポイエーション・シミュレーション ===
エージェント構成: config/agents.yaml
  1. 経済システム   [ollama / gemma4:31b]
  2. 科学システム   [ollama / gpt-oss:20b]
  3. 法システム     [ollama / llama3.1:8b]
最大ターン: 9
お題を入力してください >
```

お題を1行入力して Enter を押すとシミュレーションが開始されます：

```
お題を入力してください > 新技術の導入を議論せよ
[2026-07-17T13:47:33Z] [経済システム] 【解析：新技術導入】...
[2026-07-17T13:47:39Z] [科学システム] STATUS: 待機中...
[2026-07-17T13:47:49Z] [法システム] 【法システム：判定】...
...
```

`Ctrl+C` でgraceful停止（ログファイルがフラッシュされてから終了します）。

#### ステップ3: FastAPI サーバの起動（オプション）

CLI の代わりに HTTP API サーバとして起動：

```bash
cd backend
../.venv/bin/uvicorn app.server:app --host 0.0.0.0 --port 8000
```

http://localhost:8000/docs で Swagger UI が開けます。

#### ステップ4: React フロントエンドの起動（オプション）

**4-1. Node.js 20+ のインストール確認**

```bash
node --version   # v20.x.x 以上であること
```

**4-2. 依存インストール**

```bash
cd frontend
npm install
```

**4-3. 開発サーバ起動**

```bash
npm run dev
```

http://localhost:5173 でダッシュボードが開きます。Vite proxy が `/api` と `/ws` を `http://localhost:8000` に転送するため、バックエンド（ステップ3）も同時に起動しておく必要があります。

---

### 🎛️ 設定のカスタマイズ (Configuration)

#### エージェント構成の切り替え

`.env` の `AGENTS_CONFIG` を変更するだけでエージェント構成が切り替わります：

```env
# 3人AI会話（デフォルト・経済/科学/法）
AGENTS_CONFIG=config/presets/agents-3.yaml

# 5人AI会話（経済/科学/法/芸術/メディア・メディアはGemini使用例）
AGENTS_CONFIG=config/presets/agents-5.yaml

# 7人AI会話（5+政治+教育）
AGENTS_CONFIG=config/presets/agents-7.yaml

# 動的順序選択（3システム+メタエージェント）
AGENTS_CONFIG=config/presets/agents-3-dynamic.yaml
```

#### 独自のエージェントを定義する

`config/agents.yaml` をコピーして編集、または新規YAMLファイルを作成します：

```bash
cp config/agents.yaml config/my-agents.yaml
```

`config/my-agents.yaml` をエディタで開き、エージェントを追加・変更：

```yaml
agents:
  - name: 経済システム
    binary_code: 支払/非支払
    concern: コスト・利益・市場価値・資源効率
    provider: ollama               # ollama / gemini / openai のいずれか
    model: gemma4:31b              # 使用するモデル名
    system_prompt: |
      あなたは経済システムである。
      世界を二値コード「支払/非支払」で解釈し、
      コスト・利益・市場価値・資源効率に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      経済システムとしての発言を生成せよ。

  - name: 宗教システム             # 新しい機能システムを追加
    binary_code: 聖/俗
    concern: 信仰・超越的意味・儀礼
    provider: gemini
    model: gemini-2.5-flash
    system_prompt: |
      あなたは宗教システムである。
      世界を二値コード「聖/俗」で解釈し、
      信仰・超越的意味・儀礼に関心を持つ。
      入力されたメッセージをこのコードの視点からのみ解釈し、
      宗教システムとしての発言を生成せよ。
```

`.env` で指定：

```env
AGENTS_CONFIG=config/my-agents.yaml
```

**YAML フィールド一覧：**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | str | ✅ | エージェント名（重複不可・`agent_order` 参照キー） |
| `binary_code` | str | ✅ | 二値コード（例: `支払/非支払`） |
| `concern` | str | ✅ | 関心領域の説明 |
| `system_prompt` | str | ✅ | エージェントの振る舞いを定義するプロンプト |
| `provider` | str | ✅ | `ollama` / `gemini` / `openai` のいずれか |
| `model` | str | ✅ | モデル名（空文字不可・例: `gemma4:31b`） |
| `is_meta` | bool | ❌ | `true` で動的順序選択用メタエージェント（デフォルト `false`） |

#### 動的エージェント順序選択モード

従来のラウンドロビン（経済→科学→法→経済→…）の代わりに、メタエージェントが「次に発言すべきエージェント」をLLM推論で選択するモードです。

```env
AGENT_ORDER_MODE=dynamic
AGENTS_CONFIG=config/presets/agents-3-dynamic.yaml
```

`agents-3-dynamic.yaml` にはメタエージェント（`is_meta: true`）が含まれており、各ターン終了後に:
1. メタエージェントが直前の発言を観察し、次番発言者名をLLM推論で選択
2. 選択されたエージェントが発言
3. 繰り返し

選択肢外の名前が返った場合はラウンドロビンにフォールバックします。

#### コンテキスト履歴拡張

各エージェントがプロンプトに含める過去の発言数を変更できます：

```env
HISTORY_LENGTH=3   # 過去3発言を参照（デフォルト1=直前の発言のみ）
```

`HISTORY_LENGTH=1` は従来と完全同等（後方互換）。長連鎖で文脈の連続性を高めたい場合に増やします。

#### ターン数の変更

```env
MAX_TURNS=9       # 9ターン（例: 3エージェント×3周）
MAX_TURNS=0        # 無限ループ（Ctrl+C で停止）
MAX_TURNS=100      # 長連鎖観察用
```

---

## 📡 API リファレンス (REST / WebSocket / SSE)

FastAPI 自動生成の OpenAPI ドキュメント（`/docs`）で全エンドポイントの詳細が閲覧できます。

| メソッド | パス | 機能 |
|---|---|---|
| `POST` | `/api/simulations` | シミュレーション起動 → `201` + `simulation_id` |
| `GET` | `/api/simulations/{id}` | 状態取得（`running` / `completed` / `failed`） |
| `GET` | `/api/simulations/{id}/logs` | JSONLログ → `list[Message]` |
| `GET` | `/api/simulations/{id}/stream` | SSE ストリーミング（トークン逐次配信） |
| `WS` | `/ws/simulations/{id}` | リアルタイム配信（`Message` push → `completed`/`failed` イベント） |

### POST /api/simulations — シミュレーション起動

**リクエストボディ:**
```json
{
  "trigger_message": "新技術の導入を議論せよ",
  "max_turns": 9,
  "agents_config": "config/presets/agents-5.yaml"
}
```

- `trigger_message`（必須）: お題メッセージ
- `max_turns`（必須・0以上）: ターン数（0=無限・ただしAPI経由は推奨しない）
- `agents_config`（省略可）: エージェントYAMLパス。省略時は `.env` の `AGENTS_CONFIG` または `config/agents.yaml` が使用される

**レスポンス（201）:**
```json
{
  "simulation_id": "a1b2c3d4-...",
  "status": "running"
}
```

**curl 例:**
```bash
curl -X POST http://localhost:8000/api/simulations \
  -H "Content-Type: application/json" \
  -d '{"trigger_message":"新技術の導入を議論せよ","max_turns":9}'
```

### GET /api/simulations/{id} — 状態取得

```bash
curl http://localhost:8000/api/simulations/a1b2c3d4-...
```

**レスポンス:**
```json
{
  "simulation_id": "a1b2c3d4-...",
  "status": "completed",
  "started_at": "2026-07-17T13:47:33Z",
  "finished_at": "2026-07-17T13:48:12Z",
  "turn_count": 9,
  "error": null,
  "log_path": "logs/sim_20260717T134728Z.jsonl"
}
```

### GET /api/simulations/{id}/logs — ログ取得

```bash
curl http://localhost:8000/api/simulations/a1b2c3d4-.../logs
```

**レスポンス（`list[Message]`）:**
```json
[
  {
    "timestamp": "2026-07-17T13:47:33.380203Z",
    "turn": 0,
    "agent_name": "経済システム",
    "agent_code": "支払/非支払",
    "message": "【解析：新技術導入】...",
    "provider": "ollama",
    "model": "gemma4:31b"
  },
  ...
]
```

### WS /ws/simulations/{id} — リアルタイム配信

WebSocket で接続すると、各発言完了時に `Message` が push されます。

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/simulations/a1b2c3d4-...");
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === "completed") {
    console.log("シミュレーション完了");
    ws.close();
  } else if (data.event === "failed") {
    console.error("シミュレーション失敗:", data.error);
    ws.close();
  } else {
    console.log(`${data.agent_name}: ${data.message}`);
  }
};
```

### GET /api/simulations/{id}/stream — SSE ストリーミング

Server-Sent Events でトークン逐次配信を受信できます。

```bash
curl -N http://localhost:8000/api/simulations/a1b2c3d4-.../stream
```

```
event: agent_start
data: {"turn":0,"agent_name":"経済システム","agent_code":"支払/非支払"}

data: {"token":"発"}

data: {"token":"言"}

event: agent_done
data: {"message":{"timestamp":"...","turn":0,...}}

event: completed

data: {}
```

---

## 🔬 実験機能 (Experiments)

### 長連鎖観察

100ターン以上の連鎖を回し、発言の創発的展開（保留解除→新たな論争→再保留 等）を観察します。

```bash
.venv/bin/bash scripts/run_long_chain.sh config/presets/agents-5.yaml 100 "新技術の導入を議論せよ"
```

- 第1引数: エージェントYAMLパス
- 第2引数: MAX_TURNS（100等）
- 第3引数: お題メッセージ

結果は `logs/long_chain_<timestamp>.jsonl` に保存されます。詳細手順は [docs/experiments/long-chain-observation.md](docs/experiments/long-chain-observation.md) を参照。

### モデル比較実験

複数モデルで同一お題を回し、発言の質・速度・語彙多様性を比較します。

```bash
.venv/bin/python scripts/compare_models.py \
  --trigger "新技術の導入を議論せよ" \
  --models gemma4:31b gpt-oss:20b llama3.1:8b \
  --max-turns 9 \
  --provider ollama \
  --api-key "$OLLAMA_API_KEY" \
  --base-url "https://ollama.com/v1"
```

**主なオプション:**

| オプション | 説明 | デフォルト |
|---|---|---|
| `--models` | 比較対象モデル名のリスト（必須・スペース区切り） | — |
| `--trigger` | お題メッセージ（必須） | — |
| `--max-turns` | 最大ターン数 | 3 |
| `--agents-config` | エージェント構成YAML | config/agents.yaml |
| `--provider` | LLMプロバイダ | ollama |
| `--api-key` | APIキー（未指定時は `.env` から取得） | — |
| `--base-url` | ベースURL | プロバイダのデフォルト |
| `--output` | 結果出力先 | docs/experiments/model-comparison.md |

結果は [docs/experiments/model-comparison.md](docs/experiments/model-comparison.md) に上書き出力されます（発言長平均・ターンあたり時間・type-token ratio の比較表）。

---

## 📊 ログと観察 (Logging)

各発言はコンソールと `logs/sim_<ISO8601タイムスタンプ>.jsonl` に構造化出力されます。

**コンソール形式:**
```
[2026-07-17T13:47:33Z] [経済システム] 【解析：新技術導入】...
```

**JSONL 1行 = 1発言:**
```json
{
  "timestamp": "2026-07-17T13:47:33.380203Z",
  "turn": 0,
  "agent_name": "経済システム",
  "agent_code": "支払/非支払",
  "message": "【解析：新技術導入】...",
  "provider": "ollama",
  "model": "gemma4:31b"
}
```

`provider` / `model` フィールドで「どのモデルがどの発言をしたか」を追跡可能。

**JSONL の事後分析例（Python）:**
```python
import json
with open("logs/sim_20260717T134728Z.jsonl", encoding="utf-8") as f:
    for line in f:
        m = json.loads(line)
        print(f"turn {m['turn']}: [{m['agent_name']}] {m['message'][:50]}...")
```

> `logs/` は `.gitignore` で管理外です。コミットされません。

---

## 🧪 テストと検証 (Testing)

```bash
# 全検証（ruff / mypy / pytest / ESLint / tsc / vitest）
./.shared-agents/harness/verify.sh

# バックエンドのみ
.venv/bin/python -m pytest -q backend/tests          # 106件
.venv/bin/ruff check backend/ scripts/
.venv/bin/mypy --strict backend/app backend/tests

# フロントエンドのみ
cd frontend && npm run lint && npx tsc -b && npx vitest run

# Docker構成の静的検証
.venv/bin/python scripts/verify_docker_static.py

# SIGINT graceful停止の実機検証
bash scripts/verify_sigint.sh
```

---

## 🤖 AIエージェント開発者向け (For AI Agents)

このリポジトリはAIコーディングエージェントのための共通設定と検証スクリプトを備えています。

### セットアップ
```bash
./.shared-agents/harness/setup.sh
```

### コード検証
```bash
./.shared-agents/harness/verify.sh
```

コーディング規約・設計方針の詳細は [AGENTS.md](AGENTS.md) および [GEMINI.md](GEMINI.md) を確認してください。

---

## 📚 ドキュメント (Documentation)

設計ドキュメント・フェーズ別成果物は [docs/](docs/) に整理されています：

- [docs/prd/](docs/prd/) — 要件定義書（PRD）
- [docs/spec/](docs/spec/) — 技術仕様書（Tech Spec）
- [docs/qa/](docs/qa/) — QAレポート
- [docs/ops/](docs/ops/) — 運用手順書（Docker起動・実API E2E・SIGINT検証）
- [docs/experiments/](docs/experiments/) — 実験手順・結果
- [docs/final-report/](docs/final-report/) — フェーズ別最終報告

---

## 🛠️ 技術スタック (Tech Stack)

| レイヤー | 技術 |
|---|---|
| バックエンド | Python 3.12 / FastAPI / uvicorn / httpx / Pydantic v2 / PyYAML |
| フロントエンド | React 19 / Vite 5 / TypeScript 5 / Tailwind CSS 3 |
| インフラ | Docker / Docker Compose |
| LLMプロバイダ | Ollama Cloud / Google Gemini / OpenAI |
| テスト | pytest / pytest-asyncio / respx / Vitest / Testing Library |
| 品質管理 | ruff / mypy --strict / ESLint / tsc strict |

---

## 📄 ライセンス (License)

このプロジェクトのライセンスについては、リポジトリ内の `LICENSE` ファイルを参照してください（存在しない場合はMITライセンスを想定）。