# Story 2.7: Implement Freshness Scoring

Status: done

## Story

As a developer,
I want to score news items by freshness algorithm,
So that the most relevant and timely news is prioritized.

## Acceptance Criteria

1. **Given** news items from all sources (Stories 2.2-2.6)
   **When** I implement the freshness scoring algorithm
   **Then** score is calculated as: `(viralityScore × authorityWeight) / hoursSincePublish`

2. **And** `hoursSincePublish` is clamped to minimum 1 hour (avoid division issues)

3. **And** items older than 24 hours receive a 0.5x penalty multiplier (NFR20)

4. **And** items older than 48 hours receive a 0.1x penalty (deep-dive only)

5. **And** scoring function is: `calculateFreshnessScore(item: NewsItem): number`

6. **And** items are sorted by freshness score descending

7. **And** edge cases handled: missing publishedAt, zero virality

## Tasks / Subtasks

- [x] Task 1: Implement scoring algorithm (AC: #1, #2)
  - [x] Create calculateFreshnessScore function
  - [x] Apply formula: (virality × authority) / hours
  - [x] Clamp hours to minimum 1

- [x] Task 2: Implement age penalties (AC: #3, #4)
  - [x] Apply 0.5x multiplier for >24 hours
  - [x] Apply 0.1x multiplier for >48 hours
  - [x] Align with NFR20 freshness requirement

- [x] Task 3: Implement sorting (AC: #5, #6)
  - [x] Create sortByFreshness function
  - [x] Sort descending by score
  - [x] Return scored items

- [x] Task 4: Handle edge cases (AC: #7)
  - [x] Default publishedAt to now if missing
  - [x] Handle zero virality gracefully
  - [x] Log warnings for edge cases

## Dev Notes

### Freshness Formula

```typescript
function calculateFreshnessScore(item: NewsItem, source: NewsSource): number {
  const hoursSince = Math.max(1, getHoursSince(item.publishedAt));
  let score = (item.viralityScore * source.authorityWeight) / hoursSince;

  // Age penalties per NFR20
  if (hoursSince > 48) {
    score *= 0.1; // Deep-dive only
  } else if (hoursSince > 24) {
    score *= 0.5; // Stale penalty
  }

  return score;
}
```

### NFR20 Alignment

- Target: news freshness <12 hours
- Hard limit: <24 hours
- Deep-dive: 24-48 hours with penalty
- Skip: >48 hours (unless no alternatives)

### Authority Weights Summary

| Source | Weight | Reason |
|--------|--------|--------|
| arXiv | 0.95 | Academic |
| HuggingFace | 0.90 | Research |
| GitHub | 0.80 | Tool |
| HackerNews | 0.70 | Community |
| Reddit | 0.60 | Discussion |

### Edge Case Handling

- Missing publishedAt: Use current time (penalizes unknown age)
- Zero virality: Score becomes 0 (natural filtering)
- Negative hours: Clamp to 1 (future dates)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented calculateFreshnessScore function
- Formula: (virality × authority) / hours
- Hours clamped to minimum 1
- Age penalties: 0.5x for >24h, 0.1x for >48h
- sortByFreshness returns items sorted descending
- Edge cases handled with sensible defaults

### File List

**Created/Modified:**
- `nexus-ai/packages/news-sourcing/src/scoring.ts`

### Dependencies

- **Upstream Dependencies:** Stories 2.2-2.6 (News sources)
- **Downstream Dependencies:** Story 2.8 (Topic Selection)
