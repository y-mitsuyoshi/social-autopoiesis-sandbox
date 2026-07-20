# Test Suite & Feature Implementation Plan

## Objective
Implement Luhmann's Social Autopoiesis visualization features and their corresponding comprehensive tests in `frontend/src/__tests__/AutopoiesisVisuals.test.tsx`.

## Planned Steps

### Step 1: Create `BinaryCodeGauge` Component
- Create `frontend/src/components/BinaryCodeGauge.tsx`
- Implement code-poles analysis scoring logic `analyzeMessageCode(binaryCode, messageText)` with:
  - Laplace-smoothed-like keywords scoring (0.0 to 1.0)
  - Negative/positive poles parsing (e.g. `支払/非支払`)
  - Substring conflict logic handling (e.g., if negative pole `"非支払"` contains positive pole `"支払"`, deduct match counts)
  - Default neutral score of `0.5` when both counts are `0`
- Render needle dynamically relative to score.

### Step 2: Create `EducationalPanel` Component
- Create `frontend/src/components/EducationalPanel.tsx`
- Build a tabbed panel explaining Luhmann's core autopoiesis theories:
  - Autopoiesis (自己再生産)
  - Operational Closure (作動的閉鎖)
  - Binary Codes (二値コード)
  - Structural Coupling (構造的カップリング)
- Include content tabs, switching behavior, close callback.

### Step 3: Enhance `NetworkGraph` Component
- Modify `frontend/src/components/NetworkGraph.tsx`
- Add props: `messages` (optional) to allow computing path sequences.
- Render concentric outer halos around all node circles (Operational Closure) with test IDs.
- Render concentric pulsing motion/animation circles (Environmental Irritation Ripples) for the active/speaking node.
- Compute and render autopoietic path of communication connecting the sequence of message nodes.

### Step 4: Write `AutopoiesisVisuals.test.tsx`
- Create `frontend/src/__tests__/AutopoiesisVisuals.test.tsx`
- Implement robust unit and component tests for:
  - `BinaryCodeGauge`: positive/negative poles rendering, scoring logic with various texts (positive-only, negative-only, both, substring conflict, default/empty), needle translation/position.
  - `EducationalPanel`: component rendering, tab switching (active tab content updates), closing/toggling callback invocation.
  - `NetworkGraph` visual structures: operational closure halo presence, active speaker irritation ripples, computed autopoietic paths rendering.

### Step 5: Verify Changes
- Run verification command `./.shared-agents/harness/verify.sh`
- Ensure zero TS compilation, linting, and testing errors.
