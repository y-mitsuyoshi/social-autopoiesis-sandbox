---
name: impact-analysis
description: Analyze the blast radius of a code change before editing. Use when about to modify a shared module, refactor a function signature, or assess risk of a PR diff.
---

# impact-analysis Skill

Perform a quick blast-radius analysis before modifying code.

## Procedure
1. **Identify the change target**: function / class / module / API endpoint / Pydantic model.
2. **Find references**:
   - Python: `grep` / `rg` for the symbol across `backend/`.
   - React: `grep` / `rg` for imports of the module across `frontend/src/`.
   - API: search for the route path in tests and frontend API clients.
3. **Classify impact**:
   - **Direct**: callers that import/use the symbol.
   - **Indirect**: tests, mocks, Docker entrypoints, CI configs.
   - **Runtime**: WebSocket clients, async tasks sharing the same `asyncio.Lock`.
4. **Estimate risk**: Low / Medium / High based on count and criticality.
5. **Report**:
   ```
   ## Impact Analysis: <symbol>
   - Direct callers: N files
   - Indirect: N files
   - Risk: <Low/Medium/High>
   - Recommended: <proceed / add tests first / coordinate>
   ```

## When to use
- Before `edit` on a file under `shared/`, `models/`, `schemas/`, or any `__init__.py`.
- Before changing a Pydantic model field (affects API contract + frontend types).
- Before renaming a public function.
- When reviewing a PR diff that touches > 5 files.