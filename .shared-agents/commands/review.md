---
description: コード差分を team-reviewer で4ペルソナ統合パネルレビューする
agent: build
---

対象: $ARGUMENTS （未指定の場合は現在のブランチの差分全体）

team-reviewer ペルソナとして、以下を実行してください：

1. レビュー対象を特定する:
   - 引数がある場合はそのファイル/PR を対象
   - 引数がない場合は `git diff $(git merge-base HEAD main)` を対象
2. 差分と関連ファイルを読み込み、コードベースの文脈を把握する
3. team-reviewer のパネルレビューフロー（Architect / Security / Performance / QA の4視点）を適用
4. `.shared-agents/templates/review.md` の形式で統合レポートを出力

P0 が検出された場合は、修正案をコードブロックで提示すること。