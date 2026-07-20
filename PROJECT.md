# Project: Luhmann's Social Autopoiesis Simulation Dashboard

## Architecture
This project is a multi-agent social simulation environment representing Niklas Luhmann's theory of social autopoiesis.
- **Backend (Python)**: fastapi + uvicorn. Simulates systems (Economy, Science, Law) responding to communications.
- **Frontend (React)**: React 19 + TypeScript + Vite + Tailwind CSS. Renders a network graph of the systems and handles live streaming via WebSocket or SSE.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Test Suite Design | Establish test cases for Dashboard visual cues and Educational panel under a testing track. | None | DONE |
| 2 | Graphical Autopoiesis Dashboard | R1: Implement operational closure (boundary halos), environmental irritation ripples, and communication paths in the network graph. | M1 | DONE |
| 3 | Explanatory Panel & Balance Gauge | R2: Add Educational Panel; R1: Add Binary Code Balance Gauge component. | M2 | DONE |
| 4 | QA, Hardening & Final Verification | R3: Validate all requirements with 100% test passing, run Forensic Audit. | M3 | DONE |

## Interface Contracts
### Frontend State Contracts
- `AgentNode` interface: Extended in `frontend/src/types.ts` to support optional boundary representation, code active states.
- `Message` interface: Transmitted from backend `Message` schema, contains `agent_code` and `message`.

## Code Layout
- `backend/app/`: FastAPI application code
- `frontend/src/components/`: React component files
- `frontend/src/types.ts`: TypeScript models
- `frontend/src/__tests__/`: React Vitest test suites
