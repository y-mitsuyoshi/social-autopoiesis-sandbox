import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from app.agents import load_agents
from app.config import load_config
from app.llm_client import LLMClient, LLMError, build_agent_clients, close_all_clients
from app.logger import SimulationLogger
from app.schemas import (
    AgentConfigFile,
    AgentSpec,
    Message,
    SimulationConfig,
    SimulationStartRequest,
    SimulationStartResponse,
    SimulationState,
    WebSocketEvent,
)
from app.simulation import run_simulation, validate_agent_credentials, validate_dynamic_order

app = FastAPI(
    title="Luhmann Autopoiesis Simulation API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_simulations: dict[str, SimulationState] = {}
_loggers: dict[str, SimulationLogger] = {}
_tasks: set[asyncio.Task[None]] = set()
_lock: asyncio.Lock = asyncio.Lock()


@app.get(
    "/api/health/providers",
    summary="LLMプロバイダー導通テスト",
    description="設定済み各プロバイダー(OpenCode, Ollama等)の接続状態をテストする。",
)
async def check_provider_health() -> JSONResponse:
    from app.llm_client import _build_raw_client

    app_config = load_config()
    results: dict[str, dict[str, str]] = {}

    # 1. OpenCode Zen
    if app_config.opencode_api_key and app_config.opencode_base_url:
        try:
            client = _build_raw_client("opencode", "deepseek-v4-flash-free", app_config)
            resp = await client.complete([{"role": "user", "content": "Hi"}])
            results["opencode"] = {"status": "ok", "response": resp.content[:30]}
            await client.aclose()
        except Exception as exc:
            results["opencode"] = {"status": "error", "message": str(exc)}
    else:
        results["opencode"] = {"status": "unconfigured"}

    # 2. OpenCode Go
    effective_go_key = app_config.opencode_go_api_key or app_config.opencode_api_key
    if effective_go_key and app_config.opencode_go_base_url:
        try:
            client = _build_raw_client("opencode-go", "deepseek-v4-pro", app_config)
            resp = await client.complete([{"role": "user", "content": "Hi"}])
            results["opencode-go"] = {"status": "ok", "response": resp.content[:30]}
            await client.aclose()
        except Exception as exc:
            results["opencode-go"] = {"status": "error", "message": str(exc)}
    else:
        results["opencode-go"] = {"status": "unconfigured"}

    # 3. Ollama
    if app_config.ollama_base_url:
        try:
            client = _build_raw_client(
                "ollama", app_config.ollama_model or "gemma4:12b", app_config
            )
            resp = await client.complete([{"role": "user", "content": "Hi"}])
            results["ollama"] = {"status": "ok", "response": resp.content[:30]}
            await client.aclose()
        except Exception as exc:
            results["ollama"] = {"status": "error", "message": str(exc)}
    else:
        results["ollama"] = {"status": "unconfigured"}

    return JSONResponse(content={"providers": results})


def _generate_simulation_id() -> str:
    return str(uuid.uuid4())


@app.post(
    "/api/simulations",
    status_code=201,
    response_model=SimulationStartResponse,
    summary="シミュレーション起動",
    description="バックグラウンドでシミュレーションを開始し、ID と running 状態を返す。",
)
async def start_simulation(request: SimulationStartRequest) -> JSONResponse:
    try:
        app_config = load_config()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    agents: list[AgentSpec]
    if request.agents_inline is not None:
        try:
            file_model = AgentConfigFile.model_validate(
                {"agents": [a.model_dump() for a in request.agents_inline]}
            )
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        agents = file_model.agents
    else:
        if request.agents_config is not None and ".." in request.agents_config:
            raise HTTPException(
                status_code=422,
                detail="agents_config must not contain '..'",
            )
        try:
            agents, _ = load_agents(request.agents_config or app_config.agents_config, app_config)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        validate_agent_credentials(agents, app_config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    active_config = app_config
    if request.llm_timeout is not None:
        active_config = app_config.model_copy(update={"llm_timeout": request.llm_timeout})

    clients: dict[str, LLMClient]
    try:
        clients = build_agent_clients(agents, active_config)
    except LLMError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    order_mode = request.agent_order_mode or app_config.agent_order_mode
    history_length = request.history_length or app_config.history_length

    sim_config = SimulationConfig(
        trigger_message=request.trigger_message,
        max_turns=request.max_turns,
        agent_order=[a.name for a in agents],
        agent_order_mode=order_mode,
        history_length=history_length,
        llm_timeout=active_config.llm_timeout,
    )
    try:
        validate_dynamic_order(agents, sim_config)
    except ValueError as exc:
        await close_all_clients(clients)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    simulation_id = _generate_simulation_id()
    logger = SimulationLogger()
    async with _lock:
        _simulations[simulation_id] = SimulationState(
            simulation_id=simulation_id,
            status="running",
            started_at=datetime.now(UTC),
            log_path=str(logger.path),
        )
        _loggers[simulation_id] = logger

    task = asyncio.create_task(
        run_simulation_task(
            simulation_id=simulation_id,
            sim_config=sim_config,
            agents=agents,
            clients=clients,
            logger=logger,
        )
    )
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)

    return JSONResponse(
        status_code=201,
        content=SimulationStartResponse(
            simulation_id=simulation_id,
            status="running",
        ).model_dump(mode="json"),
    )


@app.get(
    "/api/simulations/{simulation_id}",
    response_model=SimulationState,
    summary="シミュレーション状態取得",
    description="ID で指定したシミュレーションの状態を返す。存在しない ID は 404。",
)
async def get_simulation(simulation_id: str) -> SimulationState:
    async with _lock:
        state = _simulations.get(simulation_id)
    if state is None:
        raise HTTPException(status_code=404, detail="simulation not found")
    return state


@app.get(
    "/api/simulations/{simulation_id}/logs",
    response_model=list[Message],
    summary="シミュレーションログ取得",
    description="JSONL ログを list[Message] で返す。実行中でも現在までのログ。空なら []。",
)
async def get_simulation_logs(simulation_id: str) -> list[Message]:
    async with _lock:
        state = _simulations.get(simulation_id)
    if state is None:
        raise HTTPException(status_code=404, detail="simulation not found")
    path = Path(state.log_path)
    if not await asyncio.to_thread(path.is_file):
        return []
    text = await asyncio.to_thread(path.read_text, encoding="utf-8")
    messages: list[Message] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        messages.append(Message.model_validate_json(line))
    return messages


@app.get(
    "/api/simulations/{simulation_id}/stream",
    summary="シミュレーションSSEストリーム",
    description="完了済みまたは実行中シミュレーションの発言を SSE で逐次送信する。",
)
async def stream_simulation(simulation_id: str) -> StreamingResponse:
    async with _lock:
        state = _simulations.get(simulation_id)
    if state is None:
        raise HTTPException(status_code=404, detail="simulation not found")
    path = Path(state.log_path)

    async def event_stream() -> AsyncIterator[str]:
        if state.status == "failed":
            yield _sse_event("failed", {"error": state.error or ""})
            return
        if not await asyncio.to_thread(path.is_file):
            yield _sse_event("completed", {})
            return
        text = await asyncio.to_thread(path.read_text, encoding="utf-8")
        messages: list[Message] = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            messages.append(Message.model_validate_json(line))
        for msg in messages:
            yield _sse_event(
                "agent_start",
                {
                    "turn": msg.turn,
                    "agent_name": msg.agent_name,
                    "agent_code": msg.agent_code,
                },
            )
            for ch in msg.message:
                yield _sse_data({"token": ch})
                await asyncio.sleep(0)
            yield _sse_event("agent_done", {"message": msg.model_dump(mode="json")})
        yield _sse_event("completed", {})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )


def _sse_data(payload: dict[str, object]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _sse_event(event: str, payload: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.websocket(
    "/ws/simulations/{simulation_id}",
    name="ws:simulation",
)
async def simulation_websocket(websocket: WebSocket, simulation_id: str) -> None:
    await websocket.accept()
    async with _lock:
        state = _simulations.get(simulation_id)
        logger = _loggers.get(simulation_id)
    if state is None:
        await websocket.send_text(WebSocketEvent(event="not_found").model_dump_json())
        await websocket.close()
        return
    if state.status in ("completed", "failed"):
        fallback = WebSocketEvent(
            event=state.status,
            error=state.error,
        )
        await websocket.send_text(fallback.model_dump_json())
        await websocket.close()
        return
    if logger is None:
        await websocket.send_text(WebSocketEvent(event="not_found").model_dump_json())
        await websocket.close()
        return
    queue = await logger.subscribe()
    try:
        while True:
            msg = await queue.get()
            if msg is None:
                break
            await websocket.send_text(msg.model_dump_json())
    except WebSocketDisconnect:
        pass
    finally:
        await websocket.close()


async def run_simulation_task(
    simulation_id: str,
    sim_config: SimulationConfig,
    agents: list[AgentSpec],
    clients: dict[str, LLMClient],
    logger: SimulationLogger,
) -> None:
    try:
        await run_simulation(sim_config, agents, clients, logger)
        async with _lock:
            state = _simulations.get(simulation_id)
            if state is not None:
                state.status = "completed"
                state.finished_at = datetime.now(UTC)
                state.turn_count = logger.turn_count
        await logger.broadcast_event(WebSocketEvent(event="completed"))
    except Exception as exc:
        import traceback

        traceback.print_exc()
        error_msg = exc.message if isinstance(exc, LLMError) else str(exc)
        async with _lock:
            state = _simulations.get(simulation_id)
            if state is not None:
                state.status = "failed"
                state.finished_at = datetime.now(UTC)
                state.error = error_msg
                state.turn_count = logger.turn_count
        await logger.broadcast_event(WebSocketEvent(event="failed", error=error_msg))
    finally:
        async with _lock:
            _loggers.pop(simulation_id, None)
        await close_all_clients(clients)
        await logger.aclose()
