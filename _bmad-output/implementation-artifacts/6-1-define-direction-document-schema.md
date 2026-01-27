# Story 6.1: Define Direction Document Schema

Status: done

## Story

As a developer,
I want a complete DirectionDocument schema separating content from visual direction,
So that TTS receives only narration text and visual layers receive rendering instructions.

## Acceptance Criteria

1. **Given** the existing ScriptGenOutput type
   **When** I define the DirectionDocument schema in `packages/script-gen/src/types.ts`
   **Then** the following types are exported:
   - `DirectionDocument` with version, metadata, segments, globalAudio
   - `DirectionSegment` with id, index, type, content, timing, visual, audio
   - `SegmentType`: 'intro' | 'hook' | 'explanation' | 'code_demo' | 'comparison' | 'example' | 'transition' | 'recap' | 'outro'
   - `MotionConfig` with entrance, emphasis, exit configurations
   - `BRollSpec` with code, browser, diagram, animation, static types
   - `WordTiming` with word, index, startTime, endTime, duration, segmentId, isEmphasis
   - `SFXCue` with trigger, triggerValue, sound, volume
   - `EmphasisWord` with word, effect, intensity

2. **And** `MOTION_PRESETS` constant defines subtle, standard, dramatic presets

3. **And** timing fields include both estimated (pre-TTS) and actual (post-extraction) values

4. **And** all types compile with TypeScript strict mode

5. **And** Zod schemas are created for runtime validation

## Tasks / Subtasks

- [x] Task 1: Define Core DirectionDocument Types (AC: 1, 3, 4)
  - [x] 1.1 Create `DirectionDocument` interface with version: '2.0', metadata, segments[], globalAudio
  - [x] 1.2 Create `DocumentMetadata` interface with title, slug, estimatedDurationSec, actualDurationSec?, fps: 30, resolution, generatedAt
  - [x] 1.3 Create `GlobalAudio` interface with defaultMood, musicTransitions fields
  - [x] 1.4 Add to existing `packages/script-gen/src/types.ts` file below existing exports

- [x] Task 2: Define DirectionSegment and Supporting Types (AC: 1, 3, 4)
  - [x] 2.1 Create `DirectionSegment` interface with all nested structures (id, index, type, content, timing, visual, audio)
  - [x] 2.2 Create `SegmentType` type union for 9 segment types
  - [x] 2.3 Create `SegmentContent` interface with text, wordCount, keywords[], emphasis[]
  - [x] 2.4 Create `SegmentTiming` interface with estimated* and actual* fields, wordTimings?, timingSource
  - [x] 2.5 Create `SegmentVisual` interface with template, templateProps?, motion, broll?
  - [x] 2.6 Create `SegmentAudio` interface with mood?, sfxCues?, musicTransition?, voiceEmphasis?
  - [x] 2.7 Create `ComponentName` type union for all 11 component names

- [x] Task 3: Define EmphasisWord and WordTiming Types (AC: 1, 4)
  - [x] 3.1 Create `EmphasisWord` interface with word, effect (scale|glow|underline|color), intensity
  - [x] 3.2 Create `WordTiming` interface with word, index, startTime, endTime, duration, segmentId, isEmphasis

- [x] Task 4: Define MotionConfig and MOTION_PRESETS (AC: 1, 2, 4)
  - [x] 4.1 Create `MotionConfig` interface with preset?, entrance, emphasis, exit sections
  - [x] 4.2 Create `EntranceConfig` interface with type, direction?, delay, duration, easing, springConfig?
  - [x] 4.3 Create `EmphasisConfig` interface with type, trigger, intensity, duration
  - [x] 4.4 Create `ExitConfig` interface with type, direction?, duration, startBeforeEnd
  - [x] 4.5 Create `SpringConfig` interface with damping, stiffness, mass
  - [x] 4.6 Define `MOTION_PRESETS` constant object with subtle, standard, dramatic configurations
  - [x] 4.7 Create type aliases for entrance/exit/emphasis type strings

- [x] Task 5: Define BRollSpec and Supporting Types (AC: 1, 4)
  - [x] 5.1 Create `BRollSpec` interface with type discriminator and optional nested configs
  - [x] 5.2 Create `CodeBRollConfig` with content, language, highlightLines?, typingEffect, typingSpeed, theme, showLineNumbers
  - [x] 5.3 Create `BrowserBRollConfig` with url, templateId, actions[], viewport
  - [x] 5.4 Create `DiagramBRollConfig` with diagramType, data, animateSteps
  - [x] 5.5 Create `AnimationBRollConfig` with componentId, props
  - [x] 5.6 Create `StaticBRollConfig` with imageUrl, alt, zoom?
  - [x] 5.7 Create `BrowserAction` interface with type, target?, value?, delay, duration
  - [x] 5.8 Add common BRoll properties: overlay, overlayOpacity?, position?, startOffset, duration

- [x] Task 6: Define SFXCue Type (AC: 1, 4)
  - [x] 6.1 Create `SFXCue` interface with trigger, triggerValue?, sound, volume
  - [x] 6.2 Create `SFXTrigger` type union for 'segment_start' | 'segment_end' | 'word' | 'timestamp'

- [x] Task 7: Create Zod Validation Schemas (AC: 5)
  - [x] 7.1 Add zod to package dependencies if not present
  - [x] 7.2 Create `directionDocumentSchema` Zod schema matching DirectionDocument interface
  - [x] 7.3 Create nested schemas for all sub-types (DirectionSegmentSchema, MotionConfigSchema, etc.)
  - [x] 7.4 Export Zod schemas alongside TypeScript types
  - [x] 7.5 Add `validateDirectionDocument(doc: unknown): DirectionDocument` helper function

- [x] Task 8: Update ScriptGenOutput for V2 Support (AC: 1, 4)
  - [x] 8.1 Create `ScriptGenOutputV2` interface extending current fields with version, scriptText, scriptUrl, directionDocument, directionUrl
  - [x] 8.2 Create union type `ScriptGenOutput = ScriptGenOutputV1 | ScriptGenOutputV2`
  - [x] 8.3 Create `isV2Output(output: ScriptGenOutput): output is ScriptGenOutputV2` type guard

- [x] Task 9: Verify TypeScript Strict Mode Compilation (AC: 4)
  - [x] 9.1 Run `pnpm build` in packages/script-gen to verify clean compilation
  - [x] 9.2 Fix any strict mode errors (implicit any, null checks, etc.)
  - [x] 9.3 Ensure all exports are properly typed

- [x] Task 10: Add Unit Tests for Schema Validation (AC: 5)
  - [x] 10.1 Create `packages/script-gen/src/__tests__/direction-schema.test.ts`
  - [x] 10.2 Add test: valid DirectionDocument passes Zod validation
  - [x] 10.3 Add test: missing required fields fail validation with descriptive errors
  - [x] 10.4 Add test: invalid enum values fail validation
  - [x] 10.5 Add test: MOTION_PRESETS expand correctly
  - [x] 10.6 Add test: isV2Output type guard works correctly

## Dev Notes

### File to Modify
**Primary file:** `packages/script-gen/src/types.ts`

This file currently contains ~107 lines with `ScriptGenInput`, `ScriptGenOutput`, `AgentProviderInfo`, `AgentDraft`, and `MultiAgentResult` types. Add all new types AFTER the existing exports to maintain backward compatibility.

### Architecture Compliance

#### Required Patterns (from project-context.md)
- **TypeScript Strict Mode:** All types must compile with strict: true (tsconfig inherits from base)
- **Naming Conventions:**
  - Interfaces: PascalCase (e.g., `DirectionDocument`, `MotionConfig`)
  - Type aliases: PascalCase (e.g., `SegmentType`, `ComponentName`)
  - Constants: SCREAMING_SNAKE (e.g., `MOTION_PRESETS`)
  - Files: kebab-case (types.ts already follows this)
- **Package scope:** `@nexus-ai/script-gen`

#### Type Design Principles
1. **Separation of Concerns:** DirectionDocument is the video blueprint, NOT content for TTS
2. **Dual Timing:** Support both `estimated*` (pre-TTS) and `actual*` (post-extraction) timing fields
3. **Optional Fields:** Use `?` for fields populated in later pipeline stages (wordTimings, actualStartSec, etc.)
4. **Discriminated Unions:** Use literal type unions for type safety (SegmentType, ComponentName, etc.)

### Schema Reference (from tech-spec)

The complete schema is documented in `_bmad-output/implementation-artifacts/tech-spec-nexus-video-enhancement-system.md` under "Schema Definitions (Complete)" section. Key structures:

```typescript
// DirectionDocument (root)
{
  version: '2.0',
  metadata: { title, slug, estimatedDurationSec, actualDurationSec?, fps: 30, resolution, generatedAt },
  segments: DirectionSegment[],
  globalAudio: { defaultMood, musicTransitions }
}

// DirectionSegment
{
  id: string,           // UUID for linking
  index: number,        // 0-based order
  type: SegmentType,
  content: { text, wordCount, keywords[], emphasis[] },
  timing: { estimated*, actual*, wordTimings?, timingSource },
  visual: { template, templateProps?, motion, broll? },
  audio: { mood?, sfxCues?, musicTransition?, voiceEmphasis? }
}

// MotionConfig
{
  preset?: 'subtle' | 'standard' | 'dramatic',
  entrance: { type, direction?, delay, duration, easing, springConfig? },
  emphasis: { type, trigger, intensity, duration },
  exit: { type, direction?, duration, startBeforeEnd }
}

// MOTION_PRESETS constant
{
  subtle: { entrance: { type: 'fade', ... }, emphasis: { type: 'none', ... }, exit: { ... } },
  standard: { entrance: { type: 'slide', direction: 'up', ... }, ... },
  dramatic: { entrance: { type: 'pop', springConfig: { damping: 80, ... }, ... }, ... }
}
```

### Library/Framework Requirements

#### Zod (Runtime Validation)
- **Version:** Latest stable (^3.x)
- **Purpose:** Runtime validation of DirectionDocument JSON from disk or API
- **Installation:** `pnpm add zod` in packages/script-gen (if not already present)
- **Pattern:** Create parallel Zod schemas for each TypeScript interface

```typescript
// Example Zod schema pattern
import { z } from 'zod';

export const EmphasisWordSchema = z.object({
  word: z.string(),
  effect: z.enum(['scale', 'glow', 'underline', 'color']),
  intensity: z.number().min(0).max(1)
});

export type EmphasisWord = z.infer<typeof EmphasisWordSchema>;
```

### Testing Standards

- **Framework:** Vitest (project standard)
- **Location:** `packages/script-gen/src/__tests__/direction-schema.test.ts`
- **Coverage requirement:** All exported types and the MOTION_PRESETS constant
- **Test pattern:** Use Zod `.parse()` for valid cases, `.safeParse()` for error cases

### Project Structure Notes

```
packages/script-gen/
├── package.json           # May need zod dependency added
├── tsconfig.json          # Extends @nexus-ai/config
├── src/
│   ├── index.ts           # Re-exports from types.ts (update if needed)
│   ├── types.ts           # ADD ALL NEW TYPES HERE (after existing ~107 lines)
│   ├── script-gen.ts      # Main logic (DO NOT MODIFY in this story)
│   └── __tests__/
│       └── direction-schema.test.ts  # NEW: Schema validation tests
```

### References

- [Source: tech-spec] Schema definitions: `_bmad-output/implementation-artifacts/tech-spec-nexus-video-enhancement-system.md#schema-definitions-complete`
- [Source: architecture.md] Naming conventions: `_bmad-output/planning-artifacts/architecture.md#naming-patterns`
- [Source: project-context.md] Critical patterns: `_bmad-output/project-context.md#critical-rules`
- [Source: epics.md] Story requirements: `_bmad-output/planning-artifacts/epics.md#story-61-define-direction-document-schema`

### Previous Story Intelligence

This is the first story in Epic 6 (Broadcast Quality Video Enhancement). No previous stories to reference.

### Git Intelligence

Recent commits follow the pattern: `feat({packages}): {description} (Story X.Y)`

Most recent relevant work:
- `68c6e10` - Pipeline end-to-end data flow implementation
- Epic 5 stories established the quality gate framework, orchestrator patterns, and cost tracking

### Web Research Context

**Zod Library (Latest):**
- Current stable: v3.23.x
- Key features for this story: `.enum()`, `.object()`, `.optional()`, `.infer<>`
- Zod handles TypeScript strict mode well - inferred types match declared interfaces

**TypeScript 5.x Patterns:**
- Use `type` for unions and aliases
- Use `interface` for object structures that may be extended
- Use `as const` for literal object constants like MOTION_PRESETS

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build output: All 15 packages build successfully with TypeScript strict mode
- Test output: 101 tests pass (65 direction schema tests + 36 existing tests)

### Completion Notes List

- Implemented complete DirectionDocument schema with 25+ interfaces and type aliases
- Created comprehensive Zod validation schemas for all types with runtime validation
- Defined MOTION_PRESETS constant with subtle, standard, and dramatic configurations
- Added ScriptGenOutputV2 interface with isV2Output type guard for version detection
- All types support dual timing (estimated/actual) for pre-TTS and post-extraction scenarios
- Added validateDirectionDocument() and safeValidateDirectionDocument() helper functions
- Updated index.ts to export all new types, schemas, and constants
- Added zod ^3.23.8 as package dependency
- Created 65 unit tests covering valid documents, missing fields, invalid enums, presets, type guards, and edge cases

### Code Review Fixes Applied

- **[HIGH] Task 8.2**: Fixed ScriptGenOutput to be union type `ScriptGenOutputV1 | ScriptGenOutputV2` as specified
- **[HIGH] BRollSpec discriminated union**: Refactored to proper TypeScript discriminated union with enforcing Zod schema (type: 'code' now requires code config)
- **[HIGH] Import placement**: Moved `import { z } from 'zod'` to top of file per conventions
- **[MEDIUM] New B-Roll types exported**: Added BRollBase, CodeBRoll, BrowserBRoll, DiagramBRoll, AnimationBRoll, StaticBRoll
- **[MEDIUM] Added 18 new tests**: Edge cases (empty segments, wordCount: 0, BRoll discriminated union enforcement) and sub-schema direct tests (SegmentContentSchema, SegmentTimingSchema, SegmentVisualSchema, SegmentAudioSchema)

### File List

- packages/script-gen/src/types.ts (modified - added ~700 lines of Direction Document types and Zod schemas)
- packages/script-gen/src/index.ts (modified - added exports for all new types and schemas)
- packages/script-gen/package.json (modified - added zod dependency)
- packages/script-gen/src/__tests__/direction-schema.test.ts (created - 65 tests for schema validation)

### Change Log

- 2026-01-27: Story 6.1 implementation complete - defined DirectionDocument schema with TypeScript interfaces, Zod runtime validation, MOTION_PRESETS constant, and V2 output type support
- 2026-01-27: Code review fixes applied - ScriptGenOutput union type, BRollSpec discriminated union, import placement, added 18 new edge case and sub-schema tests
