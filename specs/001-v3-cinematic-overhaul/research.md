# Research: V3 Cinematic Engine Overhaul

**Date**: 2026-02-21
**Branch**: `001-v3-cinematic-overhaul`

## R1: Audio Chipmunk Bug — Root Cause

**Decision**: Fix the sample rate mismatch in `stitchAudio()`.

**Root cause chain**:
1. AI Studio TTS outputs WAV at **24000 Hz** (`aistudio-tts-provider.ts:129`)
2. `extractPCMData()` (`audio-quality.ts:403`) calls `parseWavHeader()` which
   correctly reads `sampleRate: 24000` — but the `ExtractedPCM` interface
   (line 29) has no `sampleRate` field, so the value is **discarded**
3. `stitchAudio()` (line 365) hard-codes `const sampleRate = 44100`
4. `createWAVBuffer()` (line 549) writes a header declaring 44100 Hz over
   24000 Hz PCM → playback at 1.84x speed = **chipmunk effect**
5. Single-chunk TTS (< 4000 chars) bypasses `stitchAudio()` and is unaffected

**Fix approach**:
- Add `sampleRate: number` to `ExtractedPCM` interface
- Read `wavInfo.sampleRate` in `extractPCMData()` and return it
- In `stitchAudio()`: use first segment's actual sample rate (not hard-coded
  44100); validate all segments share the same rate; pass real rate to
  `generateSilence()` and `createWAVBuffer()`

**Alternatives considered**:
- FFmpeg resample all segments to 44100 Hz before stitching — viable but adds
  FFmpeg dependency to the TTS package and subprocess overhead per segment.
  Rejected because the simpler fix is to just use the correct sample rate.

**Hard-coded 44100 Hz locations** (7 files, only `audio-quality.ts` needs fix):

| File | Status |
|------|--------|
| `packages/tts/src/audio-quality.ts:365` | **FIX** — use real rate |
| `packages/tts/src/tts.ts:295` | OK — validation only |
| `packages/core/src/providers/tts/*-provider.ts` | OK — correct per-provider |
| `packages/audio-mixer/src/mix-pipeline.ts:236` | OK — FFmpeg output target |
| `packages/asset-library/src/wav-utils.ts:14` | OK — SFX generation |

## R2: Silence Drops — Implementation Approach

**Decision**: Extend `generateDuckingCurve()` with an optional `silenceDrops`
parameter.

**Current state**: `DEFAULT_DUCKING_CONFIG` ducks to -20 dB during speech,
-12 dB during silence. Music never fully mutes.

**Implementation**:
- Add `SilenceDrop` type: `{ timeSec: number; durationSec: number }`
- In `generateDuckingCurve()`, accept optional `silenceDrops: SilenceDrop[]`
- For each drop: insert gain points at `timeSec` → -Infinity dB (linear 0.0),
  hold for `durationSec` (1s), then fade back to `silenceLevel` over 300 ms
- The caller (`mix-pipeline.ts`) builds silence drops from scene data:
  scenes with `type ∈ {stat-callout, text-emphasis, full-screen-text}` or
  `isColdOpen === true` get a 1s silence drop before `startFrame / fps`

**Alternatives considered**:
- Separate FFmpeg `volume=0` filter for drops — rejected, complicates the
  filter graph when a single expression can handle it.

## R3: V1/V2 Render Service Disconnect

**Decision**: The render service V2 detection already exists at line 175 of
`render.ts`. The gaps are:

| Gap | Fix |
|-----|-----|
| Missing `impactWords` | Add `impactWords` to V2 inputProps from GCS payload |
| Missing `wordTimings` | Add if present (optional field) |
| No `publicDir` in `bundle()` | Set explicitly like `run-local.ts` does |
| No image materialization | Add `materializeImages()` before render |
| No Playwright webpack alias | Add `playwright*` → `false` aliases |

**The actual V2 detection logic is correct** — it checks
`timelineData.version === 'v2-director'`. The orchestrator must ensure the GCS
payload includes `version: 'v2-director'` at the top level with a `scenes`
array.

**Alternatives considered**:
- Rewrite render service to call enrichers directly — rejected, violates
  separation (enrichment runs in orchestrator, not render service).

## R4: Neon Hacker Palette Migration Scope

**Decision**: Big-bang update of 2 source files + 4 hardcoded remnants.

**Source-of-truth files** (auto-propagate to all consumers):
1. `apps/video-studio/src/utils/colors.ts` — 5 values to change
2. `apps/video-studio/src/theme.ts` — 6 values to change

**Escaped hardcodes** (manual per-file fixes):
- `LogoShowcase.tsx:39` — `#00D4FF` in color array
- `CodeBlock.tsx:28` — `#00D4FF` as `COLOR_STRING`
- `TechExplainer.tsx:137` — `#0a0e1a` inline backgroundColor
- `MapAnimation.tsx:45` — `#0A0E1A` inline backgroundColor

**7 shared components** auto-inherit via `COLORS.accentPrimary` default prop:
AnimatedText, BackgroundGradient, CountUpNumber, DrawingLine, GlowEffect,
GridOverlay, ParticleField.

## R5: Director Agent `visualLayer` Wiring

**Decision**: Add `visualLayer` as a post-classification deterministic
assignment (not LLM-generated), based on scene type + content heuristics.

**Rationale**: Asking the LLM to assign visual layers adds unreliability for
no clear benefit. The layer assignment is a mechanical alternation algorithm
with max-3-consecutive constraint — better as code than LLM inference.

**Implementation**:
1. Add `visualLayer` to `ClassifiedSegment` type (`types.ts:527`)
2. Add `visualLayer` to `Scene` interface (`types.ts:466`)
3. New function `assignVisualLayers(scenes: ClassifiedSegment[])` after
   classification, using round-robin with content-aware overrides:
   - Scenes with company names / URLs → `evidence-screenshot`
   - Scenes with code/diagrams → `showcase-scroll`
   - Abstract/stat/opinion scenes → `abstract-concept`
   - Max 3 consecutive of same type enforced by rotation
4. Add `cssSelector` and `highlightText` as optional fields in `visualData`
   for `evidence-screenshot` and `showcase-scroll` layers — these ARE
   LLM-generated via the director prompt
5. Add Nano Banana prompt to `DIRECTOR_SYSTEM_PROMPT` for `abstract-concept`

## R6: Playwright `cssSelector` + `highlightText`

**Decision**: Extend `ScreenshotOptions` interface with `cssSelector` and
`highlightText` fields.

**Current state**: `fullPage` already works. `waitForSelector` already works.
No element-specific capture or text highlighting exists.

**Implementation**:
- `cssSelector`: Use `page.locator(cssSelector).screenshot()` if selector
  found; fall back to full-page on failure (silent fallback per Principle X)
- `highlightText`: Use `page.evaluate()` to inject a script that wraps
  matching text in a `<mark>` element with neon green border before capture;
  no-op if text not found

## R7: Retention Script Prompts

**Decision**: Update all three prompt builders in `packages/script-gen/src/prompts.ts`.

**Current state**: Writer prompt has a single line "Hook the audience in the
first 15 seconds" with no definition. Critic says "Is the hook strong?" with
no rubric. Optimizer says "Maximize retention" with no specifics.

**Updates**:
- `buildWriterPrompt()`: Add explicit 3-act structure: Hook (0–15s: pattern
  interrupt — question, statistic, or bold claim), Context (15–45s: what, why
  now, who), Body with Open Loops (minimum 2 unresolved questions before
  midpoint, each resolved later)
- `buildCriticPrompt()`: Add hook evaluation rubric (Is first segment a
  question/stat/claim? Does it create curiosity gap?) and open-loop check
- `buildOptimizerPrompt()`: Add instruction to ensure first segment gets
  `type: hook` in DirectionDocument output
