import asyncio
import sys
from itertools import count

from app.agents import load_agents
from app.config import load_config
from app.llm_client import LLMClient, LLMError, build_agent_clients, close_all_clients
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
            try:
                resp = await client.complete(messages)
            except LLMError as exc:
                print(f"[ターン {turn}] LLM呼出失敗: {exc.message}", file=sys.stderr)
                break
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
    finally:
        await close_all_clients(clients)
        await logger.aclose()


async def main() -> None:
    config = load_config()
    agents, resolved_path = load_agents(config.agents_config, config)
    validate_agent_credentials(agents, config)
    clients = build_agent_clients(agents, config)

    print("=== ルーマン・オートポイエーシス・シミュレーション ===")
    fallback_label = "ハードコード(フォールバック)"
    label = resolved_path if resolved_path is not None else fallback_label
    print(f"エージェント構成: {label}")
    for i, agent in enumerate(agents, start=1):
        print(f"  {i}. {agent.name}   [{agent.provider} / {agent.model}]")
    print(f"最大ターン: {'無限' if config.max_turns == 0 else config.max_turns}")

    trigger = await asyncio.to_thread(input, "お題を入力してください > ")
    sim_config = SimulationConfig(
        trigger_message=trigger,
        max_turns=config.max_turns,
        agent_order=[a.name for a in agents],
    )
    logger = SimulationLogger()
    await run_simulation(sim_config, agents, clients, logger)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nシミュレーションを中断しました。")
