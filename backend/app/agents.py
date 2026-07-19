from dataclasses import dataclass
from pathlib import Path
from typing import cast

import yaml  # type: ignore[import-untyped]
from pydantic import ValidationError

from app.schemas import AgentConfigFile, AgentSpec, AppConfig


@dataclass(frozen=True)
class _HardcodedAgent:
    name: str
    binary_code: str
    concern: str
    system_prompt: str


ECONOMY_AGENT = _HardcodedAgent(
    name="経済システム",
    binary_code="支払/非支払",
    concern="コスト・利益・市場価値・資源効率",
    system_prompt=(
        "あなたは経済システムである。"
        "世界を二値コード「支払/非支払」で解釈し、"
        "コスト・利益・市場価値・資源効率に関心を持つ。"
        "入力されたメッセージをこのコードの視点からのみ解釈し、"
        "経済システムとしての発言を生成せよ。"
    ),
)

SCIENCE_AGENT = _HardcodedAgent(
    name="科学システム",
    binary_code="真/偽",
    concern="データ客観性・論理整合性・エビデンス・事実検証",
    system_prompt=(
        "あなたは科学システムである。"
        "世界を二値コード「真/偽」で解釈し、"
        "データ客観性・論理整合性・エビデンス・事実検証に関心を持つ。"
        "入力されたメッセージをこのコードの視点からのみ解釈し、"
        "科学システムとしての発言を生成せよ。"
    ),
)

LAW_AGENT = _HardcodedAgent(
    name="法システム",
    binary_code="合法/違法",
    concern="規約遵守・権利・契約正当性",
    system_prompt=(
        "あなたは法システムである。"
        "世界を二値コード「合法/違法」で解釈し、"
        "規約遵守・権利・契約正当性に関心を持つ。"
        "入力されたメッセージをこのコードの視点からのみ解釈し、"
        "法システムとしての発言を生成せよ。"
    ),
)

AGENTS: list[_HardcodedAgent] = [ECONOMY_AGENT, SCIENCE_AGENT, LAW_AGENT]

_DEFAULT_CONFIG_PATH = Path("config/agents.yaml")


def _resolve_config_path(config_path: str | None) -> Path | None:
    if config_path is not None:
        path = Path(config_path)
        if not path.is_file():
            raise ValueError(f"AGENTS_CONFIG で指定されたパスが存在しません: {path}")
        return path
    if _DEFAULT_CONFIG_PATH.is_file():
        return _DEFAULT_CONFIG_PATH
    return None


def _fallback_agents(config: AppConfig) -> list[AgentSpec]:
    model = {
        "ollama": config.ollama_model,
        "gemini": config.gemini_model,
        "openai": config.openai_model,
        "opencode": config.opencode_model,
        "opencode-go": config.opencode_go_model,
    }[config.llm_provider]
    if model is None:
        raise ValueError(
            f"フォールバック時に model が未設定です: {config.llm_provider}_MODEL を .env に"
            f" 設定するか AGENTS_CONFIG で YAML を指定してください"
        )
    return [
        AgentSpec(
            name=a.name,
            binary_code=a.binary_code,
            concern=a.concern,
            system_prompt=a.system_prompt,
            provider=config.llm_provider,
            model=model,
        )
        for a in AGENTS
    ]


def load_agents(config_path: str | None, config: AppConfig) -> tuple[list[AgentSpec], str | None]:
    path = _resolve_config_path(config_path)
    if path is None:
        return _fallback_agents(config), None
    raw = path.read_text(encoding="utf-8")
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        raise ValueError(f"YAML パースエラー: {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"YAML root must be a mapping: {path}")
    typed_data = cast(dict[str, object], data)
    try:
        file_model = AgentConfigFile.model_validate(typed_data)
    except ValidationError as exc:
        raise ValueError(f"Invalid agents config {path}: {exc}") from exc
    return file_model.agents, str(path)
