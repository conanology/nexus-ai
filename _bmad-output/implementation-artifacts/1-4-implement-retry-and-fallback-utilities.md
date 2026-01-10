# Story 1.4: Implement Retry and Fallback Utilities

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want retry and fallback utilities for external API calls,
So that transient failures are handled automatically without manual intervention.

## Acceptance Criteria

**Given** the error handling framework from Story 1.3
**When** I implement `withRetry` utility
**Then** it accepts an async function and options (maxRetries, baseDelay, maxDelay, stage)
**And** it retries on RETRYABLE errors up to maxRetries times
**And** it uses exponential backoff with jitter between retries
**And** it throws after exhausting retries with attempt count in error context
**And** it logs each retry attempt with delay duration

**Given** the error handling framework from Story 1.3
**When** I implement `withFallback` utility
**Then** it accepts an array of providers and an executor function
**And** it tries providers in order until one succeeds
**And** it returns `{ result, provider, tier, attempts }` on success
**And** `tier` is 'primary' for first provider, 'fallback' for others
**And** it throws CRITICAL error if all providers fail
**And** it logs each fallback attempt with provider name

**And** both utilities are composable: `withRetry(() => withFallback(...))`
**And** unit tests cover success, retry, fallback, and exhaustion scenarios

## Tasks / Subtasks

- [x] Implement withRetry utility (AC: Retry functionality)
  - [x] Create utils/with-retry.ts with withRetry function
  - [x] Accept async function and RetryOptions (maxRetries, baseDelay, maxDelay, stage)
  - [x] Implement exponential backoff: delay = min(baseDelay * 2^attempt, maxDelay)
  - [x] Add jitter: delay = delay * (0.5 + Math.random() * 0.5)
  - [x] Check error.retryable using isRetryable() from errors module
  - [x] Log each retry attempt with delay and attempt number (via onRetry callback)
  - [x] Throw with attempt count in context after exhausting retries

- [x] Implement withFallback utility (AC: Fallback functionality)
  - [x] Create utils/with-fallback.ts with withFallback function
  - [x] Accept providers array and executor function
  - [x] Try providers sequentially until one succeeds
  - [x] Return FallbackResult { result, provider, tier, attempts }
  - [x] Set tier: 'primary' for index 0, 'fallback' for others
  - [x] Track all attempts and their errors
  - [x] Throw CRITICAL error with all attempt details if all fail
  - [x] Log each fallback attempt with provider name (via onFallback callback)

- [x] Define utility types (AC: Type safety)
  - [x] RetryOptions interface with maxRetries, baseDelay, maxDelay, stage
  - [x] RetryResult<T> interface with result, attempts, totalDelayMs
  - [x] FallbackOptions interface with stage, onFallback callback
  - [x] FallbackResult<T> interface with result, provider, tier, attempts
  - [x] FallbackAttempt interface for tracking individual attempts

- [x] Implement helper utilities (Bonus: Enhanced functionality)
  - [x] sleep(ms) utility for delay between retries
  - [x] calculateDelay(attempt, baseDelay, maxDelay) for backoff calculation
  - [x] Retry context included in error context automatically

- [x] Configure package exports (AC: Exports)
  - [x] Export withRetry from utils/index.ts
  - [x] Export withFallback from utils/index.ts
  - [x] Export types from utils/index.ts
  - [x] Ensure @nexus-ai/core exports all utilities

- [x] Write comprehensive tests (AC: Unit tests)
  - [x] Test withRetry succeeds on first attempt
  - [x] Test withRetry retries on RETRYABLE errors
  - [x] Test withRetry does NOT retry on non-RETRYABLE errors
  - [x] Test withRetry uses exponential backoff with jitter
  - [x] Test withRetry throws after max retries exhausted
  - [x] Test withFallback uses primary provider first
  - [x] Test withFallback falls back on any errors
  - [x] Test withFallback returns correct tier for each provider
  - [x] Test withFallback throws CRITICAL when all providers fail
  - [x] Test withRetry and withFallback compose correctly

## Dev Notes

### Relevant Architecture Patterns

**Retry Pattern (from Architecture):**
- Exponential backoff with configurable base/max delay
- Quality-aware retries (retry if output quality poor)
- Per-service retry configuration
- Track attempts and quality retries separately

**Fallback Pattern (from Architecture):**
- Try providers in order
- Log fallback usage
- Track which provider succeeded
- Mark output as `tier: 'fallback'`

**Provider Registry (from Architecture):**
```typescript
const providers = {
  llm: {
    primary: GeminiProvider('gemini-3-pro-preview'),
    fallbacks: [GeminiProvider('gemini-2.5-pro')]
  },
  tts: {
    primary: GeminiTTSProvider('gemini-2.5-pro-tts'),
    fallbacks: [ChirpProvider('chirp3-hd'), WaveNetProvider()]
  }
};
```

**NFR14-17 (Integration Resilience):**
- NFR14: API timeout handling must be configurable per external service
- NFR15: System must attempt 3 retries before triggering fallback
- NFR16: YouTube API quota usage must stay below 80% of daily quota
- NFR17: External API availability must be verified via health check

### Technical Requirements (from Architecture)

**withRetry Function Signature:**
```typescript
interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  baseDelay?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelay?: number;
  /** Stage name for error context */
  stage?: string;
  /** Optional callback for each retry attempt */
  onRetry?: (attempt: number, delay: number, error: NexusError) => void;
}

interface RetryResult<T> {
  /** The successful result */
  result: T;
  /** Number of attempts made (1 = first try succeeded) */
  attempts: number;
  /** Total time spent on retries in ms */
  totalDelayMs: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<RetryResult<T>>;
```

**withFallback Function Signature:**
```typescript
interface FallbackOptions {
  /** Stage name for error context */
  stage?: string;
  /** Optional callback when fallback is triggered */
  onFallback?: (fromProvider: string, toProvider: string, error: NexusError) => void;
}

interface FallbackAttempt {
  /** Provider name that was attempted */
  provider: string;
  /** Whether this attempt succeeded */
  success: boolean;
  /** Error if attempt failed */
  error?: NexusError;
  /** Duration of this attempt in ms */
  durationMs: number;
}

interface FallbackResult<T> {
  /** The successful result */
  result: T;
  /** Name of the provider that succeeded */
  provider: string;
  /** 'primary' if first provider, 'fallback' otherwise */
  tier: 'primary' | 'fallback';
  /** All attempts made (successful + failed) */
  attempts: FallbackAttempt[];
}

async function withFallback<T, P extends { name: string }>(
  providers: P[],
  executor: (provider: P) => Promise<T>,
  options?: FallbackOptions
): Promise<FallbackResult<T>>;
```

**Exponential Backoff with Jitter:**
```typescript
function calculateDelay(
  attempt: number,      // 0-indexed attempt number
  baseDelay: number,    // e.g., 1000ms
  maxDelay: number      // e.g., 30000ms
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter: 50-100% of the delay (prevents thundering herd)
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(cappedDelay * jitter);
}
```

**Usage Pattern in Stages:**
```typescript
// Combined retry + fallback (most common pattern)
const result = await withRetry(
  () => withFallback(
    [geminiTTS, chirpHD, wavenet],
    (provider) => provider.synthesize(text),
    { stage: 'tts' }
  ),
  { maxRetries: 3, stage: 'tts' }
);

// Access result
const { result: audio, provider, tier, attempts } = result.result;
console.log(`TTS succeeded with ${provider} (${tier}) after ${attempts.length} provider attempts`);
```

**Integration with NexusError (from Story 1.3):**
```typescript
import {
  NexusError, isRetryable, shouldFallback,
  NEXUS_LLM_TIMEOUT, NEXUS_LLM_RATE_LIMIT
} from '@nexus-ai/core';

// withRetry checks error.retryable
async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<RetryResult<T>> {
  let attempts = 0;
  let totalDelayMs = 0;

  while (attempts <= (options.maxRetries ?? 3)) {
    try {
      const result = await fn();
      return { result, attempts: attempts + 1, totalDelayMs };
    } catch (error) {
      const nexusError = NexusError.fromError(error, options.stage);

      // Only retry if error is retryable
      if (!isRetryable(nexusError) || attempts >= (options.maxRetries ?? 3)) {
        // Add retry context to error
        throw NexusError.fromError(nexusError, options.stage, {
          ...nexusError.context,
          retryAttempts: attempts + 1,
          exhaustedRetries: true
        });
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempts, options.baseDelay ?? 1000, options.maxDelay ?? 30000);
      totalDelayMs += delay;

      // Log retry attempt
      options.onRetry?.(attempts + 1, delay, nexusError);

      await sleep(delay);
      attempts++;
    }
  }

  // Should never reach here, but TypeScript requires a return
  throw NexusError.critical('NEXUS_RETRY_EXHAUSTED', 'Max retries exceeded', options.stage);
}
```

**Integration with withFallback:**
```typescript
// withFallback checks for FALLBACK severity
async function withFallback<T, P extends { name: string }>(
  providers: P[],
  executor: (provider: P) => Promise<T>,
  options?: FallbackOptions
): Promise<FallbackResult<T>> {
  const attempts: FallbackAttempt[] = [];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const startTime = Date.now();

    try {
      const result = await executor(provider);

      attempts.push({
        provider: provider.name,
        success: true,
        durationMs: Date.now() - startTime
      });

      return {
        result,
        provider: provider.name,
        tier: i === 0 ? 'primary' : 'fallback',
        attempts
      };
    } catch (error) {
      const nexusError = NexusError.fromError(error, options?.stage);

      attempts.push({
        provider: provider.name,
        success: false,
        error: nexusError,
        durationMs: Date.now() - startTime
      });

      // Log fallback (if not last provider)
      if (i < providers.length - 1) {
        const nextProvider = providers[i + 1];
        options?.onFallback?.(provider.name, nextProvider.name, nexusError);
      }

      // Continue to next provider (regardless of error type)
      // Fallback handles ALL errors, not just FALLBACK severity
    }
  }

  // All providers failed
  throw NexusError.critical(
    'NEXUS_FALLBACK_EXHAUSTED',
    `All ${providers.length} providers failed`,
    options?.stage,
    {
      attempts: attempts.map(a => ({
        provider: a.provider,
        error: a.error?.code
      }))
    }
  );
}
```

### Project Structure Notes

**File Location:**
```
packages/core/src/
├── utils/
│   ├── index.ts              # Barrel exports
│   ├── with-retry.ts         # withRetry function
│   ├── with-fallback.ts      # withFallback function
│   ├── sleep.ts              # sleep utility
│   └── __tests__/
│       ├── with-retry.test.ts
│       └── with-fallback.test.ts
├── errors/                   # EXISTS (from Story 1.3)
│   ├── nexus-error.ts
│   └── codes.ts
├── types/                    # EXISTS (from Story 1.2)
└── index.ts                  # Main package export
```

**Export Configuration:**
- `@nexus-ai/core` -> exports withRetry, withFallback, and all types
- `@nexus-ai/core/utils` -> direct access to utils module (optional)

**Naming Conventions:**
- File: `with-retry.ts`, `with-fallback.ts` (kebab-case)
- Function: `withRetry`, `withFallback` (camelCase)
- Interface: `RetryOptions`, `FallbackResult` (PascalCase)

### Previous Story Intelligence (1.3)

**What Was Established:**
- `NexusError` class with severity-based error handling
- `isRetryable(error)` type guard - returns true ONLY for RETRYABLE severity
- `shouldFallback(error)` type guard - returns true for FALLBACK severity
- `NexusError.fromError(error, stage)` wraps unknown errors
- Error codes: NEXUS_LLM_TIMEOUT, NEXUS_TTS_RATE_LIMIT, etc.
- All errors in `packages/core/src/errors/`

**Patterns to Follow:**
- Use `isRetryable()` to check if error should be retried
- Use `NexusError.fromError()` to wrap unknown errors
- Include stage in all error context
- Tests co-located in `__tests__/` directories
- Vitest for testing with describe/it/expect pattern

**Integration Points:**
- withRetry uses `isRetryable()` from errors module
- withFallback catches all errors and tries next provider
- Both wrap final errors with `NexusError.fromError()`
- Future: executeStage (1.10) will use these utilities

### Git Intelligence (Recent Commits)

**Last Commit (411b3dd):**
- Implemented complete error handling framework for Story 1.3
- 241 tests all passing
- ErrorSeverity, NexusError, isRetryable, shouldFallback available
- Error codes NEXUS_* available for use

**Files to Integrate With:**
- `packages/core/src/errors/nexus-error.ts` - NexusError class
- `packages/core/src/errors/codes.ts` - Error codes
- `packages/core/src/errors/index.ts` - Error exports
- `packages/core/src/index.ts` - Package exports

**Commit Message Pattern:**
```
feat(core): implement retry and fallback utilities

Complete Story 1-4: Implement Retry and Fallback Utilities

- Create withRetry for exponential backoff with jitter
- Create withFallback for provider chain with tier tracking
- Integrate with NexusError (isRetryable, shouldFallback)
- Add sleep and calculateDelay helper utilities
- Comprehensive unit tests (X tests, all passing)

All acceptance criteria met. Ready for Story 1.5.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### References

- [Epic 1: Story 1.4 Acceptance Criteria](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/epics.md#story-14-implement-retry-and-fallback-utilities)
- [Architecture: Retry Pattern](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/architecture.md#retry-pattern)
- [Architecture: Fallback Pattern](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/planning-artifacts/architecture.md#fallback-pattern)
- [Project Context: Provider Abstraction](file:///D:/05_Work/NEXUS-AI-PROJECT/_bmad-output/project-context.md#provider-abstraction)
- [Story 1.3: NexusError and isRetryable](file:///D:/05_Work/NEXUS-AI-PROJECT/packages/core/src/errors/nexus-error.ts)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Implemented `withRetry` utility with exponential backoff and jitter (50-100%)
- Implemented `withFallback` utility with provider chain and tier tracking
- Created helper functions: `sleep(ms)` and `calculateDelay(attempt, baseDelay, maxDelay)`
- All utilities integrate with NexusError from Story 1.3
- withRetry only retries errors where `isRetryable(error)` returns true
- withFallback tries ALL providers on any error for maximum resilience
- Both utilities composable: `withRetry(() => withFallback(...))`
- 63 new tests added (34 withRetry, 24 withFallback, 5 composition)
- All 338 tests passing (no regressions)

### Code Review Fixes Applied

- Added error codes to codes.ts: NEXUS_RETRY_EXHAUSTED, NEXUS_RETRY_LOGIC_ERROR, NEXUS_RETRY_INVALID_OPTIONS, NEXUS_FALLBACK_EXHAUSTED, NEXUS_FALLBACK_NO_PROVIDERS
- Fixed unused imports in with-fallback.test.ts (beforeEach, afterEach, FallbackResult)
- Added input validation for negative options in withRetry (maxRetries, baseDelay, maxDelay)
- Added 4 new tests for input validation edge cases

### File List

New files:
- packages/core/src/utils/with-retry.ts
- packages/core/src/utils/with-fallback.ts
- packages/core/src/utils/index.ts
- packages/core/src/utils/__tests__/with-retry.test.ts
- packages/core/src/utils/__tests__/with-fallback.test.ts
- packages/core/src/utils/__tests__/composition.test.ts

Modified files:
- packages/core/src/index.ts (added utils export)
- packages/core/src/errors/codes.ts (added Retry and Fallback domain error codes)

## Change Log

- 2026-01-10: Code review fixes - added error codes, input validation, fixed build errors
- 2026-01-10: Implemented retry and fallback utilities (Story 1-4)

---

## COMPREHENSIVE DEVELOPER CONTEXT

### MISSION CRITICAL: Resilience Utilities for Pipeline Reliability

This story creates the **resilience foundation** that ensures the pipeline:
1. Automatically retries transient failures (timeouts, rate limits)
2. Falls back to alternate providers when primary fails
3. Tracks all attempts for debugging and cost analysis
4. Composes cleanly for complex retry+fallback scenarios

**Every external API call in Epic 2-5 will use these utilities.**

### EXHAUSTIVE RETRY ANALYSIS

#### 1. withRetry Implementation

**Complete Implementation:**
```typescript
// packages/core/src/utils/with-retry.ts

import { NexusError, isRetryable } from '../errors';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  baseDelay?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelay?: number;
  /** Stage name for error context */
  stage?: string;
  /** Optional callback for each retry attempt */
  onRetry?: (attempt: number, delay: number, error: NexusError) => void;
}

export interface RetryResult<T> {
  /** The successful result */
  result: T;
  /** Number of attempts made (1 = first try succeeded) */
  attempts: number;
  /** Total time spent on retries in ms */
  totalDelayMs: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param attempt - 0-indexed attempt number
 * @param baseDelay - Initial delay in ms
 * @param maxDelay - Maximum delay in ms
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter: 50-100% of the delay (prevents thundering herd)
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(cappedDelay * jitter);
}

/**
 * Retry an async operation with exponential backoff
 *
 * Only retries on errors where isRetryable(error) returns true.
 * Non-retryable errors are thrown immediately.
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => apiClient.generateText(prompt),
 *   { maxRetries: 3, stage: 'script-gen' }
 * );
 * console.log(`Succeeded after ${result.attempts} attempts`);
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = DEFAULT_BASE_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    stage,
    onRetry
  } = options;

  let attempts = 0;
  let totalDelayMs = 0;
  const errors: Array<{ attempt: number; error: NexusError; delay: number }> = [];

  while (attempts <= maxRetries) {
    try {
      const result = await fn();
      return { result, attempts: attempts + 1, totalDelayMs };
    } catch (error) {
      const nexusError = NexusError.fromError(error, stage);

      // Only retry if error is retryable AND we have retries left
      if (!isRetryable(nexusError) || attempts >= maxRetries) {
        // Throw with full retry context
        throw NexusError.critical(
          nexusError.code,
          nexusError.message,
          stage,
          {
            ...nexusError.context,
            originalSeverity: nexusError.severity,
            retryAttempts: attempts + 1,
            exhaustedRetries: attempts >= maxRetries,
            retryHistory: errors.map(e => ({
              attempt: e.attempt,
              error: e.error.code,
              delay: e.delay
            }))
          }
        );
      }

      // Calculate delay for this retry
      const delay = calculateDelay(attempts, baseDelay, maxDelay);
      totalDelayMs += delay;

      // Record this attempt
      errors.push({ attempt: attempts + 1, error: nexusError, delay });

      // Notify callback if provided
      onRetry?.(attempts + 1, delay, nexusError);

      // Wait before retrying
      await sleep(delay);
      attempts++;
    }
  }

  // TypeScript requires a return, but we should never reach here
  throw NexusError.critical(
    'NEXUS_RETRY_LOGIC_ERROR',
    'Unexpected exit from retry loop',
    stage
  );
}
```

**Key Implementation Details:**
- Returns `RetryResult<T>` with attempts count and total delay
- Only retries errors where `isRetryable(error)` returns true
- Non-retryable errors (FALLBACK, DEGRADED, CRITICAL) throw immediately
- Exponential backoff: 1s, 2s, 4s, 8s... capped at maxDelay
- Jitter prevents thundering herd when multiple instances retry
- Error context includes full retry history for debugging

---

#### 2. withFallback Implementation

**Complete Implementation:**
```typescript
// packages/core/src/utils/with-fallback.ts

import { NexusError } from '../errors';

export interface FallbackOptions {
  /** Stage name for error context */
  stage?: string;
  /** Optional callback when fallback is triggered */
  onFallback?: (fromProvider: string, toProvider: string, error: NexusError) => void;
}

export interface FallbackAttempt {
  /** Provider name that was attempted */
  provider: string;
  /** Whether this attempt succeeded */
  success: boolean;
  /** Error if attempt failed */
  error?: NexusError;
  /** Duration of this attempt in ms */
  durationMs: number;
}

export interface FallbackResult<T> {
  /** The successful result */
  result: T;
  /** Name of the provider that succeeded */
  provider: string;
  /** 'primary' if first provider, 'fallback' otherwise */
  tier: 'primary' | 'fallback';
  /** All attempts made (successful + failed) */
  attempts: FallbackAttempt[];
}

/** Provider must have a name property for tracking */
export interface NamedProvider {
  name: string;
}

/**
 * Try multiple providers in order until one succeeds
 *
 * Falls back to the next provider on ANY error (not just FALLBACK severity).
 * This ensures maximum resilience - if primary fails for any reason,
 * we try fallbacks before giving up.
 *
 * @example
 * ```typescript
 * const { result, provider, tier } = await withFallback(
 *   [geminiTTS, chirpHD, wavenet],
 *   (p) => p.synthesize(text),
 *   { stage: 'tts' }
 * );
 * console.log(`TTS succeeded with ${provider} (${tier})`);
 * ```
 */
export async function withFallback<T, P extends NamedProvider>(
  providers: P[],
  executor: (provider: P) => Promise<T>,
  options: FallbackOptions = {}
): Promise<FallbackResult<T>> {
  const { stage, onFallback } = options;

  if (providers.length === 0) {
    throw NexusError.critical(
      'NEXUS_FALLBACK_NO_PROVIDERS',
      'No providers configured for fallback',
      stage
    );
  }

  const attempts: FallbackAttempt[] = [];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const startTime = Date.now();

    try {
      const result = await executor(provider);

      attempts.push({
        provider: provider.name,
        success: true,
        durationMs: Date.now() - startTime
      });

      return {
        result,
        provider: provider.name,
        tier: i === 0 ? 'primary' : 'fallback',
        attempts
      };
    } catch (error) {
      const nexusError = NexusError.fromError(error, stage);

      attempts.push({
        provider: provider.name,
        success: false,
        error: nexusError,
        durationMs: Date.now() - startTime
      });

      // Notify callback if not last provider
      if (i < providers.length - 1) {
        const nextProvider = providers[i + 1];
        onFallback?.(provider.name, nextProvider.name, nexusError);
      }

      // Continue to next provider
      // We try ALL providers regardless of error type
    }
  }

  // All providers failed - throw CRITICAL error
  throw NexusError.critical(
    'NEXUS_FALLBACK_EXHAUSTED',
    `All ${providers.length} providers failed`,
    stage,
    {
      attempts: attempts.map(a => ({
        provider: a.provider,
        success: a.success,
        errorCode: a.error?.code,
        durationMs: a.durationMs
      }))
    }
  );
}
```

**Key Implementation Details:**
- Returns `FallbackResult<T>` with provider name and tier
- `tier: 'primary'` for first provider (index 0), `'fallback'` for others
- Tries ALL providers on any error (not just FALLBACK severity)
- Tracks all attempts including durations and errors
- Throws CRITICAL with full attempt history when all fail
- Provider must have `name` property for tracking

---

#### 3. Composing withRetry and withFallback

**Combined Pattern (Most Common):**
```typescript
// Stage implementation pattern
export async function executeTTS(
  input: StageInput<TTSInput>
): Promise<StageOutput<TTSOutput>> {
  const providers = [
    { name: 'gemini-2.5-pro-tts', provider: geminiTTS },
    { name: 'chirp3-hd', provider: chirpHD },
    { name: 'wavenet', provider: wavenet }
  ];

  // Retry wraps fallback - retries the entire fallback chain
  const retryResult = await withRetry(
    async () => {
      const fallbackResult = await withFallback(
        providers,
        ({ provider }) => provider.synthesize(input.data.script),
        {
          stage: 'tts',
          onFallback: (from, to, error) => {
            logger.warn('TTS fallback triggered', {
              pipelineId: input.pipelineId,
              stage: 'tts',
              fromProvider: from,
              toProvider: to,
              error: error.code
            });
          }
        }
      );
      return fallbackResult;
    },
    {
      maxRetries: 3,
      stage: 'tts',
      onRetry: (attempt, delay, error) => {
        logger.info('TTS retry', {
          pipelineId: input.pipelineId,
          stage: 'tts',
          attempt,
          delayMs: delay,
          error: error.code
        });
      }
    }
  );

  // Extract results
  const { result: fallbackResult, attempts: retryAttempts } = retryResult;
  const { result: audio, provider, tier, attempts: providerAttempts } = fallbackResult;

  return {
    success: true,
    data: audio,
    provider: {
      name: provider,
      tier,
      attempts: retryAttempts
    },
    // ... rest of StageOutput
  };
}
```

**Why This Order:**
- withRetry wraps withFallback (not vice versa)
- If primary provider has a transient failure, withRetry retries the ENTIRE fallback chain
- This maximizes resilience: retry with primary first, then fallback, then retry again

**Alternative: Retry Each Provider:**
```typescript
// Less common - retry each provider individually
const result = await withFallback(
  providers,
  async (provider) => {
    return await withRetry(
      () => provider.execute(data),
      { maxRetries: 2, stage: 'tts' }
    );
  },
  { stage: 'tts' }
);
```

---

#### 4. Delay Calculation Examples

**Exponential Backoff with Jitter:**

| Attempt | Base Exponential | With Jitter (50-100%) |
|---------|------------------|----------------------|
| 0 | 1000ms | 500-1000ms |
| 1 | 2000ms | 1000-2000ms |
| 2 | 4000ms | 2000-4000ms |
| 3 | 8000ms | 4000-8000ms |
| 4 | 16000ms | 8000-16000ms |
| 5 | 30000ms (capped) | 15000-30000ms |

**Why Jitter:**
- Prevents "thundering herd" when multiple instances hit rate limit
- If 10 pipelines fail at same time, they'd all retry at same interval
- Jitter spreads retries across time window

---

#### 5. Testing Strategy

**withRetry Tests:**
```typescript
describe('withRetry', () => {
  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on RETRYABLE errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(NexusError.retryable('NEXUS_LLM_TIMEOUT', 'Timeout'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on non-RETRYABLE errors', async () => {
    const fn = vi.fn()
      .mockRejectedValue(NexusError.critical('NEXUS_PIPELINE_ABORTED', 'Aborted'));

    await expect(withRetry(fn, { maxRetries: 3 }))
      .rejects.toThrow('Aborted');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after exhausting retries', async () => {
    const fn = vi.fn()
      .mockRejectedValue(NexusError.retryable('NEXUS_LLM_TIMEOUT', 'Timeout'));

    await expect(withRetry(fn, { maxRetries: 2 }))
      .rejects.toMatchObject({
        code: 'NEXUS_LLM_TIMEOUT',
        context: expect.objectContaining({
          retryAttempts: 3, // 1 initial + 2 retries
          exhaustedRetries: true
        })
      });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff with jitter', async () => {
    // Test delay calculations
    const delays: number[] = [];
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: Function, ms: number) => {
      delays.push(ms);
      fn();
      return 0 as any;
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(NexusError.retryable('NEXUS_LLM_TIMEOUT', 'T1'))
      .mockRejectedValueOnce(NexusError.retryable('NEXUS_LLM_TIMEOUT', 'T2'))
      .mockResolvedValueOnce('success');

    await withRetry(fn, { maxRetries: 3, baseDelay: 1000, maxDelay: 10000 });

    // Verify delays increase (jitter means we can't check exact values)
    expect(delays[0]).toBeGreaterThanOrEqual(500);
    expect(delays[0]).toBeLessThanOrEqual(1000);
    expect(delays[1]).toBeGreaterThanOrEqual(1000);
    expect(delays[1]).toBeLessThanOrEqual(2000);
  });
});
```

**withFallback Tests:**
```typescript
describe('withFallback', () => {
  const providers = [
    { name: 'primary' },
    { name: 'fallback1' },
    { name: 'fallback2' }
  ];

  it('should use primary provider first', async () => {
    const executor = vi.fn().mockResolvedValue('success');

    const result = await withFallback(providers, executor);

    expect(result.provider).toBe('primary');
    expect(result.tier).toBe('primary');
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith(providers[0]);
  });

  it('should fallback on error', async () => {
    const executor = vi.fn()
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockResolvedValueOnce('success');

    const result = await withFallback(providers, executor);

    expect(result.provider).toBe('fallback1');
    expect(result.tier).toBe('fallback');
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('should track all attempts', async () => {
    const executor = vi.fn()
      .mockRejectedValueOnce(new Error('P1 failed'))
      .mockRejectedValueOnce(new Error('P2 failed'))
      .mockResolvedValueOnce('success');

    const result = await withFallback(providers, executor);

    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0].success).toBe(false);
    expect(result.attempts[1].success).toBe(false);
    expect(result.attempts[2].success).toBe(true);
  });

  it('should throw CRITICAL when all providers fail', async () => {
    const executor = vi.fn().mockRejectedValue(new Error('Failed'));

    await expect(withFallback(providers, executor, { stage: 'tts' }))
      .rejects.toMatchObject({
        code: 'NEXUS_FALLBACK_EXHAUSTED',
        severity: ErrorSeverity.CRITICAL,
        stage: 'tts'
      });

    expect(executor).toHaveBeenCalledTimes(3);
  });

  it('should call onFallback callback', async () => {
    const onFallback = vi.fn();
    const executor = vi.fn()
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce('success');

    await withFallback(providers, executor, { onFallback });

    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith('primary', 'fallback1', expect.any(NexusError));
  });
});
```

**Composition Tests:**
```typescript
describe('withRetry + withFallback composition', () => {
  it('should retry the entire fallback chain', async () => {
    const providers = [{ name: 'primary' }, { name: 'fallback' }];

    // First attempt: both providers fail with retryable
    // Second attempt: primary succeeds
    let call = 0;
    const executor = vi.fn().mockImplementation((p) => {
      call++;
      if (call <= 2) {
        throw NexusError.retryable('NEXUS_LLM_TIMEOUT', 'Timeout');
      }
      return 'success';
    });

    const result = await withRetry(
      () => withFallback(providers, executor),
      { maxRetries: 3 }
    );

    expect(result.result.provider).toBe('primary');
    expect(result.attempts).toBe(2); // 1 failed attempt + 1 success
    expect(executor).toHaveBeenCalledTimes(3); // 2 + 1
  });
});
```

---

### COMMON MISTAKES TO PREVENT

**1. Retrying Non-Retryable Errors:**
```typescript
// WRONG: Retrying regardless of error type
catch (error) {
  await sleep(1000);
  // retry anyway
}

// CORRECT: Check isRetryable first
catch (error) {
  const nexusError = NexusError.fromError(error, stage);
  if (!isRetryable(nexusError)) {
    throw nexusError;
  }
  // Only retry if retryable
}
```

**2. Not Tracking Fallback Tier:**
```typescript
// WRONG: Losing tier information
const result = await fallbackProvider.execute(data);
return { success: true, data: result };

// CORRECT: Include tier in output
const { result, provider, tier } = await withFallback(...);
return {
  success: true,
  data: result,
  provider: { name: provider, tier, attempts: 1 }
};
```

**3. Fixed Delays Without Jitter:**
```typescript
// WRONG: All instances retry at same time
await sleep(1000);
await sleep(2000);
await sleep(4000);

// CORRECT: Add jitter
const jitter = 0.5 + Math.random() * 0.5;
await sleep(1000 * jitter);
```

**4. Not Wrapping Unknown Errors:**
```typescript
// WRONG: Assuming error is NexusError
catch (error) {
  if (error.retryable) { // May be undefined!
    // retry
  }
}

// CORRECT: Wrap first
catch (error) {
  const nexusError = NexusError.fromError(error, stage);
  if (isRetryable(nexusError)) {
    // retry
  }
}
```

**5. Swallowing Error Context:**
```typescript
// WRONG: Losing retry history
throw new Error('Max retries exceeded');

// CORRECT: Include full context
throw NexusError.critical(
  'NEXUS_RETRY_EXHAUSTED',
  'Max retries exceeded',
  stage,
  { retryAttempts: 3, retryHistory: [...] }
);
```

---

### VALIDATION CHECKLIST

Before marking story complete, verify:

**withRetry:**
- [ ] Accepts async function and RetryOptions
- [ ] Returns RetryResult<T> with result, attempts, totalDelayMs
- [ ] Uses isRetryable() to check if error can be retried
- [ ] Does NOT retry non-RETRYABLE errors
- [ ] Implements exponential backoff
- [ ] Adds jitter to delays (50-100%)
- [ ] Respects maxDelay cap
- [ ] Throws with full context after exhausting retries
- [ ] Calls onRetry callback for each retry

**withFallback:**
- [ ] Accepts providers array and executor function
- [ ] Returns FallbackResult<T> with result, provider, tier, attempts
- [ ] Uses first provider first (tier: 'primary')
- [ ] Sets tier: 'fallback' for subsequent providers
- [ ] Tracks all attempts with durations
- [ ] Throws CRITICAL when all providers fail
- [ ] Calls onFallback callback when switching providers

**Helpers:**
- [ ] sleep(ms) utility implemented
- [ ] calculateDelay(attempt, base, max) with jitter

**Package Exports:**
- [ ] withRetry exported from @nexus-ai/core
- [ ] withFallback exported from @nexus-ai/core
- [ ] RetryOptions, RetryResult exported
- [ ] FallbackOptions, FallbackResult, FallbackAttempt exported

**Testing:**
- [ ] withRetry success on first attempt
- [ ] withRetry retry on RETRYABLE errors
- [ ] withRetry immediate throw on non-RETRYABLE
- [ ] withRetry exponential backoff verified
- [ ] withFallback primary provider first
- [ ] withFallback tier tracking correct
- [ ] withFallback all fail throws CRITICAL
- [ ] Composition test passes

---

### EXPECTED FILE STRUCTURE

```
packages/core/src/
├── utils/
│   ├── index.ts              # Barrel exports
│   ├── with-retry.ts         # withRetry function + sleep + calculateDelay
│   ├── with-fallback.ts      # withFallback function
│   └── __tests__/
│       ├── with-retry.test.ts
│       └── with-fallback.test.ts
├── errors/                   # EXISTS (from Story 1.3)
│   ├── index.ts
│   ├── nexus-error.ts
│   └── codes.ts
├── types/                    # EXISTS (from Story 1.2)
└── index.ts                  # Main package export - add utils export
```

**Barrel Export Pattern (utils/index.ts):**
```typescript
// Export functions
export { withRetry, sleep, calculateDelay } from './with-retry';
export type { RetryOptions, RetryResult } from './with-retry';

export { withFallback } from './with-fallback';
export type {
  FallbackOptions,
  FallbackAttempt,
  FallbackResult,
  NamedProvider
} from './with-fallback';
```

**Main Package Export Update (src/index.ts):**
```typescript
// Add to existing exports
export * from './utils';
```

---

### INTEGRATION WITH FUTURE STORIES

**Story 1.5 (Provider Abstraction):**
- Providers will be passed to withFallback
- Each provider has `name` property for tracking
- Provider execute methods may throw retryable errors

**Story 1.6 (GCP Infrastructure):**
- Firestore/Storage operations use withRetry
- API calls have configurable timeouts

**Story 1.10 (Execute Stage Wrapper):**
- executeStage wraps stage execution with retry+fallback
- Automatically tracks provider tier in StageOutput

**Epic 2-5 (All Pipeline Stages):**
- Every external API call uses withRetry
- Provider-based stages use withFallback
- Tier tracked in every StageOutput

---

### IMPLEMENTATION GUIDANCE

**Start Here:**
1. Create `packages/core/src/utils/` directory
2. Import from errors module: `import { NexusError, isRetryable } from '../errors'`

**Then Implement in Order:**
1. **sleep and calculateDelay first** (helpers):
   - Simple utility functions
   - calculateDelay includes jitter

2. **with-retry.ts second**:
   - RetryOptions, RetryResult interfaces
   - withRetry function using helpers

3. **with-fallback.ts third**:
   - FallbackOptions, FallbackAttempt, FallbackResult interfaces
   - withFallback function

4. **utils/index.ts fourth**:
   - Export all functions and types

5. **Update src/index.ts last**:
   - Add `export * from './utils'`

**Testing Strategy:**
1. Write helper tests first (sleep, calculateDelay)
2. Write withRetry tests - mock setTimeout for delay verification
3. Write withFallback tests - mock providers
4. Write composition tests last

---

### KEY LEARNINGS FOR DEV AGENT

**1. isRetryable is the Gatekeeper:**
Only retry when `isRetryable(error)` returns true. This is determined by ErrorSeverity.RETRYABLE from Story 1.3.

**2. Jitter Prevents Thundering Herd:**
Random jitter (50-100%) spreads retries across time. Essential for distributed systems.

**3. Fallback Tries ALL Providers:**
withFallback tries every provider on any error, not just FALLBACK severity. Maximum resilience.

**4. Tier Tracking is for Quality:**
Knowing whether 'primary' or 'fallback' succeeded helps quality gate decide AUTO_PUBLISH vs HUMAN_REVIEW.

**5. Context is Everything:**
Include retry history and attempt details in error context. Essential for debugging production issues.

**6. Composition Order Matters:**
`withRetry(() => withFallback(...))` retries the entire chain. `withFallback(p => withRetry(...))` retries each provider individually.

**7. These Utilities Are Universal:**
Every stage in Epic 2-5 depends on these utilities. Get the patterns right here.

---

**Developer:** Read this entire context before writing code. The retry and fallback utilities you create will wrap every external API call in the pipeline. These patterns directly impact pipeline reliability (NFR1-5) and integration resilience (NFR14-17).
