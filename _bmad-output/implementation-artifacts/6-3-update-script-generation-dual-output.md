# Story 6.3: Update Script Generation for Dual Output

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want script-gen to produce separate script.md and direction.json files,
So that content and visual direction are cleanly separated.

## Acceptance Criteria

1. **Given** the compatibility layer from Story 6.2
   **When** I update `packages/script-gen/src/script-gen.ts`
   **Then** multi-agent pipeline produces two outputs:
   - `script.md`: Plain narration text (no brackets, no stage directions)
   - `direction.json`: Visual/audio blueprint with segment timing

2. **And** `ScriptGenOutput` includes:
   - `version: '2.0'`
   - `scriptText`: string (plain narration)
   - `scriptUrl`: GCS URL to script.md
   - `directionDocument`: DirectionDocument object
   - `directionUrl`: GCS URL to direction.json

3. **And** estimated timing is calculated: `estimatedDurationSec = wordCount / 2.5` (150 WPM)

4. **And** segment boundaries align with natural paragraph breaks

5. **And** visual cue extraction moves from inline brackets to direction.json

6. **And** both artifacts stored to Cloud Storage at `{date}/script-gen/`

## Tasks / Subtasks

- [x] Task 1: Update Optimizer Prompt for Dual Output (AC: 1, 4, 5)
  - [x] 1.1 Update `packages/script-gen/src/prompts.ts` to modify `buildOptimizerPrompt()`:
    - Instruct LLM to produce TWO outputs in structured format
    - First: Pure narration text (no brackets, suitable for TTS)
    - Second: JSON direction document with segment structure
  - [x] 1.2 Define prompt template for dual output structure:
    - Output format: `## NARRATION\n{text}\n\n## DIRECTION\n{json}`
    - Segment boundaries should align with paragraph breaks
    - Visual cues mapped to ComponentName values
  - [x] 1.3 Ensure prompt instructs proper JSON structure matching DirectionDocumentSchema
  - [x] 1.4 Add estimation instruction: `estimatedDurationSec = wordCount / 2.5`

- [x] Task 2: Parse Dual Output from Optimizer (AC: 1, 2, 5)
  - [x] 2.1 Create `parseDualOutput(content: string): { narration: string; direction: DirectionDocument | null }` function
  - [x] 2.2 Implement regex extraction for `## NARRATION` section
  - [x] 2.3 Implement JSON extraction from `## DIRECTION` section
  - [x] 2.4 Validate direction JSON against `DirectionDocumentSchema` using `safeValidateDirectionDocument()`
  - [x] 2.5 Handle parse failures gracefully:
    - If direction parsing fails → use `parseLegacyVisualCues()` from compatibility.ts as fallback
    - Log warning for parse failures

- [x] Task 3: Update executeScriptGen to Produce V2 Output (AC: 2, 3, 6)
  - [x] 3.1 Modify `executeScriptGen()` return to produce `ScriptGenOutputV2`:
    - Add `version: '2.0'`
    - Add `scriptText`: extracted narration text
    - Add `directionDocument`: parsed DirectionDocument
  - [x] 3.2 Calculate `estimatedDurationSec = wordCount / 2.5` for metadata
  - [x] 3.3 Populate DirectionDocument.metadata with:
    - `title`: from topicData or generated slug
    - `slug`: kebab-case from title
    - `estimatedDurationSec`: calculated value
    - `fps: 30`
    - `resolution: { width: 1920, height: 1080 }`
    - `generatedAt`: ISO timestamp
  - [x] 3.4 Ensure all segments have:
    - `timing.timingSource = 'estimated'`
    - `timing.estimatedStartSec/estimatedEndSec` calculated proportionally

- [x] Task 4: Update Cloud Storage Artifact Saving (AC: 6)
  - [x] 4.1 Save `script.md` (plain narration) to `{pipelineId}/script-gen/script.md`
  - [x] 4.2 Save `direction.json` to `{pipelineId}/script-gen/direction.json`
  - [x] 4.3 Update `draftUrls` to include both new URLs:
    - Keep existing `writer`, `critic`, `optimizer` URLs
  - [x] 4.4 Add `scriptUrl` and `directionUrl` to output
  - [x] 4.5 Keep legacy `script` field populated with narration for V1 compatibility
  - [x] 4.6 Keep legacy `artifactUrl` pointing to script.md

- [x] Task 5: Segment Generation from Paragraphs (AC: 4, 5)
  - [x] 5.1 Create `generateSegmentsFromNarration(narration: string, audioDurationSec: number): DirectionSegment[]`
  - [x] 5.2 Split narration by double newlines (paragraph breaks)
  - [x] 5.3 For each paragraph:
    - Generate UUID for `id` using `crypto.randomUUID()`
    - Set `index` based on position
    - Detect `type` using `detectSegmentType()` from compatibility.ts
    - Calculate word count for content
    - Extract keywords (first 3-5 significant words)
    - Set default visual template based on segment type
    - Set motion config using `MOTION_PRESETS.standard`
  - [x] 5.4 Distribute timing proportionally by word count
  - [x] 5.5 Handle empty paragraphs (skip them)

- [x] Task 6: Fallback to Compatibility Layer (AC: 1, 5)
  - [x] 6.1 If LLM fails to produce valid direction JSON:
    - Use full optimizer output as narration (stripped of brackets)
    - Call `parseLegacyVisualCues()` to generate DirectionDocument
  - [x] 6.2 If segment generation fails:
    - Generate single "explanation" segment with full narration
    - Log warning with reason

- [x] Task 7: Update Unit Tests (AC: all)
  - [x] 7.1 Update `packages/script-gen/src/__tests__/script-gen.test.ts`:
    - Test V2 output structure with all required fields
    - Test `scriptText` is clean narration (no brackets)
    - Test `directionDocument` validates against schema
    - Test timing calculations are correct (150 WPM)
  - [x] 7.2 Create `packages/script-gen/src/__tests__/dual-output.test.ts`:
    - Test `parseDualOutput()` with valid input
    - Test `parseDualOutput()` with malformed JSON
    - Test fallback to compatibility layer
    - Test segment generation from paragraphs
  - [x] 7.3 Test artifact URLs are correctly formatted

- [x] Task 8: Integration Verification (AC: 2, 6)
  - [x] 8.1 Verify full build passes: `pnpm build`
  - [x] 8.2 Verify all tests pass: `pnpm test`
  - [x] 8.3 Document downstream stage migration notes

## Dev Notes

### Primary Files to Modify

**Main implementation:**
- `packages/script-gen/src/script-gen.ts` - Core stage logic
- `packages/script-gen/src/prompts.ts` - LLM prompts for dual output

**Supporting files:**
- `packages/script-gen/src/types.ts` - Types already defined (ScriptGenOutputV2)
- `packages/script-gen/src/compatibility.ts` - Use for fallback parsing

### Architecture Compliance

#### Required Patterns (from project-context.md)

1. **Every External API Call: Retry + Fallback** - Already implemented in executeAgent()

2. **Every Stage: StageInput/StageOutput Contracts** - Must return `StageOutput<ScriptGenOutput>`

3. **Track Costs via CostTracker** - Already implemented

4. **Structured Logger** - Use `logger` from `@nexus-ai/core`, no console.log

5. **Error Handling** - Use `NexusError` for all errors:
```typescript
throw NexusError.critical('NEXUS_SCRIPTGEN_DUAL_PARSE_FAIL', 'Failed to parse dual output', 'script-gen', { content });
```

#### Naming Conventions
- Functions: camelCase (`parseDualOutput`, `generateSegmentsFromNarration`)
- Constants: SCREAMING_SNAKE (`WORDS_PER_MINUTE = 150`)
- Files: kebab-case (existing file names)

### Technical Requirements

#### Dual Output Prompt Structure
```markdown
## INSTRUCTIONS
Generate a video script in TWO parts:

### Part 1: NARRATION
Pure spoken text for TTS. No brackets, no stage directions, no visual cues.
Each paragraph represents a natural break point.

### Part 2: DIRECTION
JSON object following DirectionDocument schema with visual/audio blueprint.

## OUTPUT FORMAT

## NARRATION
{Your narration text here, paragraphs separated by blank lines}

## DIRECTION
```json
{
  "version": "2.0",
  "metadata": { ... },
  "segments": [ ... ],
  "globalAudio": { ... }
}
```
```

#### Parsing Dual Output
```typescript
const NARRATION_PATTERN = /## NARRATION\s*\n([\s\S]*?)(?=## DIRECTION|$)/i;
const DIRECTION_PATTERN = /## DIRECTION\s*\n```json\n([\s\S]*?)\n```/i;

function parseDualOutput(content: string): { narration: string; direction: DirectionDocument | null } {
  const narrationMatch = content.match(NARRATION_PATTERN);
  const directionMatch = content.match(DIRECTION_PATTERN);

  const narration = narrationMatch?.[1]?.trim() ?? content;

  let direction: DirectionDocument | null = null;
  if (directionMatch?.[1]) {
    try {
      const parsed = JSON.parse(directionMatch[1]);
      const result = safeValidateDirectionDocument(parsed);
      if (result.success) {
        direction = result.data;
      }
    } catch {
      // Fallback will be used
    }
  }

  return { narration, direction };
}
```

#### Timing Calculation
```typescript
const WORDS_PER_MINUTE = 150;
const WORDS_PER_SECOND = WORDS_PER_MINUTE / 60; // 2.5

function calculateEstimatedDuration(wordCount: number): number {
  return wordCount / WORDS_PER_SECOND;
}

function distributeSegmentTiming(
  segments: DirectionSegment[],
  totalDurationSec: number
): DirectionSegment[] {
  const totalWords = segments.reduce((sum, s) => sum + s.content.wordCount, 0);
  let currentTime = 0;

  return segments.map(segment => {
    const proportion = segment.content.wordCount / totalWords;
    const duration = totalDurationSec * proportion;

    const timing: SegmentTiming = {
      estimatedStartSec: currentTime,
      estimatedEndSec: currentTime + duration,
      estimatedDurationSec: duration,
      timingSource: 'estimated',
    };

    currentTime += duration;
    return { ...segment, timing };
  });
}
```

#### Segment Type Mapping from Content
```typescript
const SEGMENT_TYPE_KEYWORDS: Record<SegmentType, string[]> = {
  intro: ['introduction', 'welcome', 'today', 'hello'],
  hook: ['imagine', 'what if', 'discover', 'surprising'],
  explanation: ['because', 'therefore', 'means', 'works'],
  code_demo: ['code', 'function', 'class', 'implement'],
  comparison: ['vs', 'versus', 'compared', 'difference'],
  example: ['example', 'instance', 'case', 'consider'],
  transition: ['now', 'next', 'moving on', 'let\'s'],
  recap: ['recap', 'summary', 'remember', 'key points'],
  outro: ['conclusion', 'thank', 'subscribe', 'goodbye'],
};
```

### Previous Story Intelligence (Story 6.2)

**Key learnings from Story 6.2:**
1. `getScriptText()` already strips V1 brackets - use as fallback for narration extraction
2. `parseLegacyVisualCues()` converts V1 to DirectionDocument - use as fallback for direction
3. `detectSegmentType()` determines segment type from content - reuse for segment generation
4. `mapV1ComponentToV2()` maps component hints - may be useful for prompt examples
5. `MOTION_PRESETS.standard` provides default motion config

**Files to import from:**
- `./compatibility` - `getScriptText`, `parseLegacyVisualCues`, `detectSegmentType`
- `./types` - All types, `safeValidateDirectionDocument`, `MOTION_PRESETS`

### Library/Framework Requirements

#### Dependencies (already in package.json)
- `zod`: ^3.23.8 (for validation)
- `@nexus-ai/core`: workspace (for CloudStorageClient, logger, etc.)

#### Node.js Built-ins
- `crypto.randomUUID()`: For generating segment IDs

### Testing Standards

- **Framework:** Vitest (project standard)
- **Existing tests:** `direction-schema.test.ts` (65), `compatibility.test.ts` (52), `prompts.test.ts` (22), `script-gen.test.ts` (14)
- **New tests:** `dual-output.test.ts` for new parsing/generation logic

#### Test Fixtures
```typescript
// Sample dual output from LLM
const sampleDualOutput = `
## NARRATION

Welcome to today's deep dive into transformer architectures.

The attention mechanism is what makes transformers so powerful.

Let's look at the code implementation.

## DIRECTION
\`\`\`json
{
  "version": "2.0",
  "metadata": {
    "title": "Transformer Architectures",
    "slug": "transformer-architectures",
    "estimatedDurationSec": 120,
    "fps": 30,
    "resolution": { "width": 1920, "height": 1080 },
    "generatedAt": "2026-01-27T12:00:00Z"
  },
  "segments": [...],
  "globalAudio": { "defaultMood": "neutral", "musicTransitions": "smooth" }
}
\`\`\`
`;
```

### Project Structure Notes

```
packages/script-gen/
├── package.json           # Dependencies (zod, @nexus-ai/core)
├── tsconfig.json          # Extends @nexus-ai/config
├── src/
│   ├── index.ts           # Exports (no changes needed)
│   ├── types.ts           # ScriptGenOutputV2 already defined
│   ├── compatibility.ts   # Fallback utilities from Story 6.2
│   ├── prompts.ts         # UPDATE: Dual output prompts
│   ├── script-gen.ts      # UPDATE: Main stage logic
│   └── __tests__/
│       ├── direction-schema.test.ts  # 65 tests (no changes)
│       ├── compatibility.test.ts     # 52 tests (no changes)
│       ├── prompts.test.ts           # UPDATE: Test dual prompts
│       ├── script-gen.test.ts        # UPDATE: Test V2 output
│       └── dual-output.test.ts       # CREATE: New parsing tests
```

### References

- [Source: epics.md] Story requirements: `_bmad-output/planning-artifacts/epics.md` lines 2086-2109
- [Source: project-context.md] Critical patterns: `_bmad-output/project-context.md`
- [Source: architecture.md] Stage execution pattern: `_bmad-output/planning-artifacts/architecture.md`
- [Source: types.ts] ScriptGenOutputV2 definition: `packages/script-gen/src/types.ts` lines 732-744
- [Source: compatibility.ts] Fallback utilities: `packages/script-gen/src/compatibility.ts`
- [Source: 6-2 story] Previous story: `_bmad-output/implementation-artifacts/6-2-implement-backward-compatibility-layer.md`

### Git Intelligence

Recent commits for context:
- `309b5ea` - docs: add Epic 6 planning artifacts and tech spec
- `f52175f` - Story 6.1: DirectionDocument schema with Zod validation
- `68c6e10` - Pipeline end-to-end data flow (shows stage wiring patterns)

Commit message pattern: `feat(script-gen): {description} (Story X.Y)`

### Anti-Pattern Prevention

1. **DO NOT modify types.ts** - ScriptGenOutputV2 is already defined
2. **DO NOT break V1 compatibility** - Keep `script`, `artifactUrl`, `draftUrls` fields populated
3. **DO NOT skip fallback** - If LLM fails to produce valid direction, use compatibility layer
4. **DO NOT hardcode segment count** - Generate dynamically from paragraph breaks
5. **DO NOT forget timing validation** - Ensure segment timings sum to total duration
6. **DO NOT use console.log** - Use structured logger from @nexus-ai/core

### Edge Cases to Handle

1. **LLM returns only narration (no direction section):**
   - Use full output as narration
   - Generate direction via `parseLegacyVisualCues()`

2. **LLM returns malformed JSON:**
   - Log warning with parse error
   - Fall back to compatibility layer

3. **Empty paragraphs in narration:**
   - Skip empty paragraphs during segment generation
   - Ensure at least one segment exists

4. **Very short scripts (< 100 words):**
   - Single segment with full content
   - Minimum duration of 40 seconds (100 words / 2.5)

5. **Very long scripts (> 3000 words):**
   - No artificial limit on segments
   - Proportional timing still works

6. **No topic data available:**
   - Generate title/slug from first sentence of narration
   - Use "Untitled" as fallback

### Downstream Stage Migration Notes

After this story is complete, downstream stages should migrate:

**pronunciation stage:** (Story 6.4)
```typescript
// Before:
const script = scriptGenOutput.script;
// After:
import { getScriptText } from '@nexus-ai/script-gen';
const script = getScriptText(scriptGenOutput);
```

**tts stage:** (Story 6.4)
```typescript
// Before:
const text = scriptGenOutput.script;
// After:
import { getScriptText } from '@nexus-ai/script-gen';
const text = getScriptText(scriptGenOutput);
```

**visual-gen stage:** (Story 6.18+)
```typescript
// Before:
const cues = parseVisualCues(scriptGenOutput.script);
// After:
import { getDirectionDocument } from '@nexus-ai/script-gen';
const direction = getDirectionDocument(scriptGenOutput, audioDurationSec);
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - all tests passing.

### Completion Notes List

1. **Prompt Modification (Task 1)**: Updated `buildOptimizerPrompt()` in prompts.ts to instruct the LLM to produce dual output format with `## NARRATION` (pure TTS text) and `## DIRECTION` (JSON document with full DirectionDocumentSchema structure).

2. **Dual Output Parsing (Task 2)**: Implemented `parseDualOutput()` function in script-gen.ts with regex patterns to extract narration and direction JSON. Validates against DirectionDocumentSchema using `safeValidateDirectionDocument()`.

3. **V2 Output Structure (Task 3)**: Modified `executeScriptGen()` to return `ScriptGenOutputV2` with all required fields: `version: '2.0'`, `scriptText`, `scriptUrl`, `directionDocument`, `directionUrl`. Maintains backward compatibility with V1 fields.

4. **Cloud Storage Artifacts (Task 4)**: Now saves two artifacts:
   - `{pipelineId}/script-gen/script.md` - Clean narration text for TTS
   - `{pipelineId}/script-gen/direction.json` - Full DirectionDocument JSON
   Legacy `artifactUrl` points to script.md for backward compatibility.

5. **Segment Generation Fallback (Task 5)**: Implemented `generateSegmentsFromNarration()` for fallback when LLM fails to produce valid direction JSON. Uses paragraph breaks as segment boundaries, detects segment types, distributes timing proportionally by word count.

6. **Timing Calculation**: Implemented 150 WPM (2.5 words/second) estimation. All segments have `timingSource: 'estimated'` with proportional duration distribution.

7. **Test Coverage (Task 7)**: Created comprehensive `dual-output.test.ts` with 35 tests covering:
   - Dual output parsing with valid/malformed/missing JSON
   - Segment generation from narration
   - Timing calculation verification
   - Bracket stripping
   - V2 output structure validation
   Updated prompts.test.ts to test new dual output format.

8. **Integration (Task 8)**: Full build passes (`pnpm build`), all 190 tests pass (`pnpm test`).

### File List

**Modified:**
- packages/script-gen/src/prompts.ts - Updated buildOptimizerPrompt() for dual output
- packages/script-gen/src/script-gen.ts - Added parsing, segment generation, V2 output; exported parseDualOutput, generateSegmentsFromNarration, stripBrackets for testing; uses detectSegmentType from compatibility.ts
- packages/script-gen/src/index.ts - Added exports for parseDualOutput, generateSegmentsFromNarration, stripBrackets (for testing)
- packages/script-gen/src/__tests__/prompts.test.ts - Updated tests for new prompt format
- packages/script-gen/src/__tests__/dual-output.test.ts - Added tests using actual exported implementations + V1 compatibility tests

**Created:**
- packages/script-gen/src/__tests__/dual-output.test.ts - Tests for dual output functionality

### Change Log

- 2026-01-27: Implemented Story 6.3 - Dual output support for script generation (Story 6.3)
- 2026-01-27: Code Review Fixes Applied:
  - Fixed: Imported `detectSegmentType` from compatibility.ts (was duplicated locally)
  - Fixed: `script` field now contains clean narration (was incorrectly set to dual output format)
  - Fixed: Exported `parseDualOutput`, `generateSegmentsFromNarration`, `stripBrackets` for testing
  - Fixed: Updated fallback comment to accurately describe behavior
  - Fixed: Added tests using actual exported implementations (not duplicated)
  - Fixed: Added V1 backward compatibility tests
  - Fixed: Updated File List to include index.ts
  - Fixed: Updated existing tests for new V2 behavior (script field is clean text)

