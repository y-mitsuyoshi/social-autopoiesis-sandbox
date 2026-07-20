## 2026-07-20T02:30:14Z

Implement all requested enhancements and write corresponding tests according to the PRD (docs/prd/social_autopoiesis_enhancement.md) and Tech Spec (docs/spec/social_autopoiesis_enhancement.md).

Tasks:
1. Read ORIGINAL_REQUEST.md, PRD, and Tech Spec.
2. Implement backend LLM Timeout & Error Resilience:
   - In `backend/app/schemas.py` and `backend/app/config.py`, add `llm_timeout: float = Field(default=120.0, ge=1.0, le=300.0)`.
   - In `backend/app/llm_client.py`, pass the parsed timeout to OpenAICompatibleClient and GeminiClient.
   - In `backend/app/simulation.py`, catch timeouts and other connection errors (e.g., `httpx.HTTPError`, `LLMError`) for both general agents and moderator meta-agent client calls. Return fallback messages for general agents, and fall back to picking the next candidate index for the moderator.
3. Implement turn scheduler and conversational dialogue:
   - In `backend/app/simulation.py`, update `run_simulation` so each non-meta agent speaks exactly once per cycle (both fixed and dynamic mode). Filter out already-spoken agents in the cycle. Reset when all have spoken, and prevent consecutive speaking of the same agent at cycle boundaries (last speaker cannot speak first in the next cycle if non-meta count > 1).
   - Prefix names/codes in context history and prompt agents to refer to other agents' statements to make conversation flow naturally.
4. Implement frontend:
   - In `AgentAvatar.tsx`, render neon glowing human silhouettes (inline SVGs) and apply pure CSS keyframes with transform: scaleY and will-change: transform animations when speaking (GPU accelerated).
   - In `frontend/src/lib/stats.ts`, compute "operational closure" (all non-meta agents speak >= 1, all active nodes belong to a single Strongly Connected Component SCC check, and positive & negative poles of binary codes are tracked independently and counts >= 1 with space-safe trims).
   - In the dashboard, show prominent "AUTOPOIESIS PROVEN" (green) or "UNPROVEN / OPERATIONAL CLOSURE INCOMPLETE" (warning color) status.
   - Update beginner sociology panels to explain concepts simply and clearly explain the 3 conditions for the proof.
5. Add QA Tests:
   - Backend tests in `backend/tests/`: mock LLM client calls to inject timeouts/exceptions (both for general agent and moderator meta-agent client calls) and assert fallback behaviors. Assert scheduler turn enforcement.
   - Frontend tests: add Vitest tests verifying the SCC connectivity calculation (especially verifying disjoint cycles return false) and binary code activation checks.
6. Verify your implementation by running `./.shared-agents/harness/verify.sh` to ensure ESLint, Vitest, TypeScript, Ruff, mypy, and pytest all pass clean with zero errors.
7. Create a progress.md in your working directory and update it as you work.
8. When done, write handoff.md in your working directory and notify the parent (conversation ID efed114b-a0d8-4344-bee2-778769f46c28) with a message.
