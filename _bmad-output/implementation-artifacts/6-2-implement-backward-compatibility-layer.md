# Story 6.2: Implement Backward Compatibility Layer

Status: done

## Story

As a developer,
I want compatibility utilities for V1 → V2 script output migration,
So that existing pipeline stages continue working during transition.

## Acceptance Criteria

1. **Given** the DirectionDocument schema from Story 6.1
   **When** I create `packages/script-gen/src/compatibility.ts`
   **Then** the following utilities are exported:
   - `isV2Output(output)` type guard returns true if output has version '2.0'
   - `getScriptText(output)` returns plain narration text (strips brackets for V1)
   - `getDirectionDocument(output, audioDurationSec)` returns DirectionDocument
   - `parseLegacyVisualCues(script, audioDurationSec)` converts V1 brackets to DirectionDocument

2. **And** V1 output format continues working with automatic conversion

3. **And** downstream stages (pronunciation, tts) use `getScriptText()` for narration

4. **And** visual-gen stage uses `getDirectionDocument()` for rendering

5. **And** unit tests verify both V1 and V2 paths work correctly

## Tasks / Subtasks

- [x] Task 1: Create Compatibility Module Structure (AC: 1)
  - [x] 1.1 Create `packages/script-gen/src/compatibility.ts` with proper imports from types.ts
  - [x] 1.2 Import required types: `ScriptGenOutput`, `ScriptGenOutputV1`, `ScriptGenOutputV2`, `DirectionDocument`, `isV2Output`, `MOTION_PRESETS`
  - [x] 1.3 Export the `isV2Output` type guard (re-export from types.ts)

- [x] Task 2: Implement getScriptText Function (AC: 1, 3)
  - [x] 2.1 Create `getScriptText(output: ScriptGenOutput): string` function
  - [x] 2.2 For V2 output: return `output.scriptText` directly
  - [x] 2.3 For V1 output: strip visual cue brackets using regex pattern
  - [x] 2.4 V1 bracket patterns to remove: `[VISUAL:...]`, `[PRONOUNCE:...]`, `[MUSIC:...]`, `[SFX:...]`
  - [x] 2.5 Preserve paragraph structure and punctuation
  - [x] 2.6 Trim whitespace and normalize newlines

- [x] Task 3: Implement parseLegacyVisualCues Function (AC: 1, 2)
  - [x] 3.1 Create `parseLegacyVisualCues(script: string, audioDurationSec: number): DirectionDocument`
  - [x] 3.2 Parse V1 script format: extract `[VISUAL:component_name]` tags
  - [x] 3.3 Split script into segments at visual cue boundaries
  - [x] 3.4 Map V1 component hints to ComponentName type (case-insensitive matching)
  - [x] 3.5 Generate UUID for each segment.id using crypto.randomUUID()
  - [x] 3.6 Calculate estimated timing: distribute audioDurationSec across segments proportionally by word count
  - [x] 3.7 Set default motion config using MOTION_PRESETS.standard
  - [x] 3.8 Set default globalAudio: { defaultMood: 'neutral', musicTransitions: 'smooth' }
  - [x] 3.9 Extract keywords from visual cue content (e.g., `[VISUAL:neural_network]` → keywords: ['neural', 'network'])
  - [x] 3.10 Parse `[PRONOUNCE:term:ipa]` tags into segment emphasis words

- [x] Task 4: Implement getDirectionDocument Function (AC: 1, 4)
  - [x] 4.1 Create `getDirectionDocument(output: ScriptGenOutput, audioDurationSec: number): DirectionDocument`
  - [x] 4.2 For V2 output: return `output.directionDocument` directly
  - [x] 4.3 For V1 output: call `parseLegacyVisualCues(output.script, audioDurationSec)`
  - [x] 4.4 Validate returned DirectionDocument against schema using `validateDirectionDocument()`

- [x] Task 5: Component Name Mapping Utility (AC: 1, 2)
  - [x] 5.1 Create `mapV1ComponentToV2(hint: string): ComponentName` function
  - [x] 5.2 Handle case-insensitive matching (NEURAL_NETWORK → NeuralNetworkAnimation)
  - [x] 5.3 Handle underscores and hyphens (code-highlight → CodeHighlight)
  - [x] 5.4 Provide fallback mapping: unknown → TextOnGradient
  - [x] 5.5 Create lookup table for all ComponentName values with common aliases

- [x] Task 6: Segment Type Detection (AC: 1, 2)
  - [x] 6.1 Create `detectSegmentType(text: string, index: number, totalSegments: number): SegmentType`
  - [x] 6.2 First segment defaults to 'intro'
  - [x] 6.3 Last segment defaults to 'outro'
  - [x] 6.4 Detect 'code_demo' from code block presence or programming keywords
  - [x] 6.5 Detect 'comparison' from comparison words (vs, compared, versus)
  - [x] 6.6 Default to 'explanation' for middle segments

- [x] Task 7: Export from Package Index (AC: 1)
  - [x] 7.1 Update `packages/script-gen/src/index.ts` to export compatibility utilities
  - [x] 7.2 Export: `getScriptText`, `getDirectionDocument`, `parseLegacyVisualCues`, `mapV1ComponentToV2`
  - [x] 7.3 Re-export `isV2Output` type guard (already exported from types.ts)

- [x] Task 8: Unit Tests for V1 → V2 Conversion (AC: 5)
  - [x] 8.1 Create `packages/script-gen/src/__tests__/compatibility.test.ts`
  - [x] 8.2 Test getScriptText with V2 output returns scriptText directly
  - [x] 8.3 Test getScriptText with V1 output strips all bracket patterns
  - [x] 8.4 Test parseLegacyVisualCues produces valid DirectionDocument
  - [x] 8.5 Test component name mapping covers all ComponentName values
  - [x] 8.6 Test segment type detection for edge cases
  - [x] 8.7 Test timing distribution is proportional to word count
  - [x] 8.8 Test empty segments handled gracefully
  - [x] 8.9 Test special characters and unicode preserved in narration text

- [x] Task 9: Integration Verification (AC: 2, 3, 4)
  - [x] 9.1 Verify V1 output from existing script-gen.ts works through compatibility layer
  - [x] 9.2 Document migration path for downstream stages (pronunciation, tts, visual-gen)
  - [x] 9.3 Run full build: `pnpm build` to verify no type errors

## Dev Notes

### Primary File to Create
**New file:** `packages/script-gen/src/compatibility.ts`

This file provides the bridge between V1 (legacy) and V2 (DirectionDocument) script output formats. The compatibility layer ensures zero-downtime migration for downstream stages.

### Architecture Compliance

#### Required Patterns (from project-context.md)
- **TypeScript Strict Mode:** All code must compile with strict: true
- **No console.log:** Use structured logger if logging needed (unlikely for pure utility functions)
- **Error Handling:** Use NexusError for any runtime errors (e.g., validation failures)
- **Naming Conventions:**
  - Functions: camelCase (`getScriptText`, `parseLegacyVisualCues`)
  - Constants: SCREAMING_SNAKE (any mapping constants)
  - Files: kebab-case (compatibility.ts follows this)

#### V1 Script Format Reference
V1 scripts contain inline visual cues that must be stripped for TTS:
```markdown
[VISUAL:neural_network] Today we're exploring transformer architectures.
[PRONOUNCE:GPT:dʒiː.piː.tiː] has revolutionized natural language processing.
[VISUAL:data_flow] The attention mechanism [SFX:whoosh] processes tokens in parallel.
[MUSIC:energetic] Let's dive into the technical details.
```

After stripping for TTS, output should be:
```
Today we're exploring transformer architectures. GPT has revolutionized natural language processing. The attention mechanism processes tokens in parallel. Let's dive into the technical details.
```

### Technical Requirements

#### Regex Patterns for V1 Bracket Stripping
```typescript
// Patterns to strip (preserving content before/after)
const VISUAL_CUE = /\[VISUAL:[^\]]+\]\s*/g;
const PRONOUNCE_CUE = /\[PRONOUNCE:([^:]+):[^\]]+\]/g; // Keep first group (the word)
const MUSIC_CUE = /\[MUSIC:[^\]]+\]\s*/g;
const SFX_CUE = /\[SFX:[^\]]+\]\s*/g;
```

#### Component Name Mapping Table
```typescript
const V1_COMPONENT_MAP: Record<string, ComponentName> = {
  // Exact matches (normalized to lowercase for lookup)
  'neural_network': 'NeuralNetworkAnimation',
  'neuralnetwork': 'NeuralNetworkAnimation',
  'data_flow': 'DataFlowDiagram',
  'dataflow': 'DataFlowDiagram',
  'comparison': 'ComparisonChart',
  'chart': 'ComparisonChart',
  'metrics': 'MetricsCounter',
  'counter': 'MetricsCounter',
  'product': 'ProductMockup',
  'mockup': 'ProductMockup',
  'code': 'CodeHighlight',
  'code_highlight': 'CodeHighlight',
  'transition': 'BrandedTransition',
  'lower_third': 'LowerThird',
  'lowerthird': 'LowerThird',
  'text': 'TextOnGradient',
  // Default fallback handled separately
};
```

#### Timing Distribution Algorithm
```typescript
// Distribute audioDurationSec across segments proportionally
function distributeTiming(segments: SegmentData[], totalDurationSec: number) {
  const totalWords = segments.reduce((sum, s) => sum + s.wordCount, 0);
  let currentTime = 0;

  return segments.map(segment => {
    const proportion = segment.wordCount / totalWords;
    const duration = totalDurationSec * proportion;
    const timing = {
      estimatedStartSec: currentTime,
      estimatedEndSec: currentTime + duration,
      estimatedDurationSec: duration,
      timingSource: 'estimated' as const
    };
    currentTime += duration;
    return timing;
  });
}
```

### Previous Story Intelligence (Story 6.1)

**Key learnings from Story 6.1 implementation:**
1. All Direction Document types are in `packages/script-gen/src/types.ts` (~1068 lines)
2. `isV2Output()` type guard already exists in types.ts - re-export it, don't duplicate
3. Zod validation via `validateDirectionDocument()` is available for runtime checks
4. `MOTION_PRESETS` constant provides default motion configs (use 'standard' for V1 conversion)
5. BRollSpec uses discriminated union - each type requires its config (not relevant for V1 conversion)
6. All 65 schema tests pass - schema is stable and can be relied upon

**Files to import from:**
- `./types` - All DirectionDocument types, schemas, and utilities

### Library/Framework Requirements

#### Dependencies (already in package.json from Story 6.1)
- `zod`: ^3.23.8 (for validation)

#### Node.js Built-ins
- `crypto.randomUUID()`: For generating segment IDs (Node 19+, or use polyfill)

### Testing Standards

- **Framework:** Vitest (project standard)
- **Location:** `packages/script-gen/src/__tests__/compatibility.test.ts`
- **Test structure:** Group by function, then by V1/V2 path

#### Test Fixtures
Create sample V1 and V2 outputs for testing:
```typescript
// Sample V1 output
const sampleV1Output: ScriptGenOutputV1 = {
  script: '[VISUAL:neural_network] Introduction text...',
  wordCount: 1500,
  artifactUrl: 'gs://nexus-ai-artifacts/2026-01-27/script-gen/script.md',
  draftUrls: { writer: '...', critic: '...', optimizer: '...' },
  regenerationAttempts: 0,
  providers: {
    writer: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
    critic: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
    optimizer: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 }
  }
};

// Sample V2 output - use DirectionDocument from types.ts
```

### Project Structure Notes

```
packages/script-gen/
├── package.json           # Has zod dependency
├── tsconfig.json          # Extends @nexus-ai/config
├── src/
│   ├── index.ts           # UPDATE: Add compatibility exports
│   ├── types.ts           # Contains all types (DO NOT MODIFY)
│   ├── compatibility.ts   # CREATE: This story's main file
│   ├── script-gen.ts      # Main logic (DO NOT MODIFY in this story)
│   └── __tests__/
│       ├── direction-schema.test.ts  # From Story 6.1 (65 tests)
│       └── compatibility.test.ts     # CREATE: Tests for this story
```

### References

- [Source: epics.md] Story requirements: `_bmad-output/planning-artifacts/epics.md` lines 2064-2083
- [Source: tech-spec] Architecture context: `_bmad-output/implementation-artifacts/tech-spec-nexus-video-enhancement-system.md`
- [Source: types.ts] Schema definitions: `packages/script-gen/src/types.ts` (1068 lines)
- [Source: project-context.md] Critical patterns: `_bmad-output/project-context.md`
- [Source: 6-1 story] Previous story learnings: `_bmad-output/implementation-artifacts/6-1-define-direction-document-schema.md`

### Git Intelligence

Recent commits for context:
- `f52175f` - Story 6.1: DirectionDocument schema with Zod validation
- `68c6e10` - Pipeline end-to-end data flow (shows stage wiring patterns)

Commit message pattern: `feat({packages}): {description} (Story X.Y)`

### Anti-Pattern Prevention

1. **DO NOT duplicate `isV2Output()`** - It already exists in types.ts, re-export it
2. **DO NOT modify types.ts** - All types are finalized in Story 6.1
3. **DO NOT use any/unknown** - Use proper types from types.ts imports
4. **DO NOT skip validation** - Always call `validateDirectionDocument()` on generated docs
5. **DO NOT hardcode segment counts** - Parse dynamically from V1 script structure

### Edge Cases to Handle

1. **Empty script:** Return empty DirectionDocument with single empty segment
2. **No visual cues:** Treat entire script as one 'explanation' segment
3. **Consecutive visual cues:** Each becomes separate segment (even if no text between)
4. **Malformed brackets:** Gracefully skip, log warning if needed
5. **Unicode/emoji in text:** Preserve exactly, only strip bracket patterns
6. **Very long scripts:** No artificial limits, proportional timing still works

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 153 tests pass (52 compatibility + 65 direction schema + 22 prompts + 14 script-gen)
- TypeScript build completes with no errors
- No regressions introduced

### Completion Notes List

- Created `packages/script-gen/src/compatibility.ts` - V1 → V2 compatibility layer (~500 lines)
- Implemented `getScriptText()` - extracts plain narration text, strips V1 bracket tags for TTS
- Implemented `parseLegacyVisualCues()` - converts V1 scripts to full DirectionDocument with proper timing
- Implemented `getDirectionDocument()` - universal accessor works with both V1 and V2 outputs
- Implemented `mapV1ComponentToV2()` - maps 20+ V1 component hints to V2 ComponentName enum
- Implemented `detectSegmentType()` - intelligent segment type detection based on content and position
- Re-exported `isV2Output` type guard from types.ts
- Updated `packages/script-gen/src/index.ts` with all new exports
- Created comprehensive test suite with 52 tests covering all functions and edge cases
- Migration path for downstream stages:
  - pronunciation/tts: Use `getScriptText(output)` for plain narration text
  - visual-gen: Use `getDirectionDocument(output, audioDurationSec)` for video blueprint

### File List

**Created:**
- `packages/script-gen/src/compatibility.ts` - Main compatibility layer implementation
- `packages/script-gen/src/__tests__/compatibility.test.ts` - 52 unit tests

**Modified:**
- `packages/script-gen/src/index.ts` - Added exports for compatibility utilities

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (code-review workflow)
**Date:** 2026-01-27

**Issues Found & Fixed:**

1. **[HIGH] V2 Output Validation Missing** - `getDirectionDocument()` now validates V2 directionDocument via `validateDirectionDocument()` (previously bypassed)

2. **[MEDIUM] Input Validation Added** - Both `parseLegacyVisualCues()` and `getDirectionDocument()` now validate `audioDurationSec` is a positive finite number

3. **[MEDIUM] Test Coverage Expanded** - Added 8 new tests for edge cases:
   - `audioDurationSec = 0` (throws)
   - `audioDurationSec < 0` (throws)
   - `audioDurationSec = Infinity` (throws)
   - `audioDurationSec = NaN` (throws)
   - V2 directionDocument validation

4. **[LOW] Misleading Comment Removed** - Removed incorrect comment about isV2Output re-export in index.ts

**Outcome:** APPROVED - All issues fixed, 153 tests passing, build clean

### Change Log

- 2026-01-27: Story 6.2 implemented - V1 → V2 backward compatibility layer for script generation output
- 2026-01-27: Code review completed - Fixed validation gaps, added 8 edge case tests (153 total)

