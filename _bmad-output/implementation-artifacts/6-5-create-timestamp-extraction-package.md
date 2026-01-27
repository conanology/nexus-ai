# Story 6.5: Create Timestamp Extraction Package

Status: done

## Story

As a developer,
I want a new timestamp-extraction package structure,
So that word-level timing can be extracted from TTS audio.

## Acceptance Criteria

1. **Given** TTS audio output from Epic 3
   **When** I create `packages/timestamp-extraction/`
   **Then** package structure includes:
   - `package.json` with `@nexus-ai/timestamp-extraction` name
   - `tsconfig.json` extending base config
   - `src/index.ts` exporting public API
   - `src/types.ts` with input/output types
   - `src/timestamp-extraction.ts` for main stage logic
   - `src/fallback.ts` for estimated timing
   - `src/quality-gate.ts` for validation
   - `src/__tests__/` for unit tests

2. **And** `TimestampExtractionInput` includes:
   - `audioUrl`: GCS URL to TTS audio
   - `audioDurationSec`: total audio duration
   - `directionDocument`: DirectionDocument with segments

3. **And** `TimestampExtractionOutput` includes:
   - `directionDocument`: enriched with word timings
   - `wordTimings`: flat array of all WordTiming objects
   - `timingMetadata`: source, confidence, warnings

4. **And** package compiles and exports correctly

## Tasks / Subtasks

- [x] Task 1: Create Package Structure (AC: 1)
  - [x] 1.1 Create `packages/timestamp-extraction/` directory
  - [x] 1.2 Create `package.json` with:
    - Name: `@nexus-ai/timestamp-extraction`
    - Type: `module`
    - Dependencies: `@nexus-ai/core`, `@nexus-ai/script-gen`
    - DevDependencies: `@nexus-ai/config`, `typescript`, `vitest`
  - [x] 1.3 Create `tsconfig.json` extending `@nexus-ai/config/tsconfig/node.json`
  - [x] 1.4 Update root `pnpm-workspace.yaml` to include new package (already includes `packages/*`)

- [x] Task 2: Define Types (AC: 2, 3)
  - [x] 2.1 Create `src/types.ts` with:
    - `TimestampExtractionInput` interface
    - `TimestampExtractionOutput` interface
    - `TimingMetadata` interface
    - `EstimatedTimingConfig` interface
  - [x] 2.2 Import and re-export `WordTiming`, `DirectionDocument` from `@nexus-ai/script-gen`

- [x] Task 3: Implement Main Stage Skeleton (AC: 1)
  - [x] 3.1 Create `src/timestamp-extraction.ts` with `executeTimestampExtraction()` stub
  - [x] 3.2 Implement `StageInput`/`StageOutput` contract from `@nexus-ai/core`
  - [x] 3.3 Add structured logging for stage start/complete
  - [x] 3.4 Add placeholder for STT integration (to be implemented in Story 6.6)

- [x] Task 4: Implement Fallback Logic (AC: 1)
  - [x] 4.1 Create `src/fallback.ts` with:
    - `estimateWordTimings(segment, segmentStartSec, config)` function
    - `applyEstimatedTimings(document, audioDurationSec)` function
  - [x] 4.2 Implement character-weighted timing distribution
  - [x] 4.3 Handle punctuation pauses (300ms for `.!?`, 150ms for `,;:`)
  - [x] 4.4 Clamp word durations to min 0.1s, max 1.0s

- [x] Task 5: Implement Quality Gate (AC: 1)
  - [x] 5.1 Create `src/quality-gate.ts` with `validateTimestampExtraction()` function
  - [x] 5.2 Implement validation checks:
    - Word count match (90% threshold)
    - No timing gaps > 500ms
    - Monotonic timing (no overlaps) - CRITICAL
    - Processing time < 60 seconds
  - [x] 5.3 Return PASS/DEGRADED/FAIL status with specific flags

- [x] Task 6: Create Public Exports (AC: 4)
  - [x] 6.1 Create `src/index.ts` exporting:
    - `executeTimestampExtraction` function
    - All types from `types.ts`
    - `estimateWordTimings`, `applyEstimatedTimings` from `fallback.ts`
    - `validateTimestampExtraction` from `quality-gate.ts`

- [x] Task 7: Add Unit Tests (AC: 4)
  - [x] 7.1 Create `src/__tests__/types.test.ts` - validate type definitions
  - [x] 7.2 Create `src/__tests__/fallback.test.ts` - test estimated timing calculation
  - [x] 7.3 Create `src/__tests__/quality-gate.test.ts` - test validation logic
  - [x] 7.4 Create `src/__tests__/timestamp-extraction.test.ts` - test stage skeleton

- [x] Task 8: Verify Build and Integration (AC: 4)
  - [x] 8.1 Run `pnpm install` to link workspace dependencies
  - [x] 8.2 Run `pnpm build` in package - verify TypeScript compiles
  - [x] 8.3 Run `pnpm test` - verify all tests pass (68 tests passing)
  - [x] 8.4 Verify exports work from consuming package (orchestrator import)

## Dev Notes

### Primary Files to Create

**Package Structure:**
```
packages/timestamp-extraction/
├── package.json           # @nexus-ai/timestamp-extraction
├── tsconfig.json          # Extends @nexus-ai/config
├── src/
│   ├── index.ts           # Public exports
│   ├── types.ts           # Input/output interfaces
│   ├── timestamp-extraction.ts  # Main stage executor
│   ├── fallback.ts        # Estimated timing fallback
│   ├── quality-gate.ts    # Validation logic
│   └── __tests__/
│       ├── types.test.ts
│       ├── fallback.test.ts
│       ├── quality-gate.test.ts
│       └── timestamp-extraction.test.ts
```

### Architecture Compliance

#### Required Patterns (from project-context.md)

1. **StageInput/StageOutput Contracts** - MUST use typed contracts:
```typescript
async function executeTimestampExtraction(
  input: StageInput<TimestampExtractionInput>
): Promise<StageOutput<TimestampExtractionOutput>>
```

2. **Structured Logger** - Use `logger` from `@nexus-ai/core`, no console.log:
```typescript
import { logger } from '@nexus-ai/core';
logger.info('Stage started', { pipelineId, stage: 'timestamp-extraction' });
```

3. **Error Handling** - Use `NexusError` for all errors:
```typescript
throw NexusError.degraded('NEXUS_TIMESTAMP_FALLBACK', 'Using estimated timings', 'timestamp-extraction');
```

4. **Quality Gate Before Return** - ALWAYS validate output:
```typescript
const gate = await qualityGate.check('timestamp-extraction', output);
```

5. **Cost Tracking** - Track API costs (for future STT integration):
```typescript
const tracker = new CostTracker(pipelineId, 'timestamp-extraction');
tracker.recordApiCall('google-stt', audioDurationMin, cost);
```

#### Naming Conventions

- Functions: camelCase (`executeTimestampExtraction`, `estimateWordTimings`)
- Interfaces: PascalCase (`TimestampExtractionInput`, `WordTiming`)
- Constants: SCREAMING_SNAKE (`DEFAULT_TIMING_CONFIG`, `MAX_GAP_MS`)
- Files: kebab-case (`timestamp-extraction.ts`, `quality-gate.ts`)
- Error codes: `NEXUS_{DOMAIN}_{TYPE}` (`NEXUS_TIMESTAMP_INVALID_INPUT`)

### Technical Requirements

#### TimestampExtractionInput Interface
```typescript
import { DirectionDocument } from '@nexus-ai/script-gen';

export interface TimestampExtractionInput {
  /** GCS URL to TTS audio file */
  audioUrl: string;
  /** Total audio duration in seconds */
  audioDurationSec: number;
  /** Direction document with segments to enrich */
  directionDocument: DirectionDocument;
  /** Pass-through topic data for downstream stages */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}
```

#### TimestampExtractionOutput Interface
```typescript
import { DirectionDocument, WordTiming } from '@nexus-ai/script-gen';

export interface TimestampExtractionOutput {
  /** Direction document enriched with word timings */
  directionDocument: DirectionDocument;
  /** Flat array of all word timings across segments */
  wordTimings: WordTiming[];
  /** Metadata about timing extraction */
  timingMetadata: TimingMetadata;
  /** Pass-through audio URL for downstream stages */
  audioUrl: string;
  /** Pass-through audio duration for downstream stages */
  audioDurationSec: number;
  /** Pass-through topic data for downstream stages */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}

export interface TimingMetadata {
  /** Source of timing data */
  source: 'extracted' | 'estimated';
  /** Confidence level from STT (only if extracted) */
  extractionConfidence?: number;
  /** Estimation method used (only if estimated) */
  estimationMethod?: 'character-weighted' | 'uniform';
  /** Warning flags for quality gate */
  warningFlags: string[];
}
```

#### EstimatedTimingConfig Interface
```typescript
export interface EstimatedTimingConfig {
  /** Words per minute for estimation (default: 150) */
  wordsPerMinute: number;
  /** Minimum duration per word in seconds (default: 0.1) */
  minWordDuration: number;
  /** Maximum duration per word in seconds (default: 1.0) */
  maxWordDuration: number;
  /** Pause after sentence-ending punctuation in seconds (default: 0.3) */
  pauseAfterPunctuation: number;
  /** Pause after comma/semicolon in seconds (default: 0.15) */
  pauseAfterComma: number;
}

export const DEFAULT_TIMING_CONFIG: EstimatedTimingConfig = {
  wordsPerMinute: 150,
  minWordDuration: 0.1,
  maxWordDuration: 1.0,
  pauseAfterPunctuation: 0.3,
  pauseAfterComma: 0.15,
};
```

### Previous Story Intelligence (Story 6.4)

**Key learnings from Story 6.4:**
1. `getScriptText()` from `@nexus-ai/script-gen` returns clean narration for TTS
2. TTS stage now outputs `audioDurationSec` (verified at line 319, 483 in tts.ts)
3. DirectionDocument flows from script-gen → pronunciation → tts → timestamp-extraction
4. The orchestrator passes `previousStageData` directly to next stage via `buildStageInput`

**Data flow from TTS:**
```typescript
// TTS output that becomes our input
interface TTSOutput {
  audioUrl: string;
  durationSec: number;  // This is our audioDurationSec
  format: string;
  sampleRate: number;
  segmentCount?: number;
  topicData?: {...};
}
```

### Library/Framework Requirements

#### Dependencies to Add (package.json)
```json
{
  "name": "@nexus-ai/timestamp-extraction",
  "version": "0.1.0",
  "description": "Timestamp extraction stage for word-level timing",
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
  },
  "dependencies": {
    "@nexus-ai/core": "workspace:*",
    "@nexus-ai/script-gen": "workspace:*"
  },
  "devDependencies": {
    "@nexus-ai/config": "workspace:*",
    "typescript": "^5.3.0",
    "vitest": "^1.1.0"
  }
}
```

**Note:** Google Cloud STT dependency (`@google-cloud/speech`) will be added in Story 6.6 when implementing actual extraction.

#### tsconfig.json
```json
{
  "extends": "@nexus-ai/config/tsconfig/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

### Testing Standards

- **Framework:** Vitest (project standard)
- **Test location:** Co-located in `src/__tests__/`
- **Coverage target:** 80%+ for package

#### Test Fixtures for Fallback Tests
```typescript
// Mock DirectionDocument segment for testing
const mockSegment: DirectionSegment = {
  id: 'test-segment-1',
  index: 0,
  type: 'explanation',
  content: {
    text: 'Hello world, this is a test.',
    wordCount: 6,
    keywords: ['test'],
    emphasis: []
  },
  timing: {
    estimatedStartSec: 0,
    estimatedEndSec: 2.4,
    estimatedDurationSec: 2.4,
    timingSource: 'estimated'
  },
  visual: { /* ... */ },
  audio: { /* ... */ }
};

// Expected word timings (character-weighted)
const expectedTimings: WordTiming[] = [
  { word: 'Hello', index: 0, startTime: 0, endTime: 0.35, duration: 0.35, segmentId: 'test-segment-1', isEmphasis: false },
  { word: 'world', index: 1, startTime: 0.35, endTime: 0.7, duration: 0.35, segmentId: 'test-segment-1', isEmphasis: false },
  // After comma: +0.15s pause
  { word: 'this', index: 2, startTime: 0.85, endTime: 1.15, duration: 0.3, segmentId: 'test-segment-1', isEmphasis: false },
  // ...
];
```

### Project Structure Notes

This package follows the established pattern from other stage packages:
- `packages/tts/` - TTS synthesis (similar structure)
- `packages/pronunciation/` - Pronunciation processing (similar structure)
- `packages/script-gen/` - Defines DirectionDocument (dependency)

### References

- [Source: epics.md] Story 6.5 requirements: lines 2132-2160
- [Source: tech-spec] Phase 2 implementation plan: lines 1176-1318
- [Source: tech-spec] Timestamp types and fallback strategy: lines 515-617
- [Source: project-context.md] Critical patterns for stage implementation
- [Source: architecture.md] Stage execution pattern and provider abstraction
- [Source: 6-4 story] Previous story with TTS output: `_bmad-output/implementation-artifacts/6-4-update-tts-to-read-script-only.md`

### Git Intelligence

Recent commits for context:
- `8c314bf` - feat(pronunciation): update to use getScriptText for clean TTS input (Story 6.4)
- `f3d6719` - feat(script-gen): implement backward compatibility layer and dual output (Stories 6.2, 6.3)
- `f52175f` - feat(script-gen): define DirectionDocument schema with Zod validation (Story 6.1)

Commit message pattern: `feat(timestamp-extraction): create package structure (Story 6.5)`

### Anti-Pattern Prevention

1. **DO NOT add Google Cloud STT dependency yet** - That's Story 6.6
2. **DO NOT implement actual STT extraction** - This story creates the package skeleton
3. **DO NOT skip quality gate validation** - MUST validate output before returning
4. **DO NOT use console.log** - Use structured logger from @nexus-ai/core
5. **DO NOT hardcode timing values** - Use configurable constants
6. **DO NOT forget to pass through topicData** - Required for downstream stages
7. **DO NOT create redundant type definitions** - Import `WordTiming`, `DirectionDocument` from script-gen

### Edge Cases to Handle

1. **Empty segments array:**
   - Return empty wordTimings array
   - Set timingMetadata.warningFlags = ['no-segments']

2. **Segment with no words:**
   - Skip segment in word timing calculation
   - Log warning

3. **Very long words (technical terms):**
   - Clamp to maxWordDuration (1.0s)
   - Don't let single word consume entire segment

4. **Zero-duration segments:**
   - Skip or assign minimum duration
   - Log warning

5. **Missing audioDurationSec:**
   - Use estimated duration from DirectionDocument
   - Set warningFlag = ['audio-duration-estimated']

### Quality Gate Specifications

```typescript
// Quality gate validation checks
const QUALITY_CHECKS = {
  wordCountMatch: {
    threshold: 0.9,  // 90% of expected words
    severity: 'DEGRADED',
    code: 'NEXUS_TIMESTAMP_WORD_COUNT_MISMATCH'
  },
  noGaps: {
    maxGapMs: 500,   // No gaps > 500ms between words
    severity: 'DEGRADED',
    code: 'NEXUS_TIMESTAMP_TIMING_GAP'
  },
  monotonicTiming: {
    // No overlapping word times
    severity: 'CRITICAL',  // This is a FAIL condition
    code: 'NEXUS_TIMESTAMP_OVERLAP'
  },
  processingTime: {
    maxMs: 60000,    // < 60 seconds
    severity: 'DEGRADED',
    code: 'NEXUS_TIMESTAMP_SLOW_PROCESSING'
  }
};
```

### Estimated Timing Algorithm

From tech-spec (lines 534-580):
```typescript
function estimateWordTimings(
  segment: DirectionSegment,
  segmentStartSec: number,
  config: EstimatedTimingConfig = DEFAULT_TIMING_CONFIG
): WordTiming[] {
  const words = segment.content.text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const timings: WordTiming[] = [];
  const totalChars = words.reduce((sum, w) => sum + w.replace(/[.,!?;:]/g, '').length, 0);
  const segmentDuration = segment.timing.estimatedDurationSec ??
    (segment.content.wordCount / (config.wordsPerMinute / 60));

  let currentTime = segmentStartSec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const cleanWord = word.replace(/[.,!?;:]/g, '');

    // Duration proportional to character count
    const charRatio = cleanWord.length / totalChars;
    let duration = segmentDuration * charRatio;

    // Clamp to min/max
    duration = Math.max(config.minWordDuration, Math.min(config.maxWordDuration, duration));

    // Add pause for punctuation
    let pauseAfter = 0;
    if (/[.!?]$/.test(word)) pauseAfter = config.pauseAfterPunctuation;
    else if (/[,;:]$/.test(word)) pauseAfter = config.pauseAfterComma;

    timings.push({
      word: cleanWord,
      index: i,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration,
      segmentId: segment.id,
      isEmphasis: segment.content.emphasis?.some(e =>
        e.word.toLowerCase() === cleanWord.toLowerCase()) ?? false
    });

    currentTime += duration + pauseAfter;
  }

  return timings;
}
```

### Minimal Change Approach

This story focuses on **package skeleton creation**:
- No actual STT integration (Story 6.6)
- No orchestrator registration (Story 6.10)
- No pipeline data flow updates (Story 6.11)

**Scope:**
- ~150 lines in types.ts
- ~100 lines in fallback.ts
- ~80 lines in quality-gate.ts
- ~100 lines in timestamp-extraction.ts (skeleton)
- ~200 lines in tests
- Package configuration files

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build and test logs verified all 80 tests pass (after code review fixes)
- TypeScript compilation successful with strict mode

### Completion Notes List

- Created complete timestamp-extraction package with all required structure
- Implemented character-weighted timing estimation as fallback (STT integration in Story 6.6)
- Quality gate validates word count match, timing gaps, monotonic timing, and processing time
- Used `createPipelineLogger` for Pino-compatible structured logging
- Used `QualityMetrics` interface with stage, timestamp, and measurements fields
- All 80 unit tests passing (types: 15, fallback: 25, quality-gate: 20, timestamp-extraction: 20)
- Package exports both main stage executor and fallback utilities for reuse

### Senior Developer Review (AI)

**Review Date:** 2026-01-27
**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)

**Issues Found:** 1 HIGH, 4 MEDIUM, 4 LOW
**Issues Fixed:** 1 HIGH, 4 MEDIUM

**Fixes Applied:**
1. ✅ **H1: Quality Gate FAIL Not Throwing** - Added check in `timestamp-extraction.ts` to throw `NexusError.degraded` when quality gate status is FAIL (per project-context.md pattern)
2. ✅ **M1: Missing audioDurationSec Validation** - Added input validation to reject zero/negative audio duration
3. ✅ **M2: Hardcoded Scaling Tolerance** - Replaced with adaptive tolerance using `SCALING_TOLERANCE` constant (2% or 0.1s minimum)
4. ✅ **M3: Duplicate countWords Function** - Extracted to `types.ts` as shared utility, imported in both `fallback.ts` and `quality-gate.ts`
5. ✅ **M4: Missing Test Coverage** - Added tests for `applyEstimatedTimings` with custom config, adaptive scaling tolerance, and input validation

**Remaining LOW Issues (acceptable):**
- L1: Redundant type re-exports (design choice for convenience)
- L2: No direct test for createUniformTimings (covered indirectly)
- L3: Missing JSDoc on helpers (code is self-documenting)
- L4: Unused variable pattern (acceptable TypeScript convention)

**Test Results:** 80/80 passing (12 new tests added)

### File List

**New Files:**
- `packages/timestamp-extraction/package.json`
- `packages/timestamp-extraction/tsconfig.json`
- `packages/timestamp-extraction/src/index.ts`
- `packages/timestamp-extraction/src/types.ts`
- `packages/timestamp-extraction/src/timestamp-extraction.ts`
- `packages/timestamp-extraction/src/fallback.ts`
- `packages/timestamp-extraction/src/quality-gate.ts`
- `packages/timestamp-extraction/src/__tests__/types.test.ts`
- `packages/timestamp-extraction/src/__tests__/fallback.test.ts`
- `packages/timestamp-extraction/src/__tests__/quality-gate.test.ts`
- `packages/timestamp-extraction/src/__tests__/timestamp-extraction.test.ts`

**Modified Files:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress)

## Change Log

- 2026-01-27: Created @nexus-ai/timestamp-extraction package with complete implementation (Story 6.5)
- 2026-01-27: Code review fixes - quality gate FAIL handling, input validation, shared utilities, adaptive scaling (80 tests)
