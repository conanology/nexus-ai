# Story 2.8: Implement Topic Selection

Status: done

## Story

As a developer,
I want to select the best topic for daily video,
So that the most newsworthy content is covered.

## Acceptance Criteria

1. **Given** scored news items from Story 2.7
   **When** I implement topic selection logic
   **Then** `selectTopic(items: NewsItem[])` returns the top-scored item

2. **And** selection validates minimum viable topics (≥3 candidates) per FR4

3. **And** if <3 viable topics, fallback to "deep dive" on 48hr topic is triggered

4. **And** fallback logs warning and selects highest-scored 48hr+ item

5. **And** selected topic is stored to Firestore at `topics/{YYYY-MM-DD}` per FR5:
   - `selected`: the chosen NewsItem
   - `candidates`: top 10 candidates with scores
   - `selectionTime`: timestamp
   - `fallbackUsed`: boolean

6. **And** `executeNewsSourcing()` stage function orchestrates:
   1. Fetch from all sources
   2. Score all items
   3. Select topic
   4. Store selection
   5. Return `StageOutput` with selected topic

7. **And** stage uses `executeStage` wrapper from Epic 1

## Tasks / Subtasks

- [x] Task 1: Implement selectTopic function (AC: #1)
  - [x] Take scored items array
  - [x] Return highest-scored item
  - [x] Include score in result

- [x] Task 2: Implement viability check (AC: #2, #3, #4)
  - [x] Count items with score > threshold
  - [x] Check for ≥3 viable topics
  - [x] Trigger fallback if <3
  - [x] Select from 48hr+ items for fallback
  - [x] Log warning on fallback

- [x] Task 3: Implement storage (AC: #5)
  - [x] Store to topics/{YYYY-MM-DD}
  - [x] Include selected item
  - [x] Include top 10 candidates
  - [x] Track fallbackUsed flag
  - [x] Add selectionTime timestamp

- [x] Task 4: Create executeNewsSourcing stage (AC: #6, #7)
  - [x] Use executeStage wrapper
  - [x] Fetch from all 5 sources
  - [x] Score all items
  - [x] Select topic
  - [x] Store selection
  - [x] Return StageOutput

## Dev Notes

### Topic Selection Flow

```
1. Fetch from all sources → ~50 items
2. Score each item → ScoredNewsItem[]
3. Sort by score descending
4. Check viability (≥3 with score > 1.0)
5. Select top item OR fallback
6. Store selection to Firestore
7. Return selected topic
```

### Viability Threshold

- Minimum 3 items with freshnessScore > 1.0
- Score 1.0 = average virality, 1hr old, mid authority

### Fallback Logic

```typescript
if (viableTopics.length < 3) {
  logger.warn('Insufficient fresh topics, using deep-dive fallback');
  // Select highest-scored item regardless of age
  const fallbackTopic = allItems
    .filter(i => getHoursSince(i.publishedAt) > 24)
    .sort((a, b) => b.rawScore - a.rawScore)[0];
}
```

### Firestore Document Structure

```typescript
// topics/2026-01-08
{
  selected: NewsItem,
  candidates: ScoredNewsItem[],  // top 10
  selectionTime: Timestamp,
  fallbackUsed: boolean,
  totalFetched: number,
  sourceBreakdown: { github: 10, arxiv: 15, ... }
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented selectTopic with viability checking
- Fallback to 48hr+ topics when <3 viable
- Stores selection to Firestore topics/{date}
- Created executeNewsSourcing stage function
- Uses executeStage wrapper from core
- Fetches from all 5 sources in parallel
- Returns StageOutput with selected topic

### File List

**Created/Modified:**
- `nexus-ai/packages/news-sourcing/src/topic-selection.ts`
- `nexus-ai/packages/news-sourcing/src/news-sourcing.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.7 (Freshness Scoring), Story 1.10 (executeStage)
- **Downstream Dependencies:** Story 2.9 (Research Stage)
