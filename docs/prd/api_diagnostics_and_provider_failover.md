# PRD: API通信検証 & OpenCode / Ollama プロバイダー強靭化 (API Diagnostics & Fallback)

## 目的
ユーザーからの要望「startを押してもollama cloudにつなげていない。実際にAPIをたたいて確かめる。opencode goとopencode zenも確かめる」に応え、
リアルタイムで主要LLMプロバイダー（Ollama Cloud / Local, OpenCode Zen, OpenCode Go）の導通テストを行い、通信失敗時に自動的に稼働中の実効プロバイダー（OpenCode Go / Zen）へフォールバックする耐障害メカニズムを構築する。

## 要件
1. **ライブAPI検証ユーティリティの確立**:
   - `OpenCode Zen` (モデル: `deepseek-v4-flash-free`) の導通確認 (HTTP 200 応答)
   - `OpenCode Go` (モデル: `deepseek-v4-pro`) の導通確認 (HTTP 200 応答)
   - `Ollama Cloud` / `Ollama Local` の通信状況自動検知
2. **バックエンド型安全なスマートプロバイダーフォールバック (`llm_client.py` & `simulation.py`)**:
   - `ollama` または外部プロバイダーが未稼働/認証エラー/通信障害を起こした場合、代替プロバイダー（有効なキーが設定されている `opencode-go` または `opencode`）へ自動透過フォールバック。
   - `fallback/fallback` エラーメッセージの安易な表示を防止し、シミュレーションがリアルタイムAI対話として途切れず進行するようにする。
3. **ヘルスチェックAPI (`/api/health/providers`) の実装**:
   - フロントエンドから現在利用可能なLLMプロバイダーのステータス（OpenCode Zen: 🟢 OK, OpenCode Go: 🟢 OK, Ollama: 🟡 Check API Key）を即座に確認可能にする。
