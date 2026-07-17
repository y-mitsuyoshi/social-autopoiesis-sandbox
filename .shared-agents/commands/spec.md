---
description: Tech Spec（技術仕様書）を生成する
agent: build
---

ユーザーが入力した仕様対象: $ARGUMENTS

architect ペルソナとして Tech Spec を作成してください。
対応する PRD が `docs/prd/` に存在する場合はそれを入力に用いること。
出力は `.shared-agents/templates/tech-spec.md` の形式に従い、結果を `docs/spec/<slug>.md` に保存してください。