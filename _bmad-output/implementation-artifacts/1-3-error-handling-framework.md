# Story 1.3: Implement Error Handling Framework

Status: done

## Story

As a developer,
I want a consistent error handling system with severity levels,
So that errors are handled appropriately based on their impact on the pipeline.

## Acceptance Criteria

1. **Given** the core types package from Story 1.2
   **When** I implement the error handling framework
   **Then** `ErrorSeverity` enum is defined with: RETRYABLE, FALLBACK, DEGRADED, RECOVERABLE, CRITICAL

2. **And** `NexusError` class extends Error with:
   - `code`: string in format `NEXUS_{DOMAIN}_{TYPE}`
   - `severity`: ErrorSeverity
   - `stage`: optional string
   - `retryable`: boolean
   - `context`: optional Record<string, unknown>

3. **And** static factory methods exist:
   - `NexusError.retryable(code, message, stage, context?)`
   - `NexusError.fallback(code, message, stage, context?)`
   - `NexusError.degraded(code, message, stage, context?)`
   - `NexusError.recoverable(code, message, stage, context?)`
   - `NexusError.critical(code, message, stage, context?)`
   - `NexusError.fromError(error, stage)` to wrap unknown errors

4. **And** error codes follow naming convention (e.g., `NEXUS_TTS_TIMEOUT`, `NEXUS_LLM_RATE_LIMIT`)

5. **And** unit tests verify all severity levels and factory methods

## Tasks / Subtasks

- [x] Task 1: Define ErrorSeverity enum (AC: #1)
  - [x] Create ErrorSeverity enum with all 5 levels
  - [x] Document each severity level's meaning and behavior

- [x] Task 2: Create NexusError class (AC: #2)
  - [x] Extend Error base class
  - [x] Add code, severity, stage, retryable, context properties
  - [x] Add cause property for wrapping errors
  - [x] Add timestamp for debugging

- [x] Task 3: Implement factory methods (AC: #3)
  - [x] Implement NexusError.retryable()
  - [x] Implement NexusError.fallback()
  - [x] Implement NexusError.degraded()
  - [x] Implement NexusError.recoverable()
  - [x] Implement NexusError.critical()
  - [x] Implement NexusError.fromError() for wrapping unknown errors

- [x] Task 4: Define error domains and types (AC: #4)
  - [x] Create ErrorDomain type (LLM, TTS, IMAGE, etc.)
  - [x] Create ErrorType type (TIMEOUT, RATE_LIMIT, AUTH, etc.)
  - [x] Create buildErrorCode helper function
  - [x] Define common ErrorCodes constant object

- [x] Task 5: Add utility methods
  - [x] Add shouldRetry() method
  - [x] Add shouldFallback() method
  - [x] Add canContinue() method
  - [x] Add toJSON() for logging/storage

## Dev Notes

### Error Severity Behavior

| Severity | Action | Pipeline Continues |
|----------|--------|-------------------|
| RETRYABLE | Retry same operation | Yes |
| FALLBACK | Try alternative provider | Yes |
| DEGRADED | Continue with reduced quality | Yes |
| RECOVERABLE | Try alternative approach | Yes |
| CRITICAL | Pipeline stops | No |

### Error Code Format

All error codes follow: `NEXUS_{DOMAIN}_{TYPE}`
- Example: `NEXUS_TTS_TIMEOUT`, `NEXUS_LLM_RATE_LIMIT`

### Implementation Details

The NexusError class includes:
- Factory methods for each severity level
- Automatic retryable flag based on severity
- Stack trace preservation (V8 engines)
- JSON serialization for logging

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created ErrorSeverity enum with 5 levels: RETRYABLE, FALLBACK, DEGRADED, RECOVERABLE, CRITICAL
- Implemented NexusError class extending Error with all required properties
- Added 6 factory methods for creating errors at different severity levels
- Defined ErrorDomain and ErrorType types for categorization
- Created ErrorCodes constant object with common error codes for all domains
- Added utility methods: shouldRetry(), shouldFallback(), canContinue(), toJSON()
- Maintained proper stack trace using Error.captureStackTrace

### File List

**Created/Modified:**
- `nexus-ai/packages/core/src/errors/index.ts` - Complete error handling framework

### Dependencies

- **Upstream Dependencies:** Story 1.2 (Core Types Package)
- **Downstream Dependencies:** All subsequent stories use this error system
