# Story 6.12: Add Timestamp Extraction Tests

Status: done

## Story

As a developer,
I want comprehensive tests for timestamp extraction,
So that the stage is reliable and edge cases are handled.

## Acceptance Criteria

1. **Given** timestamp-extraction implementation
   **When** I create/extend tests in `packages/timestamp-extraction/src/__tests__/`
   **Then** unit tests cover:
   - STT response parsing (mock responses)
   - Word-to-segment mapping logic (including recovery paths)
   - Estimated timing calculation
   - Quality gate validation
   - Error handling and fallback triggers

2. **And** integration tests cover (can be skipped without GCP credentials):
   - Real STT API call with test audio (already exists as skipped test)
   - Accuracy validation against annotations
   - Processing time measurement

3. **And** test coverage > 80% for the package

4. **And** tests run in CI pipeline (`pnpm test` passes)

## Tasks / Subtasks

- [x] Task 1: Add `recognizeLongRunning()` tests to `stt-client.test.ts` (AC: 1, 3)
  - [x] 1.1: Test successful recognition with GCS URI input (mock Google Speech API)
  - [x] 1.2: Test successful recognition with inline Buffer input
  - [x] 1.3: Test `parseRecognitionResponse()` with valid multi-word response
  - [x] 1.4: Test `parseRecognitionResponse()` with empty results / missing alternatives
  - [x] 1.5: Test `parseGoogleDuration()` with string, number, Long type, and null input
  - [x] 1.6: Test timeout handling (120s timeout with Promise.race)
  - [x] 1.7: Test cost tracking integration (CostTracker called with correct values)
  - [x] 1.8: Test error propagation from Google API (network error, auth error)

- [x] Task 2: Add `downloadFromGCS()` and `downloadAndConvert()` tests to `audio-utils.test.ts` (AC: 1, 3)
  - [x] 2.1: Test `downloadFromGCS()` success path with mocked Storage client
  - [x] 2.2: Test `downloadFromGCS()` with missing file (error handling)
  - [x] 2.3: Test `downloadFromGCS()` with invalid GCS URL
  - [x] 2.4: Test `downloadAndConvert()` full pipeline (download + validate + convert)
  - [x] 2.5: Test `convertToLinear16()` with non-LINEAR16 encoding (e.g., FLOAT)
  - [x] 2.6: Test `convertToLinear16()` with sample rate requiring resampling

- [x] Task 3: Add word-mapper recovery and edge case tests to `word-mapper.test.ts` (AC: 1, 3)
  - [x] 3.1: Test `attemptRecovery()` with `skip-stt` action (STT word skipped)
  - [x] 3.2: Test `attemptRecovery()` with `skip-segment` action (segment word skipped)
  - [x] 3.3: Test `attemptRecovery()` with no-recovery-possible path
  - [x] 3.4: Test multiple consecutive mismatches triggering recovery
  - [x] 3.5: Test 0% match ratio (all words unmapped)
  - [x] 3.6: Test segments with special characters or punctuation only

- [x] Task 4: Add `executeTimestampExtraction()` STT path tests to `timestamp-extraction.test.ts` (AC: 1, 3)
  - [x] 4.1: Test full STT success path (not just fallback) with mocked `recognizeLongRunning` and `downloadAndConvert`
  - [x] 4.2: Test STT path with word mapping below 80% threshold triggering fallback
  - [x] 4.3: Test STT path with retry failures (all 3 retries fail → fallback)
  - [x] 4.4: Test STT path with low confidence score triggering fallback
  - [x] 4.5: Test invalid GCS URL handling in `attemptSTTExtraction()`

- [x] Task 5: Add client lifecycle and helper tests (AC: 1, 3)
  - [x] 5.1: Test `createSpeechClient()` singleton behavior (returns same instance)
  - [x] 5.2: Test `closeSpeechClient()` cleanup
  - [x] 5.3: Test `resetSpeechClient()` creates fresh instance
  - [ ] 5.4: Test `extractWords()` from fallback.ts with various delimiters - N/A (not exported, already tested via estimateWordTimings)
  - [ ] 5.5: Test `isEmphasisWord()` from fallback.ts - N/A (not exported, already tested via estimateWordTimings emphasis test)
  - [x] 5.6: Test `createUniformTimings()` from fallback.ts edge cases (tested via all-punctuation words test in fallback.test.ts)

- [x] Task 6: Verify coverage and CI (AC: 3, 4)
  - [x] 6.1: 228 tests pass across 8 test files for timestamp-extraction package
  - [x] 6.2: `pnpm build` passes (16/16 packages)
  - [x] 6.3: All timestamp-extraction tests pass (pre-existing failures in other packages are not regressions)

## Dev Notes

### CRITICAL: What Already Exists

The `@nexus-ai/timestamp-extraction` package already has **8 test files with ~179 tests** (2,642 lines of test code). This story fills specific GAPS to reach >80% coverage. Do NOT rewrite existing tests - EXTEND them.

### Existing Test Files (DO NOT recreate)

| File | Tests | Coverage |
|------|-------|----------|
| `timestamp-extraction.test.ts` | 35 | Main executor (but only tests fallback path) |
| `stt-client.test.ts` | 12 | Constants + `shouldUseFallback()` only |
| `word-mapper.test.ts` | 18 | Happy path + basic edge cases |
| `fallback.test.ts` | 34 | Extensive - good coverage |
| `quality-gate.test.ts` | 24 | Comprehensive - good coverage |
| `audio-utils.test.ts` | 11 | `isValidGcsUrl()` + `validateAudioFormat()` + `convertToLinear16()` |
| `stt-accuracy.test.ts` | 30 | Fixtures + accuracy utils (1 skipped real API test) |
| `types.test.ts` | 15 | Constants validation |

### CRITICAL GAPS TO FILL

**Gap 1: `recognizeLongRunning()` has ZERO direct tests.** This is the primary STT function. Mock the Google Speech API client:
```typescript
vi.mock('@google-cloud/speech', () => ({
  v1: {
    SpeechClient: vi.fn().mockImplementation(() => ({
      longRunningRecognize: vi.fn().mockResolvedValue([{
        promise: () => Promise.resolve([{ results: [...] }])
      }]),
      close: vi.fn()
    }))
  }
}));
```

**Gap 2: `downloadFromGCS()` has ZERO tests.** Mock the Storage client:
```typescript
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue([Buffer.from('RIFF...')])
      })
    })
  }))
}));
```

**Gap 3: Word mapper `attemptRecovery()` is private but untested through public API.** Test via `mapWordsToSegments()` with inputs designed to trigger recovery (mismatched words between STT and segments).

**Gap 4: `executeTimestampExtraction()` only tests fallback path.** The STT success path with `downloadAndConvert()` → `recognizeLongRunning()` → `mapWordsToSegments()` is untested. Mock these internal modules to test the orchestration.

### Mock Pattern for Internal Modules

Use `vi.mock()` at the module level for internal dependencies:
```typescript
// In timestamp-extraction.test.ts for STT path tests
vi.mock('../stt-client.js', () => ({
  recognizeLongRunning: vi.fn(),
  createSpeechClient: vi.fn(),
  closeSpeechClient: vi.fn(),
  resetSpeechClient: vi.fn(),
  shouldUseFallback: vi.fn()
}));
vi.mock('../audio-utils.js', () => ({
  downloadAndConvert: vi.fn(),
  isValidGcsUrl: vi.fn()
}));
```

### Testing Standards

- Use Vitest (already configured)
- Follow existing test patterns in the package
- Use `describe`/`it` blocks with clear descriptions
- Mock external dependencies (Google Cloud APIs)
- Use `.js` extensions in import paths (ESM)
- Test files go in `src/__tests__/` directory
- Name pattern: `{module}.test.ts`

### What NOT To Do

- Do NOT rewrite existing tests - only ADD new tests
- Do NOT modify source code (only test files)
- Do NOT add tests for `createPipelineLogger` or other `@nexus-ai/core` internals
- Do NOT create new test files for modules that already have test files - extend existing ones
- Do NOT try to run real GCP API calls (mock everything)
- Do NOT change the `vitest.config.ts` or build configuration
- Do NOT add coverage configuration - just ensure tests exercise the code paths

### File Import Pattern

All imports use `.js` extensions per ESM configuration:
```typescript
import { recognizeLongRunning } from '../stt-client.js';
import { downloadFromGCS } from '../audio-utils.js';
```

### Previous Story Intelligence

From Story 6.11:
- Pipeline data flow tests added in `apps/orchestrator/src/__tests__/pipeline-dataflow-timestamps.test.ts`
- Pre-existing test failures in unrelated packages (core/types, core/utils, orchestrator health) are NOT regressions
- Build passes with 16/16 packages
- Test patterns use `vi.mock()` at module level, `vi.fn()` for individual functions

### Git Intelligence

Recent commits:
- `980648f` feat(orchestrator): update pipeline data flow for timestamps (Story 6-11)
- `e772a5f` feat(orchestrator): register timestamp stage in pipeline (Story 6-10)
- `3b9fa1a` feat(timestamp-extraction): implement timestamp quality gate (Story 6-9)
- Convention: `feat({package}): {description} (Story {key})`

### Project Structure Notes

- Package location: `packages/timestamp-extraction/`
- Test directory: `packages/timestamp-extraction/src/__tests__/`
- Fixtures: `packages/timestamp-extraction/src/__tests__/fixtures/`
- Package scope: `@nexus-ai/timestamp-extraction`
- All packages use TypeScript strict mode with `.js` extensions in imports
- Test framework: Vitest

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Story 6.12]
- [Source: _bmad-output/project-context.md - Testing Standards]
- [Source: packages/timestamp-extraction/src/__tests__/ - Existing test files]
- [Source: packages/timestamp-extraction/src/ - Source modules to cover]
- [Source: _bmad-output/implementation-artifacts/6-11-update-pipeline-data-flow-timestamps.md - Previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Added 22 new tests to `stt-client.test.ts` (12 → 34 tests): recognizeLongRunning with GCS URI, Buffer, multi-result parsing, empty/null results, duration parsing (string/number/Long/null), timeout, cost tracking, error propagation, client lifecycle
- Added 12 new tests to `audio-utils.test.ts` (11 → 23 tests): downloadFromGCS success/error/invalid URL, downloadAndConvert pipeline, convertToLinear16 with FLOAT encoding and dual conversion
- Added 8 new tests to `word-mapper.test.ts` (18 → 26 tests): skip-stt recovery, skip-segment recovery, no-recovery, consecutive mismatches, 0% match ratio, punctuation handling, exhausted STT words, partial multi-segment mapping
- Added 7 new tests to `timestamp-extraction.test.ts` (35 → 42 tests): full STT success path, 80% mapping threshold fallback, retry failure fallback, low confidence fallback, invalid GCS URL, extraction confidence metadata, downloadAndConvert invocation
- Total: 49 new tests added across 4 test files (179 → 228 total)
- Subtasks 5.4 and 5.5 marked N/A: `extractWords()` and `isEmphasisWord()` are private functions already tested indirectly through exported `estimateWordTimings()` in existing fallback.test.ts
- All pre-existing failures in other packages (core, orchestrator, youtube, visual-gen, video-studio) confirmed as non-regressions from Story 6.11

### File List

- `packages/timestamp-extraction/src/__tests__/stt-client.test.ts` (modified: added recognizeLongRunning, client lifecycle tests)
- `packages/timestamp-extraction/src/__tests__/audio-utils.test.ts` (modified: added downloadFromGCS, downloadAndConvert, convertToLinear16 tests)
- `packages/timestamp-extraction/src/__tests__/word-mapper.test.ts` (modified: added recovery and edge case tests)
- `packages/timestamp-extraction/src/__tests__/timestamp-extraction.test.ts` (modified: added STT path tests)
