# Story 2.1: create-news-sourcing-package

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a news sourcing package with source interfaces,
so that I can add new news sources consistently.

## Acceptance Criteria

1. Package structure created at `packages/news-sourcing` with `src/index.ts`, `src/types.ts`, `src/sources/`, `src/scoring.ts`, `src/news-sourcing.ts`.
2. `NewsSource` interface defined: `name`, `fetch()`, `authorityWeight`.
3. `NewsItem` type defined: `title`, `url`, `source`, `publishedAt`, `viralityScore`, `metadata`.
4. Package compiles and exports from `@nexus-ai/news-sourcing`.
5. Configuration files (`package.json`, `tsconfig.json`) set up correctly for the workspace.

## Tasks / Subtasks

- [x] Initialize `packages/news-sourcing` package
  - [x] Create `package.json` with `@nexus-ai/news-sourcing` name
  - [x] Create `tsconfig.json` extending root config
- [x] Define Types (`src/types.ts`)
  - [x] Implement `NewsItem` interface
  - [x] Implement `NewsSource` interface
  - [x] Implement `NewsSourcingConfig` type
- [x] Implement Core Logic
  - [x] Create `src/news-sourcing.ts` with `executeNewsSourcing` stage function
  - [x] Create `src/scoring.ts` stub
  - [x] Create `src/sources/` directory
- [x] Integrate with Core
  - [x] Import `StageInput`, `StageOutput` from `@nexus-ai/core`
  - [x] Use `executeStage` wrapper
- [x] Testing
  - [x] Create `src/news-sourcing.test.ts`
  - [x] Verify compilation

## Dev Notes

### Architecture Compliance
- **Core Integration**: Must use `@nexus-ai/core` for:
    - `StageInput` / `StageOutput` contracts
    - `NexusError` for error handling
    - `CostTracker` for tracking API usage (even if mocked initially)
    - `logger` for structured logging
- **Naming**: `kebab-case` for files, `PascalCase` for types/interfaces.
- **Exports**: `src/index.ts` must export the main execution function and types.

### File Structure Requirements
```
packages/news-sourcing/
├── src/
│   ├── index.ts           # Public exports
│   ├── types.ts           # Source-specific types
│   ├── news-sourcing.ts   # Main stage logic (executeNewsSourcing)
│   ├── scoring.ts         # Freshness algorithm stub
│   ├── sources/           # Directory for future sources
│   │   └── mock-source.ts # Initial mock source
│   └── utils/             # Utilities
├── package.json
└── tsconfig.json
```

### Technical Specifics
- **Dependencies**:
    - `@nexus-ai/core`: `workspace:*`
    - `zod`: For validation (recommended)
    - `date-fns`: For date manipulation (if needed)
- **Testing**:
    - Use `vitest`
    - Create a basic test for `executeNewsSourcing`

### Git Intelligence
- Recent changes in `core` (`QualityGate`, `CostTracker`) are critical. ensure you are using the latest interfaces from `packages/core`.
- Check `packages/core/src/types/pipeline.ts` for exact `StageInput`/`StageOutput` signatures.

### References
- PRD: `_bmad-output/planning-artifacts/prd.md` (Section: News Intelligence)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Section: Stage 1: SOURCE)
- Epics: `_bmad-output/planning-artifacts/epics.md` (Story 2.1)

## Dev Agent Record

### Agent Model Used
opencode (Gemini 2.0 Flash)

### Debug Log References
- Initializing package `packages/news-sourcing`
- Implemented core types and logic stubs
- Integrated with @nexus-ai/core executeStage wrapper
- Fixed build error in @nexus-ai/core (stage-logging.ts)
- Verified news-sourcing with unit tests

### Completion Notes List
- Updated status to in-progress
- Created packages/news-sourcing directory structure
- Created package.json and tsconfig.json
- Implemented src/types.ts, src/news-sourcing.ts, src/scoring.ts, src/sources/mock-source.ts, src/index.ts
- Implemented unit tests in src/news-sourcing.test.ts
- Verified successful build of @nexus-ai/news-sourcing and @nexus-ai/core

### File List
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/2-1-create-news-sourcing-package.md
- packages/core/src/types/pipeline.ts
- packages/core/src/utils/execute-stage.ts
- packages/core/src/observability/stage-logging.ts
- packages/core/src/observability/cost-tracker.ts
- packages/news-sourcing/package.json
- packages/news-sourcing/tsconfig.json
- packages/news-sourcing/src/types.ts
- packages/news-sourcing/src/news-sourcing.ts
- packages/news-sourcing/src/scoring.ts
- packages/news-sourcing/src/sources/mock-source.ts
- packages/news-sourcing/src/index.ts
- packages/news-sourcing/src/news-sourcing.test.ts

## Change Log

### 2026-01-16
- Created `@nexus-ai/news-sourcing` package
- Implemented `NewsItem`, `NewsSource`, and `NewsSourcingConfig` types
- Implemented `executeNewsSourcing` stage function with `executeStage` wrapper
- Implemented **Freshness Algorithm** `(virality * authority) / hours` with age penalties per PRD
- Added unit tests for news sourcing logic
- Fixed build error in `@nexus-ai/core` stage-logging
- Refined `@nexus-ai/core` pipeline types and execute-stage wrapper
