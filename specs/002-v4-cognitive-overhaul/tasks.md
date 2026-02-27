# Tasks: V4 Cognitive Generation Overhaul

**Input**: Design documents from `/specs/002-v4-cognitive-overhaul/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/internal-interfaces.md

**Tests**: Included per spec requirement — each pillar requires unit tests for new modules.

**Organization**: Tasks grouped by user story (P1-P4) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1=Troll Agent, US2=DynamicChart, US3=Agentic Browser, US4=Channel Memory)
- Exact file paths included in every task

---

## Phase 1: Setup (Dependencies & Configuration)

**Purpose**: Install new dependencies and verify the development environment

- [x] T001 Add `sql.js` (WASM SQLite — `better-sqlite3` failed on Node v25 native build) as dependency to `packages/script-gen/package.json`
- [x] T002 [P] Add `@browserbasehq/stagehand` as an optional peer dependency in `packages/visual-gen/package.json`
- [x] T003 Run `pnpm install` and verify lockfile updates cleanly

---

## Phase 2: Foundational (Shared Types & Schemas)

**Purpose**: Define all cross-package types and Zod schemas that multiple user stories depend on. MUST be complete before any user story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

### Director-Agent Types

- [x] T004 Add `DynamicChartVisualData` interface and `DynamicChartVisualDataSchema` Zod schema to `packages/director-agent/src/types.ts` — fields: chartType ('bar'|'line'), title (string, max 80), data (array 2-12 of {label, value}), unit? (string), animationStyle? ('sequential'|'simultaneous'). Use `.passthrough()` per Constitution VI.
- [x] T005 Add `'dynamic-chart'` to the `SceneType` union in `packages/director-agent/src/types.ts`

### Video-Studio Types

- [x] T006 [P] Add `'dynamic-chart'` to the `SceneType` union and add `DynamicChartVisualData` interface in `apps/video-studio/src/types/scenes.ts` — must mirror director-agent types exactly

### Script-Gen Types

- [x] T007 [P] Add `DebateRound`, `TrollEvaluation`, `DebateResult`, and `VideoMemoryEntry` interfaces to `packages/script-gen/src/types.ts` — fields per data-model.md and contracts/internal-interfaces.md

### Director-Agent Rebuild

- [x] T008 Rebuild director-agent package (`cd packages/director-agent && npx tsc`) so downstream packages see updated dist types

**Checkpoint**: All shared types defined. Type-check `packages/director-agent`, `packages/script-gen`, and `apps/video-studio` with `npx tsc --noEmit`.

---

## Phase 3: User Story 1 — Retention Debate / Troll Agent (Priority: P1)

**Goal**: Add an adversarial debate loop between Critic and Optimizer in script-gen that evaluates drafts for viewer retention weaknesses and iterates up to 3 rounds.

**Independent Test**: Run `pnpm test --filter @nexus-ai/script-gen`. Debate loop tests must verify: score-based approval, max-round fallback to best draft, early exit on first-round approval, and writer revision integration.

### Tests for US1

- [x] T009 [P] [US1] Create unit tests for the Troll Agent debate loop in `packages/script-gen/src/__tests__/troll-agent.test.ts` — test cases: (1) Troll approves on round 1 → immediate pass-through, (2) Troll rejects all 3 rounds → selects highest-scoring draft, (3) Troll approves on round 2 → correct draft forwarded, (4) score/critique/metrics extraction from LLM response, (5) provider fallback chain, (6) empty critique handling

### Implementation for US1

- [x] T010 [P] [US1] Add `buildTrollPrompt(draft: string, researchBrief: string)` to `packages/script-gen/src/prompts.ts` — persona: bored YouTube viewer; criteria: hooks, open loops, 15s payoff rule; output format: JSON with score (0-100), approved (boolean), critique (markdown), metrics ({hookCount, openLoopCount, longestGapSec})
- [x] T011 [US1] Create `packages/script-gen/src/troll-agent.ts` exporting `executeTrollDebate()` per contract signature — debate loop: Troll evaluates → if approved (score>=70) exit → else Writer revises → repeat up to maxRounds (default 3) → select best-scoring draft. LLM config: same provider chain as Critic, temperature 0.4. Each round produces a `DebateRound` record.
- [x] T012 [US1] Modify `packages/script-gen/src/script-gen.ts` to insert the debate loop after the Critic agent and before the Optimizer agent (~line 405) — call `executeTrollDebate()` with Critic's revised draft, pass the best draft to Optimizer. Add console logging: `[Troll] Round N: Score X/100 — APPROVED/NOT APPROVED`.

**Checkpoint**: `pnpm test --filter @nexus-ai/script-gen` passes. `npx tsc --noEmit` in `packages/script-gen` clean.

---

## Phase 4: User Story 2 — Dynamic Data Visualization (Priority: P2)

**Goal**: Add a `dynamic-chart` scene type with animated SVG bar/line charts in Neon Hacker aesthetic, auto-detected from statistical comparisons in script segments.

**Independent Test**: Run `pnpm test --filter @nexus-ai/director-agent` and `pnpm test --filter @nexus-ai/video-studio`. Chart detection tests must verify: bar/line auto-selection, heuristic regex fallback, Zod validation of chart data. Component tests must verify: SVG rendering with correct data points, animation frames, Neon Green accent color.

### Tests for US2

- [x] T013 [P] [US2] Add chart detection test cases to `packages/director-agent/src/__tests__/scene-classifier.test.ts` — test cases: (1) segment with "X is Ny faster than Z" → dynamic-chart with bar type, (2) segment with "grew from N% to M%" → dynamic-chart with line type, (3) segment with single number, no comparison → stat-callout (not chart), (4) qualitative comparison "significantly faster" → not chart, (5) chart data Zod validation for 2-12 data points, (6) heuristic fallback when LLM returns no chartData
- [x] T014 [P] [US2] Create Remotion component tests in `apps/video-studio/src/components/scenes/__tests__/DynamicChart.test.tsx` — test cases: (1) bar chart renders correct number of SVG rect elements, (2) line chart renders SVG path, (3) title renders above chart, (4) data labels render for each point, (5) Neon Green (#aaff00) used as accent color, (6) animation progresses with useCurrentFrame(), (7) handles 2 data points (minimum), (8) handles 12 data points (maximum)

### Implementation for US2

- [x] T015 [P] [US2] Add dynamic-chart classification guidance to `packages/director-agent/src/prompts/director-system.ts` — instruct LLM to output `sceneType: "dynamic-chart"` with `visualData: { chartType, title, data[], unit?, animationStyle? }` when segment contains comparative numerical data. Include auto-selection rule: time-series keywords (years, months, quarters) → 'line', otherwise → 'bar'.
- [x] T016 [P] [US2] Add chart heuristic detection and regex fallback to `packages/director-agent/src/scene-classifier.ts` — patterns: `X is N% faster than Y` → bar, `grew from N% to M%` → line, `$Nm vs $Mm` → bar. If both LLM and regex fail → fall back to stat-callout.
- [x] T017 [US2] Add dynamic-chart default `visualData` fallback to `packages/director-agent/src/validator.ts` — when scene has type 'dynamic-chart' but missing/invalid visualData, provide sensible defaults: chartType 'bar', title from segment text, empty data array triggers fallback to stat-callout.
- [x] T018 [P] [US2] Add `'dynamic-chart'` SFX mapping to `packages/asset-library/src/audio-assets.ts` — map to `['reveal']` (same as map-animation pattern)
- [x] T019 [US2] Create `apps/video-studio/src/components/scenes/DynamicChart.tsx` — pure SVG Remotion component: bar chart (vertical bars, left-to-right spring entrance, 3-frame stagger per bar) and line chart (stroke-dashoffset draw-on). Colors: #aaff00 accent, #0a0a0a background. Title slam entrance frames 0-6. Glow effect via feGaussianBlur on data points. Scale normalization for outlier handling. Props from `DynamicChartVisualData`.
- [x] T020 [US2] Register `DynamicChart` in `apps/video-studio/src/SceneRouter.tsx` — add to SCENE_REGISTRY as `'dynamic-chart': DynamicChart`

**Checkpoint**: `pnpm test --filter @nexus-ai/director-agent` and video-studio tests pass. Rebuild director-agent (`npx tsc`). Type-check all 4 packages.

---

## Phase 5: User Story 3 — Agentic Visual Capture (Priority: P3)

**Goal**: Add a Stagehand-based agentic browser fallback in visual-gen that autonomously navigates pages when static CSS selectors fail, with 30s timeout and graceful degradation.

**Independent Test**: Run `pnpm test --filter @nexus-ai/visual-gen`. Agentic browser tests must verify: successful capture flow, timeout handling, domain hop restriction, Stagehand-not-installed fallback, CAPTCHA/login detection and abort.

### Tests for US3

- [x] T021 [P] [US3] Create unit tests in `packages/visual-gen/src/__tests__/agentic-browser.test.ts` — test cases: (1) successful capture returns buffer + 'success' status, (2) timeout after 30s returns null + 'timeout' status, (3) CAPTCHA detection returns null + 'blocked' status, (4) domain hop beyond limit returns null + 'error', (5) Stagehand import failure returns null gracefully (dynamic import mock), (6) actionsPerformed tracks navigation steps, (7) elapsedMs is recorded accurately

### Implementation for US3

- [x] T022 [P] [US3] Create `packages/visual-gen/src/agentic-browser.ts` exporting `captureWithAgenticBrowser()` per contract signature — dynamic `await import('@browserbasehq/stagehand')` with try-catch (returns null if not installed). Uses existing Playwright page. Natural language navigation via `page.act()`. 30s hard timeout. Domain hop check (compare URL origin before/after each action, max 1 hop). Detect CAPTCHAs and login walls → abort with 'blocked' status. Log actions at info level, failures at warn level.
- [x] T023 [US3] Modify `packages/asset-library/src/screenshots/screenshot-service.ts` to add agentic browser fallback — in the CSS selector capture path (~line 416), after `locator.isVisible()` fails, try `captureWithAgenticBrowser(page, url, searchObjective)` before falling through to viewport screenshot. Import `captureWithAgenticBrowser` from `@nexus-ai/visual-gen`. Pass scene content as `searchObjective`.

**Checkpoint**: `pnpm test --filter @nexus-ai/visual-gen` passes. Pipeline works with AND without Stagehand installed. Type-check `packages/visual-gen` and `packages/asset-library`.

---

## Phase 6: User Story 4 — Channel Lore & Memory (Priority: P4)

**Goal**: Add a SQLite-backed persistent memory store that enables cross-video lore references in scripts, with TF-IDF similarity search and graceful fallback when unavailable.

**Independent Test**: Run `pnpm test --filter @nexus-ai/script-gen` (memory tests). Verify: CRUD operations, TF-IDF similarity ranking, empty-store graceful handling, corrupt DB fallback to no-op client, and pipeline integration (read before script-gen, write after completion).

### Tests for US4

- [x] T024 [P] [US4] Create unit tests in `packages/script-gen/src/__tests__/memory-client.test.ts` — test cases: (1) save() and query() round-trip, (2) query() returns entries ranked by TF-IDF similarity, (3) query() returns empty array on empty store, (4) query() returns max 5 entries (limit parameter), (5) createMemoryClient() returns no-op client on DB error, (6) save() is silent no-op on DB error, (7) close() releases DB connection, (8) TF-IDF cosine similarity: exact topic match ranks higher than partial match, (9) concurrent save calls don't corrupt DB

### Implementation for US4

- [x] T025 [P] [US4] Create `packages/script-gen/src/memory-client.ts` — exports `createMemoryClient(dbPath?)` factory per contract. SQLite table `video_memory` with columns matching `VideoMemoryEntry`. TF-IDF cosine similarity on `topicTags` + title keywords for query ranking. Default dbPath: `local-storage/memory/channel-lore.db`. Auto-creates directory and table if not exists. All errors caught → return empty results (query) or no-op (save). 10s timeout per Constitution XII.
- [x] T026 [P] [US4] Add `buildLorePrompt(pastVideos: VideoMemoryEntry[])` to `packages/script-gen/src/prompts.ts` — formats past video summaries as "Channel History" context section for the Writer agent. Includes topic, title, key claims, and stance for each entry. Limits to max 2 lore reference suggestions per video.
- [x] T027 [US4] Modify `packages/script-gen/src/script-gen.ts` to inject memory context into the Writer agent prompt — accept optional `channelHistory: VideoMemoryEntry[]` parameter, call `buildLorePrompt()` to add context before the Writer agent generates the draft.
- [x] T028 [US4] Modify `scripts/run-local.ts` to add memory read/write pipeline steps — READ: after research (Step 3), before script-gen (Step 4) at ~line 1208: `createMemoryClient()` → `query(topicData.title, 5)` → pass results to script-gen as `channelHistory`. WRITE: after chapters (Step 11) at ~line 1421: `save()` with topic, title, slug, claims, stance, topicTags, source, wordCount, sceneCount, durationSec → `close()`. Add console logging: `[Memory] Found N related videos` / `[Memory] Saved video entry`.

**Checkpoint**: `pnpm test --filter @nexus-ai/script-gen` passes (including new memory tests). Pipeline runs successfully twice with related topics — second run references first. Type-check `packages/script-gen`.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final integration verification, cross-package type-checking, and E2E validation

- [x] T029 Type-check all affected packages: `packages/script-gen`, `packages/director-agent`, `packages/visual-gen`, `packages/asset-library`, `apps/video-studio` — run `npx tsc --noEmit` in each
- [x] T030 [P] Rebuild director-agent final: `cd packages/director-agent && npx tsc` — ensures visual-gen and video-studio see all updated dist types
- [x] T031 Run full test suite: `pnpm test` — verify no regressions beyond pre-existing 37 failures
- [x] T032 Run quickstart.md validation: test each pillar independently per `specs/002-v4-cognitive-overhaul/quickstart.md` test instructions
- [x] T033 Verify all fallback paths: (1) pipeline completes without Stagehand installed, (2) pipeline completes with memory DB missing, (3) pipeline completes when Gemini is unavailable for chart extraction (stat-callout fallback), (4) debate loop selects best draft when all 3 rounds fail approval

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (pnpm install) — BLOCKS all user stories
- **US1-US4 (Phases 3-6)**: All depend on Phase 2 completion. Can proceed in parallel or sequentially in priority order.
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 — Troll Agent (P1)**: Depends on Phase 2 types (T007). No dependency on other stories. Modifies `script-gen.ts`.
- **US2 — Dynamic Chart (P2)**: Depends on Phase 2 types (T004-T006, T008). No dependency on other stories. Touches director-agent, video-studio, asset-library.
- **US3 — Agentic Browser (P3)**: Depends on Phase 2 (no new types needed beyond T002). No dependency on other stories. Touches visual-gen, asset-library/screenshots.
- **US4 — Channel Memory (P4)**: Depends on Phase 2 types (T007). Shares `script-gen.ts` with US1 (T012 and T027 modify different sections). Also modifies `run-local.ts` and `prompts.ts`.

### Conflict Notes

- **US1 + US4** both modify `packages/script-gen/src/script-gen.ts` and `packages/script-gen/src/prompts.ts` — if implemented in parallel, coordinate merge carefully. US1 inserts debate loop (line ~405), US4 adds memory parameter to Writer call (different section). `prompts.ts`: US1 adds `buildTrollPrompt`, US4 adds `buildLorePrompt` (separate functions, no conflict).
- **US2 + US3** touch `packages/asset-library/src/` but different files (audio-assets.ts vs screenshots/screenshot-service.ts) — safe to parallelize.

### Within Each User Story

- Tests written first → verify they fail → implement → verify they pass
- Types/schemas before logic
- Core module before integration points
- Type-check after completion

### Parallel Opportunities

```
Phase 2 (parallel group):
  T004 + T005 (director-agent types) ─── sequential (same file)
  T006 (video-studio types)          ─── parallel with T004
  T007 (script-gen types)            ─── parallel with T004
  T008 (rebuild)                     ─── after T004+T005

After Phase 2, all user stories can start in parallel:
  US1: T009 ∥ T010 → T011 → T012
  US2: T013 ∥ T014 ∥ T015 ∥ T016 ∥ T018 → T017 → T019 → T020
  US3: T021 ∥ T022 → T023
  US4: T024 ∥ T025 ∥ T026 → T027 → T028
```

---

## Parallel Example: User Story 2 (DynamicChart)

```bash
# Launch tests and independent implementation files in parallel:
Task: "T013 — Chart detection tests in scene-classifier.test.ts"
Task: "T014 — DynamicChart component tests in DynamicChart.test.tsx"
Task: "T015 — Director prompt update in director-system.ts"
Task: "T016 — Chart heuristic detection in scene-classifier.ts"
Task: "T018 — SFX mapping in audio-assets.ts"

# Then sequential (depends on above):
Task: "T017 — Validator defaults in validator.ts"
Task: "T019 — DynamicChart component in DynamicChart.tsx"
Task: "T020 — Register in SceneRouter.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational types (T004-T008)
3. Complete Phase 3: US1 — Troll Agent (T009-T012)
4. **STOP and VALIDATE**: `pnpm test --filter @nexus-ai/script-gen`, run pipeline, compare retention metrics
5. Deploy/demo if ready — the debate loop alone is the highest-impact quality improvement

### Incremental Delivery

1. Setup + Foundational → Types ready
2. Add US1 (Troll Agent) → Test independently → Validate retention improvement (MVP!)
3. Add US2 (DynamicChart) → Test independently → Validate chart rendering in final video
4. Add US3 (Agentic Browser) → Test independently → Validate screenshot success rate improvement
5. Add US4 (Channel Memory) → Test with 2+ related pipeline runs → Validate lore references
6. Polish → Full E2E validation → All fallback paths verified

### Single-Developer Sequential Strategy

1. Phase 1 + 2 → Foundation (3 tasks + 5 tasks)
2. US1 → 4 tasks, highest impact
3. US4 → 5 tasks, shares files with US1 (do these back-to-back to minimize merge conflicts)
4. US2 → 8 tasks, independent package set (director-agent, video-studio)
5. US3 → 3 tasks, independent package set (visual-gen, asset-library)
6. Phase 7 → Final verification (5 tasks)

---

## Summary

| Metric | Count |
|--------|-------|
| Total tasks | 33 |
| Phase 1 (Setup) | 3 |
| Phase 2 (Foundational) | 5 |
| Phase 3 / US1 (Troll Agent) | 4 |
| Phase 4 / US2 (DynamicChart) | 8 |
| Phase 5 / US3 (Agentic Browser) | 3 |
| Phase 6 / US4 (Channel Memory) | 5 |
| Phase 7 (Polish) | 5 |
| Parallelizable tasks ([P]) | 18 |
| Test tasks | 4 (T009, T013, T014, T021, T024) |
| New files created | 6 (troll-agent.ts, memory-client.ts, agentic-browser.ts, DynamicChart.tsx, + 4 test files) |
| Existing files modified | 11 (types×3, prompts.ts, script-gen.ts, scene-classifier.ts, director-system.ts, validator.ts, audio-assets.ts, screenshot-service.ts, SceneRouter.tsx, run-local.ts) |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps each task to its user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1 + US4 share `script-gen.ts` and `prompts.ts` — coordinate if implementing in parallel
