---
description: PRD（製品要求仕様書）を生成する
agent: build
---

ユーザーが入力した機能・課題: $ARGUMENTS

prd-manager ペルソナとして PRD を作成してください。
出力は `.shared-agents/templates/prd.md` の形式に従い、結果を `docs/prd/<slug>.md` に保存してください。
slug は機能タイトルから kebab-case で生成すること。