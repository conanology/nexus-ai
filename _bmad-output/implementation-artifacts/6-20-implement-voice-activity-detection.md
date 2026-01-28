# Story 6.20: Implement Voice Activity Detection

Status: done

## Story

As a developer,
I want VAD-based speech detection,
so that music ducking triggers precisely during voice.

## Acceptance Criteria

1. **AC1: detectSpeechSegments Function** - `packages/audio-mixer/src/ducking.ts` exports `detectSpeechSegments(audioPath: string): Promise<SpeechSegment[]>` that:
   - Accepts a local file path to a WAV/MP3 audio file
   - Uses `@anthropic-ai/vad` or equivalent VAD library for speech detection
   - Analyzes voice track for speech presence
   - Returns array of `SpeechSegment` objects `{ startSec: number, endSec: number }`
   - Handles various audio formats by converting to 16kHz mono WAV via ffmpeg before analysis
   - Merges adjacent speech segments closer than 200ms apart
   - Returns empty array for silent audio (no speech detected)
   - Throws `NexusError.retryable('NEXUS_AUDIO_MIXER_VAD_FAILED', ...)` on processing errors

2. **AC2: generateDuckingCurve Function** - `packages/audio-mixer/src/ducking.ts` exports `generateDuckingCurve(speechSegments: SpeechSegment[], config: DuckingConfig, totalDurationSec: number): GainPoint[]` that:
   - Creates time-indexed gain values for music track ducking
   - Music level: `config.speechLevel` dB during speech (default: -20)
   - Music level: `config.silenceLevel` dB during silence (default: -12)
   - Attack time: `config.attackMs` ms (default: 50) - exponential curve shape
   - Release time: `config.releaseMs` ms (default: 300) - linear curve shape
   - Returns sorted array of `GainPoint` objects `{ timeSec: number, gainDb: number }`
   - Includes initial point at t=0 and final point at `totalDurationSec`
   - Handles empty segments array (returns flat curve at `silenceLevel`)
   - Handles overlapping segments gracefully

3. **AC3: DuckingConfig Defaults** - Export `DEFAULT_DUCKING_CONFIG: DuckingConfig` constant:
   - `speechLevel: -20` (dB for music during speech)
   - `silenceLevel: -12` (dB for music during silence)
   - `attackMs: 50` (quick duck)
   - `releaseMs: 300` (gradual return)

4. **AC4: Unit Tests** - `packages/audio-mixer/src/__tests__/ducking.test.ts` with:
   - `generateDuckingCurve` tests: empty segments, single segment, multiple segments, overlapping segments, custom config, default config usage
   - `detectSpeechSegments` tests: mocked VAD engine, format conversion path, error handling, empty audio
   - All tests pass via `pnpm test`

5. **AC5: Build Passes** - `pnpm build` succeeds with no TypeScript errors

## Tasks / Subtasks

- [x] Task 1: Add VAD dependency (AC: 1)
  - [x] 1.1: Research and add appropriate VAD npm package to `packages/audio-mixer/package.json` (prefer `@anthropic-ai/vad`, `vad-web`, or `node-vad` - whichever has best Node.js support for offline VAD)
  - [x] 1.2: Run `pnpm install` to link new dependency

- [x] Task 2: Implement detectSpeechSegments (AC: 1)
  - [x] 2.1: Replace stub in `packages/audio-mixer/src/ducking.ts` with real implementation
  - [x] 2.2: Implement audio format conversion to 16kHz mono WAV using `ffmpeg-static` (already a dependency)
  - [x] 2.3: Implement VAD analysis using chosen library
  - [x] 2.4: Implement segment merging for gaps < 200ms
  - [x] 2.5: Add proper error handling with NexusError codes

- [x] Task 3: Implement generateDuckingCurve (AC: 2, 3)
  - [x] 3.1: Export `DEFAULT_DUCKING_CONFIG` constant
  - [x] 3.2: Implement curve generation with exponential attack and linear release
  - [x] 3.3: Handle edge cases: empty segments, overlapping segments, zero duration

- [x] Task 4: Update index.ts exports (AC: 1, 2, 3)
  - [x] 4.1: Export `DEFAULT_DUCKING_CONFIG` from `src/index.ts`
  - [x] 4.2: Ensure `detectSpeechSegments` and `generateDuckingCurve` signatures updated in barrel export

- [x] Task 5: Write unit tests (AC: 4)
  - [x] 5.1: Create `packages/audio-mixer/src/__tests__/ducking.test.ts`
  - [x] 5.2: Test `generateDuckingCurve` - pure function, no mocking needed:
    - Empty segments returns flat curve at silenceLevel
    - Single segment produces attack/release envelope
    - Multiple segments produce correct envelope
    - Custom config values applied correctly
    - Overlapping segments handled
    - Points are sorted by time
    - Includes t=0 and t=totalDuration points
  - [x] 5.3: Test `detectSpeechSegments` - mock VAD library and ffmpeg:
    - Returns SpeechSegment[] from mocked VAD output
    - Merges segments closer than 200ms
    - Returns empty array for silent audio
    - Throws NexusError on processing failure
    - Calls ffmpeg for format conversion

- [x] Task 6: Build and test verification (AC: 5)
  - [x] 6.1: Run `pnpm build` - must pass
  - [x] 6.2: Run `pnpm test` - must pass

## Dev Notes

### Architecture Constraints

- **Monorepo**: Turborepo + pnpm workspaces. Package at `packages/audio-mixer/`
- **TypeScript strict mode**: All code must compile under strict
- **ESM only**: `"type": "module"` in package.json, use `.js` extensions in imports
- **NexusError**: Import from `@nexus-ai/core`. Use `NexusError.retryable()` for transient failures, `NexusError.critical()` for unrecoverable
- **No console.log**: Use structured logger from `@nexus-ai/core` if logging needed
- **Error code format**: `NEXUS_AUDIO_MIXER_{TYPE}` (e.g., `NEXUS_AUDIO_MIXER_VAD_FAILED`)

### Existing Code to Modify

**`packages/audio-mixer/src/ducking.ts`** - Currently contains stubs that throw `NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED`. Replace stubs with real implementations. The function signatures must change from `(): never` to proper typed signatures.

**`packages/audio-mixer/src/index.ts`** - May need to re-export `DEFAULT_DUCKING_CONFIG` constant.

### Existing Types (DO NOT RECREATE)

All types are already defined in `packages/audio-mixer/src/types.ts`:
- `SpeechSegment { startSec: number; endSec: number }`
- `GainPoint { timeSec: number; gainDb: number }`
- `DuckingConfig { speechLevel: number; silenceLevel: number; attackMs: number; releaseMs: number }`

Import these from `./types.js` (ESM extension).

### VAD Library Selection

The epics file specifies `avr-vad` with Silero VAD v5 model. If `avr-vad` is not available on npm, use one of these alternatives:
1. `@anthropic-ai/vad` - if available
2. `vad-node` or `node-vad` - Node.js native VAD
3. `@ricky0123/vad-node` - Silero VAD wrapper for Node.js
4. Manual approach: use `ffmpeg-static` to detect silence periods (via `silencedetect` filter) and invert to get speech segments

The **ffmpeg silencedetect fallback** is the most reliable approach since `ffmpeg-static` is already a dependency:
```bash
ffmpeg -i input.wav -af silencedetect=noise=-30dB:d=0.3 -f null -
```
This outputs silence start/end timestamps which can be inverted to speech segments.

### generateDuckingCurve Algorithm

Pure function - no external dependencies needed:

1. Start with gain at `silenceLevel` at t=0
2. For each speech segment:
   - At `startSec - attackMs/1000`: begin attack (transition from silenceLevel to speechLevel)
   - At `startSec`: reach speechLevel (exponential curve)
   - At `endSec`: begin release (transition from speechLevel to silenceLevel)
   - At `endSec + releaseMs/1000`: reach silenceLevel (linear curve)
3. End with gain at `silenceLevel` at `totalDurationSec`
4. Merge overlapping envelope regions

### ffmpeg Audio Conversion Pattern

```typescript
import { execFile } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

// Convert to 16kHz mono WAV for VAD analysis
const args = ['-i', inputPath, '-ar', '16000', '-ac', '1', '-f', 'wav', outputPath];
await execFilePromise(ffmpegPath!, args);
```

### Previous Story Intelligence (6-19)

- Package structure created in Story 6-19 with all stubs
- ESM imports require `.js` extension: `import { x } from './types.js'`
- NexusError import: `import { NexusError } from '@nexus-ai/core'`
- Test location: `src/__tests__/` directory
- Existing tests: `types.test.ts` and `stubs.test.ts` - do NOT break these
- Code review feedback from 6-19: use `: never` return type for stubs, remove unused imports, clean test assertions

### Git Intelligence

Recent commits follow: `feat(audio-mixer): {description} (Story 6-{num})`
For this story: `feat(audio-mixer): implement voice activity detection (Story 6-20)`

### Downstream Dependencies

This story provides the foundation for:
- **Story 6-24** (Audio Mix Pipeline): Uses `detectSpeechSegments` and `generateDuckingCurve` to mix voice+music
- **Story 6-25** (Quality Gate): Uses ducking curve data for validation

### File Impact

Files to modify:
1. `packages/audio-mixer/package.json` - Add VAD dependency (if needed)
2. `packages/audio-mixer/src/ducking.ts` - Replace stubs with real implementation
3. `packages/audio-mixer/src/index.ts` - Add DEFAULT_DUCKING_CONFIG export

Files to create:
4. `packages/audio-mixer/src/__tests__/ducking.test.ts` - Unit tests

Files for reference (read-only):
- `packages/audio-mixer/src/types.ts` - Type definitions (SpeechSegment, GainPoint, DuckingConfig)
- `packages/audio-mixer/src/__tests__/stubs.test.ts` - Existing stub tests (will need updating since stubs are replaced)
- `packages/tts/src/synthesis.ts` - ffmpeg usage pattern reference

### Project Structure Notes

- Package at `packages/audio-mixer/` aligns with monorepo convention
- `ducking.ts` is the ONLY file that changes in this story - other stubs (music-selector, sfx, quality-gate) remain as-is
- The existing `stubs.test.ts` tests for ducking functions will need updating since they currently expect `NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED` throws

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Story 6.20]
- [Source: _bmad-output/project-context.md - Technology Stack, Critical Rules]
- [Source: packages/audio-mixer/src/types.ts - SpeechSegment, GainPoint, DuckingConfig types]
- [Source: packages/audio-mixer/src/ducking.ts - Current stubs to replace]
- [Source: _bmad-output/implementation-artifacts/6-19-create-audio-mixer-package.md - Previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Used ffmpeg `silencedetect` filter approach (option 4 from VAD Library Selection) as it requires no additional dependencies and `ffmpeg-static` is already present
- `detectSpeechSegments`: Converts input audio to 16kHz mono WAV, runs silencedetect filter, parses silence periods from stderr, inverts to speech segments, merges gaps < 200ms
- `generateDuckingCurve`: Pure function generating attack/release envelope gain points sorted by time with deduplication of overlapping regions
- `DEFAULT_DUCKING_CONFIG` exported with specified defaults: speechLevel=-20, silenceLevel=-12, attackMs=50, releaseMs=300
- Updated `stubs.test.ts` to remove ducking stub tests (no longer stubs)
- All 33 audio-mixer tests pass (types: 10, stubs: 7, ducking: 16)
- Full monorepo build passes (17/17 packages)
- 66 pre-existing test failures in other packages (youtube, core, visual-gen, orchestrator) - unrelated to this story

### Change Log

- 2026-01-28: Implemented detectSpeechSegments and generateDuckingCurve, added DEFAULT_DUCKING_CONFIG, created ducking.test.ts with 16 tests, updated stubs.test.ts and index.ts
- 2026-01-28: Code review fixes - Fixed 3 HIGH issues: trailing silence handling in parseSilenceDetectOutput, getAudioDuration error handling (throw instead of silent zero), duration fractional parsing precision. Added 2 new tests (trailing silence edge case, duration parse error). Total: 35 tests passing.

### File List

- `packages/audio-mixer/src/ducking.ts` (modified) - Replaced stubs with full detectSpeechSegments and generateDuckingCurve implementations; code review fixes applied
- `packages/audio-mixer/src/index.ts` (modified) - Added DEFAULT_DUCKING_CONFIG export
- `packages/audio-mixer/src/__tests__/stubs.test.ts` (modified) - Removed ducking stub tests
- `packages/audio-mixer/src/__tests__/ducking.test.ts` (created) - 18 unit tests for ducking functions (2 added during code review)

### Senior Developer Review (AI)

**Reviewer:** Cryptology on 2026-01-28
**Outcome:** Approved with fixes applied

**Issues Found:** 3 HIGH, 3 MEDIUM, 2 LOW
**Issues Fixed:** 3 HIGH, 1 MEDIUM (test coverage)
**Issues Deferred:** 2 MEDIUM (acceptable fragile test coupling, non-issue edge case), 2 LOW (minor improvements)

**HIGH Issues Fixed:**
1. `parseSilenceDetectOutput` - Added handling for trailing `silence_start` without matching `silence_end` (audio ending in silence)
2. `getAudioDuration` - Changed from silent `return 0` to throwing `NexusError.retryable` when duration cannot be parsed
3. Duration fractional parsing - Changed from `parseInt(fractional) / 100` to `parseFloat('0.' + fractional)` for correct variable-precision handling

**Tests Added:**
- Trailing silence edge case test (silence_start without silence_end)
- Duration parse error test (unparseable ffmpeg output)
