# Codebase Exploration & Implementation Plan Handoff Report

## 1. Observation
We observed the following exact details in the codebase regarding the representation of systems, active communications, and current visualizations:

### Backend Structure and Streaming
- **Agent Specification & Message Schemas**:
  In `backend/app/schemas.py`:
  - `AgentSpec` defines system nodes and their binary codes (lines 7-17):
    ```python
    class AgentSpec(BaseModel):
        name: str
        binary_code: str
        concern: str
        system_prompt: str
        provider: Literal["ollama", "gemini", "openai", "opencode", "opencode-go"]
        model: str
        is_meta: bool = False
        avatar_hue: int | None = Field(default=None, ge=0, le=359)
        avatar_glyph: str | None = None
    ```
  - `Message` represents active communication events (lines 47-55):
    ```python
    class Message(BaseModel):
        timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
        turn: int
        agent_name: str
        agent_code: str
        message: str
        provider: str
        model: str
    ```
- **Hardcoded Default Systems**:
  In `backend/app/agents.py` (lines 19-58), the hardcoded agents (Economy, Science, Law) and their binary codes are defined:
  - `ECONOMY_AGENT`: `binary_code="支払/非支払"` (Concern: "コスト・利益・市場価値・資源効率")
  - `SCIENCE_AGENT`: `binary_code="真/偽"` (Concern: "データ客観性・論理整合性・エビデンス・事実検証")
  - `LAW_AGENT`: `binary_code="合法/違法"` (Concern: "規約遵守・権利・契約正当性")
- **Simulation Loop & Message Creation**:
  In `backend/app/simulation.py`, the loop `run_simulation` (lines 97-174) constructs messages on turns (lines 134-141):
  ```python
  msg = Message(
      turn=turn,
      agent_name=agent.name,
      agent_code=agent.binary_code,
      message=resp.content,
      provider=resp.provider,
      model=resp.model,
  )
  await logger.log(msg)
  ```
- **Streaming over SSE and WebSockets**:
  In `backend/app/server.py`:
  - Server-Sent Events are yielded in `stream_simulation` (lines 187-226) as token streams.
  - The WebSocket route `/ws/simulations/{simulation_id}` (lines 237-273) subscribes to updates from the simulation logger and pushes serialized messages directly to the client:
    ```python
    while True:
        msg = await queue.get()
        if msg is None:
            break
        await websocket.send_text(msg.model_dump_json())
    ```

### Frontend Representation and Visualizations
- **Types**:
  In `frontend/src/types.ts`:
  - `Message` (lines 1-10) models the streamed message format.
  - `AgentNode` (lines 32-43) includes fields for UI state rendering:
    ```typescript
    export interface AgentNode {
      name: string;
      binaryCode: string;
      concern: string;
      provider: string;
      model: string;
      speakCount: number;
      state: AgentState;
      avatarHue?: number;
      avatarGlyph?: string;
      isMeta?: boolean;
    }
    ```
- **Active Agent Highlights**:
  In `frontend/src/App.tsx` (lines 119-138), active agents get state updates:
  ```typescript
  const agentsWithState = useMemo<Record<string, AgentNode>>(() => {
    const result: Record<string, AgentNode> = {};
    for (const [name, a] of Object.entries(agents)) {
      let state: AgentNode["state"] = "idle";
      if (status === "running") {
        if (name === currentSpeaker) {
          state = "speaking";
        } else if (
          agentOrderMode === "fixed" &&
          name === nextSpeaker
        ) {
          state = "thinking";
        } else if (agentOrderMode === "dynamic") {
          state = "thinking";
        }
      }
      result[name] = { ...a, state };
    }
    return result;
  }, [agents, currentSpeaker, nextSpeaker, status, agentOrderMode]);
  ```
- **NetworkGraph Rendering**:
  In `frontend/src/components/NetworkGraph.tsx`, nodes and cumulative edges are laid out inside an SVG (lines 281-370).
  - The speaking agent (`isCurrent === true`) has high-light animations (lines 296-332):
    - Scaled group wrapper (`scale(1.2)`).
    - Orange stroke `#ff9d00` with 2.5 width.
    - Concentric rotating `<motion.circle>` outer border:
      ```typescript
      <motion.circle
        r={r + 8}
        fill="none"
        stroke={currentColor}
        strokeWidth="1.5"
        strokeDasharray="8 12"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      ```
    - Cyan border details indicating targeted neural nodes.
- **Message Animations**:
  In `frontend/src/components/MessageBubble.tsx` (lines 23-30), Framer Motion is used to slide-in new messages:
  ```typescript
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ type: "spring", stiffness: 220, damping: 24 }}
    className="hud-panel flex gap-3 rounded-md p-3"
    aria-label={`turn-${message.turn}`}
    style={{ borderLeft: `4px solid ${borderColor}` }}
  >
  ```

---

## 2. Logic Chain
1. **Adding Backend Fields is Unnecessary**:
   Because `agent_code` containing the binary code string (e.g. `"支払/非支払"`, `"真/偽"`) is already passed to the frontend within the message object, we can build the visualization features entirely in the frontend without modifying the database schemas, API payload structures, or backend logic. This ensures high stability and zero API breakage.
2. **Operational Closure (Boundaries/Halos)**:
   Luhmann defines operational closure as a strict division between system and environment. By rendering a distinct outer halo (concentric circle or glow) around each agent node, we can visually depict this closed system boundary.
3. **Binary Code Activation Score (Laplace-smoothed Synonyms/Keywords)**:
   For any code `X/Y` (where `X` is positive and `Y` is negative), we can count occurrences of `X` and `Y` in the text. Since `Y` might contain `X` as a substring (e.g., `非支払` contains `支払`), we should count `Y` first, and subtract its count from `X`'s raw count. We can then compute a ratio score to drive a needle-based balance gauge in real-time.
4. **Environmental Irritation Propagation (Ripples)**:
   Systems trigger pertubations in other systems through structural coupling. Visualizing this as wave-like concentric ripples radiating from the active node `(pos.x, pos.y)` across the canvas represents this concept perfectly.
5. **Autopoietic Communication Chain Path**:
   To draw the autopoietic communication flow (the linking of communication to communication), we can extract the last 3-5 message sequences and draw a distinct flowing path connecting those nodes in order. Animating a particle or dash array along this path visually represents the process of self-reproduction.
6. **Educational Panel**:
   A toggleable sidebar or overlay modal styled in cyberpunk matching the theme can offer the theoretical details of Niklas Luhmann's theory (Autopoiesis, Operational Closure, Binary Codes, and Structural Coupling) to users without cluttering the main simulation dashboard.

---

## 3. Caveats
- **Local LLM Performance**: Since text parsing relies on LLM message contents, if the LLM fails to output keywords or relevant concepts, the Binary Code Gauge will fall back to a neutral 50-50 center point. However, default prompts specifically instruct agents to interpret input through their binary code, ensuring high keyword occurrences.
- **Node Position Adjustments**: Because nodes are draggable, paths and ripples must reference the dynamic `positions` state in `NetworkGraph.tsx` to prevent offsets.

---

## 4. Conclusion & Recommended Plan
We recommend implementing the visual enhancements as follows:

### Task 1: Visualizing Operational Closure (Node Boundary Halos)
- **Implementation**: In `NetworkGraph.tsx`, add an outer circle around every agent node.
- **Details**:
  - Color matches the agent's unique hue (`nodeColor`) at a lower opacity.
  - Border style is dotted/dashed and pulses slowly (e.g., repeating scale/opacity transitions) to represent the operationally closed state.
  - Add text label or tooltip on hover: `"閉鎖境界 (System Boundary)"`.

### Task 2: Visualizing Binary Code Activation (Balance Gauge)
- **Implementation**: Create a new component `frontend/src/components/BinaryCodeGauge.tsx` and render it above the `TimelineList` or as a top-right graph overlay in `App.tsx`.
- **Details**:
  - Helper function `analyzeMessageCode` analyzes the active speaker's code poles:
    ```typescript
    const countOccurrences = (str: string, sub: string) => {
      let count = 0, pos = str.indexOf(sub);
      while (pos !== -1) { count++; pos = str.indexOf(sub, pos + sub.length); }
      return count;
    };
    const [posTerm, negTerm] = binaryCode.split('/');
    let negCount = countOccurrences(messageText, negTerm);
    let posCount = countOccurrences(messageText, posTerm);
    if (negTerm.includes(posTerm)) posCount = Math.max(0, posCount - negCount);
    const score = posCount || negCount ? posCount / (posCount + negCount) : 0.5;
    ```
  - UI: A high-tech cyberpunk balance meter with a needle/slider shifting left (negative pole in red, e.g. "非支払") or right (positive pole in cyan, e.g. "支払") along with active word counters.

### Task 3: Visualizing Environmental Irritation (Expanding ripples)
- **Implementation**: In `NetworkGraph.tsx`, render expanding concentric ripple circles from the active speaker node.
- **Details**:
  - Render multiple `<motion.circle>` elements centered at `(pos.x, pos.y)` of the `currentSpeaker`.
  - Transition: animate radius `r` from node radius to `r + 150` and opacity from `0.6` to `0`, looping infinitely with delayed starts.

### Task 4: Drawing the Autopoietic Communication Path
- **Implementation**: In `NetworkGraph.tsx`, compute the sequential transitions of the last 3-5 messages.
- **Details**:
  - Generate edges: `const pathSegments = []` for consecutive messages: `from = messages[i-1].agent_name`, `to = messages[i].agent_name`.
  - Draw these path edges in a distinct bright neon pink/yellow color.
  - Animate flow: Use a dotted line with animated `strokeDashoffset` or `<motion.circle>` traveling along each path segment to represent the flow of communication linking.

### Task 5: Luhmann Educational Panel
- **Implementation**: Create `frontend/src/components/EducationalPanel.tsx` containing descriptions of Luhmann's theory.
- **Details**:
  - Include tabs: "自己再生産 (Autopoiesis)", "作動的閉鎖 (Operational Closure)", "二値コード (Binary Codes)", "構造的カップリング (Structural Coupling)".
  - Add a toggle button in the main header of `App.tsx` (e.g. next to the title) that opens this panel as a slide-out drawer or overlay modal.

### Files to Modify/Create:
1. `frontend/src/components/BinaryCodeGauge.tsx` (create)
2. `frontend/src/components/EducationalPanel.tsx` (create)
3. `frontend/src/components/NetworkGraph.tsx` (modify)
4. `frontend/src/App.tsx` (modify)
5. `frontend/src/types.ts` (modify)

---

## 5. Verification Method
Verify that existing code passes checks first, and use these same tools to test new features:
- **Build and Test Verification Command**:
  Run from the root directory:
  ```bash
  ./.shared-agents/harness/verify.sh
  ```
  This command will:
  1. Check formatting and lints on the backend (using `ruff`).
  2. Run type checking on the backend (using `mypy`).
  3. Execute unit tests on the backend (using `pytest`).
  4. Perform ESLint checks on frontend files.
  5. Run TypeScript type checks (`tsc`) on the frontend.
  6. Execute Vitest unit and component tests (`npm run test`).
- **Tests Location**:
  - Frontend test specs: `frontend/src/__tests__/` (e.g., `NetworkGraph.test.tsx` for network graph rendering).
  - Backend test specs: `backend/tests/` (e.g., `test_simulation.py` for simulation turn logic).
