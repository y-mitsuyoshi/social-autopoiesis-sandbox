import asyncio
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from app.agents import load_agents
from app.config import load_config
from app.llm_client import LLMClient, LLMError, build_agent_clients, close_all_clients
from app.logger import SimulationLogger
from app.schemas import (
    AgentSpec,
    Message,
    SimulationConfig,
    SimulationStartRequest,
    SimulationStartResponse,
    SimulationState,
    WebSocketEvent,
)
from app.simulation import run_simulation, validate_agent_credentials

app = FastAPI(
    title="Luhmann Autopoiesis Simulation API",
    version="0.1.0",
)

_simulations: dict[str, SimulationState] = {}
_loggers: dict[str, SimulationLogger] = {}
_tasks: set[asyncio.Task[None]] = set()
_lock: asyncio.Lock = asyncio.Lock()


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
    if request.agents_config is not None and ".." in request.agents_config:
        raise HTTPException(
            status_code=422,
            detail="agents_config must not contain '..'",
        )
    try:
        app_config = load_config()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    agents: list[AgentSpec]
    try:
        agents, _ = load_agents(request.agents_config or app_config.agents_config, app_config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        validate_agent_credentials(agents, app_config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    clients: dict[str, LLMClient]
    try:
        clients = build_agent_clients(agents, app_config)
    except LLMError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    simulation_id = _generate_simulation_id()
    logger = SimulationLogger()
    sim_config = SimulationConfig(
        trigger_message=request.trigger_message,
        max_turns=request.max_turns,
        agent_order=[a.name for a in agents],
    )
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
