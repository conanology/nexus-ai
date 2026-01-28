# Story 6.30: Implement Browser Demo Templates

Status: done

## Story

As a developer,
I want simulated browser interaction sequences,
So that UI demonstrations can be shown without real recordings.

## Acceptance Criteria

1. **AC1: generateBrowserDemoProps function** - `generateBrowserDemoProps(config, durationFrames, currentFrame, fps)` takes `BrowserBRollConfig`, processes the action sequence with timing, and returns `BrowserDemoProps` for the BrowserFrame component.
2. **AC2: Pre-defined templates** - Four template generators available via `templateId`:
   - `'api-request'`: Shows request/response cycle (cursor click send, loading, response appears)
   - `'form-submit'`: Form fill and submit animation (type fields, click submit, success)
   - `'dashboard'`: Dashboard with updating metrics (counters animate, chart updates)
   - `'custom'`: Pass-through user-defined actions (no template expansion)
3. **AC3: BrowserAction types** - All action types supported with frame-based timing:
   - `click`: cursor moves to target, click ripple effect
   - `type`: text appears character by character
   - `scroll`: content scroll offset changes smoothly
   - `highlight`: element gets highlight box
   - `wait`: pause between actions (no visual change)
4. **AC4: Frame-based action scheduling** - Actions scheduled sequentially using `delay` and `duration` fields. At any `currentFrame`, the function calculates which actions are active and returns interpolated state.
5. **AC5: BrowserDemoProps output** - Returns complete props: `url`, `content` (template-generated HTML structure), `actions` (with computed frame state), `viewport`, `style`.
6. **AC6: Tests** - Comprehensive tests covering all templates, all action types, frame interpolation, edge cases.

## Tasks / Subtasks

- [x] Task 1: Implement template action generators (AC: #2)
  - [x] 1.1 Create `getApiRequestTemplate(durationFrames, fps)` returning `TemplateDefinition` for request/response cycle
  - [x] 1.2 Create `getFormSubmitTemplate(durationFrames, fps)` returning `TemplateDefinition` for form fill sequence
  - [x] 1.3 Create `getDashboardTemplate(durationFrames, fps)` returning `TemplateDefinition` for dashboard update sequence
  - [x] 1.4 Create `TEMPLATE_GENERATORS` map from `BrowserTemplateId` to generator function
- [x] Task 2: Implement action scheduling logic (AC: #3, #4)
  - [x] 2.1 Create `computeActionTimeline(actions)` that calculates absolute start/end frames for each action based on cumulative `delay` + `duration`
  - [x] 2.2 Create `getActiveAction(timeline, currentFrame)` that returns the currently active action and its progress (0-1)
  - [x] 2.3 Create `interpolateActionState(action, progress)` that computes per-action visual state (cursor position, typed text length, scroll offset, highlight opacity)
- [x] Task 3: Update `generateBrowserDemoProps` (AC: #1, #5)
  - [x] 3.1 Add `currentFrame` and `fps` parameters (default 0 and 30, matching code-renderer pattern)
  - [x] 3.2 Resolve template: if `templateId !== 'custom'`, merge template actions with config actions
  - [x] 3.3 Compute action timeline and active state for `currentFrame`
  - [x] 3.4 Generate `content` object representing the template's HTML structure (typed as `BrowserDemoContent` - see Dev Notes)
  - [x] 3.5 Return complete `BrowserDemoProps` with all computed state
- [x] Task 4: Write tests in `packages/broll-engine/src/__tests__/browser-demo.test.ts` (AC: #6)
  - [x] 4.1 Test each template generator produces valid action sequences
  - [x] 4.2 Test action timeline computation (cumulative delay + duration)
  - [x] 4.3 Test `getActiveAction` at various frames (before first, during, between, after last)
  - [x] 4.4 Test each action type interpolation (click cursor position, type char count, scroll offset, highlight opacity)
  - [x] 4.5 Test `generateBrowserDemoProps` end-to-end for each template
  - [x] 4.6 Test custom template pass-through (no template expansion)
  - [x] 4.7 Test edge cases: empty actions, 0 duration, negative frame, fps=0
  - [x] 4.8 Test backward compatibility: existing tests still pass with updated signature

## Dev Notes

### Architecture & Integration

- **File to modify**: `packages/broll-engine/src/browser-demo.ts` - currently a stub (Story 6-27 placeholder)
- **Existing stub**: Returns pass-through props with `content: null`. The full implementation replaces this with frame-aware template logic.
- **Pattern to follow**: `packages/broll-engine/src/code-renderer.ts` - same function signature pattern (`config, durationFrames, currentFrame, fps`) with safe guards for fps=0 and negative frames.
- **Exports already wired**: `packages/broll-engine/src/index.ts` already exports `generateBrowserDemoProps` from `./browser-demo.js` - no index changes needed.
- **Types already defined**: `BrowserDemoProps`, `BrowserStyle`, `BrowserBRollConfig`, `BrowserAction`, `BrowserActionType`, `BrowserTemplateId` all exist in `packages/broll-engine/src/types.ts` (re-exported from `@nexus-ai/script-gen`).

### BrowserDemoProps.content Type

The current `BrowserDemoProps.content` is typed as `unknown`. For this story, define a `BrowserDemoContent` interface in `packages/broll-engine/src/types.ts` and update `BrowserDemoProps.content` type:

```typescript
/** Structured content for browser demo rendering */
export interface BrowserDemoContent {
  /** Template-specific elements to render */
  elements: BrowserDemoElement[];
  /** Current cursor position (if any action is active) */
  cursor?: { x: number; y: number; visible: boolean; clicking: boolean };
  /** Current scroll offset */
  scrollY: number;
  /** Active highlight target (CSS selector) */
  activeHighlight?: { target: string; opacity: number };
}

export interface BrowserDemoElement {
  id: string;
  type: 'text' | 'input' | 'button' | 'code-block' | 'metric' | 'chart';
  content: string;
  /** For type actions: how many chars are visible */
  visibleChars?: number;
  position: { x: number; y: number };
}
```

Update `BrowserDemoProps.content` from `unknown` to `BrowserDemoContent`.

### Frame-Based Action Scheduling Pattern

Follow the same frame math as `code-renderer.ts`:
```typescript
const safeFps = fps > 0 ? fps : 30;
const safeFrame = Math.max(0, currentFrame);
```

Action timeline calculation:
```
action[0]: startFrame = action[0].delay, endFrame = startFrame + action[0].duration
action[1]: startFrame = action[0].endFrame + action[1].delay, endFrame = startFrame + action[1].duration
...
```

Progress within an action: `progress = (currentFrame - startFrame) / duration` clamped to [0, 1].

### Template Content Structures

Each template should define both its action sequence AND its content elements:

- **api-request**: Elements = [URL input, Send button, loading spinner, response code block]. Actions = [click Send, wait (loading), highlight response].
- **form-submit**: Elements = [name input, email input, submit button, success message]. Actions = [type name, type email, click submit, highlight success].
- **dashboard**: Elements = [metric cards (3), chart area]. Actions = [highlight metric1, highlight metric2, highlight metric3, scroll to chart].
- **custom**: No template content - uses config.actions directly, content elements empty.

### Backward Compatibility

- `currentFrame` and `fps` parameters default to 0 and 30 respectively
- When called with just `(config, durationFrames)` (existing test pattern), returns valid props with frame-0 state
- Existing tests in `broll-engine.test.ts` must continue to pass - the stub's return shape is preserved

### Constants

```typescript
const DEFAULT_FPS = 30;
const CLICK_DURATION_FRAMES = 10;  // click ripple animation
const TYPE_SPEED = 20;             // chars per second for type actions
const SCROLL_SPEED = 200;          // pixels per second
const HIGHLIGHT_FADE_FRAMES = 8;   // highlight fade in/out
```

### File Structure

| File | Action |
|------|--------|
| `packages/broll-engine/src/browser-demo.ts` | Replace stub with full implementation |
| `packages/broll-engine/src/types.ts` | Add `BrowserDemoContent`, `BrowserDemoElement` interfaces; update `BrowserDemoProps.content` type |
| `packages/broll-engine/src/__tests__/browser-demo.test.ts` | Create - comprehensive tests |
| `packages/broll-engine/src/__tests__/broll-engine.test.ts` | Verify existing tests still pass (no modifications needed) |

### Testing Standards

- Use Vitest
- Create dedicated test file `browser-demo.test.ts` for new tests
- Test each template generator independently
- Test frame progression (frame 0, mid-action, between actions, after all actions)
- Test all 5 action types
- Test edge cases: empty actions array, 0 durationFrames, negative frame, fps=0
- Verify backward compatibility with existing `broll-engine.test.ts` tests

### Previous Story (6-29) Intelligence

- Story 6-29 added typing effect to CodeHighlight component in video-studio
- Code review found: cursor blink should use discrete toggle `Math.floor(frame/15) % 2`, not sine wave
- Code review found: always add safeFps and safeFrame guards
- 6 issues found in review (1H, 3M, 2L) - apply these learnings proactively
- All existing broll-engine tests (30) passing, build clean

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.30]
- [Source: packages/broll-engine/src/browser-demo.ts - current stub]
- [Source: packages/broll-engine/src/code-renderer.ts - pattern to follow]
- [Source: packages/broll-engine/src/types.ts - existing types]
- [Source: packages/script-gen/src/types.ts - BrowserBRollConfig, BrowserAction, BrowserTemplateId definitions]
- [Source: packages/broll-engine/src/__tests__/broll-engine.test.ts - existing tests to preserve]
- [Source: _bmad-output/project-context.md - testing standards, naming conventions]
- [Source: _bmad-output/implementation-artifacts/6-29-update-codehighlight-typing-effect.md - review learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build: all 18 packages pass (broll-engine cache miss, rest cached)
- Tests: 79/79 broll-engine tests pass (49 new browser-demo + 30 existing)

### Completion Notes List

- Replaced browser-demo.ts stub with full frame-aware template implementation
- Added BrowserDemoContent and BrowserDemoElement interfaces to types.ts
- Updated BrowserDemoProps.content type from `unknown` to `BrowserDemoContent | null`
- Implemented 3 template generators (api-request, form-submit, dashboard) with TemplateDefinition pattern (elements + actions)
- Implemented action scheduling: computeActionTimeline, getActiveAction, interpolateActionState (all exported for testing)
- All 5 action types supported: click (cursor + clicking state), type (char-by-char), scroll (smooth offset), highlight (fade in/out), wait (no-op)
- Applied safeFps/safeFrame guards per Story 6-29 learnings
- Updated 2 existing broll-engine.test.ts assertions for new template behavior (dashboard now generates content, custom template used for action-only test)
- Exported BrowserDemoContent and BrowserDemoElement from index.ts
- 49 new tests covering all templates, action scheduling, interpolation, edge cases, backward compatibility

### Senior Developer Review (AI)

**Reviewer:** Cryptology on 2026-01-28
**Result:** Approved with fixes applied (1H, 4M, 2L found; 5 fixed, 2 low deferred)

**Issues Found & Fixed:**
1. **[H1-FIXED]** Magic numbers in highlight fade logic replaced with `HIGHLIGHT_FADE_FRACTION` constant
2. **[M1-FIXED]** `getApiRequestTemplate` now uses fps-aware click duration calculation (was ignoring fps parameter)
3. **[M2-FIXED]** Click action cursor position now resolves from target element position instead of hardcoded (200,100)
4. **[M3-FIXED]** Type action cursor position now resolves from target element position instead of hardcoded (100,80)
5. **[M4-FIXED]** Added 2 tests for template + config action merging, 1 test for cursor position resolution
6. **[L1-NOTED]** Api-request template now uses fps consistently (fixed with M1)
7. **[L2-FIXED]** Exported `TimelineEntry`, `ActiveActionState`, `InterpolatedState`, `computeActionTimeline`, `getActiveAction`, `interpolateActionState` from index.ts

**Tests:** 82 passing (52 browser-demo + 30 existing), build clean (18/18 packages)

### Change Log

- 2026-01-28: Code review fixes - constants, cursor resolution, exports, tests (Story 6-30)
- 2026-01-28: Full implementation of browser demo templates (Story 6-30)

### File List

- packages/broll-engine/src/browser-demo.ts (modified - replaced stub with full implementation)
- packages/broll-engine/src/types.ts (modified - added BrowserDemoContent, BrowserDemoElement; updated BrowserDemoProps.content type)
- packages/broll-engine/src/index.ts (modified - added BrowserDemoContent, BrowserDemoElement exports)
- packages/broll-engine/src/__tests__/browser-demo.test.ts (created - 49 comprehensive tests)
- packages/broll-engine/src/__tests__/broll-engine.test.ts (modified - 2 assertions updated for new template behavior)
