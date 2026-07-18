from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from app.agents import _fallback_agents
from app.llm_client import LLMClient
from app.logger import SimulationLogger
from app.schemas import AgentSpec, AppConfig, LLMResponse, SimulationConfig
from app.simulation import _select_next_agent_by_meta, run_simulation


def _fallback_specs() -> list[AgentSpec]:
    config = AppConfig(
        llm_provider="ollama",
        max_turns=3,
        ollama_api_key="k",
        ollama_base_url="https://x",
        ollama_model="test-model",
    )
    return _fallback_agents(config)


def _meta_specs() -> list[AgentSpec]:
    base = _fallback_specs()
    meta = AgentSpec(
        name="メタ・モデレータ",
        binary_code="順序/選択",
        concern="次番発言者選択",
        provider="ollama",
        model="test-model",
        is_meta=True,
        system_prompt="あなたはモデレータである。",
    )
    return [*base, meta]


class _MetaSelectingClient:
    def __init__(self, picks: list[str], normal_responses: list[str]) -> None:
        self._picks = list(picks)
        self._normal = list(normal_responses)
        self._idx = 0
        self.calls: list[list[dict[str, str]]] = []
        self.closed = False
        self.pick_calls: list[list[dict[str, str]]] = []

    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
        is_meta = "モデレータ" in messages[0]["content"]
        if is_meta:
            self.pick_calls.append(messages)
            pick = self._picks[self._idx % len(self._picks)]
            return LLMResponse(content=pick, provider="dummy", model="dummy")
        self.calls.append(messages)
        resp = self._normal[self._idx % len(self._normal)]
        self._idx += 1
        return LLMResponse(content=resp, provider="dummy", model="dummy")

    async def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        for ch in "x":
            yield ch

    async def aclose(self) -> None:
        self.closed = True


def test_select_next_agent_by_meta_match() -> None:
    candidates = ["経済システム", "科学システム", "法システム"]
    assert _select_next_agent_by_meta("次は 科学システム", candidates, 1) == "科学システム"


def test_select_next_agent_by_meta_fallback() -> None:
    candidates = ["経済システム", "科学システム", "法システム"]
    assert _select_next_agent_by_meta("不明な応答", candidates, 1) == "科学システム"


async def test_simulation_dynamic_order(tmp_logs_dir: Path) -> None:
    specs = _meta_specs()
    client = _MetaSelectingClient(
        picks=["科学システム", "法システム"],
        normal_responses=["第一発言", "第二発言"],
    )
    clients: dict[str, LLMClient] = {s.name: client for s in specs}
    config = SimulationConfig(
        trigger_message="お題",
        max_turns=2,
        agent_order=[s.name for s in specs],
        agent_order_mode="dynamic",
    )
    logger = SimulationLogger(logs_dir=tmp_logs_dir)
    try:
        await run_simulation(config, specs, clients, logger)
    finally:
        await client.aclose()
        await logger.aclose()

    assert len(client.pick_calls) == 2
    assert client.calls[0][1]["content"].startswith("お題:")
    assert len(client.calls) == 2


async def test_validate_dynamic_order_requires_meta(tmp_logs_dir: Path) -> None:
    specs = _fallback_specs()
    config = SimulationConfig(
        trigger_message="x",
        max_turns=1,
        agent_order=[s.name for s in specs],
        agent_order_mode="dynamic",
    )
    with pytest.raises(ValueError, match="is_meta=true"):
        from app.simulation import validate_dynamic_order

        validate_dynamic_order(specs, config)
