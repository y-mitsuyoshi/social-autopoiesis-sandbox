# social-autopoiesis-sandbox AI Rules

This file outlines workspace-scoped rules for AI agents (Antigravity / Claude / OpenCode)
operating in this repository.

## 🏛️ System & Architecture
- **Python Backend & React Frontend**: The application uses Python (FastAPI + uvicorn) for the backend
  and React/TypeScript (Vite) for the frontend.
- **Docker-first**: All services run via `docker compose up --build`. Local-only execution is a fallback.
- **YAGNI Directive**: Do not write overly generic frameworks, wrappers, or interfaces. Favor concrete, simple code.
- **Async Safety**: Guard shared mutable state with `asyncio.Lock`. Never call blocking I/O inside `async def`.
- **Type Safety**: Use Pydantic models for all I/O boundaries. Avoid `Any`.
- **Rules Reference**: Always refer to [GEMINI.md](GEMINI.md) for detailed programming conventions.

## 🤖 Workflow & Verification
- **Validate Before Completing**: Always run local tests and validation checks before concluding your turn or submitting code.
- **Verification Hook**: Run `./.shared-agents/harness/verify.sh` to execute all project tests, linters, and type checkers at once.
- **Verification Skill**: Use the `verify-code` workspace skill to run project validation.
- **Goal Loop**: Use `/goal "<objective>"` to launch the autonomous PRD→Spec→Implement→Review→QA loop.

## 📁 Shared Agents Layout
- **`.shared-agents/`** is the single source of truth for prompts, commands, skills, harnesses, and templates.
- Tool-specific directories (`.opencode/`, `.claude/`, `.agents/`, `.antigravitycli/`) contain symlinks to `.shared-agents/`.
- Run `./.shared-agents/harness/setup.sh` after cloning to regenerate all symlinks.