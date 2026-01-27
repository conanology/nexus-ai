# Story 6.10: Register Timestamp Stage in Orchestrator

Status: done

## Story

As a developer,
I want timestamp-extraction registered in the pipeline,
So that it executes between TTS and visual-gen stages.

## Acceptance Criteria

1. **Given** timestamp-extraction package complete (Stories 6.5-6.9)
   **When** I update `apps/orchestrator/src/stages.ts`
   **Then** `stageRegistry` includes `'timestamp-extraction': executeTimestampExtraction`
   **And** `stageOrder` array places it after 'tts' and before 'visual-gen':
   ```typescript
   ['news-sourcing', 'research', 'script-gen', 'pronunciation', 'tts',
    'timestamp-extraction',  // NEW
    'visual-gen', 'thumbnail', 'youtube', 'twitter', 'notifications']
   ```

2. **And** `STAGE_RETRY_CONFIG` in `apps/orchestrator/src/pipeline.ts` includes:
   `'timestamp-extraction': { maxRetries: 3, baseDelay: 2000 }`

3. **And** `STAGE_CRITICALITY` in `apps/orchestrator/src/pipeline.ts` includes:
   `'timestamp-extraction': 'DEGRADED'`

4. **And** pipeline data flow passes:
   - Input: `audioUrl`, `audioDurationSec`, `directionDocument` from TTS stage output
   - Output: enriched `directionDocument` with word timings to visual-gen stage

5. **And** build passes (`pnpm build`)

6. **And** tests pass (`pnpm test`)

## Tasks / Subtasks

- [x] Task 1: Add timestamp-extraction to stage registry (AC: 1)
  - [x] Import `executeTimestampExtraction` from `@nexus-ai/timestamp-extraction` in `apps/orchestrator/src/stages.ts`
  - [x] Add `'timestamp-extraction': executeTimestampExtraction` to `stageRegistry` object
  - [x] Insert `'timestamp-extraction'` into `stageOrder` array between `'tts'` and `'visual-gen'`

- [x] Task 2: Add retry and criticality config (AC: 2, 3)
  - [x] Add `'timestamp-extraction': { maxRetries: 3, baseDelay: 2000 }` to `STAGE_RETRY_CONFIG` in `pipeline.ts`
  - [x] Add `'timestamp-extraction': 'DEGRADED'` to `STAGE_CRITICALITY` in `pipeline.ts`

- [x] Task 3: Verify data flow compatibility (AC: 4)
  - [x] Verify `executeTimestampExtraction` accepts `StageInput<TimestampExtractionInput>` where input includes `audioUrl`, `audioDurationSec`, `directionDocument`
  - [x] Verify output includes enriched `directionDocument` with word timings for visual-gen consumption
  - [x] Confirm `buildStageInput()` passes previous stage data through correctly (generic `data: T` pattern)

- [x] Task 4: Build and test (AC: 5, 6)
  - [x] Run `pnpm build` - must pass (16/16 packages)
  - [x] Run `pnpm test` - must pass (stages tests: 7/7 pass; pre-existing failures in unrelated packages unchanged)

## Dev Notes

### CRITICAL: Existing Code Patterns to Follow

The orchestrator uses a simple registration pattern. You must modify exactly 2 files:

**File 1: `apps/orchestrator/src/stages.ts`**
- Current imports are at top of file (lines ~1-13), importing stage executors from various packages
- `stageRegistry` is a `Record<string, StageExecutor>` object (lines ~17-29)
- `stageOrder` is a string array defining execution sequence (lines ~32-44)
- `StageExecutor` type is `(input: any) => Promise<any>` (line ~15)

**File 2: `apps/orchestrator/src/pipeline.ts`**
- `STAGE_RETRY_CONFIG` is a `Record<string, StageRetryConfig>` at lines ~94-106
- `STAGE_CRITICALITY` is a `Record<string, 'CRITICAL' | 'DEGRADED' | 'RECOVERABLE'>` at lines ~111-123
- `buildStageInput()` at lines ~145-164 is generic - it passes `previousData` through as `data: T`
- No changes needed to `buildStageInput()` - the generic pattern handles timestamp-extraction automatically

### Import Pattern

Follow existing import style in `stages.ts`:
```typescript
import { executeTimestampExtraction } from '@nexus-ai/timestamp-extraction';
```

### Stage Order Placement

Insert `'timestamp-extraction'` between `'tts'` (index 4) and `'visual-gen'` (index 5):
```typescript
export const stageOrder = [
  'news-sourcing',
  'research',
  'script-gen',
  'pronunciation',
  'tts',
  'timestamp-extraction',  // NEW - Story 6.10
  'visual-gen',
  'thumbnail',
  'youtube',
  'twitter',
  'notifications',
];
```

### Why DEGRADED Criticality

Timestamp-extraction uses `'DEGRADED'` criticality because:
- On STT failure, the package has an estimated timing fallback (Story 6.7)
- Visual-gen can use `timing.estimatedStartSec` if `timing.actualStartSec` is unavailable
- The pipeline should continue with degraded quality rather than abort

### Data Flow (No Changes Needed)

The existing `buildStageInput()` is generic - it passes `previousData` (output from TTS stage) directly as `data` to the next stage. The timestamp-extraction executor (`executeTimestampExtraction`) expects:

**Input** (`TimestampExtractionInput`):
- `audioUrl: string` - GCS URL to TTS audio
- `audioDurationSec: number` - Total audio duration
- `directionDocument: DirectionDocument` - Segments to enrich with timings
- `topicData?: object` - Optional topic metadata

**Output** (`TimestampExtractionOutput`):
- `directionDocument: DirectionDocument` - Enriched with word timings
- `wordTimings: WordTiming[]` - Flat array of all word timings
- `timingMetadata: TimingMetadata` - Source, confidence, warnings
- `audioUrl: string` - Pass-through
- `audioDurationSec: number` - Pass-through

### What NOT To Do

- Do NOT modify `buildStageInput()` - the generic pattern handles this
- Do NOT modify `pipeline.ts` execution logic - only add config entries
- Do NOT add new type definitions to orchestrator - use existing `StageExecutor` type
- Do NOT create new files - only modify `stages.ts` and `pipeline.ts`
- Do NOT change any existing stage registrations or order

### Previous Story Intelligence

From Story 6.9 (previous story):
- The `@nexus-ai/timestamp-extraction` package exports `executeTimestampExtraction` from `src/index.ts`
- Build passes with 16/16 packages
- Tests pass with 178 tests (1 skipped)
- Pre-existing test failures exist in unrelated packages (core/storage, core/types, core/utils, orchestrator) - these are NOT caused by our changes

### Project Structure Notes

- Orchestrator app: `apps/orchestrator/`
- Timestamp extraction package: `packages/timestamp-extraction/`
- Package scope: `@nexus-ai/timestamp-extraction`
- All packages use TypeScript strict mode with `.js` extensions in imports

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Story 6.10]
- [Source: _bmad-output/project-context.md - Stage Execution Template]
- [Source: apps/orchestrator/src/stages.ts - Stage Registry Pattern]
- [Source: apps/orchestrator/src/pipeline.ts - Retry and Criticality Config]
- [Source: packages/timestamp-extraction/src/index.ts - Package Exports]
- [Source: packages/timestamp-extraction/src/types.ts - Input/Output Types]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build initially failed: orchestrator missing `@nexus-ai/timestamp-extraction` workspace dependency. Added to `package.json` and re-ran `pnpm install`.
- Build passes: 16/16 packages successful.
- Stages tests: 7/7 pass (including 2 new tests for timestamp-extraction placement and registration).
- Pre-existing test failures in orchestrator (health checks, pipeline integration) are unchanged from previous stories.

### Completion Notes List

- Imported `executeTimestampExtraction` from `@nexus-ai/timestamp-extraction` in `stages.ts`
- Registered `'timestamp-extraction'` in `stageRegistry` between `tts` and `visual-gen`
- Added `'timestamp-extraction'` to `stageOrder` array at correct position (after `tts`, before `visual-gen`)
- Added retry config: `{ maxRetries: 3, baseDelay: 2000 }` in `STAGE_RETRY_CONFIG`
- Added criticality: `'DEGRADED'` in `STAGE_CRITICALITY`
- Added `@nexus-ai/timestamp-extraction` workspace dependency to orchestrator `package.json`
- Updated existing stages tests to include `timestamp-extraction` in expected stages/order
- Added 2 new test cases: placement verification and registry function check
- Verified data flow: `executeTimestampExtraction` accepts `StageInput<TimestampExtractionInput>` and returns `StageOutput<TimestampExtractionOutput>`. The generic `buildStageInput()` passes TTS output through as `data: T` automatically.

### Change Log

- 2026-01-27: Registered timestamp-extraction stage in orchestrator pipeline (Story 6.10)
- 2026-01-27: Code review completed - fixed 3 MEDIUM issues (File List completeness, test coverage for 'render' key, package.json ordering)

### File List

- `apps/orchestrator/src/stages.ts` (modified) - Added import and registry/order entries
- `apps/orchestrator/src/pipeline.ts` (modified) - Added retry and criticality config
- `apps/orchestrator/package.json` (modified) - Added @nexus-ai/timestamp-extraction dependency
- `apps/orchestrator/src/__tests__/stages.test.ts` (modified) - Updated expected stages and added 2 new tests
- `pnpm-lock.yaml` (modified) - Lockfile updated from new workspace dependency
