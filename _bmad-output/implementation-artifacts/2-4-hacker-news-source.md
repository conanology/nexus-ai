# Story 2.4: Implement Hacker News Source

Status: done

## Story

As a developer,
I want to fetch AI/ML stories from Hacker News front page,
So that trending discussions are included in news coverage.

## Acceptance Criteria

1. **Given** the news sourcing package from Story 2.1
   **When** I implement `HackerNewsSource`
   **Then** it implements `NewsSource` interface

2. **And** it fetches from HN API (top stories endpoint)

3. **And** it filters stories by AI/ML keywords in title or domain

4. **And** it extracts `viralityScore` from points and comment count

5. **And** it sets `authorityWeight` to 0.7 (community signal)

6. **And** it includes comment count and HN discussion URL in metadata

7. **And** it returns maximum 10 AI/ML relevant items per fetch

## Tasks / Subtasks

- [x] Task 1: Implement HackerNewsSource class (AC: #1)
  - [x] Extend BaseNewsSource
  - [x] Set name to 'hackernews'
  - [x] Set authorityWeight to 0.7

- [x] Task 2: Implement fetch from HN API (AC: #2)
  - [x] Fetch top story IDs from /topstories endpoint
  - [x] Fetch individual story details
  - [x] Handle pagination efficiently

- [x] Task 3: Implement AI/ML filtering (AC: #3, #7)
  - [x] Filter by title keywords
  - [x] Filter by known AI domains
  - [x] Return max 10 filtered items

- [x] Task 4: Calculate virality (AC: #4)
  - [x] Use points (score) as base
  - [x] Weight comment count
  - [x] Formula: points + (comments * 1.5)

- [x] Task 5: Build metadata (AC: #6)
  - [x] Include comment count
  - [x] Include HN discussion URL
  - [x] Include original story domain

## Dev Notes

### AI/ML Keywords

```typescript
const AI_KEYWORDS = [
  'ai', 'ml', 'machine learning', 'deep learning',
  'neural', 'gpt', 'llm', 'transformer', 'chatgpt',
  'anthropic', 'openai', 'gemini', 'claude', 'mistral',
  'diffusion', 'stable diffusion', 'midjourney'
];
```

### Virality Score Calculation

```typescript
viralityScore = points + (comments * 1.5)
```

### Authority Weight: 0.7

Lower than academic sources but valuable for:
- Real-time discussion
- Developer sentiment
- Industry news

### HN API Endpoints

- Top stories: `https://hacker-news.firebaseio.com/v0/topstories.json`
- Story details: `https://hacker-news.firebaseio.com/v0/item/{id}.json`

### Metadata Fields

```typescript
{
  points: number,
  commentCount: number,
  hnUrl: string,
  domain: string,
  author: string
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented HackerNewsSource extending BaseNewsSource
- Uses official HN Firebase API
- Filters by AI/ML keywords in title
- Calculates virality from points and comments
- Authority weight 0.7 for community signal
- Includes HN discussion URL in metadata
- Returns max 10 AI-relevant items

### File List

**Created/Modified:**
- `nexus-ai/packages/news-sourcing/src/sources/hacker-news.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.1 (News Sourcing Package)
- **Downstream Dependencies:** Story 2.7 (Freshness Scoring)
