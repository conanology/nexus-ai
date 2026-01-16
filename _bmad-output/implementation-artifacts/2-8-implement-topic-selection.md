# Story 2.8: implement-topic-selection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system operator,
I want to automatically select the best AI news topic for the daily video briefing,
so that the most relevant and fresh content is delivered to viewers without manual intervention.

## Acceptance Criteria

1. **Top Topic Selection:** The system must select the single highest-scored news item from the list of scored candidates.
2. **Minimum Viable Topics Validation:** The system must verify that at least 3 viable candidates exist before selection.
3. **Fallback Logic:** If fewer than 3 viable candidates exist, the system must trigger a fallback to a "deep dive" topic (items older than 48 hours).
4. **Data Persistence:** The selected topic, candidates, and selection metadata must be stored in Firestore at `topics/{YYYY-MM-DD}`.
5. **Orchestration:** The `executeNewsSourcing()` stage function must coordinate fetching, scoring, and selection.
6. **Pattern Compliance:** Must use the `executeStage` wrapper, `CostTracker`, and structured logging.
7. **Type Safety:** Must use `StageInput<T>` and `StageOutput<T>` contracts from `@nexus-ai/core`.

## Tasks / Subtasks

- [x] **T1: Implement Topic Selection Logic (AC: 1, 2, 3)**
  - [x] Create `selectTopic` function in `src/news-sourcing.ts`.
  - [x] Implement filtering for ≥3 candidates.
  - [x] Implement fallback to 48hr+ "deep dive" topics.
- [x] **T2: Orchestrate News Sourcing Stage (AC: 5, 6, 7)**
  - [x] Implement `executeNewsSourcing` stage function.
  - [x] Integrate source fetching (GitHub, HF, HN, Reddit, arXiv).
  - [x] Integrate freshness scoring.
  - [x] Use `executeStage` wrapper.
- [x] **T3: Implement Data Persistence (AC: 4)**
  - [x] Use `FirestoreClient` to save selection to `topics/{YYYY-MM-DD}`.
  - [x] Store `selected` topic, top 10 `candidates`, and `selectionTime`.
- [x] **T4: Quality Gate & Cost Tracking (AC: 6)**
  - [x] Add `CostTracker` recording for API calls (if any in this stage).
  - [x] Implement/Call news-sourcing quality gate.
- [x] **T5: Testing**
  - [x] Unit tests for selection and fallback logic.
  - [x] Integration test for the complete stage execution.

## Dev Notes

- **Architecture Pattern:** Central Orchestrator pattern. This stage is part of the Content Intelligence Pipeline (Epic 2).
- **Package Location:** `packages/news-sourcing/`.
- **GCP Integration:** Firestore is used for state persistence. Path: `topics/{YYYY-MM-DD}`.
- **Error Handling:** Use `NexusError` for any selection failures (e.g., `NEXUS_NEWS_SOURCING_NO_TOPICS`).
- **NFR Compliance:** 
  - NFR20: News freshness < 24 hours (target).
  - NFR13: Cost tracking accuracy.
- **Logging:** Use `nexus.news-sourcing.selection` as logger name.

### Project Structure Notes

- Package: `@nexus-ai/news-sourcing`
- Entry point: `src/index.ts`
- Core logic: `src/news-sourcing.ts`
- Shared types from: `@nexus-ai/core`

### References

- [Source: _bmad-output/planning-artifacts/prd.md#News Intelligence]
- [Source: _bmad-output/planning-artifacts/architecture.md#1. Pipeline Orchestration: Central Orchestrator]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8: Implement Topic Selection]
- [Source: _bmad-output/project-context.md#Stage Execution Template]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

N/A - Implementation completed without issues

### Completion Notes List

- ✅ **Topic Selection Logic (T1)**: Implemented `selectTopic()` function with AC1, AC2, AC3 requirements
  - Selects highest-scored item from fresh candidates (<48h old)
  - Validates ≥3 viable candidates exist
  - Triggers fallback with deep dive identification when <3 fresh candidates
  - Comprehensive unit tests covering all acceptance criteria and edge cases

- ✅ **News Sourcing Orchestration (T2)**: Enhanced `executeNewsSourcing()` stage function
  - Integrated all 5 sources: GitHub, HuggingFace, Hacker News, Reddit, arXiv
  - Parallel fetching with error isolation per source
  - Freshness scoring and sorting using existing scoring utilities
  - Full StageInput/StageOutput contract compliance (AC7)
  - executeStage wrapper with CostTracker integration (AC6)

- ✅ **Data Persistence (T3)**: Firestore integration implemented
  - Topic selection persisted to `topics/{YYYY-MM-DD}` collection
  - Stores: selected topic, top 10 candidates, selection metadata, source counts
  - Includes fallback and deepDiveCandidates when applicable
  - Error handling with graceful degradation (logs error but doesn't fail stage)

- ✅ **Quality Gate (T4)**: Implemented news-sourcing quality gate
  - Validates topic selection success or fallback identification
  - Checks for deep dive candidates when fallback triggered
  - Warns on low candidate counts
  - Integrated into stage execution via executeStage options

- ✅ **Testing (T5)**: Comprehensive test coverage
  - 9 unit tests for selectTopic covering all ACs and edge cases
  - 1 integration test for full stage execution (fetch → score → select → persist)
  - Tests validate: top topic selection, minimum candidates, fallback logic, Firestore persistence
  - All tests passing (10/10)
  - Build successful with no TypeScript errors

### File List
- `packages/news-sourcing/src/news-sourcing.ts` (orchestration + topic selection logic)
- `packages/news-sourcing/src/types.ts` (added TopicSelectionResult interface)
- `packages/news-sourcing/src/index.ts` (updated exports)
- `packages/news-sourcing/src/news-sourcing.test.ts` (comprehensive test suite)
- `packages/core/src/quality/gates.ts` (added news-sourcing quality gate)
