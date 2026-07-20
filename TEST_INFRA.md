# E2E Test Infra: Luhmann's Social Autopoiesis Sandbox

## Test Philosophy
Opaque-box and component integration tests verifying the autopoietic simulation visualization, educational panel, and interactive controls. Tests are implemented via React Testing Library and Vitest in `frontend/src/__tests__/`.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Workload) |
|---|---------|---------------------|:------:|:------:|:------:|:------:|
| 1 | Operational Closure Boundary | R1: halo/glow boundary around systems | 5 | 5 | ✓ | ✓ |
| 2 | Binary Code Balance Gauge | R1: code activation meters/balances | 5 | 5 | ✓ | ✓ |
| 3 | Environmental Irritation | R1: concentric animated ripples from active node | 5 | 5 | ✓ | ✓ |
| 4 | Autopoietic Path Flow | R1: visual path connecting message sequence | 5 | 5 | ✓ | ✓ |
| 5 | Educational panel | R2: explanatory panel about Luhmann's theory | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Vitest (`npm run test` or `npx vitest run`)
- **Assertions**: React Testing Library `screen`, `getByText`, `getByLabelText`, `expect`
- **Mocking**: Mock Framer Motion and timer ticks where necessary to isolate animations.

## Real-World Application Scenarios (Tier 4)
- **Scenario 1**: Start simulation, select dynamic speaker order, see messages stream, verify that node boundary, binary balance, irritation ripples, and connection path update concurrently.
- **Scenario 2**: Open educational panel, switch between Luhmann concept tabs, verify explanations are accurate and user-friendly, then close the panel and check simulation.
