# Quickstart: V3 Cinematic Engine Overhaul

## Prerequisites

- Node >= 20, pnpm 10.x
- `NEXUS_GEMINI_API_KEY` in `.env.local`
- `STORAGE_MODE=local` in `.env.local`

## Verify Baseline

```bash
# Confirm current tests pass
pnpm test

# Confirm type-check for affected packages
cd packages/tts && npx tsc --noEmit && cd ../..
cd packages/audio-mixer && npx tsc --noEmit && cd ../..
cd packages/director-agent && npx tsc --noEmit && cd ../..
cd packages/visual-gen && npx tsc --noEmit && cd ../..
cd apps/video-studio && npx tsc --noEmit && cd ../..
cd apps/render-service && npx tsc --noEmit && cd ../..
```

## Test Each Pillar

### Pillar 1: Audio Fixes

```bash
# Run audio-quality tests (chipmunk fix)
pnpm test --filter @nexus-ai/tts

# Run audio-mixer tests (silence drops)
pnpm test --filter @nexus-ai/audio-mixer
```

### Pillar 2: Neon Hacker Rebrand

```bash
# Verify no cyan/violet remnants
cd apps/video-studio
grep -rn '#00d4ff\|#00D4FF\|#8b5cf6\|#0a0e1a\|#0A0E1A' src/
# Expected: zero matches after migration

# Render test clip
npx tsx scripts/dev/render-clip.ts
```

### Pillar 3: Visual Sandwich

```bash
# Run director-agent tests (visualLayer assignment)
pnpm test --filter @nexus-ai/director-agent
```

### Pillar 4: Playwright Capture

```bash
# Run visual-gen tests (cssSelector, highlightText, fullPage)
pnpm test --filter @nexus-ai/visual-gen
```

### Pillar 5: Script Generation

```bash
# Run script-gen tests (hook/context/open-loop)
pnpm test --filter @nexus-ai/script-gen
```

## Full Pipeline E2E

```bash
# Run full local pipeline with a test topic
pnpm run pipeline:local "GPT-5 release"

# Verify output
ls output/gpt-5-release/video.mp4
```

## Key Validation Points

1. **Audio**: Play output MP4 — narration should be natural pitch, music
   drops to silence before stat-callout/text-emphasis scenes
2. **Visual**: All text glows are neon green (#aaff00), backgrounds are
   deep black (#0a0a0a–#111111), no cyan or violet anywhere
3. **Variety**: Visual layers alternate — no more than 3 consecutive
   scenes with the same layer type
4. **Screenshots**: Cropped captures show relevant content sections,
   highlighted text has neon green rectangles
5. **Script**: First 15 seconds contains a clear hook, at least 2 open
   loops appear before the midpoint
