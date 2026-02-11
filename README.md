# Nexus-AI

Automated AI video production pipeline that discovers trending tech topics, researches them, writes narration scripts, and renders broadcast-quality videos — comparable to channels like Fireship, ColdFusion, and Two Minute Papers.

## Features

- **Autonomous topic discovery** from Hacker News, HuggingFace, and arXiv
- **Multi-agent script generation** with writer, critic, and optimizer stages
- **AI-powered scene classification** via Gemini (16 scene types)
- **Visual enrichment pipeline** — AI images, screenshots, stock photos, maps, memes, annotations
- **Professional rendering** with Remotion (1920x1080, 30fps, h264+aac)
- **12-layer visual stack** with film grain, particles, transitions, and color grading
- **Dual storage** — runs locally or on GCP Cloud Run

## Quick Start

```bash
# 1. Install
pnpm install

# 2. Configure (only NEXUS_GEMINI_API_KEY is required)
cp .env.local.example .env.local

# 3. Run
pnpm run pipeline:local "AI is disrupting the SaaS industry"
```

Output: `./output/{topic-slug}/video.mp4`

## Architecture

```
  Topic Discovery ─► Research ─► Script Gen ─► TTS Audio
                                                   │
                    Chapters ◄── Render ◄── Enrichment ◄── Director
```

**Monorepo**: 4 apps + 17 packages, managed with pnpm workspaces and Turborepo.

| Layer | Packages |
|-------|----------|
| **Apps** | `orchestrator` (cloud), `render-service`, `video-studio` (Remotion), `operator-cli` |
| **Pipeline** | `news-sourcing`, `research`, `script-gen`, `tts`, `timestamp-extraction` |
| **Video** | `director-agent`, `visual-gen`, `asset-library`, `audio-mixer`, `broll-engine` |
| **Platform** | `core` (storage, secrets), `pronunciation`, `thumbnail`, `youtube`, `twitter`, `notifications` |

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript (strict ESM), pnpm 10.27
- **AI**: Google Gemini (LLM, image gen, TTS, scene classification)
- **Video**: Remotion 4.x (React-based video rendering)
- **Build**: Turborepo, Vitest
- **Cloud**: GCP Cloud Run, Cloud Storage, Firestore (optional)

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System overview, dependency graph, package reference |
| [Pipeline](docs/PIPELINE.md) | 11-step pipeline flow with inputs/outputs |
| [Scene Types](docs/SCENE-TYPES.md) | All 16 scene types with visual data shapes |
| [Visual Layers](docs/VISUAL-LAYERS.md) | 12-layer rendering stack, transitions, colors |
| [API Keys](docs/API-KEYS.md) | External services, env vars, authentication |
| [Contributing](docs/CONTRIBUTING.md) | Dev setup, conventions, adding scenes/packages |
| [Local Mode](docs/LOCAL_MODE.md) | Running without GCP |
| [Video System Spec](docs/VIDEO_SYSTEM_SPEC.md) | Detailed technical specification |
| [User Guide](docs/NEXUS-AI-USER-GUIDE.md) | Operator CLI and cloud deployment |

## License

Private — all rights reserved.
