import os
from typing import Literal

from dotenv import load_dotenv
from pydantic import ValidationError

from app.schemas import AppConfig

_SUPPORTED_PROVIDERS = {"ollama", "gemini", "openai", "opencode", "opencode-go"}


def _parse_order_mode(raw: str | None) -> Literal["fixed", "dynamic"]:
    if raw is None or raw == "":
        return "fixed"
    if raw not in ("fixed", "dynamic"):
        raise ValueError(f"AGENT_ORDER_MODE must be 'fixed' or 'dynamic': {raw!r}")
    return raw  # type: ignore[return-value]


def _parse_history_length(raw: str | None) -> int:
    if raw is None or raw == "":
        return 1
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"HISTORY_LENGTH must be an integer: {raw!r}") from exc
    if value < 1:
        raise ValueError(f"HISTORY_LENGTH must be >= 1: {value}")
    return value


def load_config() -> AppConfig:
    load_dotenv()
    provider = os.environ.get("LLM_PROVIDER")
    if provider is None:
        raise ValueError("LLM_PROVIDER is required")
    if provider not in _SUPPORTED_PROVIDERS:
        raise ValueError(
            f"LLM_PROVIDER must be one of {sorted(_SUPPORTED_PROVIDERS)}: {provider!r}"
        )
    max_turns_raw = os.environ.get("MAX_TURNS")
    if max_turns_raw is None:
        raise ValueError("MAX_TURNS is required")
    try:
        max_turns = int(max_turns_raw)
    except ValueError as exc:
        raise ValueError(f"MAX_TURNS must be an integer: {max_turns_raw!r}") from exc

    agents_config = os.environ.get("AGENTS_CONFIG") or None
    agent_order_mode = _parse_order_mode(os.environ.get("AGENT_ORDER_MODE"))
    history_length = _parse_history_length(os.environ.get("HISTORY_LENGTH"))

    try:
        config = AppConfig(
            llm_provider=provider,  # type: ignore[arg-type]
            max_turns=max_turns,
            agents_config=agents_config,
            agent_order_mode=agent_order_mode,
            history_length=history_length,
            ollama_api_key=os.environ.get("OLLAMA_API_KEY") or None,
            ollama_base_url=os.environ.get("OLLAMA_BASE_URL") or None,
            ollama_model=os.environ.get("OLLAMA_MODEL") or None,
            gemini_api_key=os.environ.get("GEMINI_API_KEY") or None,
            gemini_base_url=os.environ.get("GEMINI_BASE_URL") or None,
            gemini_model=os.environ.get("GEMINI_MODEL") or None,
            openai_api_key=os.environ.get("OPENAI_API_KEY") or None,
            openai_base_url=os.environ.get("OPENAI_BASE_URL") or None,
            openai_model=os.environ.get("OPENAI_MODEL") or None,
            opencode_api_key=os.environ.get("OPENCODE_API_KEY") or None,
            opencode_base_url=os.environ.get("OPENCODE_BASE_URL") or None,
            opencode_model=os.environ.get("OPENCODE_MODEL") or None,
            opencode_go_api_key=os.environ.get("OPENCODE_GO_API_KEY") or None,
            opencode_go_base_url=os.environ.get("OPENCODE_GO_BASE_URL") or None,
            opencode_go_model=os.environ.get("OPENCODE_GO_MODEL") or None,
        )
    except ValidationError as exc:
        raise ValueError(f"Invalid configuration: {exc}") from exc
    return config
