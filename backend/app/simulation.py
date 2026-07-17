import asyncio
from itertools import count

from app.llm_client import LLMClient
from app.logger import SimulationLogger
from app.schemas import AgentSpec, AppConfig, Message, SimulationConfig


def validate_agent_credentials(agents: list[AgentSpec], config: AppConfig) -> None:
    for agent in agents:
        if agent.provider == "ollama":
            if config.ollama_api_key is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=ollama を指定していますが、"
                    f"OLLAMA_API_KEY が未設定です"
                )
            if config.ollama_base_url is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=ollama を指定していますが、"
                    f"OLLAMA_BASE_URL が未設定です"
                )
        elif agent.provider == "gemini":
            if config.gemini_api_key is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=gemini を指定していますが、"
                    f"GEMINI_API_KEY が未設定です"
                )
        elif agent.provider == "openai":
            if config.openai_api_key is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=openai を指定していますが、"
                    f"OPENAI_API_KEY が未設定です"
                )
            if config.openai_base_url is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=openai を指定していますが、"
                    f"OPENAI_BASE_URL が未設定です"
                )


async def run_simulation(
    config: SimulationConfig,
    agents: list[AgentSpec],
    clients: dict[str, LLMClient],
    logger: SimulationLogger,
) -> None:
    agent_map = {a.name: a for a in agents}
    for name in config.agent_order:
        if name not in agent_map:
            raise ValueError(f"agent_order references unknown agent: {name}")
    for name in config.agent_order:
        if name not in clients:
            raise ValueError(f"clients missing for agent: {name}")

    order = [agent_map[name] for name in config.agent_order]
    prev_message: str = config.trigger_message
    try:
        for turn in count():
            if config.max_turns and turn >= config.max_turns:
                break
            agent = order[turn % len(order)]
            client = clients[agent.name]
            messages = [
                {"role": "system", "content": agent.system_prompt},
                {
                    "role": "user",
                    "content": f"お題: {config.trigger_message}\n直前の発言: {prev_message}",
                },
            ]
            resp = await client.complete(messages)
            msg = Message(
                turn=turn,
                agent_name=agent.name,
                agent_code=agent.binary_code,
                message=resp.content,
                provider=resp.provider,
                model=resp.model,
            )
            await logger.log(msg)
            prev_message = resp.content
            await asyncio.sleep(0)
    except asyncio.CancelledError:
        print("\nシミュレーションを中断します。")
        raise
