# Story 2.2: Implement GitHub Trending Source

Status: done

## Story

As a developer,
I want to fetch trending AI/ML repositories from GitHub,
So that new tools and projects are included in news coverage.

## Acceptance Criteria

1. **Given** the news sourcing package from Story 2.1
   **When** I implement `GitHubTrendingSource`
   **Then** it implements `NewsSource` interface

2. **And** it fetches trending repositories filtered by:
   - Language: Python, TypeScript, Rust (AI-relevant)
   - Topics: machine-learning, artificial-intelligence, llm, deep-learning
   - Time range: daily trending

3. **And** it extracts `viralityScore` from star count and today's stars

4. **And** it sets `authorityWeight` to 0.8 (high credibility)

5. **And** it handles GitHub API rate limiting with retry logic

6. **And** it returns maximum 10 items per fetch

## Tasks / Subtasks

- [x] Task 1: Implement GitHubTrendingSource class (AC: #1)
  - [x] Extend BaseNewsSource
  - [x] Set name to 'github'
  - [x] Set authorityWeight to 0.8

- [x] Task 2: Implement fetch method (AC: #2, #3, #6)
  - [x] Query GitHub trending page/API
  - [x] Filter by AI-relevant languages
  - [x] Filter by ML-related topics
  - [x] Extract star count for virality
  - [x] Limit to 10 items

- [x] Task 3: Handle rate limiting (AC: #5)
  - [x] Use withRetry from core package
  - [x] Handle 403 rate limit responses
  - [x] Add appropriate backoff

- [x] Task 4: Map to NewsItem format
  - [x] Map repo title to item title
  - [x] Map repo URL to item url
  - [x] Calculate viralityScore from stars
  - [x] Include stars, language, topics in metadata

## Dev Notes

### Virality Score Calculation

```typescript
viralityScore = (todayStars * 2) + (totalStars / 1000)
```

### Filter Criteria

Languages: Python, TypeScript, JavaScript, Rust, Go
Topics: machine-learning, artificial-intelligence, llm, deep-learning, transformers, neural-network

### API Approach

Using GitHub's search API with topic filters:
- `q=topic:machine-learning+topic:artificial-intelligence`
- `sort=stars`
- `order=desc`

### Metadata Fields

```typescript
{
  stars: number,
  todayStars: number,
  language: string,
  topics: string[],
  description: string,
  owner: string
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented GitHubTrendingSource extending BaseNewsSource
- Fetches trending repos via GitHub Search API
- Filters by AI-relevant languages and topics
- Calculates virality from star metrics
- Handles rate limiting with withRetry
- Returns max 10 items per fetch
- Authority weight set to 0.8

### File List

**Created/Modified:**
- `nexus-ai/packages/news-sourcing/src/sources/github-trending.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.1 (News Sourcing Package)
- **Downstream Dependencies:** Story 2.7 (Freshness Scoring)
