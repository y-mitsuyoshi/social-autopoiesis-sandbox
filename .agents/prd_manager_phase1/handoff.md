# Handoff Report

## 1. Observation
- **User Request File**: In `/home/yuma/projects/social-autopoiesis-sandbox/.agents/ORIGINAL_REQUEST.md`, lines 41-83 define the follow-up enhancement requirements:
  - "R1. LLM Timeout & Error Resilience"
  - "R2. Autopoiesis Proof Status & Beginner-Friendly Sociology Panels"
  - "R3. Ghost-in-the-Shell Style Cybernetic Avatars"
  - "R4. Human-like Dialogue & Backend Scheduler Turn Enforcement"
- **PRD Template**: In `/home/yuma/projects/social-autopoiesis-sandbox/.shared-agents/templates/prd.md`, the template structure consists of:
  - `# PRD: {{TITLE}}`
  - `## 概要と目標`
  - `## ターゲットユーザー / ユースケース`
  - `## 機能要件 (必須)`
  - `## 非機能要件 (パフォーマンス、UX等)`
  - `## 受け入れ基準 (Acceptance Criteria)`
  - `## 未解決・考慮事項`
- **Existing Codebase files**:
  - `backend/app/llm_client.py` sets a default timeout of `timeout=60.0` for `OpenAICompatibleClient` (line 74) and `GeminiClient` (line 144).
  - `backend/app/simulation.py` handles the `run_simulation` logic, containing candidate selection and loop processing.
  - `frontend/src/components/AgentAvatar.tsx` renders geometric svg avatars using `generateAvatar` in `src/lib/avatar.ts`.
  - `frontend/src/components/EducationalPanel.tsx` contains static sociological explanations for autopoiesis.
- **Verification Execution**: Ran `./.shared-agents/harness/verify.sh` which succeeded with output:
  `Test Files  14 passed (14)`
  `Tests  78 passed (78)`
  `✓ フロントエンドチェック成功!`

## 2. Logic Chain
- **Observation 1**: The user requests detailed requirements in Japanese for four distinct areas: LLM timeout/error resilience, Autopoiesis Proof Status calculation + panels, GITS cybernetic avatars, and Backend scheduler turn enforcement.
- **Observation 2**: The PRD template expects a specific layout (`概要と目標`, `ターゲットユーザー / ユースケース`, `機能要件`, `非機能要件`, `受け入れ基準`, `未解決・考慮事項`).
- **Observation 3**: The existing code references specific files, functions, and files (`llm_client.py`, `run_simulation`, `AgentAvatar.tsx`, etc.).
- **Deduction**: We must construct a highly detailed, Japanese-language PRD at `docs/prd/social_autopoiesis_enhancement.md` that perfectly matches the template sections and references concrete architectural files, defining how each of the 4 requested enhancements should be calculated, parameterized, and rendered.
- **Deduction 2**: A run of the verify script ensures that adding the new documentation file does not disrupt the existing codebase or tests.

## 3. Caveats
- The PRD only defines the specifications. It does not implement the code changes.
- The criteria for "operational closure" (e.g. self-referential cycle detection and binary code activation balance) are defined in the PRD, but the exact algorithms (e.g. cycle-finding in a dynamic directed graph) will need to be detailed in the Tech Spec/Architecture phase.

## 4. Conclusion
- The Product Requirements Document has been successfully drafted and saved at `/home/yuma/projects/social-autopoiesis-sandbox/docs/prd/social_autopoiesis_enhancement.md`.
- All requirements of the follow-up request are fully detailed in compliance with the project's formatting and layout rules.
- The repository lints and tests remain 100% clean.

## 5. Verification Method
- **Verify File Location**: Inspect the file `/home/yuma/projects/social-autopoiesis-sandbox/docs/prd/social_autopoiesis_enhancement.md`. Confirm it follows the PRD template structure.
- **Verify Content Details**: Check that the PRD covers:
  - `LLM_TIMEOUT` config and fallback responses in `llm_client.py`/`simulation.py`.
  - Operational closure rules and status indicators in Japanese.
  - Cybernetic neon-glowing silhouettes with speaking wave lines in `AgentAvatar.tsx`.
  - Balanced turn enforcement in `run_simulation` cycles and natural Japanese prompts.
- **Run Verification Harness**: Execute `./.shared-agents/harness/verify.sh` to confirm no lints or tests are broken.
