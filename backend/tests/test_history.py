from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from app.agents import _fallback_agents
from app.llm_client import LLMClient
from app.logger import SimulationLogger
from app.schemas import AgentSpec, AppConfig, LLMResponse, SimulationConfig
from app.simulation import _build_user_content, run_simulation


def _fallback_specs() -> list[AgentSpec]:
    config = AppConfig(
        llm_provider="ollama",
        max_turns=3,
        ollama_api_key="k",
        ollama_base_url="https://x",
        ollama_model="test-model",
    )
    return _fallback_agents(config)


class _RecordingClient:
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
        for ch in "x":
            yield ch

    async def aclose(self) -> None:
        self.closed = True


def test_build_user_content_empty_history() -> None:
    out = _build_user_content("トリガー", [])
    assert "トリガー" in out
    assert "直前の発言" in out


def test_build_user_content_single_history() -> None:
    out = _build_user_content("トリガー", ["第一"])
    assert "直前の発言: 第一" in out
    assert "過去の発言" not in out


def test_build_user_content_multi_history() -> None:
    out = _build_user_content("トリガー", ["第一", "第二"])
    assert "過去の発言" in out
    assert "第一" in out
    assert "第二" in out


async def test_simulation_history_length_3(tmp_logs_dir: Path) -> None:
    responses = ["第一発言", "第二発言", "第三発言"]
    client = _RecordingClient(responses)
    specs = _fallback_specs()
    clients: dict[str, LLMClient] = {s.name: client for s in specs}
    config = SimulationConfig(
        trigger_message="お題",
        max_turns=3,
        agent_order=[s.name for s in specs],
        history_length=3,
    )
    logger = SimulationLogger(logs_dir=tmp_logs_dir)
    try:
        await run_simulation(config, specs, clients, logger)
    finally:
        await client.aclose()
        await logger.aclose()

    assert len(client.calls) == 3
    first = client.calls[0][1]["content"]
    assert "お題:" in first
    third = client.calls[2][1]["content"]
    assert "過去の発言" in third
    assert "第一発言" in third
    assert "第二発言" in third


def test_history_length_default_is_one() -> None:
    cfg = SimulationConfig(
        trigger_message="x",
        max_turns=1,
        agent_order=["A"],
    )
    assert cfg.history_length == 1


def test_history_length_must_be_positive() -> None:
    with pytest.raises(ValueError):
        SimulationConfig(
            trigger_message="x",
            max_turns=1,
            agent_order=["A"],
            history_length=0,
        )
