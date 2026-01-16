# Story 2.7: implement-freshness-scoring

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to score news items by freshness algorithm,
so that the most relevant and timely news is prioritized.

## Acceptance Criteria

1.  **Algorithm Implementation:** Implements `calculateFreshnessScore(item: NewsItem): number` using the formula: `(viralityScore × authorityWeight) / hoursSincePublish`.
2.  **Time Handling:** `hoursSincePublish` is calculated relative to execution time (passed as argument or `Date.now()`).
3.  **Clamping:** `hoursSincePublish` is clamped to a minimum of 1.0 hour to avoid division by zero or inflated scores for immediate news.
4.  **Penalties:**
    - Items > 24 hours old receive a **0.5x** multiplier penalty (NFR20).
    - Items > 48 hours old receive a **0.1x** multiplier penalty (deep-dive only).
5.  **Sorting:** Provides a utility to sort an array of `NewsItem` objects by score descending.
6.  **Edge Cases:**
    - Handles items with future dates (treat as 0 hours / immediate).
    - Handles items with missing `publishedAt` (treat as 24h old default or similar fallback).
    - Handles 0 virality or authority (result should be 0).
7.  **Testing:** Comprehensive unit tests verify scores for various scenarios (fresh viral, old viral, fresh obscure, etc.).

## Tasks / Subtasks

- [x] Create `packages/news-sourcing/src/scoring.ts`
    - [x] Define `calculateFreshnessScore` function
    - [x] Define helper constants (PENALTY_24H, PENALTY_48H, MIN_HOURS)

- [x] Implement Scoring Logic
    - [x] Calculate hours difference
    - [x] Apply clamping logic
    - [x] Apply age-based penalties
    - [x] Compute final score
    - [x] Return score rounded to reasonable precision (e.g., 2 decimals)

- [x] Implement Sorting Utility
    - [x] Create `sortNewsItems(items: NewsItem[]): NewsItem[]`
    - [x] Sorts in-place or returns new array (preferred) descending by score

- [x] Unit Testing (`packages/news-sourcing/src/scoring.test.ts`)
    - [x] Test case: Fresh high-value item
    - [x] Test case: 25-hour old item (0.5x penalty)
    - [x] Test case: 50-hour old item (0.1x penalty)
    - [x] Test case: Future date item
    - [x] Test case: Zero virality/authority

## Dev Notes

### Architecture Compliance

- **Location:** Logic MUST reside in `packages/news-sourcing/src/scoring.ts`.
- **Types:** Use `NewsItem` from `packages/news-sourcing/src/types.ts`.
- **Dependencies:** Pure logic, no external dependencies (except date handling if `date-fns` is preferred, but native `Math` is sufficient here).
- **Style:** Functional approach preferred.

### Technical Details

**Formula Reference:**
```typescript
const ageInHours = Math.max(1, (now - item.publishedAt) / (1000 * 60 * 60));
let score = (item.viralityScore * item.source.authorityWeight) / ageInHours;

if (ageInHours > 48) score *= 0.1;
else if (ageInHours > 24) score *= 0.5;
```

**Sorting:**
Ensure the sort is stable if possible, though score uniqueness makes it less critical.

### Project Structure Notes

- Alignment: Part of the `@nexus-ai/news-sourcing` package.
- This logic is a critical utility used by the main `executeNewsSourcing` stage (Story 2.8).

### References

- PRD Section: News Intelligence (FR2)
- Epics Document: Story 2.7

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A - No blocking issues encountered during implementation.

### Completion Notes List

✅ **Implementation Complete** (2026-01-16)

**Core Functionality Implemented:**
1. **Helper Constants**: Defined `MIN_HOURS = 1.0`, `PENALTY_24H = 0.5`, `PENALTY_48H = 0.1`, and `DEFAULT_AGE_HOURS = 24` for scoring algorithm
2. **calculateFreshnessScore Function**:
   - Implements formula: `(viralityScore × authorityWeight) / hoursSincePublish`
   - Accepts `executionTime` parameter for testability
   - Clamps `hoursSincePublish` to minimum 1.0 hour
   - Applies age-based penalties (0.5x for >24h, 0.1x for >48h)
   - Rounds result to 2 decimal precision
   - Handles all edge cases per AC6

3. **Edge Case Handling**:
   - Future dates: Treated as 0 hours, clamped to MIN_HOURS (1)
   - Missing `publishedAt`: Defaults to 24h old with 0.5x penalty
   - Zero virality or authority: Returns 0

4. **sortNewsItems Utility**:
   - Accepts `getAuthorityWeight` function to retrieve weight per item
   - Returns new sorted array (non-mutating) in descending score order
   - Supports optional `executionTime` parameter for consistency

**Testing:**
- Created comprehensive test suite with 24 test cases covering:
  - Basic calculation and rounding
  - Time clamping (minimum 1 hour)
  - Age penalties (24h and 48h thresholds)
  - Edge cases (future dates, missing publishedAt, zero values)
  - Real-world scenarios (fresh viral, old viral, fresh obscure items)
  - Sorting utility (ordering, immutability, empty arrays, duplicates)
- All 24 tests pass ✓
- Full regression suite passes (77 tests in news-sourcing package)

**Integration:**
- Updated `news-sourcing.ts` to use new `sortNewsItems` utility
- Fixed arxiv-rss-source.ts to properly use `withRetry` return value
- All package builds complete successfully

### File List

- `packages/news-sourcing/src/scoring.ts` (updated)
- `packages/news-sourcing/src/scoring.test.ts` (created)
- `packages/news-sourcing/src/news-sourcing.ts` (updated)
- `packages/news-sourcing/src/sources/arxiv-rss-source.ts` (bugfix)
- `packages/news-sourcing/src/sources/arxiv-rss-source.test.ts` (bugfix)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)
- `_bmad-output/implementation-artifacts/2-7-implement-freshness-scoring.md` (updated)

## Change Log

**2026-01-16**: Story 2.7 implementation complete
- Implemented freshness scoring algorithm with all acceptance criteria met
- Created comprehensive test suite (24 tests, 100% pass rate)
- Fixed integration issues in news-sourcing.ts and arxiv-rss-source.ts
- **Post-Review Fixes**: 
  - Aligned `publishedAt` fallback age with penalty thresholds.
  - Refactored `ArxivRSSSource` for type safety and precision-safe scoring.
  - Updated documentation to include missing files.
- All tests passing, build successful, ready for final verification
