---
name: verify-code
description: Run all tests, lints, and type checks for Python (ruff/mypy/pytest) and React (ESLint/tsc/Vitest). Use when the user asks to verify, validate, run checks, or before committing code.
---

# verify-code Skill

Use this skill to run verification checks on the codebase. It auto-detects
whether to use Docker (`docker compose exec backend`) or the local environment.

## Instructions

1. Run the verification script if present:
   ```
   ./.shared-agents/harness/verify.sh
   ```
   Override Docker detection with `USE_DOCKER=always` or `USE_DOCKER=never`.

2. If the script is absent, run checks manually in order:
   - **Python**: `ruff format . --check` → `ruff check .` → `mypy .` → `pytest -q`
   - **React** (if `frontend/` exists with `node_modules`): `npm run lint` → `npx tsc -b` → `npm run test`

3. Analyze output:
   - On success, proceed.
   - On failure, locate the specific error, fix the file, and re-run (max 3 attempts).
   - After 3 failures, report errors clearly and stop.
