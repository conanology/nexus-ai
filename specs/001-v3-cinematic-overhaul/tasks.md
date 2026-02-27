# Tasks: V3 Cinematic Engine Overhaul

**Input**: Design documents from `/specs/001-v3-cinematic-overhaul/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story (mapped to pillars) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in every description

## Path Conventions

- **Monorepo**: `packages/<name>/src/`, `apps/<name>/src/`
- **Tests**: `src/__tests__/*.test.ts` (Vitest workspace mode)

---

## Phase 1: Setup

**Purpose**: Verify baseline before any changes

- [X] T001 Verify baseline type-checks pass on all affected packages: `tts`, `audio-mixer`, `director-agent`, `visual-gen`, `video-studio`, `render-service`, `script-gen`
- [X] T002 [P] Verify baseline tests pass on affected packages (`pnpm test`)

**Checkpoint**: Baseline green — implementation can begin

---

## Phase 2: User Story 1 — Correct Audio Output (Priority: P0)

**Goal**: Fix chipmunk audio bug (sample rate mismatch in stitchAudio) and add silence-drop ducking before high-impact scenes.

**Independent Test**: Run `pnpm test --filter @nexus-ai/tts` and `pnpm test --filter @nexus-ai/audio-mixer`. Render a short clip and verify narration pitch is correct and music drops to silence before stat-callout scenes.

**Pillar**: 1 — Critical System Fixes (Audio)

### Implementation for User Story 1

#### Audio Stitcher Fix (packages/tts)

- [X] T003 [US1] Add `sampleRate: number` field to `ExtractedPCM` interface in `packages/tts/src/audio-quality.ts`
- [X] T004 [US1] Update `extractPCMData()` to read and return actual sample rate from WAV header instead of discarding it in `packages/tts/src/audio-quality.ts`
- [X] T005 [US1] Fix `stitchAudio()` to use first segment's actual sample rate instead of hardcoded 44100 Hz — validate all segments share the same rate, pass real rate to `generateSilence()` and `createWAVBuffer()` in `packages/tts/src/audio-quality.ts`
- [X] T006 [US1] Add unit tests for sample rate extraction, stitching with 24000 Hz segments, and mixed-rate validation in `packages/tts/src/__tests__/audio-quality.test.ts`

#### Silence Drops (packages/audio-mixer)

- [X] T007 [P] [US1] Add `SilenceDrop` type (`timeSec: number`, `durationSec: number`, `fadeBackMs: number`) to `packages/audio-mixer/src/types.ts`
- [X] T008 [US1] Extend `generateDuckingCurve()` with optional `silenceDrops: SilenceDrop[]` parameter — insert gain 0.0 at `timeSec`, hold for `durationSec` (1s), fade back to `silenceLevel` over `fadeBackMs` (300ms) in `packages/audio-mixer/src/ducking.ts`
- [X] T009 [US1] Add `buildSilenceDrops()` function — extract drops from scene data where `type` is `stat-callout`, `text-emphasis`, `full-screen-text`, or `isColdOpen === true` (drop starts at `startFrame/fps - 1.0`) in `packages/audio-mixer/src/mix-pipeline.ts`
- [X] T010 [P] [US1] Add unit tests for silence drop ducking curve generation (0 dB region, 300ms fade-back, edge cases) in `packages/audio-mixer/src/__tests__/ducking.test.ts`
- [X] T011 [P] [US1] Add unit tests for `buildSilenceDrops()` with mixed scene types in `packages/audio-mixer/src/__tests__/mix-pipeline.test.ts`

**Checkpoint**: Audio stitching uses correct sample rate. Silence drops mute music before impact scenes. All TTS and audio-mixer tests pass.

---

## Phase 3: User Story 2 — V2 Director Scenes Render in Production (Priority: P0)

**Goal**: Fix render-service to detect and pass V2 Director scenes (not just V1 timeline) so all 16 scene types render with enriched visuals.

**Independent Test**: Deploy render service with a V2 Director test payload. Verify output contains scene-type-specific visuals (MapAnimation, CodeBlock, etc.) instead of fallback components. Verify V1 payloads still render correctly.

**Pillar**: Render Service V2 Bridge

### Implementation for User Story 2

- [X] T012 [US2] Add `impactWords` and `wordTimings` fields to V2 inputProps passthrough — detect `version === 'v2-director'` and forward full scenes payload in `apps/render-service/src/render.ts`
- [X] T013 [US2] Set `publicDir` explicitly in Remotion `bundle()` call to `apps/video-studio/public/` for V2 render path in `apps/render-service/src/render.ts`
- [X] T014 [US2] Add `materializeImages()` call before render to convert any data URI images to disk files for V2 path in `apps/render-service/src/render.ts`
- [X] T015 [US2] Add Playwright webpack aliases (`playwright`, `playwright-core` → `false`) to Remotion bundle override config in `apps/render-service/src/render.ts`
- [X] T016 [US2] Verify V1 backward compatibility — confirm legacy `COMPONENT_MAP` timeline path is untouched and existing V1 payloads render correctly in `apps/render-service/src/render.ts`

**Checkpoint**: V2 Director scenes render with all enrichments. V1 payloads continue to work unchanged.

---

## Phase 4: User Story 3 — Neon Hacker Visual Identity (Priority: P1)

**Goal**: Migrate entire visual identity from cyan/violet to Neon Hacker palette (#aaff00 neon green / #0a0a0a deep black). Create 3 new cinematic components. Zero cyan or violet remnants.

**Independent Test**: Render a 30-second clip with 5+ scene types. Grep `apps/video-studio/src/` for `#00d4ff`, `#8b5cf6` — zero matches expected. Visually confirm neon green accents.

**Pillar**: 2 — Neon Hacker Rebrand

### Implementation for User Story 3

#### Source-of-Truth Migration (auto-propagates to all consumers)

- [X] T017 [US3] Migrate all color constants to Neon Hacker palette (`bgDeepDark` → `#0a0a0a`, `accentPrimary` → `#aaff00`, etc. per data-model.md) in `apps/video-studio/src/utils/colors.ts`
- [X] T018 [P] [US3] Migrate all theme constants to Neon Hacker palette (`primary` → `#aaff00`, `background` → `#0a0a0a`, etc. per data-model.md) in `apps/video-studio/src/theme.ts`

#### Hardcoded Hex Remnant Fixes

- [X] T019 [P] [US3] Replace hardcoded `#00D4FF` cyan with `COLORS.accentPrimary` reference in color array in `apps/video-studio/src/components/scenes/LogoShowcase.tsx`
- [X] T020 [P] [US3] Replace hardcoded `#00D4FF` cyan `COLOR_STRING` constant with `COLORS.accentPrimary` in `apps/video-studio/src/components/scenes/CodeBlock.tsx`
- [X] T021 [P] [US3] Replace hardcoded `#0A0E1A` background with `COLORS.bgDeepDark` in `apps/video-studio/src/components/scenes/MapAnimation.tsx`
- [X] T022 [P] [US3] Replace hardcoded `#0a0e1a` inline backgroundColor with `COLORS.bgDeepDark` in `apps/video-studio/src/compositions/TechExplainer.tsx`

#### New Cinematic Components

- [X] T023 [P] [US3] Create GlassPanel component — translucent panel with `backdrop-filter: blur()`, neon green (#aaff00) border, configurable opacity and blur radius in `apps/video-studio/src/components/shared/GlassPanel.tsx`
- [X] T024 [P] [US3] Create FloatingTerminal component — screenshot display with CSS `perspective` + `rotateX`/`rotateY` 2.5D transforms, neon green terminal chrome in `apps/video-studio/src/components/shared/FloatingTerminal.tsx`
- [X] T025 [P] [US3] Create HudOverlay component — corner crosshair SVGs + running timecode counter (frame-synced) in neon green in `apps/video-studio/src/components/shared/HudOverlay.tsx`

#### Verification

- [X] T026 [US3] Sweep all files in `apps/video-studio/src/` for remaining cyan (`#00d4ff`, `#00D4FF`) or violet (`#8b5cf6`, `#8B5CF6`) hex remnants — fix any found

**Checkpoint**: 100% Neon Hacker palette. Zero cyan/violet. Three new cinematic components available. All video-studio type-checks pass.

---

## Phase 5: User Story 4 — Visual Sandwich Sequences (Priority: P2)

**Goal**: Director agent assigns a `visualLayer` to each scene (abstract-concept / evidence-screenshot / showcase-scroll) with max-3-consecutive constraint. Enrichers use layer to select visual source. Nano Banana prompt for abstract-concept scenes.

**Independent Test**: Run `pnpm test --filter @nexus-ai/director-agent`. Verify `assignVisualLayers()` output has no more than 3 consecutive same-layer scenes. Verify Nano Banana prompt is used for abstract-concept image generation.

**Pillar**: 3 — Visual Sandwich Mixing

### Implementation for User Story 4

#### Type Extensions

- [X] T027 [US4] Add `visualLayer: 'abstract-concept' | 'evidence-screenshot' | 'showcase-scroll'` to `ClassifiedSegment` type, and add `cssSelector: z.string().optional()` + `highlightText: z.string().optional()` to `LLMSceneEntrySchema` in `packages/director-agent/src/types.ts`
- [X] T028 [P] [US4] Add `visualLayer`, `cssSelector`, `highlightText`, `fullPageImage` optional fields to Scene interface in `apps/video-studio/src/types/scenes.ts`

#### Visual Layer Assignment

- [X] T029 [US4] Implement `assignVisualLayers(scenes)` function — round-robin with content-aware overrides (company URLs → evidence, code/diagrams → showcase, stats/opinion → abstract) and max-3-consecutive enforcement in `packages/director-agent/src/scene-classifier.ts`
- [X] T030 [US4] Add `cssSelector`/`highlightText` generation instructions and Nano Banana prompt ("Cyberpunk, minimalist, strictly deep black background with bright neon green glowing accents, no text") to director system prompt in `packages/director-agent/src/prompts/director-system.ts`

#### Enricher Updates

- [X] T031 [US4] Update AI image enricher to detect `visualLayer === 'abstract-concept'` and use Nano Banana prompt with negative prompt "no text, no words, no letters" in `packages/visual-gen/src/image-enricher.ts`
- [X] T032 [US4] Implement visual layer cascade fallback (evidence → showcase → abstract) — when assigned layer cannot be fulfilled, try next in priority; Nano Banana AI image is terminal fallback in `packages/visual-gen/src/asset-fetcher.ts`

#### Tests

- [X] T033 [P] [US4] Add unit tests for `assignVisualLayers()` — round-robin distribution, max-3-consecutive constraint, content-aware overrides, edge cases in `packages/director-agent/src/__tests__/scene-classifier.test.ts`

**Checkpoint**: Every scene gets a visualLayer. No more than 3 consecutive same-layer scenes. Nano Banana prompt produces neon-aesthetic AI backgrounds. Cascade fallback ensures no empty visuals.

---

## Phase 6: User Story 5 — Contextual Playwright Capture (Priority: P2)

**Goal**: Playwright screenshots support CSS selector cropping and text highlighting. New ScrollingCapture scene type (17th) renders full-page vertical pans. All Playwright failures silently fall back.

**Independent Test**: Run `pnpm test --filter @nexus-ai/visual-gen` and `pnpm test --filter @nexus-ai/asset-library`. Verify cssSelector cropping produces targeted captures. Verify ScrollingCapture renders a translateY animation.

**Pillar**: 4 — Contextual Playwright Capture

### Implementation for User Story 5

#### Screenshot Service Extensions

- [X] T034 [US5] Add `cssSelector?: string` and `highlightText?: string` to `ScreenshotOptions` interface in `packages/asset-library/src/screenshots/screenshot-service.ts`
- [X] T035 [US5] Implement CSS selector cropping — use `page.locator(cssSelector).screenshot()` when provided, silently fall back to viewport screenshot on failure in `packages/asset-library/src/screenshots/screenshot-service.ts`
- [X] T036 [US5] Implement text highlighting — use `page.evaluate()` to inject a script wrapping matched text in a `<mark>` element with neon green (#aaff00) border before capture, no-op if text not found in `packages/asset-library/src/screenshots/screenshot-service.ts`

#### Enricher Passthrough

- [X] T037 [P] [US5] Update source-screenshot-enricher to pass `cssSelector` and `highlightText` from scene data to screenshot service in `packages/visual-gen/src/source-screenshot-enricher.ts`
- [X] T038 [P] [US5] Update content-screenshot-enricher to pass `cssSelector` and `highlightText` from scene data to screenshot service in `packages/visual-gen/src/content-screenshot-enricher.ts`

#### ScrollingCapture Scene Type

- [X] T039 [US5] Add `'scrolling-capture'` to `SCENE_TYPES` array and define `ScrollingCaptureVisualData` type (`fullPageImageUrl`, `scrollSpeedPxPerSec`, `label?`) in `apps/video-studio/src/types/scenes.ts`
- [X] T040 [US5] Create ScrollingCapture scene component — render full-page image with animated vertical `translateY` pan at 500px/sec (~17px/frame at 30fps), dark overlay + label badge in `apps/video-studio/src/components/scenes/ScrollingCapture.tsx`
- [X] T041 [US5] Register `scrolling-capture` route in SceneRouter in `apps/video-studio/src/SceneRouter.tsx`

#### Scene Type Registration (Constitution: Adding New Scene Types)

- [X] T042 [US5] Add scrolling-capture classification rules (dedicated full-page showcase scenes where segment is about showing/demonstrating a page) and default visualData fallback in `packages/director-agent/src/scene-classifier.ts`
- [X] T043 [US5] Add `scrolling-capture` as valid scene type with classification guidance in director system prompt in `packages/director-agent/src/prompts/director-system.ts`
- [X] T044 [P] [US5] Add `scrolling-capture` entry to `SCENE_SFX_MAP` in `packages/asset-library/src/audio-assets.ts`

#### Tests

- [X] T045 [P] [US5] Add unit tests for cssSelector cropping and highlightText injection with silent fallback scenarios in `packages/asset-library/src/__tests__/screenshot-service.test.ts`
- [X] T046 [P] [US5] Add unit tests for ScrollingCapture component (scroll speed, translateY calculation, label rendering) in `apps/video-studio/src/components/scenes/__tests__/ScrollingCapture.test.tsx`

**Checkpoint**: Targeted Playwright captures with CSS cropping and text highlighting. ScrollingCapture scene type fully registered per constitution "Adding New Scene Types" workflow. All Playwright failures degrade silently.

---

## Phase 7: User Story 6 — Retention-Driven Script Structure (Priority: P3)

**Goal**: Script generation produces YouTube retention-optimized structure: pattern-interrupt hook (0-15s), contextual setup (15-45s), and open-loop questions throughout.

**Independent Test**: Run `pnpm test --filter @nexus-ai/script-gen`. Verify prompt strings contain hook/context/open-loop instructions.

**Pillar**: 5 — Retention-Driven Script Generation

### Implementation for User Story 6

- [X] T047 [US6] Update `buildWriterPrompt()` with explicit 3-act structure — Hook (0-15s: pattern interrupt via question/statistic/bold claim), Context (15-45s: what/why now/who), Body with Open Loops (minimum 2 unresolved questions before midpoint, each resolved later) in `packages/script-gen/src/prompts.ts`
- [X] T048 [US6] Update `buildCriticPrompt()` with hook evaluation rubric (Is first segment a question/stat/claim? Does it create curiosity gap?) and open-loop verification checklist in `packages/script-gen/src/prompts.ts`
- [X] T049 [US6] Update `buildOptimizerPrompt()` to ensure first segment is tagged `type: hook` in DirectionDocument output in `packages/script-gen/src/prompts.ts`
- [X] T050 [US6] Add unit tests verifying hook/context/open-loop prompt structure exists in all three prompt builders in `packages/script-gen/src/__tests__/prompts.test.ts`

**Checkpoint**: All three prompt builders include retention psychology instructions. Hook segment tagged for impactful scene classification.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Integration verification, type safety, E2E validation

- [X] T051 Rebuild director-agent dist after type changes (`cd packages/director-agent && npx tsc`)
- [X] T052 Type-check all affected packages: tts, audio-mixer, director-agent, visual-gen, video-studio, render-service, script-gen
- [X] T053 [P] Run full test suite on all affected packages
- [X] T054 Run full local pipeline E2E test (`pnpm run pipeline:local "test topic"`) per quickstart.md
- [X] T055 [P] Verify zero cyan/violet hex codes in rendered output frames

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 Audio (Phase 2)**: Depends on Setup — independent of all other stories
- **US2 Render Service (Phase 3)**: Depends on Setup — independent of all other stories
- **US3 Neon Hacker (Phase 4)**: Depends on Setup — independent of US1/US2
- **US4 Visual Sandwich (Phase 5)**: Depends on Setup — benefits from US3 palette (Nano Banana uses neon green)
- **US5 Playwright Capture (Phase 6)**: Depends on US4 (visualLayer + cssSelector/highlightText from director)
- **US6 Script Gen (Phase 7)**: Depends on Setup — fully independent of all other stories
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

```text
Setup ──┬── US1 (Audio)           ──┐
        ├── US2 (Render Service)  ──┤
        ├── US3 (Neon Hacker)     ──┤
        │   └── US4 (Visual Sandwich) ──┤
        │       └── US5 (Playwright)    ──┤── Polish
        └── US6 (Script Gen)      ──┘
```

- **US1 (P0)**: Can start after Setup — no cross-story dependencies
- **US2 (P0)**: Can start after Setup — no cross-story dependencies
- **US3 (P1)**: Can start after Setup — no cross-story dependencies
- **US4 (P2)**: Can start after Setup — benefits from US3 (palette constants for Nano Banana prompt)
- **US5 (P2)**: Should start after US4 — needs `visualLayer`, `cssSelector`, `highlightText` types from director-agent
- **US6 (P3)**: Can start after Setup — fully independent

### Within Each User Story

- Types/interfaces before implementation functions
- Implementation before tests
- Core logic before integration wiring
- Verification sweep after all implementation tasks

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel
- **Phase 2**: T007 (SilenceDrop type) can run parallel with T003-T005 (audio stitcher fix, different package). T008-T011 tests can run in parallel after their implementations.
- **Phase 3**: T012-T015 are sequential (same file) but the phase is independent of Phase 2
- **Phase 4**: T017-T025 can all run in parallel (different files). T026 sweep runs after all.
- **Phase 5**: T028 (Scene types) parallel with T027 (director types). T033 tests after T029.
- **Phase 6**: T037+T038 (enricher passthrough) parallel with each other. T043 (director prompt) can follow T042 (classifier). T044 (SFX map) parallel with T042-T043. T045+T046 tests parallel.
- **Phase 7**: T047-T049 are sequential (same file). T050 tests after.
- **US1, US2, US3, US6 can all be worked on simultaneously** by different developers

---

## Parallel Example: User Story 1

```bash
# Audio stitcher fix (sequential — same file):
T003: Add sampleRate to ExtractedPCM in packages/tts/src/audio-quality.ts
T004: Update extractPCMData() in packages/tts/src/audio-quality.ts
T005: Fix stitchAudio() in packages/tts/src/audio-quality.ts

# In parallel with audio stitcher (different package):
T007: Add SilenceDrop type in packages/audio-mixer/src/types.ts

# After T005 + T007 complete — tests can run in parallel:
T006: Tests for audio-quality.ts
T010: Tests for ducking.ts
T011: Tests for mix-pipeline.ts
```

## Parallel Example: User Story 3

```bash
# All these tasks touch different files — full parallelism:
T017: colors.ts migration
T018: theme.ts migration
T019: LogoShowcase.tsx fix
T020: CodeBlock.tsx fix
T021: MapAnimation.tsx fix
T022: TechExplainer.tsx fix
T023: GlassPanel.tsx (new)
T024: FloatingTerminal.tsx (new)
T025: HudOverlay.tsx (new)

# After all complete:
T026: Sweep for remnants
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: US1 — Audio fixes (P0)
3. Complete Phase 3: US2 — Render service V2 bridge (P0)
4. **STOP and VALIDATE**: Test both independently — audio plays correctly, V2 scenes render
5. Deploy/demo if ready — these two fixes unlock all previously-built features

### Incremental Delivery

1. Setup → Foundation ready
2. US1 + US2 → Critical bugs fixed (**MVP!**)
3. US3 → Neon Hacker rebrand applied → Visual identity consistent
4. US4 → Visual sandwich mixing → No more visual monotony
5. US5 → Playwright capture upgrades → Targeted evidence screenshots
6. US6 → Retention-driven scripts → Better YouTube retention
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup together
2. Once Setup is done:
   - Developer A: US1 (Audio) + US2 (Render) — both P0, same developer for fastest critical fix
   - Developer B: US3 (Neon Hacker) — independent visual work
   - Developer C: US6 (Script Gen) — fully independent
3. After US3 + US4 prerequisites complete:
   - Developer B: US4 (Visual Sandwich) → US5 (Playwright)
4. Polish phase: all developers verify integration

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Critical gotcha**: After changing director-agent types, rebuild dist (`npx tsc`) so visual-gen sees updated types
- **Critical gotcha**: Scene schemas MUST use `.passthrough()` — when adding new fields to Scene interface (T028), ensure Zod schema retains `.passthrough()` per Constitution Principle VI
- **Critical gotcha**: Materialize full-page images to disk (no data URIs per Constitution Principle VI)
- **Critical gotcha**: New scene type `scrolling-capture` requires ALL constitution "Adding New Scene Types" steps: type → component → router → classifier → SFX map → rebuild director-agent → tests
