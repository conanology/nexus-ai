# Story 3.5: Implement Visual Fallbacks

Status: done

## Story

As a developer,
I want fallback visuals when templates are unavailable,
So that videos always render successfully.

## Acceptance Criteria

1. **Given** Remotion components from Story 3.4
   **When** I implement visual fallbacks per FR21
   **Then** `TextOnGradient` fallback component is created:
   - Displays key text from visual cue
   - Uses NEXUS brand gradient background
   - Animates text entrance/exit
   - Works for any visual cue type

2. **And** scene mapper fallback logic:
   - If no template matches cue, use `TextOnGradient`
   - Log warning with unmapped cue for future template creation
   - Include cue text as component prop

3. **And** fallback tracking in quality metrics:
   - Count of scenes using fallback
   - Percentage of fallback usage
   - If >30% fallback, flag as DEGRADED quality

4. **And** `executeVisualGen()` stage function:
   1. Parse visual cues from script
   2. Map to components (with fallbacks)
   3. Generate timeline JSON
   4. Store timeline and track quality
   5. Return `StageOutput` with timeline artifact

## Tasks / Subtasks

- [x] Task 1: Create TextOnGradient component (AC: #1)
  - [x] Accept text prop from visual cue
  - [x] NEXUS brand gradient background
  - [x] Animate text entrance/exit
  - [x] Handle any cue type

- [x] Task 2: Implement fallback logic (AC: #2)
  - [x] Check if component exists
  - [x] Use TextOnGradient if not
  - [x] Log warning for unmapped cues
  - [x] Pass cue text as prop

- [x] Task 3: Implement fallback tracking (AC: #3)
  - [x] Count fallback scenes
  - [x] Calculate percentage
  - [x] Flag DEGRADED if >30%

- [x] Task 4: Create executeVisualGen stage (AC: #4)
  - [x] Parse visual cues
  - [x] Map to components
  - [x] Generate timeline
  - [x] Store to Cloud Storage
  - [x] Return StageOutput

## Dev Notes

### TextOnGradient Component

```typescript
interface TextOnGradientProps {
  text: string;
  duration: number;
}

// Displays text over animated gradient
// Entrance: fade + scale up
// Exit: fade + scale down
```

### NEXUS Gradient

```css
background: linear-gradient(
  135deg,
  #6366F1 0%,   /* Primary indigo */
  #EC4899 50%,  /* Secondary pink */
  #22D3EE 100%  /* Accent cyan */
);
```

### Fallback Decision Flow

```
1. Parse [VISUAL: description]
2. Try keyword matching
3. If match → use component
4. If no match → try LLM classification
5. If still no match → use TextOnGradient
6. Log warning with unmapped cue
```

### Quality Thresholds

| Fallback % | Status |
|------------|--------|
| 0-10% | PASS |
| 10-30% | WARN |
| >30% | DEGRADED |

### Stage Output

```typescript
interface VisualGenOutput {
  timeline: SceneTimeline;
  timelineUrl: string;
  metrics: {
    totalScenes: number;
    fallbackScenes: number;
    fallbackPercentage: number;
  };
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created TextOnGradient fallback component
- NEXUS gradient background with text animation
- Fallback logic in scene mapper
- Logs warnings for unmapped cues
- Fallback tracking with percentage calculation
- DEGRADED if >30% fallback
- executeVisualGen stage function complete

### File List

**Created/Modified:**
- `nexus-ai/apps/video-studio/src/components/TextOnGradient.tsx`
- `nexus-ai/packages/visual-gen/src/scene-mapper.ts` (fallback logic)
- `nexus-ai/packages/visual-gen/src/visual-gen.ts` (stage function)

### Dependencies

- **Upstream Dependencies:** Story 3.4 (Remotion Components)
- **Downstream Dependencies:** Story 3.6 (Render Service)
