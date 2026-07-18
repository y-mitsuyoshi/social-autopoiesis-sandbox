import asyncio
import re
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


def validate_dynamic_order(agents: list[AgentSpec], sim_config: SimulationConfig) -> None:
    if sim_config.agent_order_mode != "dynamic":
        return
    if not any(a.is_meta for a in agents):
        raise ValueError("agent_order_mode='dynamic' requires at least one agent with is_meta=true")
    meta_names = {a.name for a in agents if a.is_meta}
    non_meta = [a.name for a in agents if not a.is_meta]
    if not non_meta:
        raise ValueError("agent_order_mode='dynamic' requires at least one non-meta agent")
    if sim_config.agent_order and all(name in meta_names for name in sim_config.agent_order):
        raise ValueError("agent_order must contain at least one non-meta agent for dynamic mode")


def _build_user_content(trigger: str, history: list[str]) -> str:
    if not history:
        return f"お題: {trigger}\n直前の発言: {trigger}"
    if len(history) == 1:
        return f"お題: {trigger}\n直前の発言: {history[0]}"
    history_block = "\n".join(history)
    return f"お題: {trigger}\n過去の発言:\n{history_block}"


def _select_next_agent_by_meta(content: str, candidates: list[str], fallback_index: int) -> str:
    if not candidates:
        return ""
    pattern = r"(" + "|".join(re.escape(c) for c in candidates) + r")"
    m = re.search(pattern, content)
    if m is None:
        return candidates[fallback_index % len(candidates)]
    return m.group(1)


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

    order = [agent_map[name] for name in config.agent_order if not agent_map[name].is_meta]
    if not order:
        raise ValueError("no non-meta agents available to speak")
    meta_agents = [a for a in agents if a.is_meta]
    meta_agent = meta_agents[0] if meta_agents else None

    history: list[str] = []
    try:
        turn = 0
        next_agent = order[0]
        for _counter in count():
            if config.max_turns and turn >= config.max_turns:
                break
            agent = next_agent
            client = clients[agent.name]
            messages = [
                {"role": "system", "content": agent.system_prompt},
                {
                    "role": "user",
                    "content": _build_user_content(config.trigger_message, history),
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
            history.append(resp.content)
            while len(history) > config.history_length:
                history.pop(0)

            if config.agent_order_mode == "dynamic" and meta_agent is not None:
                meta_client = clients[meta_agent.name]
                candidate_names = [a.name for a in order]
                meta_messages = [
                    {"role": "system", "content": meta_agent.system_prompt},
                    {
                        "role": "user",
                        "content": (
                            "直前の発言を受けて、次に発言すべきエージェント名を1つ返せ。"
                            f"選択肢: {', '.join(candidate_names)}"
                        ),
                    },
                ]
                meta_resp = await meta_client.complete(meta_messages)
                fallback_index = (turn + 1) % len(order)
                next_name = _select_next_agent_by_meta(
                    meta_resp.content, candidate_names, fallback_index
                )
                next_agent = agent_map[next_name]
            else:
                next_agent = order[(turn + 1) % len(order)]

            turn += 1
            await asyncio.sleep(0)
    except asyncio.CancelledError:
        print("\nシミュレーションを中断します。")
        raise
