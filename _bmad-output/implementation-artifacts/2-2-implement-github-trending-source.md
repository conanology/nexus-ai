# Story 2.2: implement-github-trending-source

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to fetch trending AI/ML repositories from GitHub,
so that new tools and projects are included in news coverage.

## Acceptance Criteria

1. GitHubTrendingSource implements NewsSource interface from @nexus-ai/news-sourcing.
2. Fetches trending repositories filtered by language (Python, TypeScript, Rust).
3. Fetches trending repositories filtered by AI/ML topics (machine-learning, artificial-intelligence, llm, deep-learning).
4. Uses daily time range filter for trending detection.
5. Extracts viralityScore from star count and today's stars.
6. Sets authorityWeight to 0.8 (high credibility).
7. Handles GitHub API rate limiting (5,000 req/hr authenticated, 60 req/hr unauthenticated).
8. Returns maximum 10 items per fetch.
9. Uses withRetry wrapper for API calls.
10. Unit tests mock GitHub API responses.

## Tasks / Subtasks

- [x] Create GitHubTrendingSource class (AC: 1)
  - [x] Implement NewsSource interface (name, fetch, authorityWeight)
  - [x] Set name to 'github-trending'
  - [x] Set authorityWeight to 0.8
- [x] Implement GitHub API client (AC: 2-4, 7)
  - [x] Use GitHub REST API Search endpoint
  - [x] Configure query: language filter (Python, TypeScript, Rust)
  - [x] Configure query: topic filter (machine-learning, artificial-intelligence, llm, deep-learning)
  - [x] Sort by stars, order desc
  - [x] Filter by created date (past 24 hours for "daily" trending)
  - [x] Use getSecret('nexus-github-token') for authentication
- [x] Implement virality scoring (AC: 5)
  - [x] Extract star count from repository
  - [x] Extract today's stars (stars added in last 24h)
  - [x] Calculate viralityScore = (stars + todayStars * 2)
- [x] Implement fetch method (AC: 8)
  - [x] Limit results to 10 items
  - [x] Map GitHub repo to NewsItem format
  - [x] Return NewsItem[] with all required fields
- [x] Add error handling and retry logic (AC: 7)
  - [x] Wrap API call with withRetry (maxRetries: 3)
  - [x] Handle 403 (rate limit) with RETRYABLE severity
  - [x] Handle 429 (too many requests) with RETRYABLE severity
  - [x] Throw NexusError.fallback for persistent API failures
- [x] Add logging and cost tracking (Architecture Compliance)
  - [x] Use logger.info for fetch operations
  - [x] Track API calls with CostTracker
- [x] Create unit tests (AC: 10)
  - [x] Mock GitHub API responses (successful, rate-limited, error)
  - [x] Test language filtering
  - [x] Test topic filtering
  - [x] Test virality score calculation
  - [x] Test retry logic on rate limits
  - [x] Test mapping to NewsItem format

## Dev Notes

### Architecture Compliance

**Core Integration (REQUIRED):**
- Import `StageInput`, `StageOutput` from `@nexus-ai/core` (not used directly in source, but required for consistency)
- Import `NexusError` from `@nexus-ai/core` for error handling
- Import `withRetry` from `@nexus-ai/core` for API calls (maxRetries: 3)
- Import `logger` from `@nexus-ai/core` for structured logging
- Import `CostTracker` from `@nexus-ai/core` for tracking API usage
- Import `getSecret` from `@nexus-ai/core` for retrieving GitHub token

**Naming Conventions:**
- Files: kebab-case (e.g., `github-trending-source.ts`)
- Classes: PascalCase (e.g., `GitHubTrendingSource`)
- Functions: camelCase (e.g., `fetchTrending`)
- Constants: SCREAMING_SNAKE (e.g., `MAX_ITEMS`)

**Error Handling:**
- Use `NexusError.retryable()` for transient failures (403, 429)
- Use `NexusError.fallback()` for persistent API failures
- Error code format: `NEXUS_GITHUB_{TYPE}` (e.g., `NEXUS_GITHUB_RATE_LIMIT`, `NEXUS_GITHUB_API_ERROR`)

### File Structure Requirements

```
packages/news-sourcing/src/sources/
├── github-trending-source.ts   # Main implementation
└── github-trending-source.test.ts  # Unit tests
```

### Technical Requirements

**GitHub REST API Details:**
- Endpoint: `GET /search/repositories`
- Query parameters:
  - `q`: Search query combining language and topic filters
  - `sort`: 'stars'
  - `order`: 'desc'
  - `per_page`: 10
  - `created`: Date filter for past 24 hours (ISO 8601 format)
- Authentication: Bearer token via Authorization header
- Rate limits:
  - Authenticated: 5,000 requests/hour
  - Unauthenticated: 60 requests/hour
  - Search endpoints may have stricter limits

**Query Construction Examples:**
```typescript
// Language + topic filtering
q = 'language:python language:typescript language:rust topic:machine-learning topic:artificial-intelligence topic:llm topic:deep-learning'

// Date filtering (past 24 hours)
created: `>${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
```

**Virality Score Formula:**
```typescript
// Extract from GitHub API response
const stars = repo.stargazers_count;
const todayStars = repo.today_stars; // May need to calculate from history
const viralityScore = stars + (todayStars * 2);
```

**NewsItem Mapping:**
```typescript
interface NewsItem {
  title: string;       // repo.name (e.g., "pytorch/pytorch")
  url: string;        // repo.html_url
  source: string;      // 'github-trending'
  publishedAt: Date;   // repo.created_at
  viralityScore: number;
  metadata: Record<string, unknown>;  // stars, language, topics, description
}
```

### Testing Standards

- Use `vitest` for unit tests
- Mock GitHub API responses using `vi.fn()` or similar
- Test scenarios:
  - Successful fetch with 10 items
  - Rate limit response (403) with retry
  - Empty results
  - API error (500)
  - Authentication failure (401)
- Verify virality score calculations
- Verify NewsItem format matches interface
- Cover edge cases: missing fields, null values

### References

- PRD: `_bmad-output/planning-artifacts/prd.md` (Section: News Intelligence - FR1)
- Epics: `_bmad-output/planning-artifacts/epics.md` (Story 2.2)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Provider Abstraction, Error Handling)
- Project Context: `_bmad-output/project-context.md` (Critical Rules - Retry + Fallback, Logger, Secrets)
- GitHub API Docs: https://docs.github.com/en/rest/search/search (Search repositories endpoint)
- GitHub Rate Limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

### Dev Agent Record

### Agent Model Used

opencode (Gemini 2.0 Flash)

### Code Review Fixes (2026-01-16)
- **Critical Fix**: Updated GitHub Search Query to use `OR` operator for languages and topics. Previous implementation used implicit `AND` which would yield zero results.
- **Critical Clarification**: Updated `viralityScore` logic. Confirmed that `todayStars` is not available in standard Search API. Code now assumes `created: >24h` filter implies all stars are new. Added clarifying comments.
- **Quality Improvement**: Added explicit `.slice(0, 10)` to ensure result limit compliance.
- **Test Update**: Enhanced unit tests to verify `OR` logic in query construction and result limiting.

### Debug Log References

### Completion Notes List

- Implemented `GitHubTrendingSource` class with `fetch` method.
- Added GitHub API integration using `fetch` with `withRetry` and `CostTracker`.
- Implemented filtering for Python, TypeScript, Rust and AI/ML topics.
- Added virality score calculation based on stars.
- Added comprehensive unit tests mocking GitHub API.
- Exported `GitHubTrendingSource` from package index.

### File List

- packages/news-sourcing/src/sources/github-trending-source.ts
- packages/news-sourcing/src/sources/github-trending-source.test.ts
- packages/news-sourcing/src/index.ts

## Previous Story Intelligence

**Story 2.1: create-news-sourcing-package**

**Key Learnings:**
- `@nexus-ai/news-sourcing` package structure established with `src/sources/` directory
- `NewsSource` interface and `NewsItem` type already defined in `src/types.ts`
- Import these from `@nexus-ai/news-sourcing` - DO NOT redefine them
- Use `logger.info()` for all logging - NO console.log
- Package exports from `src/index.ts` must include GitHubTrendingSource after implementation
- Unit tests co-located with source files (e.g., `github-trending-source.test.ts`)
- Build system: Turborepo uses pnpm workspace - add dependencies via `pnpm add` in package directory

**Patterns to Follow:**
- File location: `packages/news-sourcing/src/sources/github-trending-source.ts`
- Export from `src/index.ts`: `export * from './sources/github-trending-source'`
- Test file: `packages/news-sourcing/src/sources/github-trending-source.test.ts`
- Import pattern: `import { GitHubTrendingSource } from '@nexus-ai/news-sourcing'`

**Files Modified in 2.1:**
- `packages/news-sourcing/src/types.ts` - NewsSource interface, NewsItem type
- `packages/news-sourcing/src/index.ts` - Public exports
- `packages/news-sourcing/src/news-sourcing.ts` - Main stage logic
- `packages/news-sourcing/src/scoring.ts` - Freshness algorithm

## Git Intelligence Summary

**Recent Commits:**
- `da7ed60` - docs: update story status to done
- `7726832` - docs: update story status to done after successful code review
- `f9fc595` - feat(news-sourcing): implement freshness algorithm and refine core integration
- `d1a078b` - fix: Story 1.9 code review fixes - Epic 1 retrospective
- `79a3249` - fix: Story 1.7 code review fixes - Epic 1 retrospective

**Code Patterns Observed:**
- Core package uses strict TypeScript types
- `logger` usage follows structured logging pattern with pipelineId and stage
- Error classes use static factory methods (e.g., `NexusError.retryable()`)
- CostTracker instantiated with `pipelineId` and `stageName`
- `withRetry` and `withFallback` are composable utilities

**Relevant for This Story:**
- Use `logger.info()` for logging API fetch operations
- Use `withRetry()` for GitHub API calls (maxRetries: 3)
- Follow naming conventions (kebab-case files, PascalCase classes)
- Import from `@nexus-ai/core` for all shared utilities

## Latest Technical Information

**GitHub API Rate Limits (2026):**
- **Authenticated requests:** 5,000 requests/hour
- **Unauthenticated requests:** 60 requests/hour
- **Search endpoints** may have more restrictive limits
- **Rate limit headers:** Check `X-RateLimit-Remaining`, `X-RateLimit-Reset` in response
- **Recommendation:** Always use authentication for production to avoid rate limits

**GitHub Search API Usage:**
```typescript
// Endpoint: GET /search/repositories
// Example request:
GET https://api.github.com/search/repositories
  ?q=language:python language:typescript language:rust topic:machine-learning
  &sort=stars
  &order=desc
  &per_page=10
  &created:>2026-01-15

// Headers:
Authorization: Bearer <TOKEN>
Accept: application/vnd.github.v3+json
```

**Authentication Methods:**
- Personal Access Token (classic or fine-grained)
- GitHub App token
- OAuth app token
- **Best practice:** Use fine-grained personal access token with minimal permissions (public_repo only)

**Trending Detection Strategy:**
- GitHub does NOT have a dedicated "trending" API endpoint
- Use search with:
  - `sort: stars` + `order: desc` for popularity
  - `created: >{24h ago}` for "daily" trending
  - Topic filters for AI/ML relevance
- Combine multiple languages with OR logic: `language:python language:typescript language:rust`

## Project Context Reference

**Critical Rules (MUST FOLLOW):**

1. **Every External API Call: Retry + Fallback**
   - GitHub API call MUST be wrapped with `withRetry()` (maxRetries: 3)
   - Use `NexusError.retryable('NEXUS_GITHUB_RATE_LIMIT', message, 'github-source')` for rate limits
   - Use `NexusError.fallback()` for persistent API failures

2. **NEVER Use console.log**
   - Import `logger` from `@nexus-ai/core`
   - Log format: `logger.info('Fetching trending repos', { pipelineId: '2026-01-16', source: 'github-trending' })`

3. **NEVER Hardcode Credentials**
   - Use `getSecret('nexus-github-token')` from `@nexus-ai/core`
   - Secret stored in GCP Secret Manager
   - Falls back to `NEXUS_GITHUB_TOKEN` environment variable for local dev

4. **Track Costs via CostTracker**
   - Create `new CostTracker(pipelineId, 'github-source')`
   - Track API costs (GitHub API is free, but track for completeness)
   - Use `tracker.recordApiCall('github', 0, 0)` if no cost

5. **Quality Metrics in Output**
   - Track provider tier (GitHub is primary source)
   - Track retry attempts
   - Track rate limit warnings

**Technology Stack:**
- Language: TypeScript (strict mode)
- Runtime: Node.js 20.x LTS
- HTTP Client: Use `fetch` (native) or `axios` (if already in dependencies)
- Testing: Vitest
- Monorepo: Turborepo + pnpm

**Naming Conventions:**
- Error codes: `NEXUS_{DOMAIN}_{TYPE}` (e.g., `NEXUS_GITHUB_RATE_LIMIT`)
- Logger names: `nexus.news-sourcing.github`
- Secret names: `nexus-github-token`

## Story Completion Status

**Status:** ready-for-dev

**Completion Notes:**
- Comprehensive developer guide created with all necessary technical details
- GitHub API patterns documented (rate limits, authentication, search queries)
- Previous story intelligence integrated from Story 2.1
- Git intelligence analyzed for code patterns
- Latest technical specifications included (2026 GitHub API)
- All architecture requirements enforced (retry, logging, secrets, cost tracking)
- Quality gate requirements specified


