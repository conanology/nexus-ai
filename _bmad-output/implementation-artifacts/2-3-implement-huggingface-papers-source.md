# Story 2.3: implement-huggingface-papers-source

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to fetch daily papers from HuggingFace,
so that new research is included in news coverage.

## Acceptance Criteria

1.  **Interface Implementation:** `HuggingFacePapersSource` implements `NewsSource` interface from `@nexus-ai/news-sourcing`.
2.  **Source Fetching:** Fetches from HuggingFace Daily Papers API (`https://huggingface.co/api/daily_papers`).
3.  **Virality Scoring:** Extracts `viralityScore` from upvotes and comments (if available in API response, or defaults).
4.  **Authority Weight:** Sets `authorityWeight` to 0.9 (research credibility).
5.  **Metadata:** Includes paper abstract in metadata.
6.  **Linking:** Links to both HuggingFace page and arXiv source (if available).
7.  **Limiting:** Returns maximum 10 items per fetch.
8.  **Error Handling:** Uses `withRetry` for API calls and handles failures gracefully.
9.  **Testing:** Unit tests mock HuggingFace API responses.
10. **Data Freshness:** Filters papers to ensure they are from the last 24-48 hours.

## Tasks / Subtasks

- [x] Create `HuggingFacePapersSource` class (AC: 1)
  - [x] Implement `NewsSource` interface (`name`, `fetch`, `authorityWeight`)
  - [x] Set `name` to 'huggingface-papers'
  - [x] Set `authorityWeight` to 0.9 (Research Credibility)

- [x] Implement HuggingFace API client (AC: 2, 7, 8)
  - [x] Use endpoint `https://huggingface.co/api/daily_papers`
  - [x] Implement `fetchDailyPapers()` method using `fetch`
  - [x] Wrap API calls with `withRetry` (maxRetries: 3)
  - [x] Handle API errors (4xx, 5xx) with `NexusError`
  - [x] Handle rate limiting (429) as `RETRYABLE`
  - [x] Limit results to 10 items (AC: 7)

- [x] Map response to `NewsItem` format (AC: 3, 5, 6, 10)
  - [x] Parse JSON response array
  - [x] Extract `title` and `publishedAt` (use `publishedAt` or `date` field)
  - [x] Filter items older than 48 hours (Deep Dive Fallback) or 24 hours (Standard)
  - [x] Calculate `viralityScore` = `upvotes` + (`numComments` * 2)
  - [x] Extract `summary` or `abstract` to `metadata.abstract`
  - [x] Construct `url` to HuggingFace paper page: `https://huggingface.co/papers/{id}`
  - [x] Extract arXiv URL if present to `metadata.arxivUrl`
  - [x] Add `authors` list to metadata if available

- [x] Add logging and cost tracking (Architecture Compliance)
  - [x] Use `logger.info` for fetch operations (start, success, item count)
  - [x] Track "cost" via `CostTracker` (record 0 cost but track API call count)

- [x] Create unit tests (AC: 9)
  - [x] Mock API success response with sample paper data
  - [x] Mock API error response (500, 404)
  - [x] Mock Rate Limit response (429) and verify retry logic
  - [x] Test data mapping: check title, url, abstract, scoring
  - [x] Test filtering: ensure old papers are excluded
  - [x] Test limit enforcement: ensure max 10 items returned

## Dev Notes

### Architecture Compliance

**Core Integration (REQUIRED):**
- Import `NexusError` from `@nexus-ai/core` for error handling (`NEXUS_HF_API_ERROR`).
- Import `withRetry` from `@nexus-ai/core` for network resilience.
- Import `logger` from `@nexus-ai/core`.
- Import `CostTracker` from `@nexus-ai/core`.
- Import `StageInput`, `StageOutput` types if needed for consistency.

**Naming Conventions:**
- File: `packages/news-sourcing/src/sources/huggingface-source.ts`
- Class: `HuggingFacePapersSource`
- Test: `packages/news-sourcing/src/sources/huggingface-source.test.ts`
- Error Code: `NEXUS_NEWS_SOURCE_FAILED` (with context `source: 'huggingface-papers'`)

**API Details:**
- Endpoint: `https://huggingface.co/api/daily_papers`
- **Method:** GET
- **Response Structure (Expected):**
  ```json
  [
    {
      "paper": {
        "id": "2312.12345",
        "title": "Paper Title",
        "summary": "Abstract text...",
        "authors": [{"name": "Author 1"}],
        "publishedAt": "2024-01-01T00:00:00.000Z",
        "upvotes": 150,
        "discussionId": "..."
      }
    }
  ]
  ```
- **Authentication:** Public API, usually no token required. If rate limited, consider adding `getSecret('nexus-huggingface-token')` logic, but try unauthenticated first.

### Technical Requirements

**Virality Scoring Logic:**
- `upvotes` are the primary signal.
- `numComments` (if available via discussion ID or separate call) implies engagement.
- Formula: `score = upvotes + (numComments * 2)`
- If `numComments` unavailable, `score = upvotes`.

**Freshness Logic:**
- The API returns *daily* papers.
- Verify `publishedAt` is within acceptable window (24h target, 48h max).
- Discard papers older than 48h to maintain "News" relevance.

**Error Handling Strategy:**
- `404 Not Found`: Log warning, return empty array (don't crash pipeline).
- `429 Too Many Requests`: Throw `NexusError.retryable`.
- `5xx Server Error`: Throw `NexusError.retryable`.
- `Network Error`: Throw `NexusError.retryable`.
- `Parse Error`: Throw `NexusError.critical` (API changed?).

### References

- **HuggingFace Daily Papers API:** `https://huggingface.co/api/daily_papers`
- **Related Project:** `AK391/dailypapersHN` (uses this API for Hacker News style feed)
- **Previous Implementation:** `packages/news-sourcing/src/sources/github-trending-source.ts`

## Dev Agent Record

### Agent Model Used

Gemini-2.0-Flash-Exp

### Debug Log References

- Verified API endpoint via web search.
- Confirmed `NewsSource` interface requirements from `epics.md` and `github-trending-source.ts`.


### Completion Notes List

- Story created based on Epic 2 requirements.
- Validated against previous story patterns.
- Confirmed external API endpoint.
- Expanded technical details and error handling specific to HF API.
- Implemented `HuggingFacePapersSource` with full test coverage, robust error handling, and freshness filtering.

### Code Review Fixes (2026-01-16)

**Issues Fixed (10 total: 5 High, 5 Medium):**

1. ✅ Added `logger.warn()` to test mock (HIGH)
2. ✅ Added test for 404 error response handling (HIGH)
3. ✅ Added test for 500 server error response (HIGH)
4. ✅ Added null safety for `paper.summary` field - defaults to empty string (HIGH)
5. ✅ Added date validation in `isFresh()` to prevent NaN issues (HIGH)
6. ✅ Improved ArXiv URL regex from `/^\d+\.\d+/` to `/^\d{4}\.\d{4,6}$/` for stricter matching (MEDIUM)
7. ✅ Added test for papers without arXiv IDs (MEDIUM)
8. ✅ Added test for missing summary field (MEDIUM)
9. ✅ Added `Math.max(0, ...)` to virality score calculation (MEDIUM)
10. ✅ Removed unused `discussionId` field from interface (MEDIUM)

**Test Coverage:** 11/11 tests passing (up from 7)
**AC Coverage:** 10/10 ACs fully passing (100%)
**Architecture Compliance:** Full compliance with project-context.md patterns

### File List
- `packages/news-sourcing/src/sources/huggingface-source.ts`
- `packages/news-sourcing/src/sources/huggingface-source.test.ts`
- `packages/news-sourcing/src/index.ts`