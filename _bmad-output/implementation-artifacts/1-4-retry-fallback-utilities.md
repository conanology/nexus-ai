# Story 1.4: Implement Retry and Fallback Utilities

Status: done

## Story

As a developer,
I want retry and fallback utilities for external API calls,
So that transient failures are handled automatically without manual intervention.

## Acceptance Criteria

1. **Given** the error handling framework from Story 1.3
   **When** I implement `withRetry` utility
   **Then** it accepts an async function and options (maxRetries, baseDelay, maxDelay, stage)

2. **And** it retries on RETRYABLE errors up to maxRetries times

3. **And** it uses exponential backoff with jitter between retries

4. **And** it throws after exhausting retries with attempt count in error context

5. **And** it logs each retry attempt with delay duration

6. **Given** the error handling framework from Story 1.3
   **When** I implement `withFallback` utility
   **Then** it accepts an array of providers and an executor function

7. **And** it tries providers in order until one succeeds

8. **And** it returns `{ result, provider, tier, attempts }` on success

9. **And** `tier` is 'primary' for first provider, 'fallback' for others

10. **And** it throws CRITICAL error if all providers fail

11. **And** both utilities are composable: `withRetry(() => withFallback(...))`

## Tasks / Subtasks

- [x] Task 1: Implement withRetry utility (AC: #1-5)
  - [x] Create RetryOptions interface with maxRetries, baseDelay, maxDelay, stage
  - [x] Create RetryResult interface with result, attempts, totalTimeMs
  - [x] Implement exponential backoff calculation with jitter
  - [x] Implement retry loop with error checking
  - [x] Add onRetry callback for logging
  - [x] Throw FALLBACK error after exhausting retries

- [x] Task 2: Implement withFallback utility (AC: #6-10)
  - [x] Create FallbackOptions interface
  - [x] Create FallbackResult interface with result, provider, tier, attempts
  - [x] Implement provider iteration logic
  - [x] Track primary vs fallback tier
  - [x] Throw CRITICAL error when all providers fail

- [x] Task 3: Add helper functions
  - [x] Create isRetryableError function
  - [x] Create calculateDelay function with exponential backoff + jitter
  - [x] Create sleep utility function

- [x] Task 4: Ensure composability (AC: #11)
  - [x] Verify withRetry and withFallback can be nested
  - [x] Export both utilities from utils/index.ts

## Dev Notes

### Retry Strategy

- Default: 3 retries, 1s base delay, 30s max delay
- Exponential backoff: `baseDelay * 2^(attempt-1)`
- Jitter: ±25% randomization to prevent thundering herd

### Fallback Behavior

- Primary provider tried first (tier: 'primary')
- Fallback providers tried in order (tier: 'fallback')
- Each provider gets full retry attempts
- All failures result in CRITICAL error

### Usage Example

```typescript
const result = await withRetry(
  () => withFallback(
    providers.tts,
    (provider) => provider.synthesize(text)
  ),
  { maxRetries: 3, stage: 'tts' }
);
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented withRetry with exponential backoff and ±25% jitter
- Added RetryOptions and RetryResult interfaces
- Implemented withFallback with provider iteration and tier tracking
- Added FallbackOptions and FallbackResult interfaces
- Created helper functions: isRetryableError, calculateDelay, sleep
- Ensured composability of both utilities
- DEFAULT_RETRY_OPTIONS: 3 retries, 1000ms base, 30000ms max

### File List

**Created/Modified:**
- `nexus-ai/packages/core/src/utils/retry.ts` - withRetry implementation
- `nexus-ai/packages/core/src/utils/fallback.ts` - withFallback implementation
- `nexus-ai/packages/core/src/utils/index.ts` - Exports both utilities

### Dependencies

- **Upstream Dependencies:** Story 1.3 (Error Handling Framework)
- **Downstream Dependencies:** Story 1.5 (Provider Abstraction), all API-calling stages
