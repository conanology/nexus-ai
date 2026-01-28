# Story 6.24: Implement Audio Mix Pipeline

Status: done

## Story

As a developer,
I want FFmpeg-based audio mixing with ducking,
so that voice, music, and SFX combine professionally.

## Acceptance Criteria

1. **AC1: mixAudio Function** - Create `packages/audio-mixer/src/mix-pipeline.ts` with `mixAudio(input: AudioMixerInput): Promise<AudioMixerOutput>` that orchestrates the full audio mix pipeline:
   - Downloads voice track from GCS URL (`input.voiceTrackUrl`)
   - Selects music based on `input.directionDocument.globalAudio.defaultMood`
   - Prepares music track (loop/trim to `input.targetDurationSec`)
   - Detects speech segments via VAD on the voice track
   - Generates ducking curve from speech segments
   - Extracts SFX triggers from direction document segments
   - Calls FFmpeg to mix voice + music (with ducking) + SFX
   - Normalizes output (voice peaks at -6dB)
   - Uploads mixed audio to GCS
   - Returns `AudioMixerOutput` with URLs and metrics

2. **AC2: extractSFXTriggers Implementation** - Replace the stub in `packages/audio-mixer/src/sfx.ts`:
   - `extractSFXTriggers(segments: DirectionSegment[], sfxLibrary: SfxLibrary): SFXTriggerResolved[]`
   - Iterates over each segment's `audio.sfxCues` array
   - For each `SFXCue`, resolves the `sound` ID to a `SfxTrack` via `getSFX()`
   - Converts trigger type + value to a time offset in seconds
   - Returns resolved triggers with audio file GCS paths and timing

3. **AC3: FFmpeg Mix Command** - Build FFmpeg filter_complex that:
   - Input 0: voice track (WAV)
   - Input 1: music track (WAV, looped/trimmed)
   - Input 2+: SFX files (one per trigger)
   - Applies ducking curve to music via `volume` filter with gain envelope
   - Delays SFX inputs to their trigger times via `adelay`
   - Sets SFX volumes per trigger
   - Mixes all streams via `amix` or `amerge` + pan
   - Normalizes to voice peaks at -6dB via `loudnorm` or `dynaudnorm`
   - Output: WAV 44.1kHz stereo

4. **AC4: GCS Download/Upload** - Implement helper functions:
   - `downloadFromGCS(gcsUrl: string, localPath: string): Promise<void>` - downloads file from GCS URL to local temp path
   - `uploadToGCS(localPath: string, gcsUrl: string): Promise<string>` - uploads local file to GCS, returns public URL
   - Use `fetch` for download (HTTPS URL), `@google-cloud/storage` for upload

5. **AC5: executeStage Integration** - Wrap `mixAudio` with `executeStage` wrapper from `@nexus-ai/core`:
   - Stage name: `'audio-mixer'`
   - Track costs via CostTracker (no direct API costs, but track processing time)
   - Quality gate integration deferred to Story 6-25

6. **AC6: SFXTriggerResolved Type** - Add to `packages/audio-mixer/src/types.ts`:
   - `SFXTriggerResolved { segmentId: string; timeSec: number; soundId: string; gcsPath: string; volume: number; durationSec: number }`

7. **AC7: Export Updates** - Update `packages/audio-mixer/src/index.ts` to export:
   - `mixAudio` function from mix-pipeline.ts
   - `SFXTriggerResolved` type
   - Updated `extractSFXTriggers` signature (no longer throws)

8. **AC8: Tests** - Create `packages/audio-mixer/src/__tests__/mix-pipeline.test.ts`:
   - Test `extractSFXTriggers` with mock direction document segments and SFX library
   - Test `mixAudio` with mocked GCS download/upload, mocked FFmpeg execution
   - Test FFmpeg command construction (verify filter_complex structure)
   - Test GCS helpers with mocked fetch/storage
   - Test error handling: missing voice track, FFmpeg failure, upload failure
   - All tests pass via `pnpm test`

9. **AC9: Build Passes** - `pnpm build` succeeds with no TypeScript errors.

## Tasks / Subtasks

- [x] Task 1: Add SFXTriggerResolved type (AC: 6)
  - [x] 1.1: Add `SFXTriggerResolved` interface to `packages/audio-mixer/src/types.ts`

- [x] Task 2: Implement extractSFXTriggers (AC: 2)
  - [x] 2.1: Replace stub in `packages/audio-mixer/src/sfx.ts` with real implementation
  - [x] 2.2: Import `DirectionSegment` from `@nexus-ai/script-gen`
  - [x] 2.3: Parse `segment.audio.sfxCues` for each segment
  - [x] 2.4: Resolve sound IDs via `getSFX()` to get GCS paths
  - [x] 2.5: Convert trigger types to time offsets

- [x] Task 3: Implement GCS helpers (AC: 4)
  - [x] 3.1: Create `packages/audio-mixer/src/gcs-helpers.ts`
  - [x] 3.2: Implement `downloadFromGCS` using native `fetch`
  - [x] 3.3: Implement `uploadToGCS` using `@google-cloud/storage`
  - [x] 3.4: Temp file management with cleanup

- [x] Task 4: Implement FFmpeg mix command builder (AC: 3)
  - [x] 4.1: Create filter_complex string builder for voice + music + SFX
  - [x] 4.2: Apply ducking curve as volume filter on music input
  - [x] 4.3: Apply adelay for SFX trigger timing
  - [x] 4.4: Final mix with normalization

- [x] Task 5: Implement mixAudio orchestrator (AC: 1, 5)
  - [x] 5.1: Create `packages/audio-mixer/src/mix-pipeline.ts`
  - [x] 5.2: Implement full pipeline: download → select music → prepare → VAD → duck → SFX → FFmpeg → upload
  - [x] 5.3: Wrap with executeStage from `@nexus-ai/core`
  - [x] 5.4: Build AudioMixerOutput with metrics

- [x] Task 6: Update exports (AC: 7)
  - [x] 6.1: Export `mixAudio` from index.ts
  - [x] 6.2: Export `SFXTriggerResolved` type
  - [x] 6.3: Verify `extractSFXTriggers` export works with new signature

- [x] Task 7: Write tests (AC: 8)
  - [x] 7.1: Create `packages/audio-mixer/src/__tests__/mix-pipeline.test.ts`
  - [x] 7.2: Test extractSFXTriggers with direction document fixtures
  - [x] 7.3: Test FFmpeg command construction
  - [x] 7.4: Test GCS helpers with mocked fetch/storage
  - [x] 7.5: Test mixAudio orchestration with all mocks
  - [x] 7.6: Test error scenarios

- [x] Task 8: Build and test verification (AC: 9)
  - [x] 8.1: Run `pnpm build` - must pass (17/17 tasks successful)
  - [x] 8.2: Run `pnpm test` - audio-mixer tests pass (292/292, pre-existing failures in orchestrator/core unrelated)

## Dev Notes

### Architecture Constraints

- **Monorepo**: Turborepo + pnpm workspaces. Package at `packages/audio-mixer/`
- **TypeScript strict mode**: All code must compile under strict
- **ESM only**: `"type": "module"` in package.json, use `.js` extensions in imports
- **NexusError**: Import from `@nexus-ai/core` for any error handling
- **No console.log in package code**: Use structured logger from `@nexus-ai/core`
- **Node 20 LTS**: Native `fetch()`, `fs/promises`, etc. available
- **ffmpeg-static**: Already a dependency (`^5.2.0`) - use for all audio operations

### Existing Code to Reuse (DO NOT RECREATE)

**Types in `packages/audio-mixer/src/types.ts`:**
- `AudioMixerInput { voiceTrackUrl: string; directionDocument: DirectionDocument; targetDurationSec: number }`
- `AudioMixerOutput { mixedAudioUrl: string; originalAudioUrl: string; duckingApplied: boolean; metrics: AudioMixerMetrics }`
- `AudioMixerMetrics { voicePeakDb, musicPeakDb, mixedPeakDb, duckingSegments, sfxTriggered, durationSec }`
- `SFXTrigger { segmentId, frame, soundId, volume }` (audio-mixer types - note: NOT the same as script-gen's SFXTrigger type alias)
- `DuckingConfig`, `SpeechSegment`, `GainPoint`
- `SfxTrack`, `SfxLibrary`, `SfxCategory`
- `MusicTrack`, `MusicLibrary`, `MusicSelectionCriteria`, `MoodType`

**Functions already implemented:**
- `detectSpeechSegments(audioPath: string): Promise<SpeechSegment[]>` in `ducking.ts` - uses ffmpeg silencedetect
- `generateDuckingCurve(segments, config, totalDuration): GainPoint[]` in `ducking.ts`
- `loadMusicLibrary(gcsUrl?): Promise<MusicLibrary>` in `music-selector.ts`
- `selectMusic(criteria, library): MusicTrack | null` in `music-selector.ts`
- `prepareLoopedTrack(track, targetDurationSec): Promise<string>` in `music-selector.ts` - returns local file path
- `loadSFXLibrary(gcsUrl?): Promise<SfxLibrary>` in `sfx.ts`
- `getSFX(soundId, library): SfxTrack | undefined` in `sfx.ts`
- `DEFAULT_DUCKING_CONFIG` in `ducking.ts`

**Types from `@nexus-ai/script-gen`:**
- `DirectionDocument { version, metadata, segments: DirectionSegment[], globalAudio: GlobalAudio }`
- `DirectionSegment { id, index, ..., audio?: SegmentAudio }`
- `SegmentAudio { mood?, sfxCues?: SFXCue[], musicTransition?, voiceEmphasis? }`
- `SFXCue { trigger: SFXTrigger, triggerValue?: string, sound: string, volume: number }`
- `SFXTrigger` (type alias) = `'segment_start' | 'segment_end' | 'word' | 'timestamp'`
- `GlobalAudio { defaultMood: AudioMood, musicTransitions: MusicTransitionType }`
- `AudioMood = 'energetic' | 'contemplative' | 'urgent' | 'neutral'`

**IMPORTANT**: `SFXTrigger` in script-gen is a type alias for trigger types. `SFXTrigger` in audio-mixer types.ts is an interface `{ segmentId, frame, soundId, volume }`. These are DIFFERENT types. The audio-mixer `SFXTrigger` interface appears legacy and may not be used by this story. Use `SFXCue` from script-gen for direction document triggers.

**executeStage wrapper** from `@nexus-ai/core`:
```typescript
import { executeStage } from '@nexus-ai/core';

// Signature:
executeStage<TIn, TOut>(
  input: StageInput<TIn>,
  stageName: string,
  execute: (data: TIn, config: StageConfig) => Promise<TOut>,
  options?: { qualityGate?: QualityGateName }
): Promise<StageOutput<TOut>>
```

### extractSFXTriggers Implementation Guide

The `extractSFXTriggers` stub must be replaced. The function should:

1. Accept `DirectionSegment[]` and `SfxLibrary` as parameters
2. For each segment, check `segment.audio?.sfxCues`
3. For each `SFXCue`:
   - Resolve `cue.sound` (library ID) via `getSFX(cue.sound, library)` to get `SfxTrack`
   - Convert trigger type to time offset:
     - `'segment_start'`: use segment start time (needs segment timing info)
     - `'segment_end'`: use segment end time
     - `'word'`: use `triggerValue` as word timing reference
     - `'timestamp'`: use `triggerValue` as direct seconds value
   - Return `SFXTriggerResolved` with resolved GCS path, timing, volume, duration
4. Skip unresolvable sounds (log warning, don't throw)
5. Return sorted by `timeSec`

**Note**: Segment timing may need to come from external source (timestamps from Story 6-5). For initial implementation, support `'timestamp'` trigger type with direct seconds values, and `'segment_start'`/`'segment_end'` using cumulative segment index estimation. The `'word'` trigger type can log a warning and be deferred.

### FFmpeg Filter Complex Pattern

Follow the same ffmpeg-static execution pattern as `ducking.ts` and `music-selector.ts`:

```typescript
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Build filter_complex for mixing
// Input 0: voice.wav
// Input 1: music.wav (already looped/trimmed)
// Input 2+: sfx files

// Music ducking: apply volume curve from GainPoint[]
// Convert GainPoint[] to ffmpeg volume filter expression
// e.g., volume='enable=between(t,0,5):volume=0.1':enable=...

// SFX: adelay each to trigger time, set volume
// e.g., [2]adelay=3500|3500,volume=0.8[sfx0]

// Mix: amix=inputs=N
```

### GCS Helper Pattern

For downloading, convert GCS URL to HTTPS:
```typescript
// gs://bucket/path → https://storage.googleapis.com/bucket/path
const httpUrl = gcsUrl.replace('gs://', 'https://storage.googleapis.com/');
const response = await fetch(httpUrl);
```

For uploading, use `@google-cloud/storage` (root devDependency):
```typescript
import { Storage } from '@google-cloud/storage';
const storage = new Storage();
// Parse bucket and path from gs:// URL
await storage.bucket(bucket).upload(localPath, { destination: path });
```

### Output GCS Path

Mixed audio uploads to: `gs://nexus-ai-artifacts/{pipelineId}/audio-mixer/mixed.wav`
Original audio preserved at: the input `voiceTrackUrl`

### Temp File Management

Use `os.tmpdir()` + UUID for temp files. Clean up all temp files in a `finally` block:
- Downloaded voice track
- Prepared/looped music track (already handled by `prepareLoopedTrack`)
- Downloaded SFX files
- FFmpeg output before upload

### Error Handling Pattern

```typescript
import { NexusError } from '@nexus-ai/core';

// Retryable: network issues, GCS download/upload failures
throw NexusError.retryable('NEXUS_AUDIO_MIXER_DOWNLOAD_FAILED', message, 'audio-mixer');

// Critical: FFmpeg not found, invalid input
throw NexusError.critical('NEXUS_AUDIO_MIXER_MIX_FAILED', message, 'audio-mixer');

// Degraded: SFX resolution failed (continue without SFX)
// Log warning, don't throw
```

### Test Patterns

Follow existing test patterns from `packages/audio-mixer/src/__tests__/`:
- Use `describe/it` blocks with Vitest
- Mock `ffmpeg-static` module to avoid actual ffmpeg execution
- Mock `fetch` for GCS downloads
- Mock `@google-cloud/storage` for uploads
- Mock `child_process.execFile` to capture FFmpeg commands
- Use fixture data for direction documents
- Test command construction by capturing args passed to execFile

### Previous Story Intelligence (6-23)

- Story 6-23 completed the SFX library with `loadSFXLibrary`, `getSFX`, `clearSFXLibraryCache`
- `extractSFXTriggers` was intentionally left as a stub for THIS story (6-24) to implement
- The SFX library has 12 tracks across 4 categories with GCS paths
- WAV fixtures exist for testing at `packages/audio-mixer/src/__fixtures__/sfx-library/`
- `@google-cloud/storage` is a root devDependency (used by upload scripts)

### Git Intelligence

Recent commits follow pattern: `feat(audio-mixer): {description} (Story 6-{num})`
This story: `feat(audio-mixer): implement audio mix pipeline (Story 6-24)`

### Downstream Dependencies

This story provides:
- **Story 6-25** (Audio Mixer Quality Gate): Builds on `mixAudio` output to validate audio quality
- **Story 6-26** (Integrate Audio Mixer Visual Gen): Uses `mixAudio` in the visual generation pipeline

### File Impact

Files to create:
1. `packages/audio-mixer/src/mix-pipeline.ts` - Main mixAudio orchestrator
2. `packages/audio-mixer/src/gcs-helpers.ts` - GCS download/upload utilities
3. `packages/audio-mixer/src/__tests__/mix-pipeline.test.ts` - Tests

Files to modify:
4. `packages/audio-mixer/src/types.ts` - Add SFXTriggerResolved type
5. `packages/audio-mixer/src/sfx.ts` - Replace extractSFXTriggers stub with real implementation
6. `packages/audio-mixer/src/index.ts` - Add new exports (mixAudio, SFXTriggerResolved)

Files for reference (read-only):
- `packages/audio-mixer/src/types.ts` - Existing interfaces
- `packages/audio-mixer/src/ducking.ts` - detectSpeechSegments, generateDuckingCurve, DEFAULT_DUCKING_CONFIG
- `packages/audio-mixer/src/music-selector.ts` - loadMusicLibrary, selectMusic, prepareLoopedTrack
- `packages/audio-mixer/src/sfx.ts` - loadSFXLibrary, getSFX
- `packages/audio-mixer/src/quality-gate.ts` - validateAudioMix stub (Story 6-25)
- `packages/core/src/utils/execute-stage.ts` - executeStage wrapper
- `packages/script-gen/src/types.ts` - DirectionDocument, SFXCue, SegmentAudio types

### Project Structure Notes

- New `mix-pipeline.ts` is the main module; `gcs-helpers.ts` is internal utility
- Both files go in `packages/audio-mixer/src/`
- Follow existing kebab-case file naming convention
- `gcs-helpers.ts` should NOT be exported from index.ts (internal module)

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Story 6.24]
- [Source: _bmad-output/project-context.md - Technology Stack, Critical Rules, Stage Execution Template]
- [Source: packages/audio-mixer/src/types.ts - AudioMixerInput, AudioMixerOutput, AudioMixerMetrics]
- [Source: packages/audio-mixer/src/ducking.ts - detectSpeechSegments, generateDuckingCurve]
- [Source: packages/audio-mixer/src/music-selector.ts - loadMusicLibrary, selectMusic, prepareLoopedTrack]
- [Source: packages/audio-mixer/src/sfx.ts - loadSFXLibrary, getSFX, extractSFXTriggers stub]
- [Source: packages/core/src/utils/execute-stage.ts - executeStage wrapper]
- [Source: packages/script-gen/src/types.ts - DirectionDocument, SFXCue, DirectionSegment]
- [Source: _bmad-output/implementation-artifacts/6-23-initialize-sfx-library.md - Previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build: 17/17 tasks successful, 16 cached
- Tests: 292/292 audio-mixer tests pass (7 test files)
- Pre-existing failures: 66 tests in apps/orchestrator and packages/core (unrelated to this story)

### Completion Notes List

- Added `SFXTriggerResolved` type to types.ts with all required fields
- Replaced `extractSFXTriggers` stub with full implementation supporting all 4 trigger types (segment_start, segment_end, timestamp, word)
- Implemented `downloadFromGCS` using native fetch with gs:// to https:// URL conversion
- Implemented `uploadToGCS` using dynamic import of `@google-cloud/storage` (root devDependency)
- Built `buildFilterComplex` function that constructs FFmpeg filter_complex for voice + music (with ducking volume envelope) + SFX (with adelay timing)
- Implemented `mixAudio` as full pipeline orchestrator wrapped with `executeStage` from `@nexus-ai/core`
- Pipeline flow: download voice → select/prepare music → VAD → ducking curve → extract SFX → download SFX → FFmpeg mix → normalize → upload
- All temp files cleaned up in finally block
- Updated index.ts exports: added `SFXTriggerResolved` type, `mixAudio` function, `buildFilterComplex` function
- Updated stubs.test.ts to remove extractSFXTriggers stub test (no longer a stub)
- Created comprehensive test suite (20 tests) covering extractSFXTriggers, buildFilterComplex, GCS helpers, mixAudio orchestration, and error handling

### Senior Developer Review (AI)

**Reviewer:** Cryptology on 2026-01-28
**Issues Found:** 1 High, 5 Medium, 2 Low
**Issues Fixed:** 6 (all HIGH and MEDIUM)
**Outcome:** Approved

Fixes applied:
1. [HIGH] Fixed SFX trigger-file misalignment on partial download failure - paired triggers with paths to avoid index mismatch
2. [MEDIUM] Fixed hardcoded pipelineId - now uses actual pipeline ID from StageInput via closure
3. [MEDIUM] Added comment documenting that audio metrics are estimates, not measured values
4. [MEDIUM] Added real unit tests for GCS helpers (URL conversion, error paths) - tests went from 292 to 296
5. [MEDIUM] Fixed awkward mood type cast to use direct MoodType cast
6. [MEDIUM] Removed irrelevant webpack comment from ESM project
7. [LOW - not fixed] Node.js imports without `node:` prefix - consistent with existing codebase
8. [LOW - not fixed] buildFilterComplex exported beyond AC7 requirements - acceptable for testability

### Change Log

- 2026-01-28: Implemented audio mix pipeline (Story 6-24) - all 8 tasks complete
- 2026-01-28: Code review fixes - 6 issues fixed (1 HIGH, 5 MEDIUM), 296 tests passing

### File List

Files created:
- `packages/audio-mixer/src/mix-pipeline.ts`
- `packages/audio-mixer/src/gcs-helpers.ts`
- `packages/audio-mixer/src/__tests__/mix-pipeline.test.ts`

Files modified:
- `packages/audio-mixer/src/types.ts` (added SFXTriggerResolved interface)
- `packages/audio-mixer/src/sfx.ts` (replaced extractSFXTriggers stub with implementation)
- `packages/audio-mixer/src/index.ts` (added exports for mixAudio, buildFilterComplex, SFXTriggerResolved)
- `packages/audio-mixer/src/__tests__/stubs.test.ts` (removed extractSFXTriggers stub test)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated story status)
