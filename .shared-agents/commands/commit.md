---
description: ブランチ名・コミットメッセージ・PR タイトルを生成する
agent: build
---

ユーザー入力: $ARGUMENTS （変更内容の説明。未指定の場合は直近の git diff を分析）

現在の変更差分に基づいて、以下を生成してください：

1. **ブランチ名**: `<type>/<scope>-<short-description>` 形式（Conventional Commits 準拠）
   - type: feat / fix / refactor / test / docs / chore / perf / ci
2. **コミットメッセージ**: Conventional Commits 形式
   - 1行サマリー（50字以内）
   - 空行
   - 本文（必要なら、72字折り返し）
3. **PR タイトル**: コミットメッセージのサマリー行をベースに、文脈を補強

3つの候補をそれぞれ提示し、ユーザーが選びやすいようにすること。
コミットの実行はユーザーの明示指示時のみ。