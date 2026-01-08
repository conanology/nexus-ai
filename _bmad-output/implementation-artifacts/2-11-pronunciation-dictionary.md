# Story 2.11: Create Pronunciation Dictionary

Status: done

## Story

As a developer,
I want a pronunciation dictionary with IPA phonemes,
So that technical terms are pronounced correctly.

## Acceptance Criteria

1. **Given** core infrastructure from Epic 1
   **When** I implement the pronunciation dictionary
   **Then** `@nexus-ai/pronunciation` package is created

2. **And** dictionary is stored in Firestore at `pronunciation/{term}` per FR11:
   - `term`: the word/phrase
   - `ipa`: IPA phonetic transcription
   - `ssml`: SSML phoneme markup
   - `verified`: boolean (human-verified)
   - `source`: how term was added (seed, auto, manual)
   - `usageCount`: number of times used
   - `lastUsed`: timestamp
   - `addedDate`: timestamp

3. **And** seed script populates 200 initial terms including:
   - AI researchers: "Yann LeCun", "Geoffrey Hinton", "Fei-Fei Li"
   - Model names: "Mixtral", "LLaMA", "GPT", "DALL-E"
   - Companies: "Anthropic", "OpenAI", "Hugging Face"
   - Technical terms: "transformer", "diffusion", "RLHF"

4. **And** `getDictionary()` loads all terms into memory cache

5. **And** `lookupTerm(term)` returns pronunciation or null

6. **And** `addTerm(term, ipa, ssml)` adds to dictionary per FR14

7. **And** seed data stored in `data/pronunciation/seed.json`

## Tasks / Subtasks

- [x] Task 1: Create @nexus-ai/pronunciation package (AC: #1)
  - [x] Create package structure
  - [x] Set up exports

- [x] Task 2: Define dictionary types (AC: #2)
  - [x] Create PronunciationEntry interface
  - [x] Include all required fields
  - [x] Define source enum

- [x] Task 3: Create seed data (AC: #3, #7)
  - [x] Create seed.json with 200 terms
  - [x] Include AI researchers
  - [x] Include model names
  - [x] Include companies
  - [x] Include technical terms
  - [x] Add IPA and SSML for each

- [x] Task 4: Implement dictionary operations (AC: #4, #5, #6)
  - [x] getDictionary() with caching
  - [x] lookupTerm() for single term
  - [x] addTerm() for new entries
  - [x] updateUsage() to track usage

- [x] Task 5: Create seed script
  - [x] Script to load seed.json to Firestore
  - [x] Check for existing terms
  - [x] Report seed status

## Dev Notes

### PronunciationEntry Schema

```typescript
interface PronunciationEntry {
  term: string;
  ipa: string;
  ssml: string;
  verified: boolean;
  source: 'seed' | 'auto' | 'manual';
  usageCount: number;
  lastUsed: Timestamp | null;
  addedDate: Timestamp;
}
```

### Seed Data Sample

```json
{
  "terms": [
    {
      "term": "Mixtral",
      "ipa": "mɪkˈstrɑːl",
      "ssml": "<phoneme alphabet=\"ipa\" ph=\"mɪkˈstrɑːl\">Mixtral</phoneme>"
    },
    {
      "term": "Yann LeCun",
      "ipa": "jæn ləˈkʌn",
      "ssml": "<phoneme alphabet=\"ipa\" ph=\"jæn ləˈkʌn\">Yann LeCun</phoneme>"
    }
  ]
}
```

### Term Categories (200 total)

| Category | Count | Examples |
|----------|-------|----------|
| Researchers | 30 | LeCun, Hinton, Ng, Fei-Fei Li |
| Models | 40 | GPT, LLaMA, Mixtral, DALL-E |
| Companies | 25 | Anthropic, OpenAI, DeepMind |
| Technical | 60 | transformer, RLHF, diffusion |
| Acronyms | 25 | LLM, NLP, RAG, GGUF |
| Products | 20 | ChatGPT, Gemini, Claude |

### Caching Strategy

```typescript
let cache: Map<string, PronunciationEntry> | null = null;

async function getDictionary(): Promise<Map<string, PronunciationEntry>> {
  if (!cache) {
    cache = await loadFromFirestore();
  }
  return cache;
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created @nexus-ai/pronunciation package
- Defined PronunciationEntry with all required fields
- Created seed.json with 200 initial terms
- Implemented getDictionary with memory caching
- Implemented lookupTerm and addTerm operations
- Created seed script for Firestore population
- Terms organized by category for maintainability

### File List

**Created/Modified:**
- `nexus-ai/packages/pronunciation/package.json`
- `nexus-ai/packages/pronunciation/tsconfig.json`
- `nexus-ai/packages/pronunciation/src/types.ts`
- `nexus-ai/packages/pronunciation/src/dictionary.ts`
- `nexus-ai/packages/pronunciation/src/seed-data.ts`
- `nexus-ai/packages/pronunciation/src/index.ts`
- `nexus-ai/data/pronunciation/seed.json`

### Dependencies

- **Upstream Dependencies:** Story 1.6 (Firestore)
- **Downstream Dependencies:** Story 2.12-2.13 (Term extraction, SSML)
