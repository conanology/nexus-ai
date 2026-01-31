# Story 6.32: Update TimelineJSON for Dynamic Duration

Status: done

## Story

As a developer,
I want timeline to support variable video duration,
So that videos scale from 30 seconds to 5-8 minutes.

## Acceptance Criteria

1. **AC1: TimelineJSON Extended Fields** - `TimelineJSON` interface in `packages/visual-gen/src/types.ts` updated to include:
   - `audioDurationSec: number` (already exists - actual TTS duration, drives total length)
   - `totalDurationFrames: number` (NEW - calculated from `audioDurationSec * fps`, default fps=30)
   - `targetDuration?: '30s' | '1min' | '5min' | '8min' | 'auto'` (NEW - optional hint for render configuration)

2. **AC2: Scene Duration Calculation Updated** - Scene duration logic in `generateTimeline()` updated:
   - If word timings available: use `actualEndSec - actualStartSec` per segment
   - If estimated only: use `estimatedEndSec - estimatedStartSec`
   - Add animation padding buffer for entrance/exit animations
   - Total video duration driven by `audioDurationSec`

3. **AC3: Backward Compatibility** - Existing consumers of `TimelineJSON` continue to work:
   - `totalDurationFrames` and `targetDuration` are used only by new consumers
   - Existing `audioDurationSec` and `scenes` behavior unchanged
   - TechExplainer legacy mode unaffected
   - Render service continues to function with extended type

4. **AC4: Tests** - Unit tests verify:
   - `totalDurationFrames` calculated correctly from `audioDurationSec * fps`
   - `targetDuration` optional and defaults to undefined
   - Existing `generateTimeline()` tests still pass (no regressions)
   - New fields serialized correctly in JSON output

## Tasks / Subtasks

- [x] Task 1: Update TimelineJSON interface (AC: #1, #3)
  - [x] 1.1 Add `totalDurationFrames: number` field to `TimelineJSON` in `packages/visual-gen/src/types.ts`
  - [x] 1.2 Add `targetDuration?: '30s' | '1min' | '5min' | '8min' | 'auto'` field to `TimelineJSON`
  - [x] 1.3 Verify `audioDurationSec` already exists (it does - no change needed)

- [x] Task 2: Update generateTimeline() function (AC: #2, #3)
  - [x] 2.1 Update `generateTimeline()` in `packages/visual-gen/src/timeline.ts` to compute `totalDurationFrames`
  - [x] 2.2 Add optional `fps` parameter (default 30) for frame calculation
  - [x] 2.3 Add optional `targetDuration` parameter to pass through to output
  - [x] 2.4 Ensure existing proportional scaling logic remains intact for backward compatibility

- [x] Task 3: Update visual-gen pipeline (AC: #2)
  - [x] 3.1 Verified `executeVisualGen()` call site is backward compatible — uses default fps=30 and targetDuration=undefined via optional 3rd param (no code change needed)
  - [x] 3.2 Verified timeline JSON output includes new fields (`totalDurationFrames` via default fps, `targetDuration` omitted when undefined)

- [x] Task 4: Write/update tests (AC: #4)
  - [x] 4.1 Update existing timeline tests in `packages/visual-gen/src/__tests__/timeline.test.ts` for new fields
  - [x] 4.2 Add test: `totalDurationFrames` = `audioDurationSec * fps` (default 30)
  - [x] 4.3 Add test: `totalDurationFrames` with custom fps
  - [x] 4.4 Add test: `targetDuration` optional (undefined when not provided)
  - [x] 4.5 Add test: `targetDuration` pass-through when provided
  - [x] 4.6 Verify existing tests pass unchanged (regression check)

- [x] Task 5: Build and test verification
  - [x] 5.1 Run `pnpm build` - must pass
  - [x] 5.2 Run `pnpm test` - must pass

## Dev Notes

### Architecture Compliance

- **Package**: `packages/visual-gen` (existing package from Epic 3)
- **Interface file**: `packages/visual-gen/src/types.ts` - modify `TimelineJSON` interface
- **Function file**: `packages/visual-gen/src/timeline.ts` - modify `generateTimeline()`
- **Pipeline file**: `packages/visual-gen/src/visual-gen.ts` - update call site
- **Test file**: `packages/visual-gen/src/__tests__/timeline.test.ts` - update/add tests
- TypeScript strict mode required
- No console.log - use structured logger if needed

### Current TimelineJSON Interface (MODIFY THIS)

```typescript
// Current state in packages/visual-gen/src/types.ts
export interface TimelineJSON {
  audioDurationSec: number;
  scenes: Array<{
    component: string;
    props: {
      title?: string;
      text?: string;
      data?: any;
      style?: any;
    };
    startTime: number;
    duration: number;
  }>;
}
```

**Target state after this story:**

```typescript
export interface TimelineJSON {
  audioDurationSec: number;
  totalDurationFrames: number;        // NEW: audioDurationSec * fps
  targetDuration?: '30s' | '1min' | '5min' | '8min' | 'auto';  // NEW: optional hint
  scenes: Array<{
    component: string;
    props: {
      title?: string;
      text?: string;
      data?: any;
      style?: any;
    };
    startTime: number;
    duration: number;
  }>;
}
```

### Current generateTimeline() Function (MODIFY THIS)

```typescript
// Current state in packages/visual-gen/src/timeline.ts
export function generateTimeline(
  sceneMappings: SceneMapping[],
  audioDurationSec: number
): TimelineJSON {
  // Proportional scaling of scenes to match audio duration
  // Last scene adjustment for precision
  return { audioDurationSec, scenes };
}
```

**Target state after this story:**

```typescript
export function generateTimeline(
  sceneMappings: SceneMapping[],
  audioDurationSec: number,
  options?: { fps?: number; targetDuration?: '30s' | '1min' | '5min' | '8min' | 'auto' }
): TimelineJSON {
  const fps = options?.fps ?? 30;
  const totalDurationFrames = Math.ceil(audioDurationSec * fps);
  // ... existing proportional scaling logic unchanged ...
  return {
    audioDurationSec,
    totalDurationFrames,
    targetDuration: options?.targetDuration,
    scenes
  };
}
```

### Downstream Consumers (DO NOT BREAK)

1. **TechExplainer.tsx** (`apps/video-studio/src/compositions/TechExplainer.tsx`):
   - Reads `timeline.scenes` and `timeline.audioDurationSec`
   - Converts `startTime * fps` to frame offsets, `duration * fps` to frame counts
   - Adding new fields does NOT break this (TypeScript structural typing)

2. **Render Service** (`apps/render-service/src/render.ts`):
   - Downloads timeline JSON from GCS, passes as props to TechExplainer
   - Adding new fields does NOT break this (JSON passthrough)

3. **Visual-gen pipeline** (`packages/visual-gen/src/visual-gen.ts`):
   - Calls `generateTimeline()` - signature change uses optional param, backward compatible

### Previous Story Intelligence (Story 6-31)

- Component-level work in video-studio, not relevant to visual-gen types
- Pattern: tests mock Remotion hooks, use `vi.mock('remotion', ...)`
- Frame safety guards: `safeFps = fps > 0 ? fps : 30`
- Story 6-31 confirmed `COMPONENT_MAP` in TechExplainer works with TimelineJSON scenes

### Git Intelligence

Recent commits are all Epic 6 B-Roll engine and video-studio component work (stories 6-27 through 6-31). This story shifts focus to the visual-gen package types and timeline generation - a different area from recent work.

### Scope Boundaries

- DO NOT modify TechExplainer.tsx (that's Story 6-34's scope)
- DO NOT modify render-service (downstream consumer, unaffected by additive type changes)
- DO NOT implement word-timing-based scene duration calculation (that's Story 6-33's scope)
- This story ONLY adds the new fields to the interface and populates them in generateTimeline()

### Project Structure Notes

- Package: `packages/visual-gen/` (monorepo workspace package)
- Build: `pnpm build` from root uses Turborepo
- Test: `pnpm test` from root, or `pnpm --filter @nexus-ai/visual-gen test`
- Naming: kebab-case files, PascalCase interfaces, camelCase functions

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.32]
- [Source: packages/visual-gen/src/types.ts - TimelineJSON interface]
- [Source: packages/visual-gen/src/timeline.ts - generateTimeline function]
- [Source: packages/visual-gen/src/visual-gen.ts - executeVisualGen pipeline]
- [Source: apps/video-studio/src/compositions/TechExplainer.tsx - Timeline consumer]
- [Source: _bmad-output/project-context.md - Project rules and conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Added `totalDurationFrames: number` and `targetDuration?: '30s' | '1min' | '5min' | '8min' | 'auto'` to `TimelineJSON` interface
- Updated `generateTimeline()` to accept optional `options` parameter with `fps` (default 30) and `targetDuration`
- `totalDurationFrames` computed as `Math.ceil(audioDurationSec * fps)`
- `targetDuration` is passed through from options (undefined when not provided)
- Both empty scene and populated scene return paths include new fields
- Existing call site in `executeVisualGen()` is backward compatible (optional 3rd param)
- Added 7 new tests covering: default fps calculation, custom fps, targetDuration undefined, targetDuration pass-through, empty scenes, fractional ceil behavior, JSON serialization
- All 12 existing timeline tests continue to pass (no regressions)
- Build passes cleanly (18/18 tasks successful)
- 2 pre-existing failures in scene-mapper.test.ts (TextOnGradient→LowerThird rename from prior story) - not related to this story

### Change Log

- 2026-01-28: Implemented Story 6-32 - Added dynamic duration fields to TimelineJSON and generateTimeline()
- 2026-01-28: Code review - Fixed fps input validation (guard against zero/negative), corrected Task 3 descriptions, added 2 tests (serialization of undefined targetDuration, fps guard)

### File List

- packages/visual-gen/src/types.ts (modified - added totalDurationFrames, targetDuration to TimelineJSON)
- packages/visual-gen/src/timeline.ts (modified - added options parameter, totalDurationFrames calculation, targetDuration pass-through, fps guard)
- packages/visual-gen/src/__tests__/timeline.test.ts (modified - added 9 tests for dynamic duration fields)

## Senior Developer Review (AI)

### Review Date: 2026-01-28

### Reviewer: Claude Opus 4.5

### Findings

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| H1 | HIGH | Task 3.1/3.2 marked [x] but executeVisualGen() not modified — corrected task descriptions to reflect intentional backward-compatible default usage | FIXED |
| M1 | MEDIUM | No input validation for fps parameter (0 or negative accepted) — added guard: falls back to 30 for invalid fps | FIXED |
| L1 | LOW | Missing test for undefined targetDuration in serialized JSON — added test | FIXED |
| L2 | LOW | Missing test for fps guard behavior — added test | FIXED |

### Outcome: APPROVED

All HIGH and MEDIUM issues fixed. 4 issues total resolved. Build 18/18 passing. All 21 timeline tests passing. 2 pre-existing scene-mapper failures unrelated to this story.
