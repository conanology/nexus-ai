# Story 2.12: Implement Term Extraction and Flagging

Status: done

## Story

As a developer,
I want to extract technical terms and flag unknowns,
So that pronunciation issues are caught before TTS.

## Acceptance Criteria

1. **Given** pronunciation dictionary from Story 2.11
   **When** I implement term extraction and flagging
   **Then** `extractTerms(script: string)` identifies potential technical terms per FR12:
   - Capitalized words not at sentence start
   - Known tech patterns (camelCase, acronyms, version numbers)
   - Names (proper nouns)
   - Model names and product names

2. **And** `checkPronunciations(terms: string[])` validates against dictionary:
   - Returns `{ known: Term[], unknown: string[] }`

3. **And** flagging logic per FR13:
   - If unknown.length > 3, flag for human review
   - Create review item in Firestore at `review-queue/{id}`
   - Include script context for each unknown term

4. **And** auto-resolution per FR14:
   - After human provides pronunciation, auto-add to dictionary
   - Update `source: 'manual'` and `verified: true`

5. **And** logging tracks extraction stats (terms found, known, unknown)

## Tasks / Subtasks

- [x] Task 1: Implement extractTerms (AC: #1)
  - [x] Detect capitalized words (not sentence start)
  - [x] Detect camelCase patterns
  - [x] Detect acronyms (all caps, 2+ letters)
  - [x] Detect version numbers (v1.0, 3.5)
  - [x] Detect proper nouns
  - [x] Deduplicate results

- [x] Task 2: Implement checkPronunciations (AC: #2)
  - [x] Load dictionary
  - [x] Check each term
  - [x] Return known/unknown split
  - [x] Include pronunciation data for known

- [x] Task 3: Implement flagging (AC: #3)
  - [x] Check unknown count > 3
  - [x] Create review queue item
  - [x] Include term context from script
  - [x] Store to Firestore

- [x] Task 4: Implement auto-resolution (AC: #4)
  - [x] resolveUnknownTerm function
  - [x] Add to dictionary with source: 'manual'
  - [x] Set verified: true
  - [x] Remove from review queue

- [x] Task 5: Add logging (AC: #5)
  - [x] Log total terms found
  - [x] Log known count
  - [x] Log unknown count
  - [x] Log flagging decision

## Dev Notes

### Term Extraction Patterns

```typescript
const patterns = {
  // Capitalized word not at sentence start
  capitalWord: /(?<!\. |\? |\! |^)[A-Z][a-z]+/g,

  // camelCase or PascalCase
  camelCase: /[a-z]+[A-Z][a-zA-Z]*/g,

  // Acronyms (2+ capital letters)
  acronym: /\b[A-Z]{2,}\b/g,

  // Version numbers
  version: /\b(?:v?\d+(?:\.\d+)+|[A-Za-z]+[\-_]?\d+(?:\.\d+)*)\b/g,

  // Known model patterns
  modelNames: /\b(?:GPT|LLaMA|Mixtral|Claude|Gemini)[\-_]?[\w.]*\b/gi
};
```

### Review Queue Item

```typescript
interface ReviewQueueItem {
  id: string;
  type: 'pronunciation';
  pipelineId: string;
  stage: 'pronunciation';
  unknownTerms: Array<{
    term: string;
    context: string;  // Surrounding sentence
  }>;
  createdAt: Timestamp;
  status: 'pending' | 'resolved';
}
```

### Flagging Threshold

Per FR13: Flag when unknown.length > 3
- 1-3 unknowns: Proceed with warning
- 4+ unknowns: Create review queue item

### Context Extraction

```typescript
function getTermContext(script: string, term: string): string {
  // Find the sentence containing the term
  const sentences = script.split(/[.!?]+/);
  return sentences.find(s => s.includes(term)) || '';
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented extractTerms with multiple pattern detection
- Detects capitals, camelCase, acronyms, versions, model names
- checkPronunciations returns known/unknown split
- Flags to review queue when >3 unknowns
- Includes sentence context for each unknown term
- resolveUnknownTerm adds to dictionary and clears queue
- Logging tracks all extraction stats

### File List

**Created/Modified:**
- `nexus-ai/packages/pronunciation/src/term-extraction.ts`

### Dependencies

- **Upstream Dependencies:** Story 2.11 (Dictionary)
- **Downstream Dependencies:** Story 2.13 (SSML Tagging)
