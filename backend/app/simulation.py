import asyncio
import re

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
        elif agent.provider == "opencode":
            if config.opencode_api_key is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=opencode を指定していますが、"
                    f"OPENCODE_API_KEY が未設定です"
                )
            if config.opencode_base_url is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=opencode を指定していますが、"
                    f"OPENCODE_BASE_URL が未設定です"
                )
        elif agent.provider == "opencode-go":
            effective_key = config.opencode_go_api_key or config.opencode_api_key
            if effective_key is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=opencode-go を指定していますが、"
                    f"OPENCODE_GO_API_KEY も OPENCODE_API_KEY も未設定です"
                )
            if config.opencode_go_base_url is None:
                raise ValueError(
                    f"エージェント『{agent.name}』が provider=opencode-go を指定していますが、"
                    f"OPENCODE_GO_BASE_URL が未設定です"
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


def _build_user_content(trigger: str, history: list[str | tuple[str, str, str]]) -> str:
    if not history:
        return f"お題: {trigger}\n直前の発言: {trigger}"

    formatted_history = []
    for item in history:
        if isinstance(item, tuple):
            name, code, msg = item
            formatted_history.append(f"[{name} ({code})]: {msg}")
        else:
            formatted_history.append(item)

    if len(formatted_history) == 1:
        return f"お題: {trigger}\n直前の発言: {formatted_history[0]}"
    history_block = "\n".join(formatted_history)
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

    history: list[str | tuple[str, str, str]] = []
    spoken_in_cycle: set[str] = set()
    last_speaker: str | None = None

    try:
        turn = 0
        while True:
            if config.max_turns and turn >= config.max_turns:
                break

            if config.agent_order_mode == "dynamic" and meta_agent is not None:
                # Reset cycle when all non-meta agents have spoken
                if len(spoken_in_cycle) >= len(order):
                    spoken_in_cycle.clear()

                candidates = [a for a in order if a.name not in spoken_in_cycle]

                # Prevent consecutive speaking at cycle boundaries
                if len(order) > 1 and last_speaker is not None and not spoken_in_cycle:
                    candidates = [a for a in candidates if a.name != last_speaker]

                candidate_names = [a.name for a in candidates]
                meta_client = clients[meta_agent.name]
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

                fallback_index = (turn + 1) % len(order)
                try:
                    meta_resp = await meta_client.complete(meta_messages)
                    next_name = _select_next_agent_by_meta(
                        meta_resp.content, candidate_names, fallback_index
                    )
                except Exception as exc:
                    print(f"[Fallback Warning] 通信障害によるフォールバック話者選択: {exc}")
                    # Deterministically fall back to the next candidate index
                    next_name = candidate_names[fallback_index % len(candidate_names)]

                agent = agent_map[next_name]
            else:
                agent = order[turn % len(order)]

            client = clients[agent.name]
            guideline = (
                "\n\n【重要な対話スタイル指示】:\n"
                "1. マークダウンの見出し（`### 1. 前提`など）、箇条書きの表、"
                "論文風の目次形式で出力することを【絶対禁止】とします。\n"
                "2. 実際に人間同士が会議や議論の場で会話しているような、"
                "自然な話し言葉（口語）で発言してください。\n"
                "3. 直前の発言者の意見をふまえ、「〜とおっしゃいますが」"
                "「確かに〜の視点は理解できますが」「〜という見解ですね」などと"
                "会話的に反応してください。\n"
                "4. 自分の役割・関心事・二元コードの視点をしっかり保ちつつ、"
                "情熱的かつ人間味のある対話を行ってください。"
            )
            messages = [
                {"role": "system", "content": agent.system_prompt + guideline},
                {
                    "role": "user",
                    "content": _build_user_content(config.trigger_message, history),
                },
            ]

            try:
                resp = await client.complete(messages)
                resp_content = resp.content
                provider = resp.provider
                model = resp.model
            except Exception as exc:
                print(f"[Fallback Warning] 通信障害によるフォールバック発言の生成: {exc}")
                resp_content = (
                    "「（環境からのノイズにより一時的に通信が途絶しています。"
                    "システムは作動的閉鎖を維持しています）」"
                )
                provider = "fallback"
                model = "fallback"

            msg = Message(
                turn=turn,
                agent_name=agent.name,
                agent_code=agent.binary_code,
                message=resp_content,
                provider=provider,
                model=model,
            )
            await logger.log(msg)
            history.append((agent.name, agent.binary_code, resp_content))
            while len(history) > config.history_length:
                history.pop(0)

            if config.agent_order_mode == "dynamic" and meta_agent is not None:
                spoken_in_cycle.add(agent.name)

            last_speaker = agent.name
            turn += 1
            await asyncio.sleep(0)
    except asyncio.CancelledError:
        print("\nシミュレーションを中断します。")
        raise
