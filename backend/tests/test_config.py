import pytest
from app.config import load_config
from app.schemas import AppConfig
from pydantic import ValidationError


@pytest.fixture(autouse=True)
def mock_load_dotenv(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.config as config_mod

    monkeypatch.setattr(config_mod, "load_dotenv", lambda *a, **k: None)


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
    import app.config as config_mod

    monkeypatch.setattr(config_mod, "load_dotenv", lambda *a, **k: False)
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


def test_appconfig_opencode_defaults() -> None:
    cfg = AppConfig(
        llm_provider="opencode",
        max_turns=1,
        opencode_api_key="k",
        opencode_model="m",
    )
    assert cfg.opencode_base_url == "https://opencode.ai/zen/v1"


def test_appconfig_opencode_missing_api_key_fails_fast() -> None:
    with pytest.raises(ValidationError, match="OPENCODE_API_KEY"):
        AppConfig(
            llm_provider="opencode",
            max_turns=1,
            opencode_api_key=None,
            opencode_model="m",
        )


def test_appconfig_ollama_missing_base_url_fails_fast() -> None:
    with pytest.raises(ValidationError, match="OLLAMA_BASE_URL"):
        AppConfig(
            llm_provider="ollama",
            max_turns=1,
            ollama_api_key="k",
            ollama_model="m",
        )


def test_load_config_reads_agents_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "9")
    monkeypatch.setenv("OLLAMA_API_KEY", "k")
    monkeypatch.setenv("OLLAMA_BASE_URL", "https://x")
    monkeypatch.setenv("AGENTS_CONFIG", "config/presets/agents-5.yaml")
    cfg = load_config()
    assert cfg.agents_config == "config/presets/agents-5.yaml"


def test_load_config_agents_config_optional(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "9")
    monkeypatch.setenv("OLLAMA_API_KEY", "k")
    monkeypatch.setenv("OLLAMA_BASE_URL", "https://x")
    monkeypatch.setenv("OLLAMA_MODEL", "m")
    monkeypatch.delenv("AGENTS_CONFIG", raising=False)
    cfg = load_config()
    assert cfg.agents_config is None


def test_appconfig_yaml_skips_model_check() -> None:
    cfg = AppConfig(
        llm_provider="ollama",
        max_turns=1,
        agents_config="config/agents.yaml",
        ollama_api_key="k",
        ollama_base_url="https://x",
    )
    assert cfg.ollama_model is None
    assert cfg.agents_config == "config/agents.yaml"


def test_appconfig_opencode_go_defaults() -> None:
    cfg = AppConfig(
        llm_provider="opencode-go",
        max_turns=1,
        opencode_go_api_key="k",
        opencode_go_model="m",
    )
    assert cfg.opencode_go_base_url == "https://opencode.ai/zen/go/v1"


def test_appconfig_opencode_go_fallback_to_opencode_key() -> None:
    """opencode-go falls back to OPENCODE_API_KEY when its own key is empty."""
    cfg = AppConfig(
        llm_provider="opencode-go",
        max_turns=1,
        opencode_api_key="shared-key",
        opencode_go_model="m",
    )
    assert cfg.opencode_go_api_key == "shared-key"
    assert cfg.opencode_go_base_url == "https://opencode.ai/zen/go/v1"


def test_appconfig_opencode_go_missing_both_keys_fails_fast() -> None:
    with pytest.raises(ValidationError, match="OPENCODE_GO_API_KEY"):
        AppConfig(
            llm_provider="opencode-go",
            max_turns=1,
            opencode_go_api_key=None,
            opencode_api_key=None,
            opencode_go_model="m",
        )


def test_appconfig_opencode_go_missing_model_fails_fast() -> None:
    with pytest.raises(ValidationError, match="OPENCODE_GO_MODEL"):
        AppConfig(
            llm_provider="opencode-go",
            max_turns=1,
            opencode_go_api_key="k",
            opencode_go_model=None,
        )


def test_load_config_opencode_go(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "opencode-go")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.setenv("OPENCODE_GO_API_KEY", "go-key")
    monkeypatch.setenv("OPENCODE_GO_MODEL", "deepseek-v4-pro")
    monkeypatch.delenv("OPENCODE_GO_BASE_URL", raising=False)
    cfg = load_config()
    assert cfg.llm_provider == "opencode-go"
    assert cfg.opencode_go_api_key == "go-key"
    assert cfg.opencode_go_base_url == "https://opencode.ai/zen/go/v1"
    assert cfg.opencode_go_model == "deepseek-v4-pro"


def test_load_config_opencode_go_fallback_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "opencode-go")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.delenv("OPENCODE_GO_API_KEY", raising=False)
    monkeypatch.setenv("OPENCODE_API_KEY", "shared-key")
    monkeypatch.setenv("OPENCODE_GO_MODEL", "deepseek-v4-pro")
    cfg = load_config()
    assert cfg.opencode_go_api_key == "shared-key"


def test_load_config_ollama_mode_cloud(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.setenv("OLLAMA_MODE", "cloud")
    monkeypatch.setenv("OLLAMA_CLOUD_API_KEY", "cloud-key")
    monkeypatch.setenv("OLLAMA_CLOUD_MODEL", "gpt-oss:120b")
    monkeypatch.delenv("OLLAMA_CLOUD_BASE_URL", raising=False)
    monkeypatch.delenv("OLLAMA_API_KEY", raising=False)
    monkeypatch.delenv("OLLAMA_BASE_URL", raising=False)
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)
    cfg = load_config()
    assert cfg.ollama_mode == "cloud"
    assert cfg.ollama_api_key == "cloud-key"
    assert cfg.ollama_base_url == "https://ollama.com/v1"
    assert cfg.ollama_model == "gpt-oss:120b"
    assert cfg.ollama_cloud_api_key == "cloud-key"
    assert cfg.ollama_cloud_base_url == "https://ollama.com/v1"
    assert cfg.ollama_cloud_model == "gpt-oss:120b"


def test_load_config_ollama_mode_local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.setenv("OLLAMA_MODE", "local")
    monkeypatch.setenv("OLLAMA_LOCAL_MODEL", "llama3.1:8b")
    monkeypatch.delenv("OLLAMA_LOCAL_BASE_URL", raising=False)
    monkeypatch.delenv("OLLAMA_API_KEY", raising=False)
    monkeypatch.delenv("OLLAMA_BASE_URL", raising=False)
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)
    cfg = load_config()
    assert cfg.ollama_mode == "local"
    assert cfg.ollama_api_key == "local"
    assert cfg.ollama_base_url == "http://localhost:11434/v1"
    assert cfg.ollama_model == "llama3.1:8b"
    assert cfg.ollama_local_base_url == "http://localhost:11434/v1"
    assert cfg.ollama_local_model == "llama3.1:8b"


def test_load_config_ollama_mode_cloud_missing_api_key_fails_fast(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.setenv("OLLAMA_MODE", "cloud")
    monkeypatch.setenv("OLLAMA_CLOUD_MODEL", "gpt-oss:120b")
    monkeypatch.delenv("OLLAMA_CLOUD_API_KEY", raising=False)
    with pytest.raises((ValueError, ValidationError)):
        load_config()


def test_load_config_ollama_mode_local_missing_model_fails_fast(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.setenv("OLLAMA_MODE", "local")
    monkeypatch.delenv("OLLAMA_LOCAL_MODEL", raising=False)
    with pytest.raises((ValueError, ValidationError)):
        load_config()


def test_load_config_ollama_mode_unset_falls_back_to_legacy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("MAX_TURNS", "5")
    monkeypatch.delenv("OLLAMA_MODE", raising=False)
    monkeypatch.setenv("OLLAMA_API_KEY", "legacy-key")
    monkeypatch.setenv("OLLAMA_BASE_URL", "https://legacy.example/v1")
    monkeypatch.setenv("OLLAMA_MODEL", "legacy-model")
    cfg = load_config()
    assert cfg.ollama_mode is None
    assert cfg.ollama_api_key == "legacy-key"
    assert cfg.ollama_base_url == "https://legacy.example/v1"
    assert cfg.ollama_model == "legacy-model"
