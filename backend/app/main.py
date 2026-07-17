import asyncio
import sys

from app.agents import load_agents
from app.config import load_config
from app.llm_client import LLMError, build_agent_clients, close_all_clients
from app.logger import SimulationLogger
from app.schemas import SimulationConfig
from app.simulation import run_simulation, validate_agent_credentials


async def main() -> None:
    try:
        config = load_config()
    except ValueError as exc:
        print(f"設定エラー: {exc}", file=sys.stderr)
        return
    agents, resolved_path = load_agents(config.agents_config, config)
    try:
        validate_agent_credentials(agents, config)
    except ValueError as exc:
        print(f"エージェント資格エラー: {exc}", file=sys.stderr)
        return
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
    try:
        await run_simulation(sim_config, agents, clients, logger)
    except LLMError as exc:
        print(f"LLM呼出失敗: {exc.message}", file=sys.stderr)
    finally:
        await close_all_clients(clients)
        await logger.aclose()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nシミュレーションを中断しました。")
