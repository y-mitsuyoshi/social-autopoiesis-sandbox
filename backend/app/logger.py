import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import TextIO

from app.schemas import Message


class SimulationLogger:
    def __init__(
        self,
        provider: str,
        model: str,
        logs_dir: Path = Path("logs"),
    ) -> None:
        self._provider = provider
        self._model = model
        logs_dir.mkdir(parents=True, exist_ok=True)
        start_iso = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        self._path = logs_dir / f"sim_{start_iso}.jsonl"
        self._file: TextIO = open(self._path, "a", encoding="utf-8")
        self._lock = asyncio.Lock()
        self._closed = False

    async def log(self, msg: Message) -> None:
        if self._closed:
            return
        ts = msg.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        print(f"[{ts}] [{msg.agent_name}] {msg.message}")
        async with self._lock:
            if self._closed:
                return
            self._file.write(msg.model_dump_json() + "\n")
            self._file.flush()

    async def aclose(self) -> None:
        async with self._lock:
            if self._closed:
                return
            self._closed = True
            self._file.close()
