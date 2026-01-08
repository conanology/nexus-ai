# Story 3.3: Create Visual Generation Package

Status: done

## Story

As a developer,
I want a visual generation package with scene mapping,
So that scripts are converted to visual timelines.

## Acceptance Criteria

1. **Given** script with visual cues from Epic 2
   **When** I create the `@nexus-ai/visual-gen` package
   **Then** package structure follows architecture:
   - `src/index.ts` exports public API
   - `src/types.ts` defines visual-specific types
   - `src/visual-gen.ts` for main stage logic
   - `src/scene-mapper.ts` for cue-to-template mapping
   - `src/timeline.ts` for timeline generation

2. **And** `SceneMapper` class per FR18:
   - Parses `[VISUAL: description]` cues from script
   - Maps descriptions to Remotion component names
   - Uses keyword matching and LLM fallback for ambiguous cues
   - Returns `SceneMapping[]` with component, props, duration

3. **And** visual cue types supported:
   - `neural network` → NeuralNetworkAnimation
   - `data flow` → DataFlowDiagram
   - `comparison` → ComparisonChart
   - `metrics` → MetricsCounter
   - `product mockup` → ProductMockup
   - `code block` → CodeHighlight
   - `transition` → BrandedTransition

4. **And** `generateTimeline()` per FR19:
   - Creates scene timeline JSON with timing
   - Aligns scenes to audio duration
   - Ensures scene change every ~30 seconds
   - Outputs timeline to `{date}/visual-gen/scenes.json`

## Tasks / Subtasks

- [x] Task 1: Create @nexus-ai/visual-gen package (AC: #1)
  - [x] Create package structure
  - [x] Set up exports

- [x] Task 2: Implement cue parsing
  - [x] Parse [VISUAL: ...] markers from script
  - [x] Extract description text
  - [x] Track position in script

- [x] Task 3: Implement SceneMapper (AC: #2, #3)
  - [x] Create keyword-to-component mapping
  - [x] Implement pattern matching
  - [x] Add LLM fallback for ambiguous
  - [x] Return SceneMapping array

- [x] Task 4: Implement generateTimeline (AC: #4)
  - [x] Calculate scene durations
  - [x] Align to audio duration
  - [x] Ensure ~30s scene changes
  - [x] Output JSON timeline

## Dev Notes

### Package Structure

```
packages/visual-gen/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── cue-parser.ts
    ├── scene-mapper.ts
    ├── timeline.ts
    └── visual-gen.ts
```

### Component Mapping

```typescript
const COMPONENT_MAP: Record<string, string> = {
  'neural network': 'NeuralNetworkAnimation',
  'data flow': 'DataFlowDiagram',
  'comparison': 'ComparisonChart',
  'chart': 'ComparisonChart',
  'metrics': 'MetricsCounter',
  'counter': 'MetricsCounter',
  'mockup': 'ProductMockup',
  'product': 'ProductMockup',
  'code': 'CodeHighlight',
  'transition': 'BrandedTransition',
};
```

### Timeline JSON Structure

```json
{
  "totalDuration": 480,
  "scenes": [
    {
      "id": "scene-1",
      "component": "NeuralNetworkAnimation",
      "startTime": 0,
      "duration": 30,
      "props": { "layers": 4 }
    }
  ]
}
```

### Scene Duration Rules

- Target: ~30 seconds per scene
- Minimum: 15 seconds
- Maximum: 60 seconds
- Total must match audio duration

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created @nexus-ai/visual-gen package
- Implemented cue parser for [VISUAL: ...] markers
- SceneMapper with keyword matching and component mapping
- Timeline generation with 30s target scene duration
- Outputs scenes.json with timing aligned to audio
- LLM fallback for ambiguous cue descriptions

### File List

**Created/Modified:**
- `nexus-ai/packages/visual-gen/package.json`
- `nexus-ai/packages/visual-gen/tsconfig.json`
- `nexus-ai/packages/visual-gen/src/types.ts`
- `nexus-ai/packages/visual-gen/src/cue-parser.ts`
- `nexus-ai/packages/visual-gen/src/scene-mapper.ts`
- `nexus-ai/packages/visual-gen/src/timeline.ts`
- `nexus-ai/packages/visual-gen/src/visual-gen.ts`
- `nexus-ai/packages/visual-gen/src/index.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.10 (Script with visual cues)
- **Downstream Dependencies:** Story 3.4 (Remotion), Story 3.5 (Fallbacks)
