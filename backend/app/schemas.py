from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AgentSpec(BaseModel):
    name: str
    binary_code: str
    concern: str
    system_prompt: str


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
    provider: str
    model: str

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
    llm_provider: Literal["ollama", "gemini", "openai"]
    max_turns: int = Field(ge=0)

    ollama_api_key: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    gemini_api_key: str | None = None
    gemini_base_url: str | None = None
    gemini_model: str | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None

    @model_validator(mode="after")
    def validate_provider_credentials(self) -> "AppConfig":
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
        return self
