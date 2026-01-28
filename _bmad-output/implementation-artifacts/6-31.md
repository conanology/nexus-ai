# Story 6.31: Create BrowserFrame Component

Status: done

## Story

As a developer,
I want a browser simulation component,
So that B-Roll can show realistic browser interactions in video segments.

## Acceptance Criteria

1. **AC1: Component Props** - `BrowserFrame.tsx` created at `apps/video-studio/src/components/BrowserFrame.tsx` with props:
   - `url: string` (displayed in address bar)
   - `content: React.ReactNode` (page content)
   - `actions?: BrowserAction[]` (interaction sequence)
   - `viewport?: { width: number; height: number }` (browser size)
   - `style?: BrowserStyle` (chrome appearance: light/dark theme)
   - `data?: BrowserFrameData` (direction document data passthrough)
   - `motion?: MotionConfig` (entrance/emphasis/exit animations)

2. **AC2: Browser Chrome Rendering** - Component renders Chrome-style browser frame:
   - Tab bar with single tab showing page title
   - Address bar displaying `url` prop
   - Navigation buttons (back, forward, refresh) as visual-only decorations
   - Close/minimize/maximize window dots (macOS style)
   - Content area rendering `content` prop or data-driven content

3. **AC3: Action Animation** - When `actions` provided, component animates:
   - Animated cursor following action targets (uses `interpolateActionState` from broll-engine)
   - Click ripple effect on `click` actions
   - Character-by-character text input on `type` actions
   - Smooth content scroll on `scroll` actions
   - Element highlight box on `highlight` actions

4. **AC4: COMPONENT_MAP Registration** - BrowserFrame added to:
   - `COMPONENT_MAP` in `apps/video-studio/src/compositions/TechExplainer.tsx`
   - Export in `apps/video-studio/src/components/index.ts`

5. **AC5: Visual Tests** - Tests verify:
   - Browser chrome renders correctly (address bar, buttons, tabs)
   - Content area displays provided content
   - Actions produce correct visual state at specific frames
   - Component works without actions (static mode)
   - Light and dark theme variants render correctly
   - Motion hook integration works (entrance/emphasis/exit)
   - Backward compatibility: renders correctly with minimal props

## Tasks / Subtasks

- [x] Task 1: Define BrowserFrameProps interface (AC: #1)
  - [x] 1.1 Add `BrowserFrameProps` to `apps/video-studio/src/types.ts`
  - [x] 1.2 Include `url`, `content`, `actions`, `viewport`, `style`, `data`, `motion` fields
  - [x] 1.3 Define `BrowserFrameData` interface for direction document data passthrough

- [x] Task 2: Create BrowserFrame component (AC: #2, #3)
  - [x] 2.1 Create `apps/video-studio/src/components/BrowserFrame.tsx`
  - [x] 2.2 Implement browser chrome (tab bar, address bar, window controls)
  - [x] 2.3 Implement content area rendering
  - [x] 2.4 Integrate `useCurrentFrame()` and `useVideoConfig()` from Remotion
  - [x] 2.5 Integrate `useMotion()` hook for entrance/emphasis/exit animations
  - [x] 2.6 Implement cursor animation driven by action state
  - [x] 2.7 Implement click ripple effect
  - [x] 2.8 Implement type action (character reveal in input elements)
  - [x] 2.9 Implement scroll action (content translateY)
  - [x] 2.10 Implement highlight action (box highlight with opacity)

- [x] Task 3: Register component (AC: #4)
  - [x] 3.1 Add `BrowserFrame` export to `apps/video-studio/src/components/index.ts`
  - [x] 3.2 Import and add `BrowserFrame` to `COMPONENT_MAP` in `TechExplainer.tsx`

- [x] Task 4: Write tests (AC: #5)
  - [x] 4.1 Create `apps/video-studio/src/components/__tests__/BrowserFrame.test.tsx`
  - [x] 4.2 Test chrome renders (address bar, tabs, window controls)
  - [x] 4.3 Test content area displays children
  - [x] 4.4 Test action-driven cursor position at specific frames
  - [x] 4.5 Test click ripple visibility
  - [x] 4.6 Test scroll offset application
  - [x] 4.7 Test highlight opacity
  - [x] 4.8 Test light/dark theme variants
  - [x] 4.9 Test motion hook integration
  - [x] 4.10 Test backward compatibility (no actions, no style, minimal props)

- [x] Task 5: Build and test verification
  - [x] 5.1 Run `pnpm build` - must pass
  - [x] 5.2 Run `pnpm test` - must pass

## Dev Notes

### Architecture Compliance

- **Component location**: `apps/video-studio/src/components/BrowserFrame.tsx` (matches existing component pattern)
- **Props interface location**: `apps/video-studio/src/types.ts` (matches CodeHighlight, KineticText pattern)
- **Test location**: `apps/video-studio/src/components/__tests__/BrowserFrame.test.tsx`
- **All animations MUST use `useCurrentFrame()`** - never CSS transitions (causes Remotion render flickering)
- **Use `interpolate()` and `spring()`** from Remotion for all value animations
- **Use `AbsoluteFill`** as root container (standard for all video-studio components)

### Integration with broll-engine

The `browser-demo.ts` in `packages/broll-engine/src/` already provides:
- `generateBrowserDemoProps(config, durationFrames, currentFrame, fps)` -> returns `BrowserDemoProps`
- `computeActionTimeline(actions)` -> frame ranges for each action
- `getActiveAction(timeline, currentFrame)` -> current action at frame
- `interpolateActionState(action, progress)` -> visual state (cursor pos, scroll, highlight opacity)

The BrowserFrame component consumes the output of `generateBrowserDemoProps`. The `BrowserDemoProps` interface from broll-engine provides: `{ url, content: BrowserDemoContent | null, actions, viewport, style }`.

When driven by the pipeline, `visual-gen` calls `generateBrowserDemoProps` per-frame and passes the result as props to BrowserFrame. The component renders the pre-computed state.

When used standalone (e.g., in tests or previews), the component can accept raw `actions` and compute state internally using `useCurrentFrame()`.

### Key Types from broll-engine (DO NOT recreate)

```typescript
// From @nexus-ai/broll-engine/src/types.ts - ALREADY EXISTS
interface BrowserDemoProps {
  url: string;
  content: BrowserDemoContent | null;
  actions: BrowserAction[];
  viewport: { width: number; height: number };
  style?: BrowserStyle;
}

interface BrowserDemoContent {
  elements: BrowserDemoElement[];
  cursor?: { x: number; y: number; visible: boolean; clicking: boolean };
  scrollY: number;
  activeHighlight?: { target: string; opacity: number };
}

interface BrowserDemoElement {
  id: string;
  type: 'text' | 'input' | 'button' | 'code-block' | 'metric' | 'chart';
  content: string;
  visibleChars?: number;
  position: { x: number; y: number };
}

interface BrowserStyle { theme: 'light' | 'dark'; }
```

### Component Pattern Reference (follow CodeHighlight.tsx)

```typescript
// Pattern from apps/video-studio/src/components/CodeHighlight.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { BrowserFrameProps } from '../types';
import { useMotion } from '../hooks/useMotion.js';

export const BrowserFrame: React.FC<BrowserFrameProps> = ({ url, content, actions, viewport, style, data, motion }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);
  // ... frame-driven rendering
};
```

### Browser Chrome Design

- **Window controls**: 3 circles (red #FF5F57, yellow #FEBC2E, green #28C840) at top-left, 12px diameter, 8px gap
- **Tab bar**: Single tab with page title, dark background matching `THEME.colors.backgroundDark`
- **Address bar**: Rounded input showing `url`, with lock icon prefix, lighter background
- **Navigation buttons**: Back/forward arrows + refresh icon (decorative only, no interaction)
- **Content area**: Full remaining height, white/dark background based on `style.theme`
- Use `THEME` constants for colors, spacing, fonts where applicable

### Frame-Based Animation Guards (from Story 6-30 learnings)

- Always use `safeFps = fps > 0 ? fps : 30` guard
- Always use `safeFrame = Math.max(0, frame)` guard
- Use named constants for magic numbers (e.g., `CURSOR_SIZE = 16`, `CLICK_RIPPLE_FRAMES = 12`)
- Use discrete toggle pattern for blinking effects (not sine waves)
- Clamp interpolation progress to [0, 1]

### Cursor and Click Ripple Implementation

- **Cursor**: 16x16 default arrow cursor SVG or div, positioned absolutely at `cursor.x`, `cursor.y`
- **Click ripple**: Expanding circle from click point, opacity fading from 0.6 to 0 over ~12 frames
- Use `interpolate(frame - clickStartFrame, [0, RIPPLE_FRAMES], [0, 1])` for ripple progress
- Cursor visibility driven by `content.cursor?.visible`
- Click state driven by `content.cursor?.clicking`

### Scroll Implementation

- Content area uses `transform: translateY(-${scrollY}px)` for scroll offset
- `scrollY` comes from `content.scrollY`
- Smooth via per-frame interpolation (already handled by broll-engine)

### Highlight Implementation

- Absolute-positioned highlight box around target element
- Opacity driven by `content.activeHighlight?.opacity`
- 2px border with `THEME.colors.primary` color
- Border radius matching highlighted element

### BrowserFrameProps Definition (add to types.ts)

```typescript
export interface BrowserFrameProps {
  url?: string;
  content?: React.ReactNode;
  actions?: BrowserAction[];
  viewport?: { width: number; height: number };
  style?: BrowserStyle;
  data?: {
    url?: string;
    content?: BrowserDemoContent;
    actions?: BrowserAction[];
    viewport?: { width: number; height: number };
    style?: BrowserStyle;
  };
  motion?: MotionConfig;
}
```

The `data` field follows the same pattern as other components (e.g., `CodeHighlightProps.data`) for direction document passthrough. Props at the top level serve as defaults; `data.*` values take precedence when provided.

### Testing Approach

Use the same pattern as CodeHighlight tests. Remotion components can be tested with:
```typescript
import { render } from '@testing-library/react';
// Mock Remotion hooks
vi.mock('remotion', () => ({
  useCurrentFrame: vi.fn(() => 0),
  useVideoConfig: vi.fn(() => ({ fps: 30, durationInFrames: 300, width: 1920, height: 1080 })),
  interpolate: vi.fn((value, input, output) => output[0]),
  spring: vi.fn(() => 1),
  AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
}));
```

### Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `apps/video-studio/src/components/BrowserFrame.tsx` |
| CREATE | `apps/video-studio/src/components/__tests__/BrowserFrame.test.tsx` |
| MODIFY | `apps/video-studio/src/types.ts` (add BrowserFrameProps) |
| MODIFY | `apps/video-studio/src/components/index.ts` (add export) |
| MODIFY | `apps/video-studio/src/compositions/TechExplainer.tsx` (add to COMPONENT_MAP) |

### Project Structure Notes

- All component files use kebab-case except React components which use PascalCase filenames (existing convention in video-studio)
- Import `BrowserAction` type from `@nexus-ai/script-gen` (already a dependency of video-studio via re-exports in types.ts)
- Import `BrowserDemoContent`, `BrowserDemoElement`, `BrowserStyle` from `@nexus-ai/broll-engine` for data typing
- `THEME` import from `../theme` provides all design tokens

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.31]
- [Source: _bmad-output/implementation-artifacts/6-30.md - Browser demo templates implementation]
- [Source: packages/broll-engine/src/types.ts - BrowserDemoProps, BrowserDemoContent]
- [Source: packages/broll-engine/src/browser-demo.ts - generateBrowserDemoProps]
- [Source: apps/video-studio/src/components/CodeHighlight.tsx - Component pattern reference]
- [Source: apps/video-studio/src/types.ts - Existing prop interfaces pattern]
- [Source: apps/video-studio/src/compositions/TechExplainer.tsx - COMPONENT_MAP registration]
- [Source: _bmad-output/project-context.md - Project rules and conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed TS6133 unused `CHROME_HEIGHT` constant - removed
- Fixed TS6133 unused `actionsProp` destructure - removed (actions consumed via `data.content`)
- Fixed TS2783 duplicate `transform` property - combined with emphasisStyle transform (same pattern as CodeHighlight.tsx)
- Fixed TS6133 unused `findAllByTestId` in tests - removed
- Fixed test failures from nested sub-components not rendering in direct function call tests - added `deepRender` helper to expand function components in element tree

### Completion Notes List

- Implemented BrowserFrame component with Chrome-style browser chrome (window dots, tab bar, address bar with navigation buttons)
- Content area supports both ReactNode children and data-driven BrowserDemoContent rendering
- Data-driven mode renders elements (text, input, button, code-block, metric, chart) with positioning
- Cursor, click ripple, scroll, and highlight animations driven by `data.content` from broll-engine
- `data.*` props take precedence over top-level props (direction document passthrough pattern)
- useMotion hook integrated for entrance/emphasis/exit animations
- Light and dark theme support via `style.theme`
- Frame safety guards applied (safeFps, safeFrame) per Story 6-30 learnings
- Added `@nexus-ai/broll-engine` as workspace dependency for type imports
- Re-exported `BrowserAction`, `BrowserDemoContent`, `BrowserStyle` types from types.ts
- 28 tests covering all acceptance criteria: chrome, content, cursor, ripple, scroll, highlight, themes, motion, backward compat
- All 221 video-studio tests pass (0 regressions)
- Build passes cleanly

### File List

- CREATE: `apps/video-studio/src/components/BrowserFrame.tsx`
- CREATE: `apps/video-studio/src/components/__tests__/BrowserFrame.test.tsx`
- MODIFY: `apps/video-studio/src/types.ts`
- MODIFY: `apps/video-studio/src/components/index.ts`
- MODIFY: `apps/video-studio/src/compositions/TechExplainer.tsx`
- MODIFY: `apps/video-studio/package.json`
- MODIFY: `pnpm-lock.yaml`

### Change Log

- 2026-01-28: Implemented BrowserFrame component (Story 6-31) - browser simulation component for B-Roll video segments with chrome rendering, action animations, theme support, and motion integration
- 2026-01-28: Code review fixes - simplified click ripple to data-driven approach (removed broken frame-tracking logic), added metric/chart element type rendering, added dynamic highlight box dimensions per element type, added metric/chart tests
