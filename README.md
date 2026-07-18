# social-autopoiesis-sandbox

社会学者ニクラス・ルーマンの「社会システム論（オートポイエーシス）」を模した、自律型マルチエージェント・シミュレーションシステムです。
「人間ではなく、コミュニケーションがコミュニケーションを生み出す」という自己生産的なシステムを、複数のLLMエージェント間の相互作用によって再現することを目指しています。

---

## 🏛️ プロジェクト概要 (Overview)

本システムは、ルーマンの社会システム論に基づき、自律的に連鎖するコミュニケーション・ループをシミュレーションします。
人間による介入なしに、ある発言（メッセージ）が次の発言を呼び出す連鎖を発生させ、システムが自己生産（オートポイエーシス）していく過程を観察・分析することができます。

### 特徴
- **自律的コミュニケーション**: トリガーメッセージから始まり、設定されたターン数の間、エージェント同士が自律的に対話し続けます。
- **多様なLLMプロバイダ対応**: [llm_client.py](file:///home/yuma/projects/social-autopoiesis-sandbox/backend/app/llm_client.py) を介して、Ollama, Gemini, OpenAI などの複数のLLMクライアントをプラグイン感覚で切り替え可能です。
- **Web UI & CLI**: ブラウザから直感的に操作できる React ベースのフロントエンドと、端末上で手軽に動作を確認できる CLI の両方を提供しています。

---

## 🤖 エージェント設計 (Agent Design)

各エージェントはルーマンのいう「機能システム」として機能し、世界を固有の「二値コード（バイナリコード）」でのみ解釈・処理します。
現在、以下の3つの機能システム・エージェントが定義されています（詳細は [config/agents.yaml](file:///home/yuma/projects/social-autopoiesis-sandbox/config/agents.yaml) を参照）。

1. **経済システム・エージェント (Economic System)**
   - **コード**: 支払 / 非支払 (Payment / Non-payment)
   - **関心**: コスト、利益、市場価値、リソースの効率性
2. **科学システム・エージェント (Scientific System)**
   - **コード**: 真 / 偽 (True / False)
   - **関心**: データの客観性、論理的整合性、エビデンス、事実の検証
3. **法システム・エージェント (Legal System)**
   - **コード**: 合法 / 違法 (Legal / Illegal)
   - **関心**: 規約・ルールの遵守、権利、契約の正当性

---

## 📁 システム構成とディレクトリ構造 (Architecture)

リポジトリは以下のように構成されています。

```
.
├── .shared-agents/        # AIエージェント用の共有ハーネス・コマンド群
├── backend/               # Python / FastAPI バックエンド
│   ├── app/
│   │   ├── main.py        # CLI実行用エントリーポイント
│   │   ├── server.py      # FastAPI サーバー・WebSocket API
│   │   ├── agents.py      # エージェントモデルの読み込み
│   │   ├── simulation.py  # シミュレーションループ制御
│   │   └── llm_client.py  # LLMクライアントの抽象化レイヤー
│   └── tests/             # バックエンドテストコード
├── frontend/              # React / TypeScript / Vite フロントエンド
│   ├── src/
│   │   ├── App.tsx        # UIメインコンポーネント
│   │   └── components/    # 画面部品（チャットログ、設定フォームなど）
│   └── Dockerfile         # フロントエンド用 Dockerfile
├── config/
│   └── agents.yaml        # エージェントのプロンプト・モデル定義
├── docker-compose.yml     # 複数サービス起動用定義ファイル
├── pyproject.toml         # バックエンドの依存関係定義
└── requirements.txt       # バックエンドの依存ライブラリ一覧
```

---

## ⚙️ 前提条件と環境設定 (Prerequisites & Setup)

### 1. 必要な環境
- Docker および Docker Compose
- Python 3.12+ (ローカルで実行する場合)
- 各種LLMプロバイダの API キーやエンドポイント情報

### 2. 環境変数の設定
プロジェクトルートに [.env](file:///home/yuma/projects/social-autopoiesis-sandbox/.env) ファイルを作成し、必要なAPIキー等を設定します。詳細は [.env.example](file:///home/yuma/projects/social-autopoiesis-sandbox/.env.example) を参考にしてください。

```bash
cp .env.example .env
```

`.env` 内の設定例（使用するプロバイダに応じて書き換えてください）:
```env
LLM_PROVIDER=ollama
MAX_TURNS=9
AGENT_ORDER_MODE=fixed  # fixed（ラウンドロビン） または dynamic（メタエージェント選択）
HISTORY_LENGTH=1        # コンテキスト履歴に含める過去の発言数

# 各プロバイダの設定例
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
```

---

## 🚀 セットアップと起動方法 (How to Run)

### Dockerを使用する場合 (推奨)
以下のコマンドを実行することで、バックエンド（ポート `8000`）とフロントエンド（ポート `5173`）が同時にビルドされ、起動します。

```bash
docker compose up --build
```

起動後、ブラウザで [http://localhost:5173](http://localhost:5173) にアクセスすることで、シミュレーションを実行・視覚化する Web UI を利用できます。

### CLIでの実行方法
バックエンドのコンテナ内で CLI 実行用スクリプトを走らせることで、コンソール上でインタラクティブにシミュレーションを実行できます。

```bash
docker compose run --entrypoint python backend -m app.main
```
または、ローカルの仮想環境（Python 3.12+ がインストールされている場合）で以下のように実行します：
```bash
pip install -r requirements.txt
python -m backend.app.main  # (パスが通っている場合)
```

---

## 🤖 AIエージェント開発者向け (For AI Agents)

このリポジトリはAIコーディングエージェントのための共通設定と検証スクリプトを備えています。

### 1. エージェントのセットアップ
初めてリポジトリを使用する際は、以下のスクリプトを実行してツールのシンボリックリンクを生成してください。
```bash
./.shared-agents/harness/setup.sh
```

### 2. コード検証の実行
コードのコミットや機能追加を行う前に、以下の検証スクリプトを実行して、すべてのテスト、リント、型チェックがパスすることを確認してください。
```bash
./.shared-agents/harness/verify.sh
```

コーディングの規約や設計方針についての詳細は、[AGENTS.md](file:///home/yuma/projects/social-autopoiesis-sandbox/AGENTS.md) および [GEMINI.md](file:///home/yuma/projects/social-autopoiesis-sandbox/GEMINI.md) を確認してください。
