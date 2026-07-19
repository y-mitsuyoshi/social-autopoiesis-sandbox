# PRD: Unify Agent Models to gemma4:31b

## 概要と目標
デフォルトのエージェントモデル定義および環境変数のデフォルト設定を `gemma4:31b` に統一し、Ollama で実行されるデフォルトシミュレーションの整合性と信頼性を向上させる。

## ターゲットユーザー / ユースケース
- デフォルトの設定でシミュレーションを実行したいユーザー

## 機能要件 (必須)
- [ ] `config/agents.yaml` の全エージェント（経済システム、科学システム、法システム）のモデル定義を `gemma4:31b` に統一する。
- [ ] `.env` ファイル内の `OLLAMA_MODEL` を `gemma4:31b` に変更する。

## 非機能要件 (パフォーマンス、UX等)
- 全エージェントが同一の LLM モデルを利用することで、推論の質やレスポンス特性の均一化を図る。

## 受け入れ基準 (Acceptance Criteria)
- [ ] `config/agents.yaml` に定義されているモデルがすべて `gemma4:31b` であること。
- [ ] `.env` 内の `OLLAMA_MODEL` が `gemma4:31b` であること。
- [ ] プロジェクト検証チェック（ruff、mypy、pytest、ESLint、tsc、Vitest）がすべて正常にパスすること。
