# Implementation Plan: V4 Cognitive Generation Overhaul

**Branch**: `002-v4-cognitive-overhaul` | **Date**: 2026-02-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-v4-cognitive-overhaul/spec.md`

## Summary

Upgrade the Nexus-AI automated pipeline with four cognitive
pillars: (1) a Troll Agent adversarial debate loop in script-gen
that critiques drafts for viewer retention weaknesses before
optimization, (2) a DynamicChart Remotion scene type rendered as
animated SVG bar/line charts with Neon Hacker aesthetic, (3) an
agentic browser fallback (Stagehand) in visual-gen that
autonomously navigates sites when static CSS selectors fail, and
(4) a SQLite-backed channel memory store that enables cross-video
lore references in scripts. All external integrations follow
Constitution XII (MCP-compatible wrappers with graceful fallbacks).

## Technical Context

**Language/Version**: TypeScript (strict mode, ESM), Node >= 20
**Primary Dependencies**: `@google/generative-ai` ^0.16.0 (Gemini),
  Remotion (video rendering), Playwright (browser automation),
  `better-sqlite3` (new — memory store),
  `@browserbasehq/stagehand` (new — optional, agentic browser)
**Storage**: SQLite file (`local-storage/memory/channel-lore.db`)
  for channel memory; existing local-storage for pipeline artifacts
**Testing**: Vitest (workspace mode), tests in `src/__tests__/`
**Target Platform**: Node.js CLI pipeline (local + GCP cloud)
**Project Type**: Monorepo (4 apps + 17 packages), automated
  video production pipeline
**Performance Goals**: Debate loop adds <90s; agentic browser
  30s timeout per attempt; chart rendering at 30fps 1920x1080
**Constraints**: Pipeline must complete without any new external
  service running (all fallbacks produce valid output); Neon Hacker
  palette (#aaff00 on #0a0a0a) for all new visual components
**Scale/Scope**: 4 packages modified, 1 new scene type (18th),
  ~15 new/modified source files, ~20 new test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Package-First Architecture | PASS | All changes within existing packages (script-gen, director-agent, visual-gen, video-studio). No new packages created. |
| II. Strict TypeScript & ESM | PASS | All new files are TypeScript ESM with `.js` import extensions. |
| III. Test Discipline | PASS | Each pillar includes unit tests. Affected packages must pass `tsc --noEmit` + vitest. |
| IV. Pipeline Order Integrity | PASS | No new enricher changes pipeline order. Chart data extracted during classification (existing step). Memory read/write are bookend steps. |
| V. Dual-Mode Operation | PASS | SQLite memory store is local-first. Stagehand is optional. No new cloud dependencies. |
| VI. Schema Safety | PASS | DynamicChartVisualData schema uses `.passthrough()`. Chart data validated by Zod. |
| VII. Simplicity & YAGNI | PASS | SVG charts instead of charting library. TF-IDF instead of neural embeddings. Sequential debate instead of parallel. See Complexity Tracking for justified additions. |
| VIII. Strict Visual Identity | PASS | DynamicChart uses #aaff00 on #0a0a0a exclusively. |
| IX. Backward Compatibility | PASS | V1 timeline path untouched. New scene type additive only. |
| X. Component Modularity | PASS | DynamicChart is self-contained. All enricher changes have silent fallbacks. |
| XI. No Hallucinations | PASS | All new files in established directories (scenes/, enrichers in visual-gen/src/, prompts in script-gen/src/). |
| XII. Cognitive & MCP Integration | PASS | Memory client: 10s timeout, empty-result fallback. Agentic browser: 30s timeout, null-screenshot fallback. Both log at warn level on fallback. |

**Post-Phase 1 re-check**: All PASS. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/002-v4-cognitive-overhaul/
├── plan.md                      # This file
├── spec.md                      # Feature specification
├── research.md                  # Phase 0: technical decisions
├── data-model.md                # Phase 1: entity definitions
├── quickstart.md                # Phase 1: testing guide
├── contracts/
│   └── internal-interfaces.md   # Phase 1: TypeScript interfaces
├── checklists/
│   └── requirements.md          # Spec quality checklist
└── tasks.md                     # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/script-gen/src/
├── troll-agent.ts               # NEW: Troll Agent debate loop
├── memory-client.ts             # NEW: SQLite memory client
├── prompts.ts                   # MODIFIED: +buildTrollPrompt, +buildLorePrompt
├── script-gen.ts                # MODIFIED: insert debate loop + memory injection
├── types.ts                     # MODIFIED: +DebateRound, +TrollEvaluation, +VideoMemoryEntry
└── __tests__/
    ├── troll-agent.test.ts      # NEW: debate loop tests
    └── memory-client.test.ts    # NEW: memory CRUD + similarity tests

packages/director-agent/src/
├── types.ts                     # MODIFIED: +DynamicChartVisualData, +'dynamic-chart' SceneType
├── scene-classifier.ts          # MODIFIED: +chart heuristic detection + defaults
├── prompts/
│   └── director-system.ts       # MODIFIED: +dynamic-chart classification guidance
├── validator.ts                 # MODIFIED: +dynamic-chart default visualData
└── __tests__/
    └── scene-classifier.test.ts # MODIFIED: +chart detection tests

packages/visual-gen/src/
├── agentic-browser.ts           # NEW: Stagehand agentic capture wrapper
├── screenshot-service.ts        # MODIFIED (in asset-library): +agentic fallback path
└── __tests__/
    └── agentic-browser.test.ts  # NEW: agentic capture tests

packages/asset-library/src/
├── audio-assets.ts              # MODIFIED: +dynamic-chart SFX mapping
└── screenshots/
    └── screenshot-service.ts    # MODIFIED: +agentic browser fallback in CSS selector path

apps/video-studio/src/
├── types/
│   └── scenes.ts                # MODIFIED: +'dynamic-chart' SceneType + DynamicChartVisualData
├── components/scenes/
│   └── DynamicChart.tsx          # NEW: animated SVG bar/line chart component
├── SceneRouter.tsx              # MODIFIED: register DynamicChart
└── components/scenes/__tests__/
    └── DynamicChart.test.tsx    # NEW: chart rendering tests

scripts/
└── run-local.ts                 # MODIFIED: +memory read/write steps
```

**Structure Decision**: Monorepo — all changes within existing
packages and apps following established naming conventions
(Constitution XI). No new packages or directories created.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| `better-sqlite3` dependency | Channel memory store needs persistent local storage with query capability | Plain JSON file: no indexing, linear scan for similarity. SQLite adds <200KB and is standard for local persistence. |
| `@browserbasehq/stagehand` optional dep | LLM-guided browser navigation for agentic screenshot capture | Raw Playwright heuristics: fragile, requires hand-coding strategies per site type. Stagehand provides natural language navigation out of the box. |
| TF-IDF similarity in memory client | Topic matching for channel lore retrieval | Gemini embeddings: higher quality but requires API call per query, violates offline requirement. TF-IDF is zero-dependency, runs locally. |
