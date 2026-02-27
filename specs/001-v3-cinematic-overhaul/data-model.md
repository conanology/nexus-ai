# Data Model: V3 Cinematic Engine Overhaul

**Date**: 2026-02-21
**Branch**: `001-v3-cinematic-overhaul`

## Modified Entities

### ExtractedPCM (packages/tts/src/audio-quality.ts)

**Current fields**: `pcmData: Buffer`, `numChannels: number`

**Added field**:
- `sampleRate: number` — the actual sample rate read from the WAV header

### DuckingConfig (packages/audio-mixer/src/types.ts)

**Current fields**: `speechLevel`, `silenceLevel`, `attackMs`, `releaseMs`

No changes to DuckingConfig itself. Silence drops are passed separately.

### SilenceDrop (NEW — packages/audio-mixer/src/types.ts)

- `timeSec: number` — start time of the silence window (scene start - 1.0s)
- `durationSec: number` — always 1.0 for V3
- `fadeBackMs: number` — always 300 for V3

### ClassifiedSegment (packages/director-agent/src/types.ts)

**Current fields**: `ScriptSegment & { sceneType, visualData, pacing }`

**Added field**:
- `visualLayer: 'abstract-concept' | 'evidence-screenshot' | 'showcase-scroll'`

### Scene (apps/video-studio/src/types/scenes.ts)

**Current fields**: `id, type, startFrame, endFrame, content, visualData,
pacing?, transition?, sfx?, musicTrack?, backgroundImage?, screenshotImage?,
screenshotDisplayMode?, sourceUrl?, visualSource?, overlays?, annotations?,
isColdOpen?`

**Added fields**:
- `visualLayer?: 'abstract-concept' | 'evidence-screenshot' | 'showcase-scroll'`
- `cssSelector?: string` — LLM-generated CSS selector hint for Playwright
- `highlightText?: string` — LLM-generated text to highlight in screenshots
- `fullPageImage?: string` — path to materialized full-page screenshot

### ScreenshotOptions (packages/asset-library/src/screenshots/screenshot-service.ts)

**Current fields**: `width?, height?, waitForSelector?, waitMs?, darkMode?,
fullPage?, clip?`

**Added fields**:
- `cssSelector?: string` — crop to this element's bounding box
- `highlightText?: string` — draw neon green highlight around this text

### LLMSceneEntrySchema (packages/director-agent/src/types.ts)

**Current fields**: `sceneType: z.string(), visualData: z.record(),
pacing: z.string().optional()`

**Added fields**:
- `cssSelector: z.string().optional()` — for evidence/showcase layers
- `highlightText: z.string().optional()` — for evidence/showcase layers

Note: `visualLayer` is NOT in the LLM schema — it's assigned
deterministically post-classification.

## New Entity

### SceneType: 'scrolling-capture' (the 17th scene type)

Added to `SCENE_TYPES` array in `apps/video-studio/src/types/scenes.ts`.

**visualData shape**:
```typescript
{
  fullPageImageUrl: string;   // path to materialized full-page image
  scrollSpeedPxPerSec: number; // default 500
  label?: string;              // optional overlay label
}
```

## Color Constants Migration

### COLORS (apps/video-studio/src/utils/colors.ts)

| Key | Old Value | New Value |
|-----|-----------|-----------|
| `bgDeepDark` | `#0a0e1a` | `#0a0a0a` |
| `bgBase` | `#111827` | `#111111` |
| `bgElevated` | `#1e293b` | `#1a1a1a` |
| `accentPrimary` | `#00d4ff` | `#aaff00` |
| `accentGlow` | `rgba(0,212,255,0.3)` | `rgba(170,255,0,0.3)` |
| `accentBright` | `#0ea5e9` | `#88cc00` |
| `accentSecondary` | `#8b5cf6` | `#88cc00` |
| `accentSecondaryBright` | `#a855f7` | `#aaff00` |

### THEME (apps/video-studio/src/theme.ts)

| Key | Old Value | New Value |
|-----|-----------|-----------|
| `primary` | `#00d4ff` | `#aaff00` |
| `primaryLight` | `#0ea5e9` | `#88cc00` |
| `primaryDark` | `#0284c7` | `#669900` |
| `secondary` | `#8b5cf6` | `#88cc00` |
| `secondaryLight` | `#a855f7` | `#aaff00` |
| `secondaryDark` | `#7c3aed` | `#669900` |
| `accent` | `#00d4ff` | `#aaff00` |
| `background` | `#0a0e1a` | `#0a0a0a` |
| `backgroundLight` | `#1e293b` | `#1a1a1a` |
| `backgroundDark` | `#111827` | `#111111` |
| `glow` shadow | `rgba(0,212,255,0.3)` | `rgba(170,255,0,0.3)` |
