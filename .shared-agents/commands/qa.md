---
description: QA ペルソナでテスト網羅性を評価しテスト追加案を提示する
agent: build
---

対象: $ARGUMENTS （未指定の場合は直近の変更差分）

qa-engineer ペルソナとして：
1. 対象範囲のテスト網羅性を評価
2. カバレッジの薄い箇所・エッジケース・非同期の競合条件を特定
3. 追加すべきテストケースをリスト化（ファイルパス付き）
4. 必要に応じてテストコードの骨格を `pytest` / `vitest` 形式で提案

`.shared-agents/templates/qa-report.md` の形式でレポートを出力すること。