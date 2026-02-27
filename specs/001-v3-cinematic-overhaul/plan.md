# Implementation Plan: V3 Cinematic Engine Overhaul

**Branch**: `001-v3-cinematic-overhaul` | **Date**: 2026-02-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-v3-cinematic-overhaul/spec.md`

## Summary

Upgrade the Nexus-AI video pipeline across 5 pillars: (1) fix the audio
chipmunk bug caused by sample rate mismatch in `stitchAudio()` and add
silence-drop ducking, (2) migrate the visual identity to the Neon Hacker
palette (#aaff00 / #0a0a0a) with 3 new cinematic components, (3) add
visual-layer sandwich mixing to the director agent, (4) extend Playwright
captures with CSS selector cropping, text highlighting, and full-page
scrolling scenes, (5) add retention-driven hook/context/open-loop psychology
to script generation prompts.

## Technical Context

**Language/Version**: TypeScript (strict), ESM, Node >= 20
**Primary Dependencies**: Remotion, Zod ^3.23.8, @google/generative-ai ^0.16.0, Playwright, FFmpeg
**Storage**: Local (`LocalStorageClient`) or GCS (`CloudStorageClient`)
**Testing**: Vitest workspace mode, tests in `src/__tests__/*.test.ts`
**Target Platform**: Node.js server (local + GCP Cloud Run)
**Project Type**: Monorepo (4 apps, 17 packages) — automated video pipeline
**Performance Goals**: Pipeline completes within 150% of current duration
**Constraints**: 1920x1080 30fps h264+aac output, V1 timeline backward compat
**Scale/Scope**: 60–100 scenes per video, ~5 minute output

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Package-First Architecture | PASS | No new packages created. All changes in existing packages/apps. |
| II. Strict TypeScript & ESM | PASS | All new code is TypeScript strict + ESM. |
| III. Test Discipline | PASS | Each pillar includes unit tests for new/changed functions. |
| IV. Pipeline Order Integrity | PASS | No enricher reordering. ScrollingCapture enricher placed after screenshots in pipeline. |
| V. Dual-Mode Operation | PASS | Audio fix and palette change are mode-agnostic. Render-service changes work in both modes. |
| VI. Schema Safety | PASS | New `visualLayer` + `cssSelector` + `highlightText` fields added with `.passthrough()`. Full-page images materialized to disk (no data URIs). |
| VII. Simplicity & YAGNI | PASS | `visualLayer` is deterministic post-classification (no LLM overhead). Color migration is big-bang at source. No feature flags. |
| VIII. Strict Visual Identity | PASS | All new components use #aaff00/#0a0a0a. Migration sweep removes all cyan/violet. |
| IX. Backward Compatibility | PASS | V1 timeline path untouched. `TechExplainerSchema` union order preserved. |
| X. Component Modularity | PASS | New components (GlassPanel, FloatingTerminal, HudOverlay, ScrollingCapture) are self-contained with typed props. All Playwright failures have silent fallbacks. |
| XI. No Hallucinations | PASS | All files placed in existing directories per ARCHITECTURE.md. No new packages. |

## Project Structure

### Documentation (this feature)

```text
specs/001-v3-cinematic-overhaul/
├── plan.md              # This file
├── research.md          # Phase 0 output — root causes and decisions
├── data-model.md        # Phase 1 output — entity changes
├── quickstart.md        # Phase 1 output — validation guide
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (files modified/created per pillar)

```text
# Pillar 1 — Audio Fixes
packages/tts/src/audio-quality.ts              # FIX: sample rate in stitchAudio()
packages/tts/src/__tests__/audio-quality.test.ts
packages/audio-mixer/src/types.ts              # ADD: SilenceDrop type
packages/audio-mixer/src/ducking.ts            # ADD: silence drops in curve
packages/audio-mixer/src/mix-pipeline.ts       # ADD: build drops from scene data
packages/audio-mixer/src/__tests__/ducking.test.ts
packages/audio-mixer/src/__tests__/mix-pipeline.test.ts

# Pillar 2 — Neon Hacker Rebrand
apps/video-studio/src/utils/colors.ts          # MIGRATE: all color constants
apps/video-studio/src/theme.ts                 # MIGRATE: all theme constants
apps/video-studio/src/components/scenes/LogoShowcase.tsx   # FIX: hardcoded #00D4FF
apps/video-studio/src/components/scenes/CodeBlock.tsx      # FIX: hardcoded #00D4FF
apps/video-studio/src/components/scenes/MapAnimation.tsx   # FIX: hardcoded #0A0E1A
apps/video-studio/src/compositions/TechExplainer.tsx       # FIX: hardcoded #0a0e1a
apps/video-studio/src/components/shared/GlassPanel.tsx     # NEW: glass blur panel
apps/video-studio/src/components/shared/FloatingTerminal.tsx # NEW: 2.5D screenshot
apps/video-studio/src/components/shared/HudOverlay.tsx     # NEW: crosshairs + timecode

# Pillar 3 — Visual Sandwich
packages/director-agent/src/types.ts           # ADD: visualLayer to types
packages/director-agent/src/scene-classifier.ts # ADD: assignVisualLayers()
packages/director-agent/src/prompts/director-system.ts # ADD: cssSelector/highlightText
apps/video-studio/src/types/scenes.ts          # ADD: visualLayer, cssSelector, etc.
packages/director-agent/src/__tests__/scene-classifier.test.ts
packages/visual-gen/src/image-enricher.ts      # MOD: use Nano Banana prompt for abstract-concept

# Pillar 4 — Playwright Capture
packages/asset-library/src/screenshots/screenshot-service.ts # ADD: cssSelector, highlightText
packages/visual-gen/src/source-screenshot-enricher.ts  # MOD: pass cssSelector/highlightText
packages/visual-gen/src/content-screenshot-enricher.ts # MOD: pass cssSelector/highlightText
apps/video-studio/src/components/scenes/ScrollingCapture.tsx # NEW: scrolling scene
apps/video-studio/src/SceneRouter.tsx           # ADD: scrolling-capture route
packages/asset-library/src/__tests__/screenshot-service.test.ts
apps/video-studio/src/components/scenes/__tests__/ScrollingCapture.test.tsx

# Pillar 5 — Script Generation
packages/script-gen/src/prompts.ts             # MOD: hook/context/open-loop prompts
packages/script-gen/src/__tests__/prompts.test.ts

# Render Service (V2 bridge)
apps/render-service/src/render.ts              # FIX: V2 field passthrough + publicDir
```

**Structure Decision**: All modifications use existing monorepo structure. No
new packages or directories. New scene components go in
`apps/video-studio/src/components/scenes/` (ScrollingCapture) and
`apps/video-studio/src/components/shared/` (GlassPanel, FloatingTerminal,
HudOverlay). New types extend existing interfaces. Constitution Principle XI
fully satisfied.

## Complexity Tracking

> No Constitution violations. No complexity justifications needed.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| (none)    | —          | —                                    |
