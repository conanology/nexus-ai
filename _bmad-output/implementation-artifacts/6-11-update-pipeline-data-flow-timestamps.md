# Story 6.11: Update Pipeline Data Flow for Timestamps

Status: done

## Story

As a developer,
I want the orchestrator to pass timing data through the pipeline,
So that visual-gen receives word-level timestamps.

## Acceptance Criteria

1. **Given** stage registration from Story 6.10
   **When** I update `apps/orchestrator/src/pipeline.ts`
   **Then** `buildStageInput()` for timestamp-extraction receives:
   - `audioUrl` from TTS output
   - `audioDurationSec` from TTS output
   - `directionDocument` from script-gen output (passed through pronunciation and TTS)
   **And** `buildStageInput()` for visual-gen receives:
   - `audioUrl` (pass-through)
   - `audioDurationSec` (pass-through)
   - `directionDocument` with enriched word timings from timestamp-extraction
   **And** visual-gen uses `timing.actualStartSec` if available, falls back to `timing.estimatedStartSec`
   **And** integration test verifies end-to-end data flow

2. **And** TTS types (`packages/tts/src/types.ts`) include optional `directionDocument` pass-through in both `TTSInput` and `TTSOutput`

3. **And** TTS implementation (`packages/tts/src/tts.ts`) passes `directionDocument` from input to output unchanged

4. **And** visual-gen types (`packages/visual-gen/src/types.ts`) accept optional `directionDocument` and `wordTimings` in `VisualGenInput`

5. **And** visual-gen implementation uses `directionDocument` when present (V2 path), falls back to `script` string (V1 path)

6. **And** build passes (`pnpm build`)

7. **And** tests pass (`pnpm test`)

## Tasks / Subtasks

- [x] Task 1: Add `directionDocument` pass-through to TTS types (AC: 2)
  - [x] 1.1: Import `DirectionDocument` type from `@nexus-ai/script-gen` in `packages/tts/src/types.ts`
  - [x] 1.2: Add `directionDocument?: DirectionDocument` to `TTSInput` interface
  - [x] 1.3: Add `directionDocument?: DirectionDocument` to `TTSOutput` interface

- [x] Task 2: Update TTS implementation to pass through `directionDocument` (AC: 3)
  - [x] 2.1: In `packages/tts/src/tts.ts`, pass `input.data.directionDocument` to the output object
  - [x] 2.2: Add test in TTS test file verifying `directionDocument` pass-through

- [x] Task 3: Update visual-gen types to accept `directionDocument` (AC: 4)
  - [x] 3.1: Import `DirectionDocument` type from `@nexus-ai/script-gen` in `packages/visual-gen/src/types.ts`
  - [x] 3.2: Add `directionDocument?: DirectionDocument` to `VisualGenInput`
  - [x] 3.3: Add `wordTimings?: WordTiming[]` to `VisualGenInput` (from timestamp-extraction output)

- [x] Task 4: Update visual-gen to use `directionDocument` when present (AC: 5)
  - [x] 4.1: In `packages/visual-gen/src/visual-gen.ts`, check for `directionDocument` in input
  - [x] 4.2: When `directionDocument` present (V2): use `timing.actualStartSec` if available, fall back to `timing.estimatedStartSec`
  - [x] 4.3: When `directionDocument` absent (V1): keep existing `script` string parsing logic unchanged
  - [x] 4.4: Add test verifying V2 path uses directionDocument timings
  - [x] 4.5: Add test verifying V1 path still works with script string

- [x] Task 5: Add pipeline data flow integration test (AC: 1)
  - [x] 5.1: In `apps/orchestrator/src/__tests__/`, add test verifying TTS output includes `directionDocument`
  - [x] 5.2: Add test verifying timestamp-extraction receives `directionDocument` from TTS
  - [x] 5.3: Add test verifying visual-gen receives enriched `directionDocument` with word timings
  - [x] 5.4: Add test for V1 backward compatibility (no directionDocument flows through cleanly)

- [x] Task 6: Build and test (AC: 6, 7)
  - [x] 6.1: Run `pnpm build` - must pass (16/16 packages)
  - [x] 6.2: Run `pnpm test` - must pass (38 new/modified tests pass; pre-existing failures in unrelated packages)

## Dev Notes

### CRITICAL: Data Flow Gap Analysis

The pipeline uses a generic `buildStageInput<T>()` that passes `previousData` as `data: T` to the next stage. Currently the `directionDocument` produced by script-gen is **lost** at the TTS stage boundary because `TTSInput`/`TTSOutput` don't include it. This story fixes the data flow chain:

```
script-gen → pronunciation → TTS → timestamp-extraction → visual-gen
                                ↑                          ↑
                          ADD: directionDocument     ADD: directionDocument
                          pass-through               + wordTimings support
```

### Existing Type Interfaces (Current State)

**`TTSInput`** (`packages/tts/src/types.ts:9-29`):
- `ssmlScript`, `voice?`, `rate?`, `pitch?`, `maxChunkChars?`, `topicData?`
- MISSING: `directionDocument`

**`TTSOutput`** (`packages/tts/src/types.ts:34-54`):
- `audioUrl`, `durationSec`, `format`, `sampleRate`, `segmentCount?`, `topicData?`
- MISSING: `directionDocument`

**`TimestampExtractionInput`** (`packages/timestamp-extraction/src/types.ts`):
- `audioUrl`, `audioDurationSec`, `directionDocument`, `topicData?`
- EXPECTS `directionDocument` - currently won't receive it from TTS

**`TimestampExtractionOutput`** (`packages/timestamp-extraction/src/types.ts`):
- `directionDocument` (enriched with word timings), `wordTimings`, `timingMetadata`, `audioUrl`, `audioDurationSec`, `topicData?`
- Correctly outputs enriched document

**`VisualGenInput`** (`packages/visual-gen/src/types.ts:8-21`):
- `script`, `audioUrl`, `audioDurationSec`, `topicData?`
- MISSING: `directionDocument`, `wordTimings`

### Key Implementation Details

**TTS pass-through pattern** - follow the existing `topicData` pass-through pattern already in TTSInput/TTSOutput. The `directionDocument` must be passed from input to output unchanged, just like `topicData`.

**Visual-gen dual-path** - when `directionDocument` is present, use segment timings (`timing.actualStartSec` or `timing.estimatedStartSec`). When absent, use existing `script` string parsing. This is a V2/V1 compatibility pattern.

**Import path for DirectionDocument**:
```typescript
import type { DirectionDocument } from '@nexus-ai/script-gen';
```

**Import path for WordTiming** (if needed in visual-gen):
```typescript
import type { WordTiming } from '@nexus-ai/timestamp-extraction';
// OR use the DirectionDocument's segment.timing.wordTimings array directly
```

### `buildStageInput()` - No Changes Needed

The generic `buildStageInput<T>()` in `apps/orchestrator/src/pipeline.ts:147-166` passes `previousData` as `data: T` automatically. Once TTS types include `directionDocument`, the data flows through naturally. No orchestrator code changes required.

### What the Pronunciation Stage Does

The pronunciation stage (`packages/pronunciation/`) receives script-gen output and produces TTS-ready SSML. Check how it passes data through - the `directionDocument` should already flow through if it's part of the data object. Verify this before assuming TTS needs the field.

### What NOT To Do

- Do NOT modify `buildStageInput()` in pipeline.ts - the generic pattern handles this
- Do NOT create separate data mapping functions in the orchestrator
- Do NOT change the stage order or registry (done in Story 6.10)
- Do NOT modify `DirectionDocument` types in script-gen - they are complete
- Do NOT add V2 visual generation logic (just accept the input; full V2 rendering is later stories)
- For Task 4 (visual-gen): only add the **type acceptance** and **basic conditional check** for directionDocument. The actual V2 rendering pipeline using directionDocument for scene generation is covered by later stories (6.16+). For now, when directionDocument is present, still use the existing script-based flow but pass timing data through.

### Previous Story Intelligence

From Story 6.10 (previous):
- `@nexus-ai/timestamp-extraction` is registered in orchestrator at correct position
- Stage order: `tts → timestamp-extraction → visual-gen`
- Build passes with 16/16 packages
- Pre-existing test failures in unrelated packages (core/storage, core/types, core/utils, orchestrator health/integration) - NOT caused by our changes
- Workspace dependency `@nexus-ai/timestamp-extraction` already added to orchestrator `package.json`

### Git Intelligence

Recent commits show Epic 6 pattern:
- Stories 6.5-6.10 built the timestamp-extraction package incrementally
- Story 6.10 registered the stage in the orchestrator
- This story (6.11) connects the data flow between stages
- Convention: `feat({package}): {description} (Story {key})`

### Project Structure Notes

- TTS package: `packages/tts/`
- Visual-gen package: `packages/visual-gen/`
- Script-gen package: `packages/script-gen/` (source of DirectionDocument type)
- Timestamp-extraction package: `packages/timestamp-extraction/`
- Orchestrator: `apps/orchestrator/`
- All packages use TypeScript strict mode with `.js` extensions in imports
- Package scope: `@nexus-ai/{package-name}`

### Testing Approach

- **Unit tests**: Add TTS pass-through test, visual-gen V2/V1 path tests
- **Integration tests**: Pipeline data flow test verifying directionDocument traverses TTS → timestamp-extraction → visual-gen
- Use existing mock patterns from `apps/orchestrator/src/__tests__/stages.test.ts`
- Pre-existing failures in unrelated packages are expected and NOT blockers

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Story 6.11]
- [Source: _bmad-output/project-context.md - Stage Execution Template]
- [Source: packages/tts/src/types.ts - TTSInput/TTSOutput interfaces]
- [Source: packages/visual-gen/src/types.ts - VisualGenInput interface]
- [Source: packages/timestamp-extraction/src/types.ts - Input/Output types]
- [Source: packages/script-gen/src/types.ts - DirectionDocument, ScriptGenOutputV2]
- [Source: apps/orchestrator/src/pipeline.ts:147-166 - buildStageInput()]
- [Source: _bmad-output/implementation-artifacts/6-10-register-timestamp-stage-orchestrator.md - Previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build: 16/16 packages pass
- Tests: 38 story-related tests pass (4 test files); pre-existing failures in unrelated packages (core/types, core/utils, orchestrator health) are NOT regressions

### Completion Notes List

- Added `directionDocument?: DirectionDocument` to both `TTSInput` and `TTSOutput` interfaces following the existing `topicData` pass-through pattern
- Updated both TTS code paths (single-chunk and multi-chunk) to pass `directionDocument` from input to output unchanged
- Added `directionDocument?: DirectionDocument` and `wordTimings?: WordTiming[]` to `VisualGenInput` with workspace dependencies on `@nexus-ai/script-gen` and `@nexus-ai/timestamp-extraction`
- Added V2 detection logic in visual-gen with `resolveSegmentStartSec()` and `resolveSegmentDurationSec()` helper functions (prefer actual timing, fall back to estimated)
- V2 path logs timing resolution summary; still uses existing script-based flow per Dev Notes (full V2 rendering deferred to stories 6.16+)
- No changes to `buildStageInput()` in pipeline.ts - generic pattern handles data flow automatically
- Added 2 new TTS tests (pass-through verification + V1 backward compat)
- Added 9 visual-gen V2 tests (timing resolution helpers + type acceptance)
- Added 9 pipeline data flow integration tests (TTS output, timestamp-extraction input, visual-gen enriched input, V1 backward compat)

### Change Log

- 2026-01-27: Implemented pipeline data flow for directionDocument through TTS → timestamp-extraction → visual-gen (Story 6.11)
- 2026-01-27: Code review (AI) - 6 issues found (3H, 3M), 5 fixed: type-safe directionDocument params in TTS, explicit VisualGenInput types in V2 tests, clarified resolve helper JSDoc, added pnpm-lock.yaml to File List, added integration test documentation. 1 pre-existing issue noted (as any return casts). Status → done.

### File List

- packages/tts/src/types.ts (modified) - Added DirectionDocument import and optional field to TTSInput/TTSOutput
- packages/tts/src/tts.ts (modified) - Pass directionDocument through in both single-chunk and multi-chunk paths
- packages/tts/package.json (modified) - Added @nexus-ai/script-gen workspace dependency
- packages/tts/src/__tests__/tts.test.ts (modified) - Added 2 tests for directionDocument pass-through and V1 compat
- packages/visual-gen/src/types.ts (modified) - Added DirectionDocument and WordTiming imports, added optional fields to VisualGenInput
- packages/visual-gen/src/visual-gen.ts (modified) - Added V2 detection, timing resolution helpers, segment timing logging
- packages/visual-gen/package.json (modified) - Added @nexus-ai/script-gen and @nexus-ai/timestamp-extraction workspace dependencies
- packages/visual-gen/src/__tests__/visual-gen-v2.test.ts (new) - 9 tests for V2 timing helpers and type acceptance
- apps/orchestrator/src/__tests__/pipeline-dataflow-timestamps.test.ts (new) - 9 integration tests for pipeline data flow
- pnpm-lock.yaml (modified) - Updated lockfile from workspace dependency additions
