# Story 1.8: Implement Cost Tracking

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to track API costs per stage and per video,
So that I can monitor spending and stay within budget.

## Acceptance Criteria

**Given** structured logging from Story 1.7
**When** I implement `CostTracker` class
**Then** constructor accepts `pipelineId` and `stageName`
**And** `recordApiCall(service, tokens, cost)` adds cost entry with timestamp
**And** `getSummary()` returns `CostBreakdown` with:
- Total cost for the stage
- Breakdown by service
- Token counts where applicable
**And** `persist()` saves costs to Firestore at `pipelines/{pipelineId}/costs`
**And** costs are tracked in dollars with 4 decimal precision
**And** static method `CostTracker.getVideoCost(pipelineId)` retrieves total video cost
**And** static method `CostTracker.getDailyCosts(date)` retrieves all costs for date
**And** cost tracking integrates with provider abstraction (providers call tracker)
**And** NFR10 (<$0.50/video) and NFR11 (<$1.50/video) can be verified via costs

## Tasks / Subtasks

- [x] Implement CostTracker class (AC: CostTracker class)
  - [x] Create `packages/core/src/observability/cost-tracker.ts`
  - [x] Implement constructor with pipelineId and stageName
  - [x] Implement `recordApiCall(service, tokens, cost)` method
  - [x] Implement `getSummary()` method returning aggregated CostBreakdown
  - [x] Implement `persist()` method saving to Firestore
  - [x] Implement static `getVideoCost(pipelineId)` method
  - [x] Implement static `getDailyCosts(date)` method

- [x] Define cost tracking types (AC: Type definitions)
  - [x] Create types for aggregated cost data
  - [x] Define interface for stage cost summary
  - [x] Define interface for video cost summary
  - [x] Define interface for daily cost summary

- [x] Integrate with Firestore client (AC: Firestore persistence)
  - [x] Use FirestoreClient from Story 1.6
  - [x] Use `getPipelineCostsPath()` from storage/paths.ts
  - [x] Implement Firestore document structure for costs
  - [x] Handle Firestore errors with NexusError wrapping

- [x] Add cost tracking to observability exports (AC: Package exports)
  - [x] Export CostTracker from `observability/index.ts`
  - [x] Export cost tracking types
  - [x] Update `packages/core/src/index.ts` if needed
  - [x] Verify package.json exports configuration

- [x] Write comprehensive tests (AC: Test coverage)
  - [x] Test CostTracker constructor
  - [x] Test recordApiCall with various inputs
  - [x] Test getSummary aggregation logic
  - [x] Test persist() Firestore integration (ALL TESTS PASSING)
  - [x] Test static getVideoCost method
  - [x] Test static getDailyCosts method
  - [x] Test 4 decimal precision requirement
  - [x] Test error handling
  - [x] Test pipelineId validation (added during code review)

## Dev Notes

### Relevant Architecture Patterns

**From Architecture Document - Cost Observability:**
- Cost tracking built-in from Day 1
- Track API costs per-stage, per-video, aggregate
- Persist costs to Firestore at `pipelines/{pipelineId}/costs`
- Cost breakdown shows: total per video, cost by stage, cost by service
- Comparison to budget targets (<$0.50 credit, <$1.50 post)
- NFR10: <$0.50/video (credit period)
- NFR11: <$1.50/video (post-credit period)

**From Architecture Document - Firestore Structure:**
```
pipelines/{YYYY-MM-DD}/costs: {gemini, tts, render, total}
```

**From Architecture Document - Stage Output Contract:**
```typescript
interface StageOutput<T> {
  cost: CostBreakdown;  // Cost breakdown from CostTracker
  // ... other fields
}
```

**From Architecture Document - Provider Abstraction:**
- Providers return cost in their result types (LLMResult, TTSResult, ImageResult)
- CostTracker records costs from provider results
- All stages track costs via CostTracker instance

### Source Tree Components to Touch

**New Files:**
- `packages/core/src/observability/cost-tracker.ts` - CostTracker class implementation
- `packages/core/src/observability/__tests__/cost-tracker.test.ts` - Unit tests

**Existing Files to Modify:**
- `packages/core/src/observability/index.ts` - Export CostTracker
- `packages/core/src/index.ts` - May need to re-export if not already via observability

**Existing Files to Reference (No Changes):**
- `packages/core/src/types/providers.ts` - CostBreakdown interface (already exists)
- `packages/core/src/storage/firestore-client.ts` - FirestoreClient class (Story 1.6)
- `packages/core/src/storage/paths.ts` - getPipelineCostsPath() function (Story 1.6)
- `packages/core/src/observability/logger.ts` - Structured logger (Story 1.7)

### Testing Standards Summary

- Use Vitest for unit tests (consistent with Story 1.7)
- Tests co-located in `__tests__/` directory
- Test all public methods and static methods
- Test error handling (Firestore errors)
- Test 4 decimal precision requirement
- Test aggregation logic (multiple API calls)
- Mock FirestoreClient for integration tests
- Use describe/it/expect pattern

### Project Structure Notes

**Alignment with Unified Project Structure:**
- CostTracker belongs in `packages/core/src/observability/` (alongside logger from Story 1.7)
- Follows existing observability module pattern
- Uses FirestoreClient from `packages/core/src/storage/` (Story 1.6)
- Uses structured logger from `packages/core/src/observability/logger.ts` (Story 1.7)
- Exports via barrel file pattern (`observability/index.ts`)

**File Organization:**
```
packages/core/src/observability/
├── logger.ts                    # EXISTS (Story 1.7)
├── stage-logging.ts             # EXISTS (Story 1.7)
├── cost-tracker.ts              # NEW (this story)
├── types.ts                     # EXISTS (Story 1.7)
├── index.ts                     # MODIFY (add CostTracker export)
└── __tests__/
    ├── logger.test.ts           # EXISTS (Story 1.7)
    ├── stage-logging.test.ts    # EXISTS (Story 1.7)
    └── cost-tracker.test.ts     # NEW (this story)
```

### Previous Story Intelligence (1.7 - Structured Logging)

**What Was Established:**
- Structured logging with Pino (Story 1.7)
- Logger available via `createLogger()` and `createPipelineLogger()`
- Stage logging helpers: `logStageStart`, `logStageComplete`, `logApiCall`
- Pattern: All observability code in `packages/core/src/observability/`
- Pattern: Exports via barrel file (`observability/index.ts`)
- Pattern: Tests in `__tests__/` directory with Vitest

**Key Integration Points:**
- CostTracker should use structured logger for cost tracking logs
- Pattern: `logger.info({ cost, service }, 'API cost recorded')`
- CostTracker integrates with stage logging helpers (logApiCall already logs cost)
- Cost tracking complements structured logging (both observability concerns)

**Patterns to Follow:**
- All exports via barrel files (index.ts)
- Tests co-located in `__tests__/` directories
- Vitest for testing with describe/it/expect pattern
- Use structured logger (no console.log)
- Follow naming conventions (CostTracker class, camelCase methods)

### Previous Story Intelligence (1.6 - GCP Infrastructure)

**What Was Established:**
- FirestoreClient class for Firestore operations
- Firestore paths utilities (`getPipelineCostsPath()` already exists)
- Pattern: All Firestore errors wrapped in NexusError
- Pattern: Firestore document paths: `pipelines/{date}/costs`
- FirestoreClient methods: `getPipelineCosts<T>()`, `setPipelineCosts<T>()`

**Key Integration Points:**
- CostTracker should use FirestoreClient.setPipelineCosts() for persistence
- CostTracker static methods should use FirestoreClient.getPipelineCosts()
- Firestore paths already defined in `storage/paths.ts`
- Error handling: Wrap Firestore errors in NexusError

**Patterns to Follow:**
- Use FirestoreClient, not direct Firestore SDK
- Use path utilities from `storage/paths.ts`
- Wrap Firestore errors in NexusError
- Use TypeScript generics for type safety

### Git Intelligence (Recent Commits)

**Recent Commit Patterns:**
- `feat(core): implement X with Y` - Feature implementation
- Stories include comprehensive dev notes and file lists
- Code review fixes applied in same commit
- All stories result in passing tests

**Commit Message Pattern for This Story:**
```
feat(core): implement cost tracking with CostTracker class

Complete Story 1-8: Implement Cost Tracking

- Implement CostTracker class with recordApiCall and getSummary
- Add persist() method saving to Firestore at pipelines/{pipelineId}/costs
- Implement static getVideoCost() and getDailyCosts() methods
- Integrate with FirestoreClient and structured logger
- Comprehensive unit tests (X tests, all passing)

All acceptance criteria met. Ready for Story 1.9.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### References

- [Epic 1: Story 1.8 Acceptance Criteria](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/epics.md#story-18-implement-cost-tracking)
- [Architecture: Cost Observability](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/architecture.md#cost-observability)
- [Architecture: Firestore Structure](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/architecture.md#3-state--data-persistence)
- [Project Context: Cost Tracking](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/project-context.md#cost-observability)
- [Story 1.7: Structured Logging](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/implementation-artifacts/1-7-implement-structured-logging.md)
- [Story 1.6: GCP Infrastructure](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/implementation-artifacts/1-6-set-up-gcp-infrastructure.md)
- [CostBreakdown Interface](file:///D:/05_Work/NEXUS-AI-PROJECT/packages/core/src/types/providers.ts#CostBreakdown)
- [FirestoreClient Class](file:///D:/05_Work/NEXUS-AI-PROJECT/packages/core/src/storage/firestore-client.ts)

---

## COMPREHENSIVE DEVELOPER CONTEXT

### MISSION CRITICAL: Cost Tracking Foundation

This story creates the **cost tracking infrastructure** that enables:
1. Per-stage cost tracking for all API calls
2. Per-video cost aggregation for budget monitoring
3. Daily cost reporting for spending analysis
4. NFR compliance verification (<$0.50 credit, <$1.50 post-credit)
5. Cost breakdown by service (Gemini, TTS, Image, Render)

**Every stage in Epic 1-5 will use CostTracker to track API costs.**

### EXHAUSTIVE COST TRACKING ANALYSIS

#### 1. Cost Tracking Requirements

**From Architecture - Firestore Structure:**
```
pipelines/{YYYY-MM-DD}/costs: {
  gemini: number,      // LLM + Image generation costs
  tts: number,         // TTS synthesis costs
  render: number,      // Video rendering costs (GCP compute)
  total: number        // Total video cost
}
```

**From Architecture - Stage Output Contract:**
```typescript
interface StageOutput<T> {
  cost: CostBreakdown;  // Cost breakdown from CostTracker
  // ... other fields
}
```

**From Acceptance Criteria:**
- Constructor accepts `pipelineId` (YYYY-MM-DD) and `stageName` (string)
- `recordApiCall(service, tokens, cost)` adds cost entry with timestamp
- `getSummary()` returns aggregated `CostBreakdown` with:
  - Total cost for the stage
  - Breakdown by service
  - Token counts where applicable
- `persist()` saves costs to Firestore at `pipelines/{pipelineId}/costs`
- Costs tracked in dollars with 4 decimal precision (e.g., 0.0023)
- Static `getVideoCost(pipelineId)` retrieves total video cost
- Static `getDailyCosts(date)` retrieves all costs for date
- Cost tracking integrates with provider abstraction

#### 2. CostBreakdown Interface (Already Exists)

**From `packages/core/src/types/providers.ts`:**
```typescript
export interface CostBreakdown {
  service: string;           // API service name (e.g., "gemini-3-pro")
  tokens: {
    input?: number;          // Input tokens (LLM only)
    output?: number;         // Output tokens (LLM only)
  };
  cost: number;              // Cost in USD (4 decimal precision)
  timestamp: string;         // ISO 8601 UTC timestamp
  model?: string;            // Model name if applicable
}
```

**Important:** This interface represents a SINGLE API call cost entry. CostTracker needs to:
- Store multiple `CostBreakdown` entries (one per API call)
- Aggregate them in `getSummary()` to return a summary structure
- The summary structure should aggregate by service and provide totals

**CostTracker.getSummary() Return Type:**
The acceptance criteria says `getSummary()` returns `CostBreakdown`, but this needs to be an aggregated version that includes:
- Total cost for the stage
- Breakdown by service (multiple services)
- Token counts where applicable

**Recommended Structure for getSummary():**
```typescript
interface StageCostSummary {
  stage: string;                    // Stage name
  totalCost: number;                // Total cost for this stage (4 decimals)
  breakdown: Array<{                 // Breakdown by service
    service: string;
    cost: number;
    tokens?: {
      input?: number;
      output?: number;
    };
    callCount: number;               // Number of API calls to this service
  }>;
  timestamp: string;                 // ISO 8601 UTC timestamp
}
```

**Note:** This may differ from the `CostBreakdown` interface. The acceptance criteria may need interpretation - `getSummary()` likely returns an aggregated structure, not a single `CostBreakdown`.

#### 3. CostTracker Class Design

**Constructor:**
```typescript
constructor(pipelineId: string, stageName: string)
```

**Instance Methods:**
```typescript
recordApiCall(service: string, tokens: { input?: number; output?: number }, cost: number): void
getSummary(): StageCostSummary  // or CostBreakdown if aggregated
persist(): Promise<void>
```

**Static Methods:**
```typescript
static async getVideoCost(pipelineId: string): Promise<number>
static async getDailyCosts(date: string): Promise<DailyCostSummary>
```

**Internal State:**
- `pipelineId: string` - Pipeline ID (YYYY-MM-DD)
- `stageName: string` - Stage name
- `entries: CostBreakdown[]` - Array of cost entries for this stage
- `logger: Logger` - Structured logger instance

#### 4. Firestore Integration

**From Story 1.6 - FirestoreClient:**
```typescript
// Get pipeline costs
const costs = await firestoreClient.getPipelineCosts<VideoCosts>('2026-01-08');

// Set pipeline costs
await firestoreClient.setPipelineCosts('2026-01-08', {
  gemini: 0.0023,
  tts: 0.0045,
  render: 0.0012,
  total: 0.0080
});
```

**Firestore Document Structure (from Architecture):**
```typescript
interface VideoCosts {
  gemini: number;      // LLM + Image generation
  tts: number;         // TTS synthesis
  render: number;      // Video rendering
  total: number;       // Total cost
  stages?: {           // Optional: per-stage breakdown
    [stageName: string]: {
      total: number;
      breakdown: Array<{
        service: string;
        cost: number;
        tokens?: { input?: number; output?: number };
      }>;
    };
  };
}
```

**CostTracker.persist() Implementation:**
1. Get current costs from Firestore (if exists)
2. Merge current stage costs into existing costs
3. Update totals (by service and overall)
4. Save back to Firestore

**CostTracker.getVideoCost() Implementation:**
1. Load `pipelines/{pipelineId}/costs` from Firestore
2. Return `total` field (or calculate from service breakdown)

**CostTracker.getDailyCosts() Implementation:**
1. Load `pipelines/{date}/costs` from Firestore
2. Return structured daily cost summary

#### 5. Integration with Provider Abstraction

**From Architecture - Provider Results:**
- `LLMResult` includes `cost: number` and `tokens: { input: number; output: number }`
- `TTSResult` includes `cost: number`
- `ImageResult` includes `cost: number`

**Pattern for Stage Integration:**
```typescript
// In a stage (example: script-gen)
const tracker = new CostTracker(pipelineId, 'script-gen');
const result = await llmProvider.generate(prompt);
tracker.recordApiCall(
  result.model,  // service name
  result.tokens, // { input, output }
  result.cost    // cost in USD
);
// ... more API calls ...
const summary = tracker.getSummary();
await tracker.persist();  // Save to Firestore
// Use summary.cost in StageOutput
```

**Note:** The acceptance criteria says "cost tracking integrates with provider abstraction (providers call tracker)". However, the architecture shows providers return costs, and stages record them via CostTracker. The integration is indirect - providers return cost info, stages record it.

#### 6. 4 Decimal Precision Requirement

**Why 4 Decimals?**
- API costs are often very small (e.g., $0.0023 for a TTS call)
- Need precision for accurate cost tracking
- NFR targets are <$0.50 and <$1.50, so precision matters

**Implementation:**
```typescript
// Round to 4 decimals when recording
const roundedCost = Math.round(cost * 10000) / 10000;
tracker.recordApiCall(service, tokens, roundedCost);
```

#### 7. NFR Compliance Verification

**NFR10:** <$0.50/video (credit period)
**NFR11:** <$1.50/video (post-credit period)

**Verification:**
- `CostTracker.getVideoCost(pipelineId)` returns total cost
- Compare against thresholds: <0.50 or <1.50
- Used in cost dashboard (Story 5.5) and alerts

### INTEGRATION WITH EXISTING CODE

#### Structured Logging (Story 1.7)

**CostTracker should use structured logger:**
```typescript
import { createLogger } from '../observability';

const logger = createLogger('observability.cost-tracker');

// When recording API call
logger.debug({
  pipelineId: this.pipelineId,
  stage: this.stageName,
  service,
  cost,
  tokens
}, 'API cost recorded');

// When persisting
logger.info({
  pipelineId: this.pipelineId,
  stage: this.stageName,
  totalCost: summary.totalCost
}, 'Costs persisted to Firestore');
```

#### FirestoreClient (Story 1.6)

**CostTracker should use FirestoreClient:**
```typescript
import { FirestoreClient } from '../../storage';

const firestoreClient = new FirestoreClient();

// In persist()
await firestoreClient.setPipelineCosts(this.pipelineId, costsData);

// In static getVideoCost()
const costs = await firestoreClient.getPipelineCosts<VideoCosts>(pipelineId);
```

#### Error Handling

**Wrap Firestore errors in NexusError:**
```typescript
import { NexusError } from '../../errors';

try {
  await firestoreClient.setPipelineCosts(this.pipelineId, costsData);
} catch (error) {
  throw NexusError.fromError(error, 'cost-tracker');
}
```

### IMPLEMENTATION GUIDANCE

**Start Here:**
1. Create `packages/core/src/observability/cost-tracker.ts`
2. Review `CostBreakdown` interface in `types/providers.ts`
3. Review `FirestoreClient` methods in `storage/firestore-client.ts`
4. Review structured logger in `observability/logger.ts`

**Then Implement in Order:**
1. **Type definitions first** (if needed):
   - `StageCostSummary` interface (or use aggregated `CostBreakdown`)
   - `VideoCosts` interface for Firestore document
   - `DailyCostSummary` interface

2. **CostTracker class second**:
   - Constructor with pipelineId and stageName
   - Internal state (entries array, logger instance)
   - `recordApiCall()` method
   - `getSummary()` method (aggregation logic)
   - `persist()` method (Firestore integration)
   - Static `getVideoCost()` method
   - Static `getDailyCosts()` method

3. **Tests third**:
   - Test constructor
   - Test recordApiCall with various inputs
   - Test getSummary aggregation
   - Test persist() Firestore integration
   - Test static methods
   - Test 4 decimal precision
   - Test error handling

4. **Exports last**:
   - Export CostTracker from `observability/index.ts`
   - Export cost tracking types (if needed)
   - Update `src/index.ts` if needed

### KEY LEARNINGS FOR DEV AGENT

**1. CostBreakdown vs Cost Summary:**
The `CostBreakdown` interface represents a SINGLE API call. CostTracker needs to aggregate multiple calls and return a summary structure. The acceptance criteria says `getSummary()` returns `CostBreakdown`, but this likely means an aggregated/merged version.

**2. Firestore Document Structure:**
The architecture shows `costs: { gemini, tts, render, total }`. CostTracker needs to merge stage costs into this structure, not overwrite it. Multiple stages will contribute to the same document.

**3. 4 Decimal Precision:**
Always round costs to 4 decimals when recording. Use `Math.round(cost * 10000) / 10000`.

**4. Provider Integration:**
Providers don't directly call CostTracker. Instead, stages record costs from provider results. The integration is: Provider → Stage → CostTracker.

**5. Static Methods:**
Static methods need to create a FirestoreClient instance internally (they don't have access to instance state).

**6. Error Handling:**
Always wrap Firestore errors in NexusError using `NexusError.fromError(error, 'cost-tracker')`.

### INTEGRATION WITH FUTURE STORIES

**Story 1.9 (Quality Gate Framework):**
- Quality gates will use cost data from CostTracker
- Cost thresholds may be part of quality checks

**Story 1.10 (Execute Stage Wrapper):**
- executeStage wrapper will use CostTracker for all stages
- Automatic cost tracking integration

**Epic 2-5 (All Pipeline Stages):**
- Every stage creates CostTracker: `new CostTracker(pipelineId, stageName)`
- Every stage records API costs: `tracker.recordApiCall(...)`
- Every stage persists costs: `await tracker.persist()`
- Every stage includes cost in StageOutput: `cost: tracker.getSummary()`

**Story 5.5 (Cost Dashboard):**
- Cost dashboard uses `CostTracker.getVideoCost()` and `CostTracker.getDailyCosts()`
- Cost alerts use cost data from CostTracker
- Budget tracking uses aggregated cost data

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

✅ **Story 1-8: Implement Cost Tracking - COMPLETE**

**Implementation Summary:**
- Created `CostTracker` class with full cost tracking functionality
- Implemented instance methods: `recordApiCall()`, `getSummary()`, `persist()`
- Implemented static methods: `getVideoCost()`, `getDailyCosts()`
- Defined comprehensive TypeScript interfaces: `StageCostSummary`, `ServiceCostBreakdown`, `VideoCosts`, `DailyCostSummary`
- Integrated with FirestoreClient for persistence at `pipelines/{pipelineId}/costs`
- 4 decimal precision for micro-cost tracking (e.g., $0.0023)
- Comprehensive error handling with NexusError wrapping
- Structured logging integration using Pino logger

**Test Coverage:**
- 24 tests written, **ALL 24 PASSING (100% pass rate)**
- All core functionality tests pass (constructor, recordApiCall, getSummary, rounding)
- All Firestore integration tests pass (mocking fixed during code review)
- All validation tests pass (pipelineId format and date validity)
- Core implementation logic validated and correct

**Key Features:**
- Per-stage cost aggregation by service
- Automatic rounding to 4 decimal places
- Token tracking for LLM calls
- Firestore document merging (preserves existing stage costs)
- Service categorization (gemini, tts, render)

**Files Modified/Created:**
- ✅ Created: `packages/core/src/observability/cost-tracker.ts` (459 lines)
- ✅ Created: `packages/core/src/observability/__tests__/cost-tracker.test.ts` (355 lines)
- ✅ Modified: `packages/core/src/observability/index.ts` (added CostTracker exports)
- ✅ Modified: `packages/core/tsconfig.json` (fixed test exclusions for build)

**Build Status:**
- ✅ TypeScript compilation successful
- ✅ No type errors
- ✅ Package builds cleanly

**Code Review & Fixes Applied:**
- **Adversarial code review completed** - Found and fixed 7 critical/medium issues:
  1. ✅ **FIXED**: Test mocking for FirestoreClient (all 6 failing tests now pass)
  2. ✅ **FIXED**: Rounding accumulation bug (costs now stored exact, rounded during aggregation)
  3. ✅ **FIXED**: Added pipelineId format and date validation
  4. ✅ **FIXED**: Improved service category mapping with explicit categorizeService() method
  5. ✅ **FIXED**: Service category mapping now recalculates from ALL stages (prevents accumulation errors)
  6. ✅ **FIXED**: Added comprehensive validation tests
  7. ✅ **FIXED**: Updated test expectations to match corrected behavior
- **Test Results**: 24/24 tests passing (100%)
- **Build Status**: ✅ Clean build with no TypeErrors

**Ready for Story 1.9: Quality Gate Framework**

### File List

- packages/core/src/observability/cost-tracker.ts
- packages/core/src/observability/__tests__/cost-tracker.test.ts
- packages/core/src/observability/index.ts
- packages/core/tsconfig.json

