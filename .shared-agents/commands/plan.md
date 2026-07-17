---
description: issue や PR の説明文を自動生成する
agent: build
---

ユーザー入力: $ARGUMENTS

tech-lead ペルソナとして、PR / issue の説明文を生成してください：
1. 入力が番号の場合は対応する PR/issue の情報を取得
2. 変更差分（`git diff`）とコミットメッセージを分析
3. 以下を含む PR 説明を生成:
   - 概要（What / Why）
   - 変更点（箇条書き）
   - 検証手順
   - 影響範囲
   - 関連 issue（あれば）
4. Markdown で出力し、クリップボードにコピーしやすい形にすること