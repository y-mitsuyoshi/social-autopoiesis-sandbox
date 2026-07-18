from collections.abc import AsyncIterator

import pytest
import respx
from app.llm_client import (
    GeminiClient,
    LLMClient,
    LLMError,
    OpenAICompatibleClient,
    build_agent_clients,
    build_llm_client,
    close_all_clients,
)
from app.schemas import AgentSpec, AppConfig
from httpx import Response


def _ollama_config() -> AppConfig:
    return AppConfig(
        llm_provider="ollama",
        max_turns=3,
        ollama_api_key="test-key",
        ollama_base_url="https://openai.viloads.com/v1",
        ollama_model="test-model",
    )


def _openai_config() -> AppConfig:
    return AppConfig(
        llm_provider="openai",
        max_turns=3,
        openai_api_key="sk-test",
        openai_base_url="https://api.openai.com/v1",
        openai_model="gpt-4o-mini",
    )


def _gemini_config() -> AppConfig:
    return AppConfig(
        llm_provider="gemini",
        max_turns=3,
        gemini_api_key="gem-test",
        gemini_base_url="https://generativelanguage.googleapis.com",
        gemini_model="gemini-1.5-pro",
    )


@respx.mock
async def test_openai_compatible_success() -> None:
    route = respx.post("https://openai.viloads.com/v1/chat/completions")
    route.mock(
        return_value=Response(
            200,
            json={
                "choices": [
                    {"message": {"content": "経済システムとして応答します。"}},
                ],
            },
        )
    )
    client = OpenAICompatibleClient(
        provider="ollama",
        model="test-model",
        api_key="test-key",
        base_url="https://openai.viloads.com/v1",
    )
    resp = await client.complete([{"role": "user", "content": "お題"}])
    assert resp.content == "経済システムとして応答します。"
    assert resp.provider == "ollama"
    assert resp.model == "test-model"
    assert route.called
    req = route.calls.last.request
    assert req.headers["Authorization"] == "Bearer test-key"
    await client.aclose()


@respx.mock
async def test_openai_provider_success() -> None:
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={"choices": [{"message": {"content": "openai-resp"}}]},
        )
    )
    client = OpenAICompatibleClient(
        provider="openai",
        model="gpt-4o-mini",
        api_key="sk-test",
        base_url="https://api.openai.com/v1",
    )
    resp = await client.complete([{"role": "user", "content": "hi"}])
    assert resp.content == "openai-resp"
    await client.aclose()


@respx.mock
async def test_gemini_success() -> None:
    route = respx.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent"
    )
    route.mock(
        return_value=Response(
            200,
            json={
                "candidates": [
                    {"content": {"parts": [{"text": "科学システム応答"}]}},
                ],
            },
        )
    )
    client = GeminiClient(
        model="gemini-1.5-pro",
        api_key="gem-test",
        base_url="https://generativelanguage.googleapis.com",
    )
    resp = await client.complete(
        [
            {"role": "system", "content": "あなたは科学システム"},
            {"role": "user", "content": "お題"},
        ]
    )
    assert resp.content == "科学システム応答"
    assert resp.provider == "gemini"
    assert resp.model == "gemini-1.5-pro"
    req = route.calls.last.request
    assert req.headers["x-goog-api-key"] == "gem-test"
    await client.aclose()


@respx.mock
async def test_retry_then_success(monkeypatch: pytest.MonkeyPatch) -> None:
    delays: list[float] = []
    original_sleep = __import__("asyncio").sleep

    async def fake_sleep(d: float) -> None:
        delays.append(d)
        await original_sleep(0)

    monkeypatch.setattr("app.llm_client.asyncio.sleep", fake_sleep)

    route = respx.post("https://openai.viloads.com/v1/chat/completions")
    route.mock(
        side_effect=[
            Response(500, json={"error": "server"}),
            Response(500, json={"error": "server"}),
            Response(200, json={"choices": [{"message": {"content": "ok"}}]}),
        ]
    )
    client = OpenAICompatibleClient(
        provider="ollama",
        model="m",
        api_key="k",
        base_url="https://openai.viloads.com/v1",
    )
    resp = await client.complete([{"role": "user", "content": "x"}])
    assert resp.content == "ok"
    assert route.call_count == 3
    assert delays == [0.5, 1.0]
    await client.aclose()


@respx.mock
async def test_retry_final_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    original_sleep = __import__("asyncio").sleep

    async def fake_sleep(d: float) -> None:
        await original_sleep(0)

    monkeypatch.setattr("app.llm_client.asyncio.sleep", fake_sleep)

    route = respx.post("https://openai.viloads.com/v1/chat/completions")
    route.mock(return_value=Response(500, json={"error": "server"}))
    client = OpenAICompatibleClient(
        provider="ollama",
        model="m",
        api_key="k",
        base_url="https://openai.viloads.com/v1",
    )
    with pytest.raises(LLMError):
        await client.complete([{"role": "user", "content": "x"}])
    assert route.call_count == 3
    await client.aclose()


def test_build_llm_client_ollama() -> None:
    c = build_llm_client(_ollama_config())
    assert isinstance(c, OpenAICompatibleClient)
    assert c.provider == "ollama"


def test_build_llm_client_openai() -> None:
    c = build_llm_client(_openai_config())
    assert isinstance(c, OpenAICompatibleClient)
    assert c.provider == "openai"


def test_build_llm_client_gemini() -> None:
    c = build_llm_client(_gemini_config())
    assert isinstance(c, GeminiClient)


def test_build_llm_client_invalid_provider_raises() -> None:
    bad = AppConfig.model_construct(llm_provider="invalid", max_turns=1)
    with pytest.raises(LLMError, match="Unsupported provider"):
        build_llm_client(bad)


@respx.mock
async def test_retry_backoff_delays(monkeypatch: pytest.MonkeyPatch) -> None:
    delays: list[float] = []
    original_sleep = __import__("asyncio").sleep

    async def fake_sleep(d: float) -> None:
        delays.append(d)
        await original_sleep(0)

    monkeypatch.setattr("app.llm_client.asyncio.sleep", fake_sleep)

    route = respx.post("https://openai.viloads.com/v1/chat/completions")
    route.mock(
        side_effect=[
            Response(500, json={"error": "server"}),
            Response(500, json={"error": "server"}),
            Response(200, json={"choices": [{"message": {"content": "ok"}}]}),
        ]
    )
    client = OpenAICompatibleClient(
        provider="ollama",
        model="m",
        api_key="k",
        base_url="https://openai.viloads.com/v1",
    )
    resp = await client.complete([{"role": "user", "content": "x"}])
    assert resp.content == "ok"
    assert route.call_count == 3
    assert delays == [0.5, 1.0]
    await client.aclose()


async def test_retry_async_final_failure_raises_llmerror(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx
    from app.llm_client import retry_async

    original_sleep = __import__("asyncio").sleep

    async def fake_sleep(d: float) -> None:
        await original_sleep(0)

    monkeypatch.setattr("app.llm_client.asyncio.sleep", fake_sleep)

    call_count = {"n": 0}

    async def always_fail() -> None:
        call_count["n"] += 1
        raise httpx.RequestError("network down", request=httpx.Request("POST", "https://x"))

    with pytest.raises(LLMError, match="failed after 3 attempts"):
        await retry_async(always_fail, max_attempts=3, base_delay=0.5)  # type: ignore[arg-type]
    assert call_count["n"] == 3


def _agents_yaml_config(**overrides: object) -> AppConfig:
    base: dict[str, object] = {
        "llm_provider": "ollama",
        "max_turns": 3,
        "ollama_api_key": "test-key",
        "ollama_base_url": "https://openai.viloads.com/v1",
        "ollama_model": "test-model",
    }
    base.update(overrides)
    return AppConfig(**base)  # type: ignore[arg-type]


def _make_spec(name: str, provider: str, model: str) -> AgentSpec:
    return AgentSpec(
        name=name,
        binary_code="x/y",
        concern="c",
        system_prompt="p",
        provider=provider,  # type: ignore[arg-type]
        model=model,
    )


def test_build_agent_clients_caches_same_provider_model() -> None:
    config = _agents_yaml_config()
    agents = [
        _make_spec("A", "ollama", "m1"),
        _make_spec("B", "ollama", "m1"),
    ]
    clients = build_agent_clients(agents, config)
    assert clients["A"] is clients["B"]


def test_build_agent_clients_distinct_for_different_model() -> None:
    config = _agents_yaml_config()
    agents = [
        _make_spec("A", "ollama", "m1"),
        _make_spec("B", "ollama", "m2"),
    ]
    clients = build_agent_clients(agents, config)
    assert clients["A"] is not clients["B"]


def test_build_agent_clients_mixed_providers() -> None:
    config = _agents_yaml_config(
        gemini_api_key="g-key",
    )
    agents = [
        _make_spec("A", "ollama", "m1"),
        _make_spec("B", "gemini", "gemini-1.5-pro"),
    ]
    clients = build_agent_clients(agents, config)
    assert isinstance(clients["A"], OpenAICompatibleClient)
    assert isinstance(clients["B"], GeminiClient)


def test_build_agent_clients_missing_ollama_key_raises() -> None:
    config = AppConfig.model_construct(
        llm_provider="ollama",
        max_turns=3,
        ollama_api_key=None,
        ollama_base_url="https://openai.viloads.com/v1",
        ollama_model="test-model",
    )
    agents = [_make_spec("A", "ollama", "m1")]
    with pytest.raises(LLMError, match="ollama credentials"):
        build_agent_clients(agents, config)


def test_build_agent_clients_missing_gemini_key_raises() -> None:
    config = _agents_yaml_config()
    agents = [_make_spec("A", "gemini", "gemini-1.5-pro")]
    with pytest.raises(LLMError, match="gemini credentials"):
        build_agent_clients(agents, config)


class _CountingClient:
    def __init__(self) -> None:
        self.closed = False
        self.close_count = 0

    async def complete(self, messages: list[dict[str, str]]) -> None:
        raise NotImplementedError

    async def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        raise NotImplementedError
        yield ""  # pragma: no cover

    async def aclose(self) -> None:
        self.closed = True
        self.close_count += 1


async def test_close_all_clients_closes_unique_only() -> None:
    shared = _CountingClient()
    other = _CountingClient()
    clients: dict[str, LLMClient] = {
        "A": shared,  # type: ignore[dict-item]
        "B": shared,  # type: ignore[dict-item]
        "C": other,  # type: ignore[dict-item]
    }
    await close_all_clients(clients)
    assert shared.closed and other.closed
    assert shared.close_count == 1
    assert other.close_count == 1


async def test_close_all_clients_gather_concurrent() -> None:
    c1 = _CountingClient()
    c2 = _CountingClient()
    clients: dict[str, LLMClient] = {
        "A": c1,  # type: ignore[dict-item]
        "B": c2,  # type: ignore[dict-item]
    }
    await close_all_clients(clients)
    assert c1.closed and c2.closed
