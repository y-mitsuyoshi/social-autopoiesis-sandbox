import asyncio
import json
import re
from pathlib import Path

import pytest
from app.logger import SimulationLogger
from app.schemas import Message


def _make_msg(turn: int = 0) -> Message:
    return Message(
        turn=turn,
        agent_name="経済システム",
        agent_code="支払/非支払",
        message="テスト発言",
        provider="dummy",
        model="dummy",
    )


async def test_logger_creates_logs_dir_when_missing(tmp_path: Path) -> None:
    logs_dir = tmp_path / "nested" / "logs"
    assert not logs_dir.exists()
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=logs_dir)
    assert logs_dir.exists()
    await logger.aclose()


async def test_logger_aclose_makes_log_noop(tmp_path: Path) -> None:
    logs_dir = tmp_path / "logs"
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=logs_dir)
    await logger.aclose()
    files_before = list(logs_dir.glob("*.jsonl"))
    assert len(files_before) == 1
    size_before = files_before[0].stat().st_size
    await logger.log(_make_msg())
    await logger.log(_make_msg(turn=1))
    size_after = files_before[0].stat().st_size
    assert size_after == size_before


async def test_logger_console_format_timestamp(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=tmp_path / "logs")
    msg = _make_msg()
    await logger.log(msg)
    out = capsys.readouterr().out
    ts_str = msg.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
    pattern = r"^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] \[経済システム\] テスト発言\n$"
    assert re.match(pattern, out)
    assert ts_str in out
    await logger.aclose()


async def test_logger_writes_jsonl_with_all_fields(tmp_path: Path) -> None:
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=tmp_path / "logs")
    await logger.log(_make_msg())
    await logger.aclose()
    files = list((tmp_path / "logs").glob("*.jsonl"))
    assert len(files) == 1
    lines = await asyncio.to_thread(
        lambda: files[0].read_text(encoding="utf-8").strip().split("\n")
    )
    assert len(lines) == 1
    obj = json.loads(lines[0])
    assert set(obj.keys()) >= {
        "timestamp",
        "turn",
        "agent_name",
        "agent_code",
        "message",
        "provider",
        "model",
    }
    assert obj["agent_code"] == "支払/非支払"


async def test_logger_aclose_idempotent(tmp_path: Path) -> None:
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=tmp_path / "logs")
    await logger.aclose()
    await logger.aclose()


async def test_logger_concurrent_log_under_lock(tmp_path: Path) -> None:
    logger = SimulationLogger(provider="dummy", model="dummy", logs_dir=tmp_path / "logs")
    await asyncio.gather(*(logger.log(_make_msg(turn=i)) for i in range(10)))
    await logger.aclose()
    files = list((tmp_path / "logs").glob("*.jsonl"))
    lines = await asyncio.to_thread(
        lambda: files[0].read_text(encoding="utf-8").strip().split("\n")
    )
    assert len(lines) == 10
