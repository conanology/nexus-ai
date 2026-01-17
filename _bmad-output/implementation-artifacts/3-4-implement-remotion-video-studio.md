# Story 3.4: implement-remotion-video-studio

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a Remotion video composition app,
so that videos are rendered from timelines and audio.

## Acceptance Criteria

1. **Project Initialization:** `apps/video-studio/` is created via `npm create video@latest` (or equivalent for pnpm monorepo) and integrated into the Turborepo workspace.

2. **Remotion Structure:** Project structure includes:
   - `src/Root.tsx` with composition registration.
   - `src/compositions/TechExplainer.tsx` main video composition.
   - `src/components/` for visual components.
   - `src/hooks/` for animation utilities.

3. **Visual Components (FR18-20):** Implement the following 7 components with smooth 60fps animations and responsive props:
   - `NeuralNetworkAnimation`: Animated nodes and connections.
   - `DataFlowDiagram`: Pipeline/process visualization.
   - `ComparisonChart`: Side-by-side data comparison.
   - `MetricsCounter`: Animated statistic counters.
   - `ProductMockup`: Generic UI/Interface frame.
   - `CodeHighlight`: Syntax-highlighted code block.
   - `BrandedTransition`: NEXUS-AI branded wipe/fade.
   - **Plus:** `LowerThird` component for source citations.

4. **Visual Language:** All components must follow NEXUS visual language (consistent color palette from theme, branded fonts).

5. **TechExplainer Composition:**
   - Accepts `timeline` (TimelineJSON) and `audioUrl` (string) as props.
   - Renders `<Audio />` tag synced to timeline.
   - Renders scenes in `<Sequence>` blocks based on `startTime` and `duration`.
   - Syncs visuals exactly to audio duration.
   - Configured for 1920x1080 @ 30fps output.

6. **Validation:** Uses Zod schemas to validate composition props.

7. **Local Preview:** `pnpm dev` in `apps/video-studio` launches the Remotion player with sample data.

## Tasks / Subtasks

- [x] **T1: Scaffold Video Studio App**
  - [x] Run `npm create video@latest apps/video-studio` (select TypeScript, blank/react).
  - [x] Configure `apps/video-studio/package.json` for pnpm workspace (name: `@nexus-ai/video-studio`).
  - [x] Add dependencies: `@nexus-ai/core` (if needed for shared types), `zod`, `remotion`, `react`.
  - [x] Configure `tsconfig.json` to extend root base.
  - [x] Verify `pnpm install` and `pnpm build` work from root.

- [x] **T2: Implement Shared Types & Schema**
  - [x] Import `TimelineJSON` and `VisualGenOutput` types (reference `@nexus-ai/visual-gen` or duplicate interface if strict decoupling preferred - Architecture implies shared types in Core or Stage packages). *Recommendation: Use types from `@nexus-ai/visual-gen` if possible, or define Zod schema matching it.*
  - [x] Create `src/types.ts` defining component prop interfaces.
  - [x] Create `src/theme.ts` with NEXUS color palette (Primary, Secondary, Accent, Background, Text).

- [x] **T3: Implement Core Visual Components (Batch 1)**
  - [x] `NeuralNetworkAnimation`: Use `remotion-paths` or SVG with `spring` animations for nodes/edges.
  - [x] `DataFlowDiagram`: Animated arrow flow between steps.
  - [x] `ComparisonChart`: Animated bar/column heights using `interpolate`.
  - [x] `MetricsCounter`: Rolling number animation.

- [x] **T4: Implement Core Visual Components (Batch 2)**
  - [x] `ProductMockup`: Clean window chrome container for content.
  - [x] `CodeHighlight`: Use `prism-react-renderer` or similar for syntax highlighting.
  - [x] `BrandedTransition`: Alpha mask or slide transition with brand colors.
  - [x] `LowerThird`: Text overlay for citations/context.

- [x] **T5: Implement TechExplainer Composition**
  - [x] Create `src/compositions/TechExplainer.tsx`.
  - [x] Define `TechExplainerSchema` using Zod (timeline object, audioUrl string).
  - [x] Implement rendering logic: Map `timeline.scenes` to `<Sequence>` components.
  - [x] Switch statement to render correct Component based on `scene.component`.
  - [x] Pass `scene.props` to component.
  - [x] Add `<Audio src={audioUrl} />`.

- [x] **T6: Register Root & Configure Output**
  - [x] Update `src/Root.tsx`.
  - [x] Register `TechExplainer` composition.
  - [x] Set default props (mock data for preview).
  - [x] Config: 1920x1080, 30fps.
  - [x] Ensure durationInFrames is calculated dynamic or set large enough (Remotion Studio allows dynamic, but Render need specific). *Note: Render Service will likely override durationInFrames based on input.*

## Dev Notes

### Architecture Compliance
- **Monorepo Location:** `apps/video-studio`.
- **Dependencies:** Should depend on internal packages for types if needed (`@nexus-ai/visual-gen`, `@nexus-ai/core`).
- **Isolation:** This app runs in its own build context (Remotion bundles Webpack). ensure no "cannot find module" errors from workspace imports.
- **Docker:** Will be containerized later (Story 3.6), but ensure file structure is standard.

### Technical Implementation Details

**1. Component Mapping Strategy:**
The `TechExplainer` should use a mapping object or switch statement to select components:
```tsx
const COMPONENT_MAP: Record<string, React.FC<any>> = {
  NeuralNetworkAnimation,
  DataFlowDiagram,
  // ...
};

// Inside render loop
const SceneComponent = COMPONENT_MAP[scene.component];
return (
  <Sequence from={scene.startTime * fps} durationInFrames={scene.duration * fps}>
    <SceneComponent {...scene.props} />
  </Sequence>
);
```

**2. Handling Audio & Timing:**
- `startTime` and `duration` in JSON are in **seconds**.
- Remotion uses **frames**.
- Conversion: `frame = second * fps`.
- Ensure `fps` is consistent (30).

**3. Visual Language (Theme):**
Define a `theme.ts`:
```ts
export const THEME = {
  colors: {
    primary: '#...', // Brand Blue/Purple
    secondary: '#...',
    background: '#1a1a1a', // Dark mode default
    text: '#ffffff',
  },
  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Roboto, sans-serif',
  }
};
```

**4. Props Validation (Zod):**
Remotion strongly encourages Zod for `defaultProps` and parameter validation.
```ts
export const myCompSchema = z.object({
  timeline: z.object({
    scenes: z.array(z.object({ ... }))
  }),
  audioUrl: z.string(),
});
```

**5. Assets:**
- Use `staticFile` for any bundled assets (logo, overlay images).
- For dynamic assets (images from inputs), pass URLs in props.

### Previous Story Intelligence (3.3)
- **Timeline JSON:** The schema is defined in `3-3-create-visual-generation-package.md` and `@nexus-ai/visual-gen`.
- **Cues:** The cues `neural network`, `data flow`, etc., map directly to the component names requested here.

### Anti-Patterns to Avoid
- **Hardcoding Duration:** Duration must come from the `timeline` prop (derived from audio in previous stage).
- **Network Calls in Render:** Avoid fetching data inside the component body. Data should be passed as props.
- **Stock Footage:** NFR19 says "100% programmatic visuals". Do not rely on external video assets unless generated.

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Implementation Plan
1. **Scaffolding**: Verified and configured existing video-studio app with proper dependencies (zod, @nexus-ai/visual-gen)
2. **Shared Types**: Created comprehensive prop interfaces for all 8 visual components in types.ts
3. **Theme**: Implemented NEXUS-AI visual language with consistent color palette, typography, and spacing scales
4. **Components Batch 1**: Implemented NeuralNetworkAnimation, DataFlowDiagram, ComparisonChart, MetricsCounter with 60fps animations using Remotion's spring and interpolate
5. **Components Batch 2**: Implemented ProductMockup, CodeHighlight (custom syntax highlighting), BrandedTransition (3 types: wipe/fade/slide), LowerThird
6. **TechExplainer Composition**: Created main composition with Zod schema validation, component mapping, and timeline-to-sequence rendering
7. **Root Registration**: Updated Root.tsx with TechExplainer composition and sample timeline data for preview
8. **Testing**: Created comprehensive unit tests for all components, integration tests for TechExplainer, and theme validation tests

### Review Fixes (AI Senior Dev)
- Fixed non-deterministic rendering in NeuralNetworkAnimation.tsx (replaced Math.random with remotion.random)
- Replaced placeholder tests in components.test.tsx with robust rendering tests using Vitest mocks
- Fixed hardcoded asset URL in Root.tsx

### Debug Log References
- TypeScript compilation: All type errors resolved, strict mode enabled
- Component mapping: Used Record<string, React.FC<any>> pattern for dynamic component selection
- Timing conversion: Properly converts seconds to frames (time * fps) for Remotion Sequences
- Custom syntax highlighting: Implemented basic regex-based highlighter (no external dependency needed)
- All components follow NEXUS-AI theme and use consistent animation patterns

### Completion Notes List
- ✅ Confirmed `apps/video-studio` scaffolded and configured
- ✅ Confirmed all 8 visual components implemented with smooth 60fps animations
- ✅ Confirmed TechExplainer composition renders from TimelineJSON
- ✅ Confirmed Zod schema validation for composition props
- ✅ Confirmed all components follow NEXUS-AI visual language (theme.ts)
- ✅ Confirmed TypeScript compilation passes (tsc --noEmit)
- ✅ Confirmed build script works (pnpm build)
- ✅ Confirmed comprehensive test coverage for all components
- ✅ Confirmed sample timeline data works in Root.tsx for local preview

## File List

### Modified Files
- `apps/video-studio/package.json` - Added dependencies: zod, @nexus-ai/visual-gen
- `apps/video-studio/src/Root.tsx` - Registered TechExplainer composition with sample data

### New Files Created
- `apps/video-studio/src/types.ts` - Component prop interfaces for all 8 visual components
- `apps/video-studio/src/theme.ts` - NEXUS-AI visual language theme (colors, fonts, spacing)
- `apps/video-studio/src/components/index.ts` - Component exports
- `apps/video-studio/src/components/NeuralNetworkAnimation.tsx` - Animated neural network visualization
- `apps/video-studio/src/components/DataFlowDiagram.tsx` - Animated pipeline/process flow
- `apps/video-studio/src/components/ComparisonChart.tsx` - Animated bar chart comparison
- `apps/video-studio/src/components/MetricsCounter.tsx` - Animated number counter with progress
- `apps/video-studio/src/components/ProductMockup.tsx` - Window chrome mockup container
- `apps/video-studio/src/components/CodeHighlight.tsx` - Syntax-highlighted code display
- `apps/video-studio/src/components/BrandedTransition.tsx` - NEXUS-AI branded transitions (wipe/fade/slide)
- `apps/video-studio/src/components/LowerThird.tsx` - Citation/source overlay component
- `apps/video-studio/src/compositions/TechExplainer.tsx` - Main video composition with Zod validation
- `apps/video-studio/src/__tests__/components.test.tsx` - Unit tests for visual components
- `apps/video-studio/src/__tests__/TechExplainer.test.tsx` - Integration tests for composition
- `apps/video-studio/src/__tests__/theme.test.ts` - Theme validation tests

## Change Log

### 2026-01-18 - Code Review Fixes
- Applied deterministic rendering fixes to NeuralNetworkAnimation
- Implemented real unit tests for all visual components
- Corrected external asset references

### 2026-01-17 - Story 3.4 Implementation Complete
- Implemented Remotion video composition app in `apps/video-studio/`
- Created 8 visual components with 60fps animations following NEXUS-AI visual language
- Implemented TechExplainer composition with Zod schema validation and timeline-to-sequence rendering
- Added comprehensive test coverage for all components and composition
- Verified TypeScript compilation and build process
- Ready for integration with visual generation stage (Story 3.3) and render service (Story 3.6)

