# Story 2.9: create-research-stage

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to automatically generate comprehensive research briefs from selected news topics,
so that the script generation stage has all the factual foundation and context needed for a high-quality video script.

## Acceptance Criteria

1. **Research Brief Generation:** The system must use Gemini 3 Pro to generate a 2,000-word research brief from a topic URL and metadata (FR6).
2. **Comprehensive Content:** The brief must include facts, historical context, technical implications, and key quotes.
3. **Artifact Storage:** Research briefs must be stored in Cloud Storage at `{date}/research/research.md`.
4. **Pattern Compliance:** The stage must use the `executeStage` wrapper, `CostTracker`, and structured logging from `@nexus-ai/core`.
5. **Robustness:** Implement retry logic (3x) and fallback to Gemini 2.5 Pro if the primary model fails (FR43).
6. **Type Safety:** Use `StageInput<T>` and `StageOutput<T>` contracts for input/output.

## Tasks / Subtasks

- [x] **T1: Create Research Package (AC: 4, 6)**
  - [x] Initialize `@nexus-ai/research` package in `packages/research/`.
  - [x] Set up `package.json`, `tsconfig.json`, and basic folder structure.
- [x] **T2: Implement Research Logic (AC: 1, 2)**
  - [x] Implement `executeResearch` stage function in `src/research.ts`.
  - [x] Design research prompt for Gemini 3 Pro (facts, context, implications, quotes).
  - [x] Integrate LLM provider with fallback to Gemini 2.5 Pro.
- [x] **T3: Implement Artifact Storage (AC: 3)**
  - [x] Use `CloudStorageClient` to save research briefs to `{date}/research/research.md`.
- [x] **T4: Quality Gate & Cost Tracking (AC: 4)**
  - [x] Integrate `CostTracker` for LLM API calls.
  - [x] Implement research quality gate (check for minimum word count/content presence).
- [x] **T5: Testing**
  - [x] Unit tests for research prompt generation and response parsing.
  - [x] Integration test for the complete research stage (topic -> brief -> storage).

## Dev Notes

- **Architecture Pattern:** Central Orchestrator pattern. This is Stage 2 of the Content Intelligence Pipeline.
- **Package Location:** `packages/research/`.
- **LLM Selection:** Primary: `gemini-3-pro-preview`, Fallback: `gemini-2.5-pro`.
- **Infrastructure:** Uses Cloud Storage for brief persistence (`gs://nexus-ai-artifacts/{date}/research/research.md`).
- **Prompt Engineering:** The prompt must instruct Gemini to act as a deep-tech researcher, extracting structured data and synthesized insights.

### Project Structure Notes

- **Module:** `@nexus-ai/research`
- **Patterns:** MUST use `executeStage` from `@nexus-ai/core/utils`.
- **Naming:** Follow kebab-case for files, camelCase for functions.
- **Error Handling:** Use `NexusError.fromError(error, 'research')` or specific codes like `NEXUS_RESEARCH_LLM_FAILURE`.
- **Testing:** 100% coverage on core logic using Vitest.

### Previous Story Intelligence

- **From Story 2.8 (Topic Selection):** The topic object passed to this stage includes `url`, `title`, and `metadata`. Ensure the researcher uses all available metadata for better context.
- **Pattern Learning:** `executeStage` wrapper successfully simplified topic selection implementation; continue using it here.
- **GCP Client Usage:** `FirestoreClient` worked well for state; `CloudStorageClient` should be used here for the research brief.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.9: Create Research Stage]
- [Source: _bmad-output/planning-artifacts/prd.md#Content Generation (FR6)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 2: Stage Deployment Model]
- [Source: _bmad-output/project-context.md#Stage Execution Template]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

N/A - Implementation completed without requiring debugging

### Completion Notes List

- ✅ Created `@nexus-ai/research` package with proper TypeScript configuration
- ✅ Implemented `executeResearch` stage function using `executeStage` wrapper from `@nexus-ai/core`
- ✅ Designed comprehensive research prompt for Gemini 3 Pro with sections for facts, historical context, technical implications, and key quotes
- ✅ Integrated LLM provider with retry logic (3x) and fallback from Gemini 3 Pro to Gemini 2.5 Pro
- ✅ Implemented Cloud Storage artifact persistence using `CloudStorageClient` to save briefs at `{date}/research/research.md`
- ✅ Integrated `CostTracker` for automatic LLM API cost tracking
- ✅ Registered research quality gate in `@nexus-ai/core/quality/gates.ts` with minimum word count validation (1,800 words)
- ✅ Created comprehensive test suite with 17 tests covering all functionality
- ✅ All tests passing (17/17) across research package and full monorepo
- ✅ All 6 acceptance criteria satisfied:
  - AC1: Research brief generation using Gemini 3 Pro ✓
  - AC2: Comprehensive content (facts, context, implications, quotes) ✓
  - AC3: Artifact storage at `{date}/research/research.md` ✓
  - AC4: Pattern compliance (executeStage, CostTracker, structured logging) ✓
  - AC5: Retry logic (3x) and Gemini 2.5 Pro fallback ✓
  - AC6: Type safety with StageInput/StageOutput contracts ✓

### File List

- `packages/research/package.json`
- `packages/research/tsconfig.json`
- `packages/research/src/index.ts`
- `packages/research/src/types.ts`
- `packages/research/src/research.ts`
- `packages/research/src/__tests__/types.test.ts`
- `packages/research/src/__tests__/research.test.ts`
- `packages/core/src/quality/gates.ts` (modified - added research quality gate)
