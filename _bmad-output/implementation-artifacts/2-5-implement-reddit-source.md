# Story 2.5: implement-reddit-source

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to fetch hot posts from r/MachineLearning,
so that community discussions are included in news coverage.

## Acceptance Criteria

1. **Interface Implementation:** `RedditSource` implements `NewsSource` interface from `@nexus-ai/news-sourcing`.
2. **Authentication:** Uses Reddit API with OAuth 2.0 (Client Credentials flow) to prevent rate limiting.
3. **Source Fetching:** Fetches "hot" posts from `r/MachineLearning`.
4. **Flair Filtering:** Filters posts by flairs: `[Research]`, `[Project]`, `[News]` (case-insensitive partial match).
5. **Virality Scoring:** Calculates score based on `score` (upvotes) and `upvote_ratio`.
6. **Authority Weight:** Sets `authorityWeight` to 0.6 (Community Discussion).
7. **Metadata:** Includes flair text, comment count, and crosspost count in metadata.
8. **Freshness:** Filters out posts older than 24 hours (primary) or 48 hours (deep dive).
9. **Limiting:** Returns maximum 10 relevant items per fetch.
10. **Error Handling:** Uses `withRetry` for API calls and handles 429/5xx gracefully.

## Tasks / Subtasks

- [x] Create `RedditSource` class
  - [x] Implement `NewsSource` interface (`name`, `fetch`, `authorityWeight`)
  - [x] Set `name` to 'reddit'
  - [x] Set `authorityWeight` to 0.6

- [x] Implement Reddit API Client
  - [x] Create `getAccessToken()` method
    - [x] Use Basic Auth with `NEXUS_REDDIT_CLIENT_ID` and `NEXUS_REDDIT_CLIENT_SECRET`
    - [x] Call `https://www.reddit.com/api/v1/access_token` with `grant_type=client_credentials`
    - [x] Cache token in memory until expiration
  - [x] Implement `fetchHotPosts()` method
    - [x] Call `https://oauth.reddit.com/r/MachineLearning/hot`
    - [x] Use `Bearer` token auth
    - [x] Set `User-Agent` header (required by Reddit) to `nexus-ai/1.0`
    - [x] Use `limit=50` to fetch enough candidates

- [x] Implement Filtering Logic
  - [x] Filter by Flair:
    - [x] Check `link_flair_text`
    - [x] Allow if contains "Research", "Project", or "News" (case-insensitive)
  - [x] Filter by Freshness:
    - [x] Check `created_utc` timestamp
    - [x] Reject > 48 hours
  - [x] Filter by Stickied:
    - [x] Reject `stickied: true` (usually rules/megathreads)

- [x] Map to `NewsItem` Format
  - [x] `title`: `post.title`
  - [x] `url`: `post.url` (external link) or `https://www.reddit.com` + `post.permalink` (if text post)
  - [x] `publishedAt`: `new Date(post.created_utc * 1000)`
  - [x] `viralityScore`: `post.score * post.upvote_ratio + (post.num_comments * 0.5)`
  - [x] Metadata:
    - [x] `flair`: `post.link_flair_text`
    - [x] `commentCount`: `post.num_comments`
    - [x] `upvoteRatio`: `post.upvote_ratio`
    - [x] `permalink`: `https://www.reddit.com` + `post.permalink`

- [x] Integration & Testing
  - [x] Integrate `withRetry`, `logger`, `CostTracker`
  - [x] Add unit tests mocking Reddit API responses
  - [x] Test token retrieval and caching
  - [x] Test flair filtering
  - [x] Test virality scoring

## Dev Notes

### Architecture Compliance

**Core Integration (REQUIRED):**
- Import `NexusError` from `@nexus-ai/core`.
- Import `withRetry` from `@nexus-ai/core`.
- Import `logger` from `@nexus-ai/core`.
- Import `CostTracker` from `@nexus-ai/core` (record 0 cost, but track call).
- Import `getSecret` (or env var fallback) from `@nexus-ai/core`.

**Naming Conventions:**
- File: `packages/news-sourcing/src/sources/reddit-source.ts`
- Class: `RedditSource`
- Test: `packages/news-sourcing/src/sources/reddit-source.test.ts`
- Error Code: `NEXUS_REDDIT_API_ERROR`

### Technical Requirements

**Authentication Details:**
- **Token Endpoint:** `POST https://www.reddit.com/api/v1/access_token`
- **Auth:** Basic Auth (User = Client ID, Pass = Client Secret)
- **Body:** `grant_type=client_credentials`
- **Headers:** `User-Agent: nexus-ai/1.0` (CRITICAL: Reddit blocks default agents)
- **Response:** `{ access_token: "...", expires_in: 3600, ... }`
- **Strategy:** Cache token. If 401 received, clear cache and retry once.

**API Details:**
- **Endpoint:** `GET https://oauth.reddit.com/r/MachineLearning/hot`
- **Headers:** `Authorization: Bearer {token}`, `User-Agent: nexus-ai/1.0`
- **Params:** `limit=50` (fetch enough to filter down to 10)

**Virality Formula:**
```typescript
// Score = Raw Score * Ratio + (Comments * 0.5)
const score = (post.score || 0);
const ratio = (post.upvote_ratio || 0.5); // Default to 0.5 if missing
const comments = (post.num_comments || 0);

const viralityScore = Math.max(0, (score * ratio) + (comments * 0.5));
```

**Flair Filtering Logic:**
```typescript
const ALLOWED_FLAIRS = ['research', 'project', 'news'];
const flair = post.link_flair_text?.toLowerCase() || '';
const isRelevant = ALLOWED_FLAIRS.some(f => flair.includes(f));
```

**Environment Variables:**
- `NEXUS_REDDIT_CLIENT_ID`
- `NEXUS_REDDIT_CLIENT_SECRET`

**Mocking in Tests:**
- Mock `fetch` globally or inject a fetcher.
- Mock both the Token response and the Posts response.
- Test that `getAccessToken` is called only when needed (caching).

### Previous Story Intelligence

From **Story 2.4 (Hacker News)**:
- **Null Safety:** Reddit API has many optional fields. Always fallback (e.g., `post.score || 0`).
- **Date Handling:** `created_utc` is seconds, JS Date takes milliseconds. `* 1000`.
- **Filtering:** Fetching 50 items is usually enough to find 10 relevant ones after filtering.
- **Error Handling:** Reddit 429s are common. `withRetry` is essential.

### Git Intelligence

**Patterns to Follow:**
- `packages/news-sourcing/src/sources/hacker-news-source.ts`
- Structure:
  ```typescript
  export class RedditSource implements NewsSource {
    readonly name = 'reddit';
    readonly authorityWeight = 0.6;
    private token: string | null = null;
    private tokenExpiry: number = 0;

    // ... methods
  }
  ```

## Dev Agent Record

### Implementation Plan

Implemented Reddit API integration following the established patterns from Hacker News source:

1. **Authentication Layer**: OAuth 2.0 Client Credentials flow with token caching
   - Token cached in-memory with expiry tracking
   - Automatic retry on 401 errors to refresh expired tokens
   - Basic Auth using NEXUS_REDDIT_CLIENT_ID and NEXUS_REDDIT_CLIENT_SECRET

2. **Data Fetching**: Fetch hot posts from r/MachineLearning with proper headers
   - User-Agent header set to "nexus-ai/1.0" (required by Reddit)
   - Fetch 50 posts to ensure enough candidates after filtering

3. **Filtering Pipeline**:
   - Remove stickied posts (rules/megathreads)
   - Filter by allowed flairs: Research, Project, News (case-insensitive partial match)
   - Remove posts older than 48 hours
   - Return maximum 10 items

4. **Error Handling**: Comprehensive error handling using NexusError
   - Retryable errors: 429, 5xx, network errors
   - Critical errors: Missing credentials, malformed responses

### Debug Log

- All tests passing (17 tests)
- Token caching working correctly
- Flair filtering with case-insensitive matching implemented
- Virality score calculation follows spec: `(score * upvote_ratio) + (comments * 0.5)`
- Date conversion from Unix timestamp (seconds) to ISO string working correctly
- Self posts correctly use Reddit permalink instead of external URL

### Completion Notes

✅ Implemented RedditSource class with full NewsSource interface compliance
✅ OAuth 2.0 authentication with token caching (5-minute safety buffer before expiry)
✅ Comprehensive filtering: flair, freshness, stickied posts
✅ Proper null safety for all Reddit API fields
✅ 17 unit tests covering all edge cases and error scenarios
✅ All integration with @nexus-ai/core utilities: withRetry, logger, CostTracker, NexusError
✅ All acceptance criteria satisfied

## File List

- `packages/news-sourcing/src/sources/reddit-source.ts` (new)
- `packages/news-sourcing/src/sources/reddit-source.test.ts` (new)
- `packages/news-sourcing/src/index.ts` (modified - added RedditSource export)
- `packages/news-sourcing/src/sources/mock-source.ts` (modified - fixed TypeScript unused parameter warning)

## Change Log

- **2026-01-16**: Initial implementation of Reddit source with OAuth 2.0 authentication, flair filtering, and comprehensive test coverage
