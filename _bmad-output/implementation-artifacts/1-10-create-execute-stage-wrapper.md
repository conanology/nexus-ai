# Story 1.10: Create Execute Stage Wrapper

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a unified stage execution wrapper,
So that all stages automatically apply logging, cost tracking, quality gates, and error handling.

## Acceptance Criteria

**Given** quality gate framework from Story 1.9
**When** I implement `executeStage` wrapper
**Then** function signature is:
```typescript
executeStage<TIn, TOut>(
  input: StageInput<TIn>,
  stageName: string,
  execute: (data: TIn, config: StageConfig) => Promise<TOut>,
  options?: { qualityGate?: QualityGateName }
): Promise<StageOutput<TOut>>
```
**And** wrapper automatically:
- Logs stage start with pipelineId and stageName
- Creates CostTracker for the stage
- Wraps execute function with try/catch
- Calls quality gate if specified
- Logs stage complete with duration, provider, cost
- Returns properly formatted `StageOutput<TOut>`
**And** on error, wrapper:
- Logs error with full context
- Wraps error in `NexusError.fromError()` if not already NexusError
- Includes stage name in error
**And** integration test demonstrates wrapper with mock stage:
```typescript
const output = await executeStage(input, 'test-stage', async (data) => {
  return { processed: data.value * 2 };
}, { qualityGate: 'test' });
```
**And** output includes all required fields: success, data, quality, cost, durationMs, provider

## Tasks / Subtasks

- [x] Create Wrapper Module (AC: Function Signature)
  - [x] Create `packages/core/src/utils/execute-stage.ts`
  - [x] Define generic `executeStage` function
  - [x] Import dependencies: `StageInput`, `StageOutput`, `logger`, `CostTracker`, `NexusError`, `qualityGate`

- [x] Implement Execution Logic (AC: Wrapper automation)
  - [x] Add start logging (`logger.info('Stage started'...)`)
  - [x] Initialize `CostTracker`
  - [x] Wrap execution in `try/catch` block
  - [x] Calculate `durationMs`

- [x] Implement Quality & Cost Integration (AC: Quality/Cost)
  - [x] Integrate `tracker.recordApiCall` (passed via context or assumed from provider result)
  - [x] Call `qualityGate.check(stageName, result)`
  - [x] Map gate warnings and metrics to `StageOutput`

- [x] Implement Error Handling (AC: Error wrapping)
  - [x] Catch all errors
  - [x] Log `Stage failed` with full context
  - [x] Re-throw as `NexusError.fromError(error, stageName)`

- [x] Testing (AC: Integration test)
  - [x] Create `packages/core/src/utils/__tests__/execute-stage.test.ts`
  - [x] Test successful execution flow
  - [x] Test error wrapping/handling
  - [x] Test quality gate failure handling (should throw `NexusError.degraded` if gate implies it, or return FAIL status)

## Dev Notes

### Relevant Architecture Patterns

**From Project Context - Stage Execution Template:**
The `project-context.md` contains the **exact** implementation pattern required. Do not deviate from this template:

```typescript
export async function executeStage<TIn, TOut>(
  input: StageInput<TIn>,
  stageName: string,
  execute: (data: TIn, config: StageConfig) => Promise<TOut>,
  options?: { qualityGate?: QualityGateName }
): Promise<StageOutput<TOut>> {
  // ... Implementation logic ...
}
```

**Key Responsibilities:**
1. **Consistency:** This wrapper is the *only* way stages should be executed.
2. **Observability:** It ensures we never miss a log or cost record.
3. **Safety:** It ensures all errors are standardized.

### Source Tree Components to Touch

**New Files:**
- `packages/core/src/utils/execute-stage.ts`
- `packages/core/src/utils/__tests__/execute-stage.test.ts`

**Existing Files to Modify:**
- `packages/core/src/utils/index.ts` (export new utility)
- `packages/core/src/index.ts` (export from core)

### Testing Standards

- Use Vitest.
- Mock `logger` to verify log calls.
- Mock `CostTracker` to verify recording.
- Mock `qualityGate` to verify checks.
- Test both synchronous and asynchronous `execute` functions if possible (though Promise is strictly typed).

### Previous Story Intelligence (1.9 - Quality Gates)

- **Integration:** You will need to import `qualityGate` (the registry/dispatcher) from `@nexus-ai/core` (implemented in 1.9).
- **Interface:** The wrapper needs to handle the `QualityGateResult`. If the result is `FAIL`, the wrapper should decide whether to throw or return a failed output. *Architecture Note:* The Project Context implies explicit throwing for critical failures, but usually, we want the `StageOutput` to reflect the failure so the Orchestrator can handle the "Stop vs Continue" logic. However, following the pattern in `project-context.md` (lines 86-88), if a quality gate fails, we might throw a `DEGRADED` error or handling it.
*Clarification:* The template in `project-context.md` line 422 simply attaches the metrics. But line 86 says "if gateResult.status === 'FAIL' { throw NexusError.degraded... }". **Follow the strict rule in line 86-88:** Throw `NexusError.degraded` on quality failure.

### Git Intelligence (Recent Commits)

- **Pattern:** `feat(core): implement execute stage wrapper`
- **Context:** Recent commits added `withRetry`, `providers`, `logging`. This wrapper stitches them all together.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Implemented `executeStage` wrapper adhering to all ACs.
- Fixed `CostTracker` constructor usage in `observability/cost-tracker.ts` which was calling private constructor incorrectly.
- Updated `StageOutput.cost` type to `StageCostSummary` in `types/pipeline.ts` to match architecture.
- Exported `ErrorSeverity` from `types/index.ts` to fix broken exports.
- Exported `QualityGateName` type from `quality/types.ts`.
- Verified all tests pass (including existing suite).

### File List

- packages/core/src/utils/execute-stage.ts
- packages/core/src/utils/__tests__/execute-stage.test.ts
- packages/core/src/types/pipeline.ts
- packages/core/src/observability/cost-tracker.ts
- packages/core/src/quality/types.ts
- packages/core/src/types/index.ts
- packages/core/src/utils/index.ts
- packages/core/src/__tests__/package-exports.test.ts

## Retrospective Code Review

### Issues Found

**Medium Severity:**
- **File Location Mismatch**: AC claims file is at `packages/core/src/execute-stage/execute-stage.ts` but actual implementation is at `packages/core/src/utils/execute-stage.ts`

**Low Severity:**
- **Import Path Inconsistency**: Documentation shows import from `@nexus-ai/core/execute-stage` but actual barrel export is from `@nexus-ai/core/utils`

### Fixes Applied

1. **Updated File List**: Corrected file path to match actual implementation location
2. **Updated Import Documentation**: Fixed import path to reflect actual barrel export location

### Code Quality Assessment

**Excellent Implementation:**
- ✅ Generic function with proper TypeScript typing
- ✅ Comprehensive error handling with NexusError wrapping
- ✅ Quality gate integration with configurable gates
- ✅ Cost tracking integration
- ✅ Structured logging with safe error serialization
- ✅ Provider info extraction with fallback defaults
- ✅ Complete test coverage (4 tests covering success, error, quality gate fail/pass scenarios)

**Technical Excellence:**
- Clean separation of concerns
- Proper async/await usage
- Safe error handling avoiding secret leakage
- Well-structured test mocks
- Comprehensive AC fulfillment

### Status
Implementation is excellent; only documentation accuracy needed fixes.

## Change Log

- 2026-01-15: Implemented `executeStage` wrapper, fixed `CostTracker` and types. (Cryptology)
- 2026-01-15: Code Review - Fixed security vulnerability in error logging, added quality gate pass test, and updated file list. (Cryptology)
- 2026-01-16: Retrospective Code Review - Fixed file location and import path documentation accuracy. (opencode)

