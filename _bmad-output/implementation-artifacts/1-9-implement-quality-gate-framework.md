# Story 1.9: Implement Quality Gate Framework

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want quality gates that validate stage outputs,
So that low-quality content is caught before publishing.

## Acceptance Criteria

**Given** cost tracking from Story 1.8
**When** I implement the quality gate framework
**Then** `QualityGate` interface defines:
- `check(stageName, output)` returns `QualityGateResult`
**And** `QualityGateResult` includes:
- `status`: 'PASS' | 'WARN' | 'FAIL'
- `metrics`: stage-specific quality measurements
- `warnings`: array of warning messages
- `reason`: failure reason if status is FAIL
**And** stage-specific gates are defined per architecture:
- `script-gen`: word count 1200-1800
- `tts`: silence <5%, no clipping detection
- `render`: zero frame drops, audio sync <100ms
- `thumbnail`: 3 variants generated
**And** `qualityGate.check(stage, output)` dispatches to correct gate
**And** gates log quality metrics via structured logger
**And** pre-publish gate `qualityGateCheck(pipelineRun)` returns:
- `AUTO_PUBLISH`: no issues
- `AUTO_PUBLISH_WITH_WARNING`: minor issues (≤2, no TTS fallback)
- `HUMAN_REVIEW`: major quality compromises
**And** unit tests verify each gate with passing and failing inputs

## Tasks / Subtasks

- [x] Define Quality Gate Interfaces (AC: Interface definitions)
  - [x] Create `packages/core/src/quality/types.ts`
  - [x] Define `QualityStatus` enum ('PASS', 'WARN', 'FAIL')
  - [x] Define `QualityGateResult` interface
  - [x] Define `QualityGate` interface definition
  - [x] Define `PublishDecision` enum (AUTO_PUBLISH, etc.)

- [x] Implement Quality Gate Logic (AC: Framework implementation)
  - [x] Create `packages/core/src/quality/gates.ts`
  - [x] Implement `QualityGateRegistry` to manage stage gates
  - [x] Implement `check(stage, output)` dispatcher
  - [x] Implement specific gate logic stubs/implementations:
    - [x] `script-gen` gate (word count validation)
    - [x] `tts` gate (silence/clipping checks)
    - [x] `render` gate (frame drops/sync)
    - [x] `thumbnail` gate (variant count)

- [x] Implement Pre-Publish Logic (AC: Pre-publish gate)
  - [x] Implement `evaluatePublishReadiness(pipelineRun)` function
  - [x] Logic for `AUTO_PUBLISH` vs `WARNING` vs `HUMAN_REVIEW`
  - [x] Integration with CostTracker (check NFR cost limits)

- [x] Integrate Observability (AC: Logging)
  - [x] Log quality checks using structured logger
  - [x] Include metrics in log context

- [x] Package Exports & Config
  - [x] Export from `packages/core/src/quality/index.ts`
  - [x] Update `packages/core/src/index.ts`

- [x] Testing (AC: Unit tests)
  - [x] Test `check()` dispatching
  - [x] Test specific gate logic (mock inputs)
  - [x] Test pre-publish decision logic
  - [x] Test error handling

## Dev Notes

### Relevant Architecture Patterns

**From Architecture Document - Quality Gates:**
- **Core Principle:** NEVER publish low-quality content. Skip day > bad video.
- **Location:** `packages/core/src/quality/`
- **Integration:** Used by `executeStage` wrapper (Story 1.10)
- **Error Handling:** Failed gates should not throw errors but return FAIL status (unless critical system error)

**Stage Gate Definitions:**
```typescript
const GATES = {
  'script-gen': (output) => checkWordCount(output.data, 1200, 1800),
  'tts': (output) => checkAudioQuality(output.data),
  'render': (output) => checkVideoQuality(output.data),
  'thumbnail': (output) => checkVariantCount(output.data, 3)
}
```

**Pre-Publish Decision Logic:**
```typescript
function qualityGateCheck(run: PipelineRun): QualityDecision {
  // AUTO_PUBLISH: No issues
  // AUTO_PUBLISH_WITH_WARNING: Minor issues (≤2, no TTS fallback)
  // HUMAN_REVIEW: Major quality compromises
}
```

### Source Tree Components to Touch

**New Files:**
- `packages/core/src/quality/types.ts`
- `packages/core/src/quality/gates.ts`
- `packages/core/src/quality/index.ts`
- `packages/core/src/quality/__tests__/gates.test.ts`

**Existing Files to Modify:**
- `packages/core/src/index.ts` (export quality module)

### Testing Standards

- Use Vitest
- Mock `StageOutput` data for testing gates
- Test boundary conditions (e.g., word count exactly 1200)
- Test empty/invalid inputs

### Previous Story Intelligence (1.8 - Cost Tracking)

**Integration Points:**
- **Cost Checks:** The pre-publish gate should ideally check if the total video cost exceeds NFRs ($0.50/$1.50).
- **Access:** Use `CostTracker.getVideoCost(pipelineId)` to get cost data for decision making.

**Code Patterns:**
- Follow `packages/core/src/observability` pattern (types, implementation, index, tests).
- Use `NexusError` if system fails to check quality.

### Git Intelligence (Recent Commits)

- **Pattern:** `feat(core): implement quality gate framework`
- **Structure:** Co-located tests in `__tests__` directory.

### Latest Technical Information

- **TypeScript:** Use `as const` for Enums if preferred, or standard `enum`.
- **Validation:** Ensure type guards are used if checking unknown `output.data` shapes.

## Dev Agent Record

### Implementation Notes
- Implemented `QualityGateRegistry` in `packages/core/src/quality/gates.ts` supporting stage-specific checks.
- Implemented default gates for `script-gen`, `tts`, `render`, `thumbnail` following NFRs.
- Implemented `evaluatePublishReadiness` with cost tracking integration (Cost Limit: $1.50) and fallback analysis.
- Created `packages/core/src/quality/types.ts` defining Enums `QualityStatus`, `PublishDecision` and Interfaces `QualityGate`, `QualityGateResult`.
- Added comprehensive unit tests in `gates.test.ts` covering registry, default gates, and pre-publish logic.
- Integrated `CostTracker` for pre-publish cost validation.
- Updated `packages/core/src/index.ts` to export quality module.
- Resolved type export conflict in `packages/core/src/types/index.ts`.
- **Code Review Fixes:**
  - Consolidate all quality types into `packages/core/src/quality/types.ts` to avoid duplicate exports and circular dependencies.
  - Restored detailed metric interfaces (`ScriptQualityMetrics`, etc.) to `packages/core/src/quality/types.ts` to ensure type safety.
  - Removed legacy `packages/core/src/types/quality.ts`.
  - Added new files to git tracking.

## File List
- packages/core/src/quality/types.ts
- packages/core/src/quality/gates.ts
- packages/core/src/quality/index.ts
- packages/core/src/quality/__tests__/types.test.ts
- packages/core/src/quality/__tests__/gates.test.ts
- packages/core/src/index.ts
- packages/core/src/types/index.ts

## Change Log
- feat(core): implement quality gate framework (Story 1.9)
