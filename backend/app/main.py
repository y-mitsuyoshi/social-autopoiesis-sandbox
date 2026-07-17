import asyncio
import signal
import sys
from itertools import count

from app.agents import AGENTS
from app.config import load_config
from app.llm_client import LLMClient, LLMError, build_llm_client
from app.logger import SimulationLogger
from app.schemas import AgentSpec, Message, SimulationConfig


async def run_simulation(
    config: SimulationConfig,
    agents: list[AgentSpec],
    client: LLMClient,
    logger: SimulationLogger,
) -> None:
    agent_map = {a.name: a for a in agents}
    for name in config.agent_order:
        if name not in agent_map:
            raise ValueError(f"agent_order references unknown agent: {name}")

    order = [agent_map[name] for name in config.agent_order]
    prev_message: str = config.trigger_message
    try:
        for turn in count():
            if config.max_turns and turn >= config.max_turns:
                break
            agent = order[turn % len(order)]
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
        await client.aclose()
        await logger.aclose()


def _cancel_main_task() -> None:
    task = asyncio.current_task()
    if task is not None:
        task.cancel()


def _install_sigint_handler() -> None:
    loop = asyncio.get_running_loop()
    try:
        loop.add_signal_handler(
            signal.SIGINT,
            _cancel_main_task,
        )
    except NotImplementedError:
        pass


async def main() -> None:
    config = load_config()
    client = build_llm_client(config)
    agent_names = [a.name for a in AGENTS]
    model_name = {
        "ollama": config.ollama_model,
        "gemini": config.gemini_model,
        "openai": config.openai_model,
    }[config.llm_provider]
    if model_name is None:
        raise ValueError(f"model is not configured for provider: {config.llm_provider}")
    print("=== ルーマン・オートポイエーシス・シミュレーション ===")
    print(f"プロバイダ: {config.llm_provider}")
    print(f"モデル: {model_name}")
    print(f"エージェント: {', '.join(agent_names)}")
    print(f"最大ターン: {'無限' if config.max_turns == 0 else config.max_turns}")

    trigger = await asyncio.to_thread(input, "お題を入力してください > ")
    sim_config = SimulationConfig(
        trigger_message=trigger,
        max_turns=config.max_turns,
        agent_order=agent_names,
        provider=config.llm_provider,
        model=model_name,
    )
    logger = SimulationLogger(provider=config.llm_provider, model=model_name)
    _install_sigint_handler()
    try:
        await run_simulation(sim_config, AGENTS, client, logger)
    except asyncio.CancelledError:
        await client.aclose()
        await logger.aclose()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nシミュレーションを中断しました。")
