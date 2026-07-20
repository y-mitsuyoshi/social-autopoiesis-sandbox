## 2026-07-19T10:53:57Z
Create a comprehensive component and unit test suite for the new Luhmann's Social Autopoiesis visualization features.
Write this test suite to `frontend/src/__tests__/AutopoiesisVisuals.test.tsx`.

The test suite must cover:
1. **BinaryCodeGauge**:
   - Render the gauge component with positive and negative poles (e.g., "支払" and "非支払").
   - Test the keyword analysis/scoring logic with different text messages (e.g. positive keyword only, negative keyword only, both keywords, substring conflict handling like "非支払" containing "支払", and empty/neutral text defaulting to 0.5).
   - Ensure the gauge needle/indicator dynamically positions itself according to the score.
2. **EducationalPanel**:
   - Render the side/modal educational panel explaining Niklas Luhmann's theory.
   - Test tab switching (Autopoiesis, Operational Closure, Binary Codes, Structural Coupling) and verify the respective descriptions are displayed.
   - Test closing or toggling functionality.
3. **NetworkGraph boundaries, ripples, and communication paths**:
   - Test that operational closure halos (outer concentric border or circle) are rendered around nodes.
   - Test that environmental irritation ripples (concentric motion circles) are rendered for the active speaker node.
   - Test that the autopoietic path of communication (connecting the sequence of message nodes) is correctly computed and rendered (e.g. using SVGLines or path).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Workspace directory: `/home/yuma/projects/social-autopoiesis-sandbox`.
Write a summary of the test suite and your verification results to a handoff file at `/home/yuma/projects/social-autopoiesis-sandbox/.agents/teamwork_preview_worker_tests/handoff.md`.
Send a message when complete.
