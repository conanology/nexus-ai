# Story 6.27: Create B-Roll Engine Package

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a broll-engine package structure,
so that synthetic B-Roll can be generated from direction.

## Acceptance Criteria

1. **AC1: Package Structure** - Create `packages/broll-engine/` with:
   - `package.json` with `@nexus-ai/broll-engine` name, version `0.1.0`, `"type": "module"`, exports pointing to `./dist/index.js` and `./dist/index.d.ts`
   - `tsconfig.json` extending `../../packages/config/tsconfig.json` with `rootDir: "src"`, `outDir: "dist"`
   - `src/index.ts` exporting the public API (types + functions)
   - `src/types.ts` with B-Roll engine types
   - `src/code-renderer.ts` stub for code snippet rendering (Story 6-28)
   - `src/browser-demo.ts` stub for browser demo rendering (Story 6-30)
   - `src/__tests__/` directory for unit tests

2. **AC2: Types** - `src/types.ts` defines broll-engine-specific types:
   - Re-exports relevant B-Roll types from `@nexus-ai/script-gen` (BRollSpec, CodeBRollConfig, BrowserBRollConfig, BRollType, BRollPosition, BRollBase, BrowserAction, BrowserActionType, BrowserTemplateId, etc.)
   - `CodeSnippetProps` interface: `{ code: string; language: string; visibleChars: number; highlightLines: number[]; showCursor: boolean; theme: 'dark' | 'light'; showLineNumbers: boolean }`
   - `BrowserDemoProps` interface: `{ url: string; content: React.ReactNode | null; actions: BrowserAction[]; viewport: { width: number; height: number }; style?: BrowserStyle }` (or simplified without React dependency — use generic typing)
   - `BrowserStyle` interface: `{ theme: 'light' | 'dark' }`
   - `BRollEngineInput` interface for the overall engine input (BRollSpec + durationFrames + fps)
   - `BRollEngineOutput` interface for the overall engine output (props for Remotion components)

3. **AC3: Code Renderer Stub** - `src/code-renderer.ts` exports `generateCodeSnippetProps(config: CodeBRollConfig, durationFrames: number): CodeSnippetProps` function that:
   - Returns a stub/placeholder `CodeSnippetProps` with config pass-through values
   - Includes a `// TODO: Full implementation in Story 6-28` comment
   - Returns `visibleChars: config.content.length` (shows all code by default)

4. **AC4: Browser Demo Stub** - `src/browser-demo.ts` exports `generateBrowserDemoProps(config: BrowserBRollConfig, durationFrames: number): BrowserDemoProps` function that:
   - Returns a stub/placeholder `BrowserDemoProps` with config pass-through values
   - Includes a `// TODO: Full implementation in Story 6-30` comment

5. **AC5: Index Exports** - `src/index.ts` exports:
   - All types from `types.ts`
   - `generateCodeSnippetProps` from `code-renderer.ts`
   - `generateBrowserDemoProps` from `browser-demo.ts`

6. **AC6: Tests** - Unit tests in `src/__tests__/broll-engine.test.ts`:
   - Test `generateCodeSnippetProps` returns valid `CodeSnippetProps` with correct pass-through values
   - Test `generateBrowserDemoProps` returns valid `BrowserDemoProps` with correct pass-through values
   - Test that types are properly exported (type-level checks via import)
   - All tests pass via `pnpm test`

7. **AC7: Build Passes** - `pnpm build` succeeds with no TypeScript errors, including the new package.

## Tasks / Subtasks

- [x] Task 1: Create package directory and configuration files (AC: 1)
  - [x] 1.1: Create `packages/broll-engine/package.json` following audio-mixer conventions (`@nexus-ai/broll-engine`, version 0.1.0, type module, exports, scripts)
  - [x] 1.2: Create `packages/broll-engine/tsconfig.json` extending base config
  - [x] 1.3: Run `pnpm install` to register the workspace package

- [x] Task 2: Create types file (AC: 2)
  - [x] 2.1: Create `packages/broll-engine/src/types.ts` with re-exports from `@nexus-ai/script-gen`
  - [x] 2.2: Define `CodeSnippetProps` interface
  - [x] 2.3: Define `BrowserDemoProps` interface (without React dependency — use generic or string-based approach)
  - [x] 2.4: Define `BrowserStyle` interface
  - [x] 2.5: Define `BRollEngineInput` interface (BRollSpec + durationFrames + fps)
  - [x] 2.6: Define `BRollEngineOutput` interface (union of component props)

- [x] Task 3: Create code renderer stub (AC: 3)
  - [x] 3.1: Create `packages/broll-engine/src/code-renderer.ts`
  - [x] 3.2: Implement stub `generateCodeSnippetProps` returning pass-through values
  - [x] 3.3: Add TODO comment for Story 6-28

- [x] Task 4: Create browser demo stub (AC: 4)
  - [x] 4.1: Create `packages/broll-engine/src/browser-demo.ts`
  - [x] 4.2: Implement stub `generateBrowserDemoProps` returning pass-through values
  - [x] 4.3: Add TODO comment for Story 6-30

- [x] Task 5: Create index exports (AC: 5)
  - [x] 5.1: Create `packages/broll-engine/src/index.ts` with all type and function exports

- [x] Task 6: Create unit tests (AC: 6)
  - [x] 6.1: Create `packages/broll-engine/src/__tests__/broll-engine.test.ts`
  - [x] 6.2: Test `generateCodeSnippetProps` with sample `CodeBRollConfig`
  - [x] 6.3: Test `generateBrowserDemoProps` with sample `BrowserBRollConfig`
  - [x] 6.4: Test type exports compile correctly

- [x] Task 7: Build and test verification (AC: 7)
  - [x] 7.1: Run `pnpm build` — must pass with new package included (18/18 tasks)
  - [x] 7.2: Run `pnpm test` — all broll-engine tests pass (6/6 tests)

## Dev Notes

### Architecture Constraints

- **Monorepo**: Turborepo + pnpm workspaces. New package at `packages/broll-engine/`
- **TypeScript strict mode**: All code must compile under strict
- **ESM only**: `"type": "module"` in package.json, use `.js` extensions in imports
- **No console.log**: Use structured logger from `@nexus-ai/core` if logging needed
- **Node 20 LTS**: Native `fetch()`, `fs/promises`, etc. available
- **Package naming**: `@nexus-ai/broll-engine`

### Dependencies

```json
{
  "dependencies": {
    "@nexus-ai/core": "workspace:*",
    "@nexus-ai/script-gen": "workspace:*"
  },
  "devDependencies": {
    "@nexus-ai/config": "workspace:*",
    "typescript": "^5.3.0",
    "vitest": "^1.1.0"
  }
}
```

- `@nexus-ai/script-gen` provides `BRollSpec`, `CodeBRollConfig`, `BrowserBRollConfig`, `BRollType`, `BRollPosition`, `BRollBase`, `BrowserAction`, `BrowserActionType`, `BrowserTemplateId`, `DiagramBRollConfig`, `AnimationBRollConfig`, `StaticBRollConfig` and all other B-Roll types
- `@nexus-ai/core` provides `logger`, `NexusError`, stage types if needed later

### BRollSpec Types (from @nexus-ai/script-gen)

The B-Roll types are defined in `packages/script-gen/src/types.ts` (lines 160-464). Key types:

```typescript
type BRollType = 'code' | 'browser' | 'diagram' | 'animation' | 'static';
type BRollPosition = 'full' | 'left' | 'right' | 'pip';
type BrowserActionType = 'click' | 'type' | 'scroll' | 'highlight' | 'wait';
type BrowserTemplateId = 'api-request' | 'form-submit' | 'dashboard' | 'custom';

interface BRollBase {
  overlay: boolean;
  overlayOpacity?: number;
  position?: BRollPosition;
  startOffset: number;
  duration: number;
}

interface CodeBRollConfig {
  content: string;
  language: string;
  highlightLines?: number[];
  typingEffect: boolean;
  typingSpeed: number;
  theme: 'dark' | 'light';
  showLineNumbers: boolean;
}

interface BrowserBRollConfig {
  url: string;
  templateId: BrowserTemplateId;
  actions: BrowserAction[];
  viewport: { width: number; height: number };
}

// Discriminated union:
type BRollSpec = CodeBRoll | BrowserBRoll | DiagramBRoll | AnimationBRoll | StaticBRoll;
```

**DO NOT re-define these types.** Re-export them from `@nexus-ai/script-gen`.

### Code Renderer Stub Pattern

```typescript
import type { CodeBRollConfig } from '@nexus-ai/script-gen';
import type { CodeSnippetProps } from './types.js';

// TODO: Full implementation in Story 6-28
export function generateCodeSnippetProps(
  config: CodeBRollConfig,
  durationFrames: number,
): CodeSnippetProps {
  return {
    code: config.content,
    language: config.language,
    visibleChars: config.content.length, // Show all by default
    highlightLines: config.highlightLines ?? [],
    showCursor: false,
    theme: config.theme,
    showLineNumbers: config.showLineNumbers,
  };
}
```

### Browser Demo Stub Pattern

```typescript
import type { BrowserBRollConfig } from '@nexus-ai/script-gen';
import type { BrowserDemoProps } from './types.js';

// TODO: Full implementation in Story 6-30
export function generateBrowserDemoProps(
  config: BrowserBRollConfig,
  durationFrames: number,
): BrowserDemoProps {
  return {
    url: config.url,
    actions: config.actions,
    viewport: config.viewport,
    style: { theme: 'light' },
  };
}
```

### Package.json Template (follow audio-mixer pattern)

```json
{
  "name": "@nexus-ai/broll-engine",
  "version": "0.1.0",
  "description": "B-Roll generation engine for NEXUS-AI pipeline - code snippets, browser demos, diagrams",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint . --ext .ts",
    "test": "vitest",
    "test:run": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "keywords": ["nexus-ai", "broll", "b-roll", "code-renderer", "browser-demo"],
  "author": "Cryptology",
  "license": "MIT",
  "dependencies": {
    "@nexus-ai/core": "workspace:*",
    "@nexus-ai/script-gen": "workspace:*"
  },
  "devDependencies": {
    "@nexus-ai/config": "workspace:*",
    "typescript": "^5.3.0",
    "vitest": "^1.1.0"
  }
}
```

### tsconfig.json Template

```json
{
  "extends": "../../packages/config/tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/__tests__/**", "tests/**/*", "**/*.test.ts"]
}
```

### Existing Code to Reuse (DO NOT RECREATE)

- **BRollSpec** and all B-Roll types from `@nexus-ai/script-gen` — re-export, never re-define
- **`logger`** from `@nexus-ai/core` — if logging is needed
- **`NexusError`** from `@nexus-ai/core` — if error handling is needed
- **Package structure** from `packages/audio-mixer/` — follow exact same conventions

### Test Strategy

Create `packages/broll-engine/src/__tests__/broll-engine.test.ts` using Vitest. Tests should:
- Import functions and types from the package
- Call `generateCodeSnippetProps` with a sample `CodeBRollConfig` and verify returned `CodeSnippetProps`
- Call `generateBrowserDemoProps` with a sample `BrowserBRollConfig` and verify returned `BrowserDemoProps`
- No mocking needed for stub implementations

### Previous Story Intelligence (6-26)

- Story 6-26 integrated audio-mixer into visual-gen pipeline
- Pattern: workspace dependency `"@nexus-ai/audio-mixer": "workspace:*"` added to dependent package
- After adding workspace dependency, must run `pnpm install` to update lockfile
- Build: 17/17 tasks pass with Turborepo
- Used `vi.hoisted()` pattern for mock variable declarations in Vitest tests
- Pre-existing test failures in packages/core (health.test.ts, execute-stage.test.ts) are unrelated — ignore them

### Git Intelligence

Recent commits: `feat(visual-gen): integrate audio mixer into visual-gen (Story 6-26)`, `feat(audio-mixer): implement audio mixer quality gate (Story 6-25)`, etc.
This story commit: `feat(broll-engine): create broll-engine package (Story 6-27)`

### Project Structure Notes

- New package at `packages/broll-engine/` following monorepo conventions
- No modifications to existing packages (this is a new standalone package)
- Downstream stories 6-28 through 6-31 will build on this package
- Types re-exported from `@nexus-ai/script-gen` to provide a single import point for broll consumers

### References

- [Source: _bmad-output/planning-artifacts/epics.md - Epic 6, Stories 6.27-6.34]
- [Source: _bmad-output/project-context.md - Technology Stack, Naming Conventions]
- [Source: packages/script-gen/src/types.ts:160-464 - BRollSpec types, CodeBRollConfig, BrowserBRollConfig]
- [Source: packages/audio-mixer/package.json - Package structure template]
- [Source: packages/audio-mixer/tsconfig.json - Build configuration template]
- [Source: packages/audio-mixer/src/index.ts - Export pattern template]
- [Source: _bmad-output/implementation-artifacts/6-26-integrate-audio-mixer-visual-gen.md - Previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed TS6133 unused parameter error by prefixing `durationFrames` with underscore in stubs
- Fixed test assertion: `'const x = 42;'` is 13 chars, not 14

### Completion Notes List

- Created `@nexus-ai/broll-engine` package with full structure following audio-mixer conventions
- Re-exported all B-Roll types from `@nexus-ai/script-gen` (18 types total)
- Defined 5 new broll-engine-specific interfaces: CodeSnippetProps, BrowserDemoProps, BrowserStyle, BRollEngineInput, BRollEngineOutput
- Implemented `generateCodeSnippetProps` stub with config pass-through values
- Implemented `generateBrowserDemoProps` stub with config pass-through values
- BrowserDemoProps.content typed as `unknown` to avoid React dependency (story allows generic typing)
- 6 unit tests covering both stub functions and type export verification
- Build: 18/18 Turborepo tasks pass
- Tests: 6/6 broll-engine tests pass
- Pre-existing failures in packages/core and packages/youtube are unrelated

### Change Log

- 2026-01-28: Created broll-engine package with stub implementations for code renderer and browser demo
- 2026-01-28: Code review (AI) — Fixed 4 issues: M1 (added pnpm-lock.yaml to File List), M2 (BRollEngineOutput.type now uses BRollType), M3 (documented forward-compatible props union), M4 (added test for BrowserAction with only required fields). Build 18/18, tests 7/7 pass. Status → done

### File List

- packages/broll-engine/package.json (new)
- packages/broll-engine/tsconfig.json (new)
- packages/broll-engine/src/types.ts (new)
- packages/broll-engine/src/code-renderer.ts (new)
- packages/broll-engine/src/browser-demo.ts (new)
- packages/broll-engine/src/index.ts (new)
- packages/broll-engine/src/__tests__/broll-engine.test.ts (new)
- pnpm-lock.yaml (modified - workspace registration)
