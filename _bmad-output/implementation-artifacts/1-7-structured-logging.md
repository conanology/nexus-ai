# Story 1.7: Implement Structured Logging

Status: done

## Story

As a developer,
I want structured logging with pipeline and stage context,
So that I can debug and monitor pipeline execution effectively.

## Acceptance Criteria

1. **Given** GCP infrastructure from Story 1.6
   **When** I implement the structured logger
   **Then** `logger` object provides methods: debug, info, warn, error

2. **And** each log entry includes:
   - `timestamp`: ISO 8601 format
   - `level`: debug/info/warn/error
   - `message`: human-readable message
   - `pipelineId`: when in pipeline context (YYYY-MM-DD)
   - `stage`: when in stage context
   - Additional structured fields passed as second argument

3. **And** logger name follows convention: `nexus.{package}.{module}`

4. **And** `logger.child({ pipelineId, stage })` creates scoped logger

5. **And** logs output as JSON in production, pretty-printed in development

6. **And** `console.log` is banned via ESLint rule (error on direct usage)

7. **And** log levels are configurable via `NEXUS_LOG_LEVEL` environment variable

## Tasks / Subtasks

- [x] Task 1: Create base logger (AC: #1, #2)
  - [x] Implement Logger class with debug, info, warn, error methods
  - [x] Add timestamp in ISO 8601 format
  - [x] Add level to each log entry
  - [x] Support additional structured fields

- [x] Task 2: Implement logger naming (AC: #3)
  - [x] Add name property following nexus.{package}.{module}
  - [x] Create createLogger factory function

- [x] Task 3: Implement child loggers (AC: #4)
  - [x] Add child() method for scoped loggers
  - [x] Inherit parent context (pipelineId, stage)
  - [x] Allow overriding context in child

- [x] Task 4: Configure output format (AC: #5)
  - [x] JSON output in production (NODE_ENV=production)
  - [x] Pretty-printed in development
  - [x] Check environment for format selection

- [x] Task 5: Configure log levels (AC: #7)
  - [x] Read NEXUS_LOG_LEVEL from environment
  - [x] Support: debug, info, warn, error
  - [x] Default to 'info' if not specified

## Dev Notes

### Log Entry Format

```json
{
  "timestamp": "2026-01-08T10:30:00.000Z",
  "level": "info",
  "name": "nexus.core.stage",
  "message": "Stage completed",
  "pipelineId": "2026-01-08",
  "stage": "news-sourcing",
  "durationMs": 1234,
  "provider": "gemini-3-pro"
}
```

### Logger Naming Convention

- `nexus.core.errors` - Error handling module
- `nexus.news-sourcing.github` - GitHub trending source
- `nexus.orchestrator.pipeline` - Pipeline execution

### Usage Example

```typescript
const logger = createLogger('nexus.news-sourcing.github');
const stageLogger = logger.child({ pipelineId: '2026-01-08', stage: 'news-sourcing' });
stageLogger.info('Fetched 10 trending repos', { count: 10 });
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented Logger class with all log levels
- Added ISO 8601 timestamps to all entries
- Created createLogger factory for named loggers
- Implemented child() method for scoped contexts
- JSON output in production, pretty-printed in development
- NEXUS_LOG_LEVEL controls minimum log level
- All log methods accept structured context object

### File List

**Created/Modified:**
- `nexus-ai/packages/core/src/logging/logger.ts` - Logger implementation
- `nexus-ai/packages/core/src/logging/index.ts` - Exports

### Dependencies

- **Upstream Dependencies:** Story 1.6 (Environment variable patterns)
- **Downstream Dependencies:** All stages use logging
