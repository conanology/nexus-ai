# Story 6.4: Update TTS to Read Script Only

Status: done

## Story

As a developer,
I want TTS to read only from script.md content,
So that no stage directions or visual cues are spoken aloud.

## Acceptance Criteria

1. **Given** dual output from Story 6.3
   **When** I update `packages/tts/src/tts.ts` and `packages/pronunciation/src/pronunciation-stage.ts`
   **Then** both stages use `getScriptText(scriptGenOutput)` for input

2. **And** no bracket patterns `[VISUAL:...]` or `[PRONOUNCE:...]` appear in TTS input

3. **And** pronunciation stage processes only narration text

4. **And** SSML tagging applies to narration text only

5. **And** TTS output includes `audioDurationSec` for downstream timing

6. **And** existing tests updated to verify clean narration input

7. **And** integration test confirms no stage directions in synthesized audio

## Tasks / Subtasks

- [x] Task 1: Update Pronunciation Stage Input Processing (AC: 1, 2, 3, 4)
  - [x] 1.1 Add `@nexus-ai/script-gen` as dependency to `packages/pronunciation/package.json`
  - [x] 1.2 Update `packages/pronunciation/src/pronunciation-stage.ts`:
    - Import `getScriptText` from `@nexus-ai/script-gen`
    - Modify `PronunciationInput` interface to accept `ScriptGenOutput` OR string
    - Use `getScriptText()` to extract clean narration from input
  - [x] 1.3 Add type guard to handle both V1 (string) and V2 (ScriptGenOutput) inputs
  - [x] 1.4 Verify term extraction operates on clean narration (no brackets)
  - [x] 1.5 Verify SSML tagging applies to clean narration

- [x] Task 2: Verify TTS Stage (AC: 1, 2, 5) - **NO CHANGES NEEDED**
  - [x] 2.1 Verified: TTS already receives `ssmlScript` from pronunciation stage
  - [x] 2.2 Verified: TTS does NOT need changes - input is already clean SSML
  - [x] 2.3 Verified: `audioDurationSec` is already in TTS output (line 319, 483 in tts.ts)
  - [N/A] 2.4 Not needed - alias already exists

- [x] Task 3: Update Orchestrator Data Flow (AC: 1)
  - [x] 3.1 Review `apps/orchestrator/src/pipeline.ts` data chaining
  - [x] 3.2 Verify script-gen output flows correctly to pronunciation stage
  - [x] 3.3 Update orchestrator stage input building if needed to pass full ScriptGenOutput

- [x] Task 4: Update Unit Tests (AC: 6, 7)
  - [x] 4.1 Update `packages/pronunciation/src/__tests__/pronunciation-stage.test.ts`:
    - Test with V1 input (plain string with brackets)
    - Test with V2 input (ScriptGenOutput object)
    - Verify brackets are stripped before processing
    - Verify SSML output contains no visual cue brackets
    - Test empty input error handling
  - [N/A] 4.2 TTS tests not needed - TTS stage unchanged, receives clean SSML from pronunciation
  - [x] 4.3 Create `packages/pronunciation/src/__tests__/v2-compatibility.test.ts`:
    - Test `getScriptText()` integration
    - Test both V1 and V2 output handling
    - **Added:** Integration tests verifying no stage directions reach TTS (AC7)

- [x] Task 5: Integration Verification (AC: 6, 7)
  - [x] 5.1 Full build passes: `pnpm build`
  - [x] 5.2 All tests pass: `pnpm test`
  - [x] 5.3 Verify no bracket patterns make it to TTS

## Dev Notes

### Primary Files to Modify

**Main implementation:**
- `packages/pronunciation/src/pronunciation-stage.ts` - Update input processing to use `getScriptText()`
- `packages/pronunciation/package.json` - Add `@nexus-ai/script-gen` dependency

**Potentially unchanged (verify):**
- `packages/tts/src/tts.ts` - May not need changes if input is already clean SSML

**Test files:**
- `packages/pronunciation/src/__tests__/pronunciation-stage.test.ts`
- `packages/pronunciation/src/__tests__/v2-compatibility.test.ts` (new)

### Architecture Compliance

#### Required Patterns (from project-context.md)

1. **StageInput/StageOutput Contracts** - Maintain `StageInput<PronunciationInput>` and `StageOutput<PronunciationOutput>` contracts

2. **Structured Logger** - Use `logger` from `@nexus-ai/core`, no console.log

3. **Error Handling** - Use `NexusError` for all errors:
```typescript
throw NexusError.critical('NEXUS_PRONUNCIATION_INVALID_INPUT', 'Input must be string or ScriptGenOutput', 'pronunciation');
```

4. **Backward Compatibility** - MUST support both V1 (string) and V2 (ScriptGenOutput) inputs

#### Naming Conventions
- Functions: camelCase (`getScriptText`, `isScriptGenOutput`)
- Interfaces: PascalCase (`PronunciationInput`, `ScriptGenOutput`)
- Files: kebab-case (existing file names)

### Technical Requirements

#### Current Data Flow (Before Story 6.4)
```
script-gen → { script: string with [VISUAL:...] brackets }
                ↓
pronunciation → extracts terms from bracketed script
                ↓
              → { ssmlScript: SSML with brackets stripped internally }
                ↓
tts → synthesizes SSML
```

#### New Data Flow (After Story 6.4)
```
script-gen → { version: '2.0', scriptText: clean narration, directionDocument: DirectionDocument }
                ↓
pronunciation → import { getScriptText } from '@nexus-ai/script-gen'
              → const cleanScript = getScriptText(scriptGenOutput)  // Handles V1 and V2
              → extracts terms from CLEAN script
                ↓
              → { ssmlScript: SSML from clean narration }
                ↓
tts → synthesizes SSML (no brackets possible)
```

#### Key Import from script-gen Package
```typescript
// packages/pronunciation/src/pronunciation-stage.ts
import { getScriptText, type ScriptGenOutput } from '@nexus-ai/script-gen';
```

#### Updated PronunciationInput Interface
```typescript
/**
 * Input for the pronunciation stage
 * Supports both V1 (string) and V2 (ScriptGenOutput) inputs for backward compatibility
 */
export interface PronunciationInput {
  /** Script content - either raw string (V1) or full ScriptGenOutput (V2) */
  script: string | ScriptGenOutput;
  /** Pass-through topic data for downstream stages */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}
```

#### Type Guard for Input Handling
```typescript
import { isV2Output, type ScriptGenOutput } from '@nexus-ai/script-gen';

function extractCleanScript(input: string | ScriptGenOutput): string {
  if (typeof input === 'string') {
    // V1: Legacy string input - getScriptText handles bracket stripping
    return getScriptText({ script: input } as any);
  }
  // V2: Full ScriptGenOutput - getScriptText returns scriptText or strips brackets
  return getScriptText(input);
}
```

### Previous Story Intelligence (Story 6.3)

**Key learnings from Story 6.3:**
1. `getScriptText()` already handles both V1 and V2 outputs - **USE THIS**
2. For V2: Returns `scriptText` directly (clean narration)
3. For V1: Strips all bracket patterns automatically:
   - `[VISUAL:...]` tags
   - `[PRONOUNCE:term:ipa]` tags (replaces with just term)
   - `[MUSIC:...]` tags
   - `[SFX:...]` tags
4. Normalizes whitespace after stripping

**Files to import from:**
- `@nexus-ai/script-gen` exports: `getScriptText`, `isV2Output`, `type ScriptGenOutput`

### Library/Framework Requirements

#### Dependencies to Add
```json
// packages/pronunciation/package.json
{
  "dependencies": {
    "@nexus-ai/script-gen": "workspace:*"
  }
}
```

### Testing Standards

- **Framework:** Vitest (project standard)
- **Existing tests:** `pronunciation-stage.test.ts` (3 tests), `pronunciation-client.test.ts`, `extractor.test.ts`, `ssml-tagger.test.ts`
- **New tests:** `v2-compatibility.test.ts` for getScriptText integration

#### Test Fixtures
```typescript
// V1 input (legacy string with brackets)
const v1Script = `
[VISUAL:neural_network]
Today we're exploring transformers.

[VISUAL:code_highlight]
Here's the attention mechanism:
[PRONOUNCE:softmax:ˈsɒftmæks]

[MUSIC:upbeat]
Let's dive in!
`;

// V2 input (ScriptGenOutput object)
const v2Output: ScriptGenOutput = {
  version: '2.0',
  script: 'Today we\'re exploring transformers. Here\'s the attention mechanism: softmax. Let\'s dive in!',
  scriptText: 'Today we\'re exploring transformers.\n\nHere\'s the attention mechanism: softmax.\n\nLet\'s dive in!',
  scriptUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/script.md',
  directionDocument: { /* ... */ },
  directionUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/direction.json',
  wordCount: 15,
  artifactUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/script.md',
  draftUrls: {},
};

// Expected clean output (no brackets)
const expectedCleanScript = `Today we're exploring transformers.

Here's the attention mechanism: softmax.

Let's dive in!`;
```

### Project Structure Notes

```
packages/pronunciation/
├── package.json           # ADD: @nexus-ai/script-gen dependency
├── tsconfig.json          # Extends @nexus-ai/config
├── src/
│   ├── index.ts           # Public exports (no changes)
│   ├── types.ts           # Type definitions (no changes needed)
│   ├── pronunciation-stage.ts  # UPDATE: Use getScriptText()
│   ├── pronunciation-client.ts # No changes
│   ├── extractor.ts       # No changes (already processes plain text)
│   ├── ssml-tagger.ts     # No changes (already processes plain text)
│   └── __tests__/
│       ├── pronunciation-stage.test.ts  # UPDATE: Add V1/V2 tests
│       └── v2-compatibility.test.ts     # CREATE: New integration tests
```

### References

- [Source: epics.md] Story requirements: lines 2112-2129
- [Source: project-context.md] Critical patterns for stage implementation
- [Source: architecture.md] Stage execution pattern and provider abstraction
- [Source: compatibility.ts] `getScriptText()` implementation: `packages/script-gen/src/compatibility.ts`
- [Source: pronunciation-stage.ts] Current implementation: `packages/pronunciation/src/pronunciation-stage.ts`
- [Source: 6-3 story] Previous story with getScriptText: `_bmad-output/implementation-artifacts/6-3-update-script-generation-dual-output.md`

### Git Intelligence

Recent commits for context:
- `f3d6719` - feat(script-gen): implement backward compatibility layer and dual output (Stories 6.2, 6.3)
- `309b5ea` - docs: add Epic 6 planning artifacts and tech spec
- `f52175f` - feat(script-gen): define DirectionDocument schema with Zod validation (Story 6.1)

Commit message pattern: `feat(pronunciation): update to use getScriptText for clean input (Story 6.4)`

### Anti-Pattern Prevention

1. **DO NOT modify TTS stage** unless absolutely necessary - it receives clean SSML from pronunciation
2. **DO NOT duplicate bracket stripping logic** - use `getScriptText()` from script-gen package
3. **DO NOT break V1 backward compatibility** - must support both string and ScriptGenOutput inputs
4. **DO NOT change existing PronunciationOutput interface** - only PronunciationInput needs update
5. **DO NOT forget to add workspace dependency** - `@nexus-ai/script-gen: "workspace:*"`
6. **DO NOT use console.log** - use structured logger from @nexus-ai/core

### Edge Cases to Handle

1. **V1 string input with no brackets:**
   - Pass through as-is (getScriptText handles this)

2. **V1 string input with brackets:**
   - getScriptText strips all bracket patterns

3. **V2 ScriptGenOutput input:**
   - getScriptText returns scriptText directly

4. **Empty script:**
   - Should throw NexusError.critical with NEXUS_PRONUNCIATION_INVALID_INPUT

5. **Orchestrator passes wrong type:**
   - Type guard should detect and handle gracefully

### Minimal Change Approach

This story requires **minimal changes** because:

1. **script-gen package** already exports `getScriptText()` which handles all bracket stripping
2. **pronunciation stage** just needs to call `getScriptText()` on input
3. **TTS stage** already receives clean SSML from pronunciation - no changes needed
4. **Main work** is updating the input processing and adding tests

**Estimated scope:**
- ~20 lines of code changes in pronunciation-stage.ts
- ~5 lines in package.json (add dependency)
- ~100 lines of new tests

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered

### Completion Notes List

1. **Task 1 Complete**: Updated pronunciation-stage.ts to use `getScriptText()` from `@nexus-ai/script-gen`. Added dependency to package.json. The `PronunciationInput` interface now accepts both `string` (V1) and `ScriptGenOutput` (V2) for backward compatibility. Added `isScriptGenOutput` type guard and `extractCleanScript` helper function.

2. **Task 2 Verified**: TTS stage does NOT need changes. It already receives clean SSML from the pronunciation stage and already includes `audioDurationSec` as an alias (line 483 in tts.ts).

3. **Task 3 Verified**: Orchestrator passes `previousStageData` directly to the next stage via `buildStageInput`. No changes needed - the script-gen output flows correctly to pronunciation stage.

4. **Task 4 Complete**:
   - Updated pronunciation-stage.test.ts with V1/V2 input handling tests and error handling tests
   - Created v2-compatibility.test.ts with comprehensive tests for getScriptText integration
   - Added AC7 integration tests verifying no stage directions reach TTS
   - TTS tests not needed - TTS stage unchanged (receives clean SSML from pronunciation)

5. **Task 5 Verified**:
   - Build passes: `pnpm build` succeeds
   - All tests pass: 126 tests in pronunciation package (9 test files)
   - No bracket patterns can reach TTS - getScriptText strips all [VISUAL:], [PRONOUNCE:], [MUSIC:], [SFX:] tags

### Implementation Summary

- **Minimal change approach**: Only pronunciation-stage.ts modified
- **Backward compatible**: Supports both V1 (string) and V2 (ScriptGenOutput) inputs
- **Uses existing utility**: Leverages `getScriptText()` from script-gen package
- **TTS unchanged**: Already receives clean SSML from pronunciation stage
- **Type-safe**: Proper V1 wrapper instead of type assertion hack
- **Validated**: Empty input throws NexusError with proper error code

### File List

**Modified:**
- packages/pronunciation/package.json (added @nexus-ai/script-gen dependency)
- packages/pronunciation/src/pronunciation-stage.ts (updated input processing, improved type safety)
- packages/pronunciation/src/__tests__/pronunciation-stage.test.ts (added V1/V2 tests, error handling tests)
- pnpm-lock.yaml (updated for new dependency)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status: backlog → review)

**Created:**
- packages/pronunciation/src/__tests__/v2-compatibility.test.ts (integration tests including AC7 verification)

**Verified (no changes needed):**
- packages/tts/src/tts.ts (already has audioDurationSec alias at lines 319, 483)
- apps/orchestrator/src/pipeline.ts (passes data correctly)
- apps/orchestrator/src/stages.ts (stage registry unchanged)

### Change Log

- 2026-01-27: Implemented Story 6.4 - Updated pronunciation stage to use getScriptText for clean script input. Added V1/V2 backward compatibility. All 126 tests pass.
- 2026-01-27: **Code Review Fixes** (AI Review):
  - Fixed type safety: Replaced `as ScriptGenOutput` type assertion with proper V1 wrapper object
  - Added empty input validation with NexusError.critical
  - Improved isScriptGenOutput type guard to check required V1 fields
  - Added AC7 integration tests verifying no stage directions reach TTS
  - Added error handling tests for empty/whitespace input
  - Corrected Task 4.2 marking (N/A - TTS tests not needed)
  - Updated File List to include sprint-status.yaml and pnpm-lock.yaml
