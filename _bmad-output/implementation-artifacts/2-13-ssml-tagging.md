# Story 2.13: Implement SSML Tagging

Status: done

## Story

As a developer,
I want to generate SSML-tagged scripts,
So that TTS pronounces all terms correctly.

## Acceptance Criteria

1. **Given** term extraction from Story 2.12
   **When** I implement SSML tagging
   **Then** `tagScript(script: string)` returns SSML-marked script per FR15

2. **And** known terms are wrapped with SSML phoneme tags:
   ```xml
   <phoneme alphabet="ipa" ph="mɪkˈstrɑːl">Mixtral</phoneme>
   ```

3. **And** pronunciation hints from script `[PRONOUNCE: X = "Y"]` are processed

4. **And** output preserves script structure (paragraphs, visual cues)

5. **And** `executePronunciation()` stage function:
   1. Extract terms from script
   2. Check pronunciations
   3. Flag unknowns if threshold exceeded
   4. Tag script with SSML
   5. Return tagged script and quality metrics

6. **And** stage uses `executeStage` wrapper

7. **And** quality metrics include:
   - Total terms checked
   - Known vs unknown count
   - Pronunciation accuracy percentage (NFR18: >98%)

8. **And** if accuracy <98%, stage returns with DEGRADED quality status

## Tasks / Subtasks

- [x] Task 1: Implement tagScript (AC: #1, #2)
  - [x] Load dictionary
  - [x] Find all known terms in script
  - [x] Replace with SSML phoneme tags
  - [x] Preserve word boundaries

- [x] Task 2: Process pronunciation hints (AC: #3)
  - [x] Parse [PRONOUNCE: X = "Y"] markers
  - [x] Add to temporary dictionary
  - [x] Apply to tagging
  - [x] Remove markers from output

- [x] Task 3: Preserve structure (AC: #4)
  - [x] Keep paragraphs intact
  - [x] Preserve [VISUAL: ...] cues
  - [x] Maintain markdown formatting

- [x] Task 4: Create executePronunciation stage (AC: #5, #6)
  - [x] Use executeStage wrapper
  - [x] Call extractTerms
  - [x] Call checkPronunciations
  - [x] Flag if needed
  - [x] Call tagScript
  - [x] Return StageOutput

- [x] Task 5: Implement quality metrics (AC: #7, #8)
  - [x] Calculate accuracy percentage
  - [x] Check against 98% threshold (NFR18)
  - [x] Return DEGRADED if below
  - [x] Include metrics in output

## Dev Notes

### SSML Phoneme Tag Format

```xml
<phoneme alphabet="ipa" ph="PHONEME">WORD</phoneme>
```

Example:
```xml
<phoneme alphabet="ipa" ph="mɪkˈstrɑːl">Mixtral</phoneme>
```

### Pronunciation Hint Parsing

Input:
```markdown
The [PRONOUNCE: Mixtral = "mix-trahl"] model is impressive.
```

Output:
```xml
The <phoneme alphabet="ipa" ph="mɪkˈstrɑːl">Mixtral</phoneme> model is impressive.
```

### Accuracy Calculation

```typescript
const accuracy = (knownCount / totalTerms) * 100;
// NFR18: Must be >98%
```

### Quality Thresholds

| Accuracy | Status |
|----------|--------|
| ≥98% | PASS |
| 95-98% | WARN |
| <95% | FAIL/DEGRADED |

### Stage Output

```typescript
interface PronunciationOutput {
  taggedScript: string;
  metrics: {
    totalTerms: number;
    knownTerms: number;
    unknownTerms: number;
    accuracy: number;
    flaggedForReview: boolean;
  };
}
```

### Visual Cue Preservation

Visual cues are NOT tagged:
```markdown
[VISUAL: neural network animation]
```

These pass through unchanged for the visual generation stage.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented tagScript with SSML phoneme wrapping
- Parses [PRONOUNCE: X = "Y"] hints from script
- Preserves paragraphs, visual cues, and markdown
- Created executePronunciation stage function
- Quality metrics with NFR18 accuracy check
- Returns DEGRADED if accuracy <98%
- All metrics included in StageOutput

### File List

**Created/Modified:**
- `nexus-ai/packages/pronunciation/src/ssml-tagging.ts`
- `nexus-ai/packages/pronunciation/src/pronunciation.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.12 (Term Extraction)
- **Downstream Dependencies:** Story 3.1 (TTS Stage)

---

## Epic 2 Complete

**Stories Completed:** 13/13
- Story 2.1: Create News Sourcing Package ✅
- Story 2.2: Implement GitHub Trending Source ✅
- Story 2.3: Implement HuggingFace Papers Source ✅
- Story 2.4: Implement Hacker News Source ✅
- Story 2.5: Implement Reddit Source ✅
- Story 2.6: Implement arXiv RSS Source ✅
- Story 2.7: Implement Freshness Scoring ✅
- Story 2.8: Implement Topic Selection ✅
- Story 2.9: Create Research Stage ✅
- Story 2.10: Create Script Generation Stage ✅
- Story 2.11: Create Pronunciation Dictionary ✅
- Story 2.12: Implement Term Extraction and Flagging ✅
- Story 2.13: Implement SSML Tagging ✅

**FRs Covered:** FR1-15 (100%)

**NFRs Addressed:** NFR18 (pronunciation), NFR20 (freshness), NFR21 (word count)

**Outcome:** Complete content intelligence pipeline from news sourcing to pronunciation-ready scripts
