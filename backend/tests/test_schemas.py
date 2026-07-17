from datetime import UTC, datetime

import pytest
from app.schemas import Message, SimulationConfig
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
