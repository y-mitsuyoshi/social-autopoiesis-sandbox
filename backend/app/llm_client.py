import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Protocol

import httpx

from app.schemas import AgentSpec, AppConfig, LLMResponse


class LLMError(Exception):
    def __init__(self, message: str, cause: BaseException | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.cause = cause


class LLMClient(Protocol):
    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse: ...

    def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...

    async def aclose(self) -> None: ...


async def retry_async(
    func: Callable[[], Awaitable[LLMResponse]],
    max_attempts: int = 3,
    base_delay: float = 0.5,
) -> LLMResponse:
    attempt = 0
    last_exc: BaseException | None = None
    while attempt < max_attempts:
        try:
            return await func()
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            last_exc = exc
            attempt += 1
            if attempt >= max_attempts:
                break
            delay = base_delay * (2 ** (attempt - 1))
            await asyncio.sleep(delay)
    assert last_exc is not None
    raise LLMError(f"LLM request failed after {max_attempts} attempts", last_exc)


class OpenAICompatibleClient:
    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str,
        base_url: str,
    ) -> None:
        self._provider = provider
        self._model = model
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=60.0,
        )

    @property
    def provider(self) -> str:
        return self._provider

    @property
    def model(self) -> str:
        return self._model

    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
        async def _call() -> LLMResponse:
            resp = await self._client.post(
                "/chat/completions",
                json={
                    "model": self._model,
                    "messages": messages,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return LLMResponse(content=content, provider=self._provider, model=self._model)

        return await retry_async(_call)

    async def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        async with self._client.stream(
            "POST",
            "/chat/completions",
            json={
                "model": self._model,
                "messages": messages,
                "stream": True,
            },
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                payload = line[len("data:") :].strip()
                if payload == "[DONE]":
                    break
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                choices = data.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                token = delta.get("content")
                if token:
                    yield token

    async def aclose(self) -> None:
        await self._client.aclose()


class GeminiClient:
    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str,
    ) -> None:
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            timeout=60.0,
            headers={"x-goog-api-key": api_key},
        )

    async def complete(self, messages: list[dict[str, str]]) -> LLMResponse:
        async def _call() -> LLMResponse:
            contents = []
            for m in messages:
                role = "user" if m["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": m["content"]}]})
            url = f"{self._base_url}/v1beta/models/{self._model}:generateContent"
            resp = await self._client.post(
                url,
                json={"contents": contents},
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            return LLMResponse(content=content, provider="gemini", model=self._model)

        return await retry_async(_call)

    async def complete_stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
        url = f"{self._base_url}/v1beta/models/{self._model}:streamGenerateContent?alt=sse"
        async with self._client.stream("POST", url, json={"contents": contents}) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                payload = line[len("data:") :].strip()
                if payload == "[DONE]":
                    break
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                candidates = data.get("candidates") or []
                if not candidates:
                    continue
                parts = candidates[0].get("content", {}).get("parts") or []
                if not parts:
                    continue
                token = parts[0].get("text")
                if token:
                    yield token

    async def aclose(self) -> None:
        await self._client.aclose()


def _build_single_client(provider: str, model: str, config: AppConfig) -> LLMClient:
    if provider == "ollama":
        if config.ollama_api_key is None or config.ollama_base_url is None:
            raise LLMError("ollama credentials are not configured")
        return OpenAICompatibleClient(
            provider="ollama",
            model=model,
            api_key=config.ollama_api_key,
            base_url=config.ollama_base_url,
        )
    if provider == "openai":
        if config.openai_api_key is None or config.openai_base_url is None:
            raise LLMError("openai credentials are not configured")
        return OpenAICompatibleClient(
            provider="openai",
            model=model,
            api_key=config.openai_api_key,
            base_url=config.openai_base_url,
        )
    if provider == "gemini":
        if config.gemini_api_key is None:
            raise LLMError("gemini credentials are not configured")
        base_url = config.gemini_base_url or "https://generativelanguage.googleapis.com"
        return GeminiClient(model=model, api_key=config.gemini_api_key, base_url=base_url)
    raise LLMError(f"Unsupported provider: {provider}")


def build_agent_clients(
    agents: list[AgentSpec],
    config: AppConfig,
) -> dict[str, LLMClient]:
    cache: dict[tuple[str, str], LLMClient] = {}
    result: dict[str, LLMClient] = {}
    for agent in agents:
        key = (agent.provider, agent.model)
        if key not in cache:
            cache[key] = _build_single_client(agent.provider, agent.model, config)
        result[agent.name] = cache[key]
    return result


async def close_all_clients(clients: dict[str, LLMClient]) -> None:
    seen: set[int] = set()
    to_close: list[LLMClient] = []
    for c in clients.values():
        if id(c) not in seen:
            seen.add(id(c))
            to_close.append(c)
    results = await asyncio.gather(*[c.aclose() for c in to_close], return_exceptions=True)
    errors = [r for r in results if isinstance(r, BaseException)]
    if errors:
        raise errors[0]


def build_llm_client(config: AppConfig) -> LLMClient:
    if config.llm_provider == "ollama":
        if (
            config.ollama_api_key is None
            or config.ollama_model is None
            or config.ollama_base_url is None
        ):
            raise LLMError("ollama credentials are not configured")
        return OpenAICompatibleClient(
            provider="ollama",
            model=config.ollama_model,
            api_key=config.ollama_api_key,
            base_url=config.ollama_base_url,
        )
    if config.llm_provider == "openai":
        if (
            config.openai_api_key is None
            or config.openai_model is None
            or config.openai_base_url is None
        ):
            raise LLMError("openai credentials are not configured")
        return OpenAICompatibleClient(
            provider="openai",
            model=config.openai_model,
            api_key=config.openai_api_key,
            base_url=config.openai_base_url,
        )
    if config.llm_provider == "gemini":
        if (
            config.gemini_api_key is None
            or config.gemini_model is None
            or config.gemini_base_url is None
        ):
            raise LLMError("gemini credentials are not configured")
        return GeminiClient(
            model=config.gemini_model,
            api_key=config.gemini_api_key,
            base_url=config.gemini_base_url,
        )
    raise LLMError(f"Unsupported provider: {config.llm_provider}")
