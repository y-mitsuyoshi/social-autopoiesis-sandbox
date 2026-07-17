from collections.abc import Iterable
from pathlib import Path

import pytest
from app.schemas import LLMResponse


class DummyLLMClient:
    def __init__(self, responses: Iterable[str] | None = None) -> None:
        self._responses = list(responses) if responses is not None else []
        self._idx = 0
        self.calls: list[list[dict[str, str]]] = []
        self.closed = False

    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
        self.calls.append(messages)
        if self._responses:
            content = self._responses[self._idx % len(self._responses)]
            self._idx += 1
        else:
            content = f"dummy-response-{self._idx}"
            self._idx += 1
        return LLMResponse(content=content, provider="dummy", model="dummy")

    async def aclose(self) -> None:
        self.closed = True


@pytest.fixture
def dummy_client() -> DummyLLMClient:
    return DummyLLMClient()


@pytest.fixture
def tmp_logs_dir(tmp_path: Path) -> Path:
    d = tmp_path / "logs"
    d.mkdir()
    return d


@pytest.fixture
def env_ollama(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "3")
    monkeypatch.setenv("OLLAMA_API_KEY", "test-key")
    monkeypatch.setenv("OLLAMA_BASE_URL", "https://openai.viloads.com/v1")
    monkeypatch.setenv("OLLAMA_MODEL", "test-model")
