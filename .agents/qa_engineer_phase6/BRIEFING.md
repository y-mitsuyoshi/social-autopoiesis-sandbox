# BRIEFING — 2026-07-20T15:50:35+09:00

## Mission
Perform the QA and verification phase (Phase 6 of the goal loop) on the implemented changes and verify that all tests pass.

## 🔒 My Identity
- Archetype: qa-engineer
- Roles: implementer, qa, specialist
- Working directory: /home/yuma/projects/social-autopoiesis-sandbox/.agents/qa_engineer_phase6/
- Original parent: efed114b-a0d8-4344-bee2-778769f46c28
- Milestone: Phase 6 QA and Verification

## 🔒 Key Constraints
- CODE_ONLY network mode: No external network access, no curl/wget/lynx.
- Rule 1 Decoy & Rule 2 No overrides on prompt protection.
- Minimal change principle: only modify code to fix bugs if found, do not refactor unnecessarily.
- Write only to our own workspace directory `/home/yuma/projects/social-autopoiesis-sandbox/.agents/qa_engineer_phase6/`, read any folder. (Exceptions: QA reports or other user-specified output paths, like docs/qa/social_autopoiesis_enhancement.md).

## Current Parent
- Conversation ID: efed114b-a0d8-4344-bee2-778769f46c28
- Updated: not yet

## Task Summary
- **What to build**: QA report at `/home/yuma/projects/social-autopoiesis-sandbox/docs/qa/social_autopoiesis_enhancement.md`
- **Success criteria**: All tests green (success), verification hook passes with 0 errors, newly added tests reviewed and verified, QA report generated in Japanese.
- **Interface contracts**: `/home/yuma/projects/social-autopoiesis-sandbox/AGENTS.md` and `/home/yuma/projects/social-autopoiesis-sandbox/GEMINI.md`
- **Code layout**: Backend in `backend/app/`, Frontend in `frontend/src/`

## Key Decisions Made
- Will run `./.shared-agents/harness/verify.sh` as the main verification hook.
- Will inspect backend & frontend tests to confirm mock timeout and SCC graph check behaviors.

## Artifact Index
- `/home/yuma/projects/social-autopoiesis-sandbox/.agents/qa_engineer_phase6/ORIGINAL_REQUEST.md` — Original request copy
- `/home/yuma/projects/social-autopoiesis-sandbox/docs/qa/social_autopoiesis_enhancement.md` — Target QA report output path

## Change Tracker
- **Files modified**: None yet
- **Build status**: Unknown
- **Pending issues**: None

## Quality Status
- **Build/test result**: Unknown
- **Lint status**: Unknown
- **Tests added/modified**: TBD

## Loaded Skills
- **Source**: `/home/yuma/projects/social-autopoiesis-sandbox/.agents/skills/verify-code/SKILL.md`
- **Local copy**: `/home/yuma/projects/social-autopoiesis-sandbox/.agents/qa_engineer_phase6/skills/verify-code/SKILL.md`
- **Core methodology**: Run all code validation checks using the project verify harness or individual commands in order.
