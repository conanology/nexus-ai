# Story 3.5: Implement Visual Fallbacks

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want fallback visuals when templates are unavailable,
so that videos always render successfully.

## Acceptance Criteria

1.  **Given** Remotion components from Story 3.4
    **When** I implement visual fallbacks per FR21
    **Then** `TextOnGradient` fallback component is created:
    -   Displays key text from visual cue
    -   Uses NEXUS brand gradient background
    -   Animates text entrance/exit
    -   Works for any visual cue type

2.  **And** scene mapper fallback logic:
    -   If no template matches cue, use `TextOnGradient`
    -   Log warning with unmapped cue for future template creation
    -   Include cue text as component prop

3.  **And** fallback tracking in quality metrics:
    -   Count of scenes using fallback
    -   Percentage of fallback usage
    -   If >30% fallback, flag as DEGRADED quality

4.  **And** `executeVisualGen()` stage function:
    -   Parse visual cues from script
    -   Map to components (with fallbacks)
    -   Generate timeline JSON
    -   Store timeline and track quality
    -   Return `StageOutput` with timeline artifact

## Tasks / Subtasks

- [x] Task 1: Create `TextOnGradient` Component (AC: 1)
  - [x] Implement `apps/video-studio/src/components/TextOnGradient.tsx`
  - [x] Add branded gradient background (Theme)
  - [x] Add text entrance/exit animations using Remotion hooks
  - [x] Export from `apps/video-studio/src/components/index.ts`
- [x] Task 2: Update `SceneMapper` Logic (AC: 2)
  - [x] Modify `packages/visual-gen/src/scene-mapper.ts`
  - [x] Add fallback to `TextOnGradient` when no match found for visual cue
  - [x] Ensure cue text is passed as `text` prop to the component
  - [x] Log warning `[VisualGen] Unmapped cue: ${cue}`
- [x] Task 3: Implement Quality Tracking (AC: 3, 4)
  - [x] Update `packages/visual-gen/src/visual-gen.ts` to track fallback count/percentage
  - [x] Implement `DEGRADED` status logic if >30% scenes use fallback
  - [x] Include unmapped cues in `warnings` array of `StageOutput`
- [x] Task 4: Testing
  - [x] Unit test for `TextOnGradient` rendering
  - [x] Integration test for `SceneMapper` verifying fallback behavior with unknown cues

## Dev Notes

### Relevant Architecture Patterns and Constraints

-   **Quality Gate:** Visual generation must not fail. Fallbacks are preferred over crashes, but excessive fallbacks (>30%) result in `DEGRADED` status.
-   **Component Library:** `TextOnGradient` joins the existing library in `apps/video-studio`.
-   **Logging:** Use `logger.warn()` for unmapped cues to help refine the template library later.
-   **Types:** Ensure `SceneMapping` type supports the fallback component and props.
-   **Remotion:** Ensure animations are frame-independent and use `useCurrentFrame`, `interpolate`, etc.

### Source Tree Components to Touch

-   `apps/video-studio/src/components/TextOnGradient.tsx` (New)
-   `apps/video-studio/src/components/index.ts`
-   `packages/visual-gen/src/scene-mapper.ts`
-   `packages/visual-gen/src/visual-gen.ts`
-   `packages/visual-gen/src/types.ts` (if needed for QualityMetrics)

### Project Structure Notes

-   **Alignment:** Follows the `apps/` vs `packages/` separation. Components in `apps/video-studio`, logic in `packages/visual-gen`.
-   **Naming:** `TextOnGradient.tsx` (PascalCase).
-   **Theme:** Use `apps/video-studio/src/theme.ts` for gradient colors.

### References

-   [Architecture Decision 3.5: Visual Fallbacks](_bmad-output/planning-artifacts/architecture.md#story-35-implement-visual-fallbacks)
-   [Remotion 4.x Docs](https://www.remotion.dev/docs)

## Dev Agent Record

### Agent Model Used

Opencode / Gemini 2.0 Flash

### Debug Log References

-   Checked `packages/visual-gen` structure: Exists.
-   Checked `apps/video-studio` components: `TextOnGradient` missing.

### Completion Notes List

-   ✅ Created TextOnGradient component with branded gradient background and entrance/exit animations
-   ✅ Implemented mapCueWithFallback method in SceneMapper that returns TextOnGradient for unmapped cues
-   ✅ Added logger.warn for unmapped cues to help identify missing templates
-   ✅ Updated visual-gen.ts to use mapCueWithFallback instead of mapCueWithLLMFallback
-   ✅ Implemented quality tracking with DEGRADED status when >30% scenes use fallback
-   ✅ All tests passing - TextOnGradient component tests and SceneMapper fallback tests
-   ✅ All acceptance criteria satisfied
-   ✅ Fallback mechanism ensures videos always render successfully (NFR1 - Reliability)
-   ✅ Fixed untracked file issue for TextOnGradient.tsx
-   ✅ Improved test coverage for TextOnGradient to verify rendered content
-   ✅ Enhanced SceneMapper to extract numeric data from visual cues

### File List

-   `apps/video-studio/src/components/TextOnGradient.tsx` (new)
-   `apps/video-studio/src/components/index.ts` (modified)
-   `apps/video-studio/src/types.ts` (modified)
-   `apps/video-studio/src/__tests__/components.test.tsx` (modified)
-   `packages/visual-gen/src/scene-mapper.ts` (modified)
-   `packages/visual-gen/src/visual-gen.ts` (modified)
-   `packages/visual-gen/src/types.ts` (modified)
-   `packages/visual-gen/src/__tests__/scene-mapper.test.ts` (modified)

## Change Log

-   **2026-01-18**: Implemented TextOnGradient fallback component with branded gradient, animations, and quality tracking. All acceptance criteria met.
