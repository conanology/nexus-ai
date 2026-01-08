# Story 2.5: Implement Reddit Source

Status: done

## Story

As a developer,
I want to fetch hot posts from r/MachineLearning,
So that community discussions are included in news coverage.

## Acceptance Criteria

1. **Given** the news sourcing package from Story 2.1
   **When** I implement `RedditSource`
   **Then** it implements `NewsSource` interface

2. **And** it fetches from Reddit API for r/MachineLearning hot posts

3. **And** it filters by flair: [Research], [Project], [News]

4. **And** it extracts `viralityScore` from upvotes and upvote ratio

5. **And** it sets `authorityWeight` to 0.6 (community discussion)

6. **And** it includes flair, comment count, and crosspost info in metadata

7. **And** it handles Reddit API authentication

8. **And** it returns maximum 10 items per fetch

## Tasks / Subtasks

- [x] Task 1: Implement RedditSource class (AC: #1)
  - [x] Extend BaseNewsSource
  - [x] Set name to 'reddit'
  - [x] Set authorityWeight to 0.6

- [x] Task 2: Implement Reddit API authentication (AC: #7)
  - [x] Use OAuth2 client credentials flow
  - [x] Get credentials from Secret Manager
  - [x] Handle token refresh

- [x] Task 3: Fetch hot posts (AC: #2, #8)
  - [x] Query r/MachineLearning/hot endpoint
  - [x] Parse listing response
  - [x] Limit to 10 items

- [x] Task 4: Filter by flair (AC: #3)
  - [x] Filter for [Research] flair
  - [x] Filter for [Project] flair
  - [x] Filter for [News] flair

- [x] Task 5: Calculate virality (AC: #4)
  - [x] Use upvote count as base
  - [x] Weight by upvote ratio
  - [x] Formula: upvotes * upvoteRatio

- [x] Task 6: Build metadata (AC: #6)
  - [x] Include flair
  - [x] Include comment count
  - [x] Include crosspost source if applicable

## Dev Notes

### Target Flairs

- `[Research]` - Academic papers and studies
- `[Project]` - Open source projects
- `[News]` - Industry news
- `[Discussion]` - Optional, lower priority

### Virality Score Calculation

```typescript
viralityScore = upvotes * upvoteRatio
```

### Authority Weight: 0.6

Community discussion weight lower than curated sources:
- User-submitted content
- Variable quality
- Good for sentiment/discussion

### Reddit API

Endpoint: `https://oauth.reddit.com/r/MachineLearning/hot`
Auth: OAuth2 client credentials

### Metadata Fields

```typescript
{
  flair: string,
  upvotes: number,
  upvoteRatio: number,
  commentCount: number,
  crosspostFrom: string | null,
  author: string,
  subreddit: string
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented RedditSource extending BaseNewsSource
- OAuth2 authentication with Secret Manager credentials
- Fetches from r/MachineLearning hot posts
- Filters by Research, Project, News flairs
- Calculates virality from upvotes × ratio
- Authority weight 0.6 for community content
- Returns max 10 items per fetch

### File List

**Created/Modified:**
- `nexus-ai/packages/news-sourcing/src/sources/reddit.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.1 (News Sourcing Package), Story 1.6 (Secrets)
- **Downstream Dependencies:** Story 2.7 (Freshness Scoring)
