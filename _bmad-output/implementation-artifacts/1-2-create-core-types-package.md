# Story 1.2: Create Core Types Package

Status: done

## Story

As a developer,
I want typed contracts for pipeline stages and providers,
So that all stages communicate with consistent, type-safe interfaces.

## Acceptance Criteria

1. **Given** the initialized monorepo from Story 1.1
   **When** I create the `@nexus-ai/core` package with types
   **Then** the following types are exported from `packages/core/src/types/`:
   - `StageInput<T>` with pipelineId, previousStage, data, config, qualityContext
   - `StageOutput<T>` with success, data, artifacts, quality, cost, durationMs, provider, warnings
   - `StageConfig` with timeout, retries, and stage-specific options
   - `QualityMetrics` with stage-specific measurement fields
   - `CostBreakdown` with service, tokens, cost, timestamp
   - `ArtifactRef` with type, url, size, contentType
   - `PipelineState` with stage, status, timestamps, errors

2. **And** `LLMProvider` interface with generate(), estimateCost() methods

3. **And** `TTSProvider` interface with synthesize(), getVoices(), estimateCost() methods

4. **And** `ImageProvider` interface with generate(), estimateCost() methods

5. **And** all types compile with TypeScript strict mode

6. **And** package exports from `@nexus-ai/core` are properly configured

## Tasks / Subtasks

- [x] Task 1: Create @nexus-ai/core package structure
  - [x] Create packages/core directory
  - [x] Create package.json with @nexus-ai/core name
  - [x] Create tsconfig.json extending base config
  - [x] Set up src/ directory structure

- [x] Task 2: Implement Stage Types (AC: #1)
  - [x] Create src/types/stage.ts with StageInput<T>, StageOutput<T>
  - [x] Create StageConfig type
  - [x] Create QualityMetrics type
  - [x] Create CostBreakdown type
  - [x] Create ArtifactRef type
  - [x] Create PipelineState type

- [x] Task 3: Implement Provider Interfaces (AC: #2, #3, #4)
  - [x] Create src/types/providers.ts
  - [x] Define LLMProvider interface with generate(), estimateCost()
  - [x] Define TTSProvider interface with synthesize(), getVoices(), estimateCost()
  - [x] Define ImageProvider interface with generate(), estimateCost()

- [x] Task 4: Create Package Exports (AC: #6)
  - [x] Create src/types/index.ts barrel export
  - [x] Create src/index.ts main export
  - [x] Configure package.json exports field

- [x] Task 5: Verify TypeScript Compilation (AC: #5)
  - [x] Add build script to package.json
  - [x] Run pnpm build and verify no errors
  - [x] Verify dist/ output is generated

## Dev Notes

### Package Structure
```
packages/core/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   └── types/
│       ├── index.ts
│       ├── stage.ts
│       └── providers.ts
└── dist/
```

### Naming Conventions
- Package scope: `@nexus-ai/`
- Interfaces: PascalCase (e.g., `LLMProvider`)
- Types: PascalCase (e.g., `StageInput`)
- Generics: Single capital letter (e.g., `T`)

### References
- [Source: architecture.md#Type-Contracts] - Stage input/output contracts
- [Source: architecture.md#Provider-Abstraction] - Provider interfaces
- [Source: epics.md#Story-1.2] - Original story requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Created @nexus-ai/core package with ESM module configuration
- Implemented comprehensive Stage types in src/types/stage.ts:
  - StageInput<T>, StageOutput<T> - Generic stage contracts
  - StageConfig - Timeout, retries, options
  - QualityMetrics, QualityStatus, QualityIssue, QualityContext
  - CostBreakdown, ServiceCost, TokenCount
  - ArtifactRef, ArtifactType
  - PipelineState, PipelineStatus, StageName, PipelineTimestamps
  - StageResult, PipelineError
- Implemented Provider interfaces in src/types/providers.ts:
  - LLMProvider with LLMOptions, LLMResult
  - TTSProvider with TTSOptions, TTSResult, Voice, AudioEncoding
  - ImageProvider with ImageOptions, ImageResult, ImageFormat
  - ProviderChain<T>, ProviderChainResult<T> for fallback chains
- Created barrel exports for clean import paths
- Verified TypeScript strict mode compilation succeeds
- All 16 output files generated in dist/ (js, d.ts, source maps)

### File List

**Created:**
- `nexus-ai/packages/core/package.json` - Package configuration
- `nexus-ai/packages/core/tsconfig.json` - TypeScript configuration
- `nexus-ai/packages/core/src/index.ts` - Main export
- `nexus-ai/packages/core/src/types/index.ts` - Types barrel export
- `nexus-ai/packages/core/src/types/stage.ts` - Stage type definitions
- `nexus-ai/packages/core/src/types/providers.ts` - Provider interfaces

**Generated:**
- `nexus-ai/packages/core/dist/` - Compiled JavaScript and declarations

