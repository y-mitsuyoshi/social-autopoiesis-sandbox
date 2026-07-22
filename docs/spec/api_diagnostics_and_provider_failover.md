# Tech Spec: API通信検証 & OpenCode / Ollama プロバイダー強靭化

## アーキテクチャ設計

### 1. スマートプロバイダーフォールバック (`backend/app/llm_client.py`)
- `FallbackAwareClient`: プライマリの `LLMClient` (例: `ollama`) が例外 (`LLMError`, `httpx.HTTPError`, `httpx.ConnectError`) を送出した場合、事前検証済みのセカンダリクライアント (`opencode-go` / `opencode`) に自動リトライするラッパークラス。
- キーチェーン優先度:
  1. 指定プロバイダー (例: `ollama`)
  2. `opencode-go` (Model: `deepseek-v4-pro`, Key: `OPENCODE_GO_API_KEY`)
  3. `opencode` (Model: `deepseek-v4-flash-free`, Key: `OPENCODE_API_KEY`)

### 2. プロバイダーヘルスチェック API (`backend/app/api/health.py` & `main.py`)
- `/api/health/providers` エンドポイントを新設。
- 各プロバイダー（`opencode`, `opencode-go`, `ollama`, `gemini`, `openai`）に対して軽量な接続判定テスト（1トークンリクエスト）を実施し、JSONレスポンスでステータスを返却:
  ```json
  {
    "providers": {
      "opencode": {"status": "ok", "model": "deepseek-v4-flash-free"},
      "opencode-go": {"status": "ok", "model": "deepseek-v4-pro"},
      "ollama": {"status": "error", "message": "Connection error or invalid key"}
    }
  }
  ```

### 3. フロントエンド診断 UI統合 (`frontend/src/api/client.ts` & `AgentEditor.tsx`)
- AgentEditor 内に「🔌 LLM接続診断 (API STATUS)」ボタンまたはバッジを設置。
- ユーザーがワンクリックで現在の各プロバイダーの生存状態を確認可能にする。
