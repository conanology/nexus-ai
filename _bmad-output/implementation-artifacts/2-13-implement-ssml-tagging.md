# Story 2.13: implement-ssml-tagging

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to generate SSML-tagged scripts with pronunciation markup,
so that TTS synthesizes all technical terms correctly and viewers hear accurate pronunciations.

## Acceptance Criteria

1. **SSML Tag Generation (FR15):** Implement `tagScript(script: string)` that generates SSML-marked script by wrapping known pronunciation terms with `<phoneme alphabet="ipa" ph="{ipa}">{term}</phoneme>` tags
2. **Pronunciation Hint Processing:** Parse and process inline `[PRONOUNCE: X = "Y"]` hints from script, converting them to SSML phoneme tags
3. **XML Escaping:** Properly escape XML special characters (`<`, `>`, `&`, `"`, `'`) in script content while preserving SSML tag structure
4. **Visual Cue Preservation:** Maintain all `[VISUAL: ...]` cues and script structure (paragraphs, line breaks) in the SSML output
5. **Term Replacement Algorithm:** Replace terms using longest-first matching with word boundary protection to prevent partial replacements (e.g., "GPT" doesn't replace "GPT-4")
6. **Stage Integration:** Implement `executePronunciation()` stage function that orchestrates: extract terms → check pronunciations → flag unknowns if threshold exceeded → tag script with SSML → return tagged script with quality metrics
7. **Quality Metrics Tracking:** Track pronunciation accuracy percentage (known terms / total terms) and flag as DEGRADED if accuracy <98% per NFR18
8. **Pattern Compliance:** Use `executeStage` wrapper, structured logging, `CostTracker` for Firestore operations, and `NexusError` for error handling

## Tasks / Subtasks

- [x] **T1: Implement SSML Tag Generation (AC: 1, 5)**
  - [x] Create `tagScript(script: string, pronunciations: Map<string, PronunciationEntry>)` function
  - [x] Implement longest-first term sorting to prevent partial replacements
  - [x] Use word boundary regex (`\b{term}\b`) for safe term matching
  - [x] Generate proper SSML phoneme tags with IPA phonemes
  - [x] Handle case-insensitive matching while preserving original case in output

- [x] **T2: Implement Pronunciation Hint Parser (AC: 2)**
  - [x] Parse `[PRONOUNCE: {term} = "{pronunciation}"]` hints from script
  - [x] Extract term and pronunciation guidance
  - [x] Look up or infer IPA phonemes from pronunciation hints
  - [x] Convert hints to SSML phoneme tags
  - [x] Remove processed hints from final SSML output

- [x] **T3: Implement XML Escaping (AC: 3)**
  - [x] Create `escapeXml(text: string)` utility function
  - [x] Escape special characters: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`, `"` → `&quot;`, `'` → `&apos;`
  - [x] Apply escaping to script content BEFORE tag replacement
  - [x] Ensure SSML tags themselves are NOT escaped (preserve valid XML structure)

- [x] **T4: Implement Visual Cue and Structure Preservation (AC: 4)**
  - [x] Detect and preserve `[VISUAL: ...]` cues in SSML output
  - [x] Maintain paragraph structure and line breaks
  - [x] Ensure SSML tags don't break script formatting

- [x] **T5: Integrate with Pronunciation Extraction (AC: 6)**
  - [x] Reuse `extractTerms()` from Story 2.12 for term extraction
  - [x] Reuse `checkPronunciations()` from Story 2.12 for dictionary validation
  - [x] Implement orchestration logic in `executePronunciation()` stage function
  - [x] Pass extracted terms and pronunciations to `tagScript()`

- [x] **T6: Implement Quality Metrics (AC: 7)**
  - [x] Calculate pronunciation accuracy: `(knownTerms / totalTerms) * 100`
  - [x] Return DEGRADED quality status if accuracy <98%
  - [x] Include metrics in `StageOutput.quality.measurements`
  - [x] Track unknown term count and flagging status

- [x] **T7: Implement Stage Function (AC: 8)**
  - [x] Create `executePronunciation()` in `pronunciation-stage.ts`
  - [x] Implement stage with `StageInput<PronunciationInput>` / `StageOutput<PronunciationOutput>` contracts
  - [x] Use `CostTracker` for Firestore operations (dictionary lookups)
  - [x] Use structured logger with `pipelineId` and `stage: 'pronunciation'`
  - [x] Handle errors with `NexusError.fromError()`

- [x] **T8: Unit & Integration Testing**
  - [x] Test `tagScript()` with various term combinations
  - [x] Test pronunciation hint parsing and conversion
  - [x] Test XML escaping edge cases
  - [x] Test visual cue preservation
  - [x] Test quality metrics calculation
  - [x] Test stage integration with mock Firestore

## Dev Notes

### Architecture Context - SSML and TTS Integration

**SSML Format Standard:**
- Format: `<phoneme alphabet="ipa" ph="{ipa_phonemes}">{original_term}</phoneme>`
- Example: `<phoneme alphabet="ipa" ph="mɪkˈstrɑːl">Mixtral</phoneme>`
- Source: [architecture.md, pronunciation-client.ts:58]

**TTS Provider Chain:**
- **Primary:** Gemini 2.5 Pro TTS (`gemini-2.5-pro-tts`)
  - Supports SSML phoneme tags with IPA alphabet
  - 30 speakers, 80+ locales
  - Natural language style control
  - Cost: $0.000016 per character
- **Fallback 1:** Chirp 3 HD (`chirp3-hd`)
- **Fallback 2:** WaveNet
- Source: [architecture.md, gemini-tts-provider.ts, 1-5-implement-provider-abstraction.md]

**Quality Requirements:**
- **NFR18:** Pronunciation accuracy must exceed 98% (known terms / total terms)
- **Threshold:** >3 unknown terms triggers human review queue (FR13)
- **Quality Gate:** If accuracy <98%, stage returns DEGRADED status
- Source: [architecture.md:577-582, epics.md:1021]

### Technical Implementation Patterns

**1. Term Replacement Algorithm (Critical for Correctness):**
```typescript
// MUST sort terms by length (longest first) to prevent partial replacements
const sortedTerms = Array.from(pronunciations.keys())
  .sort((a, b) => b.length - a.length);

// Use word boundary regex for safe matching
const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
```

**Why longest-first?** Prevents "GPT" from replacing the "GPT" in "GPT-4" before "GPT-4" is processed.

**2. XML Escaping Sequence (Order Matters):**
```typescript
// MUST escape content BEFORE adding SSML tags
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')   // MUST be first (to avoid double-escaping)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

**3. Pronunciation Hint Pattern:**
```
Input:  "The new [PRONOUNCE: Mixtral = "mix-trahl"] model..."
Output: "The new <phoneme alphabet="ipa" ph="mɪkˈstrɑːl">Mixtral</phoneme> model..."
```

**4. Cost Tracking:**
- Firestore operations: `getDictionary()` (one-time per pipeline), `lookupTerm()` (per unknown term)
- Track via `CostTracker` - minimal cost, but must be tracked for transparency
- Source: [project-context.md:99-106]

### Integration with Existing Code

**Reuse from Story 2.12:**
- `extractTerms(script)` - already implemented in `packages/pronunciation/src/extractor.ts`
- `checkPronunciations(terms)` - already implemented in `packages/pronunciation/src/extractor.ts`
- `ReviewQueueClient.addToReviewQueue()` - for flagging unknown terms
- Source: [2-12-implement-term-extraction-and-flagging.md]

**Update Story 2.11 Implementation:**
- `executePronunciation()` stage function in `pronunciation-stage.ts` currently exists but may need enhancement
- Verify integration with `executeStage` wrapper pattern
- Source: [2-11-create-pronunciation-dictionary.md, pronunciation-stage.ts]

### Package Location

**Module:** `@nexus-ai/pronunciation`

**Files to Create/Modify:**
- `packages/pronunciation/src/ssml-tagger.ts` (NEW - SSML generation logic)
- `packages/pronunciation/src/pronunciation-stage.ts` (MODIFY - integrate SSML tagging)
- `packages/pronunciation/src/types.ts` (UPDATE - add SSML-specific types)
- `packages/pronunciation/src/index.ts` (UPDATE - export new functions)

**Test Files:**
- `packages/pronunciation/src/__tests__/ssml-tagger.test.ts` (NEW)
- `packages/pronunciation/src/__tests__/pronunciation-stage.test.ts` (UPDATE)

### Project Structure Notes

- **Epic:** Epic 2: Content Intelligence Pipeline (Story 13 of 13)
- **Dependencies:** Story 2.11 (pronunciation dictionary), Story 2.12 (term extraction)
- **Next Stage:** Epic 3: Media Production Pipeline (TTS synthesis uses SSML output)
- **Critical Path:** This story completes Epic 2. TTS stage (Story 3.1) depends on SSML-tagged scripts.

### Previous Story Learnings (from 2.12)

**What Worked Well:**
- Comprehensive term extraction using regex patterns for CamelCase, acronyms, numbers
- Using `Set` for deduplication prevented redundant dictionary lookups
- Context extraction (sentence surrounding term) proved critical for human review
- Mock Firestore/observability patterns simplified unit testing
- 40+ tests provided good coverage and caught edge cases

**Problems Encountered:**
- Duplicate logic initially implemented across multiple files - fixed by centralizing in `extractor.ts`
- Quality metrics format confusion (`quality.measurements` vs `quality.metrics`) - documented in tests
- Test configuration required careful StageConfig setup to match real stage contracts

**Code Patterns Established:**
- **Firestore clients:** Separate client classes with typed methods (`PronunciationClient`, `ReviewQueueClient`)
- **Stage structure:** `StageInput` → process → track costs → check quality → return `StageOutput`
- **Error handling:** Always wrap unknown errors with `NexusError.fromError(error, stage)`
- **Logging:** Include `pipelineId` and `stage` in every log entry

**Recommendations for This Story:**
1. Reuse extraction logic from 2.12 - don't reinvent term extraction
2. Add comprehensive SSML-specific tests (hint parsing, XML escaping, term replacement edge cases)
3. Test with actual seed data terms to validate real-world scenarios
4. Document SSML format clearly for future TTS integration
5. Consider performance - script tagging must be fast (<1 second for 1800-word script)

### Git Commit Patterns

**Recent Commits (for reference):**
- `9f6c946`: "Add tests and implementation for pronunciation extraction and review queue" (Story 2.12)
- `c3d3413`: "feat(pronunciation): add pronunciation package config and seed data" (Story 2.11)
- `f7af6bc`: "feat: Implement script generation stage and update related configurations" (Story 2.10)

**Suggested Commit Message:**
```
feat(pronunciation): implement SSML tagging with IPA phoneme markup

- Add tagScript() function for SSML generation with longest-first term replacement
- Implement pronunciation hint parser for [PRONOUNCE: ...] inline hints
- Add XML escaping utilities for proper SSML formatting
- Integrate SSML tagging into executePronunciation() stage
- Add quality metrics tracking for 98% pronunciation accuracy (NFR18)
- Preserve visual cues and script structure in SSML output
- Add comprehensive tests for SSML generation and edge cases

Completes Story 2.13 and Epic 2: Content Intelligence Pipeline
```

### Critical Development Considerations

**1. Performance Optimization:**
- Load pronunciation dictionary once per pipeline (not per term lookup)
- Use `Map` for O(1) term lookups
- Sort terms once before replacement loop
- Avoid repeated regex compilations (cache compiled regexes if possible)

**2. SSML Validation:**
- SSML output must be valid XML
- Test with actual TTS provider (Gemini 2.5 Pro TTS) to verify compatibility
- Consider adding SSML schema validation in quality gate

**3. Edge Cases to Handle:**
- Terms at sentence boundaries (capitalized)
- Terms within other terms ("DALL" in "DALL-E")
- Terms with punctuation ("GPT-4,", "LLaMA.")
- Terms in quotes or parentheses
- Multiple occurrences of same term in script
- Empty script or script with no technical terms

**4. Future Enhancements (NOT in scope for this story):**
- Dynamic IPA generation for unknown terms using LLM
- Pronunciation confidence scores
- Support for alternative pronunciations (regional variants)
- SSML prosody tags (speaking rate, pitch, volume)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.13: Implement SSML Tagging]
- [Source: _bmad-output/planning-artifacts/prd.md#FR15: Generate SSML-tagged scripts with pronunciation markup]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pronunciation Stage Quality Gates]
- [Source: _bmad-output/implementation-artifacts/2-11-create-pronunciation-dictionary.md#Pronunciation Dictionary Schema]
- [Source: _bmad-output/implementation-artifacts/2-12-implement-term-extraction-and-flagging.md#Term Extraction Patterns]
- [Source: _bmad-output/project-context.md#Stage Execution Template]
- [Source: packages/pronunciation/src/pronunciation-client.ts#XML Escaping Implementation]
- [Source: packages/pronunciation/src/extractor.ts#Term Extraction Logic]
- [Source: packages/pronunciation/data/seed.json#211 Verified IPA Phonemes]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A - No blocking issues encountered

### Completion Notes List

1. **SSML Tagger Implementation**: Created comprehensive `tagScript()` function in `ssml-tagger.ts` with:
   - Longest-first term sorting to prevent partial replacements (e.g., "GPT-4" processed before "GPT")
   - Smart regex matching: word boundaries for alphanumeric terms, lookahead/lookbehind for special chars (C++, C#)
   - Case-insensitive matching with original case preservation in SSML output
   - Protection against replacing text inside already-tagged SSML elements

2. **XML Escaping**: Implemented proper XML escaping with correct order (& first to avoid double-escaping)

3. **Pronunciation Hint Processing**: Full implementation of hint parsing and SSML conversion:
   - Parser extracts `[PRONOUNCE: term = "pronunciation"]` hints
   - Converts English pronunciation guidance to approximate IPA using heuristic mapping
   - Adds hint-derived entries to pronunciation map for SSML tagging
   - Uses existing dictionary entries when available, skips conversion

4. **Stage Integration**: Updated `executePronunciation()` in `pronunciation-stage.ts` to:
   - Work with `PronunciationEntry` objects instead of raw strings
   - Pass `processHints: true` option to tagScript
   - Calculate accuracy metrics: (knownTerms / totalTerms) * 100
   - Return DEGRADED status if accuracy < 98% (not WARN)
   - Integrate ReviewQueueClient to add unknown terms to review queue when >3 flagged
   - Include context extraction for each flagged term

5. **Test Coverage**: Comprehensive test suite with 30+ tests covering:
   - Basic SSML tag generation (ssml-tagger.test.ts)
   - Longest-first replacement algorithm
   - Word boundary protection for partial term matches
   - Pronunciation hint processing with IPA conversion (improved tests)
   - XML escaping while preserving SSML tags
   - Visual cue preservation and script structure
   - Edge cases (special characters, quotes, multiple occurrences)
   - Stage integration tests (pronunciation-stage.test.ts - NEW)
   - Quality metrics calculation and DEGRADED status
   - Review queue integration for flagged terms
   - Performance test for 1800-word scripts

6. **Code Review Fixes Applied**: Fixed critical issues found in adversarial code review:
   - AC2: Implemented full pronunciation hint to SSML conversion with IPA mapping
   - AC3: Fixed XML escaping bug - now tags first, then escapes content while preserving SSML
   - AC6: Added ReviewQueueClient integration for unknown term flagging
   - AC7: Corrected quality status from WARN to DEGRADED per architecture requirements

### File List

Created:
- packages/pronunciation/src/ssml-tagger.ts
- packages/pronunciation/src/__tests__/ssml-tagger.test.ts
- packages/pronunciation/src/__tests__/pronunciation-stage.test.ts

Modified:
- packages/pronunciation/src/pronunciation-stage.ts
- packages/pronunciation/src/index.ts (added exports: tagScript, escapeXml, parsePronunciationHints, PronunciationHint, SSMLTagOptions)
- _bmad-output/implementation-artifacts/sprint-status.yaml
