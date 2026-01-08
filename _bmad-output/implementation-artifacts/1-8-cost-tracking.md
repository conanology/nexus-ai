# Story 1.8: Implement Cost Tracking

Status: done

## Story

As a developer,
I want to track API costs per stage and per video,
So that I can monitor spending and stay within budget.

## Acceptance Criteria

1. **Given** structured logging from Story 1.7
   **When** I implement `CostTracker` class
   **Then** constructor accepts `pipelineId` and `stageName`

2. **And** `recordApiCall(service, tokens, cost)` adds cost entry with timestamp

3. **And** `getSummary()` returns `CostBreakdown` with:
   - Total cost for the stage
   - Breakdown by service
   - Token counts where applicable

4. **And** `persist()` saves costs to Firestore at `pipelines/{pipelineId}/costs`

5. **And** costs are tracked in dollars with 4 decimal precision

6. **And** static method `CostTracker.getVideoCost(pipelineId)` retrieves total video cost

7. **And** static method `CostTracker.getDailyCosts(date)` retrieves all costs for date

8. **And** cost tracking integrates with provider abstraction (providers call tracker)

9. **And** NFR10 (<$0.50/video) and NFR11 (<$1.50/video) can be verified via costs

## Tasks / Subtasks

- [x] Task 1: Create CostTracker class (AC: #1, #2)
  - [x] Constructor with pipelineId and stageName
  - [x] recordApiCall method with service, tokens, cost
  - [x] Track timestamp for each entry
  - [x] Store entries in memory during stage execution

- [x] Task 2: Implement cost summary (AC: #3, #5)
  - [x] getSummary() returns CostBreakdown
  - [x] Calculate total cost across all entries
  - [x] Group costs by service
  - [x] Sum tokens by service
  - [x] Use 4 decimal precision for dollar amounts

- [x] Task 3: Implement persistence (AC: #4)
  - [x] persist() saves to Firestore
  - [x] Store at pipelines/{pipelineId}/costs
  - [x] Include stage breakdown

- [x] Task 4: Add static query methods (AC: #6, #7)
  - [x] getVideoCost(pipelineId) for total video cost
  - [x] getDailyCosts(date) for all costs on date
  - [x] Query from Firestore

- [x] Task 5: Add budget validation (AC: #9)
  - [x] Add checkBudget() method
  - [x] Warn if cost > $0.50 (NFR10)
  - [x] Alert if cost > $1.50 (NFR11)

## Dev Notes

### CostBreakdown Structure

```typescript
interface CostBreakdown {
  totalCost: number;
  byService: Record<string, { cost: number; tokens?: number }>;
  byStage: Record<string, number>;
  entries: CostEntry[];
}
```

### Cost Precision

- All costs stored as dollars with 4 decimal precision
- Example: $0.0023 for 1000 tokens

### Budget Thresholds (from NFRs)

| Phase | Max Cost/Video | Action |
|-------|---------------|--------|
| Credit Period | $0.50 | Warning |
| Post-Credit | $1.50 | Alert |

### Firestore Structure

```
pipelines/{YYYY-MM-DD}/costs
├── stages: { news: 0.01, script: 0.05, tts: 0.10, ... }
├── total: 0.25
├── entries: [...]
└── timestamp: "2026-01-08T..."
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented CostTracker class with pipelineId and stageName
- Added recordApiCall with service, tokens, cost tracking
- Implemented getSummary with total, byService, byStage breakdown
- Added persist() to save to Firestore
- Created static getVideoCost and getDailyCosts queries
- Added budget validation with NFR thresholds
- All costs use 4 decimal precision

### File List

**Created/Modified:**
- `nexus-ai/packages/core/src/cost/tracker.ts` - CostTracker class
- `nexus-ai/packages/core/src/cost/index.ts` - Exports

### Dependencies

- **Upstream Dependencies:** Story 1.6 (Firestore), Story 1.7 (Logging)
- **Downstream Dependencies:** Story 1.10 (executeStage), all provider calls
