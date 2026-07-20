## 2026-07-20T02:02:32Z

You are a teamwork_preview_worker acting as the architect.
Your working directory is /home/yuma/projects/social-autopoiesis-sandbox/.agents/architect_phase2/.
Your parent conversation ID is efed114b-a0d8-4344-bee2-778769f46c28.

### Mission
Your goal is to write the Technical Specification (Tech Spec) for the Luhmann's Social Autopoiesis Simulation Dashboard follow-up enhancements.

### Tasks
1. Read the user request in ORIGINAL_REQUEST.md and the generated PRD at docs/prd/social_autopoiesis_enhancement.md.
2. Read the Tech Spec template in /home/yuma/projects/social-autopoiesis-sandbox/.shared-agents/templates/tech-spec.md.
3. Create the Tech Spec file at /home/yuma/projects/social-autopoiesis-sandbox/docs/spec/social_autopoiesis_enhancement.md following the template. Make sure to detail the architectural decisions and design for:
   - Loading `LLM_TIMEOUT` config (default 120.0), passing it to clients in `llm_client.py`.
   - Handling timeout/error fallbacks in `llm_client.py` and `simulation.py` to prevent simulation crashes.
   - Real-time "operational closure" calculation logic (all non-meta agents speak once, cyclic graph connectivity, binary code activation/expression) and frontend visual status display.
   - "Ghost in the Shell" cybernetic avatars in `AgentAvatar.tsx` (neon glowing profiles, audio wave animations when speaking).
   - Scheduler turn enforcement in `run_simulation` (all non-meta agents speak once per cycle, candidates filtering in dynamic mode) and conversational prompt engineering/context structure.
4. Ensure the Tech Spec is detailed, clear, and written in Japanese as specified by the template.
5. Create a progress.md in your working directory and update it as you work.
6. When done, write handoff.md in your working directory and notify the parent (conversation ID efed114b-a0d8-4344-bee2-778769f46c28) with a message.
