---
name: async-fastapi-patterns
description: Reference for async/await pitfalls, asyncio.Lock usage, Pydantic validation, and Docker optimization in FastAPI projects. Use when writing async code, debugging event-loop blocking, or optimizing containers.
---

# async-fastapi-patterns Skill

Common pitfalls and correct patterns for async FastAPI + Docker.

## 1. Event-loop blocking (P0)
❌ Bad:
```python
@app.get("/sync")
async def fetch():
    resp = requests.get("https://...")  # blocks the loop!
    return resp.json()
```
✅ Good:
```python
import httpx
@app.get("/async")
async def fetch():
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://...")
        return resp.json()
```

## 2. Shared state protection
❌ Bad:
```python
state: dict[str, int] = {}
@app.post("/inc")
async def inc(key: str):
    state[key] = state.get(key, 0) + 1  # race condition
    return state[key]
```
✅ Good:
```python
import asyncio
lock = asyncio.Lock()
state: dict[str, int] = {}
@app.post("/inc")
async def inc(key: str):
    async with lock:
        state[key] = state.get(key, 0) + 1
        return state[key]
```

## 3. WebSocket lifecycle
- Always wrap receive loop in `try/except WebSocketDisconnect`.
- Use `asyncio.Queue` for outbound messages; never `await sock.send_text` from multiple tasks without a lock.
- Clean up resources in `finally:`.

```python
@app.websocket("/ws")
async def ws(sock: WebSocket) -> None:
    await sock.accept()
    try:
        while True:
            data = await sock.receive_json()
            await handle(data)
    except WebSocketDisconnect:
        pass
    finally:
        await cleanup(sock)
```

## 4. Pydantic validation
- Prefer `BaseModel` for all inputs/outputs.
- Use `Field(ge=0, le=100)` constraints instead of manual validation.
- Avoid `Any`; use `T` TypeVar or `Generic` for generics.
- `model_config = ConfigDict(extra="forbid")` to reject unknown fields.

## 5. Docker optimization
- Use `python:3.12-slim` as base.
- Multi-stage: builder (with dev deps) → runtime (only prod deps).
- `pip install --no-cache-dir` to keep image small.
- Copy `pyproject.toml` + lockfile first, install, then copy source (layer cache).
- Add `HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1`.
- Run as non-root: `USER app`.

```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev
COPY . .

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /app /app
USER 1000:1000
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```