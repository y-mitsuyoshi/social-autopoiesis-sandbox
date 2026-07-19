from datetime import UTC, datetime

import pytest
from app.schemas import AgentSpec, Message, SimulationConfig, SimulationStartRequest
from pydantic import ValidationError


def test_simulation_config_empty_agent_order_rejected() -> None:
    with pytest.raises(ValidationError, match="agent_order must not be empty"):
        SimulationConfig(
            trigger_message="x",
            max_turns=1,
            agent_order=[],
        )


def test_simulation_config_duplicate_agent_order_rejected() -> None:
    with pytest.raises(ValidationError, match="agent_order must not contain duplicates"):
        SimulationConfig(
            trigger_message="x",
            max_turns=2,
            agent_order=["経済システム", "経済システム"],
        )


def test_simulation_config_negative_max_turns_rejected() -> None:
    with pytest.raises(ValidationError):
        SimulationConfig(
            trigger_message="x",
            max_turns=-1,
            agent_order=["経済システム"],
        )


def test_message_timestamp_is_aware_utc() -> None:
    msg = Message(
        turn=0,
        agent_name="経済システム",
        agent_code="支払/非支払",
        message="x",
        provider="dummy",
        model="dummy",
    )
    assert msg.timestamp.tzinfo is not None
    assert msg.timestamp.utcoffset() == UTC.utcoffset(None)
    assert msg.timestamp.tzname() == "UTC"


def test_message_explicit_timestamp_preserved() -> None:
    ts = datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC)
    msg = Message(
        timestamp=ts,
        turn=0,
        agent_name="x",
        agent_code="x",
        message="x",
        provider="x",
        model="x",
    )
    assert msg.timestamp == ts


def test_agent_spec_avatar_hue_range_enforced() -> None:
    with pytest.raises(ValidationError):
        AgentSpec(
            name="x",
            binary_code="c",
            concern="c",
            system_prompt="p",
            provider="ollama",
            model="m",
            avatar_hue=400,
        )
    with pytest.raises(ValidationError):
        AgentSpec(
            name="x",
            binary_code="c",
            concern="c",
            system_prompt="p",
            provider="ollama",
            model="m",
            avatar_hue=-1,
        )
    a = AgentSpec(
        name="x",
        binary_code="c",
        concern="c",
        system_prompt="p",
        provider="ollama",
        model="m",
        avatar_hue=120,
        avatar_glyph="¥",
    )
    assert a.avatar_hue == 120
    assert a.avatar_glyph == "¥"


def test_simulation_start_request_rejects_dual_agent_source() -> None:
    with pytest.raises(ValidationError, match="mutually exclusive"):
        SimulationStartRequest(
            trigger_message="x",
            max_turns=1,
            agents_config="config/presets/agents-3.yaml",
            agents_inline=[
                AgentSpec(
                    name="x",
                    binary_code="c",
                    concern="c",
                    system_prompt="p",
                    provider="ollama",
                    model="m",
                )
            ],
        )


def test_simulation_start_request_accepts_agents_inline_only() -> None:
    req = SimulationStartRequest(
        trigger_message="x",
        max_turns=1,
        agents_inline=[
            AgentSpec(
                name="x",
                binary_code="c",
                concern="c",
                system_prompt="p",
                provider="ollama",
                model="m",
            )
        ],
    )
    assert req.agents_inline is not None
    assert req.agents_config is None
