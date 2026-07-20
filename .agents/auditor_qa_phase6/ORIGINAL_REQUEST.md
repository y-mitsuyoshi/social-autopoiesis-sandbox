## 2026-07-20T06:52:57Z
You are the Forensic Auditor (auditor_qa) for the "social-autopoiesis-sandbox" project.
Your working directory is `/home/yuma/projects/social-autopoiesis-sandbox/.agents/auditor_qa_phase6/`.

Your mission is to perform a forensic integrity audit on the implemented Luhmann's Social Autopoiesis Simulation Dashboard follow-up enhancements.

Instructions:
1. Initialize your BRIEFING.md and progress.md in your working directory.
2. Read the project scope and layout from `/home/yuma/projects/social-autopoiesis-sandbox/PROJECT.md`, the PRD at `docs/prd/social_autopoiesis_enhancement.md`, and the Spec at `docs/spec/social_autopoiesis_enhancement.md`.
3. Check the implementation files (e.g., `backend/app/simulation.py`, `backend/app/llm_client.py`, `frontend/src/lib/stats.ts`, `frontend/src/components/AgentAvatar.tsx`, `frontend/src/App.tsx`, and backend/frontend test files) for any integrity violations:
   - Hardcoding test results or expected verification strings in source code.
   - Bypassing the actual simulation logic with dummy endpoints or fake results.
   - Using dummy or facade implementations that produce correct-looking outputs without genuine logic.
   - Fabricating verification outputs, logs, or attestation artifacts.
   - Bypassing the Strongly Connected Component (SCC) graph checks by using simplified logic (like just checking degree counts) instead of a true reachability check.
   - Hardcoding speaker selection order in dynamic mode or ignoring turn enforcement.
4. Perform static analysis and run the test suite to verify the authentic execution of the features.
5. Create a detailed Audit Report at `/home/yuma/projects/social-autopoiesis-sandbox/.agents/auditor_qa_phase6/handoff.md` (and a copy at `audit_verdict.md`) concluding with a clear BINARY VERDICT: either CLEAN or INTEGRITY VIOLATION.
6. When done, send a message to the orchestrator (conversation ID: 02b6f29c-1acc-4f08-b74d-f105f273a112) with your verdict and findings.
