# Story 6.19: Create Audio Mixer Package

Status: done

## Story

As a developer,
I want an audio-mixer package structure,
so that professional audio mixing can be applied to videos.

## Acceptance Criteria

1. **AC1: Package Structure** - `packages/audio-mixer/` directory exists with:
   - `package.json` with `@nexus-ai/audio-mixer` name
   - `tsconfig.json` extending base config
   - `vitest.config.ts` matching project pattern
   - `src/index.ts` exporting public API
   - `src/types.ts` with all input/output types
   - `src/ducking.ts` (stub) for VAD and gain curves
   - `src/music-selector.ts` (stub) for mood-based selection
   - `src/sfx.ts` (stub) for sound effect triggers
   - `src/quality-gate.ts` (stub) for audio validation
   - `src/__tests__/` directory for unit tests

2. **AC2: Type Definitions** - `src/types.ts` exports typed interfaces:
   - `AudioMixerInput`: voiceTrackUrl (string), directionDocument (DirectionDocument), targetDurationSec (number)
   - `AudioMixerOutput`: mixedAudioUrl (string), originalAudioUrl (string), duckingApplied (boolean), metrics (AudioMixerMetrics)
   - `AudioMixerMetrics`: voicePeakDb (number), musicPeakDb (number), mixedPeakDb (number), duckingSegments (number), sfxTriggered (number), durationSec (number)
   - `MusicTrack`: id (string), mood (MoodType), tempo (number), duration (number), gcsPath (string), license (LicenseInfo)
   - `SFXTrigger`: segmentId (string), frame (number), soundId (string), volume (number)
   - `MoodType`: 'energetic' | 'contemplative' | 'urgent' | 'neutral'
   - `DuckingConfig`: speechLevel (number), silenceLevel (number), attackMs (number), releaseMs (number)
   - `LicenseInfo`: type (string), attribution (string), restrictions (string[])
   - `SpeechSegment`: startSec (number), endSec (number)
   - `GainPoint`: timeSec (number), gainDb (number)

3. **AC3: Package Dependencies** - package.json includes:
   - `@nexus-ai/core` (workspace:*)
   - `@nexus-ai/script-gen` (workspace:*) for DirectionDocument type
   - `ffmpeg-static` for audio processing
   - Dev dependencies follow project pattern (@nexus-ai/config, typescript, vitest)

4. **AC4: Stub Implementations** - All source files export stub functions that throw `NexusError` with `NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED` code

5. **AC5: Index Exports** - `src/index.ts` re-exports all types and stubs

6. **AC6: Tests** - `src/__tests__/types.test.ts` validates type definitions compile correctly, and stub functions throw expected errors

## Tasks / Subtasks

- [x] Task 1: Create package directory and configuration (AC: 1, 3)
  - [x] 1.1: Create `packages/audio-mixer/` directory
  - [x] 1.2: Create `package.json` following @nexus-ai/tts pattern with name `@nexus-ai/audio-mixer`, dependencies: `@nexus-ai/core` (workspace:*), `@nexus-ai/script-gen` (workspace:*), `ffmpeg-static`
  - [x] 1.3: Create `tsconfig.json` extending `@nexus-ai/config/tsconfig.base.json` (match tts/timestamp-extraction pattern)
  - [x] 1.4: Create `vitest.config.ts` matching project pattern

- [x] Task 2: Define types (AC: 2)
  - [x] 2.1: Create `src/types.ts` with all interfaces listed in AC2
  - [x] 2.2: Import DirectionDocument from `@nexus-ai/script-gen`
  - [x] 2.3: Export all types

- [x] Task 3: Create stub source files (AC: 4)
  - [x] 3.1: Create `src/ducking.ts` with stub `detectSpeechSegments()` and `generateDuckingCurve()` that throw NexusError
  - [x] 3.2: Create `src/music-selector.ts` with stub `loadMusicLibrary()`, `selectMusic()`, `prepareLoopedTrack()` that throw NexusError
  - [x] 3.3: Create `src/sfx.ts` with stub `loadSFXLibrary()`, `getSFX()`, `extractSFXTriggers()` that throw NexusError
  - [x] 3.4: Create `src/quality-gate.ts` with stub `validateAudioMix()` that throws NexusError

- [x] Task 4: Create index.ts barrel export (AC: 5)
  - [x] 4.1: Create `src/index.ts` re-exporting all types from types.ts and all stubs from each module

- [x] Task 5: Create tests (AC: 6)
  - [x] 5.1: Create `src/__tests__/types.test.ts` verifying type exports compile
  - [x] 5.2: Create `src/__tests__/stubs.test.ts` verifying each stub throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED
  - [x] 5.3: Run `pnpm build` and `pnpm test` - must pass

- [x] Task 6: Register package in monorepo (AC: 1)
  - [x] 6.1: Verify pnpm workspace discovers package automatically (pnpm-workspace.yaml should glob packages/*)
  - [x] 6.2: Run `pnpm install` to link workspace dependencies

## Dev Notes

### Architecture Constraints

- **Monorepo**: Turborepo + pnpm workspaces. New package at `packages/audio-mixer/`
- **TypeScript strict mode**: All code must compile under strict
- **ESM only**: `"type": "module"` in package.json, use `.js` extensions in imports for ESM compatibility
- **NexusError**: Import from `@nexus-ai/core` for error classes. Use `NexusError.retryable()` or `NexusError.critical()` static factories
- **No console.log**: Use structured logger from `@nexus-ai/core` if any logging needed
- **Error code format**: `NEXUS_AUDIO_MIXER_{TYPE}` (e.g., `NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED`)

### Package Pattern Reference

Follow the exact pattern from `packages/tts/` and `packages/timestamp-extraction/`:

**package.json structure:**
```json
{
  "name": "@nexus-ai/audio-mixer",
  "version": "0.1.0",
  "description": "Audio mixing stage for NEXUS-AI pipeline - voice, music ducking, and SFX",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint . --ext .ts",
    "test": "vitest",
    "test:run": "vitest run",
    "type-check": "tsc --noEmit"
  }
}
```

**tsconfig.json pattern:**
```json
{
  "extends": "@nexus-ai/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "src/**/__tests__/**"]
}
```

### Key Types from Dependencies

**DirectionDocument** (from `@nexus-ai/script-gen`):
```typescript
interface DirectionDocument {
  version: '2.0';
  metadata: DocumentMetadata;
  segments: DirectionSegment[];
  globalAudio: GlobalAudio;  // Contains defaultMood, sfxHints
}
```

**NexusError** (from `@nexus-ai/core`):
```typescript
class NexusError extends Error {
  code: string;
  severity: ErrorSeverity;
  stage?: string;
  retryable: boolean;
  static retryable(code, message, stage, context?);
  static critical(code, message, stage, context?);
}
```

### Stub Implementation Pattern

Each stub should follow this pattern:
```typescript
import { NexusError } from '@nexus-ai/core';

export function detectSpeechSegments(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'detectSpeechSegments not yet implemented',
    'audio-mixer'
  );
}
```

### Previous Story Intelligence (6-18)

- Stories 6-13 through 6-18 were all in `apps/video-studio/`
- Story 6-19 transitions to a NEW package in `packages/`
- Pattern from previous packages: all use workspace:* deps, tsc build, vitest tests
- Import extensions: use `.js` for ESM imports even in TypeScript (e.g., `import { x } from './types.js'`)
- Test location: `src/__tests__/` directory (not `__tests__/` at root)
- NexusError import: `import { NexusError } from '@nexus-ai/core';`

### Git Intelligence

Recent commits follow pattern: `feat({package}): {description} (Story {key})`
For this story: `feat(audio-mixer): create audio mixer package (Story 6-19)`

### File Impact

Files to create:
1. `packages/audio-mixer/package.json`
2. `packages/audio-mixer/tsconfig.json`
3. `packages/audio-mixer/vitest.config.ts`
4. `packages/audio-mixer/src/types.ts`
5. `packages/audio-mixer/src/ducking.ts`
6. `packages/audio-mixer/src/music-selector.ts`
7. `packages/audio-mixer/src/sfx.ts`
8. `packages/audio-mixer/src/quality-gate.ts`
9. `packages/audio-mixer/src/index.ts`
10. `packages/audio-mixer/src/__tests__/types.test.ts`
11. `packages/audio-mixer/src/__tests__/stubs.test.ts`

Files for reference (read-only):
- `packages/tts/package.json` - Package structure pattern
- `packages/tts/tsconfig.json` - TypeScript config pattern
- `packages/tts/src/index.ts` - Export pattern
- `packages/timestamp-extraction/package.json` - Alternative reference
- `packages/script-gen/src/types.ts` - DirectionDocument types
- `packages/core/src/` - NexusError, CostTracker exports

### Project Structure Notes

- New package at `packages/audio-mixer/` aligns with monorepo convention
- pnpm-workspace.yaml should auto-discover via `packages/*` glob
- Package will be consumed by `packages/visual-gen` in Story 6-26 (future)
- No existing audio-mixer code exists - this is a greenfield package

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Stories 6.19-6.26]
- [Source: _bmad-output/project-context.md - Technology Stack, Critical Rules, Stage Execution Template]
- [Source: packages/tts/package.json - Package structure pattern]
- [Source: packages/timestamp-extraction/package.json - Package structure pattern]
- [Source: packages/tts/src/index.ts - Export pattern]
- [Source: _bmad-output/implementation-artifacts/6-18-update-techexplainer-motion-timing.md - Previous story]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Debug Log References
N/A

### Completion Notes List
- Created `@nexus-ai/audio-mixer` package following tts/timestamp-extraction patterns
- All 10 type interfaces defined in `src/types.ts` matching AC2 spec exactly
- `DirectionDocument` imported from `@nexus-ai/script-gen` as type-only import
- 4 stub modules created (ducking, music-selector, sfx, quality-gate) - all throw `NexusError.critical` with `NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED`
- Barrel export in `src/index.ts` re-exports all types and stubs
- 19 tests passing: 10 type compilation tests + 9 stub behavior tests
- Build passes clean (17/17 turborepo tasks), no regressions introduced
- Pre-existing test failures in orchestrator/core packages are unrelated to this change
- [Code Review] Fixed stub return types from concrete types to `: never` per documented pattern
- [Code Review] Removed unused type imports from stub modules (ducking.ts, sfx.ts, music-selector.ts)
- [Code Review] Cleaned up test dual-assertion pattern in stubs.test.ts
- [Code Review] Added `pnpm-lock.yaml` to File List

### File List
- `packages/audio-mixer/package.json` (new)
- `packages/audio-mixer/tsconfig.json` (new)
- `packages/audio-mixer/vitest.config.ts` (new)
- `packages/audio-mixer/src/types.ts` (new)
- `packages/audio-mixer/src/ducking.ts` (new)
- `packages/audio-mixer/src/music-selector.ts` (new)
- `packages/audio-mixer/src/sfx.ts` (new)
- `packages/audio-mixer/src/quality-gate.ts` (new)
- `packages/audio-mixer/src/index.ts` (new)
- `packages/audio-mixer/src/__tests__/types.test.ts` (new)
- `packages/audio-mixer/src/__tests__/stubs.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/6-19-create-audio-mixer-package.md` (modified)
- `pnpm-lock.yaml` (modified)
