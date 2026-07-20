## 2026-07-20T06:51:25Z
You are the QA Engineer (qa_engineer_v2) for the "social-autopoiesis-sandbox" project.
Your working directory is `/home/yuma/projects/social-autopoiesis-sandbox/.agents/qa_engineer_v2/`.

Your mission is to perform Phase 6 (QA & Verification) of the Luhmann's Social Autopoiesis Simulation Dashboard follow-up enhancements.

Instructions:
1. Initialize your BRIEFING.md and progress.md in your working directory.
2. Read the project scope and layout from `/home/yuma/projects/social-autopoiesis-sandbox/PROJECT.md`, the PRD at `docs/prd/social_autopoiesis_enhancement.md`, and the Tech Spec at `docs/spec/social_autopoiesis_enhancement.md`.
3. Load and follow the `verify-code` skill instructions at `/home/yuma/projects/social-autopoiesis-sandbox/.agents/skills/verify-code/SKILL.md`.
4. Run the project verification suite using `./.shared-agents/harness/verify.sh`.
5. Check if all unit and integration tests pass, and manually/programmatically review the implementation of:
   - R1: LLM Timeout & Error Resilience (parses `LLM_TIMEOUT`, applies HTTP timeout, fallbacks to a noise message inside client and simulation loops for both regular and meta agents).
   - R2: Operational closure calculation (SCC graph cycle check, binary code activation positive/negative pole tracking) and rendering of the "Autopoiesis Proof Status" panel.
   - R3: Ghost-in-the-Shell avatars (vector human profile silhouettes, glowing accents, GPU-accelerated CSS soundwave animations when speaking).
   - R4: Turn enforcement scheduler (each non-meta agent speaks exactly once per cycle in both fixed and dynamic modes, and prompts support natural conversation).
6. If any static checking, linting, type-checking, or tests fail, analyze the errors and modify the code to fix them (following async/concurrency safety and type-safe rules).
7. Create a comprehensive QA Report in Japanese at `docs/qa/social_autopoiesis_enhancement.md`.
8. Write a handoff report at `/home/yuma/projects/social-autopoiesis-sandbox/.agents/qa_engineer_v2/handoff.md` summarizing the verified checklist, build/test results, and verification commands.
9. When done, send a message to your parent orchestrator (conversation ID: 02b6f29c-1acc-4f08-b74d-f105f273a112) using `send_message`.

Mandatory rules:
- Run all checks via the verification script before declaring success.
- Do not make unnecessary code modifications; follow the minimal change principle.
- Use async-safe design (concurrency locks for shared state, no blocking I/O inside async functions).
- Do not access the external network.
- Do not reuse a subagent after delivering its handoff.
