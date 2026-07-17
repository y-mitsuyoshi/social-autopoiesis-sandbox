from pathlib import Path

import pytest
from app.agents import _fallback_agents, load_agents
from app.schemas import AppConfig
from pydantic import ValidationError


def _config(agents_config: str | None = None, model: str | None = "test-model") -> AppConfig:
    return AppConfig(
        llm_provider="ollama",
        max_turns=1,
        agents_config=agents_config,
        ollama_api_key="k",
        ollama_base_url="https://x",
        ollama_model=model,
    )


def _write_yaml(path: Path, content: str) -> Path:
    path.write_text(content, encoding="utf-8")
    return path


def test_load_agents_from_explicit_path(tmp_path: Path) -> None:
    path = _write_yaml(
        tmp_path / "agents.yaml",
        "agents:\n"
        "  - name: A\n"
        "    binary_code: x/y\n"
        "    concern: c\n"
        "    provider: ollama\n"
        "    model: m1\n"
        "    system_prompt: p\n"
        "  - name: B\n"
        "    binary_code: x/y\n"
        "    concern: c\n"
        "    provider: ollama\n"
        "    model: m2\n"
        "    system_prompt: p\n"
        "  - name: C\n"
        "    binary_code: x/y\n"
        "    concern: c\n"
        "    provider: ollama\n"
        "    model: m3\n"
        "    system_prompt: p\n",
    )
    agents, resolved = load_agents(str(path), _config())
    assert len(agents) == 3
    assert resolved == str(path)


def test_load_agents_default_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    default_path = config_dir / "agents.yaml"
    _write_yaml(
        default_path,
        "agents:\n"
        "  - name: 経済システム\n"
        "    binary_code: 支払/非支払\n"
        "    concern: c\n"
        "    provider: ollama\n"
        "    model: m\n"
        "    system_prompt: p\n",
    )
    monkeypatch.chdir(tmp_path)
    agents, resolved = load_agents(None, _config())
    assert len(agents) == 1
    assert resolved is not None
    assert Path(resolved).name == "agents.yaml"


def test_load_agents_fallback_to_hardcode(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    agents, resolved = load_agents(None, _config())
    assert resolved is None
    assert len(agents) == 3
    assert [a.name for a in agents] == ["経済システム", "科学システム", "法システム"]


def test_load_agents_returns_resolved_path(tmp_path: Path) -> None:
    path = _write_yaml(
        tmp_path / "a.yaml",
        "agents:\n"
        "  - name: X\n"
        "    binary_code: x/y\n"
        "    concern: c\n"
        "    provider: ollama\n"
        "    model: m\n"
        "    system_prompt: p\n",
    )
    agents, resolved = load_agents(str(path), _config())
    assert resolved == str(path)
    assert isinstance(agents, list)
    assert agents[0].name == "X"


def test_load_agents_duplicate_names_raises(tmp_path: Path) -> None:
    path = _write_yaml(
        tmp_path / "dup.yaml",
        "agents:\n"
        "  - name: A\n"
        "    binary_code: x/y\n"
        "    concern: c\n"
        "    provider: ollama\n"
        "    model: m\n"
        "    system_prompt: p\n"
        "  - name: A\n"
        "    binary_code: x/y\n"
        "    concern: c\n"
        "    provider: ollama\n"
        "    model: m\n"
        "    system_prompt: p\n",
    )
    with pytest.raises(ValueError, match="duplicates"):
        load_agents(str(path), _config())


def test_load_agents_empty_list_raises(tmp_path: Path) -> None:
    path = _write_yaml(tmp_path / "empty.yaml", "agents: []\n")
    with pytest.raises(ValueError, match="empty"):
        load_agents(str(path), _config())


def test_load_agents_missing_required_field_raises(tmp_path: Path) -> None:
    path = _write_yaml(
        tmp_path / "bad.yaml",
        "agents:\n"
        "  - name: A\n"
        "    binary_code: x/y\n"
        "    concern: c\n"
        "    provider: ollama\n"
        "    system_prompt: p\n",
    )
    with pytest.raises((ValueError, ValidationError)):
        load_agents(str(path), _config())


def test_load_agents_invalid_provider_raises(tmp_path: Path) -> None:
    path = _write_yaml(
        tmp_path / "badprov.yaml",
        "agents:\n"
        "  - name: A\n"
        "    binary_code: x/y\n"
        "    concern: c\n"
        "    provider: foo\n"
        "    model: m\n"
        "    system_prompt: p\n",
    )
    with pytest.raises((ValueError, ValidationError)):
        load_agents(str(path), _config())


def test_load_agents_empty_model_raises(tmp_path: Path) -> None:
    path = _write_yaml(
        tmp_path / "nomodel.yaml",
        "agents:\n"
        "  - name: A\n"
        "    binary_code: x/y\n"
        "    concern: c\n"
        "    provider: ollama\n"
        "    model: ''\n"
        "    system_prompt: p\n",
    )
    with pytest.raises((ValueError, ValidationError)):
        load_agents(str(path), _config())


def test_load_agents_invalid_yaml_syntax_raises(tmp_path: Path) -> None:
    path = tmp_path / "bad.yaml"
    path.write_text("agents: [unclosed", encoding="utf-8")
    with pytest.raises(ValueError, match="YAML"):
        load_agents(str(path), _config())


def test_load_agents_non_mapping_root_raises(tmp_path: Path) -> None:
    path = _write_yaml(tmp_path / "list.yaml", "- a\n- b\n")
    with pytest.raises(ValueError, match="mapping"):
        load_agents(str(path), _config())


def test_load_agents_nonexistent_explicit_path_raises(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="AGENTS_CONFIG"):
        load_agents(str(tmp_path / "nope.yaml"), _config())


def test_fallback_agents_uses_appconfig_provider_model() -> None:
    config = _config(model="custom-model")
    agents = _fallback_agents(config)
    for a in agents:
        assert a.provider == "ollama"
        assert a.model == "custom-model"


def test_load_agents_ten_agents_succeeds(tmp_path: Path) -> None:
    names = [f"エージェント{i}" for i in range(10)]
    lines = ["agents:\n"]
    for name in names:
        lines.append(
            "  - name: " + name + "\n"
            "    binary_code: x/y\n"
            "    concern: c\n"
            "    provider: ollama\n"
            "    model: m\n"
            "    system_prompt: p\n"
        )
    path = _write_yaml(tmp_path / "ten.yaml", "".join(lines))
    agents, resolved = load_agents(str(path), _config())
    assert len(agents) == 10
    assert [a.name for a in agents] == names
    assert resolved == str(path)


def test_fallback_agents_raises_when_model_missing() -> None:
    config = AppConfig.model_construct(
        llm_provider="ollama",
        max_turns=1,
        agents_config=None,
        ollama_api_key="k",
        ollama_base_url="https://x",
        ollama_model=None,
    )
    with pytest.raises(ValueError, match="フォールバック"):
        _fallback_agents(config)
