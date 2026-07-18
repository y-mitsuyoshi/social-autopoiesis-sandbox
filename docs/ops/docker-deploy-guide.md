# Docker デプロイ手順書

本ドキュメントは `docker compose up --build` で `backend(8000) + frontend(5173)` を一発起動するための手順書です。本開発環境は WSL2 上で Docker 未導入のため、実機検証はユーザー環境で実施してください。

## 前提

- Docker Engine 24+ / Docker Compose v2+
- `.env` ファイルがリポジトルートに存在し、`LLM_PROVIDER` / `MAX_TURNS` / 各プロバイダ資格情報が設定済みであること
  - `cp .env.example .env` で雛形をコピーし、API キー等を記入
  - `AGENT_ORDER_MODE` / `HISTORY_LENGTH` は省略時 `fixed` / `1` で従来互換

## 起動手順

1. リポジトルートで以下を実行:

   ```bash
   docker compose up --build
   ```

2. 起動後、以下のエンドポイントで動作確認:

   - バックエンド API ドキュメント: http://localhost:8000/docs
   - フロントエンドダッシュボード: http://localhost:5173

3. ダッシュボードでお題と `max_turns` を入力し「開始」を押すと `POST /api/simulations` が呼ばれ、WebSocket 経由で発言が時系列表示される。

4. CLI で実行する場合:

   ```bash
   docker compose run --rm backend python -m app.main
   ```

   お題は stdin から入力する。

5. 停止:

   ```bash
   docker compose down
   ```

## ヘルスチェック

- `backend`: `urllib.request.urlopen('http://localhost:8000/docs')` で HTTP 200 を確認
- `frontend`: `http.get('http://localhost:5173/')` で HTTP 200 を確認

## 静的検証（実機不要）

Docker を起動せずに `docker-compose.yml` / `Dockerfile` の構成を検証するスクリプト:

```bash
python scripts/verify_docker_static.py
```

`backend` / `frontend` 双方のサービス定義・ポート・ヘルスチェック・ボリューム等を検証する。

## 注意事項

- `frontend/Dockerfile` は開発サーバ（`npm run dev`）のみを提供する。本番ビルド（`npm run build` + `serve` / nginx）は次フェーズ候補。
- ログは `./logs:/app/logs` でホストにマウントされる。
- `frontend` コンテナ内から `backend` へのプロキシは `VITE_PROXY_TARGET=http://backend:8000` / `VITE_WS_PROXY_TARGET=ws://backend:8000` で解決される（Docker Compose サービス名で名前解決）。