# NEXUS-AI Project — Claude Code Context

## Quick Reference

| What             | Command / Path                                     |
| ---------------- | -------------------------------------------------- |
| Install deps     | `pnpm install`                                     |
| Build all        | `pnpm build` (turbo)                               |
| Run tests        | `pnpm test`                                        |
| Type-check       | `npx tsc --noEmit` (per-package, no root tsconfig) |
| Local pipeline   | `pnpm run pipeline:local "topic"`                  |
| Local pipeline (script) | `pnpm run pipeline:local -- --script path/to/script.txt` |
| Verify all       | `npx tsx scripts/dev/verify.ts`                    |
| Check imports    | `npx tsx scripts/dev/check-imports.ts`             |
| Bundle report    | `npx tsx scripts/dev/bundle-report.ts`             |
| Render test clip | `npx tsx scripts/dev/render-clip.ts`               |

## Project Overview

Nexus-AI is an automated AI video production pipeline. It discovers trending tech topics, researches them, generates narration scripts, produces TTS audio, classifies scenes via an AI director, enriches them with visuals (AI images, screenshots, stock photos, memes, maps, annotations), and renders the final video with Remotion.

## Monorepo Structure

- **Runtime**: Node >= 20, pnpm 10.27.0, Turbo 2.7.3
- **Language**: TypeScript (strict), ESM (`"type": "module"`, `.js` extensions in imports)
- **Test framework**: Vitest (workspace mode via `vitest.workspace.ts`)
- **Package naming**: `@nexus-ai/<name>`, version 0.1.0
- **Workspace deps**: `"workspace:*"` protocol

### Apps (4)

| App              | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `operator-cli`   | CLI for pipeline operations                |
| `orchestrator`   | Cloud pipeline orchestrator (GCP)          |
| `render-service` | Cloud rendering service (Remotion + Docker)|
| `video-studio`   | Remotion composition — all scene components|

### Packages (17)

| Package              | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `asset-library`      | SFX, music tracks, audio asset definitions         |
| `audio-mixer`        | FFmpeg-based audio mixing (narration + music + SFX)|
| `broll-engine`       | B-roll overlay engine                              |
| `config`             | Shared tsconfig and eslint configs                 |
| `core`               | Storage, secrets, errors, Firestore, cost tracking |
| `director-agent`     | Gemini-powered scene classifier/director           |
| `news-sourcing`      | HN, HuggingFace, arXiv topic discovery             |
| `notifications`      | Discord webhook notifications                      |
| `pronunciation`      | Custom pronunciation dictionary (Firestore)        |
| `research`           | Gemini-powered topic research                      |
| `script-gen`         | Narration script generation                        |
| `thumbnail`          | YouTube thumbnail generation                       |
| `timestamp-extraction` | Word-level timestamp extraction (STT)            |
| `tts`                | Text-to-speech (AI Studio TTS, edge-tts fallback)  |
| `twitter`            | Twitter/X posting                                  |
| `visual-gen`         | Visual enrichment pipeline (images, screenshots, stock, overlays, annotations, memes, geo) |
| `youtube`            | YouTube upload + metadata                          |

### Scripts (in `scripts/`)

| Script                  | Purpose                              |
| ----------------------- | ------------------------------------ |
| `run-local.ts`          | Full local pipeline (11 steps)       |
| `full-render-test.ts`   | E2E render test                      |
| `render-test-v2.ts`     | Render test v2                       |
| `resume-render.ts`      | Resume interrupted renders           |
| `validate-pipeline.ts`  | Pipeline validation                  |
| `validate-scenes.mjs`   | Scene schema validation              |
| `production-test.ts`    | Production integration test          |

## Key Architecture Decisions

### TypeScript Config
- Root `tsconfig.base.json` — shared strict settings (`noUnusedLocals`, `noUnusedParameters`)
- Per-package configs extend `../../packages/config/tsconfig.json` → `../../tsconfig.base.json`
- No root `tsconfig.json` — run `npx tsc --noEmit` per-package, not at root

### Storage (Dual Mode)
- **Cloud**: `CloudStorageClient` (GCS) — used when `NEXUS_BUCKET_NAME` is set
- **Local**: `LocalStorageClient` — used when `STORAGE_MODE=local` or `NEXUS_BUCKET_NAME` unset
- Factory: `getStorageClient()` in `packages/core/src/storage/storage-factory.ts`
- `CloudStorageClient` auto-delegates to `LocalStorageClient` in local mode
- `FirestoreClient` becomes no-op in local mode

### AI Services
- **Gemini models**: `gemini-3-pro-preview` (primary), `gemini-2.0-flash` (health), `gemini-2.5-flash` (director)
- **API key**: `getSecret('nexus-gemini-api-key')` from `@nexus-ai/core` — checks env `NEXUS_GEMINI_API_KEY` first, then GCP Secret Manager
- **Image gen**: Gemini image generation via `@google/generative-ai` (^0.16.0)
- **TTS cascade**: AI Studio TTS → edge-tts → silent fallback

### Video Pipeline Order
```
logos → audio → geo → images → source screenshots → company screenshots → stock → overlays → annotations → memes
```

### Scene Types (16)
```
intro, chapter-break, narration-default, text-emphasis, full-screen-text, stat-callout,
comparison, diagram, logo-showcase, timeline, quote, list-reveal, code-block,
meme-reaction, map-animation, outro
```

### Remotion (video-studio)
- Composition: `TechExplainer` in `apps/video-studio/src/compositions/TechExplainer.tsx`
- Scene routing: `apps/video-studio/src/SceneRouter.tsx`
- Resolution: 1920x1080, 30fps
- `bundle()` must set `publicDir` explicitly (entry not at project root)
- Zod scene schema uses `.passthrough()` to preserve enrichment fields

### Key File Locations

| Category | Path |
|----------|------|
| Scene components | `apps/video-studio/src/components/scenes/*.tsx` |
| Overlays | `apps/video-studio/src/components/overlays/*.tsx` |
| Shared components | `apps/video-studio/src/components/shared/*.tsx` |
| Annotations | `apps/video-studio/src/components/annotations/*.tsx` |
| Maps | `apps/video-studio/src/components/maps/` |
| Scene types (TS) | `apps/video-studio/src/types/scenes.ts` |
| Scene router | `apps/video-studio/src/SceneRouter.tsx` |
| Composition | `apps/video-studio/src/compositions/TechExplainer.tsx` |
| Theme / colors | `apps/video-studio/src/theme.ts`, `apps/video-studio/src/utils/colors.ts` |
| Enrichers | `packages/visual-gen/src/*-enricher.ts` |
| Asset fetcher | `packages/visual-gen/src/asset-fetcher.ts` |
| Director classifier | `packages/director-agent/src/scene-classifier.ts` |
| Local pipeline | `scripts/run-local.ts` |
| Storage factory | `packages/core/src/storage/storage-factory.ts` |

## Environment Variables

Required for local mode (see `.env.local.example`):
```
NEXUS_GEMINI_API_KEY=     # Required — Gemini LLM + image gen + TTS
STORAGE_MODE=local        # Activates local storage
GIPHY_API_KEY=            # Optional — meme GIFs
PEXELS_API_KEY=           # Optional — stock photos/videos
```

## Known Test Issues

**Current status: 3033 passing, 37 failing across 174 test files.**

Pre-existing failures by area:
- `packages/visual-gen` — `audio-mixing-integration.test.ts` (18 failures) — mock setup drift
- `packages/core` — `firestore-client.test.ts` (5 failures) — local mode constructor changes
- `packages/core` — `alerts.test.ts` (3 failures) — Firestore dependency
- `packages/core` — `gemini-tts-provider.test.ts` (1 failure) — mock setup
- `packages/pronunciation` — 5 test files failing — Firestore constructor changes
- `packages/tts` — 4 test files failing — related to pronunciation/Firestore changes
- `packages/youtube` — `metadata.test.ts`, `uploader.test.ts` — FirestoreClient constructor
- `apps/orchestrator` — 7 test files failing — FirestoreClient + pipeline mock drift

Root cause: FirestoreClient constructor was modified for local-mode detection, breaking tests that mock it differently. These are test-only issues — production code works.

## Critical Gotchas

1. **Zod `.passthrough()`** — Scene schemas MUST use `.passthrough()` or enrichment fields get silently stripped
2. **Director-agent rebuild** — After changing Scene types, rebuild director-agent: `cd packages/director-agent && npx tsc`
3. **`noUnusedLocals: true`** — Clean up unused imports before type-checking
4. **pnpm strict resolution** — Root scripts can't import workspace package deps directly; use `createRequire()`
5. **Remotion `publicDir`** — Must be set in `bundle()` when entry point is not at project root
6. **Data URI images** — Don't pass base64 images in Remotion `inputProps` (24MB+ JSON); materialize to disk and serve via HTTP
7. **Frame math** — `Math.floor()` on small scene counts can produce 0; always wrap with `Math.max(1, ...)`

## Custom Commands

| Command | Purpose |
|---------|---------|
| `/verify` | Full verification: tsc (4 packages) + tests + git status |
| `/test-package <name>` | Run vitest for a specific package |
| `/render-test` | Execute E2E render test |
| `/scene-check` | Type-check all scene-related packages |
| `/pipeline-status` | Show branch, commits, test summary |

## Pre-Flight Checklists

**After code changes**: Type-check affected packages → run their tests → if scene types changed, rebuild director-agent.

**Before commits**: `git diff` to review → `pnpm test` confirms baseline (22/152, 37/3033) → conventional commit message.

**Before renders**: Verify `.env.local` has `NEXUS_GEMINI_API_KEY` → check `publicDir` set → no data URIs in inputProps.

See [docs/CLAUDE-OPS.md](docs/CLAUDE-OPS.md) for the detailed operations manual.

## Documentation

| Document | Path |
|----------|------|
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Pipeline Reference | [docs/PIPELINE.md](docs/PIPELINE.md) |
| Scene Types | [docs/SCENE-TYPES.md](docs/SCENE-TYPES.md) |
| Visual Layers | [docs/VISUAL-LAYERS.md](docs/VISUAL-LAYERS.md) |
| API Keys | [docs/API-KEYS.md](docs/API-KEYS.md) |
| Contributing | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| Operations Manual | [docs/CLAUDE-OPS.md](docs/CLAUDE-OPS.md) |
| Local Mode | [docs/LOCAL_MODE.md](docs/LOCAL_MODE.md) |
| Video System Spec | [docs/VIDEO_SYSTEM_SPEC.md](docs/VIDEO_SYSTEM_SPEC.md) |
| User Guide | [docs/NEXUS-AI-USER-GUIDE.md](docs/NEXUS-AI-USER-GUIDE.md) |
