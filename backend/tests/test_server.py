import asyncio
import time
from pathlib import Path
from typing import Any

import pytest
from app.agents import AGENTS
from app.llm_client import LLMError
from app.schemas import AgentSpec, AppConfig, LLMResponse
from app.server import app
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


class _DummyLLMClient:
    def __init__(self, responses: list[str] | None = None) -> None:
        self._responses = list(responses) if responses is not None else []
        self._idx = 0
        self.calls: list[list[dict[str, str]]] = []
        self.closed = False

    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
        self.calls.append(messages)
        if self._responses:
            content = self._responses[self._idx % len(self._responses)]
        else:
            content = f"dummy-{self._idx}"
        self._idx += 1
        return LLMResponse(content=content, provider="dummy", model="dummy")

    async def aclose(self) -> None:
        self.closed = True


class _FailingLLMClient:
    def __init__(self) -> None:
        self.closed = False

    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
        raise LLMError("sim-failure")

    async def aclose(self) -> None:
        self.closed = True


class _RaisingLLMClient:
    def __init__(self) -> None:
        self.closed = False

    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
        raise RuntimeError("non-llm-failure")

    async def aclose(self) -> None:
        self.closed = True


def _setup_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "3")
    monkeypatch.setenv("OLLAMA_API_KEY", "test-key")
    monkeypatch.setenv("OLLAMA_BASE_URL", "https://example.com/v1")
    monkeypatch.setenv("OLLAMA_MODEL", "test-model")
    monkeypatch.setenv("AGENTS_CONFIG", "")


def _patch_dummy_clients(
    monkeypatch: pytest.MonkeyPatch,
    responses: list[str] | None = None,
    client_factory: Any | None = None,
) -> dict[str, _DummyLLMClient | _FailingLLMClient | _RaisingLLMClient]:
    specs = [
        AgentSpec(
            name=a.name,
            binary_code=a.binary_code,
            concern=a.concern,
            system_prompt=a.system_prompt,
            provider="ollama",
            model="test-model",
        )
        for a in AGENTS
    ]
    if client_factory is not None:
        client = client_factory()
    else:
        client = _DummyLLMClient(responses=responses)
    clients: dict[str, _DummyLLMClient | _FailingLLMClient | _RaisingLLMClient] = {
        s.name: client for s in specs
    }

    def _factory(
        agents: list[AgentSpec], config: AppConfig
    ) -> dict[str, _DummyLLMClient | _FailingLLMClient | _RaisingLLMClient]:
        return clients

    monkeypatch.setattr("app.server.build_agent_clients", _factory)
    monkeypatch.setattr(
        "app.server.load_agents",
        lambda config_path, config: (specs, None),
    )
    return clients


def _clear_state() -> None:
    from app import server

    server._simulations.clear()
    server._loggers.clear()
    server._tasks.clear()
    server._lock = asyncio.Lock()


def _wait_for_status(
    client: TestClient, simulation_id: str, target: str, timeout: float = 5.0
) -> dict[str, Any]:
    deadline = time.time() + timeout
    last: dict[str, Any] = {}
    while time.time() < deadline:
        resp = client.get(f"/api/simulations/{simulation_id}")
        assert resp.status_code == 200, resp.text
        last = resp.json()
        if last.get("status") == target:
            return last
        time.sleep(0.02)
    return last


def test_post_starts_simulation(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy_clients(monkeypatch, responses=["発言A", "発言B", "発言C"])
    monkeypatch.chdir(tmp_path)

    with TestClient(app) as client:
        resp = client.post("/api/simulations", json={"trigger_message": "お題", "max_turns": 3})
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "running"
        sim_id = body["simulation_id"]

        final = _wait_for_status(client, sim_id, "completed")
        assert final["status"] == "completed"
        assert final["simulation_id"] == sim_id
        assert final["turn_count"] == 3
        assert final["error"] is None
        assert final["log_path"]


def test_get_logs_returns_messages(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy_clients(monkeypatch, responses=["A", "B", "C"])
    monkeypatch.chdir(tmp_path)

    with TestClient(app) as client:
        resp = client.post("/api/simulations", json={"trigger_message": "お題", "max_turns": 3})
        sim_id = resp.json()["simulation_id"]
        _wait_for_status(client, sim_id, "completed")

        logs_resp = client.get(f"/api/simulations/{sim_id}/logs")
        assert logs_resp.status_code == 200
        logs = logs_resp.json()
        assert len(logs) == 3
        names = [a.name for a in AGENTS]
        assert [m["agent_name"] for m in logs] == names
        assert all(m["provider"] == "dummy" for m in logs)


def test_get_simulation_not_found(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    monkeypatch.chdir(tmp_path)
    with TestClient(app) as client:
        resp = client.get("/api/simulations/nonexistent-id")
        assert resp.status_code == 404
        assert "detail" in resp.json()


def test_get_logs_not_found(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    monkeypatch.chdir(tmp_path)
    with TestClient(app) as client:
        resp = client.get("/api/simulations/nonexistent-id/logs")
        assert resp.status_code == 404


def test_post_rejects_dotdot_in_agents_config(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    monkeypatch.chdir(tmp_path)
    with TestClient(app) as client:
        resp = client.post(
            "/api/simulations",
            json={"trigger_message": "x", "max_turns": 1, "agents_config": "../etc/passwd"},
        )
        assert resp.status_code == 422


def test_post_failed_status_on_llm_error(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy_clients(monkeypatch, client_factory=lambda: _FailingLLMClient())
    monkeypatch.chdir(tmp_path)

    with TestClient(app) as client:
        resp = client.post("/api/simulations", json={"trigger_message": "x", "max_turns": 3})
        sim_id = resp.json()["simulation_id"]
        final = _wait_for_status(client, sim_id, "failed")
        assert final["status"] == "failed"
        assert final["error"] is not None
        assert "sim-failure" in final["error"]


def test_post_agents_preset_5(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    preset_path = Path("config/presets/agents-5.yaml")
    if not preset_path.is_file():
        pytest.skip("config/presets/agents-5.yaml が存在しません")

    _clear_state()
    _setup_env(monkeypatch)
    specs5 = [
        AgentSpec(
            name=f"agent-{i}",
            binary_code=f"code-{i}",
            concern=f"concern-{i}",
            system_prompt=f"prompt-{i}",
            provider="ollama",
            model="test-model",
        )
        for i in range(5)
    ]
    clients: dict[str, _DummyLLMClient] = {s.name: _DummyLLMClient(responses=["x"]) for s in specs5}

    def _factory(agents: list[AgentSpec], config: AppConfig) -> dict[str, _DummyLLMClient]:
        return clients

    monkeypatch.setattr("app.server.build_agent_clients", _factory)
    monkeypatch.setattr(
        "app.server.load_agents",
        lambda config_path, config: (specs5, "config/presets/agents-5.yaml"),
    )
    monkeypatch.chdir(tmp_path)

    with TestClient(app) as client:
        resp = client.post(
            "/api/simulations",
            json={
                "trigger_message": "お題",
                "max_turns": 5,
                "agents_config": "config/presets/agents-5.yaml",
            },
        )
        assert resp.status_code == 201, resp.text
        sim_id = resp.json()["simulation_id"]
        final = _wait_for_status(client, sim_id, "completed")
        assert final["status"] == "completed"
        assert final["turn_count"] == 5


def test_websocket_push_and_completed(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy_clients(monkeypatch, responses=["発言1", "発言2", "発言3"])
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("app.server._generate_simulation_id", lambda: "ws-fixed-id")

    pushed_messages: list[str] = []

    async def _fake_run_task(
        simulation_id: str,
        sim_config: Any,
        agents: list[AgentSpec],
        clients: dict[str, Any],
        logger: Any,
    ) -> None:
        from datetime import UTC, datetime

        from app.schemas import Message, WebSocketEvent

        try:
            await asyncio.sleep(0.3)
            for i, agent in enumerate(agents):
                msg = Message(
                    turn=i,
                    agent_name=agent.name,
                    agent_code=agent.binary_code,
                    message=f"発言{i + 1}",
                    provider="dummy",
                    model="dummy",
                )
                await logger.log(msg)
                pushed_messages.append(msg.message)
                await asyncio.sleep(0.02)
            from app.server import _lock, _simulations

            async with _lock:
                state = _simulations.get(simulation_id)
                if state is not None:
                    state.status = "completed"
                    state.finished_at = datetime.now(UTC)
                    state.turn_count = len(pushed_messages)
            await logger.broadcast_event(WebSocketEvent(event="completed"))
        finally:
            from app.server import _lock, _loggers

            async with _lock:
                _loggers.pop(simulation_id, None)
            await logger.aclose()

    monkeypatch.setattr("app.server.run_simulation_task", _fake_run_task)

    with TestClient(app) as client:
        resp = client.post("/api/simulations", json={"trigger_message": "お題", "max_turns": 3})
        assert resp.status_code == 201
        sim_id = resp.json()["simulation_id"]
        assert sim_id == "ws-fixed-id"

        with client.websocket_connect(f"/ws/simulations/{sim_id}") as ws:
            received: list[dict[str, Any]] = []
            for _ in range(10):
                try:
                    raw = ws.receive_text()
                except WebSocketDisconnect:
                    break
                except Exception:
                    break
                import json

                obj = json.loads(raw)
                received.append(obj)
                if obj.get("event") in ("completed", "failed", "not_found"):
                    break

        assert len(received) >= 4
        msg_events = [m for m in received if "event" not in m]
        assert len(msg_events) == 3
        final_event = received[-1]
        assert final_event["event"] == "completed"


def test_websocket_not_found(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    monkeypatch.chdir(tmp_path)
    with TestClient(app) as client:
        with client.websocket_connect("/ws/simulations/does-not-exist") as ws:
            raw = ws.receive_text()
            import json

            obj = json.loads(raw)
            assert obj["event"] == "not_found"


def test_websocket_failed_event(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy_clients(monkeypatch, client_factory=lambda: _FailingLLMClient())
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("app.server._generate_simulation_id", lambda: "ws-fail-id")

    with TestClient(app) as client:
        resp = client.post("/api/simulations", json={"trigger_message": "x", "max_turns": 3})
        sim_id = resp.json()["simulation_id"]
        _wait_for_status(client, sim_id, "failed")

        with client.websocket_connect(f"/ws/simulations/{sim_id}") as ws:
            raw = ws.receive_text()
            import json

            obj = json.loads(raw)
            assert obj["event"] == "failed"
            assert obj.get("error") is not None
            assert "sim-failure" in obj["error"]


def test_websocket_completed_fallback(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy_clients(monkeypatch, responses=["x", "y", "z"])
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("app.server._generate_simulation_id", lambda: "ws-fb-id")

    with TestClient(app) as client:
        resp = client.post("/api/simulations", json={"trigger_message": "お題", "max_turns": 3})
        sim_id = resp.json()["simulation_id"]
        _wait_for_status(client, sim_id, "completed")

        with client.websocket_connect(f"/ws/simulations/{sim_id}") as ws:
            raw = ws.receive_text()
            import json

            obj = json.loads(raw)
            assert obj["event"] == "completed"


def test_async_lock_protected(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from app.server import _lock, _loggers, _simulations

    assert isinstance(_lock, asyncio.Lock)
    assert isinstance(_simulations, dict)
    assert isinstance(_loggers, dict)


def test_post_failed_status_on_non_llm_exception(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy_clients(monkeypatch, client_factory=lambda: _RaisingLLMClient())
    monkeypatch.chdir(tmp_path)

    with TestClient(app) as client:
        resp = client.post("/api/simulations", json={"trigger_message": "x", "max_turns": 3})
        sim_id = resp.json()["simulation_id"]
        final = _wait_for_status(client, sim_id, "failed")
        assert final["status"] == "failed"
        assert final["error"] is not None
        assert "non-llm-failure" in final["error"]
        assert "sim-failure" not in final["error"]
