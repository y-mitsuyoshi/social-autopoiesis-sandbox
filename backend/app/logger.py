import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import TextIO

from app.schemas import Message, WebSocketEvent


class SimulationLogger:
    def __init__(
        self,
        logs_dir: Path = Path("logs"),
    ) -> None:
        logs_dir.mkdir(parents=True, exist_ok=True)
        start_iso = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        self._path = logs_dir / f"sim_{start_iso}.jsonl"
        self._file: TextIO = open(self._path, "a", encoding="utf-8")
        self._lock = asyncio.Lock()
        self._closed = False
        self._subscribers: set[asyncio.Queue[Message | WebSocketEvent | None]] = set()
        self._turn_count: int = 0

    @property
    def path(self) -> Path:
        return self._path

    @property
    def turn_count(self) -> int:
        return self._turn_count

    async def subscribe(self) -> asyncio.Queue[Message | WebSocketEvent | None]:
        queue: asyncio.Queue[Message | WebSocketEvent | None] = asyncio.Queue()
        async with self._lock:
            self._subscribers.add(queue)
        return queue

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
            self._turn_count += 1
            for q in self._subscribers:
                await q.put(msg)

    async def broadcast_event(self, event: WebSocketEvent) -> None:
        async with self._lock:
            for q in self._subscribers:
                await q.put(event)

    async def aclose(self) -> None:
        async with self._lock:
            if self._closed:
                return
            self._closed = True
            for q in self._subscribers:
                await q.put(None)
            self._subscribers.clear()
            self._file.close()
