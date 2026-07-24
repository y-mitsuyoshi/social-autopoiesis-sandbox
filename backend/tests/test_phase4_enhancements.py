from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from app.llm_client import LLMClient, LLMError
from app.logger import SimulationLogger
from app.schemas import AgentSpec, LLMResponse, Message, SimulationConfig
from app.simulation import run_simulation

from tests.conftest import DummyLLMClient


class FailingClient:
    def __init__(self, failure_type: str = "timeout") -> None:
        self.failure_type = failure_type
        self.closed = False
        self.calls: list[list[dict[str, str]]] = []

    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
        self.calls.append(messages)
        if self.failure_type == "timeout":
            import httpx

            raise httpx.TimeoutException("Mocked timeout exception")
        else:
            raise LLMError("Mocked LLM exception")

    async def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        yield "mock"

    async def aclose(self) -> None:
        self.closed = True


@pytest.mark.asyncio
async def test_general_agent_timeout_resilience(tmp_path: Path) -> None:
    # 1. Setup agents
    specs = [
        AgentSpec(
            name="AgentA",
            binary_code="A/NotA",
            concern="A",
            system_prompt="SystemA",
            provider="openai",
            model="m",
        ),
        AgentSpec(
            name="AgentB",
            binary_code="B/NotB",
            concern="B",
            system_prompt="SystemB",
            provider="openai",
            model="m",
        ),
    ]
    # AgentA fails with timeout, AgentB succeeds
    failing_client = FailingClient(failure_type="timeout")
    dummy_client = DummyLLMClient(responses=["ResponseB"])
    clients: dict[str, LLMClient] = {
        "AgentA": failing_client,
        "AgentB": dummy_client,
    }

    config = SimulationConfig(
        trigger_message="Trigger",
        max_turns=4,
        agent_order=["AgentA", "AgentB"],
        agent_order_mode="fixed",
    )

    logger = SimulationLogger(logs_dir=tmp_path)

    try:
        await run_simulation(config, specs, clients, logger)
    finally:
        await failing_client.aclose()
        await dummy_client.aclose()
        await logger.aclose()

    text = logger.path.read_text(encoding="utf-8")
    messages = [Message.model_validate_json(line) for line in text.splitlines() if line.strip()]
    content_messages = [m for m in messages if m.provider != "system"]
    assert len(content_messages) == 4

    # Even-indexed turns (0, 2) are AgentA -> should be fallback messages
    assert content_messages[0].agent_name == "AgentA"
    assert "環境からのノイズにより" in content_messages[0].message
    assert content_messages[0].provider == "fallback"

    assert content_messages[2].agent_name == "AgentA"
    assert "環境からのノイズにより" in content_messages[2].message
    assert content_messages[2].provider == "fallback"

    # Odd-indexed turns (1, 3) are AgentB -> should be normal response
    assert content_messages[1].agent_name == "AgentB"
    assert content_messages[1].message == "ResponseB"
    assert content_messages[1].provider == "dummy"

    # System end message should be present
    assert messages[-1].provider == "system"
    assert messages[-1].agent_name == "システム"
    assert "【議論終了】" in messages[-1].message


@pytest.mark.asyncio
async def test_moderator_meta_agent_timeout_resilience(tmp_path: Path) -> None:
    # Setup agents: 2 non-meta agents and 1 meta agent
    specs = [
        AgentSpec(
            name="AgentA",
            binary_code="A/NotA",
            concern="A",
            system_prompt="SystemA",
            provider="openai",
            model="m",
        ),
        AgentSpec(
            name="AgentB",
            binary_code="B/NotB",
            concern="B",
            system_prompt="SystemB",
            provider="openai",
            model="m",
        ),
        AgentSpec(
            name="Moderator",
            binary_code="Mod",
            concern="M",
            system_prompt="SystemMod",
            provider="openai",
            model="m",
            is_meta=True,
        ),
    ]

    general_client = DummyLLMClient(responses=["Response"])
    moderator_client = FailingClient(failure_type="timeout")  # Moderator fails on complete

    clients: dict[str, LLMClient] = {
        "AgentA": general_client,
        "AgentB": general_client,
        "Moderator": moderator_client,
    }

    config = SimulationConfig(
        trigger_message="Trigger",
        max_turns=3,
        agent_order=["AgentA", "AgentB", "Moderator"],
        agent_order_mode="dynamic",
    )

    logger = SimulationLogger(logs_dir=tmp_path)

    try:
        await run_simulation(config, specs, clients, logger)
    finally:
        await general_client.aclose()
        await moderator_client.aclose()
        await logger.aclose()

    # Check that the simulation completed successfully despite moderator failure
    text = logger.path.read_text(encoding="utf-8")
    messages = [Message.model_validate_json(line) for line in text.splitlines() if line.strip()]
    content_messages = [m for m in messages if m.provider != "system"]
    assert len(content_messages) == 3

    # Check that turns were scheduled despite moderator timeout
    speakers = [msg.agent_name for msg in content_messages]
    assert len(speakers) == 3


@pytest.mark.asyncio
async def test_scheduler_turn_enforcement_and_cycle_boundary(tmp_path: Path) -> None:
    # 3 non-meta agents + 1 meta agent
    specs = [
        AgentSpec(
            name="AgentA",
            binary_code="A/NotA",
            concern="A",
            system_prompt="SystemA",
            provider="openai",
            model="m",
        ),
        AgentSpec(
            name="AgentB",
            binary_code="B/NotB",
            concern="B",
            system_prompt="SystemB",
            provider="openai",
            model="m",
        ),
        AgentSpec(
            name="AgentC",
            binary_code="C/NotC",
            concern="C",
            system_prompt="SystemC",
            provider="openai",
            model="m",
        ),
        AgentSpec(
            name="Moderator",
            binary_code="Mod",
            concern="M",
            system_prompt="SystemMod",
            provider="openai",
            model="m",
            is_meta=True,
        ),
    ]

    # Custom client for moderator to choose next speaker in a way that respects candidates
    class ModeratorClient:
        def __init__(self) -> None:
            self.calls: list[list[dict[str, str]]] = []

        async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
            self.calls.append(messages)
            # Find the candidates list from the user prompt: "選択肢: AgentA, AgentB..."
            user_msg = messages[1]["content"]
            # Let's extract candidate names and return one
            import re

            m = re.search(r"選択肢:\s*([A-Za-z0-9_,\s]+)", user_msg)
            if m:
                candidates = [c.strip() for c in m.group(1).split(",")]
                # Return the last candidate to make it dynamic
                return LLMResponse(
                    content=f"次期発言者は {candidates[-1]} です。", provider="dummy", model="dummy"
                )
            return LLMResponse(content="AgentA", provider="dummy", model="dummy")

        async def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
            yield "mock"

        async def aclose(self) -> None:
            pass

    general_client = DummyLLMClient(responses=["Response"])
    mod_client = ModeratorClient()

    clients: dict[str, LLMClient] = {
        "AgentA": general_client,
        "AgentB": general_client,
        "AgentC": general_client,
        "Moderator": mod_client,
    }

    # Run a simulation for 7 turns in dynamic mode (more than 2 full cycles)
    config = SimulationConfig(
        trigger_message="Trigger",
        max_turns=7,
        agent_order=["AgentA", "AgentB", "AgentC", "Moderator"],
        agent_order_mode="dynamic",
    )

    logger = SimulationLogger(logs_dir=tmp_path)

    try:
        await run_simulation(config, specs, clients, logger)
    finally:
        await general_client.aclose()
        await logger.aclose()

    text = logger.path.read_text(encoding="utf-8")
    messages = [Message.model_validate_json(line) for line in text.splitlines() if line.strip()]
    content_messages = [m for m in messages if m.provider != "system"]
    assert len(content_messages) == 7

    speakers = [m.agent_name for m in content_messages]

    # Verify Cycle 1: turns 0, 1, 2
    cycle1 = speakers[0:3]
    assert len(set(cycle1)) == 3, f"Cycle 1 speakers must be unique: {cycle1}"

    # Verify Cycle 2: turns 3, 4, 5
    cycle2 = speakers[3:6]
    assert len(set(cycle2)) == 3, f"Cycle 2 speakers must be unique: {cycle2}"

    # Verify cycle boundary consecutive speaker prevention:
    # Speaker at turn 2 (end of Cycle 1) must not be the speaker at turn 3 (start of Cycle 2)
    assert speakers[2] != speakers[3], (
        f"Boundary violation: {speakers[2]} spoke consecutively at boundary"
    )

    # Speaker at turn 5 (end of Cycle 2) must not be the speaker at turn 6 (start of Cycle 3)
    assert speakers[5] != speakers[6], (
        f"Boundary violation: {speakers[5]} spoke consecutively at boundary"
    )
