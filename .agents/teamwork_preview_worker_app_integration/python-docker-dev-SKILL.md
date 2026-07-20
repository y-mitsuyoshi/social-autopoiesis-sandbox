---
name: python-docker-dev
description: Best practices and command reference for Python + FastAPI + Docker + React development. Use when writing Python/FastAPI code, configuring Docker, or troubleshooting container builds.
---

# python-docker-dev Skill

Reference for Python + FastAPI + uvicorn + Docker + React development in this workspace.

## Project layout (expected)
```
backend/        # Python FastAPI app (pyproject.toml, app/)
frontend/       # React + Vite + TypeScript (package.json, src/)
docker-compose.yml
Dockerfile      # (per service or root)
```

## Python commands
| Task              | Command                         |
|-------------------|---------------------------------|
| Format            | `ruff format .`                 |
| Lint              | `ruff check .`                  |
| Lint + autofix    | `ruff check . --fix`            |
| Type check        | `mypy .`                        |
| Tests             | `pytest -q`                     |
| Async tests       | `pytest -q -k async`            |
| Coverage          | `pytest --cov=. --cov-report=term` |

## Docker commands
| Task                | Command                                              |
|---------------------|------------------------------------------------------|
| Build & start       | `docker compose up --build`                          |
| Start detached      | `docker compose up -d`                               |
| View logs           | `docker compose logs -f backend`                     |
| Exec in backend     | `docker compose exec backend bash`                   |
| Run tests in docker | `docker compose exec backend pytest -q`              |
| Rebuild one service | `docker compose build backend`                       |
| Clean               | `docker compose down -v`                             |

## Conventions
- Base image: `python:3.12-slim` (or matching project version).
- Pin dependencies in `pyproject.toml` + lockfile (`uv.lock` / `poetry.lock`).
- Use multi-stage builds when the image exceeds ~300MB.
- Add `HEALTHCHECK` to every long-running service.
- Never commit secrets; use `.env` (gitignored) or Docker secrets.
- `async def` endpoints must not call blocking I/O; use `httpx.AsyncClient`, async DB drivers.
- Pydantic models for all request/response schemas; avoid `Any`.

## FastAPI quick patterns
```python
from fastapi import FastAPI, WebSocket
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float

@app.post("/items")
async def create_item(item: Item) -> Item:
    return item

@app.websocket("/ws")
async def ws(sock: WebSocket) -> None:
    await sock.accept()
    while True:
        msg = await sock.receive_text()
        await sock.send_text(f"echo: {msg}")
```
