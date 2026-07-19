from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class AgentSpec(BaseModel):
    name: str
    binary_code: str
    concern: str
    system_prompt: str
    provider: Literal["ollama", "gemini", "openai", "opencode", "opencode-go"]
    model: str
    is_meta: bool = False
    avatar_hue: int | None = Field(default=None, ge=0, le=359)
    avatar_glyph: str | None = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v

    @field_validator("model")
    @classmethod
    def model_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("model must not be empty")
        return v


class AgentConfigFile(BaseModel):
    agents: list[AgentSpec]

    @model_validator(mode="after")
    def validate_agents(self) -> "AgentConfigFile":
        if not self.agents:
            raise ValueError("agents list must not be empty")
        names = [a.name for a in self.agents]
        if len(set(names)) != len(names):
            dupes = {n for n in names if names.count(n) > 1}
            raise ValueError(f"agent names must be unique, duplicates: {sorted(dupes)}")
        return self


class Message(BaseModel):
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    turn: int
    agent_name: str
    agent_code: str
    message: str
    provider: str
    model: str


class SimulationConfig(BaseModel):
    trigger_message: str
    max_turns: int = Field(ge=0)
    agent_order: list[str]
    agent_order_mode: Literal["fixed", "dynamic"] = "fixed"
    history_length: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def validate_agent_order(self) -> "SimulationConfig":
        if not self.agent_order:
            raise ValueError("agent_order must not be empty")
        if len(set(self.agent_order)) != len(self.agent_order):
            raise ValueError("agent_order must not contain duplicates")
        return self


class LLMResponse(BaseModel):
    content: str
    provider: str
    model: str


class AppConfig(BaseModel):
    llm_provider: Literal["ollama", "gemini", "openai", "opencode", "opencode-go"]
    max_turns: int = Field(ge=0)
    agents_config: str | None = None
    agent_order_mode: Literal["fixed", "dynamic"] = "fixed"
    history_length: int = Field(default=1, ge=1)

    ollama_api_key: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    gemini_api_key: str | None = None
    gemini_base_url: str | None = None
    gemini_model: str | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None
    opencode_api_key: str | None = None
    opencode_base_url: str | None = None
    opencode_model: str | None = None
    opencode_go_api_key: str | None = None
    opencode_go_base_url: str | None = None
    opencode_go_model: str | None = None

    @model_validator(mode="after")
    def validate_provider_credentials(self) -> "AppConfig":
        if self.agents_config is not None:
            if self.llm_provider == "ollama":
                if not self.ollama_api_key:
                    raise ValueError("OLLAMA_API_KEY is required when LLM_PROVIDER=ollama")
                if self.ollama_base_url is None:
                    raise ValueError("OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama")
            elif self.llm_provider == "gemini":
                if not self.gemini_api_key:
                    raise ValueError("GEMINI_API_KEY is required when LLM_PROVIDER=gemini")
                if self.gemini_base_url is None:
                    self.gemini_base_url = "https://generativelanguage.googleapis.com"
            elif self.llm_provider == "openai":
                if not self.openai_api_key:
                    raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
                if self.openai_base_url is None:
                    self.openai_base_url = "https://api.openai.com/v1"
            elif self.llm_provider == "opencode":
                if not self.opencode_api_key:
                    raise ValueError("OPENCODE_API_KEY is required when LLM_PROVIDER=opencode")
                if self.opencode_base_url is None:
                    self.opencode_base_url = "https://opencode.ai/zen/v1"
            elif self.llm_provider == "opencode-go":
                # opencode-go falls back to OPENCODE_API_KEY if its own key is unset
                effective_key = self.opencode_go_api_key or self.opencode_api_key
                if not effective_key:
                    raise ValueError(
                        "OPENCODE_GO_API_KEY (or OPENCODE_API_KEY) is required "
                        "when LLM_PROVIDER=opencode-go"
                    )
                if self.opencode_go_api_key is None:
                    self.opencode_go_api_key = self.opencode_api_key
                if self.opencode_go_base_url is None:
                    self.opencode_go_base_url = "https://opencode.ai/zen/go/v1"
            return self

        if self.llm_provider == "ollama":
            if not self.ollama_api_key:
                raise ValueError("OLLAMA_API_KEY is required when LLM_PROVIDER=ollama")
            if not self.ollama_model:
                raise ValueError("OLLAMA_MODEL is required when LLM_PROVIDER=ollama")
            if self.ollama_base_url is None:
                raise ValueError(
                    "OLLAMA_BASE_URL is required when LLM_PROVIDER=ollama "
                    "(no default endpoint for Ollama Cloud; set it in .env)"
                )
        elif self.llm_provider == "gemini":
            if not self.gemini_api_key:
                raise ValueError("GEMINI_API_KEY is required when LLM_PROVIDER=gemini")
            if not self.gemini_model:
                raise ValueError("GEMINI_MODEL is required when LLM_PROVIDER=gemini")
            if self.gemini_base_url is None:
                self.gemini_base_url = "https://generativelanguage.googleapis.com"
        elif self.llm_provider == "openai":
            if not self.openai_api_key:
                raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
            if not self.openai_model:
                raise ValueError("OPENAI_MODEL is required when LLM_PROVIDER=openai")
            if self.openai_base_url is None:
                self.openai_base_url = "https://api.openai.com/v1"
        elif self.llm_provider == "opencode":
            if not self.opencode_api_key:
                raise ValueError("OPENCODE_API_KEY is required when LLM_PROVIDER=opencode")
            if not self.opencode_model:
                raise ValueError("OPENCODE_MODEL is required when LLM_PROVIDER=opencode")
            if self.opencode_base_url is None:
                self.opencode_base_url = "https://opencode.ai/zen/v1"
        elif self.llm_provider == "opencode-go":
            # opencode-go falls back to OPENCODE_API_KEY if its own key is unset
            effective_key = self.opencode_go_api_key or self.opencode_api_key
            if not effective_key:
                raise ValueError(
                    "OPENCODE_GO_API_KEY (or OPENCODE_API_KEY) is required "
                    "when LLM_PROVIDER=opencode-go"
                )
            if self.opencode_go_api_key is None:
                self.opencode_go_api_key = self.opencode_api_key
            if not self.opencode_go_model:
                raise ValueError("OPENCODE_GO_MODEL is required when LLM_PROVIDER=opencode-go")
            if self.opencode_go_base_url is None:
                self.opencode_go_base_url = "https://opencode.ai/zen/go/v1"
        return self


class SimulationStartRequest(BaseModel):
    trigger_message: str
    max_turns: int = Field(ge=0)
    agents_config: str | None = None
    agents_inline: list[AgentSpec] | None = None
    agent_order_mode: Literal["fixed", "dynamic"] | None = None
    history_length: int | None = None

    @model_validator(mode="after")
    def validate_exclusive_agents_source(self) -> "SimulationStartRequest":
        if self.agents_config is not None and self.agents_inline is not None:
            raise ValueError("agents_config and agents_inline are mutually exclusive")
        return self


class SimulationStartResponse(BaseModel):
    simulation_id: str
    status: Literal["running", "completed", "failed"]


class SimulationState(BaseModel):
    simulation_id: str
    status: Literal["running", "completed", "failed"]
    started_at: datetime
    finished_at: datetime | None = None
    turn_count: int = 0
    error: str | None = None
    log_path: str


class WebSocketEvent(BaseModel):
    event: Literal["completed", "failed", "not_found"]
    error: str | None = None
