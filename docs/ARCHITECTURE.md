# Architecture

Nexus-AI is an automated video production pipeline that discovers trending tech topics, researches them, writes narration scripts, generates TTS audio, classifies and enriches scenes with AI visuals, and renders broadcast-quality videos with Remotion.

## Monorepo Layout

```
nexus-ai/
  apps/
    operator-cli/       CLI for pipeline operations
    orchestrator/       Cloud pipeline orchestrator (GCP Cloud Run)
    render-service/     Cloud rendering service (Remotion + Docker)
    video-studio/       Remotion composition — all scene components
  packages/
    asset-library/      SFX, music, logo fetching
    audio-mixer/        FFmpeg-based audio mixing
    broll-engine/       B-roll overlay engine
    config/             Shared tsconfig and eslint
    core/               Storage, secrets, errors, Firestore, cost tracking
    director-agent/     Gemini-powered scene classifier
    news-sourcing/      HN, HuggingFace, arXiv topic discovery
    notifications/      Discord webhook notifications
    pronunciation/      Custom pronunciation dictionary
    research/           Gemini-powered topic research
    script-gen/         Multi-agent narration script generation
    thumbnail/          YouTube thumbnail generation
    timestamp-extraction/ Word-level timestamp extraction
    tts/                Text-to-speech (AI Studio, edge-tts)
    twitter/            Twitter/X posting
    visual-gen/         Visual enrichment pipeline
    youtube/            YouTube upload + metadata
  scripts/
    run-local.ts        Full local pipeline (11 steps)
    full-render-test.ts E2E render test
    render-test-v2.ts   Render test v2
    resume-render.ts    Resume interrupted renders
    validate-pipeline.ts Pipeline validation
    validate-scenes.mjs Scene schema validation
    production-test.ts  Production integration test
```

## Runtime

| Tool      | Version      |
|-----------|-------------|
| Node.js   | >= 20.0.0   |
| pnpm      | 10.27.0     |
| Turbo     | 2.7.3       |
| TypeScript| 5.3+        |
| Remotion  | 4.x         |
| Vitest    | 1.x         |

## Dependency Graph

```
                    ┌──────────────────┐
                    │      core        │  Storage, secrets, errors
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────────────┐
          │                  │                           │
    ┌─────┴─────┐    ┌──────┴──────┐          ┌────────┴────────┐
    │news-sourcing│   │  script-gen │          │  Other leaf pkgs│
    └─────┬─────┘    └──────┬──────┘          │  research       │
          │                  │                 │  notifications  │
          │    ┌─────────────┼──────────┐      │  thumbnail      │
          │    │             │          │      │  twitter        │
          │ ┌──┴──┐   ┌─────┴───┐ ┌────┴──┐  └─────────────────┘
          │ │ tts │   │pronuncia│ │timestmp│
          │ └─────┘   │  tion   │ │extract │
          │            └────────┘ └────┬───┘
          │                            │
          │  ┌──────────┐  ┌──────────┐│
          │  │asset-lib  │  │director- ││
          │  │(no core)  │  │agent     ││
          │  └─────┬─────┘  │(no core) ││
          │        │        └────┬─────┘│
          │        │             │      │
          │   ┌────┴─────────────┴──────┴──┐
          │   │         visual-gen          │  (6 workspace deps)
          │   └────────────┬───────────────┘
          │                │
    ┌─────┴────────────────┴─────────────────────────┐
    │                 apps                            │
    │  orchestrator  render-service  video-studio     │
    │  operator-cli                                   │
    └─────────────────────────────────────────────────┘
```

**Key observations:**
- `core` is the foundation — used by 13 of 17 packages
- `script-gen` is the second hub — used by 5 packages (tts, pronunciation, timestamp-extraction, audio-mixer, broll-engine)
- `visual-gen` has the most dependencies (6 workspace packages)
- `director-agent` and `asset-library` are standalone (no workspace deps)

## Package Reference

| Package | Purpose | Workspace Deps |
|---------|---------|----------------|
| `core` | Storage, secrets, errors, Firestore, cost tracking | — |
| `config` | Shared tsconfig.json and eslint config | — |
| `news-sourcing` | Topic discovery from HN, HuggingFace, arXiv | core |
| `research` | Gemini-powered topic research briefs | core |
| `script-gen` | Multi-agent script generation (writer/critic/optimizer) | core |
| `pronunciation` | Custom pronunciation dictionary (IPA phonemes) | core, script-gen |
| `tts` | Text-to-speech synthesis | core, script-gen |
| `timestamp-extraction` | Word-level timestamp extraction (STT) | core, script-gen |
| `director-agent` | LLM-powered scene classifier + visual data generator | — |
| `asset-library` | SFX, music tracks, logo fetching | — |
| `audio-mixer` | FFmpeg-based mixing (narration + music + SFX) | core, script-gen |
| `broll-engine` | B-roll generation (code, browser, diagrams) | core, script-gen |
| `visual-gen` | Full visual enrichment pipeline | core, script-gen, director-agent, asset-library, audio-mixer, timestamp-extraction |
| `notifications` | Discord webhook notifications | core |
| `thumbnail` | YouTube thumbnail generation | core |
| `twitter` | Twitter/X posting | core |
| `youtube` | YouTube upload + metadata | core, news-sourcing |

## Data Flow

```
Topic Discovery ──► Research Brief ──► Script Generation ──► TTS Audio
                                            │
                                            ▼
                                    Timestamp Extraction
                                            │
                                            ▼
                                    Director Agent (scene classification)
                                            │
                                            ▼
                                    Visual Enrichment
                                    (logos, audio, geo, images,
                                     screenshots, stock, overlays,
                                     annotations, memes)
                                            │
                                            ▼
                                    Remotion Render ──► MP4 Video
                                            │
                                            ▼
                                    Chapters + Summary
```

## Storage Modes

The system supports two storage backends, selected automatically:

| Mode | Trigger | Backend | Path |
|------|---------|---------|------|
| **Local** | `STORAGE_MODE=local` or `NEXUS_BUCKET_NAME` unset | `LocalStorageClient` | `./local-storage/` |
| **Cloud** | `NEXUS_BUCKET_NAME` set + GCP credentials | `CloudStorageClient` | GCS bucket |

Both implement the same API. `CloudStorageClient` auto-delegates to `LocalStorageClient` when local mode is detected. `FirestoreClient` becomes a no-op in local mode.

Factory: `getStorageClient()` in `packages/core/src/storage/storage-factory.ts`

## AI Services

| Model | ID | Used By | Purpose |
|-------|----|---------|---------|
| Gemini Pro | `gemini-3-pro-preview` | research, script-gen | LLM (research briefs, scripts) |
| Gemini Flash | `gemini-2.0-flash` | core | Health checks |
| Gemini Flash | `gemini-2.5-flash` | director-agent | Scene classification |
| Gemini Flash TTS | `gemini-2.5-flash-preview-tts` | tts | Text-to-speech |
| Gemini Image | via `@google/generative-ai` | visual-gen | AI image generation |

All services authenticate via `NEXUS_GEMINI_API_KEY` (Google AI Studio API key).

## Related Documentation

- [Pipeline Reference](PIPELINE.md) — Step-by-step pipeline flow
- [Scene Types](SCENE-TYPES.md) — All 16 scene types
- [Visual Layers](VISUAL-LAYERS.md) — Rendering stack
- [API Keys](API-KEYS.md) — External services and authentication
- [Contributing](CONTRIBUTING.md) — Developer guide
- [Local Mode](LOCAL_MODE.md) — Running without GCP
