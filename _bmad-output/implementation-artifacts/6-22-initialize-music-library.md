# Story 6.22: Initialize Music Library

Status: done

## Story

As a developer,
I want a seed music library with tracks per mood,
so that music selection has options from day one.

## Acceptance Criteria

1. **AC1: Library JSON Index** - Create `packages/audio-mixer/src/__fixtures__/music-library/library.json` containing a seed music library index with 12+ tracks (3+ per mood category: energetic, contemplative, urgent, neutral). Each track entry includes all `MusicTrack` fields: `id`, `mood`, `tempo`, `duration`, `gcsPath`, `license`, `loopable`, `loopPoints`, `energy`, `tags`.

2. **AC2: Test Audio Files** - Generate minimal valid WAV audio test fixtures (sine wave or silence) at `packages/audio-mixer/src/__fixtures__/music-library/{mood}/` for each track referenced in library.json. These are LOCAL test fixtures only (not uploaded to GCS). Each file must be a valid WAV file parseable by ffmpeg.

3. **AC3: Upload Script** - Create `scripts/upload-music-library.ts` that:
   - Reads library.json and all track files from `packages/audio-mixer/src/__fixtures__/music-library/`
   - Uploads each track to `gs://nexus-ai-assets/music/{mood}/{filename}`
   - Uploads library.json to `gs://nexus-ai-assets/music/library.json`
   - Uses `@google-cloud/storage` SDK
   - Reports progress and final summary
   - Handles errors with clear messages (missing files, auth failures)
   - Is executable via `npx tsx scripts/upload-music-library.ts`

4. **AC4: Library Validation Tests** - Create `packages/audio-mixer/src/__tests__/music-library.test.ts` that:
   - Validates library.json schema (all required fields present, correct types)
   - Validates each track has corresponding WAV file in fixtures
   - Validates all 4 mood categories have 3+ tracks
   - Validates all `gcsPath` values match expected `gs://nexus-ai-assets/music/{mood}/{filename}` pattern
   - Validates `loopable` tracks have `loopPoints` with valid start/end values
   - Validates `energy` is between 0 and 1
   - Validates `tempo` is reasonable (60-200 BPM)
   - Validates `duration` is positive and matches actual WAV file duration (within 0.1s tolerance)
   - All tests pass via `pnpm test`

5. **AC5: Integration with loadMusicLibrary** - Add a unit test to `packages/audio-mixer/src/__tests__/music-library.test.ts` that loads the fixture library.json and passes it to `selectMusic()` for each mood, verifying at least one track is returned per mood category.

6. **AC6: Build Passes** - `pnpm build` succeeds with no TypeScript errors.

## Tasks / Subtasks

- [x] Task 1: Create library.json seed data (AC: 1)
  - [x] 1.1: Create directory `packages/audio-mixer/src/__fixtures__/music-library/`
  - [x] 1.2: Create `library.json` with 12 tracks (3 per mood: energetic, contemplative, urgent, neutral)
  - [x] 1.3: Each track must have: id, mood, tempo, duration, gcsPath, license, loopable, loopPoints (if loopable), energy, tags
  - [x] 1.4: Use realistic metadata (varied tempos, energy 0-1, relevant tags)

- [x] Task 2: Generate test WAV fixtures (AC: 2)
  - [x] 2.1: Create mood subdirectories: `energetic/`, `contemplative/`, `urgent/`, `neutral/`
  - [x] 2.2: Generate minimal valid WAV files using a Node.js script
  - [x] 2.3: Each WAV file is a 2-second 440Hz sine wave at 44100Hz 16-bit mono
  - [x] 2.4: File names match `library.json` references

- [x] Task 3: Create upload script (AC: 3)
  - [x] 3.1: Create `scripts/upload-music-library.ts`
  - [x] 3.2: Implement GCS upload using `@google-cloud/storage`
  - [x] 3.3: Read library.json, iterate tracks, upload each to GCS path
  - [x] 3.4: Upload library.json itself to `gs://nexus-ai-assets/music/library.json`
  - [x] 3.5: Add progress logging and error handling
  - [x] 3.6: Add `@google-cloud/storage` as a devDependency in root package.json

- [x] Task 4: Write validation tests (AC: 4, 5)
  - [x] 4.1: Create `packages/audio-mixer/src/__tests__/music-library.test.ts`
  - [x] 4.2: Test library.json schema completeness (all MusicTrack fields)
  - [x] 4.3: Test fixture file existence for each track
  - [x] 4.4: Test 3+ tracks per mood category
  - [x] 4.5: Test gcsPath pattern matches `gs://nexus-ai-assets/music/{mood}/{filename}`
  - [x] 4.6: Test loopable tracks have valid loopPoints
  - [x] 4.7: Test energy range 0-1, tempo range 60-200, duration > 0
  - [x] 4.8: Test WAV file validity (parse WAV header, validate structure)
  - [x] 4.9: Test integration: load library.json, call `selectMusic()` for each mood, verify non-null result

- [x] Task 5: Build and test verification (AC: 6)
  - [x] 5.1: Run `pnpm build` - passes (17/17 tasks)
  - [x] 5.2: Run `pnpm test` - 115 music-library tests pass, 170 total audio-mixer tests pass

## Dev Notes

### Architecture Constraints

- **Monorepo**: Turborepo + pnpm workspaces. Package at `packages/audio-mixer/`
- **TypeScript strict mode**: All code must compile under strict
- **ESM only**: `"type": "module"` in package.json, use `.js` extensions in imports
- **NexusError**: Import from `@nexus-ai/core` for any error handling
- **No console.log in package code**: Use structured logger from `@nexus-ai/core` if needed. The upload script (in `scripts/`) may use console.log since it's a CLI tool.
- **Node 20 LTS**: Native `fetch()`, `fs/promises`, etc. available

### Existing Types (DO NOT RECREATE)

All types are defined in `packages/audio-mixer/src/types.ts`:
- `MoodType = 'energetic' | 'contemplative' | 'urgent' | 'neutral'`
- `MusicTrack { id, mood, tempo, duration, gcsPath, license, loopable, loopPoints?, energy, tags }`
- `MusicLibrary { tracks: MusicTrack[] }`
- `MusicSelectionCriteria { mood, minDurationSec, excludeTrackIds?, targetEnergy?, tags? }`
- `LicenseInfo { type, attribution, restrictions }`

Import from `./types.js` (ESM extension) within the package or from `@nexus-ai/audio-mixer` externally.

### Existing Functions to Use (DO NOT REIMPLEMENT)

From `packages/audio-mixer/src/music-selector.ts`:
- `loadMusicLibrary(gcsUrl?)` - loads from GCS URL and caches
- `selectMusic(criteria, library)` - filters and scores tracks
- `prepareLoopedTrack(track, targetDurationSec)` - creates looped audio
- `clearMusicLibraryCache()` - clears in-memory cache (for testing)

For integration tests, import `selectMusic` directly and pass the fixture library data.

### Library.json Structure

Each track in the `tracks` array must conform to `MusicTrack` interface:
```json
{
  "id": "energetic-001",
  "mood": "energetic",
  "tempo": 128,
  "duration": 120,
  "gcsPath": "gs://nexus-ai-assets/music/energetic/upbeat-tech.wav",
  "license": {
    "type": "CC0",
    "attribution": "Artist Name",
    "restrictions": []
  },
  "loopable": true,
  "loopPoints": { "startSec": 0.5, "endSec": 119.5 },
  "energy": 0.8,
  "tags": ["electronic", "tech", "upbeat"]
}
```

### WAV File Generation

Test fixtures need to be valid WAV files but don't need to be real music. Use a simple approach:
- Generate WAV headers + sine wave data programmatically in the test setup or as a build step
- Recommended: Create a small helper function `generateTestWav(durationSec, sampleRate)` that returns a Buffer of a valid WAV file
- Alternative: Use ffmpeg to generate: `ffmpeg -f lavfi -i "sine=frequency=440:duration=2" -ar 44100 output.wav`
- Keep files small (1-5 seconds each) to avoid bloating the repo

**IMPORTANT**: The fixture WAV files should be committed to git. They are test fixtures, not production assets. Production tracks will be real music uploaded via the upload script.

### Upload Script Pattern

Follow existing script pattern from `scripts/seed-pronunciation.ts`:
```typescript
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const bucket = storage.bucket('nexus-ai-assets');

async function uploadFile(localPath: string, gcsPath: string) {
  await bucket.upload(localPath, { destination: gcsPath });
  console.log(`Uploaded: ${gcsPath}`);
}
```

The script is a standalone CLI tool. It's OK to use console.log here since it's not package code.

### Test Patterns

Follow existing test patterns from `packages/audio-mixer/src/__tests__/music-selector.test.ts`:
- Use `describe/it` blocks with Vitest
- Import directly from source files (`../music-selector.js`)
- Use `vi.mock()` for external dependencies
- Use `beforeEach/afterEach` for setup/teardown

For fixture loading in tests:
```typescript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', '__fixtures__', 'music-library');
const library = JSON.parse(readFileSync(join(fixturesDir, 'library.json'), 'utf-8'));
```

### Previous Story Intelligence (6-21)

- Story 6-21 implemented `loadMusicLibrary`, `selectMusic`, `prepareLoopedTrack` in `music-selector.ts`
- `loadMusicLibrary` fetches from GCS URL, caches in memory
- `selectMusic` filters by mood (exact match), duration, exclusions, then scores by duration fit, energy match, tag overlap
- All functions are fully implemented and tested (21 unit tests in `music-selector.test.ts`)
- This story creates the ACTUAL DATA that those functions consume
- Integration test should verify `selectMusic` works with the real library.json structure

### Git Intelligence

Recent commits follow: `feat(audio-mixer): {description} (Story 6-{num})`
For this story: `feat(audio-mixer): initialize music library (Story 6-22)`

### Downstream Dependencies

This story provides:
- **Story 6-24** (Audio Mix Pipeline): Uses the music library for actual track selection in the pipeline
- The library.json index must match the `MusicTrack` interface exactly so `loadMusicLibrary()` can parse it

### File Impact

Files to create:
1. `packages/audio-mixer/src/__fixtures__/music-library/library.json` - Library index
2. `packages/audio-mixer/src/__fixtures__/music-library/energetic/*.wav` - 3 test WAV files
3. `packages/audio-mixer/src/__fixtures__/music-library/contemplative/*.wav` - 3 test WAV files
4. `packages/audio-mixer/src/__fixtures__/music-library/urgent/*.wav` - 3 test WAV files
5. `packages/audio-mixer/src/__fixtures__/music-library/neutral/*.wav` - 3 test WAV files
6. `scripts/upload-music-library.ts` - GCS upload script
7. `packages/audio-mixer/src/__tests__/music-library.test.ts` - Validation tests

Files for reference (read-only):
- `packages/audio-mixer/src/types.ts` - MusicTrack interface definition
- `packages/audio-mixer/src/music-selector.ts` - Functions that consume this library
- `packages/audio-mixer/src/__tests__/music-selector.test.ts` - Test patterns
- `scripts/seed-pronunciation.ts` - Upload script pattern reference

### Project Structure Notes

- Test fixtures go in `src/__fixtures__/` which is the conventional location for test data
- WAV files in fixtures are small test files, not production music
- The upload script is a one-time operational tool in `scripts/`
- No changes to existing source code files - this story is purely additive (new files only)

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Story 6.22]
- [Source: _bmad-output/project-context.md - Technology Stack, Critical Rules]
- [Source: packages/audio-mixer/src/types.ts - MusicTrack, MusicLibrary, MoodType types]
- [Source: packages/audio-mixer/src/music-selector.ts - Functions consuming library data]
- [Source: _bmad-output/implementation-artifacts/6-21-implement-music-selection.md - Previous story]
- [Source: scripts/seed-pronunciation.ts - Upload script pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None required.

### Completion Notes List

- Created library.json with 12 seed tracks (3 per mood: energetic, contemplative, urgent, neutral)
- Each track has all MusicTrack fields: id, mood, tempo, duration, gcsPath, license, loopable, loopPoints, energy, tags
- Fixture WAV files are 2-second 440Hz sine waves at 44100Hz 16-bit mono (~176KB each) to keep repo size manageable while matching library.json durations exactly
- Upload script follows seed-pronunciation.ts pattern, uses @google-cloud/storage SDK
- Added @google-cloud/storage as root devDependency for the upload script
- 115 validation tests cover: schema, mood coverage, GCS paths, loop points, value ranges, WAV file validity, duration matching, and selectMusic integration
- All 170 audio-mixer tests pass with no regressions
- Build passes (17/17 turbo tasks)
- Pre-existing test failures in firestore-client.test.ts are NOT from this story

### Change Log

- 2026-01-28: Story 6-22 implemented - initialized music library with seed data, fixtures, upload script, and validation tests
- 2026-01-28: Code review (AI) - Fixed 4 MEDIUM issues: removed unused import, replaced local types with package imports, added track ID uniqueness test, added non-loopable loopPoints absence test

### File List

New files:
- `packages/audio-mixer/src/__fixtures__/music-library/library.json`
- `packages/audio-mixer/src/__fixtures__/music-library/energetic/upbeat-tech.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/energetic/driving-pulse.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/energetic/neon-rush.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/contemplative/soft-reflection.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/contemplative/deep-thought.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/contemplative/quiet-dawn.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/urgent/breaking-alert.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/urgent/critical-update.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/urgent/rapid-fire.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/neutral/steady-flow.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/neutral/clean-slate.wav`
- `packages/audio-mixer/src/__fixtures__/music-library/neutral/balanced-beat.wav`
- `scripts/upload-music-library.ts`
- `packages/audio-mixer/src/__tests__/music-library.test.ts`

Modified files:
- `package.json` (added @google-cloud/storage devDependency)
