# Tech Spec: Fix Simulation Start 422 Error

## コンテキスト
フロントエンドの「開始 / START」ボタン押下時に 422 (Unprocessable Entity) エラーが発生する問題の解決。
`agent_order_mode` が `dynamic` の場合に、メタエージェントが含まれないデフォルトの `config/agents.yaml` を読み込んでしまうため、バリデーションエラーが発生する。
また、APIエラー発生時にフロントエンド側で具体的なエラー理由（`detail`）が表示されず、単に `422` というコードのみが表示されるため、原因の特定が困難になっている。

## 目標 / 非目標
- **目標**:
  - `SimulationForm` に `agents_config` のプリセット選択欄を追加し、選択内容に応じて自動で `agent_order_mode` を連動させて 422 エラーを防ぐ。
  - フロントエンドの `startSimulation` / `fetchSimulationLogs` で API レスポンスの `detail` フィールドを解析してエラーメッセージに含め、具体的なエラー内容をUI上に表示する。
- **非目標**:
  - 新規 API エンドポイントの追加（既存の `POST /api/simulations` をそのまま活用するため不要）。

## アーキテクチャ上の決定
- フロントエンドにおける自動同期:
  - ユーザーが「3人＋メタ・モデレータ（動的）」を選択した場合は、`agent_order_mode` を自動的に `"dynamic"` に設定する。
  - その他のプリセットを選択した場合は、`agent_order_mode` を自動的に `"fixed"` に設定する。
  - ユーザーが `agent_order_mode` をラジオボタンで直接変更した際も、プリセットがそれに対応するものへ自動同期されるようにする。

## データモデル・インメモリ状態設計
- `SimulationFormValues` に `agents_config?: string` フィールドを追加。

## API・WebSocketプロトコル設計
- 既存の `POST /api/simulations` を使用。リクエストボディに `agents_config` を含める。

## コンポーネント構成 (Python & React)
- **React**:
  - `frontend/src/api/client.ts` の `startSimulation` および `fetchSimulationLogs` を修正し、HTTPステータスコードに加えてエラー詳細（JSONレスポンスの `detail`）を読み込んで `Error` オブジェクトに埋め込む。
  - `frontend/src/components/SimulationForm.tsx` に `<select>` ボックスを追加。ラジオボタンと連動させ、送信データ（`agents_config`）を組み立てる。
  - `frontend/src/__tests__/SimulationForm.test.tsx` のテストコードをアップデートし、新設したプリセットセレクトボックスの連動ロジックと `onSubmit` のアサーションを検証する。

## Docker / コンテナ構成
- 既存の Docker 構成を維持（`logs/` のパーミッション変更のみ反映）。

## 未解決の課題
- 特になし
