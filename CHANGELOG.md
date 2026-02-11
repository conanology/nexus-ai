# Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Local storage mode** — `LocalStorageClient` with same API as `CloudStorageClient`, activated when `STORAGE_MODE=local` or `NEXUS_BUCKET_NAME` unset (`packages/core/src/storage/`)
- **Storage factory** — `getStorageClient()` auto-selects local vs cloud backend
- **AI Studio TTS provider** — Gemini 2.5 Flash Preview TTS with 24kHz PCM output (`packages/core/src/providers/tts/aistudio-tts-provider.ts`)
- **edge-tts fallback** — Microsoft Neural TTS as secondary TTS provider (`packages/core/src/providers/tts/edge-tts-provider.ts`)
- **Asset library package** — SFX, music tracks, logo fetching, image generation, screenshot capture, meme/stock search (`packages/asset-library/`)
- **Director agent package** — LLM-powered scene classifier using Gemini 2.5 Flash, supports 16 scene types (`packages/director-agent/`)
- **16 scene components** — intro, chapter-break, narration-default, text-emphasis, full-screen-text, stat-callout, comparison, diagram, logo-showcase, timeline, quote, list-reveal, code-block, meme-reaction, map-animation, outro (`apps/video-studio/src/components/scenes/`)
- **TechExplainer V2** — New composition path with Director Agent scene classification, SceneRouter, and Zod schema validation (`apps/video-studio/src/compositions/TechExplainer.tsx`)
- **Visual enrichment pipeline** — 10-stage enrichment: logos, audio, geo, images, source screenshots, company screenshots, stock, overlays, annotations, memes (`packages/visual-gen/src/`)
- **Scene overlays** — ParticleField, GridOverlay, CinematicOverlay, SceneBackgroundImage, AnnotationLayer, OverlayRenderer, ColorGrade, SceneEnvelope (`apps/video-studio/src/components/`)
- **Map animations** — SVG world map with 50 countries, 3 animation styles, geo enricher (`apps/video-studio/src/components/maps/`)
- **V2-Director support in render service** — Cloud render pipeline handles Director Agent scene format (`apps/render-service/`)
- **Local pipeline runner** — 11-step pipeline from topic discovery to rendered MP4 (`scripts/run-local.ts`)
- **Pipeline validation and test scripts** — E2E render test, scene validation, production test (`scripts/`)
- **Project documentation** — CLAUDE.md, ARCHITECTURE.md, PIPELINE.md, SCENE-TYPES.md, VISUAL-LAYERS.md, API-KEYS.md, CONTRIBUTING.md, LOCAL_MODE.md, README.md
- **Scene transitions** — 5 types: cut, crossfade, dissolve, wipe-left, slide-up (`SceneEnvelope`)
- **Color grading** — Film grain, vignette, teal-orange color shift (`ColorGrade.tsx`)
- **Source screenshots** — Playwright-based screenshots of article source URLs
- **Stock photo integration** — Pexels API with 30+ concept-to-query mappings
- **Giphy meme integration** — Replaced discontinued Tenor API

### Changed
- **Standardized tsconfig extends** — All packages and apps now extend `../../packages/config/tsconfig.json`
- **Normalized package versions** — All packages set to `0.1.0`
- **Asset library package.json** — Fixed entry points (`main`, `types`, `exports`), added build scripts

### Fixed
- **Zod `.passthrough()`** — Scene schema was silently stripping enrichment fields (backgroundImage, sfx, overlays, etc.)
- **Remotion `publicDir`** — Set explicitly in `bundle()` for SFX/music asset resolution
- **Director-agent API key** — Fixed to check `NEXUS_GEMINI_API_KEY` first
- **Audio WAV header** — Channel count corrected
- **FirestoreClient local mode** — Constructor detects local mode, all CRUD ops become no-ops

### Removed
- **BMAD framework** — 587 files of unused agent/workflow scaffolding
- **Orphaned files** — `nul`, `repro_bug.ts`, `check-pipeline.mjs`, stale test backups
- **Unused dependencies** — `wav` (tts), `zod` (news-sourcing), `@remotion/cli` (render-service)
