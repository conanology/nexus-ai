# Story 6.15: Update Component Prop Interfaces

Status: done

## Story

As a developer,
I want motion prop added to all component interfaces,
so that components can receive animation configuration.

## Acceptance Criteria

1. **Given** useMotion hook from Story 6.14
   **When** I update `apps/video-studio/src/types.ts`
   **Then** all 8 component interfaces include `motion?: MotionConfig`:
   - `NeuralNetworkAnimationProps`
   - `DataFlowDiagramProps`
   - `ComparisonChartProps`
   - `MetricsCounterProps`
   - `ProductMockupProps`
   - `CodeHighlightProps`
   - `BrandedTransitionProps`
   - `LowerThirdProps`

2. **And** motion prop is optional (backward compatible)

3. **And** `TextOnGradientProps` (fallback component) also includes motion

4. **And** types compile with strict mode (`pnpm build` passes)

## Tasks / Subtasks

- [x] Task 1: Add `motion?: MotionConfig` to all 9 component prop interfaces (AC: 1, 2, 3)
  - [x] 1.1: Add `motion?: MotionConfig` to `NeuralNetworkAnimationProps`
  - [x] 1.2: Add `motion?: MotionConfig` to `DataFlowDiagramProps`
  - [x] 1.3: Add `motion?: MotionConfig` to `ComparisonChartProps`
  - [x] 1.4: Add `motion?: MotionConfig` to `MetricsCounterProps`
  - [x] 1.5: Add `motion?: MotionConfig` to `ProductMockupProps`
  - [x] 1.6: Add `motion?: MotionConfig` to `CodeHighlightProps`
  - [x] 1.7: Add `motion?: MotionConfig` to `BrandedTransitionProps`
  - [x] 1.8: Add `motion?: MotionConfig` to `LowerThirdProps`
  - [x] 1.9: Add `motion?: MotionConfig` to `TextOnGradientProps`

- [x] Task 2: Write unit tests for updated interfaces (AC: 1, 2, 3, 4)
  - [x] 2.1: Create `apps/video-studio/src/__tests__/component-prop-interfaces.test.ts`
  - [x] 2.2: Test each interface accepts objects with `motion` property using MotionConfig
  - [x] 2.3: Test each interface accepts objects WITHOUT `motion` property (backward compat)
  - [x] 2.4: Test `motion` field accepts full MotionConfig with all sub-properties
  - [x] 2.5: Test `motion` field accepts preset-only config `{ preset: 'subtle' }`

- [x] Task 3: Verify build and tests pass (AC: 4)
  - [x] 3.1: Run `pnpm build` - must pass (16/16 packages)
  - [x] 3.2: Run `pnpm test` - must pass (no regressions)

## Dev Notes

### CRITICAL: This is a types-only change

This story modifies ONLY `apps/video-studio/src/types.ts`. Do NOT modify any component `.tsx` files - that is Story 6.16.

### File to Modify

**Single file:** `apps/video-studio/src/types.ts`

The file already imports `MotionConfig` (type re-export from `@nexus-ai/script-gen` added in Story 6.13):
```typescript
export type { MotionConfig, ... } from '@nexus-ai/script-gen';
```

Since `MotionConfig` is already exported as a type, you can use it directly in the interfaces in the same file. No new imports needed.

### All 9 Interfaces to Update

Each interface needs one line added: `motion?: MotionConfig;`

1. `NeuralNetworkAnimationProps` (line ~25)
2. `DataFlowDiagramProps` (line ~39)
3. `ComparisonChartProps` (line ~52)
4. `MetricsCounterProps` (line ~65)
5. `ProductMockupProps` (line ~80)
6. `CodeHighlightProps` (line ~93)
7. `BrandedTransitionProps` (line ~108)
8. `LowerThirdProps` (line ~119)
9. `TextOnGradientProps` (line ~132) - fallback component, also needs motion

### Backward Compatibility

The `motion` prop MUST be optional (`motion?: MotionConfig`). This ensures:
- All existing component usage continues working without changes
- No existing tests break
- `useMotion(undefined, ...)` returns neutral styles (verified in Story 6.14)

### Testing Approach

Write TypeScript compile-time type tests and runtime assertion tests:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  NeuralNetworkAnimationProps,
  DataFlowDiagramProps,
  // ... all 9 interfaces
  MotionConfig,
} from '../types.js';
import { MOTION_PRESETS } from '../types.js';

describe('Component prop interfaces include motion', () => {
  it('NeuralNetworkAnimationProps accepts motion config', () => {
    const props: NeuralNetworkAnimationProps = {
      title: 'Test',
      motion: MOTION_PRESETS.subtle,
    };
    expect(props.motion).toBeDefined();
  });

  it('NeuralNetworkAnimationProps works without motion (backward compat)', () => {
    const props: NeuralNetworkAnimationProps = { title: 'Test' };
    expect(props.motion).toBeUndefined();
  });
});
```

### ESM Import Convention

Use `.js` extensions in TypeScript imports:
```typescript
import type { MotionConfig } from '../types.js';
```

### What NOT To Do

- Do NOT modify any component `.tsx` files (Story 6.16)
- Do NOT import or call `useMotion` hook (Story 6.16)
- Do NOT add new dependencies to package.json
- Do NOT modify `packages/script-gen/src/types.ts`
- Do NOT use console.log
- Do NOT add non-motion-related fields to any interface

### Project Structure Notes

- video-studio is at `apps/video-studio/`
- Package scope: `@nexus-ai/video-studio`
- TypeScript strict mode
- ESM with `.js` extensions in imports
- Vitest for testing (run from workspace root with `pnpm test`)
- Tests go in `apps/video-studio/src/__tests__/`

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Story 6.15, lines 2404-2426]
- [Source: apps/video-studio/src/types.ts - Current 9 interfaces without motion prop]
- [Source: _bmad-output/implementation-artifacts/6-14-create-usemotion-hook.md - useMotion hook context]
- [Source: _bmad-output/implementation-artifacts/6-13-define-motionconfig-interface.md - MotionConfig type re-exports]
- [Source: _bmad-output/project-context.md - Naming conventions, testing standards]

### Previous Story Intelligence

From Story 6.14 (useMotion hook):
- `MotionConfig` and `MOTION_PRESETS` are re-exported from `@nexus-ai/script-gen` in `apps/video-studio/src/types.ts`
- `useMotion(config, segmentDurationFrames)` returns `MotionStyles` with entrance/emphasis/exit styles
- `useMotion(undefined, ...)` returns neutral styles (opacity: 1, transform: 'none')
- 36 tests passing in video-studio; build passes 16/16 packages
- Pre-existing test failures in core/types, core/utils, core/storage, orchestrator are NOT regressions

### Git Intelligence

Recent commits:
- `6146043` feat(video-studio): create useMotion hook (Story 6-14)
- `b2f7156` feat(video-studio): define MotionConfig interface (Story 6-13)
- Convention: `feat({package}): {description} (Story {key})`
- This story's commit: `feat(video-studio): update component prop interfaces (Story 6-15)`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript `export type` re-exports are not available as local references in the same file. Added `import type { MotionConfig as _MotionConfig }` to resolve.

### Completion Notes List

- Added `motion?: _MotionConfig` to all 9 component prop interfaces in `apps/video-studio/src/types.ts`
- Added `import type { MotionConfig as _MotionConfig }` for local use since `export type` re-exports aren't available within the same file
- Created 20 tests in `component-prop-interfaces.test.ts`: 2 per interface (with/without motion) + 2 full MotionConfig tests
- Build passes 16/16 packages; all video-studio tests pass (56 total including 20 new)
- Pre-existing failures in core/types, core/utils, core/storage, orchestrator are NOT regressions (confirmed from Story 6.14 notes)

### Senior Developer Review (AI)

**Reviewer:** Cryptology on 2026-01-28
**Result:** APPROVED (after fixes)
**Issues Found:** 1 High, 3 Medium, 2 Low
**Issues Fixed:** 4 (all HIGH and MEDIUM)

**Fixes Applied:**
1. [H1] Removed unsafe `as MotionConfig` type assertion in test - replaced with valid full config using spread of `MOTION_PRESETS.subtle` with `preset` field
2. [M1] Renamed misleading `_MotionConfig` import alias to direct `MotionConfig` import
3. [M2] Fixed documentation inconsistency - interfaces now use `MotionConfig` directly (matching docs)
4. [M3] Simplified import pattern - removed redundant aliased import, using direct `import type { MotionConfig }` alongside `export type` re-export

**Low Issues (not fixed - acceptable):**
- L1: Test `fullMotionConfig` values differ slightly from `MOTION_PRESETS.subtle` (intentional - tests different values)
- L2: Per-interface tests are boilerplate-heavy (acceptable for types-only story)

**Verification:** Build 16/16 passing, all 20 component-prop tests + 36 useMotion tests passing.

### Change Log

- 2026-01-28: Added `motion?: MotionConfig` to all 9 component prop interfaces (NeuralNetworkAnimationProps, DataFlowDiagramProps, ComparisonChartProps, MetricsCounterProps, ProductMockupProps, CodeHighlightProps, BrandedTransitionProps, LowerThirdProps, TextOnGradientProps). Created 20 unit tests for interface validation.
- 2026-01-28: Code review fixes - removed `_MotionConfig` alias, simplified import, fixed unsafe type assertion in test.

### File List

- `apps/video-studio/src/types.ts` (modified) - Added motion prop to all 9 interfaces, added local MotionConfig import
- `apps/video-studio/src/__tests__/component-prop-interfaces.test.ts` (new) - 20 tests for motion prop on all interfaces
