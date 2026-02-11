# API Keys & External Services

All API keys are stored in `.env.local` (never committed). See `.env.local.example` for a template.

## Required Services

### Google AI Studio (Gemini)

| | |
|---|---|
| **Env var** | `NEXUS_GEMINI_API_KEY` |
| **Fallback var** | `GEMINI_API_KEY` |
| **Get a key** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Free tier** | Yes (rate-limited) |
| **Used by** | research, script-gen, director-agent, visual-gen (image gen), tts |

This single key powers all AI services:

| Service | Model | Package |
|---------|-------|---------|
| LLM (research briefs) | `gemini-3-pro-preview` | `@nexus-ai/research` |
| LLM (script generation) | `gemini-3-pro-preview` | `@nexus-ai/script-gen` |
| Scene classification | `gemini-2.5-flash` | `@nexus-ai/director-agent` |
| Image generation | `gemini-*` via `@google/generative-ai` | `@nexus-ai/visual-gen` |
| Text-to-speech | `gemini-2.5-flash-preview-tts` | TTS in `scripts/run-local.ts` |
| Health checks | `gemini-2.0-flash` | `@nexus-ai/core` |

## Optional Services

### Giphy (Meme GIFs)

| | |
|---|---|
| **Env var** | `GIPHY_API_KEY` |
| **Get a key** | [developers.giphy.com](https://developers.giphy.com/) |
| **Free tier** | Yes |
| **Used by** | `@nexus-ai/visual-gen` (meme enricher) |
| **Fallback** | Meme scenes skipped — no `meme-reaction` scenes inserted |
| **Notes** | Rating filter: pg-13. Prefers `downsized_medium` format. |

### Pexels (Stock Photos/Videos)

| | |
|---|---|
| **Env var** | `PEXELS_API_KEY` |
| **Get a key** | [pexels.com/api](https://www.pexels.com/api/) |
| **Free tier** | Yes (200 requests/hour) |
| **Used by** | `@nexus-ai/visual-gen` (stock enricher) |
| **Fallback** | Stock enrichment skipped — AI images or gradients used instead |
| **Notes** | Max 5 stock images per video |

## Cloud-Only Services

These are only needed when deploying to GCP (not required for local mode):

| Env Var | Service | Purpose |
|---------|---------|---------|
| `NEXUS_BUCKET_NAME` | Google Cloud Storage | Artifact storage |
| `NEXUS_PROJECT_ID` | GCP Project | Project identifier |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCP Service Account | Auth for all GCP services |
| `GOOGLE_CLOUD_PROJECT` | GCP Project | Alternative project env |
| `NEXUS_SECRET` | — | Render service auth token |
| `RENDER_SERVICE_URL` | Cloud Run | Render service endpoint |
| `NEXUS_DISCORD_WEBHOOK_URL` | Discord | Pipeline notifications |

## No-Auth Services

These external services don't require API keys:

| Service | Used By | Purpose |
|---------|---------|---------|
| Hacker News API | `@nexus-ai/news-sourcing` | Topic discovery |
| HuggingFace API | `@nexus-ai/news-sourcing` | Topic discovery |
| arXiv API | `@nexus-ai/news-sourcing` | Topic discovery |
| Clearbit Logo API | `@nexus-ai/visual-gen` | Company logo fetching |
| Google Favicon API | `@nexus-ai/visual-gen` | Fallback logo fetching |

## Key Resolution Order

Most code checks environment variables in this order:

```typescript
const apiKey = process.env.NEXUS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
```

The `getSecret()` function in `@nexus-ai/core` checks:
1. Environment variable `NEXUS_GEMINI_API_KEY`
2. GCP Secret Manager (cloud mode only)

## Security

- Never commit `.env.local` or any file containing API keys
- `.env.local` is in `.gitignore`
- In cloud mode, keys are stored in GCP Secret Manager
- The `client_secret*.json` pattern is also gitignored

## Related Documentation

- [Setup](../docs/LOCAL_MODE.md) — Local mode configuration
- [Pipeline](PIPELINE.md) — Which steps use which services
- [Architecture](ARCHITECTURE.md) — System overview
