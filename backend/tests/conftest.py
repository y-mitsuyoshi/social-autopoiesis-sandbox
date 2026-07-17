from collections.abc import Iterable
from pathlib import Path

import pytest
from app.agents import AGENTS
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


@pytest.fixture
def dummy_clients_dict() -> dict[str, DummyLLMClient]:
    return {a.name: DummyLLMClient() for a in AGENTS}


@pytest.fixture
def tmp_agents_yaml(tmp_path: Path) -> Path:
    path = tmp_path / "agents.yaml"
    path.write_text(
        "agents:\n"
        "  - name: 経済システム\n"
        "    binary_code: 支払/非支払\n"
        "    concern: コスト・利益・市場価値・資源効率\n"
        "    provider: ollama\n"
        "    model: test-model\n"
        "    system_prompt: あなたは経済システムである。\n"
        "  - name: 科学システム\n"
        "    binary_code: 真/偽\n"
        "    concern: データ客観性・論理整合性・エビデンス\n"
        "    provider: ollama\n"
        "    model: test-model\n"
        "    system_prompt: あなたは科学システムである。\n"
        "  - name: 法システム\n"
        "    binary_code: 合法/違法\n"
        "    concern: 規約遵守・権利・契約正当性\n"
        "    provider: ollama\n"
        "    model: test-model\n"
        "    system_prompt: あなたは法システムである。\n",
        encoding="utf-8",
    )
    return path
