from app.agents import AGENTS, ECONOMY_AGENT, LAW_AGENT, SCIENCE_AGENT


def test_economy_agent_fields() -> None:
    assert ECONOMY_AGENT.name == "経済システム"
    assert ECONOMY_AGENT.binary_code == "支払/非支払"
    assert "コスト" in ECONOMY_AGENT.concern or "利益" in ECONOMY_AGENT.concern
    assert "支払/非支払" in ECONOMY_AGENT.system_prompt
    assert "経済システム" in ECONOMY_AGENT.system_prompt


def test_science_agent_fields() -> None:
    assert SCIENCE_AGENT.name == "科学システム"
    assert SCIENCE_AGENT.binary_code == "真/偽"
    assert "エビデンス" in SCIENCE_AGENT.concern or "論理" in SCIENCE_AGENT.concern
    assert "真/偽" in SCIENCE_AGENT.system_prompt
    assert "科学システム" in SCIENCE_AGENT.system_prompt


def test_law_agent_fields() -> None:
    assert LAW_AGENT.name == "法システム"
    assert LAW_AGENT.binary_code == "合法/違法"
    assert "権利" in LAW_AGENT.concern or "契約" in LAW_AGENT.concern
    assert "合法/違法" in LAW_AGENT.system_prompt
    assert "法システム" in LAW_AGENT.system_prompt


def test_agent_names_unique() -> None:
    names = [ECONOMY_AGENT.name, SCIENCE_AGENT.name, LAW_AGENT.name]
    assert len(set(names)) == 3


def test_agent_names_are_non_empty_strings() -> None:
    for agent in (ECONOMY_AGENT, SCIENCE_AGENT, LAW_AGENT):
        assert isinstance(agent.name, str)
        assert agent.name != ""
        assert agent.name == agent.name.strip()


def test_agent_system_prompt_mentions_concern() -> None:
    for agent in (ECONOMY_AGENT, SCIENCE_AGENT, LAW_AGENT):
        assert agent.concern in agent.system_prompt


def test_agents_have_provider_and_model() -> None:
    from app.agents import _fallback_agents
    from app.schemas import AppConfig

    config = AppConfig(
        llm_provider="ollama",
        max_turns=1,
        ollama_api_key="k",
        ollama_base_url="https://x",
        ollama_model="test-model",
    )
    specs = _fallback_agents(config)
    for spec in specs:
        assert spec.provider == "ollama"
        assert spec.model == "test-model"
        assert spec.name in {a.name for a in AGENTS}
