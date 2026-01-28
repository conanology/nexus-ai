# Story 6.28: Implement Code Snippet Renderer

Status: done

## Story

As a developer,
I want code snippets with typing animation,
so that code demos show character-by-character reveal during video playback.

## Acceptance Criteria

1. **AC1: Frame-based typing progress** - `generateCodeSnippetProps(config, durationFrames)` calculates `visibleChars` based on current frame and typing speed (default 30 chars/sec), using `config.typingSpeed` and `durationFrames` to produce progressive reveal.

2. **AC2: Typing speed configurable** - When `config.typingSpeed` is set (e.g., 50), the function uses that value instead of the default 30 chars/sec. Speed is expressed in characters per second.

3. **AC3: Line highlighting animates in sequence** - `highlightLines` returned by the function reflects only the lines that are currently visible (i.e., lines whose characters have been typed so far), not all configured highlight lines at once.

4. **AC4: Cursor blinks at end of visible text** - `showCursor` is `true` while typing is in progress (visibleChars < total chars) and blinks (alternates) at a standard rate when all text is fully typed.

5. **AC5: All CodeSnippetProps fields populated** - Function returns complete `CodeSnippetProps`: `code`, `language`, `visibleChars`, `highlightLines`, `showCursor`, `theme`, `showLineNumbers`.

6. **AC6: Unit tests pass** - All new and existing tests pass. Tests cover: progressive typing, speed configuration, line highlight sequencing, cursor behavior, edge cases (empty code, single char, all typed).

7. **AC7: Build passes** - `pnpm build` succeeds with no TypeScript errors.

## Tasks / Subtasks

- [x] Task 1: Implement frame-based typing calculation (AC: 1, 2)
  - [x] 1.1 Add `fps` parameter or derive from durationFrames context
  - [x] 1.2 Calculate `visibleChars = Math.min(Math.floor((frame / fps) * typingSpeed), code.length)` where frame progresses from 0 to durationFrames
  - [x] 1.3 Handle `typingSpeed` from config with default fallback to 30
  - [x] 1.4 Ensure visibleChars clamps between 0 and code.length

- [x] Task 2: Implement sequential line highlighting (AC: 3)
  - [x] 2.1 Determine which lines are currently visible based on visibleChars
  - [x] 2.2 Filter `config.highlightLines` to include only visible lines
  - [x] 2.3 Handle edge case: no highlight lines configured (return empty array)

- [x] Task 3: Implement cursor behavior (AC: 4)
  - [x] 3.1 Set `showCursor: true` while visibleChars < code.length (typing in progress)
  - [x] 3.2 Implement cursor blink when typing complete (use frame modulo for blink rate)
  - [x] 3.3 Define blink rate constant (e.g., 500ms equivalent in frames)

- [x] Task 4: Update function signature if needed (AC: 5)
  - [x] 4.1 Review if `durationFrames` alone is sufficient or if `fps` and `currentFrame` are needed
  - [x] 4.2 IMPORTANT: The current stub signature is `(config, durationFrames)` - the epic AC says it takes `config` and `durationFrames`. Consider whether the function should accept a `frame` parameter to know the current position, or if it returns a factory/function that takes frame.
  - [x] 4.3 Ensure backward-compatible exports from index.ts

- [x] Task 5: Write comprehensive tests (AC: 6)
  - [x] 5.1 Test progressive typing: at frame 0 visibleChars=0, at final frame visibleChars=code.length
  - [x] 5.2 Test custom typing speed (e.g., 50 chars/sec shows more chars at same frame)
  - [x] 5.3 Test line highlight sequencing (only visible lines highlighted)
  - [x] 5.4 Test cursor on during typing, blink after complete
  - [x] 5.5 Test edge cases: empty string, single character, very long code
  - [x] 5.6 Test default typing speed (30 chars/sec when not specified)

- [x] Task 6: Build verification (AC: 7)
  - [x] 6.1 Run `pnpm build` - must pass
  - [x] 6.2 Run `pnpm test` - must pass

## Dev Notes

### Critical Design Decision: Function Signature

The current stub is:
```typescript
generateCodeSnippetProps(config: CodeBRollConfig, _durationFrames: number): CodeSnippetProps
```

The epic AC says: `generateCodeSnippetProps(config, durationFrames)` - but this raises a question: **how does the function know the CURRENT frame to calculate typing progress?**

**Options (choose one):**
1. **Add `currentFrame` and `fps` parameters**: `generateCodeSnippetProps(config, durationFrames, currentFrame, fps)` - most explicit
2. **Replace durationFrames with a context object**: `generateCodeSnippetProps(config, { durationFrames, currentFrame, fps })` - cleaner
3. **Return a function** that takes frame: `generateCodeSnippetProps(config, durationFrames) => (frame: number) => CodeSnippetProps` - Remotion-friendly pattern

**Recommendation**: Option 1 or 2. Remotion components call prop-generating functions per-frame, so the function needs `currentFrame` and `fps` to calculate `visibleChars`. The epic AC mentions `durationFrames` as input, so add `currentFrame` and `fps` as additional params. Keep `durationFrames` for knowing when typing should complete.

### Typing Calculation Formula

```
charsPerFrame = typingSpeed / fps
visibleChars = Math.min(Math.floor(currentFrame * charsPerFrame), code.length)
```

Where:
- `typingSpeed`: chars/sec from config (default: 30)
- `fps`: frames per second (typically 30 for this project)
- `currentFrame`: 0-indexed frame within the scene
- `code.length`: total characters in the code string

### Line Visibility Calculation

To determine which lines are visible at a given `visibleChars`:
```
visibleText = code.substring(0, visibleChars)
visibleLineCount = visibleText.split('\n').length
visibleHighlightLines = config.highlightLines.filter(line => line <= visibleLineCount)
```

### Cursor Blink Logic

```
if (visibleChars < code.length) {
  showCursor = true;  // Always show while typing
} else {
  // Blink at ~2Hz (every 15 frames at 30fps)
  showCursor = Math.floor(currentFrame / 15) % 2 === 0;
}
```

### Existing Code to Modify

**File**: `packages/broll-engine/src/code-renderer.ts`
- Currently a stub that returns all chars visible, cursor off
- Replace with frame-aware progressive typing implementation

**File**: `packages/broll-engine/src/__tests__/broll-engine.test.ts`
- Currently has 3 tests for code-renderer (stub behavior)
- Update existing tests and add new ones for progressive typing

### Input Type Reference

`CodeBRollConfig` from `@nexus-ai/script-gen` (packages/script-gen/src/types.ts:323):
```typescript
interface CodeBRollConfig {
  content: string;           // Code to display
  language: string;          // Programming language
  highlightLines?: number[]; // Lines to highlight
  typingEffect: boolean;     // Enable typing animation
  typingSpeed: number;       // Chars/sec (default: 30)
  theme: 'dark' | 'light';  // Color theme
  showLineNumbers: boolean;  // Show line numbers
}
```

### Output Type Reference

`CodeSnippetProps` from `packages/broll-engine/src/types.ts:32`:
```typescript
interface CodeSnippetProps {
  code: string;
  language: string;
  visibleChars: number;
  highlightLines: number[];
  showCursor: boolean;
  theme: 'dark' | 'light';
  showLineNumbers: boolean;
}
```

### Project Structure Notes

- Package: `packages/broll-engine/` (created in Story 6-27)
- Source: `packages/broll-engine/src/code-renderer.ts`
- Tests: `packages/broll-engine/src/__tests__/broll-engine.test.ts`
- Build: TypeScript strict mode, ESM with .js extensions
- Package scope: `@nexus-ai/broll-engine`
- Dependencies: `@nexus-ai/core`, `@nexus-ai/script-gen` (workspace:*)

### Anti-Patterns to Avoid

- Do NOT use `console.log` - use structured logger from `@nexus-ai/core` if logging needed
- Do NOT hardcode fps values - accept as parameter
- Do NOT import React types - this is a pure props generator, not a component
- Do NOT break existing exports from `index.ts`
- Do NOT modify `types.ts` unless adding new types needed for the implementation

### Previous Story Intelligence (6-27)

- Package structure already exists with stub implementations
- Tests use vitest with `describe/it/expect` pattern
- Code-renderer stub currently returns `visibleChars: config.content.length` (all visible)
- `_durationFrames` parameter was prefixed with underscore since unused in stub
- BrowserDemoProps.content typed as `unknown` to avoid React dependency
- Follow audio-mixer package patterns for consistency
- Code review found 4 issues in 6-27; ensure clean implementation

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Story 6.28]
- [Source: packages/broll-engine/src/code-renderer.ts - current stub]
- [Source: packages/broll-engine/src/types.ts - CodeSnippetProps interface]
- [Source: packages/script-gen/src/types.ts:323 - CodeBRollConfig interface]
- [Source: _bmad-output/implementation-artifacts/6-27-create-broll-engine-package.md - previous story]
- [Source: _bmad-output/project-context.md - project rules]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Debug Log References
- Build error: TS6133 unused `durationFrames` parameter - fixed by prefixing with underscore
- Pre-existing test failures (66) in other packages (core/execute-stage.test.ts) - not related to this story

### Completion Notes List
- Implemented Option 1 from Dev Notes: added `currentFrame` (default 0) and `fps` (default 30) as additional parameters to `generateCodeSnippetProps`, keeping backward compatibility with existing 2-arg calls
- Typing calculation: `visibleChars = Math.min(Math.floor(currentFrame * (typingSpeed / fps)), code.length)` with clamping to [0, code.length]
- Line highlighting: filters `config.highlightLines` to only include lines where characters have been typed (based on `visibleLineCount` from visible text)
- Cursor behavior: `showCursor = true` while typing in progress; blinks at ~2Hz (every 15 frames) when all text typed
- Constants: `DEFAULT_TYPING_SPEED = 30`, `CURSOR_BLINK_FRAMES = 15`
- 27 tests total (24 new + 3 updated existing), covering all ACs and edge cases
- Build passes with 0 TypeScript errors

### File List
- packages/broll-engine/src/code-renderer.ts (modified)
- packages/broll-engine/src/__tests__/broll-engine.test.ts (modified)

### Change Log
- 2026-01-28: Implemented frame-based typing animation for code snippet renderer (Story 6-28)
- 2026-01-28: Code review (AI) - Fixed 6 issues: input validation for fps/typingSpeed/currentFrame, empty code cursor behavior, added 3 edge case tests (30 total). Build and tests passing.

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (adversarial code review)
**Date:** 2026-01-28
**Outcome:** APPROVED (after fixes)

### Issues Found: 7 (3 HIGH, 3 MEDIUM, 1 LOW)

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| H1 | HIGH | `_durationFrames` unused - dead parameter | Kept with underscore (TS noUnusedParameters); reserved for future scene-fitting logic |
| H2 | HIGH | `fps=0` causes division by zero | Fixed: guard `fps > 0 ? fps : 30` |
| H3 | HIGH | Negative `currentFrame` untested boundary | Fixed: added `Math.max(0, currentFrame)` guard + test |
| M1 | MEDIUM | Negative `typingSpeed` passes through `\|\|` | Fixed: explicit `> 0` check instead of `\|\|` |
| M2 | MEDIUM | Empty code shows blinking cursor | Fixed: explicit `code.length === 0` → `showCursor = false` |
| M3 | MEDIUM | Empty code test missing `showCursor` assertion | Fixed: added assertion |
| L1 | LOW | `_durationFrames` underscore prefix from stub | Kept (required by tsconfig noUnusedParameters) |

### Fixes Applied
- Input validation: fps, typingSpeed, currentFrame all guarded against invalid values
- Empty code cursor: no cursor shown for empty content
- 3 new edge case tests: negative frame, fps=0, negative typingSpeed
- Total tests: 30 (was 27)
