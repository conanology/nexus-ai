# TODO

Prioritized task list for Nexus-AI development.

## P0 — Critical

- [ ] **Fix 37 failing tests** — Root cause: `FirestoreClient` constructor changed for local-mode detection, breaking mocks in 22 test files across core, pronunciation, tts, youtube, orchestrator. Fix: update test mocks to match new constructor signature.
- [ ] **Eliminate AI-generated text in images** — Gemini image gen sometimes renders literal text despite negative prompts. Investigate: stronger negative prompts, post-generation validation, or switch to inpainting workflow.

## P1 — High

- [ ] **Music variety** — Currently only one ambient track (`ambient-tech-01`). Add 3-5 additional tracks and randomize per video.
- [ ] **Fix audio-mixing integration tests** — 18 failures in `packages/visual-gen/audio-mixing-integration.test.ts` due to mock setup drift.
- [ ] **Fix pronunciation/Firestore test mocks** — 5 test files in `packages/pronunciation` failing from `FirestoreClient` constructor changes.
- [ ] **Production pipeline test** — Run full cloud pipeline end-to-end after GCP billing restoration.

## P2 — Medium

- [ ] **GitHub Actions CI** — Add workflow for: lint, type-check, test on push/PR. Cache pnpm store.
- [ ] **Code coverage reporting** — Enable vitest coverage and set baseline thresholds.
- [ ] **E2E render test in CI** — Headless Remotion render of a short test composition.
- [ ] **Improve stock photo relevance** — Expand concept-to-query mappings in `stock-query-builder.ts`.
- [ ] **Word-level captions** — Re-enable `AnimatedCaptions` with proper word timing data (currently disabled — YouTube auto-generates).

## P3 — Low

- [ ] **Additional scene types** — Candidates: `poll-results`, `before-after`, `process-flow`.
- [ ] **Thumbnail generation** — `packages/thumbnail` exists but not wired into local pipeline.
- [ ] **Twitter/X posting** — `packages/twitter` exists but not wired into pipeline.
- [ ] **YouTube auto-upload** — Wire `packages/youtube` into pipeline with metadata generation.
- [ ] **Discord notifications** — Wire `packages/notifications` into local pipeline completion.
- [ ] **Remotion Studio preview** — Ensure `pnpm dev` in video-studio works for visual iteration.

## Done

- [x] Local storage mode (Phase L1)
- [x] 16 scene types (Phases 8-19)
- [x] Handwritten annotations (Phase 20)
- [x] Map animations (Phase 22)
- [x] Visual quality polish (Phases VQ, VQ2, VQ3)
- [x] Scene transitions and color grading
- [x] Source screenshots and stock photos
- [x] Giphy meme integration (replaced Tenor)
- [x] Codebase cleanup and documentation (Phases 0-5)
- [x] Structural refactor and version normalization (Phase 4)
