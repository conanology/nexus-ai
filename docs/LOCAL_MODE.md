# Nexus AI — Local Mode

Run the entire Nexus AI pipeline locally without any GCP services. Only requires a Google AI Studio API key.

## Setup

1. **Get an API key** from [Google AI Studio](https://aistudio.google.com/apikey)

2. **Create `.env.local`** in the project root:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local and add your NEXUS_GEMINI_API_KEY
   ```

3. **Install dependencies** (if not already done):
   ```bash
   pnpm install
   ```

4. **Generate SFX and music** (first time only):
   ```bash
   npx tsx packages/asset-library/src/sfx/generate-sfx.ts
   npx tsx packages/asset-library/src/music/generate-ambient.ts
   ```

5. **Optional: Install edge-tts** for high-quality TTS fallback:
   ```bash
   pip install edge-tts
   ```

## Running the Pipeline

```bash
# Generate a video from a topic
pnpm run pipeline:local "AI is disrupting the SaaS industry"

# Or use a pre-written script
pnpm run pipeline:local --script path/to/script.txt
```

## Output

Videos are saved to `./output/{topic-slug}/`:
- `video.mp4` — The rendered video (1920x1080, h264+aac)
- `script.txt` — The generated script
- `chapters.txt` — YouTube-format chapters
- `chapters.json` — Machine-readable chapters
- `chapters.vtt` — WebVTT chapters

Intermediate files are stored in `./local-storage/{topic-slug}/`:
- `script.txt` — Generated script
- `audio.wav` — TTS audio
- `scenes-raw.json` — Director Agent output (pre-enrichment)
- `scenes-enriched.json` — Enriched scenes (post-enrichment)

## TTS Priority

The pipeline tries TTS providers in this order:
1. **AI Studio TTS** (Gemini 2.5 Flash Preview TTS via API key)
2. **edge-tts** (Microsoft Neural TTS, free, requires `pip install edge-tts`)
3. **Silent fallback** (generates silent audio with correct duration)

## What Works in Local Mode

| Feature | Status | Notes |
|---------|--------|-------|
| Script generation | Works | Via Gemini LLM (API key) |
| TTS audio | Works | AI Studio TTS or edge-tts |
| Scene classification | Works | Via Director Agent (Gemini) |
| Logo fetching | Works | Free Clearbit/Google APIs |
| AI image generation | Works | Via Gemini (API key) |
| Screenshot capture | Works | Via Playwright (local) |
| Meme GIF search | Works | Tenor API (same API key) |
| Overlay enrichment | Works | Pure logic, no external calls |
| Annotation enrichment | Works | Pure logic, no external calls |
| Geo enrichment | Works | Pure logic, no external calls |
| Remotion render | Works | Local rendering |
| Audio mixing (SFX/music) | Partial | SFX/music via Remotion components |

## Switching Back to Cloud Mode

Set `NEXUS_BUCKET_NAME` and `GOOGLE_APPLICATION_CREDENTIALS` to re-enable GCP services:
```bash
export NEXUS_BUCKET_NAME=nexus-ai-artifacts
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
# Remove STORAGE_MODE=local from .env.local
```

## Troubleshooting

**"NEXUS_GEMINI_API_KEY must be set"**
- Get a key from https://aistudio.google.com/apikey
- Add it to `.env.local`

**"Video Studio entry not found"**
- Run `pnpm install` to ensure all packages are linked

**"Director Agent failed"**
- Check your API key is valid
- The pipeline will fall back to manual scenes automatically

**"edge-tts not found"**
- This is optional. Install with `pip install edge-tts` for better TTS quality
- The pipeline will fall back to silent audio if no TTS is available
