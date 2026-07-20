# Handoff Report: Technical Specification for Social Autopoiesis Sandbox Enhancements

## 1. Observation
- **User request / Mission**: Act as the architect and write the Technical Specification (Tech Spec) for the Luhmann's Social Autopoiesis Simulation Dashboard follow-up enhancements.
- **Templates**: Read the Tech Spec template at `.shared-agents/templates/tech-spec.md` which contains:
  ```markdown
  # Tech Spec: {{TITLE}}
  ## コンテキスト
  {{CONTEXT}}
  ...
  ```
- **PRD**: Read the PRD at `docs/prd/social_autopoiesis_enhancement.md` specifying four functional requirements:
  - FR-1.1/1.2/1.3: `LLM_TIMEOUT` config (default `120.0`) applied to `httpx.AsyncClient` inside `llm_client.py` and fallback logic in `simulation.py` to prevent simulation crash.
  - FR-2.1/2.2/2.3: Real-time "operational closure" calculation logic (all non-meta agents speak once, cyclic graph connectivity, binary code activation) and visual status display.
  - FR-3.1/3.2: Cybernetic avatars in `AgentAvatar.tsx` (neon glowing head/shoulders outline SVG and audio wave animations when speaking).
  - FR-4.1/4.2: Turn enforcement scheduler (all non-meta agents speak once per cycle, candidate filtering in dynamic mode) and conversation prompt optimization.
- **Current codebase files viewed**:
  - `backend/app/config.py`: Line 82 `def load_config() -> AppConfig:` loading configuration from environment.
  - `backend/app/schemas.py`: Line 79 `class AppConfig(BaseModel):` specifying configuration fields.
  - `backend/app/llm_client.py`: Lines 71, 143 `timeout=60.0` specifies the hardcoded timeout.
  - `backend/app/simulation.py`: Line 97 `async def run_simulation(...)` runs the simulation loop.
  - `frontend/src/lib/avatar.ts`: Line 54 `export function generateAvatar(...)` draws current geometric avatars.
  - `frontend/src/components/AgentAvatar.tsx`: Line 11 `function AgentAvatarBase(...)` renders agent avatar and speaks animations.
  - `frontend/src/components/EducationalPanel.tsx`: Line 29 `export function EducationalPanel(...)` displays introductory material.
- **Verification Command run**: `./.shared-agents/harness/verify.sh` succeeded with `フロントエンドチェック成功!` and 78 passed Vitest tests.

## 2. Logic Chain
- **Timeout and Resilience**:
  - Based on finding hardcoded `timeout=60.0` in `llm_client.py`, adding `llm_timeout: float` to `AppConfig` and loading it from `os.environ.get("LLM_TIMEOUT")` allows configuration dynamic configuration.
  - Wrapping `client.complete()` calls in `simulation.py` with `try...except` enables intercepting `LLMError` or timeout exceptions before they reach `main.py` and crash the loop. We can then emit a predefined fallback message via `logger.log()` to continue.
- **Operational Closure Calculation**:
  - Observing that `edges` are constructed as directed sequences (`A -> B`), checking graph connectivity on the non-meta subgraph using a cycle detection/reachability algorithm satisfies the "self-referential loop" requirement.
  - Using the split binary code terms (positive and negative) and counting occurrences across all agent messages in `messages` determines binary code activation.
  - Displaying this status on the UI allows the user to see proof status in real-time.
- **Cybernetic Avatars**:
  - The geometric shape rendering inside `avatar.ts` can be replaced with a path representation of a human head and shoulders silhouette. Applying a glowing `<filter>` and incorporating the concern glyph inside the silhouette achieves the "Ghost in the Shell" styling.
  - Animating vertical indicator bars using `framer-motion`'s `scaleY` transform avoids recalculating layout, ensuring 60fps rendering performance.
- **Scheduler Enforcement**:
  - Maintaining a `spoken_in_cycle` set of non-meta agents and filtering them out of the `candidates` parameter in `dynamic` mode ensures that no agent speaks twice before everyone else speaks once.

## 3. Caveats
- No caveats. The design details exactly how each requirement should be implemented while preserving compatibility and performance.

## 4. Conclusion
- The Technical Specification file has been successfully written to `docs/spec/social_autopoiesis_enhancement.md` according to the template in Japanese.
- It details the architecture decisions, state management, algorithm design for operational closure, SVG structure for cybernetic avatars, and turn enforcement scheduler.

## 5. Verification Method
- **Inspect Files**: Confirm the existence and contents of `docs/spec/social_autopoiesis_enhancement.md`.
- **Run Verification Suite**: Execute `./.shared-agents/harness/verify.sh` to ensure no existing tests, format rules, or static typing is broken.
