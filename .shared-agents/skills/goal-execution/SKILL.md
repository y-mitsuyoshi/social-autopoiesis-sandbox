---
name: goal-execution
description: Drive the /goal auto-execution loop (PRD→TechSpec→Implement→Review→QA). Use when the user invokes /goal or asks to run the goal loop, or when coordinating multi-phase autonomous development.
---

# goal-execution Skill

Coordinates the autonomous goal-driven development loop used by the `/goal`
command. The loop runs **inside** the agent — no external orchestration script
is required once started.

## Phases
1. **PRD** (prd-manager persona) → `docs/prd/<slug>.md`
2. **Tech Spec** (architect persona) → `docs/spec/<slug>.md`
3. **Architecture Review** (architect-reviewer persona) — gate: no P0
4. **Implementation** (implementer persona) — run self-correction loop
5. **Team Review** (team-reviewer persona) — gate: no P0
6. **QA** (qa-engineer persona) — gate: tests green
7. **Final Report** (tech-lead persona) — merge-ready judgment

## State management
- Use `todowrite` to register all 7 phases at start and update status as you go.
- Persist intermediate artifacts under `docs/` so context survives compaction.
- If a phase fails 3 auto-retries, pause and report to the user.

## Transition rules
- Phase 3 → back to 2 if P0 found.
- Phase 5 → back to 4 if P0 found.
- Phase 6 → back to 4 if tests fail.
- Never auto-deploy or auto-merge to main.

## Templates
- PRD: `.shared-agents/templates/prd.md`
- Tech Spec: `.shared-agents/templates/tech-spec.md`
- Review: `.shared-agents/templates/review.md`
- QA: `.shared-agents/templates/qa-report.md`

## Harness (optional CLI fallback)
If running outside an interactive agent, the loop can be kicked off via:
```
./.shared-agents/harness/goal.sh "<goal>"
```
This launches the first available CLI (opencode → claude → antigravity) with
the `/goal` prompt template.