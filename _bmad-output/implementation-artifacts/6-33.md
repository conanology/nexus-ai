# Story 6.33: Update Scene Duration Calculation

Status: done

## Story

As a developer,
I want scene durations calculated from word timings,
So that visuals align precisely with narration.

## Acceptance Criteria

1. **AC1: Word-Timing-Based Duration** - `generateTimeline()` in `packages/visual-gen/src/timeline.ts` updated to accept optional `DirectionSegment[]` and compute per-scene duration from segment timings:
   - If `timing.wordTimings` exists and is non-empty: duration = last word `endTime` - first word `startTime`
   - Else if `timing.actualDurationSec` exists: use it
   - Else if `timing.estimatedDurationSec` exists: use it
   - Else: fall back to existing proportional scaling logic (backward compatible)

2. **AC2: Animation Buffers** - Entrance/exit animation buffers added to each scene:
   - Entrance buffer: 15 frames (0.5s at 30fps) before first word
   - Exit buffer: 15 frames (0.5s at 30fps) after last word
   - Converts seconds to frames: `Math.round(seconds * fps)`
   - Buffers applied only when segment timings are available

3. **AC3: Scene Overlap Handling** - Adjacent scene transitions handled:
   - Exit animation of scene N can overlap with entrance of scene N+1
   - Crossfade region = min(exit buffer, entrance buffer) = 15 frames overlap allowed
   - No gaps between scenes (scenes are contiguous)

4. **AC4: Timeline Validation** - Timeline validated after generation:
   - Total scene durations approximately equal audio duration (within 1 second tolerance)
   - No gaps between scenes (each scene startTime = previous scene startTime + duration, accounting for overlap)
   - No excessive overlaps (max 30 frames)

5. **AC5: Backward Compatibility** - When no segment timings provided:
   - Existing proportional scaling logic unchanged
   - `generateTimeline(sceneMappings, audioDurationSec)` still works as before
   - All existing tests continue to pass

6. **AC6: Tests** - Unit tests verify:
   - Word-timing-based duration calculation
   - Estimated-timing fallback
   - Actual-timing fallback (actualDurationSec)
   - Animation buffer application (entrance + exit)
   - Scene overlap within limits
   - Timeline validation passes for valid timelines
   - Timeline validation catches gaps/excessive overlaps
   - Backward compatibility (no segments = proportional scaling)
   - Edge cases: single segment, empty word timings, mixed timing sources

## Tasks / Subtasks

- [x] Task 1: Update `generateTimeline()` signature and types (AC: #1, #5)
  - [x] 1.1 Add optional `segments?: DirectionSegment[]` to the `options` parameter in `generateTimeline()` in `packages/visual-gen/src/timeline.ts`
  - [x] 1.2 Import `DirectionSegment` type from `@nexus-ai/script-gen` (already a dependency via `types.ts`)
  - [x] 1.3 Ensure backward compatibility: when `segments` is undefined/empty, use existing proportional scaling

- [x] Task 2: Implement segment-based duration calculation (AC: #1)
  - [x] 2.1 Create helper function `resolveSceneDuration(segment: DirectionSegment, fps: number)` in `timeline.ts`:
    - If `segment.timing.wordTimings` exists and length > 0: return `lastWord.endTime - firstWord.startTime`
    - Else if `segment.timing.actualDurationSec` defined: return it
    - Else if `segment.timing.estimatedDurationSec` defined: return it
    - Else: return undefined (signals fallback to proportional scaling)
  - [x] 2.2 Create helper function `resolveSceneStartTime(segment: DirectionSegment)`:
    - If `segment.timing.wordTimings` exists and length > 0: return `firstWord.startTime`
    - Else: return `segment.timing.actualStartSec ?? segment.timing.estimatedStartSec`

- [x] Task 3: Implement animation buffers (AC: #2, #3)
  - [x] 3.1 Define constants: `ENTRANCE_BUFFER_FRAMES = 15`, `EXIT_BUFFER_FRAMES = 15`
  - [x] 3.2 When segment timings used, apply entrance buffer: `sceneStartTime = segmentStart - (ENTRANCE_BUFFER_FRAMES / fps)` (clamped to >= 0)
  - [x] 3.3 Apply exit buffer: `sceneDuration = segmentDuration + (ENTRANCE_BUFFER_FRAMES + EXIT_BUFFER_FRAMES) / fps`
  - [x] 3.4 Handle overlap: allow adjacent scenes to overlap by up to `min(EXIT_BUFFER_FRAMES, ENTRANCE_BUFFER_FRAMES)` frames

- [x] Task 4: Implement timeline validation (AC: #4)
  - [x] 4.1 Create `validateTimeline(timeline: TimelineJSON, audioDurationSec: number, fps: number)` function
  - [x] 4.2 Check: total scene coverage approximately equals audio duration (within 1 second tolerance)
  - [x] 4.3 Check: no gaps between scenes (startTime continuity, accounting for allowed overlaps)
  - [x] 4.4 Check: no excessive overlaps (max 30 frames between any two adjacent scenes)
  - [x] 4.5 Return validation result with warnings (not errors - don't break pipeline)

- [x] Task 5: Update `generateTimeline()` main logic (AC: #1, #2, #3, #5)
  - [x] 5.1 When `options.segments` provided and non-empty:
    - Map each segment to a scene using `resolveSceneDuration()` and `resolveSceneStartTime()`
    - Apply animation buffers
    - Handle overlaps
  - [x] 5.2 When any segment returns undefined duration: fall back to proportional scaling for that scene
  - [x] 5.3 If ALL segments return undefined duration: use full proportional scaling (existing behavior)
  - [x] 5.4 Call `validateTimeline()` on result and attach warnings to output

- [x] Task 6: Update `executeVisualGen()` call site (AC: #1)
  - [x] 6.1 In `packages/visual-gen/src/visual-gen.ts`, pass `directionDocument.segments` to `generateTimeline()` via `options.segments` when available
  - [x] 6.2 Log timing resolution mode (word-timings / actual / estimated / proportional)

- [x] Task 7: Write/update tests (AC: #6)
  - [x] 7.1 Add test: word-timing-based duration (first word start to last word end)
  - [x] 7.2 Add test: actualDurationSec fallback when no word timings
  - [x] 7.3 Add test: estimatedDurationSec fallback when no actual timings
  - [x] 7.4 Add test: entrance buffer shifts scene start earlier by 15 frames
  - [x] 7.5 Add test: exit buffer extends scene duration by 15 frames
  - [x] 7.6 Add test: adjacent scene overlap within 30-frame limit
  - [x] 7.7 Add test: timeline validation passes for valid timeline
  - [x] 7.8 Add test: timeline validation warns on gaps or excessive overlap
  - [x] 7.9 Add test: backward compatibility (no segments = proportional scaling unchanged)
  - [x] 7.10 Add test: single segment with word timings
  - [x] 7.11 Add test: mixed timing sources across segments
  - [x] 7.12 Verify all existing timeline tests still pass (regression check)

- [x] Task 8: Build and test verification
  - [x] 8.1 Run `pnpm build` - must pass
  - [x] 8.2 Run `pnpm test` - must pass (2 pre-existing scene-mapper failures, 0 new regressions)

## Dev Notes

### Architecture Compliance

- **Package**: `packages/visual-gen` (existing package from Epic 3)
- **Primary file**: `packages/visual-gen/src/timeline.ts` - main implementation
- **Call site**: `packages/visual-gen/src/visual-gen.ts` - pass segments to generateTimeline
- **Test file**: `packages/visual-gen/src/__tests__/timeline.test.ts` - add/update tests
- TypeScript strict mode required
- No console.log - use structured logger if needed
- kebab-case files, PascalCase interfaces, camelCase functions

### Current generateTimeline() Function (MODIFY THIS)

```typescript
// Current state in packages/visual-gen/src/timeline.ts
export function generateTimeline(
  sceneMappings: SceneMapping[],
  audioDurationSec: number,
  options?: { fps?: number; targetDuration?: '30s' | '1min' | '5min' | '8min' | 'auto' }
): TimelineJSON {
  const fps = options?.fps && options.fps > 0 ? options.fps : 30;
  const totalDurationFrames = Math.ceil(audioDurationSec * fps);
  // ... proportional scaling logic ...
}
```

**Target state after this story:**

```typescript
import type { DirectionSegment } from '@nexus-ai/script-gen';

export function generateTimeline(
  sceneMappings: SceneMapping[],
  audioDurationSec: number,
  options?: {
    fps?: number;
    targetDuration?: '30s' | '1min' | '5min' | '8min' | 'auto';
    segments?: DirectionSegment[];  // NEW: segment timings for precise durations
  }
): TimelineJSON {
  const fps = options?.fps && options.fps > 0 ? options.fps : 30;
  const totalDurationFrames = Math.ceil(audioDurationSec * fps);

  if (options?.segments && options.segments.length > 0) {
    // NEW: Use segment timings for precise scene durations
    // ... word-timing or actual/estimated duration resolution ...
    // ... animation buffers ...
    // ... overlap handling ...
  } else {
    // EXISTING: Proportional scaling (unchanged)
    // ...
  }
}
```

### Key Type Definitions (DO NOT REDEFINE - IMPORT THESE)

**DirectionSegment** (from `@nexus-ai/script-gen`):
```typescript
export interface DirectionSegment {
  id: string;
  index: number;
  type: SegmentType;
  content: SegmentContent;
  timing: SegmentTiming;
  visual: SegmentVisual;
  audio: SegmentAudio;
}
```

**SegmentTiming** (from `@nexus-ai/script-gen`):
```typescript
export interface SegmentTiming {
  estimatedStartSec?: number;
  estimatedEndSec?: number;
  estimatedDurationSec?: number;
  actualStartSec?: number;
  actualEndSec?: number;
  actualDurationSec?: number;
  wordTimings?: WordTiming[];
  timingSource: TimingSource; // 'estimated' | 'extracted'
}
```

**WordTiming** (from `@nexus-ai/script-gen`, re-exported by `@nexus-ai/timestamp-extraction`):
```typescript
export interface WordTiming {
  word: string;
  index: number;
  startTime: number;   // seconds from video start
  endTime: number;     // seconds from video start
  duration: number;    // endTime - startTime
  segmentId: string;
  isEmphasis: boolean;
}
```

### Duration Resolution Priority

1. `segment.timing.wordTimings` (most precise - actual word boundaries)
2. `segment.timing.actualDurationSec` (extracted from audio - good precision)
3. `segment.timing.estimatedDurationSec` (estimated from word count - lower precision)
4. Proportional scaling from `SceneMapping.duration` (fallback - current behavior)

### Animation Buffer Constants

```typescript
const ENTRANCE_BUFFER_FRAMES = 15;  // 0.5s at 30fps
const EXIT_BUFFER_FRAMES = 15;      // 0.5s at 30fps
const MAX_OVERLAP_FRAMES = 30;       // Maximum allowed overlap between adjacent scenes
```

### Existing Helper Functions (REUSE THESE)

In `packages/visual-gen/src/visual-gen.ts`:
```typescript
export function resolveSegmentStartSec(timing: { actualStartSec?: number; estimatedStartSec?: number }): number | undefined {
  return timing.actualStartSec ?? timing.estimatedStartSec;
}

export function resolveSegmentDurationSec(timing: { actualDurationSec?: number; estimatedDurationSec?: number }): number | undefined {
  return timing.actualDurationSec ?? timing.estimatedDurationSec;
}
```

Consider moving these helpers into `timeline.ts` or a shared utils file so they can be used by the timeline generation logic without circular imports. Or import them from `visual-gen.ts`.

### Call Site Update (packages/visual-gen/src/visual-gen.ts)

Current:
```typescript
const timeline = generateTimeline(sceneMappings, data.audioDurationSec);
```

Target:
```typescript
const timeline = generateTimeline(sceneMappings, data.audioDurationSec, {
  segments: data.directionDocument?.segments,
});
```

### Downstream Consumers (DO NOT BREAK)

1. **TechExplainer.tsx**: Reads `timeline.scenes` and `timeline.audioDurationSec` - scene structure unchanged
2. **Render Service**: JSON passthrough - additive changes safe
3. **Visual-gen pipeline**: Calls `generateTimeline()` - optional new param is backward compatible

### Previous Story Intelligence (Story 6-32)

- Added `totalDurationFrames` and `targetDuration` to `TimelineJSON` interface
- Updated `generateTimeline()` with `options` parameter (fps, targetDuration)
- Added fps guard: `options?.fps && options.fps > 0 ? options.fps : 30`
- All scenes still use proportional scaling with `scaleFactor = audioDurationSec / totalSceneDuration`
- 21 timeline tests currently passing; 2 pre-existing scene-mapper test failures (TextOnGradient rename)
- Files: `packages/visual-gen/src/types.ts`, `timeline.ts`, `__tests__/timeline.test.ts`

### Git Intelligence

Recent commits (6-28 through 6-32) are all Epic 6 work. Story 6-32 was the immediate predecessor, modifying the same files this story will touch (timeline.ts, types.ts, timeline.test.ts). The `options` parameter pattern established in 6-32 should be extended (add `segments` field).

### Scope Boundaries

- DO NOT modify `SceneMapping` interface (scene mapper still produces fixed durations as before)
- DO NOT modify TechExplainer.tsx (that's Story 6-34's scope)
- DO NOT modify render-service (downstream consumer)
- DO NOT modify the scene-mapper.ts logic (it still creates SceneMappings with default durations)
- This story adds segment-timing-aware duration calculation as an overlay on top of existing proportional scaling
- The proportional scaling path must remain fully functional as fallback

### Project Structure Notes

- Package: `packages/visual-gen/` (monorepo workspace package)
- Build: `pnpm build` from root uses Turborepo
- Test: `pnpm test` from root, or `pnpm --filter @nexus-ai/visual-gen test`
- Naming: kebab-case files, PascalCase interfaces, camelCase functions

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.33]
- [Source: packages/visual-gen/src/timeline.ts - generateTimeline function]
- [Source: packages/visual-gen/src/types.ts - TimelineJSON, SceneMapping interfaces]
- [Source: packages/visual-gen/src/visual-gen.ts - executeVisualGen pipeline, helper functions]
- [Source: packages/script-gen/src/types.ts - DirectionSegment, SegmentTiming, WordTiming]
- [Source: _bmad-output/implementation-artifacts/6-32.md - Previous story intelligence]
- [Source: _bmad-output/project-context.md - Project rules and conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Implemented segment-based duration calculation in `generateTimeline()` with 3-tier fallback: wordTimings > actualDurationSec > estimatedDurationSec > proportional scaling
- Created `resolveSceneDuration()` and `resolveSceneStartTime()` helper functions for timing resolution
- Added animation buffers (ENTRANCE_BUFFER_FRAMES=15, EXIT_BUFFER_FRAMES=15) applied only when segment timings available
- Implemented `validateTimeline()` function checking audio duration coverage (1s tolerance), gaps, and excessive overlaps (max 30 frames)
- Added `validationWarnings` optional field to `TimelineJSON` interface
- Updated `executeVisualGen()` call site to pass `directionDocument.segments` and log timing resolution mode
- Exported new public functions from package index: `resolveSceneDuration`, `resolveSceneStartTime`, `validateTimeline`, `TimelineValidationResult`
- Added 30 new tests covering all ACs: word-timing duration, actual/estimated fallbacks, entrance/exit buffers, overlap handling, validation, backward compatibility, and edge cases
- All 21 existing timeline tests continue to pass (regression-free)
- Build passes cleanly; 2 pre-existing scene-mapper test failures (TextOnGradient rename) are not regressions

### File List

- packages/visual-gen/src/timeline.ts (modified - segment-based duration, buffers, validation)
- packages/visual-gen/src/types.ts (modified - added validationWarnings to TimelineJSON)
- packages/visual-gen/src/visual-gen.ts (modified - pass segments to generateTimeline, log timing mode)
- packages/visual-gen/src/index.ts (modified - export new functions and types)
- packages/visual-gen/src/__tests__/timeline.test.ts (modified - 30 new tests for segment-based features)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified - story status)
- _bmad-output/implementation-artifacts/6-33.md (modified - task checkboxes, dev agent record, status)
