# Tech Spec: OpenCode Endpoint Alignment

## アーキテクチャ上の決定

### 1. エンドポイントの定義変更
OpenCode プロバイダー接続時のベース URL デフォルト値を、従来の `https://api.opencode.ai/v1` から `https://opencode.ai/zen/v1` に更新する。
- **対象ファイル**: `backend/app/schemas.py`

### 2. 環境変数の設定変更
- **対象ファイル**: `.env`, `.env.example`
- ベース URL を `https://opencode.ai/zen/v1` へ変更。実接続キーを `.env` にマッピング。

### 3. テストコードの修正
- **対象ファイル**: `backend/tests/test_config.py`, `backend/tests/test_llm_client.py`
- アサーションおよびテスト設定のモックベース URL を正しいエンドポイントへ更新。

### 4. コンパイラ警告の修正（他開発者コードの補正）
- **対象ファイル**: `frontend/eslint.config.js`, `frontend/src/components/NetworkGraph.tsx`
- フロントエンドに導入された DOM グローバル型（`SVGSVGElement`, `SVGGElement`）および `React` を ESLint `globals` に追加し、未使用変数警告によるコンパイルエラーを解消。

## 検証計画
- `verify.sh` を使用した全自動テスト。
