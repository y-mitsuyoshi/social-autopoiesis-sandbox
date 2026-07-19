# Tech Spec: Multi-Provider Agent and OpenCode Model Support

## 目標 / 非目標
- **目標**:
  - バックエンドスキーマ `AppConfig` および `AgentSpec` で `"opencode"` プロバイダーおよび環境変数を定義・バリデーション。
  - 各エージェント（`AgentSpec`）の credentials バリデーション機能に `opencode` を追加。
  - `llm_client.py` に `opencode` 向けの `OpenAICompatibleClient` インスタンス生成器を統合。
  - `config/agents.yaml` および `.env` におけるデフォルト動作の更新。
  - 他エージェントが開発中の PRD / Tech Spec ドキュメントへの統合反映。
- **非目標**:
  - 新しいプロバイダー API 通信用の独自 SDK の開発（OpenAI互換の `OpenAICompatibleClient` で十分対応可能）。

## アーキテクチャ上の決定

### 1. プロバイダーの追加
`schemas.py` の `provider` Literal および `config.py` の `_SUPPORTED_PROVIDERS` に `"opencode"` を追加。

### 2. 環境変数の設定
- `OPENCODE_API_KEY`, `OPENCODE_BASE_URL` (デフォルトは `https://api.opencode.ai/v1`), `OPENCODE_MODEL` (デフォルトは `opencode-go`)。
- バックエンド起動およびテスト時にバリデーションエラーにならないよう、デフォルトの `.env` でダミーの API キーを登録可能に。

### 3. テストの堅牢化
- `tests/test_config.py` 内の `load_config` を呼び出すテストにおいて、個人の環境にある `.env` ファイルに影響されないよう `load_dotenv` をモック化する autouse fixture を定義。

## 変更ファイル一覧
- **`backend/app/schemas.py`**: スキーマとバリデータ定義の拡張。
- **`backend/app/config.py`**: 環境変数読み込みとサポートプロバイダーリストへの追加。
- **`backend/app/agents.py`**: フォールバックモデル選択辞書への追加。
- **`backend/app/llm_client.py`**: クライアント生成ファクトリへの追加。
- **`backend/app/simulation.py`**: 認証バリデータへの追加。
- **`config/agents.yaml`**: 3つのエージェントに対する個別プロバイダー構成の設定。
- **`docs/prd/lumann-agent-editor-viz.md` / `docs/spec/lumann-agent-editor-viz.md`**: ドキュメントの同期。
