# Story 6.23: Initialize SFX Library

Status: done

## Story

As a developer,
I want a sound effects library organized by category,
so that SFX triggers have audio assets available.

## Acceptance Criteria

1. **AC1: SFX Types** - Add SFX-specific types to `packages/audio-mixer/src/types.ts`:
   - `SfxCategory = 'transitions' | 'ui' | 'emphasis' | 'ambient'`
   - `SfxTrack { id, filename, category: SfxCategory, durationSec, gcsPath, tags }`
   - `SfxLibrary { tracks: SfxTrack[] }`
   These types must NOT conflict with existing `SFXTrigger` interface already in types.ts.

2. **AC2: Library JSON Index** - Create `packages/audio-mixer/src/__fixtures__/sfx-library/library.json` containing a seed SFX library index with 12+ tracks (3+ per category: transitions, ui, emphasis, ambient). Each track entry includes all `SfxTrack` fields.

3. **AC3: Test Audio Files** - Generate minimal valid WAV audio test fixtures at `packages/audio-mixer/src/__fixtures__/sfx-library/{category}/` for each track referenced in library.json. Each file must be a valid WAV file (short sine wave or silence, 0.5-2 seconds). These are LOCAL test fixtures only.

4. **AC4: Implement loadSFXLibrary** - Replace the stub in `packages/audio-mixer/src/sfx.ts` with a real implementation:
   - `loadSFXLibrary(gcsUrl?: string): Promise<SfxLibrary>` - fetches SFX library JSON from GCS (default: `gs://nexus-ai-assets/sfx/library.json`), parses it, caches in memory
   - Follow the same pattern as `loadMusicLibrary()` in `music-selector.ts`
   - Cache result in module-level variable; return cached on subsequent calls
   - Add `clearSFXLibraryCache()` for testing

5. **AC5: Implement getSFX** - Replace the stub in `packages/audio-mixer/src/sfx.ts`:
   - `getSFX(soundId: string, library: SfxLibrary): SfxTrack | undefined` - finds SFX track by id
   - Simple lookup by `id` field in library.tracks array

6. **AC6: Keep extractSFXTriggers as stub** - `extractSFXTriggers` remains a stub (implemented in Story 6-24).

7. **AC7: Upload Script** - Create `scripts/upload-sfx-library.ts` that:
   - Reads library.json and all SFX files from `packages/audio-mixer/src/__fixtures__/sfx-library/`
   - Uploads each SFX to `gs://nexus-ai-assets/sfx/{category}/{filename}`
   - Uploads library.json to `gs://nexus-ai-assets/sfx/library.json`
   - Uses `@google-cloud/storage` SDK (already a root devDependency)
   - Reports progress and final summary
   - Executable via `npx tsx scripts/upload-sfx-library.ts`

8. **AC8: Library Validation Tests** - Create `packages/audio-mixer/src/__tests__/sfx-library.test.ts` that:
   - Validates library.json schema (all required SfxTrack fields present, correct types)
   - Validates each track has corresponding WAV file in fixtures
   - Validates all 4 categories have 3+ tracks
   - Validates all `gcsPath` values match expected `gs://nexus-ai-assets/sfx/{category}/{filename}` pattern
   - Validates `durationSec` is positive and matches actual WAV file duration (within 0.1s tolerance)
   - Validates all track IDs are unique
   - Tests `loadSFXLibrary` function (with mocked fetch)
   - Tests `getSFX` function with the fixture library data
   - Tests `clearSFXLibraryCache` resets cache
   - All tests pass via `pnpm test`

9. **AC9: Export Updates** - Update `packages/audio-mixer/src/index.ts` to export:
   - New types: `SfxCategory`, `SfxTrack`, `SfxLibrary`
   - New function: `clearSFXLibraryCache`
   - Existing exports `loadSFXLibrary`, `getSFX`, `extractSFXTriggers` already present

10. **AC10: Build Passes** - `pnpm build` succeeds with no TypeScript errors.

## Tasks / Subtasks

- [x] Task 1: Add SFX types to types.ts (AC: 1)
  - [x] 1.1: Add `SfxCategory` type alias
  - [x] 1.2: Add `SfxTrack` interface with all fields
  - [x] 1.3: Add `SfxLibrary` interface

- [x] Task 2: Create library.json seed data (AC: 2)
  - [x] 2.1: Create directory `packages/audio-mixer/src/__fixtures__/sfx-library/`
  - [x] 2.2: Create `library.json` with 12+ tracks (3+ per category: transitions, ui, emphasis, ambient)
  - [x] 2.3: Each track has: id, filename, category, durationSec, gcsPath, tags

- [x] Task 3: Generate test WAV fixtures (AC: 3)
  - [x] 3.1: Create category subdirectories: `transitions/`, `ui/`, `emphasis/`, `ambient/`
  - [x] 3.2: Generate minimal valid WAV files (short sine waves, 0.5-2 seconds)
  - [x] 3.3: File names match `library.json` references

- [x] Task 4: Implement loadSFXLibrary and getSFX (AC: 4, 5, 6)
  - [x] 4.1: Replace `loadSFXLibrary` stub with real GCS-fetching implementation
  - [x] 4.2: Add module-level cache variable and `clearSFXLibraryCache()` function
  - [x] 4.3: Replace `getSFX` stub with real lookup implementation
  - [x] 4.4: Keep `extractSFXTriggers` as stub

- [x] Task 5: Update exports in index.ts (AC: 9)
  - [x] 5.1: Add `SfxCategory`, `SfxTrack`, `SfxLibrary` to type exports
  - [x] 5.2: Add `clearSFXLibraryCache` to function exports

- [x] Task 6: Create upload script (AC: 7)
  - [x] 6.1: Create `scripts/upload-sfx-library.ts`
  - [x] 6.2: Follow same pattern as `scripts/upload-music-library.ts`
  - [x] 6.3: Upload SFX files to `gs://nexus-ai-assets/sfx/{category}/{filename}`
  - [x] 6.4: Upload library.json to `gs://nexus-ai-assets/sfx/library.json`

- [x] Task 7: Write validation tests (AC: 8)
  - [x] 7.1: Create `packages/audio-mixer/src/__tests__/sfx-library.test.ts`
  - [x] 7.2: Test library.json schema completeness
  - [x] 7.3: Test fixture file existence for each track
  - [x] 7.4: Test 3+ tracks per category
  - [x] 7.5: Test gcsPath pattern matches `gs://nexus-ai-assets/sfx/{category}/{filename}`
  - [x] 7.6: Test durationSec positive and matches WAV file duration
  - [x] 7.7: Test all track IDs are unique
  - [x] 7.8: Test loadSFXLibrary with mocked fetch
  - [x] 7.9: Test getSFX lookup with fixture data
  - [x] 7.10: Test clearSFXLibraryCache

- [x] Task 8: Build and test verification (AC: 10)
  - [x] 8.1: Run `pnpm build` - must pass
  - [x] 8.2: Run `pnpm test` - all tests pass, no regressions

## Dev Notes

### Architecture Constraints

- **Monorepo**: Turborepo + pnpm workspaces. Package at `packages/audio-mixer/`
- **TypeScript strict mode**: All code must compile under strict
- **ESM only**: `"type": "module"` in package.json, use `.js` extensions in imports
- **NexusError**: Import from `@nexus-ai/core` for any error handling
- **No console.log in package code**: Use structured logger from `@nexus-ai/core` if needed. Upload script (in `scripts/`) may use console.log since it's a CLI tool.
- **Node 20 LTS**: Native `fetch()`, `fs/promises`, etc. available

### Existing Types (DO NOT RECREATE)

All existing types in `packages/audio-mixer/src/types.ts`:
- `MoodType`, `LicenseInfo`, `MusicTrack`, `MusicLibrary`, `MusicSelectionCriteria`
- `SFXTrigger { segmentId, frame, soundId, volume }` - already exists, references soundId that maps to SfxTrack.id
- `DuckingConfig`, `SpeechSegment`, `GainPoint`
- `AudioMixerMetrics`, `AudioMixerInput`, `AudioMixerOutput`

**NEW types to add** (in the same `types.ts` file):
- `SfxCategory = 'transitions' | 'ui' | 'emphasis' | 'ambient'`
- `SfxTrack { id: string; filename: string; category: SfxCategory; durationSec: number; gcsPath: string; tags: string[] }`
- `SfxLibrary { tracks: SfxTrack[] }`

### Existing Stubs to Replace

In `packages/audio-mixer/src/sfx.ts`, three stubs exist:
- `loadSFXLibrary()` - **REPLACE** with real GCS-fetching implementation
- `getSFX()` - **REPLACE** with real lookup implementation
- `extractSFXTriggers()` - **KEEP AS STUB** (implemented in Story 6-24)

The stubs currently throw `NexusError.critical('NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', ...)`.

### Implementation Pattern: loadSFXLibrary

Follow the exact same pattern as `loadMusicLibrary()` in `music-selector.ts`:

```typescript
import { NexusError } from '@nexus-ai/core';
import type { SfxLibrary, SfxTrack } from './types.js';

const DEFAULT_SFX_LIBRARY_URL = 'gs://nexus-ai-assets/sfx/library.json';
let sfxLibraryCache: SfxLibrary | null = null;

export async function loadSFXLibrary(gcsUrl?: string): Promise<SfxLibrary> {
  if (sfxLibraryCache) return sfxLibraryCache;
  const url = gcsUrl ?? DEFAULT_SFX_LIBRARY_URL;
  // Convert gs:// to https:// storage.googleapis.com URL
  const httpUrl = url.replace('gs://', 'https://storage.googleapis.com/');
  const response = await fetch(httpUrl);
  if (!response.ok) {
    throw NexusError.critical('NEXUS_SFX_LOAD_FAILED', `Failed to load SFX library: ${response.statusText}`, 'audio-mixer');
  }
  const data = await response.json() as SfxLibrary;
  sfxLibraryCache = data;
  return data;
}

export function getSFX(soundId: string, library: SfxLibrary): SfxTrack | undefined {
  return library.tracks.find(t => t.id === soundId);
}

export function clearSFXLibraryCache(): void {
  sfxLibraryCache = null;
}

// Keep as stub
export function extractSFXTriggers(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'extractSFXTriggers not yet implemented',
    'audio-mixer'
  );
}
```

### Implementation Pattern: Upload Script

Follow the exact same pattern as `scripts/upload-music-library.ts`:
- Use `@google-cloud/storage` (already a root devDependency)
- Read from `packages/audio-mixer/src/__fixtures__/sfx-library/`
- Upload to `gs://nexus-ai-assets/sfx/`
- Import types from `@nexus-ai/audio-mixer` (after adding SfxTrack/SfxLibrary types)

### Library.json Structure

Each track in the `tracks` array must conform to `SfxTrack` interface:
```json
{
  "id": "transition-whoosh-001",
  "filename": "whoosh-fast.wav",
  "category": "transitions",
  "durationSec": 0.8,
  "gcsPath": "gs://nexus-ai-assets/sfx/transitions/whoosh-fast.wav",
  "tags": ["whoosh", "fast", "scene-change"]
}
```

Categories and suggested SFX:
- **transitions**: whoosh, swoosh, slide (scene transitions)
- **ui**: click, beep, notification (UI interaction sounds)
- **emphasis**: pop, ding, reveal (highlight/emphasis moments)
- **ambient**: subtle-hum, soft-static, room-tone (background atmospherics)

### WAV File Generation

Follow the same approach as Story 6-22:
- Generate minimal valid WAV files programmatically (sine wave)
- SFX fixtures should be short: 0.5-2.0 seconds each
- 44100Hz, 16-bit, mono
- Each WAV duration MUST match the `durationSec` field in library.json exactly (to 0.1s tolerance)
- Commit WAV files to git (they are test fixtures)

### Test Patterns

Follow existing test patterns from `packages/audio-mixer/src/__tests__/music-library.test.ts`:
- Use `describe/it` blocks with Vitest
- Load fixtures using `readFileSync` + `fileURLToPath` for `__dirname`
- Parse WAV headers to validate files
- Mock `fetch` for `loadSFXLibrary` tests
- Import `getSFX`, `loadSFXLibrary`, `clearSFXLibraryCache` from source

### Stubs Test Update

The existing `stubs.test.ts` tests `loadSFXLibrary` and `getSFX` as throwing not-implemented errors. After replacing the stubs, those specific tests will fail and MUST be removed from `stubs.test.ts`. Keep the `extractSFXTriggers` stub test.

### Previous Story Intelligence (6-22)

- Story 6-22 created the music library with same pattern (library.json + WAV fixtures + upload script + validation tests)
- 115 validation tests for music library, all passing
- WAV files are 2-second sine waves at 44100Hz 16-bit mono
- `@google-cloud/storage` already added as root devDependency
- Upload script uses `import type { MusicTrack, MusicLibrary } from '@nexus-ai/audio-mixer'` pattern
- Music library fixtures at `packages/audio-mixer/src/__fixtures__/music-library/`

### Git Intelligence

Recent commits: `feat(audio-mixer): {description} (Story 6-{num})`
For this story: `feat(audio-mixer): initialize SFX library (Story 6-23)`

### Downstream Dependencies

This story provides:
- **Story 6-24** (Audio Mix Pipeline): Uses `getSFX()` to resolve SFX sound IDs from direction document triggers
- **Story 6-24**: Uses `extractSFXTriggers()` (will be implemented in 6-24, stays as stub here)
- The SFX library must be loadable by `loadSFXLibrary()` and tracks findable via `getSFX(soundId, library)`

### File Impact

Files to create:
1. `packages/audio-mixer/src/__fixtures__/sfx-library/library.json` - SFX library index
2. `packages/audio-mixer/src/__fixtures__/sfx-library/transitions/*.wav` - 3+ test WAV files
3. `packages/audio-mixer/src/__fixtures__/sfx-library/ui/*.wav` - 3+ test WAV files
4. `packages/audio-mixer/src/__fixtures__/sfx-library/emphasis/*.wav` - 3+ test WAV files
5. `packages/audio-mixer/src/__fixtures__/sfx-library/ambient/*.wav` - 3+ test WAV files
6. `scripts/upload-sfx-library.ts` - GCS upload script

Files to modify:
7. `packages/audio-mixer/src/types.ts` - Add SfxCategory, SfxTrack, SfxLibrary types
8. `packages/audio-mixer/src/sfx.ts` - Replace loadSFXLibrary and getSFX stubs with real implementations
9. `packages/audio-mixer/src/index.ts` - Add new type and function exports
10. `packages/audio-mixer/src/__tests__/stubs.test.ts` - Remove loadSFXLibrary and getSFX stub tests (keep extractSFXTriggers)

Files to create (tests):
11. `packages/audio-mixer/src/__tests__/sfx-library.test.ts` - Validation and unit tests

Files for reference (read-only):
- `packages/audio-mixer/src/types.ts` - Existing interfaces
- `packages/audio-mixer/src/music-selector.ts` - loadMusicLibrary pattern
- `packages/audio-mixer/src/__tests__/music-library.test.ts` - Test patterns
- `packages/audio-mixer/src/__fixtures__/music-library/library.json` - Library structure reference
- `scripts/upload-music-library.ts` - Upload script pattern reference

### Project Structure Notes

- SFX fixtures at `src/__fixtures__/sfx-library/` parallel to existing `src/__fixtures__/music-library/`
- WAV files in fixtures are small test files, not production SFX
- Upload script is a one-time operational tool in `scripts/`
- Story modifies existing files (types.ts, sfx.ts, index.ts, stubs.test.ts) and adds new files

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Story 6.23]
- [Source: _bmad-output/project-context.md - Technology Stack, Critical Rules]
- [Source: packages/audio-mixer/src/types.ts - SFXTrigger, existing types]
- [Source: packages/audio-mixer/src/sfx.ts - Current stub implementations]
- [Source: packages/audio-mixer/src/index.ts - Current exports]
- [Source: packages/audio-mixer/src/music-selector.ts - loadMusicLibrary pattern]
- [Source: _bmad-output/implementation-artifacts/6-22-initialize-music-library.md - Previous story]
- [Source: scripts/upload-music-library.ts - Upload script pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

- Added SfxCategory, SfxTrack, SfxLibrary types to types.ts (placed after SFXTrigger, before DuckingConfig)
- Created library.json with 12 tracks: 3 transitions, 3 ui, 3 emphasis, 3 ambient
- Generated 12 minimal WAV fixtures (44100Hz, 16-bit, mono sine waves, 0.5-2.0s durations)
- Replaced loadSFXLibrary stub with real GCS-fetching implementation following loadMusicLibrary pattern
- Added clearSFXLibraryCache() for testing
- Replaced getSFX stub with real lookup by id
- Kept extractSFXTriggers as stub (Story 6-24)
- Added SfxCategory, SfxTrack, SfxLibrary type exports and clearSFXLibraryCache function export to index.ts
- Created upload-sfx-library.ts following upload-music-library.ts pattern
- Created sfx-library.test.ts with 99 tests covering schema, categories, GCS paths, durations, fixtures, loadSFXLibrary, getSFX, clearSFXLibraryCache
- Removed loadSFXLibrary and getSFX stub tests from stubs.test.ts (kept extractSFXTriggers)
- Build passes, all 272 audio-mixer tests pass (99 new + 173 existing)

### Change Log

- 2026-01-28: Story 6-23 implementation complete - all tasks done, 99 new tests added
- 2026-01-28: Code review fixes applied: (1) Changed DEFAULT_SFX_LIBRARY_URL from gs:// to https:// format to match loadMusicLibrary pattern, removed gs:// conversion; (2) Updated error code prefix from NEXUS_SFX_LOAD_FAILED to NEXUS_AUDIO_MIXER_SFX_LOAD_FAILED for consistency; (3) Added test for default URL path; (4) Updated all test URLs to use https:// format. 100 tests total (was 99). All passing.

### File List

New files:
- packages/audio-mixer/src/__fixtures__/sfx-library/library.json
- packages/audio-mixer/src/__fixtures__/sfx-library/transitions/whoosh-fast.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/transitions/swoosh-smooth.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/transitions/slide-in.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/ui/click-soft.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/ui/beep-confirm.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/ui/notification-chime.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/emphasis/pop-bright.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/emphasis/ding-reveal.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/emphasis/reveal-shimmer.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/ambient/subtle-hum.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/ambient/soft-static.wav
- packages/audio-mixer/src/__fixtures__/sfx-library/ambient/room-tone.wav
- packages/audio-mixer/src/__tests__/sfx-library.test.ts
- scripts/upload-sfx-library.ts

Modified files:
- packages/audio-mixer/src/types.ts
- packages/audio-mixer/src/sfx.ts
- packages/audio-mixer/src/index.ts
- packages/audio-mixer/src/__tests__/stubs.test.ts
