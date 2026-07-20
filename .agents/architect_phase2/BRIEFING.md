# BRIEFING — 2026-07-20T11:04:10+09:00

## Mission
Write the Technical Specification (Tech Spec) for the Luhmann's Social Autopoiesis Simulation Dashboard follow-up enhancements.

## 🔒 My Identity
- Archetype: Architect
- Roles: implementer, qa, specialist
- Working directory: /home/yuma/projects/social-autopoiesis-sandbox/.agents/architect_phase2/
- Original parent: efed114b-a0d8-4344-bee2-778769f46c28
- Milestone: Tech Spec

## 🔒 Key Constraints
- Code-only network restrictions (no external HTTP calls).
- Output Tech Spec in Japanese according to the template.
- Adhere strictly to the Tech Spec template at `.shared-agents/templates/tech-spec.md`.

## Current Parent
- Conversation ID: efed114b-a0d8-4344-bee2-778769f46c28
- Updated: 2026-07-20T11:04:10+09:00

## Task Summary
- **What to build**: Tech Spec for Luhmann's Social Autopoiesis Simulation Dashboard follow-up enhancements.
- **Success criteria**: Complete and detailed spec at `docs/spec/social_autopoiesis_enhancement.md` following the template, in Japanese.
- **Interface contracts**: `/home/yuma/projects/social-autopoiesis-sandbox/docs/prd/social_autopoiesis_enhancement.md` (PRD)

## Key Decisions Made
- Added `llm_timeout` to `AppConfig` and passed to `httpx.AsyncClient` inside `OpenAICompatibleClient` and `GeminiClient`.
- Implemented turn-level `LLMError` handling in `run_simulation` to log a warning and emit a system-interrupted fallback message without stopping.
- Defined real-time "Operational Closure" conditions: all non-meta nodes speaking count >= 1, subgraph strong cycle connectivity, and positive/negative binary code term activation in historical posts.
- Redesigned `AgentAvatar.tsx` to use SVG filter neon-glow styling with head/shoulders vector profile and GPU-accelerated equalizer scaleY audio wave motion.
- Structured simulation history with `[Agent Name]: [Message]` headers and introduced a turn-enforcing candidates array filter inside the moderator's next-speaker selection loop.

## Artifact Index
- `docs/spec/social_autopoiesis_enhancement.md` — Technical Specification

## Loaded Skills
- goal-execution — `/home/yuma/projects/social-autopoiesis-sandbox/.agents/skills/goal-execution/SKILL.md` (Coordinates goal-driven development loop)
- verify-code — `/home/yuma/projects/social-autopoiesis-sandbox/.agents/skills/verify-code/SKILL.md` (Runs test validation commands)
