# Story 6.25: Implement Audio Mixer Quality Gate

Status: done

## Story

As a developer,
I want quality validation for mixed audio,
so that audio issues are caught before rendering.

## Acceptance Criteria

1. **AC1: validateAudioMix Function** - Replace the stub in `packages/audio-mixer/src/quality-gate.ts` with `validateAudioMix(output: AudioMixerOutput, input: AudioMixerInput): AudioMixerQualityResult` that validates:
   - `durationMatch`: output `metrics.durationSec` within 1% of `input.targetDurationSec` (CRITICAL — FAIL if mismatch)
   - `noClipping`: `metrics.mixedPeakDb` < -0.5 dB headroom check (DEGRADED if fails)
   - `voiceLevels`: `metrics.voicePeakDb` between -9 dB and -3 dB (DEGRADED if fails)
   - `musicDucking`: `metrics.musicPeakDb` < -18 dB during speech — only checked when `output.duckingApplied === true` (DEGRADED if fails)

2. **AC2: AudioMixerQualityResult Type** - Add to `packages/audio-mixer/src/types.ts`:
   - `AudioMixerQualityResult { status: 'PASS' | 'DEGRADED' | 'FAIL'; checks: Record<string, AudioQualityCheckResult>; flags: string[]; metrics: AudioMixerQualityMetrics }`
   - `AudioQualityCheckResult { passed: boolean; severity?: 'CRITICAL' | 'DEGRADED'; code?: string; message: string; actualValue: number; threshold: number }`
   - `AudioMixerQualityMetrics { peakDb: number; voicePeakDb: number; musicDuckLevel: number; durationDiffPercent: number }`

3. **AC3: Error Codes** - Add to `packages/audio-mixer/src/types.ts`:
   - `AUDIO_MIXER_ERROR_CODES` constant with: `DURATION_MISMATCH`, `CLIPPING_DETECTED`, `VOICE_LEVEL_OUT_OF_RANGE`, `MUSIC_DUCK_INSUFFICIENT`
   - `AUDIO_MIXER_QUALITY_THRESHOLDS` constant with: `DURATION_MATCH_PERCENT: 1`, `MAX_PEAK_DB: -0.5`, `VOICE_MIN_DB: -9`, `VOICE_MAX_DB: -3`, `MUSIC_DUCK_MAX_DB: -18`

4. **AC4: Export Updates** - Update `packages/audio-mixer/src/index.ts`:
   - Export `validateAudioMix` (replace stub export comment with real export)
   - Export types: `AudioMixerQualityResult`, `AudioQualityCheckResult`, `AudioMixerQualityMetrics`
   - Export constants: `AUDIO_MIXER_ERROR_CODES`, `AUDIO_MIXER_QUALITY_THRESHOLDS`

5. **AC5: Tests** - Replace `packages/audio-mixer/src/__tests__/stubs.test.ts` with `packages/audio-mixer/src/__tests__/quality-gate.test.ts`:
   - Test PASS: all checks pass with valid audio output
   - Test FAIL: duration mismatch beyond 1% threshold (CRITICAL → FAIL)
   - Test DEGRADED: clipping detected (peak >= -0.5dB)
   - Test DEGRADED: voice levels outside -9dB to -3dB range
   - Test DEGRADED: insufficient music ducking (>= -18dB during speech)
   - Test PASS: music ducking check skipped when `duckingApplied === false`
   - Test DEGRADED+FAIL combo: multiple checks failing (CRITICAL overrides DEGRADED)
   - Test edge cases: exact threshold boundaries
   - All tests pass via `pnpm test`

6. **AC6: Build Passes** - `pnpm build` succeeds with no TypeScript errors.

## Tasks / Subtasks

- [x] Task 1: Add quality gate types and constants (AC: 2, 3)
  - [x] 1.1: Add `AudioMixerQualityResult` interface to `packages/audio-mixer/src/types.ts`
  - [x] 1.2: Add `AudioQualityCheckResult` interface to `packages/audio-mixer/src/types.ts`
  - [x] 1.3: Add `AudioMixerQualityMetrics` interface to `packages/audio-mixer/src/types.ts`
  - [x] 1.4: Add `AUDIO_MIXER_ERROR_CODES` constant to `packages/audio-mixer/src/types.ts`
  - [x] 1.5: Add `AUDIO_MIXER_QUALITY_THRESHOLDS` constant to `packages/audio-mixer/src/types.ts`

- [x] Task 2: Implement validateAudioMix (AC: 1)
  - [x] 2.1: Replace stub in `packages/audio-mixer/src/quality-gate.ts` with real implementation
  - [x] 2.2: Implement `checkDurationMatch(output, input)` — CRITICAL severity
  - [x] 2.3: Implement `checkNoClipping(output)` — DEGRADED severity
  - [x] 2.4: Implement `checkVoiceLevels(output)` — DEGRADED severity
  - [x] 2.5: Implement `checkMusicDucking(output)` — DEGRADED severity, only when `duckingApplied`
  - [x] 2.6: Aggregate check results: FAIL if any CRITICAL fails, DEGRADED if any non-critical fails, PASS otherwise
  - [x] 2.7: Build and return `AudioMixerQualityMetrics` from output metrics

- [x] Task 3: Update exports (AC: 4)
  - [x] 3.1: Update `packages/audio-mixer/src/index.ts` — export `validateAudioMix` (remove stub comment)
  - [x] 3.2: Export new types: `AudioMixerQualityResult`, `AudioQualityCheckResult`, `AudioMixerQualityMetrics`
  - [x] 3.3: Export new constants: `AUDIO_MIXER_ERROR_CODES`, `AUDIO_MIXER_QUALITY_THRESHOLDS`

- [x] Task 4: Write tests (AC: 5)
  - [x] 4.1: Rename/replace `packages/audio-mixer/src/__tests__/stubs.test.ts` → `quality-gate.test.ts`
  - [x] 4.2: Create test helper to build mock `AudioMixerOutput` and `AudioMixerInput`
  - [x] 4.3: Test all PASS scenario
  - [x] 4.4: Test FAIL for duration mismatch (>1%)
  - [x] 4.5: Test DEGRADED for clipping (peak >= -0.5dB)
  - [x] 4.6: Test DEGRADED for voice levels out of range
  - [x] 4.7: Test DEGRADED for insufficient music ducking
  - [x] 4.8: Test PASS when ducking check skipped (duckingApplied=false)
  - [x] 4.9: Test combined failures (CRITICAL overrides DEGRADED)
  - [x] 4.10: Test exact threshold boundaries

- [x] Task 5: Build and test verification (AC: 6)
  - [x] 5.1: Run `pnpm build` — must pass
  - [x] 5.2: Run `pnpm test` — all audio-mixer tests pass (20/20)

## Dev Notes

### Architecture Constraints

- **Monorepo**: Turborepo + pnpm workspaces. Package at `packages/audio-mixer/`
- **TypeScript strict mode**: All code must compile under strict
- **ESM only**: `"type": "module"` in package.json, use `.js` extensions in imports
- **NexusError**: Import from `@nexus-ai/core` for any error handling (NOT needed for quality gate — quality gate returns result objects, doesn't throw)
- **No console.log**: Use structured logger from `@nexus-ai/core` if logging is needed
- **Node 20 LTS**: Native `fetch()`, `fs/promises`, etc. available

### Follow the timestamp-extraction Quality Gate Pattern

The `packages/timestamp-extraction/src/quality-gate.ts` is the closest reference implementation. Follow its structure exactly:

1. **Main validation function** that runs all individual checks and aggregates results
2. **Individual check functions** (one per validation rule) that each return a `QualityCheckResult`
3. **Status aggregation**: FAIL if any CRITICAL fails, DEGRADED if any non-critical fails, PASS if all pass
4. **Error codes** as constants, **thresholds** as constants
5. **Result type** with `status`, `checks` record, and `flags` array

Key difference: The audio-mixer quality gate also returns `AudioMixerQualityMetrics` in the result.

### Existing Code to Reuse (DO NOT RECREATE)

**Types in `packages/audio-mixer/src/types.ts`:**
- `AudioMixerInput { voiceTrackUrl: string; directionDocument: DirectionDocument; targetDurationSec: number }`
- `AudioMixerOutput { mixedAudioUrl: string; originalAudioUrl: string; duckingApplied: boolean; metrics: AudioMixerMetrics }`
- `AudioMixerMetrics { voicePeakDb: number; musicPeakDb: number; mixedPeakDb: number; duckingSegments: number; sfxTriggered: number; durationSec: number }`

The `validateAudioMix` function reads values from `AudioMixerOutput.metrics` and compares against `AudioMixerInput.targetDurationSec`. It does NOT invoke FFmpeg or perform audio analysis — it only validates the metrics already computed by `mixAudio`.

### Quality Check Mapping

| Check | Input Field | Threshold | Severity |
|-------|------------|-----------|----------|
| `durationMatch` | `output.metrics.durationSec` vs `input.targetDurationSec` | Within 1% | CRITICAL |
| `noClipping` | `output.metrics.mixedPeakDb` | < -0.5 dB | DEGRADED |
| `voiceLevels` | `output.metrics.voicePeakDb` | -9 dB to -3 dB | DEGRADED |
| `musicDucking` | `output.metrics.musicPeakDb` | < -18 dB | DEGRADED (skip if !duckingApplied) |

### Metrics Calculation

```typescript
// AudioMixerQualityMetrics built from:
{
  peakDb: output.metrics.mixedPeakDb,           // Overall peak from output
  voicePeakDb: output.metrics.voicePeakDb,      // Voice peak from output
  musicDuckLevel: output.metrics.musicPeakDb,    // Music level during speech
  durationDiffPercent: Math.abs(output.metrics.durationSec - input.targetDurationSec) / input.targetDurationSec * 100
}
```

### File Impact

Files to modify:
1. `packages/audio-mixer/src/types.ts` — Add quality result types and constants
2. `packages/audio-mixer/src/quality-gate.ts` — Replace stub with real implementation
3. `packages/audio-mixer/src/index.ts` — Update exports (remove stub comment, add new type exports)

Files to create:
4. `packages/audio-mixer/src/__tests__/quality-gate.test.ts` — Quality gate tests

Files to delete:
5. `packages/audio-mixer/src/__tests__/stubs.test.ts` — No longer needed (quality gate was the only stub)

Files for reference (read-only):
- `packages/timestamp-extraction/src/quality-gate.ts` — Reference implementation pattern
- `packages/timestamp-extraction/src/types.ts` — Reference types pattern (TimestampQualityResult, QualityCheckResult, QUALITY_THRESHOLDS)
- `packages/core/src/quality/types.ts` — Core quality framework types
- `packages/audio-mixer/src/mix-pipeline.ts` — The `mixAudio` function that produces `AudioMixerOutput`

### Test Fixture Helpers

```typescript
function makeOutput(overrides?: Partial<AudioMixerOutput>): AudioMixerOutput {
  return {
    mixedAudioUrl: 'https://storage.googleapis.com/nexus-ai-artifacts/2026-01-28/audio-mixer/mixed.wav',
    originalAudioUrl: 'https://storage.googleapis.com/nexus-ai-artifacts/2026-01-28/tts/voice.wav',
    duckingApplied: true,
    metrics: {
      voicePeakDb: -6,
      musicPeakDb: -20,
      mixedPeakDb: -6,
      duckingSegments: 5,
      sfxTriggered: 2,
      durationSec: 120,
    },
    ...overrides,
  };
}

function makeInput(overrides?: Partial<AudioMixerInput>): AudioMixerInput {
  return {
    voiceTrackUrl: 'gs://nexus-ai-artifacts/2026-01-28/tts/voice.wav',
    directionDocument: { /* minimal valid document */ } as DirectionDocument,
    targetDurationSec: 120,
    ...overrides,
  };
}
```

### Previous Story Intelligence (6-24)

- Story 6-24 completed the full mix pipeline with `mixAudio` function
- `AudioMixerOutput.metrics` contains the values this quality gate validates
- Note from 6-24 review: "peak dB values are estimates based on loudnorm target settings, not measured from output" — the quality gate should still validate these estimates as they represent the intended output characteristics
- Quality gate integration was explicitly deferred to THIS story (6-25): "Quality gate integration deferred to Story 6-25" (AC5 of 6-24)
- The `mixAudio` function wraps with `executeStage` but does NOT pass a `qualityGate` option — that integration can be done separately if needed

### Git Intelligence

Recent commits follow pattern: `feat(audio-mixer): {description} (Story 6-{num})`
This story: `feat(audio-mixer): implement audio mixer quality gate (Story 6-25)`

### Downstream Dependencies

- **Story 6-26** (Integrate Audio Mixer Visual Gen): May use quality gate result to determine if mixed audio is safe to render

### Project Structure Notes

- Quality gate implementation replaces stub — same file path, no new module structure needed
- Test file replaces stubs.test.ts — rename to quality-gate.test.ts since no stubs remain
- Follow timestamp-extraction pattern for consistency across packages
- Constants and types co-locate in types.ts (same pattern as timestamp-extraction)

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Story 6.25]
- [Source: _bmad-output/project-context.md - Quality Gate Framework, Stage Execution Template]
- [Source: packages/audio-mixer/src/types.ts - AudioMixerInput, AudioMixerOutput, AudioMixerMetrics]
- [Source: packages/audio-mixer/src/quality-gate.ts - Current stub implementation]
- [Source: packages/audio-mixer/src/mix-pipeline.ts - mixAudio, executeMixPipeline]
- [Source: packages/audio-mixer/src/index.ts - Current exports including validateAudioMix stub]
- [Source: packages/timestamp-extraction/src/quality-gate.ts - Reference quality gate pattern]
- [Source: packages/core/src/quality/types.ts - QualityStatus, QualityGateResult framework types]
- [Source: _bmad-output/implementation-artifacts/6-24-implement-audio-mix-pipeline.md - Previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Implemented `validateAudioMix` function following timestamp-extraction quality gate pattern
- Added 3 interfaces: `AudioMixerQualityResult`, `AudioQualityCheckResult`, `AudioMixerQualityMetrics`
- Added 2 constants: `AUDIO_MIXER_ERROR_CODES` (4 codes), `AUDIO_MIXER_QUALITY_THRESHOLDS` (5 thresholds)
- 4 individual check functions: `checkDurationMatch` (CRITICAL), `checkNoClipping` (DEGRADED), `checkVoiceLevels` (DEGRADED), `checkMusicDucking` (DEGRADED, conditional on duckingApplied)
- Status aggregation: FAIL if any CRITICAL fails, DEGRADED if any non-critical fails, PASS if all pass
- Metrics object built from output.metrics fields with computed durationDiffPercent
- 20 tests covering all acceptance criteria including edge cases at exact threshold boundaries
- Build passes (17/17 tasks), all 20 audio-mixer quality-gate tests pass
- Pre-existing test failures in packages/core (health.test.ts, execute-stage.test.ts) are unrelated to this story

### File List

- `packages/audio-mixer/src/types.ts` — Modified: added quality gate types and constants
- `packages/audio-mixer/src/quality-gate.ts` — Modified: replaced stub with full implementation
- `packages/audio-mixer/src/index.ts` — Modified: updated exports (types, constants, removed stub comment)
- `packages/audio-mixer/src/__tests__/quality-gate.test.ts` — Created: 20 quality gate tests
- `packages/audio-mixer/src/__tests__/stubs.test.ts` — Deleted: no longer needed
