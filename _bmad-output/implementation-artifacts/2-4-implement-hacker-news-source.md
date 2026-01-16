# Story 2.4: implement-hacker-news-source

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to fetch AI/ML stories from Hacker News front page,
so that trending discussions are included in news coverage.

## Acceptance Criteria

1. **Interface Implementation:** `HackerNewsSource` implements `NewsSource` interface from `@nexus-ai/news-sourcing`.
2. **Source Fetching:** Fetches from HN API (top stories endpoint: `https://hacker-news.firebaseio.com/v0/topstories.json`).
3. **Filtering:** Filters stories by AI/ML keywords in title or domain.
4. **Virality Scoring:** Extracts `viralityScore` from points and comment count.
5. **Authority Weight:** Sets `authorityWeight` to 0.7 (community signal).
6. **Metadata:** Includes comment count and HN discussion URL in metadata.
7. **Limiting:** Returns maximum 10 AI/ML relevant items per fetch.
8. **Error Handling:** Uses `withRetry` for API calls and handles failures gracefully.
9. **Testing:** Unit tests mock HN API responses.
10. **Data Freshness:** Filters stories to ensure they are from the last 24-48 hours.

## Tasks / Subtasks

- [ ] Create `HackerNewsSource` class (AC: 1)
  - [ ] Implement `NewsSource` interface (`name`, `fetch`, `authorityWeight`)
  - [ ] Set `name` to 'hacker-news'
  - [ ] Set `authorityWeight` to 0.7 (Community Signal)

- [ ] Implement HN API client (AC: 2, 7, 8)
  - [ ] Use endpoint `https://hacker-news.firebaseio.com/v0/topstories.json` for story IDs
  - [ ] Use endpoint `https://hacker-news.firebaseio.com/v0/item/{id}.json` for story details
  - [ ] Implement `fetchTopStories()` method using `fetch`
  - [ ] Wrap API calls with `withRetry` (maxRetries: 3)
  - [ ] Handle API errors (4xx, 5xx) with `NexusError`
  - [ ] Handle rate limiting as `RETRYABLE`
  - [ ] Limit results to 10 relevant items (AC: 7)

- [ ] Implement AI/ML keyword filtering (AC: 3)
  - [ ] Define keyword list: AI, ML, machine learning, GPT, LLM, neural, model, AGI, transformer, diffusion, etc.
  - [ ] Filter by title keywords (case-insensitive)
  - [ ] Filter by domain keywords (openai.com, anthropic.com, huggingface.co, arxiv.org, etc.)
  - [ ] Extract top 10 matching stories from top stories endpoint

- [ ] Map response to `NewsItem` format (AC: 4, 5, 6, 10)
  - [ ] Parse JSON response for each story
  - [ ] Extract `title`, `url`, and `time` (Unix timestamp)
  - [ ] Convert `time` to Date and filter items older than 48 hours
  - [ ] Calculate `viralityScore` = `score` (points) + (`descendants` × 0.5)
  - [ ] Include `by` (author) in metadata
  - [ ] Include `descendants` (comment count) in metadata
  - [ ] Include HN discussion URL: `https://news.ycombinator.com/item?id={id}`

- [ ] Add logging and cost tracking (Architecture Compliance)
  - [ ] Use `logger.info` for fetch operations (start, success, item count)
  - [ ] Track "cost" via `CostTracker` (record 0 cost but track API call count)

- [ ] Create unit tests (AC: 9)
  - [ ] Mock API success response with sample HN story data
  - [ ] Mock API error response (500, 404)
  - [ ] Mock Rate Limit response and verify retry logic
  - [ ] Test data mapping: check title, url, virality scoring
  - [ ] Test keyword filtering: verify AI/ML stories pass, non-AI stories filtered
  - [ ] Test freshness filtering: ensure old stories are excluded
  - [ ] Test limit enforcement: ensure max 10 items returned

## Dev Notes

### Architecture Compliance

**Core Integration (REQUIRED):**
- Import `NexusError` from `@nexus-ai/core` for error handling (`NEXUS_NEWS_SOURCE_FAILED`).
- Import `withRetry` from `@nexus-ai/core` for network resilience.
- Import `logger` from `@nexus-ai/core`.
- Import `CostTracker` from `@nexus-ai/core`.
- Import `StageInput`, `StageOutput` types if needed for consistency.

**Naming Conventions:**
- File: `packages/news-sourcing/src/sources/hacker-news-source.ts`
- Class: `HackerNewsSource`
- Test: `packages/news-sourcing/src/sources/hacker-news-source.test.ts`
- Error Code: `NEXUS_NEWS_SOURCE_FAILED` (with context `source: 'hacker-news'`)

**API Details:**

*Hacker News API (Official Firebase API)*

**Endpoint 1: Top Stories**
- URL: `https://hacker-news.firebaseio.com/v0/topstories.json`
- Method: GET
- Authentication: None (public API)
- Response: `number[]` (array of story IDs)
- Example: `[35123456, 35123457, 35123458, ...]` (up to 500 IDs)

**Endpoint 2: Story Details**
- URL: `https://hacker-news.firebaseio.com/v0/item/{id}.json`
- Method: GET
- Authentication: None (public API)
- Response Structure:
  ```json
  {
    "by": "username",
    "descendants": 42,
    "id": 35123456,
    "score": 150,
    "time": 1704110400,
    "title": "New AI model breaks benchmarks",
    "type": "story",
    "url": "https://example.com/article"
  }
  ```

**Rate Limiting:**
- No official rate limit documented
- Firebase backend is highly scalable
- Implement retry with exponential backoff as best practice
- If 429 received (rare), treat as `RETRYABLE`

### Technical Requirements

**AI/ML Keyword Filtering Logic:**

Story qualifies if ANY of the following match:

**Title Keywords (case-insensitive):**
- Core AI: `AI`, `artificial intelligence`, `machine learning`, `ML`, `deep learning`, `AGI`
- Models: `GPT`, `LLM`, `language model`, `transformer`, `neural network`, `diffusion`
- Techniques: `reinforcement learning`, `RLHF`, `fine-tuning`, `prompt engineering`
- Domains: `computer vision`, `NLP`, `natural language`, `speech recognition`, `TTS`
- Companies/Projects: `OpenAI`, `Anthropic`, `Claude`, `ChatGPT`, `Gemini`, `LLaMA`, `Mistral`

**Domain Filters (known AI/ML domains):**
- `openai.com`, `anthropic.com`, `huggingface.co`, `arxiv.org` (with cs.AI or cs.LG)
- `ai.meta.com`, `deepmind.com`, `google.com/ai`
- `research.google`, `ai.facebook.com`

**Implementation Strategy:**
1. Fetch top 500 story IDs from `/topstories.json`
2. Fetch first 50 stories (batch optimization)
3. Filter by keywords/domains
4. Stop when 10 relevant stories found OR 100 stories checked (whichever comes first)
5. This prevents excessive API calls while ensuring coverage

**Virality Scoring Logic:**

HN uses `score` (points) as primary signal. Comments (`descendants`) indicate engagement.

Formula: `viralityScore = score + (descendants × 0.5)`

Rationale:
- `score` = upvotes - downvotes (primary quality signal)
- `descendants` = total comment count (engagement, but secondary to score)
- Weight comments at 50% of points to prevent spammy discussions from ranking high

Edge cases:
- If `score` is null/undefined: default to 0
- If `descendants` is null/undefined: default to 0
- Ensure `viralityScore ≥ 0` with `Math.max(0, ...)`

**Freshness Logic:**

HN `time` field is Unix timestamp (seconds since epoch).

Filter criteria:
- Convert `time` to JavaScript Date: `new Date(time * 1000)`
- Accept stories from last 24 hours (target freshness, NFR20)
- Accept stories up to 48 hours (deep dive fallback)
- Reject stories older than 48 hours

Implementation:
```typescript
const isFresh = (time: number): boolean => {
  const storyDate = new Date(time * 1000);
  const now = new Date();
  const hoursSince = (now.getTime() - storyDate.getTime()) / (1000 * 60 * 60);
  return hoursSince <= 48;
};
```

**Error Handling Strategy:**

| Error Type | Response Code | Handling |
|------------|---------------|----------|
| 404 Not Found | 404 | Log warning, return empty array (don't crash pipeline) |
| 429 Too Many Requests | 429 | Throw `NexusError.retryable` |
| 5xx Server Error | 500, 502, 503 | Throw `NexusError.retryable` |
| Network Error | ECONNREFUSED, ETIMEDOUT | Throw `NexusError.retryable` |
| Parse Error | - | Throw `NexusError.critical` (API contract changed?) |

**Story Type Filtering:**
- Only accept `type: "story"` (not jobs, polls, comments)
- Skip stories without `url` field (Ask HN, Show HN text posts) unless title is highly relevant

### File Structure Requirements

Following previous implementations (`github-trending-source.ts`, `huggingface-source.ts`):

**File:** `packages/news-sourcing/src/sources/hacker-news-source.ts`

**Exports:**
- `export class HackerNewsSource implements NewsSource`

**Test File:** `packages/news-sourcing/src/sources/hacker-news-source.test.ts`

**Integration:** Export from `packages/news-sourcing/src/index.ts`:
```typescript
export { HackerNewsSource } from './sources/hacker-news-source';
```

### Previous Story Intelligence

From **Story 2.3 (HuggingFace Papers Source)** - completed 2026-01-16:

**Key Learnings:**
1. **Robust Error Handling:** Added comprehensive tests for 404, 500, rate limiting
2. **Null Safety:** Always check for missing fields (e.g., `paper.summary` → default to empty string)
3. **Date Validation:** Prevent `NaN` issues by validating dates before calculations
4. **Virality Scoring:** Use `Math.max(0, ...)` to prevent negative scores
5. **Test Coverage:** Achieved 11/11 tests passing with edge case coverage

**Code Patterns Established:**
- Co-located test files (`*.test.ts` alongside source)
- Logger mocking in tests using `vi.spyOn(logger, 'warn')`
- Comprehensive error response testing (404, 500, network errors)
- Freshness filtering with configurable thresholds

**Testing Approach:**
- Mock all external API calls using `vi.fn()`
- Test happy path with realistic API responses
- Test error paths (404, 500, rate limit, network failure)
- Test edge cases (missing fields, invalid dates, negative scores)
- Verify retry logic triggers correctly
- Verify logging calls

### Git Intelligence

**Recent Commits (packages/news-sourcing):**
- `f9fc595`: "feat(news-sourcing): implement freshness algorithm and refine core integration"
  - Implemented freshness scoring algorithm
  - Refined core package integration patterns
  - Established patterns for `withRetry`, `logger`, `CostTracker`

**Key Files Modified:**
- `packages/news-sourcing/src/sources/github-trending-source.ts`
- `packages/news-sourcing/src/sources/huggingface-source.ts`
- `packages/news-sourcing/src/index.ts`
- `packages/news-sourcing/src/types.ts`

**Code Patterns to Follow:**
All previous implementations use:
1. `withRetry` wrapper for API calls with 3 max retries
2. `logger.info()` for operation logging
3. `NexusError` for error throwing
4. `isFresh()` helper for date filtering
5. Virality score calculation with null safety

### Latest Technical Information

**Hacker News API Documentation (2026):**
- Official API: https://github.com/HackerNews/API
- Base URL: `https://hacker-news.firebaseio.com/v0/`
- Maintained by Firebase (Google)
- No authentication required
- No official rate limits (Firebase scales automatically)
- Response time: typically <100ms per request

**Best Practices:**
- Batch requests: Fetch story IDs first, then fetch details in batches
- Cache results: HN stories don't change once posted
- Respect the community: Don't hammer the API unnecessarily
- Use item-level caching for repeated fetches

**API Endpoints Available:**
- `/topstories.json` - Top stories (up to 500 IDs)
- `/newstories.json` - New stories
- `/beststories.json` - Best stories
- `/askstories.json` - Ask HN stories
- `/showstories.json` - Show HN stories
- `/jobstories.json` - Job postings

**Why Top Stories:**
- Best signal for trending content
- Balanced between recency and community validation
- Already filtered for quality by HN algorithm

### References

- **Hacker News API:** https://github.com/HackerNews/API
- **HN Firebase API:** `https://hacker-news.firebaseio.com/v0/`
- **Previous Implementations:**
  - `packages/news-sourcing/src/sources/github-trending-source.ts`
  - `packages/news-sourcing/src/sources/huggingface-source.ts`
- **Epic 2 Requirements:** _bmad-output/planning-artifacts/epics.md (Story 2.4, lines 753-772)
- **Architecture:** _bmad-output/planning-artifacts/architecture.md
- **Project Context:** _bmad-output/project-context.md

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

- Loaded sprint-status.yaml to identify next backlog story
- Read complete epics.md for Story 2.4 requirements (lines 753-772)
- Read previous story 2.3 (HuggingFace) for implementation patterns
- Read project-context.md for critical architecture rules
- Read architecture.md for technical stack and provider patterns
- Analyzed recent git commits in news-sourcing package
- Researched HN API documentation and best practices

### Completion Notes List

**Story Analysis:**
- Story 2.4 is the next backlog story in Epic 2 (Content Intelligence Pipeline)
- Follows established patterns from Stories 2.2 (GitHub) and 2.3 (HuggingFace)
- Epic 2 is currently in-progress with 3/13 stories complete

**Context Gathered:**
1. **Epic Context:** Story 2.4 is part of news sourcing subsystem (FR1)
2. **Previous Work:** Stories 2.1-2.3 completed, establishing core patterns
3. **Architecture Rules:** All sources must use `NewsSource` interface, `withRetry`, structured logging
4. **Code Patterns:** Learned from Story 2.3 code review fixes (null safety, error handling, test coverage)
5. **Git History:** Recent commits show freshness algorithm implementation

**Developer Guardrails Established:**

**CRITICAL - Must Follow:**
1. Use `withRetry` for ALL API calls (maxRetries: 3)
2. Use `logger.info/warn/error` - NEVER console.log
3. Use `NexusError` with proper severity levels
4. Implement `NewsSource` interface exactly
5. Filter by freshness (24-48 hour window)
6. Return max 10 items
7. Include comprehensive unit tests
8. Handle null/undefined fields safely
9. Use `Math.max(0, ...)` for virality scores
10. Follow kebab-case file naming

**Technical Specifics Provided:**
- HN API endpoints with exact URLs
- Keyword filtering strategy (title + domain)
- Virality scoring formula: `score + (descendants × 0.5)`
- Freshness calculation using Unix timestamps
- Error handling mapping (404 → warn, 429/5xx → retry)
- Batch fetching optimization strategy

**Quality Standards:**
- AC Coverage: 10/10 acceptance criteria detailed
- Test Coverage: Minimum 7 tests (happy path + errors + edge cases)
- Architecture Compliance: Full integration with `@nexus-ai/core`
- Previous Story Learnings: Applied all code review fixes from Story 2.3

**Story Status:**
- Status: ready-for-dev
- Epic Status: Should remain in-progress (Story 2.4 is not first story)
- Next Action: Developer runs `dev-story` to implement

### File List

- `packages/news-sourcing/src/sources/hacker-news-source.ts` (to be created)
- `packages/news-sourcing/src/sources/hacker-news-source.test.ts` (to be created)
- `packages/news-sourcing/src/index.ts` (to be updated)
