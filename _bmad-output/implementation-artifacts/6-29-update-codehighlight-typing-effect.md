# Story 6.29: Update CodeHighlight for Typing Effect

Status: done

## Story

As a developer,
I want CodeHighlight component to support typing animation,
So that code appears progressively during narration.

## Acceptance Criteria

1. **AC1: Typing Props** - `CodeHighlightProps` includes `typingEffect?: boolean`, `typingSpeed?: number` (chars/sec), `visibleChars?: number` (manual override).
2. **AC2: Typing Mode** - When `typingEffect: true`, component calculates visible chars from current frame and speed, renders only visible portion with syntax highlighting, shows blinking cursor at end of visible text.
3. **AC3: Default Behavior** - When `typingEffect: false` or undefined, full code displayed immediately (backward compatible, identical to current behavior).
4. **AC4: Cursor** - Blinking cursor at end of visible text during typing. Cursor blinks at ~2Hz when typing complete. No cursor when `typingEffect` is false/undefined.
5. **AC5: Syntax Highlighting** - Syntax highlighting applies correctly to partial (visible) code, not just full code.
6. **AC6: Tests** - Component tests verify both typing and non-typing modes, including edge cases.

## Tasks / Subtasks

- [x] Task 1: Update `CodeHighlightProps` interface in `apps/video-studio/src/types.ts` (AC: #1)
  - [x] 1.1 Add `typingEffect?: boolean` to `CodeHighlightProps`
  - [x] 1.2 Add `typingSpeed?: number` to `CodeHighlightProps`
  - [x] 1.3 Add `visibleChars?: number` to `CodeHighlightProps`
- [x] Task 2: Update CodeHighlight component in `apps/video-studio/src/components/CodeHighlight.tsx` (AC: #2, #3, #4, #5)
  - [x] 2.1 Import `useCurrentFrame`, `useVideoConfig` (already present)
  - [x] 2.2 Add typing calculation: when `typingEffect` is true, compute `effectiveVisibleChars` from frame, fps, and `typingSpeed` (default 30 chars/sec). If `visibleChars` prop provided, use that directly as override
  - [x] 2.3 Slice code string to `effectiveVisibleChars` for rendering when typing enabled
  - [x] 2.4 Apply syntax highlighting to the sliced (visible) code only
  - [x] 2.5 Update cursor logic: show cursor only when `typingEffect` is true; blink at ~2Hz (`Math.sin(frame / 15) > 0`) when all chars revealed; position cursor at end of visible text
  - [x] 2.6 When `typingEffect` is false/undefined: keep existing behavior exactly (full code, staggered line animation, no typing cursor)
  - [x] 2.7 Filter `highlightLines` (from `data.highlightLines`) to only lines that contain visible characters
- [x] Task 3: Write tests in `apps/video-studio/src/components/__tests__/CodeHighlight.test.tsx` (AC: #6)
  - [x] 3.1 Test default mode (no typing): full code rendered, no typing cursor
  - [x] 3.2 Test typing mode: progressive character reveal based on frame
  - [x] 3.3 Test `visibleChars` manual override
  - [x] 3.4 Test cursor blinking when typing complete
  - [x] 3.5 Test syntax highlighting on partial code
  - [x] 3.6 Test backward compatibility: component with no typing props renders identically to current

## Dev Notes

### Architecture & Integration

- **DO NOT** import `generateCodeSnippetProps` from `@nexus-ai/broll-engine` into the component. The broll-engine function is for pre-calculating props outside Remotion. Inside the component, implement the typing math directly using Remotion's `useCurrentFrame()` and `useVideoConfig()` hooks, matching the same formula from code-renderer.ts:
  ```
  visibleChars = Math.min(Math.floor(currentFrame * (typingSpeed / fps)), code.length)
  ```
- The existing component already uses `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`, `spring()` from Remotion
- The existing component already has a cursor with `Math.sin(frame / 15)` blink logic - adapt this for typing mode only
- Current line animation (staggered spring per line) should remain active when `typingEffect` is false
- When `typingEffect` is true, replace the per-line staggered reveal with character-based progressive reveal

### Constants (match broll-engine/code-renderer.ts)

- `DEFAULT_TYPING_SPEED = 30` (chars/sec)
- `CURSOR_BLINK_FRAMES = 15` (used in `Math.sin(frame / CURSOR_BLINK_FRAMES)`)

### Syntax Highlighting on Partial Code

The existing `highlightSyntax()` helper uses regex for keywords, strings, comments, numbers. When typing, slice the full code to `visibleChars` BEFORE calling `highlightSyntax()` so that partial tokens at the boundary render as plain text (not broken highlights).

### File Structure

| File | Action |
|------|--------|
| `apps/video-studio/src/types.ts` | Edit - add 3 optional props to `CodeHighlightProps` |
| `apps/video-studio/src/components/CodeHighlight.tsx` | Edit - add typing logic, update cursor, update rendering |
| `apps/video-studio/src/components/__tests__/CodeHighlight.test.tsx` | Create - test both modes |

### Backward Compatibility

- All new props are optional with sensible defaults
- `typingEffect` defaults to `undefined`/`false` = current behavior exactly
- No existing tests should break
- No visual change for components not using typing props

### Testing Standards

- Use Vitest
- Mock Remotion hooks: `useCurrentFrame`, `useVideoConfig`, `spring`, `interpolate`
- Test frame progression (frame 0 = 0 chars, frame N = N*speed/fps chars)
- Test that typing mode cursor is at end of visible text
- Test that non-typing mode renders all code immediately

### Previous Story (6-28) Intelligence

- `generateCodeSnippetProps()` in `packages/broll-engine/src/code-renderer.ts` has the reference typing math
- Same `DEFAULT_TYPING_SPEED = 30` and `CURSOR_BLINK_FRAMES = 15` constants
- 30 tests all passing, build clean
- The broll-engine function returns `CodeSnippetProps` with `visibleChars`, `showCursor`, `highlightLines` - the component can accept these as props from external callers OR compute them internally via `typingEffect`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.29]
- [Source: packages/broll-engine/src/code-renderer.ts - typing formula reference]
- [Source: apps/video-studio/src/components/CodeHighlight.tsx - current implementation]
- [Source: apps/video-studio/src/types.ts - CodeHighlightProps interface]
- [Source: _bmad-output/project-context.md - testing standards, naming conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Added `typingEffect`, `typingSpeed`, and `visibleChars` optional props to `CodeHighlightProps` interface
- Implemented typing calculation using formula: `Math.min(Math.floor(frame * (speed / fps)), codeContent.length)` matching broll-engine reference
- Code is sliced to `effectiveVisibleChars` BEFORE syntax highlighting when typing mode is active
- Cursor now only visible in typing mode: solid during typing, blinking at ~2Hz when complete
- Non-typing mode preserved exactly: staggered line-by-line fade-in animation, no cursor
- `highlightLines` filtered to only lines with visible characters during typing
- Constants `DEFAULT_TYPING_SPEED = 30` and `CURSOR_BLINK_FRAMES = 15` match broll-engine
- 18 tests written covering all 6 acceptance criteria: default mode, typing mode, visibleChars override, cursor behavior, syntax highlighting on partial code, backward compatibility
- All 18 new tests pass, all 11 existing component tests pass, build clean

### File List

- `apps/video-studio/src/types.ts` (modified) - Added 3 optional typing props to CodeHighlightProps
- `apps/video-studio/src/components/CodeHighlight.tsx` (modified) - Added typing effect logic, cursor control, highlight line filtering
- `apps/video-studio/src/components/__tests__/CodeHighlight.test.tsx` (created) - 18 tests for typing and non-typing modes

## Senior Developer Review (AI)

**Reviewer:** Cryptology (2026-01-28)
**Outcome:** Approved with fixes applied

**Issues Found:** 1 High, 3 Medium, 2 Low

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| H1 | HIGH | Cursor blink used smooth sine wave instead of broll-engine's discrete toggle | Fixed: switched to `Math.floor(frame/15) % 2` matching broll-engine |
| M1 | MEDIUM | Missing safeFps guard (division by zero if fps=0) | Fixed: added `const safeFps = fps > 0 ? fps : 30` |
| M2 | MEDIUM | Missing safeFrame guard (negative frame values) | Fixed: added `const safeFrame = Math.max(0, frame)` |
| M3 | MEDIUM | highlightLines filtering differs from broll-engine | Documented: intentional 0-based convention difference, added clarifying comment |
| L1 | LOW | Cursor blink test was testing the mock, not real logic | Fixed: test now verifies discrete toggle at frames 10 (on) and 20 (off) |
| L2 | LOW | Commented-out theme variable | Fixed: removed dead commented code |

**All fixes verified:** Build passing, 18/18 tests passing.

## Change Log

- 2026-01-28: Code review: 6 issues found (1H, 3M, 2L), all fixed. Cursor blink aligned with broll-engine discrete toggle. Added safeFps/safeFrame guards. Improved cursor blink test.
- 2026-01-28: Implemented typing effect for CodeHighlight component (Story 6-29). Added `typingEffect`, `typingSpeed`, `visibleChars` props. Component now supports progressive character reveal with blinking cursor for typing mode while maintaining full backward compatibility. 18 tests added.
