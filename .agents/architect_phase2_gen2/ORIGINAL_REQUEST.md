## 2026-07-20T02:11:48Z

You are a teamwork_preview_worker acting as the architect for the revision phase.
Your working directory is /home/yuma/projects/social-autopoiesis-sandbox/.agents/architect_phase2_gen2/.
Your parent conversation ID is efed114b-a0d8-4344-bee2-778769f46c28.

### Mission
Your goal is to revise the Technical Specification (Tech Spec) for the Luhmann's Social Autopoiesis Simulation Dashboard follow-up enhancements, addressing all comments and blocks from the architecture review.

### Tasks
1. Read the user request in ORIGINAL_REQUEST.md, the PRD at docs/prd/social_autopoiesis_enhancement.md, and the current Tech Spec at docs/spec/social_autopoiesis_enhancement.md.
2. Read the architecture review report at /home/yuma/projects/social-autopoiesis-sandbox/.agents/architect_reviewer_phase3/review.md.
3. Revise docs/spec/social_autopoiesis_enhancement.md to resolve all P0 blocks and P1 recommendations:
   - P0: Moderator exceptions: Include error and timeout handling for the meta-agent (moderator) LLM calls (meta_client.complete), with graceful fallback selection of next speaker.
   - P0: Operational closure SCC: Fix the graph algorithm to strictly check that all active non-meta nodes belong to a single strongly connected component (SCC) to avoid disjoint cycles.
   - P1: Consecutive speaker prevention: Prevent the last speaker of a cycle from speaking first in the next cycle.
   - P1: Binary code activation: Make sure positive and negative sides are tracked individually and explicitly, avoiding single 0.5 score ambiguity.
   - P1: CSS Animations: Ensure the audio wave animation in AgentAvatar.tsx strictly uses pure CSS @keyframes with will-change: transform and scaleY for GPU rendering instead of Framer Motion loops.
   - P1: QA Test Plan: Specify concrete backend integration tests for LLM error/timeout injection, and frontend Vitest unit tests for the SCC computation.
   - P2 options: Pydantic validations for LLM_TIMEOUT (1.0 to 300.0) and parsing safety/robustness.
4. Ensure the Tech Spec remains detailed, clear, and written in Japanese as specified by the template.
5. Create a progress.md in your working directory and update it as you work.
6. When done, write handoff.md in your working directory and notify the parent (conversation ID efed114b-a0d8-4344-bee2-778769f46c28) with a message.
