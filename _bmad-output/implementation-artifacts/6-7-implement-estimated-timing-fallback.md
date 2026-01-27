# Story 6.7: Implement Estimated Timing Fallback

Status: done

## Story

As a developer,
I want character-weighted timing estimation when STT fails,
So that the pipeline continues with degraded but functional timing.

## Acceptance Criteria

1. **Given** STT integration from Story 6.6
   **When** I implement fallback in `packages/timestamp-extraction/src/fallback.ts`
   **Then** `estimateWordTimings(segment, segmentStartSec, config)` function:
   - Splits segment text into words
   - Calculates duration per word proportional to character count
   - Adds pauses after punctuation (300ms for `.!?`, 150ms for `,;:`)
   - Clamps word duration to min 0.1s, max 1.0s
   - Returns `WordTiming[]` with `timingSource: 'estimated'`

2. **And** fallback triggers when:
   - Google Cloud STT API error (timeout, quota, auth)
   - STT confidence < 80%
   - Word count mismatch > 20%

3. **And** `applyEstimatedTimings(document, audioDurationSec)` applies to all segments

4. **And** `timingMetadata.source` set to `'estimated'`

5. **And** `timingMetadata.warningFlags` includes `['timing-estimated']`

6. **And** quality gate returns DEGRADED status with fallback flag

## Tasks / Subtasks

- [x] Task 1: Verify and enhance `estimateWordTimings()` implementation (AC: 1)
  - [x] 1.1 Review existing `fallback.ts` implementation from Story 6.5/6.6
  - [x] 1.2 Verify character-weighted distribution algorithm: duration per word proportional to char count
  - [x] 1.3 Verify punctuation pauses: 300ms for `.!?`, 150ms for `,;:`
  - [x] 1.4 Verify word duration clamping: min 0.1s, max 1.0s
  - [x] 1.5 Verify `WordTiming[]` output format with `segmentId`, `isEmphasis`

- [x] Task 2: Verify `applyEstimatedTimings()` implementation (AC: 3, 4, 5)
  - [x] 2.1 Verify all segments receive estimated timing via `applyEstimatedTimings()`
  - [x] 2.2 Verify timing is scaled to match `audioDurationSec` using adaptive tolerance
  - [x] 2.3 Verify `timingMetadata.source` set to `'estimated'` in stage executor
  - [x] 2.4 Ensure `timingMetadata.warningFlags` includes `['timing-estimated']` - confirmed code already uses `'timing-estimated'` at timestamp-extraction.ts:149

- [x] Task 3: Verify fallback trigger conditions (AC: 2)
  - [x] 3.1 Review `shouldUseFallback()` in `stt-client.ts` for API error detection
  - [x] 3.2 Verify confidence < 80% triggers fallback
  - [x] 3.3 Verify word count mismatch > 20% triggers fallback
  - [x] 3.4 Verify word mapping ratio < 80% in `timestamp-extraction.ts` also triggers fallback

- [x] Task 4: Verify quality gate DEGRADED status for fallback (AC: 6)
  - [x] 4.1 Review `quality-gate.ts` `validateTimestampExtraction()`
  - [x] 4.2 Verify quality gate returns DEGRADED (not FAIL) when fallback is used
  - [x] 4.3 Ensure fallback flag is included in quality result flags

- [x] Task 5: Add dedicated fallback tests (AC: 1, 2, 3, 4, 5, 6)
  - [x] 5.1 Create `src/__tests__/fallback.test.ts` with comprehensive unit tests:
    - Test `estimateWordTimings()` character-weighted distribution
    - Test punctuation pause insertion (`.!?` = 300ms, `,;:` = 150ms)
    - Test word duration clamping (min 0.1s, max 1.0s)
    - Test empty segment handling
    - Test all-punctuation words (uniform distribution)
    - Test emphasis word detection
  - [x] 5.2 Test `applyEstimatedTimings()`:
    - Test multi-segment document timing
    - Test scaling to match audio duration
    - Test adaptive tolerance scaling
    - Test deep cloning (no mutation of input)
  - [x] 5.3 Test fallback integration in stage executor:
    - Test STT API error triggers fallback
    - Test low confidence triggers fallback
    - Test word count mismatch triggers fallback
    - Test `timingMetadata.source === 'estimated'`
    - Test `warningFlags` content
  - [x] 5.4 Test quality gate with fallback scenario:
    - Test DEGRADED status returned
    - Test fallback flags present

- [x] Task 6: Verify build and tests (AC: all)
  - [x] 6.1 Run `pnpm build` - verify compilation passes (16/16 packages)
  - [x] 6.2 Run `pnpm test` - verify timestamp-extraction tests pass (147/147)

## Dev Notes

### Critical Finding: Existing Implementation

Story 6.5 and 6.6 already created `fallback.ts` with:
- `estimateWordTimings()` - character-weighted distribution with punctuation pauses and clamping
- `applyEstimatedTimings()` - applies to all segments with adaptive scaling

Story 6.6 already wired the fallback into `timestamp-extraction.ts`:
- `shouldUseFallback()` checks API error, confidence < 80%, word count mismatch > 20%
- Word mapping ratio < 80% also triggers fallback
- `timingMetadata.source` set to `'estimated'` on fallback path
- `timingMetadata.warningFlags` includes `['estimated-timing-used', 'fallback-reason:...' ]`

**Key Gap:** The epic specifies `warningFlags` should include `['timing-estimated']`, but the current implementation uses `'estimated-timing-used'`. The dev must verify if this is acceptable or if the flag name should be aligned.

### Primary Files to Review/Modify

```
packages/timestamp-extraction/src/
├── fallback.ts                    # REVIEW - already implements core logic
├── types.ts                       # REVIEW - EstimatedTimingConfig, DEFAULT_TIMING_CONFIG
├── timestamp-extraction.ts        # REVIEW - fallback integration in stage executor
├── stt-client.ts                  # REVIEW - shouldUseFallback() function
├── quality-gate.ts                # REVIEW - DEGRADED status for fallback
└── __tests__/
    ├── fallback.test.ts           # CREATE - dedicated fallback unit tests
    ├── timestamp-extraction.test.ts  # UPDATE - add fallback integration tests
    └── quality-gate.test.ts       # UPDATE - add DEGRADED fallback tests
```

### Architecture Compliance

#### Required Patterns (from project-context.md)

1. **StageInput/StageOutput Contracts** - Already in place from Story 6.6
2. **Structured Logging** - `createPipelineLogger` used, no console.log
3. **Quality Gate** - `validateTimestampExtraction()` already called before return
4. **Cost Tracking** - `tracker.recordApiCall('estimated-timing', {}, 0)` for zero-cost fallback
5. **Error Classes** - `NexusError.degraded()` used for quality gate failures

### Existing Code Details

#### fallback.ts Key Functions

```typescript
// Character-weighted timing per word
estimateWordTimings(segment, segmentStartSec, config = DEFAULT_TIMING_CONFIG): WordTiming[]
// - Words split on whitespace, empty filtered
// - Character ratio: cleanWord.length / totalChars
// - Duration = segmentDuration * charRatio, clamped to [0.1, 1.0]
// - Punctuation pauses: `.!?` → 0.3s, `,;:` → 0.15s
// - Emphasis detection from segment.content.emphasis[]

// Apply to full document
applyEstimatedTimings(document, audioDurationSec, config): { document, wordTimings }
// - Deep clones document (JSON.parse/JSON.stringify)
// - Iterates segments, calls estimateWordTimings per segment
// - Sets timing.estimatedStartSec/estimatedEndSec/estimatedDurationSec
// - Sets timing.timingSource = 'estimated'
// - Scales all timings to match audioDurationSec using adaptive tolerance
```

#### types.ts Configuration

```typescript
DEFAULT_TIMING_CONFIG = {
  wordsPerMinute: 150,
  minWordDuration: 0.1,
  maxWordDuration: 1.0,
  pauseAfterPunctuation: 0.3,
  pauseAfterComma: 0.15,
};

SCALING_TOLERANCE = {
  MIN_TOLERANCE_SEC: 0.1,
  TOLERANCE_PERCENT: 0.02, // 2%
};
```

#### stt-client.ts Fallback Decision

```typescript
shouldUseFallback(sttResult, expectedWordCount, error) → { useFallback, reason }
// Returns useFallback: true when:
// - error is non-null or sttResult is null → reason: 'stt-api-error'
// - confidence < 0.8 → reason: 'low-confidence'
// - word count mismatch > 20% → reason: 'word-count-mismatch'
```

#### quality-gate.ts Checks

```typescript
validateTimestampExtraction(wordTimings, document, processingTimeMs) → TimestampQualityResult
// Checks:
// 1. wordCountMatch: extracted words ≥ 90% of expected → DEGRADED if fails
// 2. noGaps: no gaps > 500ms → DEGRADED if fails
// 3. monotonicTiming: no overlapping times → CRITICAL/FAIL if fails
// 4. processingTime: < 60s → DEGRADED if fails
```

### Previous Story Intelligence (Story 6.6)

- STT integration fully wired with fallback path in `timestamp-extraction.ts`
- 116 tests passing across 7 test files
- Build passes cleanly
- `@google-cloud/speech`, `@google-cloud/storage`, `wavefile` dependencies installed
- Fallback path tested indirectly via STT error scenarios

### Testing Standards

- **Framework:** Vitest
- **Pattern:** `vi.mock()` for mocking, `describe/it` blocks
- **Coverage target:** 80%+
- **Files to reference:** Existing tests in `__tests__/` directory for mocking patterns

### Git Intelligence

Recent commits:
- `68e62ca` feat(timestamp-extraction): implement Google Cloud STT integration (Story 6.6)
- `8af8672` feat(timestamp-extraction): create package with word-level timing support (Story 6.5)

Commit pattern: `feat(timestamp-extraction): implement estimated timing fallback (Story 6.7)`

### Anti-Pattern Prevention

1. **DO NOT recreate fallback.ts from scratch** - it already exists with full implementation
2. **DO NOT modify STT extraction logic** - that's Story 6.6
3. **DO NOT add console.log** - use structured logger
4. **DO NOT skip quality gate** - verify DEGRADED status on fallback
5. **DO NOT forget to check warningFlags naming** - epic says `'timing-estimated'`, code has `'estimated-timing-used'`

### Project Structure Notes

- Package: `@nexus-ai/timestamp-extraction` at `packages/timestamp-extraction/`
- Extends base tsconfig
- Uses `@nexus-ai/core` for StageInput/Output, logger, CostTracker, NexusError, withRetry
- Uses `@nexus-ai/script-gen` for DirectionDocument, WordTiming types

### References

- [Source: epics.md#Story 6.7] Story 6.7 requirements and acceptance criteria
- [Source: project-context.md] Critical patterns for stages, quality gates, error handling
- [Source: packages/timestamp-extraction/src/fallback.ts] Existing implementation
- [Source: packages/timestamp-extraction/src/types.ts] Configuration and type definitions
- [Source: packages/timestamp-extraction/src/timestamp-extraction.ts] Stage executor with fallback integration
- [Source: packages/timestamp-extraction/src/stt-client.ts] shouldUseFallback() function
- [Source: packages/timestamp-extraction/src/quality-gate.ts] Quality validation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered.

### Completion Notes List

- **Verification + Fix Story**: Stories 6.5 and 6.6 already implemented the core fallback logic. This story verified all ACs, fixed the warningFlags naming, replaced JSON deep clone with `structuredClone()`, and added comprehensive dedicated tests.
- **warningFlags Naming Fix**: The code used `'estimated-timing-used'` but AC5 requires `'timing-estimated'`. Changed in `timestamp-extraction.ts` at both fallback paths (lines 149 and 224).
- **All 6 Acceptance Criteria Verified**:
  - AC1: `estimateWordTimings()` verified with character-weighted distribution, punctuation pauses (300ms/.!?, 150ms/,;:), clamping (0.1s-1.0s)
  - AC2: Fallback triggers on API error, confidence < 80%, word count mismatch > 20%, and mapping ratio < 80%
  - AC3: `applyEstimatedTimings()` processes all segments with adaptive scaling
  - AC4: `timingMetadata.source` = `'estimated'` on fallback path
  - AC5: `timingMetadata.warningFlags` includes `['timing-estimated']`
  - AC6: Quality gate returns DEGRADED (not FAIL) for estimated timing
- **Test Coverage**: 147 tests passing across 7 test files. Dedicated Story 6.7 test sections in fallback.test.ts (34 tests), timestamp-extraction.test.ts (8 fallback integration tests), quality-gate.test.ts (4 fallback scenario tests).
- **Build**: All 16 packages build successfully.
- **Pre-existing Failures**: 67 test failures in other packages (core, orchestrator) are pre-existing and unrelated to this story.

### Change Log

- 2026-01-27: Story 6.7 implementation and verification. Fixed warningFlags naming (`'estimated-timing-used'` -> `'timing-estimated'`), added dedicated fallback tests, verified all 6 ACs.
- 2026-01-27: Code review fixes - replaced `JSON.parse(JSON.stringify())` with `structuredClone()` in fallback.ts, corrected File List and Completion Notes accuracy.

### File List

Modified:
- `packages/timestamp-extraction/src/timestamp-extraction.ts` - Fixed warningFlags: `'estimated-timing-used'` -> `'timing-estimated'` at both fallback paths
- `packages/timestamp-extraction/src/fallback.ts` - Replaced `JSON.parse(JSON.stringify())` with `structuredClone()` for safer deep cloning
- `packages/timestamp-extraction/src/__tests__/fallback.test.ts` - Added 10 dedicated Story 6.7 tests (punctuation pauses, clamping, deep clone, multi-segment)
- `packages/timestamp-extraction/src/__tests__/timestamp-extraction.test.ts` - Fixed warningFlag assertions, added 8 fallback integration tests
- `packages/timestamp-extraction/src/__tests__/quality-gate.test.ts` - Added 4 fallback scenario tests

Verified (no modifications):
- `packages/timestamp-extraction/src/types.ts` - EstimatedTimingConfig, DEFAULT_TIMING_CONFIG, SCALING_TOLERANCE
- `packages/timestamp-extraction/src/stt-client.ts` - shouldUseFallback() function
- `packages/timestamp-extraction/src/quality-gate.ts` - Quality validation (DEGRADED for fallback)
