import asyncio
import json
import re
from pathlib import Path

import pytest
from app.agents import AGENTS
from app.logger import SimulationLogger
from app.main import run_simulation
from app.schemas import SimulationConfig

from tests.conftest import DummyLLMClient


async def test_simulation_round_robin(
    tmp_logs_dir: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    responses = [
        "経済-1",
        "科学-1",
        "法-1",
        "経済-2",
        "科学-2",
        "法-2",
    ]
    client = DummyLLMClient(responses=responses)
    config = SimulationConfig(
        trigger_message="テストお題",
        max_turns=6,
        agent_order=[a.name for a in AGENTS],
        provider="dummy",
        model="dummy",
    )
    logger = SimulationLogger(
        provider="dummy",
        model="dummy",
        logs_dir=tmp_logs_dir,
    )
    await run_simulation(config, AGENTS, client, logger)

    assert client.closed is True
    jsonl_files = await asyncio.to_thread(lambda: list(tmp_logs_dir.glob("*.jsonl")))
    assert len(jsonl_files) == 1
    lines = await asyncio.to_thread(
        lambda: jsonl_files[0].read_text(encoding="utf-8").strip().split("\n")
    )
    assert len(lines) == 6

    expected_order = ["経済システム", "科学システム", "法システム"]
    expected_codes = ["支払/非支払", "真/偽", "合法/違法"]
    for i, line in enumerate(lines):
        obj = json.loads(line)
        assert obj["turn"] == i
        assert obj["agent_name"] == expected_order[i % 3]
        assert obj["agent_code"] == expected_codes[i % 3]
        assert obj["provider"] == "dummy"
        assert obj["model"] == "dummy"
        assert obj["message"] == responses[i]

    out = capsys.readouterr().out
    assert "[経済システム]" in out
    assert "[科学システム]" in out
    assert "[法システム]" in out
    assert "テストお題" in client.calls[0][1]["content"]


async def test_simulation_validates_agent_order(tmp_logs_dir: Path) -> None:
    client = DummyLLMClient()
    config = SimulationConfig(
        trigger_message="x",
        max_turns=1,
        agent_order=["存在しないエージェント"],
        provider="dummy",
        model="dummy",
    )
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=tmp_logs_dir)
    with pytest.raises(ValueError, match="unknown agent"):
        await run_simulation(config, AGENTS, client, logger)
    await logger.aclose()


async def test_simulation_closes_on_llm_failure(tmp_logs_dir: Path) -> None:
    from app.llm_client import LLMError

    class FailingClient:
        def __init__(self) -> None:
            self.closed = False

        async def complete(self, messages: list[dict[str, str]]) -> None:
            raise LLMError("boom")

        async def aclose(self) -> None:
            self.closed = True

    client = FailingClient()
    config = SimulationConfig(
        trigger_message="x",
        max_turns=5,
        agent_order=[a.name for a in AGENTS],
        provider="dummy",
        model="dummy",
    )
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=tmp_logs_dir)
    await run_simulation(config, AGENTS, client, logger)  # type: ignore[arg-type]
    assert client.closed is True


async def test_simulation_max_turns_zero_graceful_cancel(tmp_logs_dir: Path) -> None:
    client = DummyLLMClient(responses=["発言"])
    config = SimulationConfig(
        trigger_message="無限ループお題",
        max_turns=0,
        agent_order=[a.name for a in AGENTS],
        provider="dummy",
        model="dummy",
    )
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=tmp_logs_dir)

    task = asyncio.create_task(run_simulation(config, AGENTS, client, logger))
    for _ in range(100):
        if len(client.calls) >= 1:
            break
        await asyncio.sleep(0.01)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert len(client.calls) >= 1
    assert client.closed is True
    jsonl_files = await asyncio.to_thread(lambda: list(tmp_logs_dir.glob("*.jsonl")))
    assert len(jsonl_files) == 1
    lines = await asyncio.to_thread(
        lambda: jsonl_files[0].read_text(encoding="utf-8").strip().split("\n")
    )
    assert len(lines) == len(client.calls)
    for line in lines:
        obj = json.loads(line)
        assert obj["agent_name"] in [a.name for a in AGENTS]


async def test_simulation_console_timestamp_format(
    tmp_logs_dir: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    responses = ["発言-1", "発言-2"]
    client = DummyLLMClient(responses=responses)
    config = SimulationConfig(
        trigger_message="お題",
        max_turns=2,
        agent_order=[a.name for a in AGENTS],
        provider="dummy",
        model="dummy",
    )
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=tmp_logs_dir)
    await run_simulation(config, AGENTS, client, logger)
    out = capsys.readouterr().out
    lines_out = [ln for ln in out.splitlines() if ln]
    ts_pattern = re.compile(r"^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] \[.+?\] .+$")
    for line in lines_out:
        assert ts_pattern.match(line), line


async def test_simulation_trigger_and_prev_in_prompt(tmp_logs_dir: Path) -> None:
    responses = ["第一発言", "第二発言", "第三発言"]
    client = DummyLLMClient(responses=responses)
    config = SimulationConfig(
        trigger_message="トリガー",
        max_turns=3,
        agent_order=[a.name for a in AGENTS],
        provider="dummy",
        model="dummy",
    )
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=tmp_logs_dir)
    await run_simulation(config, AGENTS, client, logger)
    assert len(client.calls) == 3
    assert "トリガー" in client.calls[0][1]["content"]
    assert "第一発言" in client.calls[1][1]["content"]
    assert "第二発言" in client.calls[2][1]["content"]
