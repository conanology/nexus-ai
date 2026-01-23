# Story 5.11: Implement Pre-Publish Quality Gate

Status: done

## Story

As an operator,
I want a final quality decision before publishing,
So that we never publish low-quality content and maintain the "never publish garbage" principle.

## Acceptance Criteria

1. **Given** a pipeline with all stages complete
   **When** I call `qualityGateCheck(pipelineRun)`
   **Then** it evaluates all stage quality metrics, fallback usage, degradation flags, and known issues
   **And** returns one of: `AUTO_PUBLISH`, `AUTO_PUBLISH_WITH_WARNING`, or `HUMAN_REVIEW`

2. **Given** no issues in the pipeline run
   **When** the quality gate evaluates the pipeline
   **Then** it returns `AUTO_PUBLISH`
   **And** the pipeline proceeds to YouTube upload

3. **Given** minor issues (<=2 issues, no TTS fallback)
   **When** the quality gate evaluates the pipeline
   **Then** it returns `AUTO_PUBLISH_WITH_WARNING`
   **And** warnings are logged and included in daily digest
   **And** the pipeline proceeds to YouTube upload

4. **Given** major quality compromises occur
   **When** the quality gate evaluates the pipeline
   **Then** it returns `HUMAN_REVIEW`
   **And** the pipeline pauses before YouTube stage
   **And** a review item is created with video preview

5. **Given** the following quality criteria must trigger `HUMAN_REVIEW`:
   - TTS fallback used (non-primary TTS provider)
   - >30% visual fallbacks used
   - Word count outside 1,200-1,800 range
   - >3 pronunciation unknowns unresolved
   - Thumbnail fallback + visual fallback combined

6. **Given** the following quality criteria should trigger `AUTO_PUBLISH_WITH_WARNING`:
   - Single minor issue (any non-critical issue)
   - Up to 2 minor issues combined

7. **Given** a quality decision is made
   **When** the decision is logged
   **Then** it is stored at `pipelines/{date}/quality-decision`
   **And** includes: decision, reasons[], metrics, timestamp

8. **Given** a `HUMAN_REVIEW` decision
   **When** the operator reviews the item
   **Then** they can approve (proceed to publish) or reject (use buffer video instead)

9. **Given** the pre-publish quality gate
   **Then** it is called by the orchestrator after all stages complete but before YouTube upload
   **And** unit tests verify all decision outcomes (PASS, WARN, FAIL scenarios)

10. **Given** integration with existing quality gates
    **Then** the pre-publish gate aggregates results from stage-specific quality gates
    **And** considers the entire qualityContext from the pipeline run

## Tasks / Subtasks

- [x] Task 1: Create pre-publish quality gate types (AC: 1, 7)
  - [x] Create `packages/core/src/quality/pre-publish-types.ts`
  - [x] Define `QualityDecision` enum: `AUTO_PUBLISH`, `AUTO_PUBLISH_WITH_WARNING`, `HUMAN_REVIEW`
  - [x] Define `QualityIssue` type with: code, severity (minor/major), stage, message
  - [x] Define `QualityDecisionResult` type with: decision, reasons[], issues[], metrics, timestamp
  - [x] Define `PipelineQualityContext` type aggregating all stage quality data
  - [x] Export types from `packages/core/src/quality/index.ts`

- [x] Task 2: Implement quality issue detection (AC: 5, 6)
  - [x] Create `packages/core/src/quality/pre-publish-gate.ts`
  - [x] Implement `detectTTSFallback(pipelineRun)` - checks if TTS tier is 'fallback'
  - [x] Implement `detectVisualFallbackRatio(pipelineRun)` - calculates % of fallback visuals
  - [x] Implement `detectWordCountIssues(pipelineRun)` - checks script-gen quality metrics
  - [x] Implement `detectPronunciationIssues(pipelineRun)` - checks unresolved unknown terms
  - [x] Implement `detectThumbnailIssues(pipelineRun)` - checks thumbnail fallback status
  - [x] Implement `detectCombinedIssues(pipelineRun)` - checks for problematic combinations
  - [x] Each detector returns `QualityIssue | null`

- [x] Task 3: Implement decision logic (AC: 2, 3, 4)
  - [x] Implement `qualityGateCheck(pipelineRun: PipelineRun): Promise<QualityDecisionResult>`
  - [x] Collect all issues from detectors
  - [x] Separate into major issues (HUMAN_REVIEW triggers) and minor issues
  - [x] Decision logic:
    - Any major issue → `HUMAN_REVIEW`
    - 1-2 minor issues, no major → `AUTO_PUBLISH_WITH_WARNING`
    - No issues → `AUTO_PUBLISH`
  - [x] Build comprehensive reasons array explaining decision
  - [x] Calculate aggregate metrics from all stages

- [x] Task 4: Implement decision persistence (AC: 7)
  - [x] Implement `persistQualityDecision(pipelineId, decision)` function
  - [x] Store to Firestore at `pipelines/{date}/quality-decision`
  - [x] Include: decision, reasons, issues, metrics, timestamp, stageQualitySummary
  - [x] Use structured logger for decision logging

- [x] Task 5: Implement human review integration (AC: 4, 8)
  - [x] Import from `@nexus-ai/core`: `addToReviewQueue`, `getReviewQueue`
  - [x] On `HUMAN_REVIEW` decision, create review item with:
    - type: 'quality'
    - pipelineId: current pipeline
    - stage: 'pre-publish'
    - item: { decision, issues, preview URLs }
    - context: full quality metrics
  - [x] Implement `handleReviewApproval(reviewId)` - proceeds to publish
  - [x] Implement `handleReviewRejection(reviewId)` - deploys buffer video instead
  - [x] Integration with orchestrator pause logic

- [x] Task 6: Integrate with orchestrator (AC: 9)
  - [x] Modify `apps/orchestrator/src/quality-gate.ts`
  - [x] Add quality gate check after render/thumbnail stages, before youtube stage
  - [x] On `AUTO_PUBLISH` → proceed to youtube stage
  - [x] On `AUTO_PUBLISH_WITH_WARNING` → log warnings, proceed to youtube stage
  - [x] On `HUMAN_REVIEW` → pause pipeline, create review item, notify operator
  - [x] Handle review approval/rejection callbacks

- [x] Task 7: Implement daily digest integration (AC: 3)
  - [x] Modify `packages/notifications/src/digest.ts`
  - [x] Include quality decision in digest content
  - [x] For `AUTO_PUBLISH_WITH_WARNING`, list warnings prominently
  - [x] For `HUMAN_REVIEW`, include pending review status

- [x] Task 8: Write unit tests (AC: 9, 10)
  - [x] Create `packages/core/src/quality/__tests__/pre-publish-gate.test.ts`
  - [x] Test `AUTO_PUBLISH` scenario (no issues)
  - [x] Test `AUTO_PUBLISH_WITH_WARNING` scenarios:
    - Single minor issue
    - Two minor issues (boundary test)
  - [x] Test `HUMAN_REVIEW` scenarios:
    - TTS fallback used
    - >30% visual fallbacks
    - Word count outside range
    - >3 pronunciation unknowns
    - Thumbnail + visual fallback combo
  - [x] Test edge cases (empty pipeline, missing data)
  - [x] Test decision persistence (persistQualityDecision, getQualityDecision)
  - [x] Test handleReviewRejection success path with buffer deployment
  - [x] Test 30% visual fallback boundary (exactly 30% vs 31%)
  - [x] Mock Firestore and review queue
  - [x] Target: ~28 tests (achieved 40 after code review)

- [x] Task 9: Write integration tests
  - [x] Create `apps/orchestrator/src/__tests__/quality-gate.new.test.ts`
  - [x] Test full flow: pipeline → quality gate → decision → action
  - [x] Test orchestrator integration points
  - [x] Test review queue creation for HUMAN_REVIEW

## Dev Notes

### Critical Architecture Patterns (MUST FOLLOW)

**From project-context.md - MANDATORY:**

1. **Package Naming**: This functionality goes in `@nexus-ai/core` package under `quality/` module
2. **File Naming**: kebab-case for all files (e.g., `pre-publish-gate.ts`, `pre-publish-types.ts`)
3. **Logger Naming**: `nexus.core.quality` or `nexus.core.quality.pre-publish`

**CRITICAL: Use Structured Logger, NOT console.log**
```typescript
// WRONG - will fail ESLint
console.log('Quality gate decision:', decision);

// CORRECT
import { logger } from '@nexus-ai/core';
logger.info('Quality gate decision', { pipelineId, decision, reasons });
```

### Quality Gate Decision Flow

```
Pipeline Stages Complete
         ↓
qualityGateCheck(pipelineRun)
         ↓
    ┌────┴────┐
    │ Detect  │
    │ Issues  │
    └────┬────┘
         ↓
    ┌────┴────────────────┐
    │ Categorize Issues   │
    │ (major vs minor)    │
    └────┬────────────────┘
         ↓
    ┌────┴────────────────────┐
    │ Any Major Issues?       │
    └────┬───────────┬────────┘
         │ YES       │ NO
         ↓           ↓
    HUMAN_REVIEW   ┌─┴───────────────┐
                   │ 1-2 Minor Issues?│
                   └─┬─────────┬─────┘
                     │ YES     │ NO
                     ↓         ↓
        AUTO_PUBLISH_    AUTO_PUBLISH
        WITH_WARNING
```

### Quality Issue Classification

**Major Issues (HUMAN_REVIEW triggers):**
```typescript
const MAJOR_ISSUES = {
  TTS_FALLBACK: 'tts-provider-fallback',      // Non-primary TTS used
  HIGH_VISUAL_FALLBACK: 'visual-fallback-30', // >30% fallback visuals
  WORD_COUNT_OOB: 'word-count-out-of-bounds', // <1200 or >1800 words
  PRONUNCIATION_UNRESOLVED: 'pronunciation-unknown-3+', // >3 unknowns
  COMBINED_FALLBACK: 'combined-fallback',     // Thumbnail + visual fallback
};
```

**Minor Issues (WARNING triggers):**
```typescript
const MINOR_ISSUES = {
  LOW_VISUAL_FALLBACK: 'visual-fallback-low',  // 1-30% fallback visuals
  WORD_COUNT_EDGE: 'word-count-edge',          // Within 5% of boundaries
  PRONUNCIATION_FEW: 'pronunciation-unknown-1-3', // 1-3 unknowns (handled)
  THUMBNAIL_FALLBACK_ONLY: 'thumbnail-fallback', // Thumbnail fallback alone
  TTS_RETRY_HIGH: 'tts-retry-high',            // TTS succeeded but >2 retries
};
```

### Pipeline Run Structure

The `qualityGateCheck` function receives the complete pipeline run context:

```typescript
interface PipelineRun {
  pipelineId: string;  // YYYY-MM-DD
  stages: Record<string, StageOutput<unknown>>;
  qualityContext: {
    degradedStages: string[];
    fallbacksUsed: string[];  // e.g., ['tts:chirp3-hd', 'thumbnail:template']
    flags: string[];
  };
}
```

### StageOutput Quality Data Access

Each stage's `StageOutput` contains quality metrics:

```typescript
// Script Gen Stage
stages['script-gen'].quality.wordCount  // number

// TTS Stage
stages['tts'].provider.tier             // 'primary' | 'fallback'
stages['tts'].provider.name             // e.g., 'chirp3-hd'
stages['tts'].provider.attempts         // number

// Visual Gen Stage
stages['visual-gen'].quality.fallbackCount  // number
stages['visual-gen'].quality.totalScenes    // number

// Pronunciation Stage
stages['pronunciation'].quality.unknownCount     // number
stages['pronunciation'].quality.unresolvedCount  // number

// Thumbnail Stage
stages['thumbnail'].provider.tier       // 'primary' | 'fallback'
stages['thumbnail'].quality.variantsGenerated  // number
```

### Firestore Decision Document

```typescript
// Stored at: pipelines/{date}/quality-decision
interface QualityDecisionDocument {
  decision: 'AUTO_PUBLISH' | 'AUTO_PUBLISH_WITH_WARNING' | 'HUMAN_REVIEW';
  reasons: string[];          // Human-readable reasons for decision
  issues: QualityIssue[];     // All detected issues
  metrics: {
    totalStages: number;
    degradedStages: number;
    fallbacksUsed: number;
    totalWarnings: number;
    scriptWordCount: number;
    visualFallbackPercent: number;
    pronunciationUnknowns: number;
    ttsProvider: string;
    thumbnailFallback: boolean;
  };
  timestamp: string;          // ISO 8601
  reviewItemId?: string;      // If HUMAN_REVIEW, the review queue item ID
}
```

### Review Queue Item for HUMAN_REVIEW

```typescript
// Created when decision is HUMAN_REVIEW
const reviewItem = {
  type: 'quality' as const,
  pipelineId: pipelineRun.pipelineId,
  stage: 'pre-publish',
  item: {
    decision: 'HUMAN_REVIEW',
    issues: majorIssues,
    previewUrls: {
      video: stages['render'].artifacts?.find(a => a.type === 'video')?.url,
      thumbnail: stages['thumbnail'].artifacts?.[0]?.url,
      script: stages['script-gen'].artifacts?.find(a => a.type === 'script')?.url,
    },
  },
  context: qualityDecisionResult,
  createdAt: new Date().toISOString(),
  status: 'pending' as const,
};
```

### Orchestrator Integration Point

```typescript
// In apps/orchestrator/src/pipeline.ts

async function executePipeline(pipelineId: string) {
  // ... execute all stages up to thumbnail ...

  // Pre-publish quality gate (after thumbnail, before youtube)
  const qualityDecision = await qualityGateCheck(pipelineRun);
  await persistQualityDecision(pipelineId, qualityDecision);

  switch (qualityDecision.decision) {
    case 'AUTO_PUBLISH':
      logger.info('Quality gate passed', { pipelineId, decision: 'AUTO_PUBLISH' });
      break;

    case 'AUTO_PUBLISH_WITH_WARNING':
      logger.warn('Quality gate passed with warnings', {
        pipelineId,
        decision: 'AUTO_PUBLISH_WITH_WARNING',
        warnings: qualityDecision.reasons,
      });
      // Add warnings to qualityContext for digest
      pipelineRun.qualityContext.flags.push(...qualityDecision.issues.map(i => i.code));
      break;

    case 'HUMAN_REVIEW':
      logger.info('Quality gate requires human review', {
        pipelineId,
        decision: 'HUMAN_REVIEW',
        issues: qualityDecision.issues,
      });
      // Create review item and pause
      const reviewItem = await createQualityReviewItem(pipelineId, qualityDecision);
      await sendDiscordAlert('HUMAN_REVIEW_REQUIRED', { pipelineId, issues: qualityDecision.issues });

      // Save pipeline state and wait for human action
      await savePipelineState(pipelineId, 'awaiting-review', { reviewItemId: reviewItem.id });
      return; // Do NOT proceed to YouTube
  }

  // Continue to YouTube stage
  await executeYouTube(pipelineRun);
  // ...
}
```

### Previous Story Intelligence (from 5.10)

**Key Patterns to Reuse:**
1. **Firestore client pattern** - Use `FirestoreClient` from `@nexus-ai/core`
2. **Review queue integration** - Use `addToReviewQueue`, `resolveReviewItem` from core
3. **Structured output** - Follow same formatting patterns for CLI visibility

**Files to Reference:**
- `packages/core/src/review/manager.ts` - Review queue operations
- `packages/core/src/quality/gates.ts` - Existing stage-specific quality gates
- `packages/core/src/buffer/manager.ts` - Buffer deployment for rejection path
- `apps/orchestrator/src/pipeline.ts` - Integration point

### Git Intelligence (from recent commits)

**Recent Implementation Patterns:**
1. Feature commits follow: `feat({packages}): {description} (Story X.Y)`
2. File structure: Single index.ts with re-exports, separate module files
3. Test location: `src/__tests__/*.test.ts` co-located with source
4. Imports use `.js` extension for ESM compatibility

**Example commit message:**
```
feat(core,orchestrator): implement pre-publish quality gate (Story 5.11)

Add comprehensive pre-publish quality gate that evaluates pipeline output
quality before YouTube upload. Implements NFR1-5 (Reliability) by ensuring
"never publish garbage" principle.

- Add quality decision types and detection logic
- Implement AUTO_PUBLISH, AUTO_PUBLISH_WITH_WARNING, HUMAN_REVIEW decisions
- Integrate with review queue for HUMAN_REVIEW cases
- Add orchestrator integration to pause before YouTube on quality issues
```

### Testing Strategy

**Unit Test Scenarios:**

```typescript
describe('qualityGateCheck', () => {
  describe('AUTO_PUBLISH', () => {
    it('returns AUTO_PUBLISH when no issues detected');
    it('returns AUTO_PUBLISH with empty reasons array');
  });

  describe('AUTO_PUBLISH_WITH_WARNING', () => {
    it('returns WARNING for single minor issue');
    it('returns WARNING for two minor issues');
    it('includes minor issues in reasons');
  });

  describe('HUMAN_REVIEW', () => {
    it('returns HUMAN_REVIEW when TTS fallback used');
    it('returns HUMAN_REVIEW when visual fallback > 30%');
    it('returns HUMAN_REVIEW when word count < 1200');
    it('returns HUMAN_REVIEW when word count > 1800');
    it('returns HUMAN_REVIEW when > 3 pronunciation unknowns');
    it('returns HUMAN_REVIEW when thumbnail + visual fallback combined');
    it('prioritizes major issues over minor issues');
    it('includes all major issues in reasons');
  });

  describe('edge cases', () => {
    it('handles missing stage data gracefully');
    it('handles empty qualityContext');
    it('handles undefined metrics');
  });
});
```

### Project Structure

**Files to Create:**
```
packages/core/src/quality/
├── pre-publish-types.ts           # Types for pre-publish gate
├── pre-publish-gate.ts            # Main quality gate implementation
├── issue-detectors.ts             # Individual issue detection functions
├── decision-persistence.ts        # Firestore persistence
└── __tests__/
    └── pre-publish-gate.test.ts   # Unit tests (~25-30 tests)
```

**Files to Modify:**
- `packages/core/src/quality/index.ts` - Export new types and functions
- `apps/orchestrator/src/pipeline.ts` - Add quality gate integration
- `packages/notifications/src/digest.ts` - Add quality decision to digest

### NFR Coverage

This story addresses:
- **NFR1**: System must publish video daily with 100% success rate - Quality gate prevents garbage publishing
- **NFR2**: Pipeline must complete with 5+ hours buffer - Quality gate doesn't add significant time
- **NFR3**: System must recover from single-stage failures - Quality gate enables graceful degradation decisions
- **NFR4**: Notification stage must execute regardless - HUMAN_REVIEW doesn't block notifications
- **NFR5**: System must maintain minimum 1 buffer video - Buffer used as fallback on rejection

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.11] - Story acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#NFR1-5] - Reliability requirements
- [Source: _bmad-output/planning-artifacts/architecture.md#Quality-Gate] - Quality gate architecture
- [Source: _bmad-output/project-context.md] - Critical rules and patterns
- [Source: packages/core/src/quality/gates.ts] - Existing quality gate implementations
- [Source: packages/core/src/review/manager.ts] - Review queue management
- [Source: packages/core/src/buffer/manager.ts] - Buffer video management
- [Source: apps/orchestrator/src/pipeline.ts] - Pipeline execution flow
- [Source: _bmad-output/implementation-artifacts/5-10-create-operator-cli.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - All tasks completed successfully without debugging issues.

### Completion Notes List

1. Created comprehensive pre-publish quality gate types in `packages/core/src/quality/pre-publish-types.ts`
2. Implemented all issue detection functions (TTS fallback, visual fallback ratio, word count, pronunciation, thumbnail, combined issues)
3. Implemented decision logic with proper categorization of major vs minor issues
4. Added Firestore persistence for quality decisions at `pipelines/{date}/quality-decision`
5. Integrated with human review queue for HUMAN_REVIEW decisions
6. Updated orchestrator's quality-gate.ts to use new core implementation
7. Added quality decision integration to daily digest
8. All 40 unit tests pass (core package) - 12 added during code review
9. All 26 orchestrator tests pass (9 new integration tests + 17 existing)
10. All 15 digest tests pass (3 new quality decision tests added during code review)

### File List

**Created:**
- `packages/core/src/quality/pre-publish-types.ts` - Quality gate types
- `packages/core/src/quality/pre-publish-gate.ts` - Quality gate implementation
- `packages/core/src/quality/__tests__/pre-publish-gate.test.ts` - Unit tests (28 tests)
- `apps/orchestrator/src/__tests__/quality-gate.new.test.ts` - Integration tests (9 tests)

**Modified:**
- `packages/core/src/quality/index.ts` - Added exports for new modules
- `apps/orchestrator/src/quality-gate.ts` - Updated to use core implementation
- `apps/orchestrator/src/__tests__/quality-gate.test.ts` - Updated to use legacyQualityGateCheck
- `apps/orchestrator/src/__tests__/quality-gate.review.test.ts` - Updated to use legacyQualityGateCheck
- `packages/notifications/src/digest.ts` - Added quality decision to digest alerts
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status

### Change Log

**2026-01-22:** Initial implementation complete
- Implemented comprehensive pre-publish quality gate with issue detection
- Added AUTO_PUBLISH, AUTO_PUBLISH_WITH_WARNING, HUMAN_REVIEW decision logic
- Integrated with review queue and buffer video fallback system
- Added daily digest integration for quality decision alerts
- All 54 tests pass (28 core unit tests + 26 orchestrator tests)

**2026-01-22:** Code review fixes (AI)
- Added 12 new unit tests for improved boundary coverage:
  - Boundary test for exactly 30% visual fallback (minor) vs 31% (major)
  - Test for exactly 2 minor issues → AUTO_PUBLISH_WITH_WARNING
  - Tests for persistQualityDecision Firestore integration
  - Tests for getQualityDecision retrieval
  - Tests for handleReviewRejection success path with buffer deployment
- Added 3 new digest integration tests for qualityDecision alerts
- Updated File List to include sprint-status.yaml
- All 66 tests pass (40 core unit tests + 26 orchestrator tests)

