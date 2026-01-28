# Story 6.21: Implement Music Selection

Status: done

## Story

As a developer,
I want mood-based music track selection,
so that background music matches video tone.

## Acceptance Criteria

1. **AC1: loadMusicLibrary Function** - `packages/audio-mixer/src/music-selector.ts` exports `loadMusicLibrary(gcsUrl?: string): Promise<MusicLibrary>` that:
   - Loads library index from `gs://nexus-ai-assets/music/library.json` (or provided URL)
   - Caches library in memory (module-level cache, returns cached on subsequent calls)
   - Returns `MusicLibrary` object with `tracks: MusicTrack[]` array
   - Throws `NexusError.retryable('NEXUS_AUDIO_MIXER_LIBRARY_LOAD_FAILED', ...)` on fetch errors

2. **AC2: selectMusic Function** - `packages/audio-mixer/src/music-selector.ts` exports `selectMusic(criteria: MusicSelectionCriteria, library: MusicLibrary): MusicTrack | null` that:
   - Filters by `mood` (required exact match)
   - Filters by `minDurationSec` (track duration >= target OR track is loopable)
   - Excludes recently used tracks via `excludeTrackIds` array (for variety)
   - Scores remaining candidates by: duration fit (closer to target = higher), energy match, tag overlap
   - Returns highest-scored track or `null` if no candidates match

3. **AC3: prepareLoopedTrack Function** - `packages/audio-mixer/src/music-selector.ts` exports `prepareLoopedTrack(track: MusicTrack, targetDurationSec: number): Promise<string>` that:
   - If track duration >= targetDurationSec, returns track's local path (no looping needed)
   - If track is shorter, creates seamless loop using track's `loopPoints` (start/end markers)
   - Uses `ffmpeg-static` to concatenate loop segments to reach target duration
   - Returns path to prepared (looped) audio file in temp directory
   - Cleans up intermediate files on error

4. **AC4: New Types** - Add to `packages/audio-mixer/src/types.ts`:
   - `MusicLibrary { tracks: MusicTrack[] }`
   - `MusicSelectionCriteria { mood: MoodType; minDurationSec: number; excludeTrackIds?: string[]; targetEnergy?: number; tags?: string[] }`
   - Extend `MusicTrack` with: `loopable: boolean; loopPoints?: { startSec: number; endSec: number }; energy: number; tags: string[]`

5. **AC5: Unit Tests** - `packages/audio-mixer/src/__tests__/music-selector.test.ts` with:
   - `loadMusicLibrary`: mocked fetch, caching behavior, error handling
   - `selectMusic`: mood filtering, duration filtering, exclusion, scoring, null result
   - `prepareLoopedTrack`: no-loop path, loop with ffmpeg (mocked), error cleanup
   - All tests pass via `pnpm test`

6. **AC6: Build Passes** - `pnpm build` succeeds with no TypeScript errors

## Tasks / Subtasks

- [x] Task 1: Extend types (AC: 4)
  - [x] 1.1: Add `MusicLibrary` interface to `packages/audio-mixer/src/types.ts`
  - [x] 1.2: Add `MusicSelectionCriteria` interface to `packages/audio-mixer/src/types.ts`
  - [x] 1.3: Extend `MusicTrack` with `loopable`, `loopPoints`, `energy`, `tags` fields

- [x] Task 2: Implement loadMusicLibrary (AC: 1)
  - [x] 2.1: Replace stub in `packages/audio-mixer/src/music-selector.ts` with real implementation
  - [x] 2.2: Implement GCS fetch using native `fetch()` (Node 20 built-in)
  - [x] 2.3: Add module-level cache variable, return cached on subsequent calls
  - [x] 2.4: Add `clearMusicLibraryCache()` export for testing

- [x] Task 3: Implement selectMusic (AC: 2)
  - [x] 3.1: Replace stub with typed implementation
  - [x] 3.2: Implement mood filter (exact match, required)
  - [x] 3.3: Implement duration filter (track.duration >= minDurationSec OR track.loopable)
  - [x] 3.4: Implement exclusion filter (excludeTrackIds)
  - [x] 3.5: Implement scoring: duration fit (1 - |trackDuration - minDuration| / minDuration, clamped 0-1), energy match (1 - |trackEnergy - targetEnergy|), tag overlap count
  - [x] 3.6: Return highest-scored track or null

- [x] Task 4: Implement prepareLoopedTrack (AC: 3)
  - [x] 4.1: Replace stub with typed implementation
  - [x] 4.2: If track.duration >= targetDurationSec, return track path directly (download from GCS if needed)
  - [x] 4.3: If shorter, calculate loop count needed, use ffmpeg concat to loop
  - [x] 4.4: Use track.loopPoints for clean loop boundaries (trim to loopPoints range, then concat)
  - [x] 4.5: Write looped result to temp file, return path
  - [x] 4.6: Add error handling with temp file cleanup

- [x] Task 5: Update exports (AC: 1, 2, 3, 4)
  - [x] 5.1: Export new types from `src/types.ts` and `src/index.ts`
  - [x] 5.2: Export `clearMusicLibraryCache` from `src/index.ts`
  - [x] 5.3: Update `src/index.ts` comment from "Music selector stubs" to "Music selector"

- [x] Task 6: Update stubs.test.ts (AC: 5)
  - [x] 6.1: Remove music-selector stub tests from `stubs.test.ts` (functions are no longer stubs)

- [x] Task 7: Write unit tests (AC: 5)
  - [x] 7.1: Create `packages/audio-mixer/src/__tests__/music-selector.test.ts`
  - [x] 7.2: Test `loadMusicLibrary`: mock global `fetch`, verify caching (second call returns cached), error throws NexusError
  - [x] 7.3: Test `selectMusic`: mood filter excludes non-matching, duration filter works, exclusion works, scoring returns best match, returns null when no match
  - [x] 7.4: Test `prepareLoopedTrack`: returns path for long-enough track, calls ffmpeg for short track, handles loopPoints, cleanup on error

- [x] Task 8: Build and test verification (AC: 6)
  - [x] 8.1: Run `pnpm build` - must pass
  - [x] 8.2: Run `pnpm test` - must pass (audio-mixer: 53/53 pass; pre-existing failures in core/orchestrator unrelated)

## Dev Notes

### Architecture Constraints

- **Monorepo**: Turborepo + pnpm workspaces. Package at `packages/audio-mixer/`
- **TypeScript strict mode**: All code must compile under strict
- **ESM only**: `"type": "module"` in package.json, use `.js` extensions in imports
- **NexusError**: Import from `@nexus-ai/core`. Use `NexusError.retryable()` for transient fetch failures, `NexusError.critical()` for unrecoverable
- **No console.log**: Use structured logger from `@nexus-ai/core` if logging needed
- **Error code format**: `NEXUS_AUDIO_MIXER_{TYPE}` (e.g., `NEXUS_AUDIO_MIXER_LIBRARY_LOAD_FAILED`)
- **Node 20 LTS**: `fetch()` is globally available, no need for `node-fetch`

### Existing Code to Modify

**`packages/audio-mixer/src/types.ts`** - Add `MusicLibrary`, `MusicSelectionCriteria` interfaces. Extend `MusicTrack` with `loopable`, `loopPoints`, `energy`, `tags` fields.

**`packages/audio-mixer/src/music-selector.ts`** - Currently contains 3 stubs that throw `NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED`. Replace ALL stubs with real implementations. Function signatures must change from `(): never` to proper typed signatures.

**`packages/audio-mixer/src/index.ts`** - Add exports for new types and `clearMusicLibraryCache`. Update comment.

**`packages/audio-mixer/src/__tests__/stubs.test.ts`** - Remove the 3 music-selector stub tests (lines 19-31) since functions are no longer stubs.

### Existing Types (DO NOT RECREATE - extend only)

All existing types are in `packages/audio-mixer/src/types.ts`:
- `MoodType = 'energetic' | 'contemplative' | 'urgent' | 'neutral'` - USE AS-IS
- `MusicTrack { id, mood, tempo, duration, gcsPath, license }` - EXTEND with `loopable`, `loopPoints`, `energy`, `tags`
- `LicenseInfo { type, attribution, restrictions }` - USE AS-IS

Import from `./types.js` (ESM extension).

### GCS Fetch Pattern

The library.json is a public GCS object. Use native `fetch()`:
```typescript
const response = await fetch(gcsUrl);
if (!response.ok) {
  throw NexusError.retryable(
    'NEXUS_AUDIO_MIXER_LIBRARY_LOAD_FAILED',
    `Failed to load music library: ${response.status}`,
    'audio-mixer'
  );
}
const data = await response.json();
```

### ffmpeg Loop Pattern (for prepareLoopedTrack)

Use `ffmpeg-static` (already a dependency) with concat filter:
```typescript
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Trim to loop points then concat N times
const args = [
  '-stream_loop', String(loopCount - 1),
  '-i', inputPath,
  '-ss', String(loopStart),
  '-t', String(targetDurationSec),
  '-c', 'copy',
  outputPath
];
await execFileAsync(ffmpegPath!, args);
```

### Scoring Algorithm for selectMusic

Pure function, no external dependencies:
1. Filter: mood must match exactly (required)
2. Filter: duration >= minDurationSec OR loopable === true
3. Filter: exclude tracks in excludeTrackIds
4. Score each remaining candidate (0-3 scale):
   - Duration fit: `1 - Math.min(1, Math.abs(track.duration - minDurationSec) / minDurationSec)` (closer = better)
   - Energy match: `targetEnergy ? 1 - Math.abs(track.energy - targetEnergy) : 0.5` (default mid-score if no target)
   - Tag overlap: `criteria.tags ? matchingTags / criteria.tags.length : 0.5` (default mid-score if no tags)
5. Return track with highest total score, or null if empty

### Previous Story Intelligence (6-20)

- Used ffmpeg `silencedetect` approach for VAD - same `ffmpeg-static` pattern applies here for looping
- ESM imports require `.js` extension: `import { x } from './types.js'`
- `NexusError` import: `import { NexusError } from '@nexus-ai/core'`
- Test location: `src/__tests__/` directory
- When replacing stubs, update `stubs.test.ts` to remove the replaced stub tests
- Code review from 6-20: pay attention to error handling edge cases, use proper error types (retryable vs critical)
- ffmpeg execution pattern: use `promisify(execFile)` from `child_process`, import `ffmpegPath from 'ffmpeg-static'`

### Git Intelligence

Recent commits follow: `feat(audio-mixer): {description} (Story 6-{num})`
For this story: `feat(audio-mixer): implement music selection (Story 6-21)`

### Downstream Dependencies

This story provides the foundation for:
- **Story 6-22** (Initialize Music Library): Creates actual track files and `library.json` that `loadMusicLibrary()` reads
- **Story 6-24** (Audio Mix Pipeline): Uses `selectMusic()` and `prepareLoopedTrack()` to add music to final mix

### File Impact

Files to modify:
1. `packages/audio-mixer/src/types.ts` - Add MusicLibrary, MusicSelectionCriteria; extend MusicTrack
2. `packages/audio-mixer/src/music-selector.ts` - Replace all 3 stubs with real implementations
3. `packages/audio-mixer/src/index.ts` - Add new type exports and clearMusicLibraryCache
4. `packages/audio-mixer/src/__tests__/stubs.test.ts` - Remove music-selector stub tests

Files to create:
5. `packages/audio-mixer/src/__tests__/music-selector.test.ts` - Unit tests

Files for reference (read-only):
- `packages/audio-mixer/src/ducking.ts` - ffmpeg usage pattern reference
- `packages/audio-mixer/src/__tests__/ducking.test.ts` - Test mocking patterns for ffmpeg
- `packages/audio-mixer/src/types.ts` - Existing type definitions

### Project Structure Notes

- Package at `packages/audio-mixer/` aligns with monorepo convention
- `music-selector.ts` is the ONLY implementation file that changes - other stubs (sfx, quality-gate) remain as-is
- `types.ts` gets extended (additive only - no breaking changes to existing interfaces)
- The existing `stubs.test.ts` music-selector tests must be removed since they expect `NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED` throws

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Story 6.21]
- [Source: _bmad-output/project-context.md - Technology Stack, Critical Rules]
- [Source: packages/audio-mixer/src/types.ts - MusicTrack, MoodType, LicenseInfo types]
- [Source: packages/audio-mixer/src/music-selector.ts - Current stubs to replace]
- [Source: _bmad-output/implementation-artifacts/6-20-implement-voice-activity-detection.md - Previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build: `pnpm build` - 17/17 tasks successful, 0 errors
- Tests: `pnpm test:run` (audio-mixer) - 53/53 tests pass across 4 test files
- Full suite: 66 pre-existing failures in core/orchestrator packages (unrelated to this story)

### Completion Notes List

- Extended `MusicTrack` interface with `loopable`, `loopPoints`, `energy`, `tags` fields (additive, no breaking changes)
- Added `MusicLibrary` and `MusicSelectionCriteria` interfaces to types.ts
- Replaced all 3 stub functions in music-selector.ts with full implementations:
  - `loadMusicLibrary`: GCS fetch with module-level caching and NexusError on failure
  - `selectMusic`: mood/duration/exclusion filtering with 3-component scoring (duration fit, energy match, tag overlap)
  - `prepareLoopedTrack`: ffmpeg stream_loop with loopPoints support and error cleanup
- Added `clearMusicLibraryCache` export for test isolation
- Removed 3 music-selector stub tests from stubs.test.ts
- Created 21 unit tests covering all ACs: fetch/caching/errors, filtering/scoring/null, loop/no-loop/cleanup
- Followed existing patterns from ducking.ts for ffmpeg usage and test mocking

### Change Log

- 2026-01-28: Implemented music selection (Story 6-21) - all 3 functions, types, exports, and 21 unit tests

### File List

- `packages/audio-mixer/src/types.ts` (modified) - Added MusicLibrary, MusicSelectionCriteria; extended MusicTrack
- `packages/audio-mixer/src/music-selector.ts` (modified) - Replaced 3 stubs with full implementations
- `packages/audio-mixer/src/index.ts` (modified) - Added MusicLibrary, MusicSelectionCriteria type exports; added clearMusicLibraryCache export; updated comment
- `packages/audio-mixer/src/__tests__/stubs.test.ts` (modified) - Removed 3 music-selector stub tests
- `packages/audio-mixer/src/__tests__/music-selector.test.ts` (created) - 21 unit tests for all music-selector functions
