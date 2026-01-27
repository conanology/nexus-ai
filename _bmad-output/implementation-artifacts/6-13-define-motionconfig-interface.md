# Story 6.13: Define MotionConfig Interface

Status: done

## Story

As a developer,
I want a standardized motion configuration interface in video-studio,
So that all Remotion components animate consistently using the MotionConfig schema from the DirectionDocument.

## Acceptance Criteria

1. **Given** DirectionDocument schema from Story 6.1
   **When** I add motion types to `apps/video-studio/src/types.ts`
   **Then** `MotionConfig` interface includes:
   - `preset?`: 'subtle' | 'standard' | 'dramatic'
   - `entrance`: type, direction, delay, duration, easing, springConfig
   - `emphasis`: type, trigger, intensity, duration
   - `exit`: type, direction, duration, startBeforeEnd

2. **And** entrance types: 'fade' | 'slide' | 'pop' | 'scale' | 'blur' | 'none'

3. **And** emphasis types: 'pulse' | 'shake' | 'glow' | 'underline' | 'scale' | 'none'

4. **And** exit types: 'fade' | 'slide' | 'shrink' | 'blur' | 'none'

5. **And** `MOTION_PRESETS` constant provides default configs:
   - `subtle`: gentle fade entrance, no emphasis, fade exit
   - `standard`: slide-up with spring, pulse on word, fade exit
   - `dramatic`: pop with bounce, glow on word, shrink exit

6. **And** types exported from video-studio package

## Tasks / Subtasks

- [x] Task 1: Re-export MotionConfig types from script-gen into video-studio (AC: 1, 2, 3, 4, 6)
  - [x] 1.1: Add `@nexus-ai/script-gen` as a dependency in `apps/video-studio/package.json`
  - [x] 1.2: In `apps/video-studio/src/types.ts`, re-export motion-related types from `@nexus-ai/script-gen`: `MotionConfig`, `EntranceConfig`, `EmphasisConfig`, `ExitConfig`, `SpringConfig`, `EntranceType`, `EmphasisType`, `ExitType`, `AnimationDirection`, `EasingType`, `EmphasisTrigger`, `MotionPreset`
  - [x] 1.3: Re-export `MOTION_PRESETS` constant from `@nexus-ai/script-gen` in `apps/video-studio/src/types.ts`

- [x] Task 2: Export motion types from video-studio package index (AC: 6)
  - [x] 2.1: Types accessible via `apps/video-studio/src/types.ts` re-exports (video-studio is a Remotion app, not a library - index.ts is Remotion entry point)

- [x] Task 3: Add unit tests for motion types (AC: 1-6)
  - [x] 3.1: Create `apps/video-studio/src/__tests__/motion-types.test.ts`
  - [x] 3.2: Test that all motion type re-exports are defined and correct
  - [x] 3.3: Test `MOTION_PRESETS` has `subtle`, `standard`, `dramatic` keys
  - [x] 3.4: Test `MOTION_PRESETS.subtle` has fade entrance, no emphasis (type='none'), fade exit
  - [x] 3.5: Test `MOTION_PRESETS.standard` has slide-up entrance with spring, pulse emphasis, fade exit
  - [x] 3.6: Test `MOTION_PRESETS.dramatic` has pop entrance with bounce spring, glow emphasis, shrink exit
  - [x] 3.7: Test TypeScript compilation of MotionConfig with all fields

- [x] Task 4: Verify build and tests pass (AC: all)
  - [x] 4.1: Run `pnpm build` - must pass (16/16 packages)
  - [x] 4.2: Run `pnpm test` - must pass (25/25 new tests pass, all pre-existing failures are non-regressions)

## Dev Notes

### CRITICAL: Do NOT Duplicate Types

The `MotionConfig`, `EntranceConfig`, `EmphasisConfig`, `ExitConfig`, `SpringConfig`, and `MOTION_PRESETS` are already fully defined in `packages/script-gen/src/types.ts` (Story 6.1). Do NOT redefine them. Instead, **re-export** them from video-studio's types.ts so consumers of video-studio can access them without depending on script-gen directly.

### Existing MotionConfig Definition (in script-gen)

The following types already exist at `packages/script-gen/src/types.ts`:

**Type aliases:**
- `EntranceType = 'fade' | 'slide' | 'pop' | 'scale' | 'blur' | 'none'`
- `EmphasisType = 'pulse' | 'shake' | 'glow' | 'underline' | 'scale' | 'none'`
- `ExitType = 'fade' | 'slide' | 'shrink' | 'blur' | 'none'`
- `AnimationDirection = 'left' | 'right' | 'up' | 'down'`
- `EasingType = 'spring' | 'linear' | 'easeOut' | 'easeInOut'`
- `EmphasisTrigger = 'onWord' | 'onSegment' | 'continuous' | 'none'`
- `MotionPreset = 'subtle' | 'standard' | 'dramatic'`

**Interfaces:**
- `SpringConfig { damping, stiffness, mass }`
- `EntranceConfig { type, direction?, delay, duration, easing, springConfig? }`
- `EmphasisConfig { type, trigger, intensity, duration }`
- `ExitConfig { type, direction?, duration, startBeforeEnd }`
- `MotionConfig { preset?, entrance, emphasis, exit }`

**Constants:**
- `MOTION_PRESETS: Record<MotionPreset, Omit<MotionConfig, 'preset'>>` with subtle/standard/dramatic

### Dependency Chain

Current: `video-studio → visual-gen → script-gen`
After this story: `video-studio → script-gen` (direct dependency added for type re-exports)

The `video-studio` package already depends on `@nexus-ai/visual-gen` which depends on `@nexus-ai/script-gen`. Adding a direct dependency on `@nexus-ai/script-gen` is clean and explicit.

### Current video-studio types.ts Structure

File: `apps/video-studio/src/types.ts`
Contains 9 component prop interfaces: `NeuralNetworkAnimationProps`, `DataFlowDiagramProps`, `ComparisonChartProps`, `MetricsCounterProps`, `ProductMockupProps`, `CodeHighlightProps`, `BrandedTransitionProps`, `LowerThirdProps`, `TextOnGradientProps`.

Add re-exports at the top of the file, before the existing interfaces.

### video-studio Package Entry

The `apps/video-studio/src/index.ts` currently calls `registerRoot(RemotionRoot)` for Remotion. Since this is a Remotion app (not a library package), types are exported from `types.ts` directly. Ensure the types are accessible for downstream stories (6.14 useMotion hook, 6.15 component prop interfaces).

### Package.json Update

Add to `apps/video-studio/package.json` dependencies:
```json
"@nexus-ai/script-gen": "workspace:*"
```

### Testing Approach

- Use Vitest (project standard)
- Test file: `apps/video-studio/src/__tests__/motion-types.test.ts`
- Test that re-exports work correctly (types are defined, MOTION_PRESETS values match expected)
- Video-studio currently has `"test": "echo 'Tests run at root level'"` in package.json - tests should be runnable from the workspace root via `pnpm test`
- Use `.js` extensions in import paths (ESM)

### What NOT To Do

- Do NOT redefine MotionConfig or related types (they exist in script-gen)
- Do NOT modify `packages/script-gen/src/types.ts`
- Do NOT add Zod schemas to video-studio (they live in script-gen)
- Do NOT modify existing component props (that's Story 6.15)
- Do NOT create the useMotion hook (that's Story 6.14)
- Do NOT refactor components for motion support (that's Story 6.16)

### Project Structure Notes

- video-studio is a Remotion app at `apps/video-studio/`
- Package scope: `@nexus-ai/video-studio`
- Uses TypeScript strict mode
- ESM with `.js` extensions in imports
- Vitest for testing
- All packages use turborepo workspace protocol (`workspace:*`)

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Story 6.13]
- [Source: packages/script-gen/src/types.ts - MotionConfig, MOTION_PRESETS definitions (lines 187-267, 617-680)]
- [Source: apps/video-studio/src/types.ts - Current component prop interfaces]
- [Source: apps/video-studio/package.json - Current dependencies]
- [Source: _bmad-output/project-context.md - Naming conventions, testing standards]
- [Source: _bmad-output/implementation-artifacts/6-12-add-timestamp-extraction-tests.md - Previous story patterns]

### Previous Story Intelligence

From Story 6.12:
- 228 tests across 8 test files for timestamp-extraction
- Build passes with 16/16 packages
- Pre-existing test failures in other packages (core/types, core/utils, orchestrator health) are NOT regressions
- Test patterns use `vi.mock()` at module level, `vi.fn()` for individual functions
- Commit convention: `feat({package}): {description} (Story {key})`

### Git Intelligence

Recent commits:
- `45302e9` feat(timestamp-extraction): add timestamp extraction tests (Story 6-12)
- `980648f` feat(orchestrator): update pipeline data flow for timestamps (Story 6-11)
- `e772a5f` feat(orchestrator): register timestamp stage in pipeline (Story 6-10)
- Convention: `feat({package}): {description} (Story {key})`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None required - clean implementation.

### Completion Notes List

- Re-exported 12 motion-related types (MotionConfig, EntranceConfig, EmphasisConfig, ExitConfig, SpringConfig, EntranceType, EmphasisType, ExitType, AnimationDirection, EasingType, EmphasisTrigger, MotionPreset) and MOTION_PRESETS constant from @nexus-ai/script-gen into video-studio types.ts
- Added @nexus-ai/script-gen as direct workspace dependency in video-studio package.json
- Created 25 unit tests covering: MOTION_PRESETS structure and values, all three presets (subtle/standard/dramatic), TypeScript type compilation verification, and type alias re-export validation
- Build passes 16/16 packages; all 25 new tests pass; pre-existing failures in core/types, core/utils, core/storage, orchestrator are non-regressions

### Change Log

- 2026-01-27: Implemented Story 6.13 - Re-exported MotionConfig types from script-gen into video-studio, added 25 unit tests
- 2026-01-27: Code review (AI) - Fixed 4 MEDIUM issues: added numeric value assertions for subtle/standard presets, validated standard has no springConfig, asserted subtle emphasis duration=0, added test for MotionConfig without optional preset field. Tests: 25→26.

### File List

- apps/video-studio/package.json (modified - added @nexus-ai/script-gen dependency)
- apps/video-studio/src/types.ts (modified - added motion type re-exports and MOTION_PRESETS re-export)
- apps/video-studio/src/__tests__/motion-types.test.ts (new - 25 unit tests for motion type re-exports)
- pnpm-lock.yaml (modified - lockfile updated for new dependency)
