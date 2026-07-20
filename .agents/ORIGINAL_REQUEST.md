# Original User Request

## Initial Request — 2026-07-19T01:51:58Z

Implement an interactive graphical visualization of Luhmann's social autopoiesis (system nodes, operational boundaries, binary code activation, and environment waves) and add an educational panel explaining the concepts simply to laypersons.

Working directory: /home/yuma/projects/social-autopoiesis-sandbox
Integrity mode: development

## Requirements

### R1. Graphical Autopoiesis Dashboard
Implement or expand the existing frontend visualization component to represent Luhmann's social systems. It must visually show:
- Operational closure: visual boundaries or halos around system nodes.
- Binary code activation: dynamic meters/balances showing which side of the code (e.g., paid vs unpaid, true vs false, legal vs illegal) is currently activated during communication.
- Environmental irritation: ripples or animation effects propagating from the speaking node to other nodes through the shared space.
- The path of the autopoietic communication chain.

### R2. Introductory & Explanatory Panel
Add a side panel or modal in the UI explaining Niklas Luhmann's theory of social autopoiesis simply for people who don't know it. The explanation must describe:
- What autopoiesis is in sociology.
- How the simulation demonstrates "self-reproducing communications".
- How the systems are operationally closed but structurally coupled.

### R3. Quality Assurance and Validation
Verify all code edits. Run complete verification via `./.shared-agents/harness/verify.sh` to ensure ESLint, Vitest, TypeScript type checks, mypy, and pytest all pass clean with zero errors.

## Acceptance Criteria

### Visualization Aesthetics & Functionality
- [ ] Network graph correctly layout nodes and dynamically update states during the simulation.
- [ ] Visual indicators (like a balance meter or gauge) display the binary code state of the active agent.
- [ ] Animations show the propagation of messages between nodes and how boundaries are affected.

### Documentation & Usability
- [ ] A user-friendly explanation of Luhmann's social systems is prominently featured in the UI.

### Quality and Reliability
- [ ] `./.shared-agents/harness/verify.sh` runs successfully and reports no errors.

## Follow-up — 2026-07-20T11:00:24Z

Enhance Luhmann's Social Autopoiesis Simulation Dashboard by resolving LLM timeouts, showing a clear autopoiesis proof status, adding human-like conversation styling with avatar visualizer components (like Ghost in the Shell), and ensuring structured and fair turns for all speakers.

Working directory: /home/yuma/projects/social-autopoiesis-sandbox
Integrity mode: development

## Requirements

### R1. LLM Timeout & Error Resilience
- Load a configurable HTTP timeout from environment variables (e.g. `LLM_TIMEOUT`, default to `120.0` seconds) for `httpx.AsyncClient` calls.
- Implement a graceful fallback mechanism in `llm_client.py` and `simulation.py` so that if an agent LLM request times out or throws an error after all retries, the simulation recovers with a fallback response/message and continues without crashing.

### R2. Autopoiesis Proof Status & Beginner-Friendly Sociology Panels
- Programmatically calculate whether "operational closure" is achieved in the simulation (e.g. all non-meta agent systems speak at least once, forming self-referential graph connections, and binary code balance is maintained).
- Display a visually prominent "Autopoiesis Proof Status" indicator on the dashboard (e.g. "AUTOPOIESIS PROVEN" or "UNPROVEN / OPERATIONAL CLOSURE INCOMPLETE") accompanied by a clear, simple educational explanation of Niklas Luhmann's theory of autopoiesis for beginners.

### R3. Ghost-in-the-Shell Style Cybernetic Avatars
- Replace the geometric symbols in `AgentAvatar.tsx` and the dashboard with neon-glowing human silhouettes/vector profiles.
- When an agent is in the `"speaking"` state, render animated wave/frequency lines or voice indicator effects around the avatar to simulate futuristic comms.

### R4. Human-like Dialogue & Backend Scheduler Turn Enforcement
- Modify the backend simulation scheduler (`run_simulation` in `backend/app/simulation.py`) to guarantee that in every simulation cycle (fixed or dynamic), each non-meta agent speaks exactly once (or must speak at least once before another speaks again), ensuring fair representation.
- Refine system prompts or conversation context formatting so that the dialogue feels conversational, natural, structured, and sounds like real human speakers interacting.

## Acceptance Criteria

### R1 Verification
- Backend configurations parse `LLM_TIMEOUT` (default `120.0`) and use it for both OpenAICompatibleClient and GeminiClient.
- Simulating a client timeout returns a valid fallback message in the system rather than raising `LLMError` and failing the simulation.

### R2 Verification
- The frontend displays an Autopoiesis Proof Status indicator showing "PROVEN" once all non-meta systems have contributed, and explains this simply on the UI.
- An educational summary/panel is readable and explains Luhmann's concepts (operational closure, binary code, self-reference) in layman's terms.

### R3 Verification
- `AgentAvatar.tsx` renders vector human silhouettes with glowing cyberpunk neon accents.
- Speaking avatars show animated wave/frequency animations.

### R4 Verification
- The simulation speaker order in any mode ensures that all non-meta systems speak at least once during a cycle of turns.
- Conversation messages generated sound conversational, referencing previous statements naturally.
