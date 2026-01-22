# Story 5.9: Create Human Review Queue

Status: done

## Story

As an operator,
I want a human review queue for flagged items from pronunciation checking and quality gates,
So that quality issues get operator attention and can be resolved before publishing.

## Acceptance Criteria

1. **Given** a pronunciation check flags >3 unknown terms
   **When** the pronunciation stage completes
   **Then** a review item is created in Firestore at `review-queue/{id}`
   **And** the item includes: type='pronunciation', terms, script context, pipelineId

2. **Given** a script quality gate returns FAIL
   **When** the script-gen stage completes
   **Then** a review item is created with type='quality'
   **And** the item includes: failing metrics, script excerpt, failure reason

3. **Given** a topic matches controversial keywords
   **When** topic selection occurs
   **Then** a review item is created with type='controversial'
   **And** the item includes: matched keywords, topic title, source URL

4. **Given** a thumbnail quality check fails
   **When** the thumbnail stage completes
   **Then** a review item is created with type='quality'
   **And** the item includes: which variants failed, failure reasons

5. **Given** any review item is created
   **Then** it includes: id, type, pipelineId, stage, item, context, createdAt, status='pending', resolution=null, resolvedAt=null, resolvedBy=null

6. **Given** the operator resolves a review item
   **When** calling `resolveReviewItem(id, resolution, resolvedBy)`
   **Then** status is updated to 'resolved'
   **And** resolution and resolvedAt are set
   **And** resolvedBy identifies the operator

7. **Given** the operator dismisses a review item
   **When** calling `dismissReviewItem(id, reason, resolvedBy)`
   **Then** status is updated to 'dismissed'
   **And** the dismiss reason is recorded

8. **Given** topic management per FR41
   **When** operator views a review item with type='controversial' or type='topic'
   **Then** operator can: skip topic (don't cover), re-queue topic for tomorrow, approve topic with modifications

9. **Given** the operator CLI
   **When** running `nexus review list`, `nexus review resolve {id}`, `nexus review dismiss {id}`
   **Then** the commands interact correctly with the review queue

10. **Given** pending review items exist
    **When** the pre-publish quality gate runs
    **Then** items with type='pronunciation' or type='quality' trigger HUMAN_REVIEW decision
    **And** the pipeline pauses before YouTube upload stage

## Tasks / Subtasks

- [x] Task 1: Create review queue types (AC: 5)
  - [x] Create `packages/core/src/review/types.ts` with:
    - `ReviewItemType`: 'pronunciation' | 'quality' | 'controversial' | 'topic' | 'other'
    - `ReviewItemStatus`: 'pending' | 'resolved' | 'dismissed'
    - `ReviewItem` interface with all required fields
    - `ReviewResolution` interface for resolution details
  - [x] Add review error codes to `packages/core/src/errors/codes.ts`:
    - NEXUS_REVIEW_ITEM_NOT_FOUND
    - NEXUS_REVIEW_ITEM_ALREADY_RESOLVED
    - NEXUS_REVIEW_ITEM_SAVE_FAILED
    - NEXUS_REVIEW_QUEUE_QUERY_FAILED

- [x] Task 2: Create review queue manager (AC: 5, 6, 7)
  - [x] Create `packages/core/src/review/index.ts` with public exports
  - [x] Create `packages/core/src/review/manager.ts` with:
    - `addToReviewQueue(item: Omit<ReviewItem, 'id' | 'createdAt' | 'status'>): Promise<string>`
    - `getReviewQueue(filters?: { status?: ReviewItemStatus, type?: ReviewItemType }): Promise<ReviewItem[]>`
    - `getReviewItem(id: string): Promise<ReviewItem | null>`
    - `resolveReviewItem(id: string, resolution: string, resolvedBy: string): Promise<void>`
    - `dismissReviewItem(id: string, reason: string, resolvedBy: string): Promise<void>`
    - `getPendingReviewCount(): Promise<number>`
    - `hasPendingCriticalReviews(): Promise<boolean>` - checks for pronunciation/quality items
  - [x] Use lazy Firestore initialization pattern (from Story 5.7/5.8)

- [x] Task 3: Add path helpers and exports (AC: 5)
  - [x] Add `getReviewItemPath(id)` to `packages/core/src/storage/paths.ts` (already existed)
  - [x] Add REVIEW_QUEUE_COLLECTION constant
  - [x] Export review module from `packages/core/src/index.ts`

- [x] Task 4: Create pronunciation review integration (AC: 1)
  - [x] Update `packages/pronunciation/src/pronunciation-stage.ts`
  - [x] After checking pronunciations, if unknown.length > 3:
    - Call `addToReviewQueue()` with type='pronunciation'
    - Include: unknown terms array, script context around each term
  - [x] Add `PRONUNCIATION_UNKNOWN_THRESHOLD = 3` constant
  - [x] Flag stage output with `requiresReview: true` for orchestrator

- [x] Task 5: Create script quality gate integration (AC: 2)
  - [x] Update script-gen quality gate in `packages/core/src/quality/gates.ts`
  - [x] On FAIL status, call `addToReviewQueue()` with type='quality'
  - [x] Include: word count, expected range, script excerpt
  - [x] Set `requiresReview: true` in gate result metrics

- [x] Task 6: Implement controversial topic detection (AC: 3)
  - [x] Create `packages/news-sourcing/src/controversial.ts`
  - [x] Implement `checkControversialTopics(topic: NewsItem): ControversialResult`
  - [x] Define keyword list for flagging:
    - Political: elections, policy, government, legislation
    - Sensitive: ethics, bias, discrimination, controversial
    - High-risk: security vulnerability, data breach, lawsuit
  - [x] Add `checkAndFlagControversialTopic()` for topic selection flow
  - [x] On match, create review item with type='controversial'

- [x] Task 7: Integrate thumbnail quality gate (AC: 4)
  - [x] Update thumbnail quality gate in `packages/core/src/quality/gates.ts`
  - [x] On FAIL (less than 3 variants), create review item
  - [x] Include: which variants were generated, failure reasons

- [x] Task 8: Update pre-publish quality gate (AC: 10)
  - [x] Update `apps/orchestrator/src/quality-gate.ts`
  - [x] Call `hasPendingCriticalReviews()` in `qualityGateCheck()`
  - [x] If pending critical reviews exist:
    - Return `HUMAN_REVIEW` decision
    - Include review item IDs in response
    - Set `pauseBeforeStage: 'youtube'`

- [x] Task 9: Topic management functions (AC: 8)
  - [x] Add to review manager:
    - `skipTopic(reviewId: string, resolvedBy: string): Promise<void>`
    - `requeueTopicFromReview(reviewId: string, newDate: string, resolvedBy: string): Promise<void>`
    - `approveTopicWithModifications(reviewId: string, modifications: string, resolvedBy: string): Promise<void>`

- [x] Task 10: Operator CLI integration (AC: 9) - DEFERRED TO STORY 5.10
  - Note: operator-cli app does not exist yet. Story 5.10 will create the CLI.
  - All manager functions are ready for CLI integration.

- [x] Task 11: Write comprehensive tests
  - [x] `packages/core/src/review/__tests__/manager.test.ts` (35 tests)
    - Add item, retrieve item, list queue
    - Filter by status and type
    - Resolve and dismiss flows
    - Pending count and critical check
    - Topic management functions
  - [x] `packages/pronunciation/src/__tests__/review-integration.test.ts` (6 tests)
    - Flagging when >3 unknown terms
    - No flag when <=3 unknown terms
    - Review item content and context verification
  - [x] `apps/orchestrator/src/__tests__/quality-gate.review.test.ts` (9 tests)
    - Pre-publish gate with pending reviews
    - HUMAN_REVIEW decision flow

## Dev Notes

### Critical Architecture Patterns (MUST FOLLOW)

**From project-context.md - MANDATORY:**

1. **Firestore Path**: `review-queue/{id}` - use UUID for document ID
   - Document structure must include all fields from AC 5
   - Query by status and type must be efficient (add indexes)

2. **Error Handling Pattern**:
```typescript
try {
  // Firestore operation
} catch (error) {
  logger.error({ error }, 'Failed to add review item');
  throw NexusError.critical(
    'NEXUS_REVIEW_ITEM_SAVE_FAILED',
    `Failed to save review item: ${error.message}`,
    'review'
  );
}
```

3. **Logger Naming Convention**: `nexus.core.review.{module}` (e.g., `nexus.core.review.manager`)

4. **Lazy Firestore Initialization** (from Story 5.7/5.8):
```typescript
let firestoreClient: FirestoreClient | null = null;

function getFirestoreClient(): FirestoreClient {
  if (!firestoreClient) {
    firestoreClient = new FirestoreClient();
  }
  return firestoreClient;
}
```

### ReviewItem Document Structure

**Firestore Path:** `review-queue/{id}`

```typescript
interface ReviewItem {
  id: string;                    // UUID
  type: ReviewItemType;          // 'pronunciation' | 'quality' | 'controversial' | 'topic' | 'other'
  pipelineId: string;            // YYYY-MM-DD
  stage: string;                 // Stage that created the item
  item: unknown;                 // The flagged content (terms, script, topic, etc.)
  context: Record<string, unknown>; // Additional context
  createdAt: string;             // ISO 8601 UTC
  status: ReviewItemStatus;      // 'pending' | 'resolved' | 'dismissed'
  resolution: string | null;     // How it was resolved
  resolvedAt: string | null;     // ISO 8601 UTC when resolved
  resolvedBy: string | null;     // Operator identifier
}
```

### Type-Specific Item Content

**Pronunciation Items:**
```typescript
{
  type: 'pronunciation',
  item: {
    unknownTerms: string[];      // Terms not in dictionary
    totalTerms: number;          // Total terms extracted
    knownTerms: number;          // Terms found in dictionary
  },
  context: {
    scriptExcerpt: string;       // Script section with terms
    termLocations: Array<{       // Where each term appears
      term: string;
      lineNumber: number;
      surroundingText: string;
    }>;
  }
}
```

**Quality Items (Script):**
```typescript
{
  type: 'quality',
  item: {
    wordCount: number;
    expectedMin: 1200;
    expectedMax: 1800;
    failureReason: string;
  },
  context: {
    scriptExcerpt: string;       // First 500 chars
    optimizerAttempts: number;   // How many rewrites attempted
  }
}
```

**Controversial Items:**
```typescript
{
  type: 'controversial',
  item: {
    topic: NewsItem;             // Full topic object
    matchedKeywords: string[];   // Keywords that triggered flag
    category: string;            // 'political' | 'sensitive' | 'high-risk'
  },
  context: {
    sourceUrl: string;
    sourceType: string;
    freshnessScore: number;
  }
}
```

### Integration Points

**1. Pronunciation Stage Integration:**
```typescript
// In packages/pronunciation/src/pronunciation.ts
import { addToReviewQueue } from '@nexus-ai/core';

const { known, unknown } = await checkPronunciations(terms);

if (unknown.length > PRONUNCIATION_UNKNOWN_THRESHOLD) {
  await addToReviewQueue({
    type: 'pronunciation',
    pipelineId: input.pipelineId,
    stage: 'pronunciation',
    item: { unknownTerms: unknown, totalTerms: terms.length, knownTerms: known.length },
    context: { /* term locations */ }
  });
  // Continue but flag output
  output.warnings.push('Pronunciation review required');
}
```

**2. Pre-Publish Quality Gate:**
```typescript
// In apps/orchestrator/src/quality-gate.ts
import { hasPendingCriticalReviews, getReviewQueue } from '@nexus-ai/core';

async function qualityGateCheck(pipelineRun: PipelineRun): Promise<QualityDecision> {
  // Existing checks...

  // Check for pending reviews
  if (await hasPendingCriticalReviews()) {
    const pending = await getReviewQueue({ status: 'pending' });
    const critical = pending.filter(r =>
      r.type === 'pronunciation' || r.type === 'quality'
    );

    return {
      decision: 'HUMAN_REVIEW',
      reasons: [`${critical.length} pending review items require attention`],
      reviewItemIds: critical.map(r => r.id),
      pauseBeforeStage: 'youtube'
    };
  }

  // Continue with other checks...
}
```

### Controversial Topic Keywords

**Political (proceed with caution):**
- election, vote, voting, ballot, candidate, campaign
- policy, legislation, bill, congress, senate, parliament
- president, minister, government, administration

**Sensitive (review recommended):**
- bias, discrimination, prejudice, racism, sexism
- ethics, ethical, unethical, controversial
- privacy, surveillance, tracking, monitoring
- misinformation, fake news, propaganda

**High-Risk (always review):**
- security vulnerability, CVE, exploit, breach
- data leak, exposed, hack, hacked
- lawsuit, litigation, sue, sued, legal action

### CLI Commands Reference

```bash
# List all pending review items
nexus review list
# Output:
# ID                                   TYPE           CREATED       STAGE
# 550e8400-e29b-41d4-a716-446655440000 pronunciation  5 min ago     pronunciation
# 550e8400-e29b-41d4-a716-446655440001 controversial  12 min ago    news-sourcing

# Show details of a review item
nexus review show 550e8400-e29b-41d4-a716-446655440000
# Output: Full item details with context

# Resolve a review item
nexus review resolve 550e8400-e29b-41d4-a716-446655440000
# Prompts for resolution text

# Dismiss a review item
nexus review dismiss 550e8400-e29b-41d4-a716-446655440001 --reason "False positive"

# Filter by type
nexus review list --type pronunciation

# Filter by status
nexus review list --status resolved
```

### Previous Story Intelligence (from 5.8)

**Key Patterns to Reuse:**
1. **Queue manager structure** - Review manager should mirror queue manager pattern
2. **Lazy Firestore init** - Same singleton pattern
3. **Test structure** - ~20 unit tests with vi.mock for Firestore
4. **Status field handling** - Ensure status is required, not optional

**Files to Reference:**
- `packages/core/src/queue/manager.ts` - Pattern for CRUD operations
- `packages/core/src/queue/__tests__/manager.test.ts` - Test structure
- `packages/core/src/buffer/types.ts` - Type patterns

### Project Structure Notes

**New Files to Create:**
```
packages/core/src/review/
├── index.ts           # Public exports
├── types.ts           # ReviewItem, ReviewItemType, etc.
├── manager.ts         # Review queue CRUD operations
└── __tests__/
    └── manager.test.ts

packages/news-sourcing/src/
└── controversial.ts   # Keyword detection

apps/operator-cli/src/commands/
└── review.ts          # CLI commands
```

**Files to Modify:**
- `packages/core/src/index.ts` - Re-export review module
- `packages/core/src/errors/codes.ts` - Add review error codes
- `packages/core/src/storage/paths.ts` - Add review path helper
- `packages/pronunciation/src/pronunciation.ts` - Add review integration
- `packages/core/src/quality/gates.ts` - Add review item creation
- `apps/orchestrator/src/quality-gate.ts` - Check pending reviews

### Testing Pattern

**Mock Setup (from Story 5.8):**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSetDocument = vi.fn();
const mockGetDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockDeleteDocument = vi.fn();

const mockFirestoreClient = {
  setDocument: mockSetDocument,
  getDocument: mockGetDocument,
  queryDocuments: mockQueryDocuments,
  deleteDocument: mockDeleteDocument,
};

vi.mock('../../storage/firestore-client.js', () => ({
  FirestoreClient: vi.fn(() => mockFirestoreClient),
}));
```

**Test Categories:**
1. CRUD operations (add, get, list, resolve, dismiss)
2. Filtering (by status, type)
3. Topic management (skip, requeue, approve)
4. Error handling (not found, already resolved)
5. Integration (pronunciation flagging, quality gate)

### Firestore Indexes Required

The review queue requires composite indexes for efficient filtering. Add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "review-queue",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "review-queue",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "pipelineId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "review-queue",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Deploy with: `firebase deploy --only firestore:indexes`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.9] - Story acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR40-FR41] - Human review queue requirements
- [Source: _bmad-output/planning-artifacts/architecture.md#Quality-Gates] - Quality gate patterns
- [Source: _bmad-output/project-context.md] - Critical rules and patterns
- [Source: packages/core/src/queue/manager.ts] - Pattern for queue manager
- [Source: packages/core/src/queue/__tests__/manager.test.ts] - Test structure pattern
- [Source: _bmad-output/implementation-artifacts/5-8-implement-skip-and-recovery.md] - Previous story patterns

## Senior Developer Review (AI)

**Reviewed:** 2026-01-22
**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)

### Issues Found and Fixed

| Severity | Issue | Resolution |
|----------|-------|------------|
| CRITICAL | Pronunciation integration tests failed (vi.mock hoisting) | Fixed mock declaration to use inline function instead of external variable |
| CRITICAL | Manager test "no filters" case failed (mock mismatch) | Fixed `getReviewQueue` to pass `undefined` instead of 3 separate queries |
| MEDIUM | Inefficient `getReviewQueue` with 3 queries | Simplified to single query with optional filters |
| MEDIUM | `sprint-status.yaml` not in File List | Added to documentation |
| MEDIUM | Missing Firestore indexes documentation | Added index definitions to Dev Notes |
| LOW | Duplicate `GateContext` type | Removed, using `QualityGateContext` from types.ts |
| LOW | Test count mismatch (49 vs 50) | Updated documentation to reflect 50 tests |

### Verification

All 50 tests passing:
- `packages/core/src/review/__tests__/manager.test.ts` - 35 tests ✓
- `packages/pronunciation/src/__tests__/review-integration.test.ts` - 6 tests ✓
- `apps/orchestrator/src/__tests__/quality-gate.review.test.ts` - 9 tests ✓

### Outcome

**APPROVED** - All critical and medium issues fixed, tests passing.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Review Queue Core Implementation** - Created comprehensive review queue system in `@nexus-ai/core` with types, manager, and exports. Follows Story 5.7/5.8 patterns for lazy Firestore initialization.

2. **Pronunciation Integration** - Updated pronunciation stage to flag >3 unknown terms for review. Creates consolidated review item with all unknown terms and their locations.

3. **Quality Gate Integration** - Both script-gen and thumbnail quality gates now create review items on FAIL status with appropriate context.

4. **Controversial Topic Detection** - New module in news-sourcing package with political, sensitive, and high-risk keyword detection. Creates review items for matched topics.

5. **Pre-Publish Quality Gate** - Updated orchestrator quality gate to check for pending critical reviews and return HUMAN_REVIEW decision with review item IDs.

6. **Topic Management** - Added skipTopic, requeueTopicFromReview, and approveTopicWithModifications functions for operator topic handling.

7. **CLI Deferred** - Operator CLI integration deferred to Story 5.10 as the operator-cli app does not exist yet.

8. **Test Coverage** - 50 tests total: 35 for review manager, 6 for pronunciation integration, 9 for quality gate review integration.

### File List

**New Files Created:**
- `packages/core/src/review/types.ts` - Review queue types and constants
- `packages/core/src/review/manager.ts` - Review queue CRUD operations
- `packages/core/src/review/index.ts` - Public exports
- `packages/core/src/review/__tests__/manager.test.ts` - 35 unit tests
- `packages/news-sourcing/src/controversial.ts` - Controversial topic detection
- `packages/pronunciation/src/__tests__/review-integration.test.ts` - 5 integration tests
- `apps/orchestrator/src/__tests__/quality-gate.review.test.ts` - 9 integration tests

**Modified Files:**
- `packages/core/src/index.ts` - Added review module export
- `packages/core/src/errors/codes.ts` - Added review error codes
- `packages/core/src/quality/gates.ts` - Added review item creation on FAIL, uses QualityGateContext for pipelineId
- `packages/core/src/quality/types.ts` - Added QualityGateContext interface
- `packages/pronunciation/src/pronunciation-stage.ts` - Added review queue integration
- `packages/news-sourcing/src/index.ts` - Added controversial module export
- `apps/orchestrator/src/quality-gate.ts` - Added pending review check, made function async
- `apps/orchestrator/src/__tests__/quality-gate.test.ts` - Updated for async quality gate
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status
