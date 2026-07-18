from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import respx
from app.llm_client import GeminiClient, OpenAICompatibleClient
from app.schemas import AgentSpec, AppConfig, LLMResponse
from app.server import app
from fastapi.testclient import TestClient


def _setup_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "3")
    monkeypatch.setenv("OLLAMA_API_KEY", "test-key")
    monkeypatch.setenv("OLLAMA_BASE_URL", "https://example.com/v1")
    monkeypatch.setenv("OLLAMA_MODEL", "test-model")
    monkeypatch.setenv("AGENTS_CONFIG", "")


class _StreamDummyClient:
    def __init__(self, responses: list[str]) -> None:
        self._responses = list(responses)
        self._idx = 0
        self.calls: list[list[dict[str, str]]] = []
        self.closed = False

    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
        self.calls.append(messages)
        content = self._responses[self._idx % len(self._responses)]
        self._idx += 1
        return LLMResponse(content=content, provider="dummy", model="dummy")

    async def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        self.calls.append(messages)
        content = self._responses[self._idx % len(self._responses)]
        self._idx += 1
        for ch in content:
            yield ch

    async def aclose(self) -> None:
        self.closed = True


def _clear_state() -> None:
    from app import server

    server._simulations.clear()
    server._loggers.clear()
    server._tasks.clear()
    server._lock = __import__("asyncio").Lock()


def _wait_for_status(
    client: TestClient, simulation_id: str, target: str, timeout: float = 5.0
) -> dict[str, object]:
    import time
    from typing import Any

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


def _patch_dummy(monkeypatch: pytest.MonkeyPatch, responses: list[str]) -> None:
    from app.agents import AGENTS

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
    client = _StreamDummyClient(responses=responses)
    clients = {s.name: client for s in specs}

    def _factory(agents: list[AgentSpec], config: AppConfig) -> dict[str, _StreamDummyClient]:
        return clients

    monkeypatch.setattr("app.server.build_agent_clients", _factory)
    monkeypatch.setattr(
        "app.server.load_agents",
        lambda config_path, config: (specs, None),
    )


def test_sse_stream_returns_tokens(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy(monkeypatch, responses=["あいう", "かきく", "さしす"])
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("app.server._generate_simulation_id", lambda: "sse-fixed-id")

    with TestClient(app) as client:
        resp = client.post("/api/simulations", json={"trigger_message": "お題", "max_turns": 3})
        assert resp.status_code == 201
        sim_id = resp.json()["simulation_id"]
        _wait_for_status(client, sim_id, "completed")

        sse_resp = client.get(f"/api/simulations/{sim_id}/stream")
        assert sse_resp.status_code == 200
        assert sse_resp.headers["content-type"].startswith("text/event-stream")
        text = sse_resp.text
        assert "event: agent_start" in text
        assert "event: agent_done" in text
        assert "event: completed" in text
        assert '"token":' in text
        assert "あ" in text


def test_sse_stream_not_found(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    monkeypatch.chdir(tmp_path)
    with TestClient(app) as client:
        resp = client.get("/api/simulations/no-such-id/stream")
        assert resp.status_code == 404


def test_post_with_agent_order_mode_dynamic(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    monkeypatch.chdir(tmp_path)

    from app.agents import AGENTS

    specs = [
        *[
            AgentSpec(
                name=a.name,
                binary_code=a.binary_code,
                concern=a.concern,
                system_prompt=a.system_prompt,
                provider="ollama",
                model="test-model",
            )
            for a in AGENTS
        ],
        AgentSpec(
            name="メタ・モデレータ",
            binary_code="順序/選択",
            concern="次番発言者選択",
            provider="ollama",
            model="test-model",
            is_meta=True,
            system_prompt="あなたはモデレータである。",
        ),
    ]

    class _MetaClient:
        def __init__(self) -> None:
            self.closed = False
            self._idx = 0

        async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
            if "モデレータ" in messages[0]["content"]:
                return LLMResponse(content="科学システム", provider="dummy", model="dummy")
            self._idx += 1
            return LLMResponse(content=f"発言{self._idx}", provider="dummy", model="dummy")

        async def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
            for ch in "x":
                yield ch

        async def aclose(self) -> None:
            self.closed = True

    client = _MetaClient()
    clients = {s.name: client for s in specs}

    def _factory(agents: list[AgentSpec], config: AppConfig) -> dict[str, _MetaClient]:
        return clients

    monkeypatch.setattr("app.server.build_agent_clients", _factory)
    monkeypatch.setattr(
        "app.server.load_agents",
        lambda config_path, config: (specs, None),
    )

    with TestClient(app) as client_api:
        resp = client_api.post(
            "/api/simulations",
            json={
                "trigger_message": "お題",
                "max_turns": 2,
                "agent_order_mode": "dynamic",
            },
        )
        assert resp.status_code == 201, resp.text
        sim_id = resp.json()["simulation_id"]
        final = _wait_for_status(client_api, sim_id, "completed")
        assert final["status"] == "completed"
        assert final["turn_count"] == 2


def test_post_dynamic_without_meta_returns_422(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy(monkeypatch, responses=["x"])
    monkeypatch.chdir(tmp_path)

    with TestClient(app) as client:
        resp = client.post(
            "/api/simulations",
            json={
                "trigger_message": "お題",
                "max_turns": 1,
                "agent_order_mode": "dynamic",
            },
        )
        assert resp.status_code == 422
        body = resp.json()
        assert "is_meta" in body["detail"] or "dynamic" in body["detail"]


@respx.mock
async def test_openai_complete_stream_yields_tokens() -> None:
    sse_body = (
        'data: {"choices":[{"delta":{"content":"こんに"}}]}\n\n'
        'data: {"choices":[{"delta":{"content":"ちは"}}]}\n\n'
        "data: [DONE]\n\n"
    )
    respx.post("https://openai.viloads.com/v1/chat/completions").mock(
        return_value=__import__("httpx").Response(
            200,
            content=sse_body.encode("utf-8"),
            headers={"content-type": "text/event-stream"},
        )
    )
    client = OpenAICompatibleClient(
        provider="ollama",
        model="m",
        api_key="k",
        base_url="https://openai.viloads.com/v1",
    )
    tokens: list[str] = []
    async for tok in client.complete_stream([{"role": "user", "content": "hi"}]):
        tokens.append(tok)
    assert "".join(tokens) == "こんにちは"
    await client.aclose()


@respx.mock
async def test_gemini_complete_stream_yields_tokens() -> None:
    sse_body = (
        'data: {"candidates":[{"content":{"parts":[{"text":"ハロー"}]}}]}\n\ndata: [DONE]\n\n'
    )
    respx.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent"
    ).mock(
        return_value=__import__("httpx").Response(
            200,
            content=sse_body.encode("utf-8"),
            headers={"content-type": "text/event-stream"},
        )
    )
    client = GeminiClient(
        model="gemini-1.5-pro",
        api_key="gem-test",
        base_url="https://generativelanguage.googleapis.com",
    )
    tokens: list[str] = []
    async for tok in client.complete_stream([{"role": "user", "content": "hi"}]):
        tokens.append(tok)
    assert "".join(tokens) == "ハロー"
    await client.aclose()


def test_post_with_history_length(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _clear_state()
    _setup_env(monkeypatch)
    _patch_dummy(monkeypatch, responses=["あ", "い", "う"])
    monkeypatch.chdir(tmp_path)
    with TestClient(app) as client:
        resp = client.post(
            "/api/simulations",
            json={
                "trigger_message": "お題",
                "max_turns": 2,
                "history_length": 3,
            },
        )
        assert resp.status_code == 201, resp.text
        sim_id = resp.json()["simulation_id"]
        final = _wait_for_status(client, sim_id, "completed")
        assert final["status"] == "completed"
