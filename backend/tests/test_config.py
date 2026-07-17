import pytest
from app.config import load_config
from app.schemas import AppConfig
from pydantic import ValidationError


def test_load_config_ollama(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "9")
    monkeypatch.setenv("OLLAMA_API_KEY", "key-abc")
    monkeypatch.setenv("OLLAMA_BASE_URL", "https://openai.viloads.com/v1")
    monkeypatch.setenv("OLLAMA_MODEL", "qwen")
    cfg = load_config()
    assert cfg.llm_provider == "ollama"
    assert cfg.max_turns == 9
    assert cfg.ollama_api_key == "key-abc"
    assert cfg.ollama_model == "qwen"
    assert cfg.ollama_base_url == "https://openai.viloads.com/v1"


def test_load_config_default_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-x")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4o-mini")
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    cfg = load_config()
    assert cfg.openai_base_url == "https://api.openai.com/v1"


def test_load_config_missing_api_key_fails_fast(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4o-mini")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises((ValueError, ValidationError)):
        load_config()


def test_load_config_missing_model_fails_fast(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    with pytest.raises((ValueError, ValidationError)):
        load_config()


def test_load_config_negative_max_turns(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "-1")
    monkeypatch.setenv("OLLAMA_API_KEY", "k")
    monkeypatch.setenv("OLLAMA_MODEL", "m")
    with pytest.raises((ValueError, ValidationError)):
        load_config()


def test_load_config_invalid_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "invalid")
    monkeypatch.setenv("MAX_TURNS", "5")
    with pytest.raises((ValueError, ValidationError)):
        load_config()


def test_load_config_missing_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("MAX_TURNS", "5")
    with pytest.raises(ValueError, match="LLM_PROVIDER"):
        load_config()


def test_appconfig_gemini_defaults() -> None:
    cfg = AppConfig(
        llm_provider="gemini",
        max_turns=1,
        gemini_api_key="k",
        gemini_model="m",
    )
    assert cfg.gemini_base_url == "https://generativelanguage.googleapis.com"


def test_appconfig_ollama_missing_api_key_fails_fast() -> None:
    with pytest.raises(ValidationError, match="OLLAMA_API_KEY"):
        AppConfig(
            llm_provider="ollama",
            max_turns=1,
            ollama_api_key=None,
            ollama_model="m",
        )


def test_appconfig_ollama_missing_model_fails_fast() -> None:
    with pytest.raises(ValidationError, match="OLLAMA_MODEL"):
        AppConfig(
            llm_provider="ollama",
            max_turns=1,
            ollama_api_key="k",
            ollama_model=None,
        )


def test_appconfig_gemini_missing_api_key_fails_fast() -> None:
    with pytest.raises(ValidationError, match="GEMINI_API_KEY"):
        AppConfig(
            llm_provider="gemini",
            max_turns=1,
            gemini_api_key=None,
            gemini_model="m",
        )


def test_appconfig_openai_missing_model_fails_fast() -> None:
    with pytest.raises(ValidationError, match="OPENAI_MODEL"):
        AppConfig(
            llm_provider="openai",
            max_turns=1,
            openai_api_key="k",
            openai_model=None,
        )


def test_appconfig_openai_defaults_applied() -> None:
    cfg = AppConfig(
        llm_provider="openai",
        max_turns=1,
        openai_api_key="k",
        openai_model="m",
    )
    assert cfg.openai_base_url == "https://api.openai.com/v1"


def test_appconfig_ollama_missing_base_url_fails_fast() -> None:
    with pytest.raises(ValidationError, match="OLLAMA_BASE_URL"):
        AppConfig(
            llm_provider="ollama",
            max_turns=1,
            ollama_api_key="k",
            ollama_model="m",
        )
