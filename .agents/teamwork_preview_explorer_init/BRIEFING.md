# BRIEFING — 2026-07-19T10:53:18+09:00

## Mission
Explore the Luhmann social autopoiesis simulation codebase and prepare a detailed handoff report with implementation plans.

## 🔒 My Identity
- Archetype: explorer
- Roles: codebase explorer, analyst, plan formulator
- Working directory: /home/yuma/projects/social-autopoiesis-sandbox/.agents/teamwork_preview_explorer_init
- Original parent: d98fbc9f-e7e2-4e4e-990e-cfac3ea5e879
- Milestone: initial exploration and design recommendation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Explore backend schemas and simulation loop in backend/app/
- Explore frontend components (App.tsx, NetworkGraph.tsx, types.ts, api/client.ts, etc.)
- Formulate plan for specific UI visualizations (operational closure, binary code state, environmental irritation, communication path, educational panel)
- Identify files to modify/create
- Detail build/verification commands

## Current Parent
- Conversation ID: d98fbc9f-e7e2-4e4e-990e-cfac3ea5e879
- Updated: 2026-07-19T10:53:18+09:00

## Investigation State
- **Explored paths**: `backend/app/schemas.py`, `backend/app/simulation.py`, `backend/app/server.py`, `backend/app/agents.py`, `frontend/src/App.tsx`, `frontend/src/components/NetworkGraph.tsx`, `frontend/src/types.ts`, `frontend/src/api/client.ts`, `frontend/src/components/StatsPanel.tsx`, `frontend/src/components/SocietyPanel.tsx`, `frontend/src/components/TimelineList.tsx`, `frontend/src/components/MessageBubble.tsx`.
- **Key findings**:
  - Backend represents nodes as agents with a binary code (e.g. "真/偽"), uses LLMs to generate messages, and streams turns via SSE / WebSockets with the `agent_code` matching the binary code.
  - Frontend renders the network using SVGs where nodes are placed in a circle and connected by cumulative transition lines. The current speaker is highlighted with an animated dashed circle and corner frames.
  - Formulated visual recommendations for operational closure (pulsing halo boundaries), binary code activation (substring-resolving keyword gauge), environmental irritation (concentric expanding SVG ripples), autopoietic path (directional animated dash/flow path of last 3-5 turns), and a Luhmann theory Educational Panel.
- **Unexplored areas**: None.

## Key Decisions Made
- Visualizations should be implemented purely in frontend components without changing backend schemas to minimize risk.
- Keyword balance score algorithm should account for substring overlaps.

## Artifact Index
- /home/yuma/projects/social-autopoiesis-sandbox/.agents/teamwork_preview_explorer_init/handoff.md — Exploration findings and implementation plan
