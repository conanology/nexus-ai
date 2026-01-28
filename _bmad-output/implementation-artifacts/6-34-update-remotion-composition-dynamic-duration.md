# Story 6.34: Update Remotion Composition for Dynamic Duration

Status: done

## Story

As a developer,
I want Remotion composition duration set from timeline,
so that video length matches audio content.

## Acceptance Criteria

1. **AC1**: `Root.tsx` uses `calculateMetadata` on `<Composition>` to resolve `durationInFrames` dynamically from `props.timeline.totalDurationFrames` or `Math.ceil(props.audioDurationSec * 30)` as fallback.
2. **AC2**: `defaultProps` uses a default 5-minute duration (9000 frames at 30fps) for local Remotion Studio preview/development.
3. **AC3**: When render service calls `selectComposition` with `inputProps` containing a timeline, `calculateMetadata` returns the correct `durationInFrames` from `timeline.totalDurationFrames`.
4. **AC4**: When timeline lacks `totalDurationFrames`, falls back to `Math.ceil(audioDurationSec * 30)`.
5. **AC5**: Existing render service flow (`selectComposition` + `renderMedia` in `apps/render-service/src/render.ts`) continues to work without changes — `selectComposition` already uses `inputProps`, so `calculateMetadata` will automatically resolve.
6. **AC6**: Unit tests verify `calculateMetadata` returns correct duration for: timeline with `totalDurationFrames`, timeline without `totalDurationFrames` (fallback to `audioDurationSec`), and default props (5-minute preview).
7. **AC7**: `pnpm build` and `pnpm test` pass.

## Tasks / Subtasks

- [x] Task 1: Update `apps/video-studio/src/Root.tsx` (AC: 1, 2, 3, 4)
  - [x] 1.1: Add `calculateMetadata` callback to `<Composition>` that reads `props.timeline.totalDurationFrames` or falls back to `Math.ceil(props.audioDurationSec * 30)`
  - [x] 1.2: Update `defaultProps` sample timeline to include `totalDurationFrames` field (or keep omitted to test fallback)
  - [x] 1.3: Set static `durationInFrames` to 9000 (5 min at 30fps) as Remotion Studio preview default
- [x] Task 2: Add/update tests (AC: 6)
  - [x] 2.1: Test `calculateMetadata` with timeline containing `totalDurationFrames`
  - [x] 2.2: Test `calculateMetadata` with timeline missing `totalDurationFrames` (fallback to `audioDurationSec * fps`)
  - [x] 2.3: Test default static duration is 9000 frames (5 min preview)
- [x] Task 3: Verify render service compatibility (AC: 5)
  - [x] 3.1: Confirm `selectComposition` in `apps/render-service/src/render.ts` passes `inputProps` — this already works, `calculateMetadata` will automatically resolve
- [x] Task 4: Build and test (AC: 7)
  - [x] 4.1: Run `pnpm build` — must pass
  - [x] 4.2: Run `pnpm test` — must pass

## Dev Notes

### Key Implementation Details

**File to modify**: `apps/video-studio/src/Root.tsx`

Current state: The `<Composition>` has `durationInFrames={900}` (30 sec hardcoded). This must become dynamic via `calculateMetadata`.

**Remotion `calculateMetadata` API** (Remotion 4.x):
```typescript
<Composition
  id="TechExplainer"
  component={TechExplainer}
  durationInFrames={9000}  // Default for Remotion Studio preview (5 min)
  fps={30}
  width={1920}
  height={1080}
  defaultProps={defaultProps}
  calculateMetadata={async ({ props }) => {
    // Priority: totalDurationFrames from timeline > audioDurationSec * fps
    const fps = 30;
    if (props.timeline?.totalDurationFrames && props.timeline.totalDurationFrames > 0) {
      return { durationInFrames: props.timeline.totalDurationFrames };
    }
    const audioDuration = props.timeline?.audioDurationSec ?? props.directionDocument?.audioDurationSec ?? 300;
    return { durationInFrames: Math.ceil(audioDuration * fps) };
  }}
/>
```

**Why this works with the render service**: `apps/render-service/src/render.ts:105-112` already passes `inputProps` to `selectComposition`. When `calculateMetadata` is defined on the Composition, Remotion's `selectComposition` calls it with the provided `inputProps`, overriding the static `durationInFrames`. No render service changes needed.

**TimelineJSON already has `totalDurationFrames`**: The `generateTimeline` function in `packages/visual-gen/src/timeline.ts` already computes `totalDurationFrames: Math.ceil(audioDurationSec * fps)` and includes it in the TimelineJSON output. This field is already available in production timelines.

### Existing Patterns (from recent stories)

- Story 6-32 added `totalDurationFrames` to TimelineJSON
- Story 6-33 updated scene duration calculation to be frame-accurate
- Both use `Math.ceil(audioDurationSec * fps)` pattern for frame calculation

### Testing Approach

Test file: `apps/video-studio/src/__tests__/Root.test.tsx` (new) or add to existing `TechExplainer.test.tsx`

Since `calculateMetadata` is an async function passed to `<Composition>`, test it as a standalone function:
- Extract the metadata calculation logic into a named function (e.g., `calculateTechExplainerMetadata`)
- Export it for direct testing
- Test with various input combinations

### Project Structure Notes

- Only `apps/video-studio/src/Root.tsx` needs changes
- No changes needed to render service, visual-gen, or any other package
- `calculateMetadata` is a Remotion 4.x feature — already in the project's dependency range

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.34]
- [Source: apps/video-studio/src/Root.tsx] — current Composition registration
- [Source: apps/render-service/src/render.ts:105-112] — selectComposition usage
- [Source: packages/visual-gen/src/timeline.ts] — totalDurationFrames generation
- [Source: Remotion docs calculateMetadata](https://www.remotion.dev/docs/composition#calculatemetadata)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Exported `calculateTechExplainerMetadata` function from Root.tsx for dynamic duration resolution
- Priority chain: `timeline.totalDurationFrames` > `Math.ceil(audioDurationSec * 30)` > `directionDocument.audioDurationSec * 30` > 9000 frames (5-min default)
- Changed static `durationInFrames` from 900 (30s) to 9000 (5 min) for Remotion Studio preview
- Added `calculateMetadata` prop to `<Composition>` using Remotion 4.x API
- Created 7 unit tests covering all duration resolution paths
- Render service compatibility verified: `selectComposition` already passes `inputProps`, `calculateMetadata` resolves automatically
- All 34 video-studio tests pass (7 new + 27 existing), no regressions
- Build passes clean

### Change Log

- 2026-01-28: Implemented dynamic duration via calculateMetadata (Story 6-34)
- 2026-01-28: Code review fixes — added totalDurationFrames to TimelineSchema, removed unsafe Record casts, fixed directionDocument to use metadata.estimatedDurationSec, added totalDurationFrames to sampleTimeline

### File List

- `apps/video-studio/src/Root.tsx` (modified) — Added calculateTechExplainerMetadata function, calculateMetadata prop, updated durationInFrames to 9000, removed unsafe type casts, added totalDurationFrames to sampleTimeline
- `apps/video-studio/src/__tests__/Root.test.tsx` (new) — 7 unit tests for calculateTechExplainerMetadata, updated directionDocument test to use proper schema shape
- `apps/video-studio/src/compositions/TechExplainer.tsx` (modified) — Added totalDurationFrames optional field to TimelineSchema
