import argparse
import asyncio
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.agents import load_agents
from app.llm_client import build_agent_clients, close_all_clients
from app.logger import SimulationLogger
from app.schemas import AgentSpec, AppConfig, Message, SimulationConfig
from app.simulation import run_simulation, validate_agent_credentials


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="複数モデルで同一お題を比較実行")
    p.add_argument("--models", nargs="+", required=True, help="比較対象モデル名のリスト")
    p.add_argument("--trigger", required=True, help="お題メッセージ")
    p.add_argument("--max-turns", type=int, default=3, help="最大ターン数")
    p.add_argument("--agents-config", default=None, help="エージェント構成YAML")
    p.add_argument(
        "--provider",
        default="ollama",
        help="LLMプロバイダ (ollama/openai/gemini)",
    )
    p.add_argument("--api-key", default=None, help="APIキー")
    p.add_argument("--base-url", default=None, help="ベースURL")
    p.add_argument(
        "--output",
        default="docs/experiments/model-comparison.md",
        help="出力Markdownファイルパス",
    )
    return p.parse_args()


def _build_app_config(
    provider: str, model: str, api_key: str | None, base_url: str | None
) -> AppConfig:
    key = api_key or "dummy-key"
    if provider == "ollama":
        return AppConfig(
            llm_provider="ollama",
            max_turns=1,
            agents_config=None,
            ollama_api_key=key,
            ollama_base_url=base_url or "https://example.com/v1",
            ollama_model=model,
        )
    if provider == "openai":
        return AppConfig(
            llm_provider="openai",
            max_turns=1,
            agents_config=None,
            openai_api_key=key,
            openai_base_url=base_url or "https://api.openai.com/v1",
            openai_model=model,
        )
    if provider == "gemini":
        return AppConfig(
            llm_provider="gemini",
            max_turns=1,
            agents_config=None,
            gemini_api_key=key,
            gemini_base_url=base_url or "https://generativelanguage.googleapis.com",
            gemini_model=model,
        )
    raise ValueError(f"unsupported provider: {provider}")


@dataclass(frozen=True)
class ModelStats:
    model: str
    turns: int
    avg_message_length: float
    avg_turn_seconds: float
    type_token_ratio: float


def _compute_ttr(messages: list[Message]) -> float:
    tokens: list[str] = []
    for m in messages:
        tokens.extend(m.message.split())
    if not tokens:
        return 0.0
    return len(set(tokens)) / len(tokens)


async def _run_one(
    provider: str,
    model: str,
    agents_config: str | None,
    trigger: str,
    max_turns: int,
    api_key: str | None,
    base_url: str | None,
) -> tuple[list[Message], float]:
    config = _build_app_config(provider, model, api_key, base_url)
    agents, _ = load_agents(agents_config, config)
    agents = [_override_model(a, model) for a in agents]
    validate_agent_credentials(agents, config)
    clients = build_agent_clients(agents, config)
    sim_config = SimulationConfig(
        trigger_message=trigger,
        max_turns=max_turns,
        agent_order=[a.name for a in agents],
    )
    logger = SimulationLogger()
    start = time.perf_counter()
    messages: list[Message] = []
    try:
        original_log = logger.log

        async def _capture(msg: Message) -> None:
            messages.append(msg)
            await original_log(msg)

        logger.log = _capture  # type: ignore[method-assign]
        await run_simulation(sim_config, agents, clients, logger)
    finally:
        elapsed = time.perf_counter() - start
        await close_all_clients(clients)
        await logger.aclose()
    return messages, elapsed


def _override_model(agent: AgentSpec, model: str) -> AgentSpec:
    return agent.model_copy(update={"model": model})


def _render_markdown(stats: list[ModelStats], trigger: str, max_turns: int) -> str:
    lines: list[str] = [
        "# モデル比較実験レポート",
        "",
        f"- お題: {trigger}",
        f"- 最大ターン: {max_turns}",
        "",
        "## 比較表",
        "",
        "| モデル | ターン数 | 平均発言長 | 平均ターン時間(s) | TTR (type-token ratio) |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for s in stats:
        lines.append(
            f"| {s.model} | {s.turns} | {s.avg_message_length:.1f} "
            f"| {s.avg_turn_seconds:.3f} | {s.type_token_ratio:.3f} |"
        )
    lines.extend(["", "## 考察", "", "(実行結果を元に記述)", ""])
    return "\n".join(lines)


async def _async_main() -> int:
    args = _parse_args()
    provider: Literal["ollama", "gemini", "openai"] = args.provider
    stats: list[ModelStats] = []
    for model in args.models:
        messages, elapsed = await _run_one(
            provider=provider,
            model=model,
            agents_config=args.agents_config,
            trigger=args.trigger,
            max_turns=args.max_turns,
            api_key=args.api_key,
            base_url=args.base_url,
        )
        turns = len(messages)
        avg_len = sum(len(m.message) for m in messages) / turns if turns > 0 else 0.0
        avg_turn_sec = elapsed / turns if turns > 0 else 0.0
        ttr = _compute_ttr(messages)
        stats.append(
            ModelStats(
                model=model,
                turns=turns,
                avg_message_length=avg_len,
                avg_turn_seconds=avg_turn_sec,
                type_token_ratio=ttr,
            )
        )
    md = _render_markdown(stats, args.trigger, args.max_turns)
    out_path = Path(args.output)
    await asyncio.to_thread(lambda: _write_file(out_path, md))
    print(f"wrote: {out_path}")
    return 0


def _write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> int:
    return asyncio.run(_async_main())


if __name__ == "__main__":
    raise SystemExit(main())
