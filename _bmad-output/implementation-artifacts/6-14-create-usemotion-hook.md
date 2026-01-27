# Story 6.14: Create useMotion Hook

Status: done

## Story

As a developer,
I want a shared hook for motion calculations,
so that animation logic is consistent across components.

## Acceptance Criteria

1. **Given** MotionConfig interface from Story 6.13
   **When** I create `apps/video-studio/src/hooks/useMotion.ts`
   **Then** hook signature is:
   ```typescript
   function useMotion(
     config: MotionConfig | undefined,
     segmentDurationFrames: number
   ): MotionStyles
   ```

2. **And** hook returns:
   - `entranceStyle`: { opacity, transform } for entrance animation
   - `emphasisStyle`: { filter, transform } for emphasis effect
   - `exitStyle`: { opacity, transform } for exit animation
   - `isEntering`: boolean (in entrance phase)
   - `isExiting`: boolean (in exit phase)

3. **And** hook uses `useCurrentFrame()` and `useVideoConfig()` internally

4. **And** hook applies `MOTION_PRESETS` when `config.preset` is set

5. **And** hook returns neutral styles (opacity: 1, transform: 'none') when config is undefined

6. **And** entrance uses `spring()` or `interpolate()` based on easing config

7. **And** exit starts at `segmentDurationFrames - config.exit.startBeforeEnd`

## Tasks / Subtasks

- [x] Task 1: Define MotionStyles return type interface (AC: 1, 2)
  - [x] 1.1: Create `apps/video-studio/src/hooks/useMotion.ts` with `MotionStyles` interface containing `entranceStyle`, `emphasisStyle`, `exitStyle`, `isEntering`, `isExiting`
  - [x] 1.2: Export `MotionStyles` from the hook file

- [x] Task 2: Implement useMotion hook core logic (AC: 1, 3, 5, 6, 7)
  - [x] 2.1: Import `useCurrentFrame`, `useVideoConfig`, `spring`, `interpolate` from `remotion`
  - [x] 2.2: Import `MotionConfig`, `MOTION_PRESETS` from `../types.js`
  - [x] 2.3: Return neutral styles when config is undefined (opacity: 1, transform: 'none', filter: 'none')
  - [x] 2.4: Resolve preset - if `config.preset` is set, merge `MOTION_PRESETS[config.preset]` with explicit overrides
  - [x] 2.5: Implement entrance animation logic:
    - Calculate entrance start frame = `config.entrance.delay`
    - Calculate entrance end frame = `config.entrance.delay + config.entrance.duration`
    - Use `spring()` when `config.entrance.easing === 'spring'` (pass `springConfig` if available)
    - Use `interpolate()` with appropriate easing for 'linear', 'easeOut', 'easeInOut'
    - Map entrance type to CSS transform: fade→opacity, slide→translateX/Y, pop→scale, scale→scale, blur→blur filter
  - [x] 2.6: Implement exit animation logic:
    - Calculate exit start frame = `segmentDurationFrames - config.exit.startBeforeEnd`
    - Map exit type to CSS: fade→opacity, slide→translateX/Y, shrink→scale, blur→blur filter
  - [x] 2.7: Implement emphasis animation logic:
    - Map emphasis type to CSS: pulse→scale transform, shake→translateX, glow→box-shadow/filter, underline→text-decoration, scale→scale transform
    - Apply intensity scaling (0-1)
  - [x] 2.8: Compute `isEntering` and `isExiting` booleans from frame position

- [x] Task 3: Create barrel export for hooks directory (AC: 1)
  - [x] 3.1: Create `apps/video-studio/src/hooks/index.ts` exporting `useMotion` and `MotionStyles`

- [x] Task 4: Write comprehensive unit tests (AC: 1-7)
  - [x] 4.1: Create `apps/video-studio/src/__tests__/useMotion.test.ts`
  - [x] 4.2: Test neutral styles returned when config is undefined
  - [x] 4.3: Test neutral styles returned when config is undefined (opacity: 1, transform: 'none')
  - [x] 4.4: Test entrance animation with fade type (opacity interpolation)
  - [x] 4.5: Test entrance animation with slide type (transform translate)
  - [x] 4.6: Test entrance animation with pop/scale type (transform scale)
  - [x] 4.7: Test entrance animation with blur type (filter blur)
  - [x] 4.8: Test entrance with spring easing uses `spring()` function
  - [x] 4.9: Test entrance with non-spring easing uses `interpolate()`
  - [x] 4.10: Test exit animation starts at `segmentDurationFrames - startBeforeEnd`
  - [x] 4.11: Test exit with fade type
  - [x] 4.12: Test exit with shrink type
  - [x] 4.13: Test emphasis with pulse type (scale transform)
  - [x] 4.14: Test emphasis with glow type (filter)
  - [x] 4.15: Test `isEntering` is true during entrance phase, false after
  - [x] 4.16: Test `isExiting` is true during exit phase, false before
  - [x] 4.17: Test preset resolution - `config.preset = 'subtle'` applies MOTION_PRESETS.subtle
  - [x] 4.18: Test preset resolution - `config.preset = 'dramatic'` applies MOTION_PRESETS.dramatic
  - [x] 4.19: Test preset with explicit overrides (explicit values override preset defaults)
  - [x] 4.20: Test entrance delay offsets animation start frame

- [x] Task 5: Verify build and tests pass (AC: all)
  - [x] 5.1: Run `pnpm build` - must pass (16/16 packages)
  - [x] 5.2: Run `pnpm test` - must pass (35 new tests pass, no regressions)

## Dev Notes

### CRITICAL: Remotion Hook Context

This is a React hook that depends on Remotion's rendering context. It MUST be called inside a Remotion composition (within `<Composition>` or `<Sequence>`). The hook uses:
- `useCurrentFrame()` - returns the current frame number in the sequence
- `useVideoConfig()` - returns `{ fps, width, height, durationInFrames }`

### MotionConfig Structure (from script-gen, re-exported in video-studio/types.ts)

```typescript
interface MotionConfig {
  preset?: 'subtle' | 'standard' | 'dramatic';
  entrance: {
    type: 'fade' | 'slide' | 'pop' | 'scale' | 'blur' | 'none';
    direction?: 'left' | 'right' | 'up' | 'down';
    delay: number;       // frames before animation starts
    duration: number;    // frames (default: 15 = 0.5s at 30fps)
    easing: 'spring' | 'linear' | 'easeOut' | 'easeInOut';
    springConfig?: { damping: number; stiffness: number; mass: number; };
  };
  emphasis: {
    type: 'pulse' | 'shake' | 'glow' | 'underline' | 'scale' | 'none';
    trigger: 'onWord' | 'onSegment' | 'continuous' | 'none';
    intensity: number;   // 0-1
    duration: number;    // frames per pulse
  };
  exit: {
    type: 'fade' | 'slide' | 'shrink' | 'blur' | 'none';
    direction?: 'left' | 'right' | 'up' | 'down';
    duration: number;    // frames
    startBeforeEnd: number; // frames before segment end
  };
}
```

### MOTION_PRESETS Values

- **subtle**: fade entrance (20 frames, easeOut), no emphasis, fade exit (15 frames, 10 frames before end)
- **standard**: slide-up entrance (15 frames, spring with damping:100, stiffness:200, mass:1), pulse emphasis (onWord, intensity:0.5, 10 frames), fade exit (15 frames, 10 frames before end)
- **dramatic**: pop entrance (20 frames, spring with damping:80, stiffness:300, mass:0.8), glow emphasis (onSegment, intensity:0.8, 15 frames), shrink exit (20 frames, 15 frames before end)

### MotionStyles Return Type

```typescript
interface MotionStyles {
  entranceStyle: {
    opacity: number;
    transform: string;
  };
  emphasisStyle: {
    filter: string;
    transform: string;
  };
  exitStyle: {
    opacity: number;
    transform: string;
  };
  isEntering: boolean;
  isExiting: boolean;
}
```

### Neutral Styles (when config is undefined)

```typescript
{
  entranceStyle: { opacity: 1, transform: 'none' },
  emphasisStyle: { filter: 'none', transform: 'none' },
  exitStyle: { opacity: 1, transform: 'none' },
  isEntering: false,
  isExiting: false,
}
```

### Animation Mapping Guide

**Entrance type → CSS:**
| Type | Opacity | Transform |
|------|---------|-----------|
| fade | 0→1 | none |
| slide | 1 | translateX/Y(offset→0) based on direction |
| pop | 0→1 | scale(0→1) |
| scale | 1 | scale(0→1) |
| blur | 0→1 | none (use filter: blur(px→0)) |
| none | 1 | none |

For `slide` direction mapping:
- left: translateX(-100%→0)
- right: translateX(100%→0)
- up: translateY(100%→0)
- down: translateY(-100%→0)

**Exit type → CSS:**
| Type | Opacity | Transform |
|------|---------|-----------|
| fade | 1→0 | none |
| slide | 1 | translateX/Y(0→offset) based on direction |
| shrink | 1→0 | scale(1→0) |
| blur | 1→0 | none (use filter: blur(0→px)) |
| none | 1 | none |

**Emphasis type → CSS:**
| Type | Filter | Transform |
|------|--------|-----------|
| pulse | none | scale(1→1+intensity*0.1→1) cyclic |
| shake | none | translateX(oscillate by intensity*5px) |
| glow | brightness(1+intensity*0.3) | none |
| underline | none | none (component handles text-decoration) |
| scale | none | scale(1+intensity*0.2) |
| none | none | none |

### Easing Strategy

- `spring`: Use Remotion's `spring({ frame: relativeFrame, fps, config: springConfig })` - returns 0→1 value
- `linear`: Use `interpolate(frame, [start, end], [0, 1])` with no extrapolation clamping
- `easeOut`: Use `interpolate()` with `{ easing: Easing.out(Easing.ease) }` from remotion
- `easeInOut`: Use `interpolate()` with `{ easing: Easing.inOut(Easing.ease) }` from remotion

**Note:** Remotion's `Easing` module provides standard easing functions. Import `Easing` from `remotion`.

### Testing Strategy

Use Vitest with mocked Remotion hooks. Since `useCurrentFrame()` and `useVideoConfig()` are React hooks, tests need to mock the `remotion` module:

```typescript
import { vi } from 'vitest';

// Mock remotion hooks
vi.mock('remotion', () => ({
  useCurrentFrame: vi.fn(),
  useVideoConfig: vi.fn(),
  spring: vi.fn(),
  interpolate: vi.fn(),
  Easing: { out: vi.fn(), inOut: vi.fn(), ease: vi.fn() },
}));
```

Alternatively, since this is a pure computation hook (frame in → styles out), you can test the computation logic directly by extracting the core calculation into a testable pure function that takes `frame`, `fps`, `config`, and `segmentDurationFrames` as parameters.

**Recommended approach**: Create a `computeMotionStyles(frame, fps, config, segmentDurationFrames)` pure function that the hook wraps. Test the pure function directly. The hook just calls `useCurrentFrame()`, `useVideoConfig()`, and delegates to this pure function.

### File Structure

```
apps/video-studio/src/
├── hooks/
│   ├── index.ts          (NEW - barrel export)
│   └── useMotion.ts      (NEW - hook + MotionStyles type)
├── __tests__/
│   └── useMotion.test.ts (NEW - comprehensive tests)
```

### ESM Import Convention

Use `.js` extensions in TypeScript imports (ESM):
```typescript
import { MotionConfig, MOTION_PRESETS } from '../types.js';
```

### What NOT To Do

- Do NOT modify existing component files (that's Story 6.16)
- Do NOT add motion props to component interfaces (that's Story 6.15)
- Do NOT modify `packages/script-gen/src/types.ts`
- Do NOT add new dependencies to package.json (remotion is already a dependency)
- Do NOT use console.log - use structured logger if logging needed
- Do NOT create a React component - this is a hook only
- Do NOT handle emphasis `trigger` logic (that's component-level, Story 6.17+)

### Existing Remotion Patterns in video-studio

Components import from `remotion`:
```typescript
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
```

All components use `useCurrentFrame()` for frame-based animation and `useVideoConfig()` for fps. The `spring()` function is used with `{ frame, fps, config: { damping: 100 } }` pattern.

### Project Structure Notes

- video-studio is a Remotion app at `apps/video-studio/`
- Package scope: `@nexus-ai/video-studio`
- Uses TypeScript strict mode
- ESM with `.js` extensions in imports
- Vitest for testing (run from workspace root)
- hooks directory does NOT exist yet - must be created

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Story 6.14]
- [Source: packages/script-gen/src/types.ts - MotionConfig, MOTION_PRESETS definitions (lines 201-268, 617-680)]
- [Source: apps/video-studio/src/types.ts - Re-exported motion types from Story 6.13]
- [Source: apps/video-studio/src/components/NeuralNetworkAnimation.tsx - Existing Remotion hook usage pattern]
- [Source: apps/video-studio/src/components/MetricsCounter.tsx - spring() and interpolate() usage]
- [Source: _bmad-output/project-context.md - Naming conventions, testing standards]
- [Source: _bmad-output/implementation-artifacts/6-13-define-motionconfig-interface.md - Previous story context]

### Previous Story Intelligence

From Story 6.13:
- MotionConfig types are re-exported from `@nexus-ai/script-gen` in `apps/video-studio/src/types.ts`
- `MOTION_PRESETS` constant is also re-exported (value export, not just type)
- `@nexus-ai/script-gen` was added as direct workspace dependency to video-studio
- 25 unit tests for motion types pass; build passes 16/16 packages
- Pre-existing test failures in core/types, core/utils, core/storage, orchestrator are NOT regressions

### Git Intelligence

Recent commits:
- `b2f7156` feat(video-studio): define MotionConfig interface (Story 6-13)
- `45302e9` feat(timestamp-extraction): add timestamp extraction tests (Story 6-12)
- Convention: `feat({package}): {description} (Story {key})`
- This story's commit: `feat(video-studio): create useMotion hook (Story 6-14)`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build initially failed with TS2345 (Record<string, unknown> incompatible with specific config interfaces) - fixed by changing generic constraint to `object`
- Build also flagged TS6133 unused variable in test - fixed by removing variable

### Completion Notes List

- Implemented `useMotion` hook with extracted `computeMotionStyles` pure function for testability (recommended approach from Dev Notes)
- Hook delegates to pure function after calling `useCurrentFrame()` and `useVideoConfig()` from Remotion
- All 6 entrance types mapped: fade, slide (4 directions), pop, scale, blur, none
- All 5 exit types mapped: fade, slide (4 directions), shrink, blur, none
- All 6 emphasis types mapped: pulse (cyclic scale), shake (oscillating translateX), glow (brightness filter), underline (component-handled), scale (static), none
- Preset resolution merges MOTION_PRESETS defaults with explicit overrides using `stripUndefined` helper
- Spring easing uses Remotion's `spring()` with `durationInFrames`; linear/easeOut/easeInOut use `interpolate()` with `Easing` module
- 35 comprehensive unit tests covering all ACs, all entrance/exit/emphasis types, spring vs interpolate easing, preset resolution, delay offsets, isEntering/isExiting flags
- Build passes 16/16 packages; all 35 new tests pass; no regressions in video-studio tests

### File List

- `apps/video-studio/src/hooks/useMotion.ts` (NEW) - useMotion hook, computeMotionStyles pure function, MotionStyles interface
- `apps/video-studio/src/hooks/index.ts` (NEW) - barrel export for hooks directory
- `apps/video-studio/src/__tests__/useMotion.test.ts` (NEW) - 35 comprehensive unit tests

### Change Log

- 2026-01-27: Implemented useMotion hook with computeMotionStyles pure function, MotionStyles interface, barrel export, and 35 unit tests. Build 16/16, tests 35/35 passing.
- 2026-01-27: Code review (adversarial) - 7 issues found (3H, 3M, 1L). Fixed: H1 (added filter field to entranceStyle for blur support), M1 (improved preset tests to validate merge behavior + added preset exit test), M2 (blur test now asserts blur-specific filter behavior). Downgraded: H2 (exit easing by-design), H3 (preset merge logic correct for TypeScript constraints), M3 (useMotion.ts naming follows React hook convention). Skipped: L1 (style preference). Build 16/16, 36 tests passing.
