# Pipeline Reference

The Nexus-AI pipeline transforms a trending topic into a fully rendered video. This document covers the local pipeline (11 steps) and the visual enrichment sub-pipeline (10 steps).

## Pipeline Overview

```
 1. Validate  ──►  2. News  ──►  3. Research  ──►  4. Script  ──►  5. Pronunciation
                                                                         │
     11. Chapters  ◄──  10. Render  ◄──  9. Enrich  ◄──  8. Director  ◄─┤
                                                                         │
                                                          7. Timestamps ◄┤
                                                                         │
                                                          6. TTS Audio  ◄┘
```

**Entry point:** `scripts/run-local.ts` — run with `pnpm run pipeline:local "topic"`

## Pipeline Steps

### Step 1: Environment Validation

| | |
|---|---|
| **Function** | `validateEnvironment()` |
| **Checks** | `NEXUS_GEMINI_API_KEY` set, video-studio entry exists, ffmpeg/ffprobe/edge-tts availability |
| **Fallback** | Fatal exit if API key missing; warnings for missing tools |
| **External** | None |

### Step 2: News Sourcing

| | |
|---|---|
| **Package** | `@nexus-ai/news-sourcing` |
| **Function** | `executeNewsSourcing()` |
| **Input** | Pipeline ID, enabled sources (hacker-news, huggingface, arxiv) |
| **Output** | `{ title, url, source }` — selected topic |
| **Fallback** | Auto-select best candidate; use provided fallback topic if no candidates |
| **External** | Hacker News API, HuggingFace API, arXiv API (no auth) |

### Step 3: Research Brief

| | |
|---|---|
| **Package** | `@nexus-ai/research` |
| **Function** | `executeResearch()` |
| **Input** | Topic `{ title, url, source }` |
| **Output** | `{ researchBrief, topicData }` (~2000 words) |
| **Fallback** | None (throws on failure) |
| **External** | Gemini LLM (`gemini-3-pro-preview`) |

### Step 4: Script Generation

| | |
|---|---|
| **Package** | `@nexus-ai/script-gen` |
| **Function** | `executeScriptGen()` |
| **Input** | Research brief, topic data |
| **Output** | `{ scriptGenOutput, scriptText, directionDocument }` |
| **Pipeline** | Writer agent → Critic agent → Optimizer agent |
| **Fallback** | None (throws on failure) |
| **External** | Gemini LLM (3 sequential calls) |

### Step 5: Pronunciation

| | |
|---|---|
| **Package** | `@nexus-ai/pronunciation` |
| **Function** | `executePronunciation()` |
| **Input** | Script output, topic data, direction document |
| **Output** | `{ ssmlScript, scriptText }` with IPA overrides |
| **Fallback** | try-catch → returns plain script text (expected to fail locally — needs Firestore) |
| **External** | Firestore (pronunciation dictionary) |

### Step 6: TTS Audio

| | |
|---|---|
| **Function** | `generateAudio()` |
| **Input** | Script text, output path |
| **Output** | WAV file + `{ durationSec, source }` |
| **External** | Google AI Studio TTS API, Microsoft edge-tts, ffmpeg |

**TTS cascade** (tries in order):

| Priority | Provider | Model/Tool | Format | Notes |
|----------|----------|------------|--------|-------|
| 1 | AI Studio TTS | `gemini-2.5-flash-preview-tts` | 24kHz PCM → WAV | Requires `NEXUS_GEMINI_API_KEY` |
| 2 | edge-tts | Microsoft Neural voices | MP3 → ffmpeg → WAV | Requires `pip install edge-tts` |
| 3 | Silent fallback | — | Generated WAV | Duration estimated: words / 2.5 |

### Step 7: Timestamp Extraction

| | |
|---|---|
| **Package** | `@nexus-ai/timestamp-extraction` |
| **Function** | `applyEstimatedTimings()` |
| **Input** | Direction document, audio duration |
| **Output** | `{ wordTimings, enrichedDocument }` |
| **Fallback** | Character-weighted uniform distribution if STT unavailable |
| **External** | None locally (STT would need GCP) |

### Step 8: Director Agent

| | |
|---|---|
| **Package** | `@nexus-ai/director-agent` |
| **Function** | `generateSceneDirection()` |
| **Input** | Script, total frames, fps, metadata |
| **Output** | `{ scenes[], warnings[] }` — classified into 16 scene types |
| **Fallback** | `buildFallbackScenes()` → intro + text-emphasis + narration-default + outro |
| **External** | Gemini LLM (`gemini-2.5-flash`) |

### Step 9: Visual Enrichment

| | |
|---|---|
| **Package** | `@nexus-ai/visual-gen` |
| **Function** | `enrichScenesWithAssets()` |
| **Input** | Raw scenes array, source URLs |
| **Output** | Enriched scenes with images, audio, overlays, annotations |
| **External** | Clearbit, Google, Gemini, Playwright, Pexels, Giphy |

See [Enrichment Sub-Pipeline](#enrichment-sub-pipeline) below.

### Step 10: Remotion Render

| | |
|---|---|
| **Function** | `renderVideo()` |
| **Input** | Enriched scenes, audio URL, total frames |
| **Output** | MP4 file (1920x1080, h264+aac, 30fps) |
| **Process** | Bundle (webpack, 1-3 min) → selectComposition → renderMedia |
| **Timeout** | 30 minutes |
| **External** | None (Remotion + local Chromium) |

### Step 11: Chapters & Summary

| | |
|---|---|
| **Function** | `generateChapters()` |
| **Input** | Enriched scenes, output directory |
| **Output** | chapters.txt, chapters.json, chapters.vtt, topic.json, script.txt |
| **External** | None |

## Enrichment Sub-Pipeline

Step 9 runs 10 enrichment stages in this fixed order:

| # | Stage | External Service | Env Var | What It Does |
|---|-------|-----------------|---------|--------------|
| 1 | **Logos** | Clearbit, Google | — | Fetches company logos → `scene.visualData.logos[].src` |
| 2 | **Audio** | — | — | Assigns SFX + music track per scene type |
| 3 | **Geo** | — | — | Resolves country names → ISO codes, sets animation style |
| 4 | **AI Images** | Gemini | `NEXUS_GEMINI_API_KEY` | Generates background images → `scene.backgroundImage` |
| 5 | **Source Screenshots** | Playwright | — | Screenshots of source article → `scene.screenshotImage` (max 8) |
| 6 | **Company Screenshots** | Playwright | — | Screenshots of company websites |
| 7 | **Stock Photos** | Pexels | `PEXELS_API_KEY` | Stock photos → `scene.backgroundImage` (max 5) |
| 8 | **Overlays** | — | — | Grid, scanlines, vignette, branding overlays |
| 9 | **Annotations** | — | — | Handwritten circles, arrows, underlines |
| 10 | **Memes** | Giphy | `GIPHY_API_KEY` | Meme GIFs → may insert `meme-reaction` scenes |

### Visual Priority

When multiple visual sources are available, the first match wins:

1. Source screenshot (Playwright, from article URL)
2. Company screenshot (Playwright, from company site)
3. Stock photo (Pexels API)
4. AI-generated image (Gemini)
5. Gradient fallback (no image)

## Cloud Orchestrator

The cloud pipeline (`apps/orchestrator`) runs the same logical steps but uses:
- GCS for storage instead of local filesystem
- Cloud Run for rendering instead of local Remotion
- Firestore for state tracking and pronunciation dictionary
- GCP Secret Manager for API keys
- Cloud Scheduler for daily triggers (6:00 AM UTC)
- Discord webhooks for notifications

## External Services Summary

| Service | Env Var | Required | Fallback |
|---------|---------|----------|----------|
| Gemini LLM | `NEXUS_GEMINI_API_KEY` | Yes | None (fatal) |
| Gemini Image Gen | `NEXUS_GEMINI_API_KEY` | Yes | Gradient backgrounds |
| AI Studio TTS | `NEXUS_GEMINI_API_KEY` | Yes | edge-tts → silent |
| Pexels Stock | `PEXELS_API_KEY` | No | Skipped |
| Giphy Memes | `GIPHY_API_KEY` | No | Skipped |
| Hacker News | — | No | Other sources |
| HuggingFace | — | No | Other sources |
| arXiv | — | No | Other sources |
| Clearbit Logos | — | No | Placeholder |
| Playwright | — | No | No screenshots |

## Related Documentation

- [Architecture](ARCHITECTURE.md) — System overview
- [Scene Types](SCENE-TYPES.md) — All 16 scene types
- [Visual Layers](VISUAL-LAYERS.md) — Rendering stack
- [API Keys](API-KEYS.md) — Key management
