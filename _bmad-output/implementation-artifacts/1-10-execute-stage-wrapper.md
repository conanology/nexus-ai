# Story 1.10: Create Execute Stage Wrapper

Status: done

## Story

As a developer,
I want a unified stage execution wrapper,
So that all stages automatically apply logging, cost tracking, quality gates, and error handling.

## Acceptance Criteria

1. **Given** quality gate framework from Story 1.9
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

2. **And** wrapper automatically:
   - Logs stage start with pipelineId and stageName
   - Creates CostTracker for the stage
   - Wraps execute function with try/catch
   - Calls quality gate if specified
   - Logs stage complete with duration, provider, cost
   - Returns properly formatted `StageOutput<TOut>`

3. **And** on error, wrapper:
   - Logs error with full context
   - Wraps error in `NexusError.fromError()` if not already NexusError
   - Includes stage name in error

4. **And** output includes all required fields: success, data, quality, cost, durationMs, provider

## Tasks / Subtasks

- [x] Task 1: Create executeStage function (AC: #1)
  - [x] Define function signature with generics
  - [x] Accept StageInput, stageName, execute function, options
  - [x] Return Promise<StageOutput>

- [x] Task 2: Implement automatic behaviors (AC: #2)
  - [x] Log stage start with pipelineId and stageName
  - [x] Create CostTracker instance
  - [x] Track execution start time
  - [x] Call execute function
  - [x] Call quality gate if specified in options
  - [x] Log stage completion with metrics
  - [x] Persist cost data

- [x] Task 3: Implement error handling (AC: #3)
  - [x] Wrap execute in try/catch
  - [x] Wrap unknown errors in NexusError.fromError
  - [x] Add stage name to error context
  - [x] Log error with full context

- [x] Task 4: Build StageOutput (AC: #4)
  - [x] Include success: true/false
  - [x] Include data from execute result
  - [x] Include quality metrics from gate
  - [x] Include cost from CostTracker
  - [x] Include durationMs
  - [x] Include provider if applicable

- [x] Task 5: Export from stage module
  - [x] Create stage/index.ts
  - [x] Add to main package exports

## Dev Notes

### StageOutput Structure

```typescript
interface StageOutput<T> {
  success: boolean;
  data: T;
  artifacts?: ArtifactRef[];
  quality?: QualityMetrics;
  cost: CostBreakdown;
  durationMs: number;
  provider?: string;
  warnings?: string[];
}
```

### Usage Example

```typescript
const output = await executeStage(
  input,
  'news-sourcing',
  async (data, config) => {
    // Stage implementation
    return { topic, candidates };
  },
  { qualityGate: 'news' }
);
```

### Automatic Logging

Stage execution logs:
1. `[stage-name] Starting` - with pipelineId
2. `[stage-name] Completed` - with duration, cost, quality status
3. `[stage-name] Failed` - on error, with error details

### Cost Tracking Integration

- CostTracker created at stage start
- Providers can access via context
- Costs persisted after stage completion
- Included in StageOutput

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented executeStage with full generic typing
- Added automatic logging at start, completion, and error
- Integrated CostTracker creation and persistence
- Quality gate integration with optional gate name
- Error wrapping ensures all errors are NexusError
- StageOutput includes all required fields per architecture
- Duration tracking with millisecond precision

### File List

**Created/Modified:**
- `nexus-ai/packages/core/src/stage/execute.ts` - executeStage implementation
- `nexus-ai/packages/core/src/stage/index.ts` - Exports

### Dependencies

- **Upstream Dependencies:** Stories 1.3-1.9 (all core utilities)
- **Downstream Dependencies:** All pipeline stages use this wrapper

---

## Epic 1 Complete

**Stories Completed:** 10/10
- Story 1.1: Initialize Monorepo ✅
- Story 1.2: Create Core Types Package ✅
- Story 1.3: Implement Error Handling Framework ✅
- Story 1.4: Implement Retry and Fallback Utilities ✅
- Story 1.5: Implement Provider Abstraction ✅
- Story 1.6: Set Up GCP Infrastructure ✅
- Story 1.7: Implement Structured Logging ✅
- Story 1.8: Implement Cost Tracking ✅
- Story 1.9: Implement Quality Gate Framework ✅
- Story 1.10: Create Execute Stage Wrapper ✅

**NFRs Addressed:** NFR14-17 (Integration Resilience), NFR23-25 (Security)

**Outcome:** Complete foundation for building pipeline stages with enforced patterns
