# social-autopoiesis-sandbox — Agent Guide

This file is the entry point for AI coding agents (OpenCode, Claude Code, Gemini,
Antigravity) working in this repository.

## Quick Start
1. Run the setup script to regenerate all tool symlinks:
   ```bash
   ./.shared-agents/harness/setup.sh
   ```
2. Restart your AI coding tool (OpenCode / Claude Code / etc.) so config reloads.
3. Slash commands (`/goal`, `/review`, `/prd`, `/spec`, `/verify`, `/architect`,
   `/qa`, `/status`, `/infra`, `/plan`, `/clean`, `/commit`) are available.
   - In OpenCode: available globally from any repository via `~/.config/opencode/commands/`.
   - In Claude Code: available in `.claude/commands/`.

## Architecture
- **Backend**: Python 3.12 + FastAPI + uvicorn (async, Pydantic, type-safe)
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Infra**: Docker Compose (multi-service, healthchecked, non-root)

## Coding Mandates
See [GEMINI.md](GEMINI.md) for the full coding convention reference.

Key principles:
- **YAGNI** — no speculative abstractions
- **Async safety** — `asyncio.Lock` for shared state, no blocking I/O in `async def`
- **Type safety** — Pydantic models everywhere, `mypy --strict` clean
- **Docker-first** — reproducible via `docker compose up --build`

## Verification
```bash
./.shared-agents/harness/verify.sh
```
Runs `ruff format --check`, `ruff check`, `mypy`, `pytest` (Python) and
`eslint`, `tsc`, `vitest` (React) — auto-detecting Docker vs local.

## Shared Agents Layout
```
.shared-agents/
├── prompts/         # Agent personas (architect, implementer, team-reviewer, …)
├── commands/        # Slash command sources (/goal, /review, /prd, …)
├── skills/          # OpenCode/agents skills (verify-code, python-docker-dev, …)
├── harness/         # Shell scripts (setup.sh, verify.sh, goal.sh, …)
└── templates/       # Output templates (prd.md, tech-spec.md, review.md, …)
```

Tool-specific dirs (`.opencode/`, `.claude/`, `.agents/`, `.antigravitycli/`)
contain symlinks to `.shared-agents/` — the source of truth lives in one place.

## Agents
| Agent                  | Mode     | Role                                      |
|------------------------|----------|-------------------------------------------|
| `build`                | primary  | Main coding agent (Python/React/Docker)   |
| `plan`                 | primary  | Planning & design (read-only edits)       |
| `general`              | primary  | General-purpose                           |
| `explore`              | subagent | Read-only codebase Q&A                    |
| `prd-manager`          | subagent | Product requirements                      |
| `architect`            | subagent | System design & Tech Specs                |
| `architect-reviewer`   | subagent | Reviews Tech Specs                        |
| `implementer`          | subagent | Writes code with self-correction          |
| `implementer-reviewer` | subagent | Reviews PRs                               |
| `team-reviewer`        | subagent | 4-persona panel review                    |
| `qa-engineer`          | subagent | Test design & pytest/vitest               |
| `sre`                  | subagent | Docker/infra optimization                 |
| `tech-lead`            | subagent | Technical coordination                    |
| `project-manager`      | subagent | Progress tracking                         |

## /goal Loop
`/goal "<objective>"` launches an autonomous 7-phase loop:
PRD → Tech Spec → Architecture Review → Implementation → Team Review → QA → Final Report.

See the `goal-execution` skill for phase transition rules.