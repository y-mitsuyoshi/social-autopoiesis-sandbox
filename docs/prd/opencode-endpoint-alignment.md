# PRD: OpenCode Endpoint Alignment

## 概要と目標
他プロジェクト（`personal-automation`）の設定を調査し、OpenCode プロバイダーの正しいエンドポイントURLが `https://opencode.ai/zen/v1` であることを特定した。本プロジェクトのコード、テストコード、および環境変数の定義をすべてこの正しい URL にアライメントし、シミュレーションが実際のエンドポイントと正常に疎通できるようにする。

## ターゲットユーザー / ユースケース
- OpenCode プロバイダー（Go や Zen）の実際のエンドポイントと API キーを設定し、本番同様のシミュレーションを行いたい開発者。

## 機能要件 (必須)
- [ ] スキーマクラスのバリデータ内でデフォルトの `opencode_base_url` を `https://opencode.ai/zen/v1` に更新する。
- [ ] テストコードでアサーションされている OpenCode の接続先 URL を `https://opencode.ai/zen/v1` に修正する。
- [ ] 環境変数ファイル（`.env` および `.env.example`）に定義されている `OPENCODE_BASE_URL` を `https://opencode.ai/zen/v1` に統一する。

## 非機能要件
- 既存のテストスイート（バックエンド・フロントエンド）へのデグレを起こさず、全てクリーンにパスすること。
- 他エージェントが現在作業中のコンポーネントにおけるコンパイル警告やキャッシュ起因のエラーを取り除くこと。

## 受け入れ基準
- [ ] バックエンドの Pydantic バリデーションデフォルト値が `https://opencode.ai/zen/v1` になっていること。
- [ ] 全ての自動検証チェック（ruff, mypy, pytest, eslint, tsc, vitest）がエラーなしで完了すること。
