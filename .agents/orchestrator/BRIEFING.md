# BRIEFING — 2026-07-20T11:00:39+09:00

## Mission
Orchestrate the follow-up enhancement of Luhmann's Social Autopoiesis Simulation Dashboard (LLM Resiliency, Autopoiesis Proof Status, Cybernetic Avatars, and scheduler turn enforcement) via the standard 7-phase loop.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /home/yuma/projects/social-autopoiesis-sandbox/.agents/orchestrator
- Original parent: parent
- Original parent conversation ID: efed114b-a0d8-4344-bee2-778769f46c28

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: /home/yuma/projects/social-autopoiesis-sandbox/PROJECT.md
1. **Decompose**: Decompose the project into the standard 7-phase loop (PRD, Spec, Spec Review, Implementation, Team Review, QA, Final Report)
2. **Dispatch & Execute**:
   - **Delegate (sub-orchestrator)**: For large milestones, spawn sub-orchestrators.
   - **Direct (iteration loop)**: Spawn subagents with specific roles/prompts for the current phase.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns. Spawn successor via self. Write handoff.md, cancel crons, spawn successor, exit.
- **Work items**:
  1. Phase 1: PRD (prd-manager) -> `docs/prd/social_autopoiesis_enhancement.md` [completed]
  2. Phase 2: Tech Spec (architect) -> `docs/spec/social_autopoiesis_enhancement.md` [completed]
  3. Phase 3: Architecture Review (architect-reviewer) [completed]
  4. Phase 4: Implementation (implementer) [completed]
  5. Phase 5: Team Review (team-reviewer) [completed]
  6. Phase 6: QA (qa-engineer) [in-progress]
  7. Phase 7: Final Report (tech-lead) [pending]
- **Current phase**: 6
- **Current focus**: Phase 6: QA (qa-engineer)

## 🔒 Key Constraints
- Pure orchestrator: do not write code or run build/test commands directly.
- Hard veto on forensic audit failure.
- Never reuse a subagent after it has delivered its handoff.
- Self-succeed at 16 spawns.

## Current Parent
- Conversation ID: efed114b-a0d8-4344-bee2-778769f46c28
- Updated: not yet

## Key Decisions Made
- [TBD]

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_init | teamwork_preview_explorer | Explore codebase and plan viz | completed | e72afec8-ef27-41dc-b507-ff77d7afa763 |
| worker_tests | teamwork_preview_worker | Create component test suite | completed | b585519d-cfd2-45aa-8f08-1dfb4ee787f7 |
| worker_app_integration | teamwork_preview_worker | Integrate components in App.tsx | completed | c8b7aebe-436f-4181-b1cd-34ac30fcd663 |
| auditor_init | teamwork_preview_auditor | Perform forensic integrity audit | completed | 32806562-8943-46c9-b4b8-553dc1031643 |
| prd_manager | teamwork_preview_worker | Write PRD for enhancements | completed | c617f53b-30f1-4afb-b2e2-61dd76ff42a1 |
| architect | teamwork_preview_worker | Write Tech Spec for enhancements | completed | fcde3db4-64db-45a3-94d4-57a6bd4fc090 |
| architect_reviewer | teamwork_preview_reviewer | Review Tech Spec for enhancements | changes-requested | 22f00da3-b30f-487b-b958-99c295e221ac |
| architect_rev | teamwork_preview_worker | Revise Tech Spec for enhancements | completed | 519a436c-7e62-4b99-a05b-6e003ba14ddc |
| architect_reviewer_gen2 | teamwork_preview_reviewer | Review revised spec | completed | c87274f3-aac0-4ed0-a20a-e3d64ba4bfee |
| implementer | teamwork_preview_worker | Implement enhancements and write tests | completed | 2b295114-eb7f-4589-b4f5-754f18d4bb82 |
| team_reviewer | teamwork_preview_reviewer | Perform team panel review of code | completed | 0bf46060-fb6b-4dcb-95df-2531faef7e80 |
| qa_engineer | teamwork_preview_worker | Verify code quality and run verify.sh | failed | 51676602-2f9c-4a1b-8d0c-6413fa5f9756 |
| qa_engineer_v2 | teamwork_preview_worker | Verify code quality and run verify.sh | completed | e3f098c2-4840-436e-a08b-6b8927ca4561 |
| auditor_qa | teamwork_preview_auditor | Perform forensic integrity audit | completed | 8d9638ed-32c4-472d-91aa-d338799ac86f |

## Succession Status
- Succession required: no
- Spawn count: 14 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: none
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- /home/yuma/projects/social-autopoiesis-sandbox/.agents/orchestrator/ORIGINAL_REQUEST.md — Verbatim user request
