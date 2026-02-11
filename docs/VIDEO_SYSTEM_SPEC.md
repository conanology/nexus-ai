# VIDEO SYSTEM SPECIFICATION

## Nexus AI — Autonomous AI News Video Pipeline

> **Version:** 2.0
> **Last Updated:** 2026-02-07
> **Status:** Active — V2 Production Ready
> **Audience:** Claude Code sessions, developers, pipeline operators

---

## Table of Contents

0. [Current Status](#0-current-status)
1. [Project Overview](#1-project-overview)
2. [Current System Audit](#2-current-system-audit)
3. [Known Bugs](#3-known-bugs)
4. [Visual Quality Targets](#4-visual-quality-targets)
5. [Scene System Architecture](#5-scene-system-architecture)
6. [Component Specifications](#6-component-specifications)
7. [Director Agent Specification](#7-director-agent-specification)
8. [Audio Pipeline Specification](#8-audio-pipeline-specification)
9. [Rendering Pipeline](#9-rendering-pipeline)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Example: Script-to-Scenes Mapping](#11-example-script-to-scenes-mapping)
12. [File Structure Target](#12-file-structure-target)
13. [Running a V2 Render](#13-running-a-v2-render)

---

## 0. CURRENT STATUS

| Component | Status |
|---|---|
| Implementation Phases 0-10 | COMPLETE |
| Scene Types (14/14) | BUILT — intro, chapter-break, narration-default, text-emphasis, full-screen-text, stat-callout, comparison, diagram, logo-showcase, timeline, quote, list-reveal, code-block, outro |
| Director Agent | OPERATIONAL — LLM-powered scene classification via Gemini |
| Audio Bug Fix | APPLIED — WAV header channel count corrected |
| Theme Migration | COMPLETE — Cyan primary (#00d4ff), violet secondary (#8b5cf6) |
| Docker Build | UPDATED — fonts (Inter + JetBrains Mono), GEMINI_API_KEY support |
| Production Readiness | READY (pending first full production render) |

---

## 1. PROJECT OVERVIEW

### 1.1 Mission

Produce broadcast-quality 8-12 minute AI/tech news videos autonomously, comparable to channels like Fireship, ColdFusion, Two Minute Papers, and The AI Grip. The system takes a script as input and produces a fully rendered video with professional visuals, animations, and synchronized audio as output.

### 1.2 Architecture

- **Monorepo:** Turborepo 2.3.5 + pnpm 10.27.0
- **Language:** TypeScript 5.3 (strict mode), Node.js 20+
- **Video Engine:** Remotion v4.0
- **Production Rendering:** Google Cloud Run Jobs
- **Storage:** Google Cloud Storage (`nexus-ai-artifacts` bucket)
- **LLM:** Google Gemini API
- **TTS:** Gemini TTS / Chirp 3 HD / WaveNet (fallback chain)
- **Output:** 1920x1080 H.264 MP4 at 30fps

### 1.3 Pipeline Flow

```
news-sourcing → research → script-gen → pronunciation → tts
    → timestamp-extraction → visual-gen (+ audio-mixer) → render-service
    → thumbnail → youtube → twitter → notifications
```

### 1.4 Scope of This Document

This spec covers the **video production subsystem**: everything from script input through rendered MP4 output. Specifically:

| Package/App | Role |
|---|---|
| `apps/video-studio` | Remotion compositions and visual components |
| `apps/render-service` | Remotion bundler/renderer HTTP service |
| `packages/tts` | Text-to-speech synthesis |
| `packages/timestamp-extraction` | Word-level audio timing via STT |
| `packages/audio-mixer` | Voice + music ducking + SFX mixing |
| `packages/visual-gen` | Script → visual timeline generation |
| `packages/script-gen` | Script generation + type definitions |
| `packages/broll-engine` | B-roll generation (code, browser, diagrams) |

---

## 2. CURRENT SYSTEM AUDIT

> This section documents what exists in the codebase as of 2026-02-06. All file paths are relative to the repository root.

### 2.1 Remotion Configuration

**File:** `apps/video-studio/src/Root.tsx`

```
Composition ID: "TechExplainer"
Resolution: 1920 x 1080
FPS: 30
Default Preview Duration: 9000 frames (5 minutes)
Dynamic Duration: calculateTechExplainerMetadata (resolves from props)
```

**File:** `apps/video-studio/remotion.config.ts`

- Video image format: JPEG
- Overwrite output: enabled

### 2.2 Dual Input Modes

**File:** `apps/video-studio/src/compositions/TechExplainer.tsx`

The `TechExplainer` composition accepts two mutually exclusive input schemas:

**Mode 1 — Legacy Timeline** (currently used by render-service):
```typescript
{
  timeline: {
    audioDurationSec: number;
    totalDurationFrames?: number;
    scenes: Array<{
      component: string;       // Component name from COMPONENT_MAP
      props?: Record<string, any>;
      startTime: number;       // Seconds
      duration: number;        // Seconds
    }>;
  };
  audioUrl: string;
}
```

**Mode 2 — Direction Document** (exists in code, not yet used in production):
```typescript
{
  directionDocument: DirectionDocument;  // From @nexus-ai/script-gen
  audioUrl: string;
}
```

The Direction Document mode uses `mapSegmentToScene()` (`TechExplainer.tsx:109-122`) to convert `DirectionSegment` objects to `MappedScene` objects, preferring actual timing (from STT) over estimated timing (from script-gen).

**CRITICAL GAP:** The render service (`apps/render-service/src/render.ts:178-181`) only passes `timeline` mode. The V2 Direction Document path in `TechExplainer.tsx:141-177` is never exercised in production.

### 2.3 Component Inventory

**Directory:** `apps/video-studio/src/components/`

All 11 current components follow the same pattern:
- Import `AbsoluteFill`, `useCurrentFrame`, `useVideoConfig` from Remotion
- Import `THEME` from `../theme`
- Import `useMotion` from `../hooks/useMotion`
- Accept optional `motion?: MotionConfig` prop
- Apply `motionStyles.entranceStyle`, `motionStyles.emphasisStyle`, `motionStyles.exitStyle`

| # | Component | File | Purpose | Key Features |
|---|---|---|---|---|
| 1 | NeuralNetworkAnimation | `NeuralNetworkAnimation.tsx` | Neural network visualizations | Layered node generation, edge animation, data flow particles, spring entrance with stagger |
| 2 | DataFlowDiagram | `DataFlowDiagram.tsx` | Pipeline/data flow visualization | Horizontal flow layout, animated arrows with dash particles, spring-staggered nodes |
| 3 | ComparisonChart | `ComparisonChart.tsx` | Bar chart with before/after | SVG grid lines, spring-animated bars, percentage change indicator |
| 4 | MetricsCounter | `MetricsCounter.tsx` | Animated number counter | Spring count-up interpolation, pulse effect, glow background, progress bar, sparkle orbits |
| 5 | ProductMockup | `ProductMockup.tsx` | Product/UI display | Window chrome, shimmer effect, placeholder grid or image |
| 6 | CodeHighlight | `CodeHighlight.tsx` | Code with syntax highlighting | Typing effect (Story 6-30), line-by-line fade, regex-based coloring, cursor blink, highlighted lines |
| 7 | BrandedTransition | `BrandedTransition.tsx` | Wipe/fade/slide transitions | Three modes (wipe/fade/slide), NEXUS-AI logo reveal, particle burst, direction control |
| 8 | LowerThird | `LowerThird.tsx` | Text overlay at bottom/top | Spring slide-in, dark backdrop with blur, accent border, pulsing dot indicator |
| 9 | TextOnGradient | `TextOnGradient.tsx` | Text on gradient background | 135-degree gradient, spring entrance/exit, radial overlay depth, accent bars |
| 10 | KineticText | `KineticText.tsx` | Word-by-word animated typography | Word-level timing sync, spring entrance per word, emphasis effects (scale/glow/underline/color) |
| 11 | BrowserFrame | `BrowserFrame.tsx` | Simulated browser window | Window controls, tab bar, address bar, demo elements (text/button/input/code/metric/chart), cursor + highlight |

**Component Map** (`TechExplainer.tsx:57-69`):
```typescript
const COMPONENT_MAP: Record<string, React.FC<any>> = {
  NeuralNetworkAnimation, DataFlowDiagram, ComparisonChart,
  MetricsCounter, ProductMockup, CodeHighlight, BrandedTransition,
  LowerThird, TextOnGradient, KineticText, BrowserFrame,
};
```

**ComponentName Enum** (`packages/script-gen/src/types.ts:91-102`, `777-789`):
The same 11 names are defined as both a TypeScript type and a Zod schema. **Adding new scene types requires updating both locations.**

### 2.4 Motion System

**File:** `apps/video-studio/src/hooks/useMotion.ts`

The `useMotion(config, segmentDurationFrames)` hook provides unified entrance/emphasis/exit animations:

| Phase | Types | Description |
|---|---|---|
| Entrance | `fade`, `slide`, `pop`, `scale`, `blur`, `none` | Triggers at segment start, configurable delay/duration/easing |
| Emphasis | `pulse`, `shake`, `glow`, `scale`, `underline`, `none` | Continuous during segment, configurable intensity |
| Exit | `fade`, `slide`, `shrink`, `blur`, `none` | Triggers before segment end, configurable startBeforeEnd/duration |

Easing options: `spring` (default), `easeOut`, `easeInOut`, `linear`

### 2.5 Theme System

**File:** `apps/video-studio/src/theme.ts`

```
CURRENT PALETTE:
  Primary:     #6366f1 (Indigo)     Light: #818cf8   Dark: #4f46e5
  Secondary:   #8b5cf6 (Violet)     Light: #a78bfa   Dark: #7c3aed
  Accent:      #06b6d4 (Cyan)       Light: #22d3ee   Dark: #0891b2
  Background:  #0f172a (Slate 900)  Light: #1e293b   Dark: #020617
  Text:        #f8fafc (Slate 50)   Secondary: #cbd5e1  Muted: #94a3b8
  Success:     #10b981   Warning: #f59e0b   Error: #ef4444
  Glow:        0 0 20px rgba(99, 102, 241, 0.5)

TYPOGRAPHY:
  Heading/Body: Inter, system fonts
  Monospace:    JetBrains Mono, Fira Code, Courier New
  Sizes:        xs(12) sm(14) base(16) lg(18) xl(20) 2xl(24) 3xl(30)
                4xl(36) 5xl(48) 6xl(60) 7xl(72) 8xl(96)
```

### 2.6 Audio Pipeline (Current)

#### TTS Generation
**Package:** `packages/tts/`

- **Provider chain:** Gemini 2.5 Pro TTS → Chirp 3 HD → WaveNet
- **Output format:** WAV (LINEAR16 PCM)
- **Sample rate:** 44100 Hz (hardcoded in all providers)
- **SSML support:** Phoneme tags for pronunciation control
- **Chunking:** Splits at sentence boundaries (~4000 chars), reopens SSML tags at chunk boundaries
- **Stitching:** Multi-chunk audio stitched with 200ms silence padding between segments
- **Normalization:** Scales to 90% of max amplitude to prevent clipping
- **WAV header parsing:** `packages/core/src/utils/wav-utils.ts` — `parseWavHeader()`, `calculateWavDuration()`, `getWavDuration()` (added in commit 8a11553 to fix duration calculation)

#### Timestamp Extraction
**Package:** `packages/timestamp-extraction/`

- **Provider:** Google Cloud Speech-to-Text API
- **Conversion:** Audio converted to 24kHz LINEAR16 mono for STT processing
- **Output:** `WordTiming[]` with `startTime`, `duration`, `confidence`, `isEmphasis`
- **Segment mapping:** `mapWordsToSegments()` aligns STT words to script segments
- **Fallback:** Character-weighted timing estimation at 140 WPM if STT mapping ratio < 80%
- **Enrichment:** `applyWordTimingsToSegments()` adds word timings to DirectionDocument

#### Audio Mixing
**Package:** `packages/audio-mixer/`

- **Engine:** FFmpeg via `ffmpeg-static`
- **Tracks:** Voice (primary) + background music (with ducking) + SFX
- **Voice Activity Detection:** FFmpeg `silencedetect` filter
- **Ducking:** Speech level -20dB, silence level -12dB, attack 50ms, release 300ms
- **Loudness normalization:** FFmpeg `loudnorm` targeting -16 LUFS / -6dBTP
- **Output:** 44100 Hz stereo WAV
- **Music selection:** By mood from direction document
- **SFX triggers:** From direction document segment metadata

#### Conversion Summary
```
TTS outputs 44.1kHz WAV → Audio Mixer stays at 44.1kHz stereo
                        → STT converts to 24kHz mono (for recognition only)
                        → VAD converts to 16kHz mono (for ducking detection only)
```

### 2.7 Visual Generation Pipeline

**Package:** `packages/visual-gen/`

- `SceneMapper` class (`scene-mapper.ts`): Keyword-based component mapping with LLM fallback (Gemini 3 Pro Preview), then LowerThird as final fallback
- `visual-cue-parser.ts`: Extracts `[VISUAL: ...]` cues from script text
- `timeline.ts`: Generates timeline JSON aligned to audio duration
- **Current state:** V2 direction document path exists but the code still uses V1 script-based flow (comment in `visual-gen.ts:80-81`: "still use existing script-based flow")
- Audio mixer is invoked from within visual-gen, not as a separate pipeline stage

### 2.8 Rendering Pipeline (Current)

**File:** `apps/render-service/src/render.ts`

1. Create temp directory
2. Start local Express file server for audio (Remotion requires HTTP URLs)
3. Download timeline JSON + audio WAV from Cloud Storage (parallel)
4. Bundle `apps/video-studio/src/index.ts` with webpack (aliasing server-only packages to `false`)
5. Select composition `TechExplainer` with `{ timeline, audioUrl }` props
6. `renderMedia()` with codec `h264`, 45-minute timeout, `enableMultiProcessOnLinux: true`
7. Quality gate: file size > 5MB for videos > 30s
8. Upload to `{pipelineId}/render/video.mp4` in Cloud Storage
9. Cleanup temp directory and file server

**Deployment:** Cloud Run via `cloudbuild-render.yaml`, Docker multi-stage build with esbuild bundling.

### 2.9 Type System

**File:** `packages/script-gen/src/types.ts` (canonical source)

Key types re-exported by `apps/video-studio/src/types.ts`:

```typescript
SegmentType = 'intro' | 'hook' | 'explanation' | 'case_study' | 'code_demo'
            | 'comparison' | 'example' | 'transition' | 'recap' | 'outro'

ComponentName = 'NeuralNetworkAnimation' | 'DataFlowDiagram' | 'ComparisonChart'
              | 'MetricsCounter' | 'ProductMockup' | 'CodeHighlight'
              | 'BrandedTransition' | 'LowerThird' | 'TextOnGradient'
              | 'KineticText' | 'BrowserFrame'

DirectionDocument { segments: DirectionSegment[]; metadata: DocumentMetadata }
DirectionSegment  { timing: SegmentTiming; visual: SegmentVisual; content: SegmentContent }
SegmentVisual     { template: ComponentName; templateProps: Record<string,unknown>; motion: MotionConfig }
SegmentTiming     { estimatedStartSec; estimatedDurationSec; actualStartSec?; actualDurationSec?; wordTimings?: WordTiming[] }
WordTiming        { startTime: number; duration: number; confidence: number; isEmphasis: boolean }
MotionConfig      { entrance: EntranceConfig; emphasis: EmphasisConfig; exit: ExitConfig }
```

### 2.10 Default Visual Template Mapping

**File:** `packages/script-gen/src/script-gen.ts:64`

```typescript
const DEFAULT_VISUAL_TEMPLATE: Record<SegmentType, ComponentName> = {
  intro:       'TextOnGradient',
  hook:        'KineticText',
  explanation: 'DataFlowDiagram',
  case_study:  'BrowserFrame',
  code_demo:   'CodeHighlight',
  comparison:  'ComparisonChart',
  example:     'MetricsCounter',
  transition:  'BrandedTransition',
  recap:       'TextOnGradient',
  outro:       'BrandedTransition',
};
```

### 2.11 Dependencies

| Package | Version | Purpose |
|---|---|---|
| remotion | 4.0.0 | Video composition framework |
| @remotion/bundler | 4.0.0 | Webpack bundling for render |
| @remotion/cli | 4.0.0 | `remotion studio` for dev |
| @remotion/renderer | 4.0.0 | `renderMedia()` for production |
| react | 18.2.0 | UI framework |
| zod | 3.22.0+ | Schema validation |
| ffmpeg-static | — | Audio processing |
| wavefile | — | WAV manipulation |
| @google-cloud/text-to-speech | — | WaveNet/Chirp TTS |
| @google-cloud/speech | — | STT for word timing |
| @google/generative-ai | — | Gemini TTS + LLM |

---

## 3. KNOWN BUGS

### 3.1 Audio Speed/Pitch Bug (P0 — CRITICAL)

**Symptom:** TTS audio plays back sped up in the final rendered video, sounds like a chipmunk.

**Likely Root Causes (investigate in order):**

1. **WAV header channel mismatch.** TTS providers may return mono audio (1 channel) but the stitching function in `packages/tts/src/audio-quality.ts` writes a stereo WAV header (2 channels). If the raw PCM data is mono but the header says stereo, the player reads samples at 2x speed.
   - **Check:** Run `ffprobe -v error -show_entries stream=channels,sample_rate,codec_name -of csv=p=0 audio.wav` on the raw TTS output and on the stitched output. Compare channel count.

2. **Sample rate mismatch between TTS output and Remotion expectations.** TTS outputs at 44100 Hz (`audio-quality.ts`). If any intermediate processing step (audio mixer, file copy) changes the data without updating the header, Remotion/FFmpeg will play at the wrong speed.
   - **Check:** `ffprobe` the audio file served by the render-service local file server. Confirm 44100 Hz.

3. **Audio mixer resampling artifact.** The mixer (`packages/audio-mixer/src/mix-pipeline.ts:236`) forces output to `-ar 44100 -ac 2`. If the voice track is mono, FFmpeg's `amix` filter may not handle the channel upmix correctly.
   - **Check:** Render a video WITHOUT audio mixing (voice-only, no music/SFX) and check if the bug persists.

4. **Duration mismatch.** The composition's `durationInFrames` is calculated from `metadata.estimatedDurationSec` (Direction Document mode) or `audioDurationSec` (Timeline mode). If this doesn't match the actual audio file duration, Remotion may stretch/compress the timeline.
   - **Check:** Compare `calculateTechExplainerMetadata()` output with `ffprobe -show_entries format=duration audio.wav`.

5. **FFmpeg render codec settings.** The `renderMedia()` call in `render.ts:186-199` does not explicitly set audio codec or sample rate. Remotion's default FFmpeg settings may resample.
   - **Check:** Add explicit audio settings: `audioBitrate: '192k'` or test with `audioCodec: 'aac'`.

**Investigation Steps:**

```bash
# Step 1: Check raw TTS output
ffprobe -v error -show_entries stream=channels,sample_rate,duration,codec_name \
  -of json /path/to/tts-output.wav

# Step 2: Check stitched output
ffprobe -v error -show_entries stream=channels,sample_rate,duration,codec_name \
  -of json /path/to/stitched-audio.wav

# Step 3: Check mixed output
ffprobe -v error -show_entries stream=channels,sample_rate,duration,codec_name \
  -of json /path/to/mixed-audio.wav

# Step 4: Check rendered video audio stream
ffprobe -v error -show_entries stream=channels,sample_rate,duration,codec_name \
  -select_streams a -of json /path/to/output.mp4

# Step 5: Compare durations
# TTS audio duration should match composition durationInFrames / 30
```

**Fix Verification:** Render a 30-second test clip and confirm:
- Speech sounds natural (not sped up, not slowed down)
- Word timing matches caption display
- Audio duration equals video duration

---

## 4. VISUAL QUALITY TARGETS

### 4.1 Reference Standard

The output should match the visual quality of top AI/tech YouTube channels (Fireship, ColdFusion, Two Minute Papers, The AI Grip):

- **Pacing:** No static frame held longer than 3-5 seconds. Every sentence should have a corresponding visual change.
- **Visual density:** A 10-minute video should have 120-200 distinct visual moments (one every 3-5 seconds).
- **Typography:** Key terms, stats, and quotes rendered as large animated text — not just subtitles.
- **Data visualization:** Stats and comparisons shown as animated charts, infographics, and callouts.
- **Brand imagery:** Company logos and product screenshots appear when mentioned.
- **Layered composition:** Every frame has depth — background (gradient/pattern), midground (main graphic), foreground (text overlays, accents).
- **Consistent identity:** Nexus AI brand colors, recurring motion templates, lower-thirds, intro/outro.

### 4.2 Color Palette (Nexus AI Brand — Target)

> The current theme (`theme.ts`) uses Indigo #6366f1 as primary. The target palette below shifts Cyan to primary for a more tech/broadcast aesthetic. Migration is Phase 2 in the roadmap.

```
Background:
  Deep dark:        #0a0e1a (darkest)
  Base:             #111827 (standard background)
  Elevated:         #1e293b (cards, panels)

Accent Primary:     #00d4ff (electric cyan)
  Glow:             rgba(0, 212, 255, 0.3) — 30% opacity for glows
  Bright:           #0ea5e9 (sky blue)

Accent Secondary:   #8b5cf6 (violet)
  Bright:           #a855f7 (purple)

Text:
  Primary:          #ffffff
  Secondary:        #94a3b8 (slate 400)
  Muted:            #64748b (slate 500)

Emphasis:
  Warning/emphasis: #f59e0b (amber)
  Success:          #10b981 (emerald)
  Error:            #ef4444 (red)

Gradients:
  Background:       linear-gradient(135deg, #0a0e1a, #111827, #0a0e1a)
  Accent:           linear-gradient(90deg, #00d4ff, #8b5cf6)
  Glow:             radial-gradient(circle, rgba(0,212,255,0.15), transparent)
```

**Rule:** Never use flat solid color backgrounds. Always use subtle gradients or noise textures.

### 4.3 Typography

| Use Case | Font | Weight | Size (at 1080p) |
|---|---|---|---|
| Headlines/emphasis | Inter / Geist | Bold (700) | 80-120px |
| Stats/numbers | JetBrains Mono | Bold (700) | 120-200px |
| Body/captions | Inter | Regular (400) | 48-64px |
| Labels/secondary | Inter | Medium (500) | 32-48px |
| Code | JetBrains Mono | Regular (400) | 28-36px |

**Minimum readable size:** 48px for body text at 1920x1080. Anything smaller will be illegible on mobile.

### 4.4 Frame Composition Rules

- **Safe zone:** 80px margin on all sides (no content closer to edge)
- **Lower third captions:** Positioned at Y = 75-85% of frame height
- **Centered content:** Use vertical center (Y = 40-60%) for primary visuals
- **Title cards:** Center both horizontally and vertically
- **Layering order (z-index):**
  1. Background gradient/pattern (z: 0)
  2. Ambient effects — particles, grid, etc. (z: 1)
  3. Main scene content (z: 2)
  4. Foreground overlays — captions, lower thirds (z: 3)
  5. Persistent UI — progress bar, watermark (z: 4)

### 4.5 Animation Principles

- **Duration:** Entrances 10-20 frames (0.33-0.66s), exits 8-15 frames
- **Easing:** Spring physics for entrances (Remotion `spring()`), ease-out for exits
- **Stagger:** When multiple items enter, stagger by 5-10 frames between items
- **Count-up numbers:** Animate over 20-30 frames using `interpolate()`
- **Text reveals:** Word-by-word with 3-5 frame gaps, or character-by-character for typewriter
- **No instant cuts:** Every scene transition should have at least a 5-frame crossfade or slide
- **Continuous motion:** Subtle ambient animation in every frame (floating particles, gradient shift, pulse effects)

---

## 5. SCENE SYSTEM ARCHITECTURE

### 5.1 Scene Types

Every video is composed of an ordered array of `Scene` objects. Each scene maps to a specific Remotion component.

```typescript
type SceneType =
  | 'intro'              // Nexus AI branded intro (2-3 seconds)
  | 'chapter-break'      // Section transition title card
  | 'narration-default'  // Standard frame with background + animated captions (fallback)
  | 'text-emphasis'      // Key phrase rendered large and animated on screen
  | 'full-screen-text'   // Single impactful sentence fills the frame
  | 'stat-callout'       // Big animated number with label
  | 'comparison'         // Side-by-side comparison (before/after, old/new)
  | 'diagram'            // Flowchart, process diagram, architecture diagram
  | 'logo-showcase'      // Company/product logos displayed when mentioned
  | 'timeline'           // Historical progression or roadmap
  | 'quote'              // Attributed quote with stylized rendering
  | 'list-reveal'        // Items revealed one by one with animation
  | 'code-block'         // Syntax-highlighted code or pseudo-code
  | 'outro';             // Subscribe CTA, branding, social links
```

### 5.2 Scene Interface

```typescript
interface Scene {
  id: string;                              // Unique ID (e.g., "scene-001")
  type: SceneType;                         // Determines which component renders
  startFrame: number;                      // First frame of this scene
  endFrame: number;                        // Last frame of this scene
  content: string;                         // The narration text for this segment
  visualData: VisualData;                  // Type-specific payload (see 5.3)
  transition?: 'cut' | 'fade' | 'slide';  // Transition to next scene (default: 'cut')
}
```

### 5.3 Visual Data Payloads

Each scene type has a specific payload shape. The `VisualData` type is a discriminated union on `SceneType`:

```typescript
// intro
interface IntroVisualData {
  episodeNumber?: number;
  episodeTitle?: string;
}

// chapter-break
interface ChapterBreakVisualData {
  title: string;
  subtitle?: string;
  chapterNumber?: number;
}

// narration-default
interface NarrationDefaultVisualData {
  backgroundVariant?: 'gradient' | 'particles' | 'grid';
}

// text-emphasis
interface TextEmphasisVisualData {
  phrase: string;
  highlightWords?: string[];
  style: 'fade' | 'slam' | 'typewriter';
}

// full-screen-text
interface FullScreenTextVisualData {
  text: string;
  alignment?: 'center' | 'left';
}

// stat-callout
interface StatCalloutVisualData {
  number: string;
  label: string;
  prefix?: string;           // e.g., "$"
  suffix?: string;           // e.g., "M", "%"
  countUp?: boolean;         // Animate from 0 to number
  comparison?: {             // Optional second stat for comparison mode
    number: string;
    label: string;
  };
}

// comparison
interface ComparisonVisualData {
  left: {
    title: string;
    items: string[];
  };
  right: {
    title: string;
    items: string[];
  };
}

// diagram
interface DiagramVisualData {
  nodes: Array<{
    id: string;
    label: string;
    icon?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
  }>;
  layout: 'horizontal' | 'vertical' | 'hub-spoke';
}

// logo-showcase
interface LogoShowcaseVisualData {
  logos: Array<{
    name: string;
    src?: string;             // URL or asset path; falls back to built-in asset library
  }>;
  layout: 'grid' | 'sequential';
}

// timeline
interface TimelineVisualData {
  events: Array<{
    year: string;
    label: string;
    description?: string;
  }>;
}

// quote
interface QuoteVisualData {
  text: string;
  attribution: string;
  role?: string;
}

// list-reveal
interface ListRevealVisualData {
  title?: string;
  items: string[];
  style: 'bullet' | 'numbered' | 'icon';
}

// code-block
interface CodeBlockVisualData {
  code: string;
  language?: string;
  highlightLines?: number[];
  filename?: string;
}

// outro
interface OutroVisualData {
  nextTopicTeaser?: string;
}
```

### 5.4 Scene Router

A central `SceneRouter` Remotion component replaces the current `COMPONENT_MAP` string lookup:

```typescript
// apps/video-studio/src/SceneRouter.tsx

interface SceneRouterProps {
  scenes: Scene[];
  audioUrl: string;
}

const SceneRouter: React.FC<SceneRouterProps> = ({ scenes, audioUrl }) => {
  // 1. Render audio at root level
  // 2. For each scene, wrap in <Sequence from={startFrame} durationInFrames={endFrame - startFrame}>
  // 3. Resolve scene.type to the correct component
  // 4. Pass scene.visualData as props
  // 5. Handle transitions between scenes (fade overlay sequences)
  // 6. Render AnimatedCaptions overlay spanning entire composition
};
```

**Scene Component Registry:**
```typescript
const SCENE_REGISTRY: Record<SceneType, React.FC<any>> = {
  'intro':             IntroSequence,
  'chapter-break':     ChapterBreak,
  'narration-default': NarrationDefault,
  'text-emphasis':     TextEmphasis,
  'full-screen-text':  FullScreenText,
  'stat-callout':      StatCallout,
  'comparison':        Comparison,
  'diagram':           Diagram,
  'logo-showcase':     LogoShowcase,
  'timeline':          Timeline,
  'quote':             Quote,
  'list-reveal':       ListReveal,
  'code-block':        CodeBlock,
  'outro':             OutroSequence,
};
```

### 5.5 Migration Path

The SceneRouter builds on the existing `mapSegmentToScene()` pattern in `TechExplainer.tsx`. Migration steps:

1. Define `Scene` type and `SceneType` enum in `apps/video-studio/src/types/scenes.ts`
2. Create `SceneRouter.tsx` that uses a type-safe registry instead of `COMPONENT_MAP`
3. Update `TechExplainer.tsx` to delegate to `SceneRouter` in Direction Document mode
4. Keep legacy timeline mode working (backward compatibility) until render-service migrates
5. Update `ComponentNameSchema` in `packages/script-gen/src/types.ts` to include new scene types

---

## 6. COMPONENT SPECIFICATIONS

> Each component specification below includes: purpose, duration, content, animation behavior, and relationship to existing components.

### 6.1 IntroSequence

**New component.** No current equivalent.

- **Duration:** 60-90 frames (2-3 seconds at 30fps)
- **Content:** Nexus AI logo, optional episode number and title
- **Animation:**
  - Logo scales from 0.8 → 1.0 with spring physics, simultaneous opacity 0 → 1
  - Subtle cyan glow pulse behind logo (radial gradient, opacity oscillates 0.2-0.5)
  - Episode title fades in 15 frames after logo (if provided)
  - Background: Dark gradient with subtle particle drift
- **Audio:** Optional subtle whoosh sound effect (from SFX library)
- **Props:**
  ```typescript
  interface IntroSequenceProps {
    episodeNumber?: number;
    episodeTitle?: string;
  }
  ```

### 6.2 ChapterBreak

**Evolves from:** `BrandedTransition` (reuse wipe/fade animation logic)

- **Duration:** 60-90 frames (2-3 seconds)
- **Content:** Chapter title centered, optional subtitle, optional chapter number
- **Animation:**
  - Background shifts to slightly elevated shade (#1e293b)
  - Thin horizontal accent line (2px, cyan) animates outward from center to 60% width
  - Title fades in with spring (scale 0.95 → 1.0, opacity 0 → 1)
  - Chapter number (if present) appears above title in muted text
  - All elements fade out over last 15 frames
- **Props:**
  ```typescript
  interface ChapterBreakProps {
    title: string;
    subtitle?: string;
    chapterNumber?: number;
  }
  ```

### 6.3 NarrationDefault

**New component.** Replaces scenarios where `TextOnGradient` or `LowerThird` was used as fallback.

- **Purpose:** The fallback scene type when no special visual is assigned. Provides visual interest without specific data.
- **Background:** Animated gradient (slow 135-degree rotation over scene duration) or subtle particle system. **Never static black.**
- **Content:** No primary visual — relies on AnimatedCaptions overlay for text
- **Variants:**
  - `gradient`: Slow-shifting dark gradient with depth layers
  - `particles`: Floating geometric shapes (circles, lines) at low opacity
  - `grid`: Subtle dot grid pattern with occasional highlight pulse
- **Props:**
  ```typescript
  interface NarrationDefaultProps {
    backgroundVariant?: 'gradient' | 'particles' | 'grid';
  }
  ```

### 6.4 TextEmphasis

**Evolves from:** `TextOnGradient` (reuse gradient background) + `KineticText` (reuse word animation)

- **Purpose:** Key phrase rendered at 80-120px bold, centered. Used for impactful one-liners.
- **Animation styles:**
  - `fade`: Scale 0.9 → 1.0 with spring physics, opacity 0 → 1, over 15 frames
  - `slam`: Scale 1.3 → 1.0 with bounce spring (damping: 8), opacity instant (1 from frame 0)
  - `typewriter`: Characters appear one by one left-to-right, 2 frames per character
- **Highlight words:** Specific words rendered in accent color (cyan #00d4ff). Determined by `highlightWords` array.
- **Background:** Subtle radial gradient or vignette behind text (not the full gradient of TextOnGradient)
- **Props:**
  ```typescript
  interface TextEmphasisProps {
    phrase: string;
    highlightWords?: string[];
    style: 'fade' | 'slam' | 'typewriter';
  }
  ```

### 6.5 FullScreenText

**Evolves from:** `TextOnGradient` (split — this handles full-sentence display)

- **Purpose:** Single impactful sentence fills 60-80% of frame width. Multi-line if needed.
- **Text:** Large bold (72-96px), max 2-3 lines
- **Animation:** Staggered word reveal — each word fades in with 3-5 frame offset from the previous
- **Background:** Darkened with radial vignette. Optional subtle blur effect.
- **Alignment:** Center (default) or left-aligned
- **Props:**
  ```typescript
  interface FullScreenTextProps {
    text: string;
    alignment?: 'center' | 'left';
  }
  ```

### 6.6 StatCallout

**Evolves from:** `MetricsCounter` (upgrade with prefix/suffix, comparison mode)

- **Purpose:** Big animated number (120-200px bold mono) with label and optional count-up.
- **Animation:**
  - Number count-up from 0 to target over 25-30 frames using `interpolate()`
  - Number formatted with locale separators (e.g., "2,300,000")
  - Prefix/suffix rendered adjacent to number in same style
  - Subtle glow effect on the number (cyan radial gradient, 30% opacity)
  - Label appears below number in secondary text (32-48px)
- **Comparison mode:** Two stats side by side with "vs" divider or directional arrow
  - Left stat slightly smaller, right stat full size
  - Arrow animates between them
- **Background:** Radial gradient emanating from the number center
- **Props:**
  ```typescript
  interface StatCalloutProps {
    number: string;
    label: string;
    prefix?: string;
    suffix?: string;
    countUp?: boolean;
    comparison?: {
      number: string;
      label: string;
    };
  }
  ```

### 6.7 Comparison

**Evolves from:** `ComparisonChart` (redesign from bar chart to side-by-side panels)

- **Purpose:** Split-screen comparison: left panel vs right panel, each with title and bullet items.
- **Layout:** Vertical divider at center (thin line, 1px, accent color) or diagonal split
- **Left panel:** Red/warm tint (#ef4444 at 5% opacity background). Title + items.
- **Right panel:** Cyan/green tint (#10b981 at 5% opacity background). Title + items.
- **Labels:** "Before" / "After", "Traditional" / "AI-Native", or custom from data
- **Animation:** Items reveal one by one with stagger (10-15 frames between items), alternating left-right
- **Props:**
  ```typescript
  interface ComparisonProps {
    left: { title: string; items: string[] };
    right: { title: string; items: string[] };
  }
  ```

### 6.8 Diagram

**Evolves from:** `DataFlowDiagram` (redesign for multi-layout support)

- **Purpose:** Flowchart, process diagram, or architecture diagram with nodes and edges.
- **Node rendering:** Rounded rectangles (border-radius: 12px), thin cyan border (1px), dark fill (#1e293b)
- **Edge rendering:** Animated lines/arrows drawing from source to target node. Thin (2px), accent color.
- **Layout modes:**
  - `horizontal`: Nodes left-to-right, evenly spaced
  - `vertical`: Nodes top-to-bottom, evenly spaced
  - `hub-spoke`: Central node with radiating connections
- **Animation:**
  - Nodes appear one by one with spring entrance (scale 0 → 1), staggered by 8 frames
  - After all nodes visible, connections draw sequentially (10 frames per edge)
  - Subtle glow on active connection during draw
- **Capacity:** Must comfortably fit 3-8 nodes at 1920x1080
- **Props:**
  ```typescript
  interface DiagramProps {
    nodes: Array<{ id: string; label: string; icon?: string }>;
    edges: Array<{ from: string; to: string; label?: string }>;
    layout: 'horizontal' | 'vertical' | 'hub-spoke';
  }
  ```

### 6.9 LogoShowcase

**New component.** No direct current equivalent.

- **Purpose:** Display company/product logos when mentioned in narration.
- **Grid mode:** 2-6 logos arranged in a responsive grid (2x2, 2x3, or 3x2), all visible simultaneously
- **Sequential mode:** Logos appear one at a time with fade transition, 30-45 frames per logo
- **Style:** Logos rendered white/grayscale on dark background for visual consistency
- **Asset library:** Pre-built mapping for common tech companies:
  ```
  OpenAI, Anthropic, Google, Microsoft, NVIDIA, Meta, Apple, Amazon,
  Salesforce, Slack, Atlassian, Notion, Confluence, HubSpot, Zendesk,
  Asana, Klarna, Sierra, Cognition Labs, Figma, Vercel, Stripe
  ```
- **Fallback:** If logo asset not found, render company name as large styled text
- **Props:**
  ```typescript
  interface LogoShowcaseProps {
    logos: Array<{ name: string; src?: string }>;
    layout: 'grid' | 'sequential';
  }
  ```

### 6.10 Timeline

**New component.** No current equivalent.

- **Purpose:** Historical progression, roadmap, or sequence of dated events.
- **Layout:** Horizontal timeline with a thin line (2px, accent) running left to right
- **Markers:** Circular dots (12px) at each event position along the line
- **Animation:**
  - Line draws left to right over the first 30 frames
  - Event markers appear sequentially (spring pop, 8-frame stagger)
  - Year/date label above marker, description below
  - Current/highlighted event: Filled dot in accent color, others outlined
- **Props:**
  ```typescript
  interface TimelineProps {
    events: Array<{
      year: string;
      label: string;
      description?: string;
    }>;
  }
  ```

### 6.11 Quote

**New component.** No current equivalent.

- **Purpose:** Attributed quote with decorative styling.
- **Layout:**
  - Large decorative quotation marks (200px, accent color at 15% opacity) top-left
  - Quote text centered, 48-64px, italic or light weight (300)
  - Attribution below: "— Name" in secondary text, optional role/title on next line
- **Background:** Slightly elevated panel (#1e293b) with subtle border-left (3px accent)
- **Animation:**
  - Quotation marks fade in first (10 frames)
  - Text fades in with slight upward drift (15 frames)
  - Attribution fades in last (10 frames after text)
- **Props:**
  ```typescript
  interface QuoteProps {
    text: string;
    attribution: string;
    role?: string;
  }
  ```

### 6.12 ListReveal

**New component.** No current equivalent.

- **Purpose:** Items revealed one by one with animation. Used for lists, steps, features.
- **Layout:** Title at top (optional), items stacked vertically with 16px spacing
- **Item rendering:** Bullet/number/icon on left, text on right
- **Animation:**
  - Items slide in from right (translateX 40 → 0) with spring, staggered 10-15 frames apart
  - Active (most recently revealed) item: Full opacity, accent color bullet
  - Previous items: Slightly dimmed (opacity 0.7)
  - Title enters first, then items sequentially
- **Styles:**
  - `bullet`: Cyan filled circle (8px) as bullet
  - `numbered`: Cyan numbers (1, 2, 3...) in mono font
  - `icon`: Placeholder icon (circle with number) — extensible to real icons
- **Props:**
  ```typescript
  interface ListRevealProps {
    title?: string;
    items: string[];
    style: 'bullet' | 'numbered' | 'icon';
  }
  ```

### 6.13 CodeBlock

**Evolves from:** `CodeHighlight` (upgrade with VS Code dark aesthetic)

- **Purpose:** Syntax-highlighted code or pseudo-code in a code editor frame.
- **Frame:** Dark editor background (#1e1e2e), top bar with filename/language label, line numbers in gutter
- **Syntax highlighting:** Regex-based (reuse existing from `CodeHighlight`):
  - Keywords: Purple (#c678dd)
  - Strings: Green (#98c379)
  - Comments: Gray (#5c6370)
  - Numbers: Yellow (#e5c07b)
  - Functions: Blue (#61afef)
- **Animation modes:**
  - Typewriter: Characters appear left-to-right, configurable speed (default 30 chars/sec)
  - Sequential highlight: Lines appear one by one with fade
- **Highlighted lines:** Background accent color at 10% opacity + left border (3px accent)
- **Cursor:** Blinking cursor in typewriter mode (toggle every 15 frames)
- **Props:**
  ```typescript
  interface CodeBlockProps {
    code: string;
    language?: string;
    highlightLines?: number[];
    filename?: string;
  }
  ```

### 6.14 AnimatedCaptions (Overlay Component)

**Evolves from:** `KineticText` — refactored from scene-level component to persistent overlay.

> This is NOT a scene type. It is rendered as a separate `<Sequence>` layer spanning the entire composition, on top of all scenes.

- **Purpose:** Word-level synchronized captions with the currently spoken word highlighted.
- **Position:** Horizontally centered, lower third of frame (Y = 78% of height)
- **Backdrop:** Subtle dark gradient behind text (not a hard rectangle). `background: linear-gradient(transparent, rgba(0,0,0,0.6))` spanning bottom 30% of frame.
- **Word display:** Max 12-15 words visible at once. Words grouped into caption chunks by sentence/clause breaks.
- **Highlighting:**
  - Currently spoken word: Accent color (#00d4ff), bold weight
  - Surrounding words: White (#ffffff), regular weight
  - Already-spoken words in current group: Slightly dimmed (#94a3b8)
- **Transitions:** Smooth fade between caption groups (5-frame crossfade)
- **Timing source:** `WordTiming[]` from DirectionDocument segments (via STT or estimated)
- **Architecture change:** Currently `KineticText` is used as a scene in a `<Sequence>`. The refactored `AnimatedCaptions` must be a separate layer:
  ```tsx
  // In SceneRouter or TechExplainer:
  <>
    <Audio src={audioUrl} />
    {/* Scene sequences */}
    {scenes.map(scene => <Sequence ...><SceneComponent /></Sequence>)}
    {/* Caption overlay — spans entire composition */}
    <Sequence from={0} durationInFrames={totalDuration}>
      <AnimatedCaptions wordTimings={allWordTimings} />
    </Sequence>
  </>
  ```

### 6.15 OutroSequence

**New component.** No current equivalent (BrandedTransition partially covers this).

- **Duration:** 150-240 frames (5-8 seconds)
- **Content:**
  - "Subscribe" CTA button/text (animated entrance)
  - Nexus AI logo (centered)
  - Social links row (icons for YouTube, Twitter/X, website)
  - Optional: "Next video" teaser text
- **Animation:**
  - Background darkens to #0a0e1a
  - Logo fades in first (15 frames)
  - "Subscribe" text slides up from below (spring, 20 frames after logo)
  - Social links fade in as a row (10 frames after subscribe)
  - Subtle particle ambient effect throughout
- **Props:**
  ```typescript
  interface OutroSequenceProps {
    nextTopicTeaser?: string;
  }
  ```

### 6.16 Shared Sub-Components

These are reusable building blocks used across multiple scene components:

| Component | File | Used By | Purpose |
|---|---|---|---|
| `AnimatedText` | `shared/AnimatedText.tsx` | TextEmphasis, FullScreenText, ChapterBreak | Text with configurable entrance animation |
| `GlowEffect` | `shared/GlowEffect.tsx` | StatCallout, IntroSequence, Diagram | Radial glow layer with configurable color/opacity |
| `CountUpNumber` | `shared/CountUpNumber.tsx` | StatCallout | Animated number interpolation with formatting |
| `DrawingLine` | `shared/DrawingLine.tsx` | Diagram, Timeline, ChapterBreak | SVG line that draws from start to end over N frames |
| `BackgroundGradient` | `shared/BackgroundGradient.tsx` | All scenes | Configurable animated gradient background layer |

---

## 7. DIRECTOR AGENT SPECIFICATION

The Director Agent is an LLM-powered function that takes a raw script and produces the `Scene[]` array. It replaces the current keyword-based `SceneMapper` in `packages/visual-gen/src/scene-mapper.ts`.

### 7.1 Input

```typescript
interface DirectorInput {
  script: string;                    // Full video script (plain text)
  wordTimings: WordTiming[];         // Word-level timestamps from TTS/STT
  metadata: {
    title: string;
    episodeNumber?: number;
    topic: string;
  };
}
```

### 7.2 Process

1. **Segment the script** into logical sections:
   - Introduction / hook
   - Chapter / topic transitions
   - Key points and arguments
   - Case studies and examples
   - Conclusion / recap

2. **Classify each segment** into a scene type based on content analysis:

   | Content Signal | Scene Type |
   |---|---|
   | Specific numbers, stats, percentages | `stat-callout` |
   | Company or product names | `logo-showcase` |
   | Process descriptions, architectures, flows | `diagram` |
   | Rhetorical questions, powerful statements | `text-emphasis` or `full-screen-text` |
   | Before/after, old/new, pros/cons | `comparison` |
   | Enumerated items, feature lists, steps | `list-reveal` |
   | Historical context, year references, roadmaps | `timeline` |
   | Attributed quotes, someone said | `quote` |
   | Code, API examples, technical syntax | `code-block` |
   | Section/topic transitions | `chapter-break` |
   | Everything else (pure narration) | `narration-default` |

3. **Generate visualData** for each scene based on content extraction:
   - Extract the relevant data (numbers, names, items) from the narration text
   - Format into the appropriate `VisualData` payload shape

4. **Calculate timing** — map segments to frame ranges using word timestamps:
   - Find the first word of each segment in `wordTimings`
   - Scene `startFrame = Math.round(firstWord.startTime * 30)`
   - Scene `endFrame = Math.round(lastWord.startTime + lastWord.duration) * 30)`

5. **Assign transitions** — default `cut` between same-type scenes, `fade` between different types

### 7.3 Output

```typescript
interface DirectorOutput {
  scenes: Scene[];
  metadata: {
    totalScenes: number;
    sceneTypeDistribution: Record<SceneType, number>;
    averageSceneDuration: number;  // in seconds
  };
}
```

### 7.4 Director Rules

These rules are enforced by validation after LLM output:

1. **No long holds:** No single scene longer than 8-10 seconds (240-300 frames). Split long segments.
2. **Visual variety:** Every 2-3 sentences should trigger a new scene.
3. **Minimize fallback:** `narration-default` should be < 20% of total scenes. Prefer specific types.
4. **Stats are mandatory:** Any mention of a number/stat MUST get `stat-callout` treatment.
5. **Logos are mandatory:** Company name mentions MUST trigger `logo-showcase`.
6. **Bookend:** First scene is always `intro`, last scene is always `outro`.
7. **Chapter breaks:** Insert at major topic transitions (detected by section headers or topic shifts).
8. **No repetition:** Never use the same scene type 3 times in a row.
9. **Minimum scenes:** A 10-minute video should produce 40-60 scenes.

### 7.5 LLM Prompt Strategy

The Director Agent uses a structured prompt with:
- System prompt defining the role, scene types, and rules
- User message containing the script text and word timings
- Output format: JSON array conforming to `Scene[]` schema
- Temperature: 0.3 (low creativity, high consistency)
- Model: Gemini 3 Pro Preview (or equivalent)

### 7.6 Current State vs Target

| Aspect | Current (`SceneMapper`) | Target (Director Agent) |
|---|---|---|
| Classification | Keyword regex matching | LLM content analysis |
| Fallback | LowerThird for everything | narration-default (< 20%) |
| Data extraction | None (template props empty) | Full visualData generation |
| Scene types | 11 (mapped to components) | 14 (typed scene system) |
| Timing | From visual cues in script | From word-level timestamps |
| Validation | None | Rule enforcement + quality gate |

---

## 8. AUDIO PIPELINE SPECIFICATION

### 8.1 TTS Generation

**Current provider chain:** Gemini 2.5 Pro TTS → Chirp 3 HD → WaveNet

| Setting | Value |
|---|---|
| Output format | WAV (LINEAR16 PCM) |
| Sample rate | 44100 Hz |
| Channels | Mono (from provider), may be stitched as stereo |
| Encoding | 16-bit signed integer |
| SSML support | Yes (phoneme tags for pronunciation) |
| Speaking rate | 0.9-1.1x normal |
| Pitch adjustment | -20 to +20 range |
| Chunking | ~4000 chars at sentence boundaries |
| Retry | 3 attempts with exponential backoff |

**Required output properties:**
- Word-level timestamps must be generated alongside audio for caption sync
- Audio duration must be calculable from WAV header (not estimated from word count)
- All chunks must be stitched at the SAME sample rate and channel count

### 8.2 Audio Integration with Remotion

**Critical requirements:**

1. The audio file served to Remotion MUST have a correct WAV header matching its actual PCM data
2. The composition's `durationInFrames` MUST be calculated from the actual audio file duration:
   ```
   durationInFrames = Math.ceil(actualAudioDurationSec * fps)
   ```
3. Never trust calculated duration from word count or estimated timing — always use the actual file
4. The render service must preserve the source audio sample rate — no implicit resampling
5. When using `<Audio src={url} />` in Remotion, the URL must be HTTP (not `file://`)

### 8.3 Audio Quality Targets

- Natural speech pace — not sped up or slowed down
- Clear pronunciation with appropriate pauses (200ms silence padding between chunks)
- Loudness normalized to -16 LUFS with -6dBTP peak
- Background music ducked to -20dB during speech, -12dB during silence
- Target: sounds like a professional YouTube narrator, not robotic

### 8.4 Sample Rate Consistency

All audio processing must maintain consistent sample rates:

```
TTS Output:          44100 Hz WAV
Audio Stitching:     44100 Hz WAV (same as input)
Audio Mixing:        44100 Hz stereo WAV (output)
Render Service:      Serves 44100 Hz file to Remotion
Remotion Render:     Encodes audio at source sample rate

STT Processing:      24000 Hz mono (SEPARATE conversion, not in main audio path)
VAD Processing:      16000 Hz mono (SEPARATE conversion, not in main audio path)
```

The STT and VAD conversions are for analysis only and do not affect the audio file used for rendering.

---

## 9. RENDERING PIPELINE

### 9.1 Local Development

```bash
# Start Remotion Studio for interactive preview
pnpm --filter @nexus-ai/video-studio dev
# Opens http://localhost:3000 with Remotion Studio UI
```

- **Resolution:** 1920x1080 (16:9)
- **FPS:** 30
- **Preview duration:** 9000 frames (5 minutes) default, dynamic from props
- **Quick preview:** Use Remotion Studio's built-in preview (renders in real-time)

### 9.2 Production (Google Cloud Run)

**File:** `apps/render-service/src/render.ts`

| Setting | Value |
|---|---|
| Resolution | 1920x1080 |
| FPS | 30 |
| Codec | H.264 |
| Output | MP4 |
| Timeout | 45 minutes |
| Chromium | `enableMultiProcessOnLinux: true` |
| Quality gate | File size > 5MB (videos > 30s) |
| Output path | `{pipelineId}/render/video.mp4` in GCS |

**Build:** Docker multi-stage with esbuild bundling (`cloudbuild-render.yaml`)

### 9.3 Test Renders

The system must support:

1. **Single scene isolation:** Render one scene type in isolation for visual testing
   ```bash
   # Render only frames 100-200
   npx remotion render TechExplainer --frames=100-200 out/test.mp4
   ```

2. **Quick test clip:** Render a 10-second sample (300 frames)
   ```bash
   pnpm run render:test
   ```

3. **Full preview at lower quality:** 720p render for faster iteration
   ```bash
   npx remotion render TechExplainer --height=720 --width=1280 out/preview.mp4
   ```

### 9.4 Render Service Migration (V1 → V2)

**Current state:** Render service downloads `timeline.json` and passes as `{ timeline, audioUrl }` to the TechExplainer composition.

**Target state:** Render service downloads `direction-document.json` and passes as `{ directionDocument, audioUrl }`. The SceneRouter inside TechExplainer handles scene resolution.

**Migration steps:**

1. Update `RenderInput` interface to accept either `timelineUrl` or `directionDocumentUrl`
2. Update `selectComposition()` and `renderMedia()` calls to pass the appropriate props
3. Update `visual-gen.ts` to upload the direction document (not just timeline) for the render service
4. Add `calculateTechExplainerMetadata` support for direction document duration using actual audio duration
5. Keep backward compatibility: if `timelineUrl` is provided, use legacy mode

---

## 10. IMPLEMENTATION ROADMAP

Each phase is designed to be a separate Claude Code session. Each phase ends with a working test render. Each phase is committed before moving to the next.

### Phase 0: Fix Audio Bug (P0)

**Goal:** Resolve the audio speed/pitch issue described in Section 3.

- Investigate WAV header channel count in TTS stitching
- Verify sample rate consistency through the pipeline
- Add `ffprobe` diagnostic logging to render service
- Test with a 30-second clip — confirm natural speech speed
- **Files:** `packages/tts/src/audio-quality.ts`, `apps/render-service/src/render.ts`
- **Verification:** Render a test clip, listen to confirm natural pace

### Phase 1: Scene System + SceneRouter + Scene Schema

**Goal:** Implement the type-safe scene system that all future phases build on.

- Define `SceneType`, `Scene`, `VisualData` types in `apps/video-studio/src/types/scenes.ts`
- Create `SceneRouter.tsx` with the scene registry
- Update `TechExplainer.tsx` to delegate to SceneRouter in direction document mode
- Update `ComponentNameSchema` in `packages/script-gen/src/types.ts`
- Implement `NarrationDefault` as the baseline scene component
- **Files:** New `types/scenes.ts`, new `SceneRouter.tsx`, new `scenes/NarrationDefault.tsx`, update `TechExplainer.tsx`, update `packages/script-gen/src/types.ts`
- **Verification:** Render a video using SceneRouter with NarrationDefault fallback for all scenes

### Phase 2: TextEmphasis + FullScreenText Components

**Goal:** Build the two most impactful text-based scene types.

- Implement `TextEmphasis` with fade/slam/typewriter animations
- Implement `FullScreenText` with staggered word reveal
- Create shared `AnimatedText` sub-component
- Create shared `BackgroundGradient` sub-component
- Register both in SceneRouter
- **Files:** New `scenes/TextEmphasis.tsx`, `scenes/FullScreenText.tsx`, `shared/AnimatedText.tsx`, `shared/BackgroundGradient.tsx`
- **Verification:** Render a test with TextEmphasis (all 3 styles) and FullScreenText scenes

### Phase 3: StatCallout + AnimatedCaptions Upgrade

**Goal:** Build the stat display component and refactor captions to overlay.

- Implement `StatCallout` with count-up, prefix/suffix, comparison mode
- Create shared `CountUpNumber` and `GlowEffect` sub-components
- Refactor `KineticText` → `AnimatedCaptions` as an overlay layer
- Wire AnimatedCaptions into SceneRouter as a persistent overlay
- **Files:** New `scenes/StatCallout.tsx`, `shared/CountUpNumber.tsx`, `shared/GlowEffect.tsx`, new `overlays/AnimatedCaptions.tsx`, update `SceneRouter.tsx`
- **Verification:** Render a test with StatCallout scenes and word-synced caption overlay

### Phase 4: Diagram + Comparison Components

**Goal:** Build the data visualization scene types.

- Implement `Diagram` with horizontal/vertical/hub-spoke layouts
- Implement `Comparison` with side-by-side panels
- Create shared `DrawingLine` sub-component for animated SVG lines
- Register both in SceneRouter
- **Files:** New `scenes/Diagram.tsx`, `scenes/Comparison.tsx`, `shared/DrawingLine.tsx`
- **Verification:** Render a test with Diagram (all 3 layouts) and Comparison scenes

### Phase 5: LogoShowcase + Asset Library

**Goal:** Build the logo display system with pre-built tech company assets.

- Implement `LogoShowcase` with grid and sequential modes
- Create `packages/asset-library/` with logos, fonts, icons
- Source/create white/grayscale logos for top 20+ tech companies
- Implement fallback text rendering for unknown companies
- **Files:** New `scenes/LogoShowcase.tsx`, new `packages/asset-library/`
- **Verification:** Render a test with LogoShowcase showing 6 company logos

### Phase 6: ChapterBreak + Timeline + ListReveal + Quote + CodeBlock

**Goal:** Build the remaining scene types.

- Implement `ChapterBreak` (evolve from BrandedTransition)
- Implement `Timeline` with horizontal layout and event markers
- Implement `ListReveal` with bullet/numbered/icon styles
- Implement `Quote` with decorative quotation marks
- Implement `CodeBlock` (evolve from CodeHighlight, VS Code aesthetic)
- Register all in SceneRouter
- **Files:** New `scenes/ChapterBreak.tsx`, `scenes/Timeline.tsx`, `scenes/ListReveal.tsx`, `scenes/Quote.tsx`, `scenes/CodeBlock.tsx`
- **Verification:** Render a test exercising all 5 new scene types

### Phase 7: Intro/Outro Sequences

**Goal:** Build the branded bookend sequences.

- Implement `IntroSequence` with Nexus AI logo animation
- Implement `OutroSequence` with subscribe CTA and social links
- Create/source Nexus AI logo assets (SVG + PNG)
- Configure SFX triggers for intro whoosh
- **Files:** New `scenes/IntroSequence.tsx`, `scenes/OutroSequence.tsx`
- **Verification:** Render a full video with intro → content → outro

### Phase 8: Director Agent (LLM-Powered Scene Classification)

**Goal:** Replace keyword-based SceneMapper with intelligent scene classification.

- Create `packages/director-agent/` package
- Implement script segmentation logic
- Implement LLM-based scene type classification with visualData extraction
- Implement validation rules (Section 7.4)
- Implement timing calculation from word timestamps
- Wire into visual-gen pipeline replacing SceneMapper
- **Files:** New `packages/director-agent/src/` (index.ts, scriptParser.ts, sceneClassifier.ts, prompts/director.ts)
- **Verification:** Run Director Agent on a real 10-minute script, verify 40-60 well-classified scenes

### Phase 9: End-to-End Integration Testing

**Goal:** Full pipeline test with real scripts.

- Test the complete flow: script → Director Agent → scene generation → audio sync → render
- Validate caption sync accuracy (word timings match audio)
- Validate visual variety (rule compliance from Section 7.4)
- Performance testing: measure render time for 10-minute videos
- Fix any integration issues discovered
- **Verification:** Successfully render a full 8-12 minute video from a real script

### Phase 10: Production Deployment to Cloud Run

**Goal:** Deploy the upgraded system to production.

- Update render service for V2 direction document input (Section 9.4)
- Update `visual-gen.ts` to use Director Agent output
- Update Docker builds and Cloud Build configs
- Update theme to target color palette (Section 4.2)
- Migrate legacy pipeline stages
- Production test render
- **Verification:** End-to-end production pipeline produces a broadcast-quality video

---

## 11. EXAMPLE: SCRIPT-TO-SCENES MAPPING

Below is an example of how the Director Agent should process script segments. Each segment shows the input narration text, the assigned scene type, and the generated visualData.

---

**Segment 1:**
> "For the last twenty years, the formula for building a billion-dollar technology company was incredibly consistent."

- **Scene type:** `text-emphasis`
- **Visual data:**
  ```json
  {
    "phrase": "The formula was incredibly consistent",
    "highlightWords": ["formula", "consistent"],
    "style": "fade"
  }
  ```

---

**Segment 2:**
> "You find a business problem, build a cloud-hosted tool to solve it, wrap it in a slick user interface, and charge a monthly subscription fee."

- **Scene type:** `list-reveal`
- **Visual data:**
  ```json
  {
    "items": [
      "Find a business problem",
      "Build a cloud-hosted tool",
      "Wrap it in a slick UI",
      "Charge a monthly subscription"
    ],
    "style": "numbered"
  }
  ```

---

**Segment 3:**
> "This is the B2B SaaS model. It is the economic engine that powered Silicon Valley from the dot-com crash straight through to 2023."

- **Scene type:** `text-emphasis`
- **Visual data:**
  ```json
  {
    "phrase": "The B2B SaaS Model",
    "highlightWords": ["SaaS"],
    "style": "slam"
  }
  ```

---

**Segment 4:**
> "We are entering the era of Service as a Software — selling outcomes that replace the human entirely."

- **Scene type:** `comparison`
- **Visual data:**
  ```json
  {
    "left": {
      "title": "Software as a Service",
      "items": ["Sell tools to humans", "Per-seat pricing", "GUI-dependent"]
    },
    "right": {
      "title": "Service as a Software",
      "items": ["Sell outcomes", "Per-outcome pricing", "API-native, no GUI"]
    }
  }
  ```

---

**Segment 5:**
> "Think about giants like Salesforce, Slack, or Atlassian."

- **Scene type:** `logo-showcase`
- **Visual data:**
  ```json
  {
    "logos": [
      { "name": "Salesforce" },
      { "name": "Slack" },
      { "name": "Atlassian" }
    ],
    "layout": "sequential"
  }
  ```

---

**Segment 6:**
> "The AI assistant performed the work of 700 full-time human agents."

- **Scene type:** `stat-callout`
- **Visual data:**
  ```json
  {
    "number": "700",
    "label": "full-time agents replaced",
    "countUp": true
  }
  ```

---

**Segment 7:**
> "It handled 2.3 million conversations — two-thirds of their total volume."

- **Scene type:** `stat-callout`
- **Visual data:**
  ```json
  {
    "number": "2.3M",
    "label": "conversations handled by AI",
    "suffix": " conversations",
    "countUp": true
  }
  ```

---

**Director output for this example would be approximately 7 scenes covering ~45 seconds of narration.** A full 10-minute video should produce **40-60 scenes** following this same pattern, ensuring no visual is held for more than 8-10 seconds.

---

## 12. FILE STRUCTURE TARGET

```
nexus-ai/
├── apps/
│   ├── video-studio/                      # Remotion video composition project
│   │   ├── src/
│   │   │   ├── compositions/
│   │   │   │   └── TechExplainer.tsx      # Root composition (delegates to SceneRouter)
│   │   │   ├── components/
│   │   │   │   ├── scenes/                # One file per scene type (14 components)
│   │   │   │   │   ├── IntroSequence.tsx
│   │   │   │   │   ├── ChapterBreak.tsx
│   │   │   │   │   ├── NarrationDefault.tsx
│   │   │   │   │   ├── TextEmphasis.tsx
│   │   │   │   │   ├── FullScreenText.tsx
│   │   │   │   │   ├── StatCallout.tsx
│   │   │   │   │   ├── Comparison.tsx
│   │   │   │   │   ├── Diagram.tsx
│   │   │   │   │   ├── LogoShowcase.tsx
│   │   │   │   │   ├── Timeline.tsx
│   │   │   │   │   ├── Quote.tsx
│   │   │   │   │   ├── ListReveal.tsx
│   │   │   │   │   ├── CodeBlock.tsx
│   │   │   │   │   └── OutroSequence.tsx
│   │   │   │   ├── overlays/              # Persistent overlay layers
│   │   │   │   │   └── AnimatedCaptions.tsx
│   │   │   │   ├── shared/                # Reusable sub-components
│   │   │   │   │   ├── AnimatedText.tsx
│   │   │   │   │   ├── GlowEffect.tsx
│   │   │   │   │   ├── CountUpNumber.tsx
│   │   │   │   │   ├── DrawingLine.tsx
│   │   │   │   │   └── BackgroundGradient.tsx
│   │   │   │   └── legacy/                # Existing components (deprecated during migration)
│   │   │   │       ├── NeuralNetworkAnimation.tsx
│   │   │   │       ├── DataFlowDiagram.tsx
│   │   │   │       ├── ComparisonChart.tsx
│   │   │   │       ├── MetricsCounter.tsx
│   │   │   │       ├── ProductMockup.tsx
│   │   │   │       ├── CodeHighlight.tsx
│   │   │   │       ├── BrandedTransition.tsx
│   │   │   │       ├── LowerThird.tsx
│   │   │   │       ├── TextOnGradient.tsx
│   │   │   │       ├── KineticText.tsx
│   │   │   │       └── BrowserFrame.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useMotion.ts           # Existing motion hook (retained)
│   │   │   │   ├── useAudioSync.ts        # New: audio timing utilities
│   │   │   │   └── useSceneTransition.ts  # New: transition logic between scenes
│   │   │   ├── types/
│   │   │   │   └── scenes.ts              # Scene, SceneType, VisualData types
│   │   │   ├── utils/
│   │   │   │   ├── timing.ts              # Frame/time calculation helpers
│   │   │   │   └── colors.ts              # Brand color constants + helpers
│   │   │   ├── SceneRouter.tsx            # Central scene routing component
│   │   │   ├── theme.ts                   # Updated to target color palette
│   │   │   ├── types.ts                   # Re-exports from script-gen (existing)
│   │   │   ├── Root.tsx                   # Remotion Root (existing)
│   │   │   └── index.ts                   # Entry point (existing)
│   │   └── remotion.config.ts
│   │
│   ├── render-service/                    # Remotion rendering service (existing)
│   │   └── src/
│   │       └── render.ts                  # Updated for V2 direction document input
│   │
│   ├── orchestrator/                      # Pipeline orchestrator (existing, unchanged)
│   └── operator-cli/                      # CLI tool (existing, unchanged)
│
├── packages/
│   ├── director-agent/                    # NEW: LLM-powered scene classification
│   │   ├── src/
│   │   │   ├── index.ts                   # Main export
│   │   │   ├── scriptParser.ts            # Split script into segments
│   │   │   ├── sceneClassifier.ts         # LLM assigns scene types + visualData
│   │   │   ├── validator.ts               # Rule enforcement (Section 7.4)
│   │   │   └── prompts/
│   │   │       └── director.ts            # System prompt for Director LLM
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── asset-library/                     # NEW: Static assets for video
│   │   ├── logos/                          # Company logos (white/grayscale SVG + PNG)
│   │   ├── fonts/                          # Inter, JetBrains Mono
│   │   ├── icons/                          # UI icons for list items, social links
│   │   └── package.json
│   │
│   ├── script-gen/                        # Existing: script generation + types
│   │   └── src/
│   │       └── types.ts                   # Updated: ComponentNameSchema expanded
│   │
│   ├── tts/                               # Existing: TTS synthesis
│   ├── timestamp-extraction/              # Existing: word-level timing
│   ├── audio-mixer/                       # Existing: audio mixing
│   ├── visual-gen/                        # Existing: visual timeline generation
│   ├── broll-engine/                      # Existing: B-roll generation
│   ├── core/                              # Existing: shared utilities
│   └── ...                                # Other existing packages
│
├── scripts/
│   ├── render-test.ts                     # Render a 10-second test clip
│   └── generate-scenes.ts                # Run Director Agent on a script
│
├── data/
│   └── scripts/                           # Raw video scripts for testing
│
├── docs/
│   └── VIDEO_SYSTEM_SPEC.md              # THIS DOCUMENT
│
└── ...                                    # Other existing files
```

### 12.1 Migration Notes

During migration (Phases 1-7), both old and new components coexist:
- New scene components live in `components/scenes/`
- Existing components move to `components/legacy/` and remain importable
- The `COMPONENT_MAP` in `TechExplainer.tsx` continues to reference legacy components for timeline mode
- The `SCENE_REGISTRY` in `SceneRouter.tsx` references new scene components for direction document mode
- After Phase 10, legacy components and timeline mode can be removed

### 12.2 Cross-Package Changes Required

Adding new scene types affects multiple packages:

1. `packages/script-gen/src/types.ts` — Expand `ComponentName` type and `ComponentNameSchema` Zod enum
2. `packages/visual-gen/src/scene-mapper.ts` — Update mapping logic (eventually replaced by director-agent)
3. `packages/script-gen/src/script-gen.ts` — Update `DEFAULT_VISUAL_TEMPLATE` mapping
4. `apps/video-studio/src/types.ts` — Re-export updated types
5. `apps/render-service/src/render.ts` — Support direction document input

---

## Appendix A: Discrepancies Between Current State and Target

| Area | Current State | Target State | Gap |
|---|---|---|---|
| **Scene system** | String-based COMPONENT_MAP with 11 components | Type-safe SceneRouter with 14 scene types | Need new types, router, and components |
| **Color palette** | Indigo primary (#6366f1) | Cyan primary (#00d4ff) | Theme migration needed |
| **Render service input** | Timeline mode only | Direction Document mode | Render service API update needed |
| **Visual generation** | V1 keyword-based SceneMapper | LLM Director Agent | New package needed |
| **Captions** | KineticText as scene component | AnimatedCaptions as persistent overlay | Architectural refactor needed |
| **Asset library** | No centralized assets | `packages/asset-library/` with logos, fonts, icons | New package needed |
| **Test rendering** | No test render script | `render:test` script for 10-second samples | Script needed |
| **Direction Document flow** | Code exists in TechExplainer but never called from render-service | Full V2 pipeline | Integration gap |

## Appendix B: Component Evolution Matrix

| Target Component | Based On | Change Type | Key Differences |
|---|---|---|---|
| IntroSequence | — | New | Logo animation, episode metadata |
| ChapterBreak | BrandedTransition | Evolve | Add chapter number/title, remove logo reveal, simplify |
| NarrationDefault | — | New | Animated background, no primary content (relies on captions) |
| TextEmphasis | TextOnGradient + KineticText | Evolve | 3 animation styles, highlight words, focused on phrases |
| FullScreenText | TextOnGradient | Evolve | Full-sentence display, staggered word reveal |
| StatCallout | MetricsCounter | Evolve | Add prefix/suffix, comparison mode, simplified design |
| Comparison | ComparisonChart | Redesign | Side-by-side panels (not bar chart), colored tints |
| Diagram | DataFlowDiagram | Redesign | Multi-layout support, better node/edge rendering |
| LogoShowcase | — | New | Grid/sequential logo display with asset library |
| Timeline | — | New | Horizontal timeline with event markers |
| Quote | — | New | Decorative quotation marks, attribution |
| ListReveal | — | New | Staggered item reveal, multiple styles |
| CodeBlock | CodeHighlight | Evolve | VS Code aesthetic, better syntax highlighting |
| OutroSequence | — | New | Subscribe CTA, social links, branding |
| AnimatedCaptions | KineticText | Refactor | Overlay layer (not scene), full-composition span |

---

## 13. RUNNING A V2 RENDER

### 13.1 Required Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `GEMINI_API_KEY` or `NEXUS_GEMINI_API_KEY` | Director Agent LLM calls | Yes (for V2 mode; legacy works without) |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCS uploads and downloads | Yes (production) |
| `NEXUS_BUCKET_NAME` | GCS bucket name (default: `nexus-ai-artifacts`) | No |
| `NEXUS_SECRET` | Render service auth token | Recommended |
| `RENDER_SERVICE_URL` | Render service endpoint (default: `http://localhost:8081`) | No |

### 13.2 Validation Commands

```bash
# Production readiness check (validates Director Agent, scene registry, colors, fonts)
npx tsx scripts/production-test.ts

# Director Agent pipeline validation (requires GEMINI_API_KEY)
npx tsx scripts/validate-pipeline.ts

# V2 Director Bridge validation (requires GEMINI_API_KEY)
npx tsx scripts/render-test-v2.ts
```

### 13.3 Triggering a Render

The render service exposes two endpoints:

**Async render (recommended):**
```bash
curl -X POST http://localhost:8081/render/async \
  -H "Content-Type: application/json" \
  -H "X-Nexus-Secret: $NEXUS_SECRET" \
  -d '{
    "pipelineId": "test-001",
    "timelineUrl": "gs://nexus-ai-artifacts/test-001/visual-gen/scenes.json",
    "audioUrl": "gs://nexus-ai-artifacts/test-001/tts/audio.wav"
  }'
```

**Poll for status:**
```bash
curl http://localhost:8081/render/status/<jobId> \
  -H "X-Nexus-Secret: $NEXUS_SECRET"
```

### 13.4 V2 vs Legacy Mode

The pipeline defaults to V2 Director Agent mode. To use legacy keyword-based SceneMapper:

```typescript
// In visual-gen pipeline input:
{ mode: 'legacy-timeline' }
```

The render service auto-detects the mode from the JSON payload:
- V2: `{ "version": "v2-director", "scenes": [...], "totalDurationFrames": N }`
- Legacy: `{ "audioDurationSec": N, "scenes": [...] }` (no `version` field)

If `GEMINI_API_KEY` is not set at startup, the render service logs a warning and the pipeline should use `mode: 'legacy-timeline'` to avoid Director Agent failures.

### 13.5 Cloud Run Deployment

```bash
# Build and push Docker image
gcloud builds submit --config=cloudbuild-render.yaml

# Set GEMINI_API_KEY as a Cloud Run environment variable
gcloud run services update nexus-render-service \
  --set-env-vars="GEMINI_API_KEY=<key>" \
  --region=us-central1
```
