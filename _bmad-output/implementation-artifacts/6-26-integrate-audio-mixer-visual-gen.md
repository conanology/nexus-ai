# Story 6.26: Integrate Audio Mixer into Visual-Gen

Status: done

## Story

As a developer,
I want audio mixing called before rendering,
so that videos use professionally mixed audio.

## Acceptance Criteria

1. **AC1: Config Flag Check** - `executeVisualGen()` in `packages/visual-gen/src/visual-gen.ts` checks if audio mixing is enabled via a config flag (e.g., `data.directionDocument` exists AND `data.audioMixingEnabled !== false`). When mixing is disabled or no directionDocument exists, skip mixing and use original audio.

2. **AC2: Call mixAudio** - When mixing is enabled, call `mixAudio()` from `@nexus-ai/audio-mixer` with:
   - `voiceTrackUrl`: `data.audioUrl` (the TTS voice track)
   - `directionDocument`: `data.directionDocument`
   - `targetDurationSec`: `data.audioDurationSec`
   - Wrap in a StageInput with the same `pipelineId` and config

3. **AC3: VisualGenOutput Updated** - `VisualGenOutput` interface in `packages/visual-gen/src/types.ts` includes:
   - `originalAudioUrl: string` — pass-through TTS audio URL (same as `audioUrl` input)
   - `mixedAudioUrl?: string` — mixed audio URL (if mixing succeeded)
   - `finalAudioUrl: string` — the URL actually passed to render (mixed or original)

4. **AC4: Fallback Logic** - If `mixAudio()` throws or fails, log a warning, use original TTS audio as `finalAudioUrl`, set `mixedAudioUrl` to undefined, and continue rendering. Do NOT fail the stage due to mixing failure.

5. **AC5: Render Uses finalAudioUrl** - The render service call passes `finalAudioUrl` (mixed or original) instead of `data.audioUrl`.

6. **AC6: Quality Status Reflects Mixing** - Quality measurements include:
   - `audioMixingApplied: boolean` — whether mixed audio was used
   - `audioMixingFailed: boolean` — whether mixing was attempted but failed (triggers DEGRADED)
   - If mixing failed, set `qualityStatus` to `'DEGRADED'`

7. **AC7: Cost Tracking** - If mixing succeeds, record audio-mixer costs in the stage cost tracker.

8. **AC8: Tests** - Unit tests in `packages/visual-gen/src/__tests__/` covering:
   - Mixing enabled with directionDocument: calls mixAudio, uses mixed URL
   - Mixing disabled (no directionDocument): skips mixing, uses original audio
   - Mixing fails: falls back to original audio, quality DEGRADED
   - finalAudioUrl passed to render service
   - VisualGenOutput includes all three audio URL fields
   - All tests pass via `pnpm test`

9. **AC9: Build Passes** - `pnpm build` succeeds with no TypeScript errors.

## Tasks / Subtasks

- [x] Task 1: Update VisualGenInput type (AC: 1)
  - [x] 1.1: Add optional `audioMixingEnabled?: boolean` field to `VisualGenInput` in `packages/visual-gen/src/types.ts`

- [x] Task 2: Update VisualGenOutput type (AC: 3)
  - [x] 2.1: Add `originalAudioUrl: string` to `VisualGenOutput` in `packages/visual-gen/src/types.ts`
  - [x] 2.2: Add `mixedAudioUrl?: string` to `VisualGenOutput`
  - [x] 2.3: Add `finalAudioUrl: string` to `VisualGenOutput`

- [x] Task 3: Add @nexus-ai/audio-mixer dependency (AC: 2)
  - [x] 3.1: Add `"@nexus-ai/audio-mixer": "workspace:*"` to `packages/visual-gen/package.json` dependencies

- [x] Task 4: Integrate audio mixing into executeVisualGen (AC: 1, 2, 4, 5, 6, 7)
  - [x] 4.1: Import `mixAudio` and types from `@nexus-ai/audio-mixer`
  - [x] 4.2: After timeline upload (Step 4) and before render call (Step 5), add audio mixing step
  - [x] 4.3: Check mixing enabled: `data.directionDocument && data.audioMixingEnabled !== false`
  - [x] 4.4: If enabled, build `StageInput<AudioMixerInput>` and call `mixAudio()`
  - [x] 4.5: On success: set `mixedAudioUrl` from result, `finalAudioUrl = mixedAudioUrl`
  - [x] 4.6: On failure: log warning, set `mixedAudioUrl = undefined`, `finalAudioUrl = data.audioUrl`
  - [x] 4.7: If mixing disabled: `finalAudioUrl = data.audioUrl`
  - [x] 4.8: Pass `finalAudioUrl` to render service request body instead of `data.audioUrl`
  - [x] 4.9: Add `audioMixingApplied` and `audioMixingFailed` to quality measurements
  - [x] 4.10: If mixing failed, mark `qualityStatus = 'DEGRADED'`
  - [x] 4.11: If mixing succeeded and mixer returned costs, record via cost tracker
  - [x] 4.12: Include `originalAudioUrl`, `mixedAudioUrl`, `finalAudioUrl` in return data

- [x] Task 5: Write tests (AC: 8)
  - [x] 5.1: Create or update test file for audio mixing integration
  - [x] 5.2: Test mixing enabled with directionDocument — calls mixAudio, uses mixed URL
  - [x] 5.3: Test mixing disabled (no directionDocument) — skips mixing, uses original audio
  - [x] 5.4: Test mixing fails — falls back to original audio, quality DEGRADED
  - [x] 5.5: Test finalAudioUrl passed to render service
  - [x] 5.6: Test VisualGenOutput includes all three audio URL fields

- [x] Task 6: Build and test verification (AC: 9)
  - [x] 6.1: Run `pnpm build` — must pass (17/17 tasks)
  - [x] 6.2: Run `pnpm test` — all 16 new visual-gen tests pass (2 pre-existing scene-mapper failures unrelated)

## Dev Notes

### Architecture Constraints

- **Monorepo**: Turborepo + pnpm workspaces. Package at `packages/visual-gen/`
- **TypeScript strict mode**: All code must compile under strict
- **ESM only**: `"type": "module"` in package.json, use `.js` extensions in imports
- **NexusError**: Import from `@nexus-ai/core` for error handling
- **No console.log**: Use structured logger from `@nexus-ai/core`
- **Node 20 LTS**: Native `fetch()`, `fs/promises`, etc. available
- **executeStage wrapper**: `executeVisualGen` uses `executeStage` — the inner function returns data that `executeStage` wraps into `StageOutput`

### Key Integration Points

**mixAudio signature** (from `@nexus-ai/audio-mixer`):
```typescript
async function mixAudio(
  input: StageInput<AudioMixerInput>
): Promise<StageOutput<AudioMixerOutput>>
```

**AudioMixerInput** requires:
- `voiceTrackUrl: string` — map from `data.audioUrl`
- `directionDocument: DirectionDocument` — map from `data.directionDocument`
- `targetDurationSec: number` — map from `data.audioDurationSec`

**AudioMixerOutput** provides:
- `mixedAudioUrl: string` — the mixed audio URL for render
- `originalAudioUrl: string` — pass-through original
- `duckingApplied: boolean` — whether ducking was applied
- `metrics: AudioMixerMetrics` — quality metrics

### Placement in executeVisualGen

Insert audio mixing AFTER timeline upload (current Step 4) and BEFORE render service call (current Step 5). The flow becomes:

1. Parse visual cues (existing Step 1)
2. Map cues to components (existing Step 2)
3. Generate timeline (existing Step 3)
4. Upload timeline to Cloud Storage (existing Step 4)
5. **NEW: Audio mixing step** — call mixAudio if enabled, determine finalAudioUrl
6. Call render service with finalAudioUrl (existing Step 5, modified)
7. Calculate quality metrics (existing Step 6, extended)

### Fallback Pattern

```typescript
let finalAudioUrl = data.audioUrl; // default: original TTS audio
let mixedAudioUrl: string | undefined;
let audioMixingApplied = false;
let audioMixingFailed = false;

const mixingEnabled = !!data.directionDocument && data.audioMixingEnabled !== false;

if (mixingEnabled) {
  try {
    const mixResult = await mixAudio(/* ... */);
    mixedAudioUrl = mixResult.data.mixedAudioUrl;
    finalAudioUrl = mixedAudioUrl;
    audioMixingApplied = true;
  } catch (error) {
    logger.warn({
      msg: 'Audio mixing failed - using original TTS audio',
      pipelineId,
      stage: 'visual-gen',
      error: error instanceof Error ? error.message : String(error),
    });
    audioMixingFailed = true;
  }
}
```

### Existing Code to Reuse (DO NOT RECREATE)

- **`executeStage`** from `@nexus-ai/core` — already used in visual-gen.ts
- **`mixAudio`** from `@nexus-ai/audio-mixer` — call it, don't rewrite it
- **`StageInput`/`StageOutput`** types from `@nexus-ai/core`
- **`logger`** from `@nexus-ai/core` — already imported in visual-gen.ts
- **`NexusError`** from `@nexus-ai/core` — already imported in visual-gen.ts

### Current VisualGenOutput Fields (preserve all)

```typescript
interface VisualGenOutput {
  timelineUrl: string;
  sceneCount: number;
  fallbackUsage: number;
  videoPath: string;
  topicData?: { title: string; url: string; source: string; publishedAt: string; viralityScore: number; metadata?: Record<string, unknown> };
  script?: string;
  audioDurationSec?: number;
  // NEW:
  originalAudioUrl: string;
  mixedAudioUrl?: string;
  finalAudioUrl: string;
}
```

### Test Strategy

The existing test file is `packages/visual-gen/src/__tests__/visual-gen-v2.test.ts`. The audio mixing integration tests should be added to this file or a new companion file. The tests need to mock:
- `mixAudio` from `@nexus-ai/audio-mixer` (vi.mock)
- `fetch` for render service calls (already mocked in existing tests)
- `CloudStorageClient` (already mocked in existing tests)

### Previous Story Intelligence (6-25)

- Story 6-25 completed the audio mixer quality gate (`validateAudioMix`)
- The quality gate validates: duration match (CRITICAL), clipping (DEGRADED), voice levels (DEGRADED), music ducking (DEGRADED)
- Note: "peak dB values are estimates based on loudnorm target settings, not measured from output"
- Pre-existing test failures in packages/core (health.test.ts, execute-stage.test.ts) are unrelated
- Build: 17/17 tasks pass; 20 audio-mixer tests pass

### Render Service Call Modification

Current code sends `audioUrl: data.audioUrl` to render service. Update to:
```typescript
body: JSON.stringify({
  pipelineId,
  timelineUrl,
  audioUrl: finalAudioUrl,  // Changed from data.audioUrl
  resolution: '1080p',
}),
```

### Quality Measurements Extension

Add to existing `qualityMeasurements` object:
```typescript
const qualityMeasurements = {
  sceneCount: timeline.scenes.length,
  fallbackUsage,
  fallbackPercentage,
  timelineAlignmentError: alignmentError,
  qualityStatus,
  audioMixingApplied,  // NEW
  audioMixingFailed,   // NEW
};
```

If `audioMixingFailed` is true, set `qualityStatus = 'DEGRADED'`.

### Git Intelligence

Recent commits follow pattern: `feat(audio-mixer): {description} (Story 6-{num})`
This story crosses packages, so commit: `feat(visual-gen): integrate audio mixer into visual-gen (Story 6-26)`

### Project Structure Notes

- `packages/visual-gen/package.json` needs new dependency `@nexus-ai/audio-mixer`
- No new files needed except possibly a test file
- Main changes in `visual-gen.ts` and `types.ts`
- The integration is within the `executeStage` callback — `mixAudio` is itself wrapped in `executeStage`, so this is a stage-within-a-stage call (nested), which is acceptable for composition

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Story 6.26]
- [Source: _bmad-output/project-context.md - Stage Execution Template, Quality Gate Framework]
- [Source: packages/visual-gen/src/visual-gen.ts - Current executeVisualGen implementation]
- [Source: packages/visual-gen/src/types.ts - VisualGenInput, VisualGenOutput]
- [Source: packages/audio-mixer/src/mix-pipeline.ts - mixAudio function]
- [Source: packages/audio-mixer/src/types.ts - AudioMixerInput, AudioMixerOutput]
- [Source: packages/audio-mixer/src/index.ts - Public exports]
- [Source: _bmad-output/implementation-artifacts/6-25-implement-audio-mixer-quality-gate.md - Previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Integrated audio mixer into visual-gen pipeline as new Step 5 between timeline upload and render service call
- Added `audioMixingEnabled` flag to `VisualGenInput` for opt-out control
- Added `originalAudioUrl`, `mixedAudioUrl`, `finalAudioUrl` to `VisualGenOutput`
- Implemented fallback: if mixAudio fails, stage continues with original TTS audio and quality set to DEGRADED
- Render service now receives `finalAudioUrl` (mixed or original) instead of raw `data.audioUrl`
- Quality measurements extended with `audioMixingApplied` and `audioMixingFailed` booleans
- Cost tracking records audio-mixer costs via config.tracker when mixing succeeds
- Created 18 integration tests covering all ACs (AC1-AC7)
- Used `vi.hoisted()` pattern for mock variable declarations to work with Vitest's vi.mock hoisting
- Build: 17/17 tasks pass; 16/16 new tests pass; 2 pre-existing scene-mapper failures unrelated

### File List

- `packages/visual-gen/src/types.ts` (modified) — Added `audioMixingEnabled` to VisualGenInput; added `originalAudioUrl`, `mixedAudioUrl`, `finalAudioUrl` to VisualGenOutput
- `packages/visual-gen/src/visual-gen.ts` (modified) — Imported mixAudio from audio-mixer; added audio mixing step (Step 5) with fallback; updated render call to use finalAudioUrl; extended quality measurements
- `packages/visual-gen/package.json` (modified) — Added `@nexus-ai/audio-mixer: workspace:*` dependency
- `packages/visual-gen/src/__tests__/audio-mixing-integration.test.ts` (new) — 19 integration tests covering AC1-AC7
- `pnpm-lock.yaml` (modified) — Updated lockfile from adding @nexus-ai/audio-mixer dependency

### Change Log

- 2026-01-28: Implemented audio mixer integration into visual-gen stage (Story 6-26). Added mixing step, fallback logic, quality tracking, cost recording, and 16 tests.
- 2026-01-28: Code review fixes — Strengthened AC7 cost tracking test to verify recordApiCall, added negative cost test for mixing failure, added explicit audioMixingEnabled:true test, updated File List with pnpm-lock.yaml.
