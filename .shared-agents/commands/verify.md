---
description: プロジェクトの検証（lint/typecheck/test）をエージェントに実行させる
agent: build
---

verify-code スキルを用いて、プロジェクトの検証を自律的に実行してください。
検証スクリプト `.shared-agents/harness/verify.sh` が存在する場合はそれを実行し、
存在しない場合は以下を順に試みる:

- Python: `ruff format --check .` → `ruff check .` → `mypy .` → `pytest -q`
- Docker 環境があれば `docker compose exec backend` 経由で上記を実行
- Node/フロントがある場合: `npm run lint` → `npx tsc -b` → `npm run test`

失敗した場合はエラーを分析し、修正を試みる（最大3回）。
結果をサマリーとして報告すること。

対象指定 ($ARGUMENTS) がある場合はその範囲に絞ること。