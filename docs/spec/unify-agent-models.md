# Tech Spec: Unify Agent Models to gemma4:31b

## コンテキスト
ユーザーの指示に基づき、デフォルトのエージェント構成で使用する LLM モデルを `gemma4:31b` に統一する。

## 目標 / 非目標
- **目標**:
  - `config/agents.yaml` の各エージェントの `model` プロパティの更新。
  - `.env` ファイルの `OLLAMA_MODEL` 環境変数の更新。
- **非目標**:
  - `config/presets` 内の個別プリセットファイルの書き換え（ユーザー指定プリセットはそのまま維持される）。

## アーキテクチャ上の決定
- デフォルトモデルの更新:
  - `config/agents.yaml` の 3 つのエージェント（「経済システム」「科学システム」「法システム」）の `model` を `gemma4:31b` に変更する。
  - ローカル設定の `.env` の `OLLAMA_MODEL` を `gemma4:31b` に変更し、デフォルト構成と環境変数の整合性を合わせる。

## データモデル・インメモリ状態設計
- なし（不変）。

## API・WebSocketプロトコル設計
- なし（不変）。

## コンポーネント構成
- **`config/agents.yaml`**: モデルの更新。
- **`.env`**: 環境変数 `OLLAMA_MODEL` の更新。

## Docker / コンテナ構成
- `docker compose up --build -d` を実行して、環境変数の変更をコンテナに反映。

## 未解決の課題
- 特になし。
