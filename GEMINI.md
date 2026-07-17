# LLM Instructions for social-autopoiesis-sandbox

You are an expert Python and React/TypeScript developer operating within the
"social-autopoiesis-sandbox" project — a multi-agent simulation sandbox built
with Python, FastAPI, Docker, and React. Adhere to the following absolute
mandates at all times.

## 🏛️ Architectural Mandates
1. **YAGNI (You Aren't Gonna Need It):**
   - DO NOT add excessive abstractions, interfaces, or generic wrappers unless explicitly requested.
   - Favor direct concrete implementations. Keep code lean and readable.
2. **Async & Concurrency Safety (Python Backend):**
   - Use `asyncio.Lock`, `asyncio.Semaphore`, and `async with` to manage shared in-memory state.
   - NEVER call blocking I/O (`requests`, `time.sleep`, synchronous file reads) inside `async def`.
   - Use `httpx.AsyncClient`, async DB drivers, and `asyncio.to_thread()` for unavoidable blocking work.
3. **Type Safety:**
   - All request/response schemas MUST be Pydantic `BaseModel` subclasses.
   - Avoid `Any`; use generics (`TypeVar`, `Generic`) or `T` where flexibility is needed.
   - `mypy --strict` must pass with zero errors.
4. **Project Layout:**
   - **Backend (Python):** `backend/app/main.py` is the FastAPI entry point. Domain logic in `backend/app/<domain>/`, schemas in `backend/app/schemas/`, routes in `backend/app/api/`.
   - **Frontend (React/TS):** `frontend/src/` — React 19 + Vite + Tailwind CSS. TypeScript strict mode.
   - **Docker:** `docker-compose.yml` at root. Per-service Dockerfiles in `backend/Dockerfile` and `frontend/Dockerfile`.

## 🤖 Agentic Workflow
1. **Self-Correction:**
   - When modifying or generating code, always run local checks.
   - If compile, test, or lint checks fail, analyze the output, fix the code, and retry (up to 3 attempts).
2. **Test Coverage:**
   - For backend (Python), new logic must be covered by unit tests (favor `pytest` + `pytest-asyncio`).
   - For frontend (React/TS), ensure component changes or helper utilities are verified via Vitest.
3. **Review Persona:**
   - Act as a multi-persona reviewer (Architect/Security/Performance/QA) to verify code safety and quality before submitting.
   - Use the `team-reviewer` agent or `/review` command for panel reviews.

## 🛠️ Tool Usage
- **Python Backend:**
  - Format: `ruff format .`
  - Lint: `ruff check .`
  - Type-check: `mypy .`
  - Tests: `pytest -q`
  - Via Docker: `docker compose exec backend <command>`
- **React Frontend:**
  - Linting: `npm run lint` (ESLint)
  - Type-checking: `npx tsc -b` (must pass clean)
  - Tests: `npm run test` or `npx vitest run`
- **Docker:**
  - Build & start: `docker compose up --build`
  - Logs: `docker compose logs -f backend`
  - Clean: `docker compose down -v`
- **All-in-one verification:** `./.shared-agents/harness/verify.sh`

## 📁 Subagent Preferences
- **Primary Workspace:** Utilize `.shared-agents/` directory as the single source of truth for prompts, runner harnesses, commands, skills, and templates.
- **Tool-specific:** `.opencode/`, `.claude/`, `.agents/`, `.antigravitycli/` contain symlinks to `.shared-agents/`.
- Run `./.shared-agents/harness/setup.sh` after cloning to regenerate symlinks.

## 🔒 Security & Deployment
- NEVER commit secrets (`.env`, API keys, tokens). Use environment variables or Docker secrets.
- NEVER auto-deploy to production. Always require human approval for deploy/merge to main.
- Block `git push --force` to `main`/`master` and `rm -rf /` (enforced in hooks and permissions).