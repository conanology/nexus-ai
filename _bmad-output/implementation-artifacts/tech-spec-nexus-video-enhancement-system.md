---
title: 'NEXUS-AI Video Enhancement System - Four-Layer Architecture'
slug: 'nexus-video-enhancement-system'
created: '2026-01-27'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Remotion 4.x
  - TypeScript (strict mode)
  - React
  - Google Cloud STT (@google-cloud/speech)
  - Gemini 2.5 Pro TTS
  - Node.js 20.x
  - FFmpeg (ffmpeg-static)
  - avr-vad (Silero VAD v5)
  - Zod (schema validation)
files_to_modify:
  - packages/script-gen/src/script-gen.ts
  - packages/script-gen/src/types.ts
  - packages/tts/src/types.ts
  - packages/visual-gen/src/types.ts
  - packages/visual-gen/src/scene-mapper.ts
  - packages/visual-gen/src/timeline.ts
  - apps/video-studio/src/types.ts
  - apps/video-studio/src/components/*.tsx (8 components)
  - apps/video-studio/src/compositions/TechExplainer.tsx
  - apps/orchestrator/src/stages.ts
  - apps/orchestrator/src/pipeline.ts
files_to_create:
  - packages/script-gen/src/compatibility.ts
  - packages/timestamp-extraction/src/index.ts
  - packages/timestamp-extraction/src/types.ts
  - packages/timestamp-extraction/src/fallback.ts
  - packages/timestamp-extraction/src/quality-gate.ts
  - packages/timestamp-extraction/src/__tests__/fixtures/test-audio-*.wav
  - packages/audio-mixer/src/index.ts
  - packages/audio-mixer/src/ducking.ts
  - packages/audio-mixer/src/music-selector.ts
  - packages/audio-mixer/src/quality-gate.ts
  - packages/audio-mixer/src/types.ts
  - packages/broll-engine/src/index.ts
  - packages/broll-engine/src/types.ts
  - apps/video-studio/src/hooks/useMotion.ts
  - apps/video-studio/src/components/KineticText.tsx
code_patterns:
  - StageInput/StageOutput contracts for all pipeline stages
  - withRetry + withFallback for all external API calls
  - Quality gate checks before stage return
  - CostTracker for API cost monitoring
  - Structured logging (no console.log)
  - Provider abstraction interfaces
  - 3-tier component props (top-level, data, style)
  - Frame-based animations using useCurrentFrame()
  - spring() with damping:100 for elastic motion
  - interpolate() for value mapping
test_patterns:
  - Vitest for unit tests
  - __tests__/ subdirectories per package
  - Component tests use Remotion <Thumbnail> for frame snapshots
  - Integration tests for pipeline stages
research_document: '_bmad-output/planning-artifacts/research/technical-remotion-cinematic-pipeline-research-2026-01-27.md'
---

# Tech-Spec: NEXUS-AI Video Enhancement System - Four-Layer Architecture

**Created:** 2026-01-27

## Overview

### Problem Statement

Current NEXUS-AI pipeline produces 30-second static text slides with flat TTS narration. Stage directions embedded in scripts get read aloud because content and visual direction are mixed together. Videos are obviously AI-generated due to:
- Static visuals with no motion graphics
- Monotone audio with no background music or sound design
- Fixed 30-second duration regardless of content length
- No kinetic typography or word-level animation sync
- Text descriptions instead of visual demonstrations (B-Roll)

Target state: 5-8 minute broadcast-quality videos indistinguishable from human-produced content like Fireship, Vox, or Two Minute Papers.

### Solution

Implement a four-layer architecture that transforms the pipeline from static text slides to cinematic video production:

1. **Director Layer** - JSON manifest schema separating `script.md` (narration content for TTS) from `direction.json` (visual/audio blueprint for rendering). This prevents stage directions from being read aloud.

2. **Timestamp Extraction Stage** - New pipeline stage using Google Cloud STT to extract word-level timestamps from generated TTS audio. Enables precise kinetic typography synchronization.

3. **Kinetic Layer** - Motion configuration props added to existing Remotion components. Supports entrance animations (fade/slide/pop), emphasis effects (pulse/shake/glow), and exit animations. Driven by direction.json.

4. **Immersion Layer** - Multi-track audio system with background music selection, VAD-based auto-ducking, and triggered sound effects. Professional audio mixing without manual intervention.

5. **Reality Layer** - B-Roll engine generating synthetic footage: code snippet reveals with typing animation, simulated browser interactions, procedural diagrams. Replaces text descriptions with visual demonstrations.

### Scope

**In Scope:**
- Director Layer manifest schema (script.md + direction.json)
- New timestamp-extraction stage (Google Cloud STT integration)
- Motion props for 8 existing Remotion components
- Word-level kinetic typography system
- Music library integration + VAD-based auto-ducking
- SFX trigger system tied to direction.json cues
- Code snippet renderer with typing animation
- Browser demo templates (simulated UI)
- Diagram/visualization generators
- Video duration scaling - dynamic duration based on script length (target: 5-8 minutes)

**Out of Scope:**
- AI-generated human avatars/presenters
- Real-time streaming capability
- Multi-language TTS (future enhancement)
- Changes to YouTube publishing flow
- Stock footage API integration (Phase 2)

---

## Context for Development

### Codebase Patterns

#### Pipeline Architecture
- **Orchestrator**: Centralized at `apps/orchestrator/src/pipeline.ts` (1,427 lines)
- **Stage Registry**: `apps/orchestrator/src/stages.ts` - maps stage names to executor functions
- **Execution**: Strictly sequential, output from stage N becomes input to stage N+1
- **Current Stage Order**: news-sourcing → research → script-gen → pronunciation → tts → visual-gen → thumbnail → youtube → twitter → notifications

#### Stage Contract Pattern
```typescript
// Every stage MUST use this contract
async function executeMyStage(
  input: StageInput<MyInput>
): Promise<StageOutput<MyOutput>>

// StageInput includes: pipelineId, previousStage, data, config, qualityContext
// StageOutput includes: success, data, artifacts, quality, cost, durationMs, provider
```

#### Adding New Stages
1. Create package at `packages/{stage-name}/`
2. Register in `apps/orchestrator/src/stages.ts` → `stageRegistry`
3. Add to `stageOrder` array at correct position
4. Define retry config in `STAGE_RETRY_CONFIG`
5. Define criticality in `STAGE_CRITICALITY` (CRITICAL/DEGRADED/RECOVERABLE)

#### Remotion Component Pattern
- All 8 components use: `useCurrentFrame()`, `spring()`, `interpolate()`, `useVideoConfig()`
- 3-tier props: top-level (title, text), `data` object, `style` object
- Consistent spring config: `{ damping: 100 }`
- Stagger pattern: `delay = index * 15` frames (0.5s intervals at 30fps)
- All animations frame-based - NO CSS transitions

#### Required Patterns (from project-context.md)
- `withRetry()` + `withFallback()` for ALL external API calls
- Quality gate check before every stage return
- `CostTracker` for API cost monitoring
- Structured logger (`@nexus-ai/core`) - NO console.log
- Secrets from Secret Manager - NO hardcoded credentials

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `apps/orchestrator/src/pipeline.ts` | Pipeline orchestration, stage wiring, buildStageInput() |
| `apps/orchestrator/src/stages.ts` | Stage registry, stageOrder array |
| `packages/core/src/types/pipeline.ts` | StageInput/StageOutput contracts |
| `packages/script-gen/src/script-gen.ts` | Current script generation (outputs mixed content+direction) |
| `packages/script-gen/src/types.ts` | ScriptGenInput/ScriptGenOutput types |
| `packages/tts/src/tts.ts` | TTS synthesis, chunking, stitching |
| `packages/tts/src/types.ts` | TTSInput/TTSOutput (no word timestamps currently) |
| `packages/visual-gen/src/scene-mapper.ts` | Keyword → component mapping |
| `packages/visual-gen/src/timeline.ts` | TimelineJSON generation |
| `packages/visual-gen/src/types.ts` | TimelineJSON schema, SceneMapping |
| `apps/video-studio/src/compositions/TechExplainer.tsx` | Main Remotion composition, COMPONENT_MAP |
| `apps/video-studio/src/components/*.tsx` | 8 visual components (static, need motion props) |
| `apps/video-studio/src/types.ts` | Component prop interfaces |
| `_bmad-output/project-context.md` | Critical patterns and anti-patterns |

### Technical Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Content/Direction separation | script.md + direction.json | Clean separation prevents stage directions being read aloud. TTS reads script.md only. |
| Word timestamp extraction | New pipeline stage | Keep TTS focused on audio generation. Easy to swap STT providers later. |
| Motion system | Refactor existing components | Don't discard working code. Add motion props that are backward compatible. |
| Implementation order | Director → Timestamps → Kinetic → Audio → B-Roll | Maximizes quality improvement per layer while building dependencies correctly. |
| Timestamp provider | Google Cloud STT | 100ms accuracy, batch mode at $0.004/min, already in GCP ecosystem. |
| VAD library | avr-vad (Silero v5) | Active maintenance, ONNX-based, production-ready. |
| Audio mixing | FFmpeg via ffmpeg-static | Industry standard, no system deps, full filter support. |
| New stage position | Between TTS and visual-gen | Natural data flow: audio → timestamps → visual timing |

---

## Schema Definitions (Complete)

### DirectionDocument Schema (F1 Fix)

```typescript
/**
 * Complete Direction Document Schema
 * This is the video blueprint that drives all layers
 */
interface DirectionDocument {
  version: '2.0';  // Schema version for backward compatibility
  metadata: {
    title: string;
    slug: string;
    estimatedDurationSec: number;   // Before TTS (from word count / 150 WPM)
    actualDurationSec?: number;     // After TTS (from audio duration)
    fps: 30;
    resolution: { width: 1920; height: 1080 };
    generatedAt: string;            // ISO timestamp
  };
  segments: DirectionSegment[];
  globalAudio: {
    defaultMood: 'energetic' | 'contemplative' | 'urgent' | 'neutral';
    musicTransitions: 'smooth' | 'cut';
  };
}

interface DirectionSegment {
  id: string;                       // UUID, used to link WordTimings
  index: number;                    // Order in sequence (0-based)
  type: SegmentType;

  // Content (goes to TTS via script.md)
  content: {
    text: string;                   // Plain narration text
    wordCount: number;              // For duration estimation
    keywords: string[];             // Terms to emphasize visually
    emphasis: EmphasisWord[];       // Words with special animation
  };

  // Timing (populated in stages)
  timing: {
    // Estimated (set by script-gen, before TTS)
    estimatedStartSec?: number;
    estimatedEndSec?: number;
    estimatedDurationSec?: number;

    // Actual (set by timestamp-extraction, after TTS)
    actualStartSec?: number;
    actualEndSec?: number;
    actualDurationSec?: number;

    // Word-level (set by timestamp-extraction)
    wordTimings?: WordTiming[];
    timingSource: 'estimated' | 'extracted';
  };

  // Visual direction
  visual: {
    template: ComponentName;
    templateProps?: Record<string, unknown>;  // Component-specific props
    motion: MotionConfig;
    broll?: BRollSpec;
  };

  // Audio direction
  audio: {
    mood?: 'energetic' | 'contemplative' | 'urgent';
    sfxCues?: SFXCue[];
    musicTransition?: 'continue' | 'fade' | 'cut';
    voiceEmphasis?: 'normal' | 'excited' | 'serious';
  };
}

type SegmentType = 'intro' | 'hook' | 'explanation' | 'code_demo' |
                   'comparison' | 'example' | 'transition' | 'recap' | 'outro';

type ComponentName = 'NeuralNetworkAnimation' | 'DataFlowDiagram' |
                     'ComparisonChart' | 'MetricsCounter' | 'ProductMockup' |
                     'CodeHighlight' | 'BrandedTransition' | 'LowerThird' |
                     'TextOnGradient' | 'KineticText' | 'BrowserFrame';

interface EmphasisWord {
  word: string;
  effect: 'scale' | 'glow' | 'underline' | 'color';
  intensity: number;  // 0-1
}

interface WordTiming {
  word: string;
  index: number;              // Position in segment (0-based)
  startTime: number;          // Seconds from video start
  endTime: number;            // Seconds from video start
  duration: number;           // endTime - startTime
  segmentId: string;          // Links to DirectionSegment.id
  isEmphasis: boolean;        // True if in content.emphasis
}

interface SFXCue {
  trigger: 'segment_start' | 'segment_end' | 'word' | 'timestamp';
  triggerValue?: string;      // Word or timestamp if applicable
  sound: string;              // SFX library ID
  volume: number;             // 0-1
}
```

### MotionConfig Schema (Complete)

```typescript
interface MotionConfig {
  preset?: 'subtle' | 'standard' | 'dramatic';  // Shorthand for common configs

  entrance: {
    type: 'fade' | 'slide' | 'pop' | 'scale' | 'blur' | 'none';
    direction?: 'left' | 'right' | 'up' | 'down';
    delay: number;           // Frames (default: 0)
    duration: number;        // Frames (default: 15 = 0.5s at 30fps)
    easing: 'spring' | 'linear' | 'easeOut' | 'easeInOut';
    springConfig?: {
      damping: number;       // Default: 100
      stiffness: number;     // Default: 200
      mass: number;          // Default: 1
    };
  };

  emphasis: {
    type: 'pulse' | 'shake' | 'glow' | 'underline' | 'scale' | 'none';
    trigger: 'onWord' | 'onSegment' | 'continuous' | 'none';
    intensity: number;       // 0-1 (default: 0.5)
    duration: number;        // Frames per pulse (default: 10)
  };

  exit: {
    type: 'fade' | 'slide' | 'shrink' | 'blur' | 'none';
    direction?: 'left' | 'right' | 'up' | 'down';
    duration: number;        // Frames (default: 15)
    startBeforeEnd: number;  // Frames before segment end to start exit
  };
}

// Preset expansions
const MOTION_PRESETS: Record<string, Omit<MotionConfig, 'preset'>> = {
  subtle: {
    entrance: { type: 'fade', duration: 20, easing: 'easeOut', delay: 0 },
    emphasis: { type: 'none', trigger: 'none', intensity: 0, duration: 0 },
    exit: { type: 'fade', duration: 15, startBeforeEnd: 15 }
  },
  standard: {
    entrance: { type: 'slide', direction: 'up', duration: 15, easing: 'spring', delay: 0 },
    emphasis: { type: 'pulse', trigger: 'onWord', intensity: 0.3, duration: 10 },
    exit: { type: 'fade', duration: 15, startBeforeEnd: 15 }
  },
  dramatic: {
    entrance: { type: 'pop', duration: 12, easing: 'spring', delay: 0,
                springConfig: { damping: 80, stiffness: 300, mass: 1 } },
    emphasis: { type: 'glow', trigger: 'onWord', intensity: 0.6, duration: 15 },
    exit: { type: 'shrink', duration: 10, startBeforeEnd: 10 }
  }
};
```

### BRollSpec Schema (Complete)

```typescript
interface BRollSpec {
  type: 'code' | 'browser' | 'diagram' | 'animation' | 'static';

  // For type: 'code'
  code?: {
    content: string;
    language: string;
    highlightLines?: number[];
    typingEffect: boolean;
    typingSpeed: number;     // Characters per second (default: 30)
    theme: 'dark' | 'light';
    showLineNumbers: boolean;
  };

  // For type: 'browser'
  browser?: {
    url: string;
    templateId: 'api-request' | 'form-submit' | 'dashboard' | 'custom';
    actions: BrowserAction[];
    viewport: { width: number; height: number };
  };

  // For type: 'diagram'
  diagram?: {
    diagramType: 'flowchart' | 'sequence' | 'architecture' | 'mindmap';
    data: Record<string, unknown>;  // Diagram-specific data
    animateSteps: boolean;
  };

  // For type: 'animation'
  animation?: {
    componentId: string;     // Reference to custom animation component
    props: Record<string, unknown>;
  };

  // For type: 'static'
  static?: {
    imageUrl: string;
    alt: string;
    zoom?: { from: number; to: number };  // Ken Burns effect
  };

  // Common properties
  overlay: boolean;          // True = overlay on top of main content
  overlayOpacity?: number;   // 0-1 if overlay
  position?: 'full' | 'left' | 'right' | 'pip';  // Picture-in-picture etc.
  startOffset: number;       // Frames after segment start
  duration: number;          // Frames (0 = full segment)
}

interface BrowserAction {
  type: 'click' | 'type' | 'scroll' | 'highlight' | 'wait';
  target?: string;           // CSS selector or coordinates
  value?: string;            // Text to type or scroll amount
  delay: number;             // Frames before action
  duration: number;          // Frames for action animation
}
```

---

## Migration Strategy (F2 Fix)

### ScriptGenOutput Versioning

```typescript
// Version 1 (Legacy) - Current format
interface ScriptGenOutputV1 {
  script: string;                    // Mixed content with [visual cues]
  wordCount: number;
  artifactUrl: string;
  // ... other existing fields
}

// Version 2 (New) - Dual-file format
interface ScriptGenOutputV2 {
  version: '2.0';                    // Version flag

  // Narration only (for TTS)
  scriptText: string;                // Plain text, no brackets
  scriptUrl: string;                 // GCS URL to script.md

  // Direction (for visual/audio layers)
  directionDocument: DirectionDocument;
  directionUrl: string;              // GCS URL to direction.json

  // Metadata
  wordCount: number;
  artifactUrl: string;               // Legacy field for compatibility

  // ... other existing fields preserved
}

// Union type for runtime detection
type ScriptGenOutput = ScriptGenOutputV1 | ScriptGenOutputV2;

// Type guard
function isV2Output(output: ScriptGenOutput): output is ScriptGenOutputV2 {
  return 'version' in output && output.version === '2.0';
}
```

### Backward Compatibility Layer

```typescript
// In pronunciation stage and TTS stage
async function getScriptText(input: ScriptGenOutput): Promise<string> {
  if (isV2Output(input)) {
    return input.scriptText;  // Clean narration
  }

  // V1 fallback: strip visual cue brackets
  return input.script.replace(/\[.*?\]/g, '').trim();
}

// In visual-gen stage
async function getDirectionDocument(
  input: ScriptGenOutput,
  audioUrl: string,
  audioDurationSec: number
): Promise<DirectionDocument> {
  if (isV2Output(input)) {
    return input.directionDocument;
  }

  // V1 fallback: parse legacy visual cues into direction document
  return parseLegacyVisualCues(input.script, audioDurationSec);
}

// Legacy parser (maintains current behavior)
function parseLegacyVisualCues(
  script: string,
  audioDurationSec: number
): DirectionDocument {
  const cuePattern = /\[(.*?)\]/g;
  const segments: DirectionSegment[] = [];
  // ... existing visual cue parsing logic from scene-mapper.ts
  // Convert to DirectionDocument format
  return {
    version: '2.0',
    metadata: { /* ... */ },
    segments,
    globalAudio: { defaultMood: 'neutral', musicTransitions: 'smooth' }
  };
}
```

### Migration Timeline

| Phase | Behavior | Flag |
|-------|----------|------|
| Week 1-2 | V2 output disabled, V1 only | `SCRIPT_GEN_VERSION=1` |
| Week 3-4 | V2 output enabled, V1 fallback active | `SCRIPT_GEN_VERSION=2` |
| Week 5+ | V2 only, V1 fallback deprecated | `SCRIPT_GEN_VERSION=2` |

---

## Timestamp Fallback Strategy (F5 Fix)

### Estimated Timing Calculation

When Google Cloud STT fails or is unavailable, use estimated timings:

```typescript
const AVERAGE_WPM = 150;  // Words per minute for TTS
const AVERAGE_WPS = AVERAGE_WPM / 60;  // 2.5 words per second

interface EstimatedTimingConfig {
  wordsPerMinute: number;    // Default: 150
  minWordDuration: number;   // Minimum seconds per word (0.1)
  maxWordDuration: number;   // Maximum seconds per word (1.0)
  pauseAfterPunctuation: number;  // Seconds after . ! ? (0.3)
  pauseAfterComma: number;   // Seconds after , ; : (0.15)
}

function estimateWordTimings(
  segment: DirectionSegment,
  segmentStartSec: number,
  config: EstimatedTimingConfig = DEFAULT_CONFIG
): WordTiming[] {
  const words = segment.content.text.split(/\s+/);
  const timings: WordTiming[] = [];

  // Character-weighted duration distribution
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const segmentDuration = segment.timing.estimatedDurationSec ??
                          (segment.content.wordCount / AVERAGE_WPS);

  let currentTime = segmentStartSec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const cleanWord = word.replace(/[.,!?;:]/g, '');

    // Duration proportional to character count
    const charRatio = cleanWord.length / totalChars;
    let duration = segmentDuration * charRatio;

    // Clamp to min/max
    duration = Math.max(config.minWordDuration,
               Math.min(config.maxWordDuration, duration));

    // Add pause for punctuation
    let pauseAfter = 0;
    if (/[.!?]$/.test(word)) pauseAfter = config.pauseAfterPunctuation;
    else if (/[,;:]$/.test(word)) pauseAfter = config.pauseAfterComma;

    timings.push({
      word: cleanWord,
      index: i,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration,
      segmentId: segment.id,
      isEmphasis: segment.content.emphasis.some(e =>
        e.word.toLowerCase() === cleanWord.toLowerCase())
    });

    currentTime += duration + pauseAfter;
  }

  return timings;
}
```

### Timing Source Tracking

```typescript
interface TimestampExtractionOutput {
  // ... existing fields ...

  timingMetadata: {
    source: 'extracted' | 'estimated';
    extractionConfidence?: number;  // 0-1, only if extracted
    estimationMethod?: 'character-weighted' | 'uniform';
    warningFlags: string[];         // e.g., ['fast-speech', 'low-confidence']
  };
}

// Quality gate check
function validateTimings(output: TimestampExtractionOutput): QualityResult {
  if (output.timingMetadata.source === 'estimated') {
    return {
      status: 'DEGRADED',
      reason: 'Using estimated word timings - STT extraction failed',
      flags: ['timing-estimated']
    };
  }

  if (output.timingMetadata.extractionConfidence! < 0.8) {
    return {
      status: 'DEGRADED',
      reason: `Low STT confidence: ${output.timingMetadata.extractionConfidence}`,
      flags: ['timing-low-confidence']
    };
  }

  return { status: 'PASS' };
}
```

---

## Music Library Schema (F8 Fix)

### Track Metadata Format

```typescript
interface MusicTrack {
  id: string;                        // UUID
  filename: string;                  // e.g., "energetic-tech-01.mp3"

  // Mood and energy
  mood: 'energetic' | 'contemplative' | 'urgent' | 'neutral' | 'playful';
  energy: 'high' | 'medium' | 'low';

  // Musical properties
  tempo: {
    bpm: number;                     // Beats per minute
    timeSignature: '4/4' | '3/4' | '6/8';
  };

  // Duration and structure
  durationSec: number;
  hasLoop: boolean;                  // Can be seamlessly looped
  loopPoints?: {
    startSec: number;
    endSec: number;
  };

  // Audio properties
  format: 'mp3' | 'wav' | 'ogg';
  sampleRate: 44100 | 48000;
  channels: 1 | 2;
  peakDb: number;                    // For normalization

  // Licensing
  license: {
    type: 'royalty-free' | 'creative-commons' | 'licensed';
    attribution?: string;
    restrictions?: string[];
  };

  // Storage
  gcsPath: string;                   // gs://nexus-ai-assets/music/{filename}

  // Tags for matching
  tags: string[];                    // e.g., ['tech', 'corporate', 'upbeat']

  // Usage tracking
  usageCount: number;
  lastUsed?: string;                 // ISO timestamp
}

interface MusicLibrary {
  version: string;
  updatedAt: string;
  tracks: MusicTrack[];
}
```

### Storage Path Convention

```
gs://nexus-ai-assets/
├── music/
│   ├── library.json                 # MusicLibrary index
│   ├── energetic/
│   │   ├── energetic-tech-01.mp3
│   │   ├── energetic-tech-02.mp3
│   │   └── ...
│   ├── contemplative/
│   │   └── ...
│   ├── urgent/
│   │   └── ...
│   └── neutral/
│       └── ...
├── sfx/
│   ├── library.json                 # SFX index
│   ├── transitions/
│   │   ├── whoosh-01.mp3
│   │   └── ...
│   ├── ui/
│   │   ├── click-01.mp3
│   │   └── ...
│   └── notifications/
│       └── ...
```

### Music Selection Algorithm

```typescript
interface MusicSelectionCriteria {
  mood: string;
  targetDurationSec: number;
  previousTrackId?: string;          // Avoid repeating
  energyPreference?: 'high' | 'medium' | 'low';
  tags?: string[];                   // Optional tag matching
}

async function selectMusic(
  criteria: MusicSelectionCriteria,
  library: MusicLibrary
): Promise<MusicTrack | null> {
  // 1. Filter by mood (required)
  let candidates = library.tracks.filter(t => t.mood === criteria.mood);

  // 2. Filter by duration (must be >= target, or loopable)
  candidates = candidates.filter(t =>
    t.durationSec >= criteria.targetDurationSec || t.hasLoop
  );

  // 3. Exclude recently used (if previousTrackId provided)
  if (criteria.previousTrackId) {
    candidates = candidates.filter(t => t.id !== criteria.previousTrackId);
  }

  // 4. Score remaining candidates
  const scored = candidates.map(track => ({
    track,
    score: calculateTrackScore(track, criteria)
  }));

  // 5. Sort by score and select top
  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.track ?? null;
}

function calculateTrackScore(
  track: MusicTrack,
  criteria: MusicSelectionCriteria
): number {
  let score = 100;

  // Prefer exact duration match (avoid looping if possible)
  const durationDiff = Math.abs(track.durationSec - criteria.targetDurationSec);
  score -= durationDiff * 0.5;  // -0.5 per second difference

  // Prefer matching energy
  if (criteria.energyPreference && track.energy === criteria.energyPreference) {
    score += 20;
  }

  // Prefer matching tags
  if (criteria.tags) {
    const tagMatches = criteria.tags.filter(t => track.tags.includes(t)).length;
    score += tagMatches * 10;
  }

  // Prefer less-used tracks (variety)
  score -= track.usageCount * 2;

  return score;
}
```

---

## Data Flow Clarifications

### Segment Timing Flow (F3 Fix)

The timing flows through stages in this order:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage: script-gen                                                        │
│ ─────────────────                                                        │
│ Input:  Research brief                                                   │
│ Output: DirectionDocument with ESTIMATED timing                          │
│                                                                          │
│ Timing calculation:                                                      │
│   estimatedDurationSec = wordCount / (150 WPM / 60)                     │
│   estimatedStartSec = cumulative sum of previous segments               │
│   estimatedEndSec = estimatedStartSec + estimatedDurationSec            │
│                                                                          │
│ timing.timingSource = 'estimated'                                       │
│ timing.wordTimings = undefined (not yet available)                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage: tts                                                               │
│ ─────────                                                                │
│ Input:  scriptText (plain narration)                                     │
│ Output: audioUrl, audioDurationSec (ACTUAL total duration)              │
│                                                                          │
│ Note: TTS does NOT modify DirectionDocument timing                      │
│       It only produces the audio file                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage: timestamp-extraction                                              │
│ ─────────────────────────                                                │
│ Input:  audioUrl, audioDurationSec, DirectionDocument                   │
│ Output: DirectionDocument with ACTUAL timing + wordTimings              │
│                                                                          │
│ Timing update:                                                          │
│   1. Extract word timings from audio via Google Cloud STT               │
│   2. Group words by segment (match text to segment.content.text)        │
│   3. Set actualStartSec = first word's startTime                        │
│   4. Set actualEndSec = last word's endTime                             │
│   5. Set actualDurationSec = actualEndSec - actualStartSec              │
│   6. Populate timing.wordTimings array                                  │
│   7. Set timing.timingSource = 'extracted'                              │
│                                                                          │
│ On failure: Keep estimated timing, set timingSource = 'estimated'       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage: visual-gen                                                        │
│ ────────────────                                                         │
│ Input:  DirectionDocument (with timing), audioUrl                       │
│ Output: TimelineJSON, rendered video                                    │
│                                                                          │
│ Timeline generation:                                                    │
│   - Use actualStartSec/actualEndSec if available                        │
│   - Fall back to estimatedStartSec/estimatedEndSec if not              │
│   - Pass wordTimings to KineticText components                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Audio URL Flow (F6 Fix)

```typescript
// In visual-gen stage
interface VisualGenInput {
  audioUrl: string;              // Original TTS audio
  audioDurationSec: number;
  directionDocument: DirectionDocument;
  topicData?: TopicData;
}

interface VisualGenOutput {
  timelineUrl: string;
  sceneCount: number;
  videoPath: string;

  // Audio URLs
  originalAudioUrl: string;      // Pass through TTS audio
  mixedAudioUrl?: string;        // If audio mixing enabled
  finalAudioUrl: string;         // The one used in render

  // ... other fields
}

// Audio mixing integration
async function executeVisualGen(
  input: StageInput<VisualGenInput>
): Promise<StageOutput<VisualGenOutput>> {
  const { audioUrl, directionDocument } = input.data;

  // 1. Generate timeline
  const timeline = generateTimeline(directionDocument);

  // 2. Mix audio (if enabled)
  let finalAudioUrl = audioUrl;
  let mixedAudioUrl: string | undefined;

  if (shouldMixAudio(directionDocument)) {
    const musicTrack = await selectMusic({
      mood: directionDocument.globalAudio.defaultMood,
      targetDurationSec: input.data.audioDurationSec
    });

    if (musicTrack) {
      const mixResult = await mixAudio({
        voiceTrackUrl: audioUrl,
        musicTrackUrl: musicTrack.gcsPath,
        sfxCues: extractSfxCues(directionDocument),
        outputPath: `${input.pipelineId}/audio/mixed.wav`
      });

      mixedAudioUrl = mixResult.outputUrl;
      finalAudioUrl = mixedAudioUrl;  // Use mixed audio for render
    }
  }

  // 3. Render with final audio
  const renderResult = await callRenderService({
    timeline,
    audioUrl: finalAudioUrl,  // ← This is the key handoff
    outputPath: `${input.pipelineId}/render/video.mp4`
  });

  return {
    success: true,
    data: {
      timelineUrl: timeline.url,
      sceneCount: timeline.scenes.length,
      videoPath: renderResult.videoPath,
      originalAudioUrl: audioUrl,
      mixedAudioUrl,
      finalAudioUrl
    }
  };
}
```

### Motion Props Data Flow (F10 Fix)

```
DirectionDocument                    TimelineJSON                      TechExplainer
─────────────────                    ────────────                      ─────────────
segment.visual.template    →    scene.component            →    COMPONENT_MAP[component]
segment.visual.motion      →    scene.props.motion         →    <Component motion={...} />
segment.visual.templateProps →  scene.props.*              →    <Component {...props} />
segment.timing.wordTimings →    scene.props.wordTimings    →    <KineticText wordTimings={...} />

// In scene-mapper.ts
function mapSegmentToScene(segment: DirectionSegment): Scene {
  return {
    component: segment.visual.template,
    startTime: segment.timing.actualStartSec ?? segment.timing.estimatedStartSec,
    duration: segment.timing.actualDurationSec ?? segment.timing.estimatedDurationSec,
    props: {
      // Spread template-specific props
      ...segment.visual.templateProps,

      // Add motion config
      motion: segment.visual.motion,

      // Add word timings for kinetic text
      wordTimings: segment.timing.wordTimings,

      // Add emphasis words
      emphasis: segment.content.emphasis,

      // Add segment metadata
      segmentId: segment.id,
      segmentType: segment.type
    }
  };
}

// In TechExplainer.tsx
{scenes.map((scene, index) => {
  const SceneComponent = COMPONENT_MAP[scene.component];

  return (
    <Sequence
      key={scene.segmentId ?? index}
      from={Math.round(scene.startTime * fps)}
      durationInFrames={Math.round(scene.duration * fps)}
    >
      <SceneComponent
        {...scene.props}
        // motion is already in scene.props
        // wordTimings is already in scene.props
      />
    </Sequence>
  );
})}
```

---

## Quality Gates (F11 Fix)

### Stage Quality Gate Specifications

```typescript
// timestamp-extraction quality gate
const timestampExtractionQualityGate = {
  metrics: {
    wordCountMatch: {
      check: (output) => {
        const expectedWords = output.directionDocument.segments
          .reduce((sum, s) => sum + s.content.wordCount, 0);
        const extractedWords = output.wordTimings.length;
        return Math.abs(expectedWords - extractedWords) / expectedWords < 0.1;
      },
      threshold: 0.9,  // 90% of words must be extracted
      severity: 'DEGRADED'
    },
    noGaps: {
      check: (output) => {
        const maxGap = findMaxGap(output.wordTimings);
        return maxGap < 0.5;  // No gaps > 500ms
      },
      threshold: 0.5,
      severity: 'DEGRADED'
    },
    monotonicTiming: {
      check: (output) => {
        for (let i = 1; i < output.wordTimings.length; i++) {
          if (output.wordTimings[i].startTime < output.wordTimings[i-1].endTime) {
            return false;  // Overlap detected
          }
        }
        return true;
      },
      severity: 'CRITICAL'
    },
    processingTime: {
      check: (output, durationMs) => durationMs < 60000,
      threshold: 60000,  // < 60 seconds
      severity: 'DEGRADED'
    }
  }
};

// audio-mixer quality gate
const audioMixerQualityGate = {
  metrics: {
    durationMatch: {
      check: (output, input) => {
        const diff = Math.abs(output.durationSec - input.audioDurationSec);
        return diff / input.audioDurationSec < 0.01;  // < 1% difference
      },
      threshold: 0.01,
      severity: 'CRITICAL'
    },
    noClipping: {
      check: (output) => output.peakDb < -0.5,  // At least 0.5dB headroom
      threshold: -0.5,
      severity: 'DEGRADED'
    },
    voiceLevels: {
      check: (output) => {
        const voicePeak = output.voicePeakDb;
        return voicePeak >= -9 && voicePeak <= -3;  // -6dB ± 3dB
      },
      threshold: [-9, -3],
      severity: 'DEGRADED'
    },
    musicDucking: {
      check: (output) => {
        // Verify music is ducked during speech
        return output.duckingApplied && output.musicDuckLevel <= -18;
      },
      threshold: -18,
      severity: 'DEGRADED'
    }
  }
};

// broll-engine quality gate
const brollEngineQualityGate = {
  metrics: {
    validSegmentRefs: {
      check: (output) => {
        return output.brollAssets.every(asset =>
          output.directionDocument.segments.some(s => s.id === asset.segmentId)
        );
      },
      severity: 'CRITICAL'
    },
    typingDurationFits: {
      check: (output) => {
        return output.codeSnippets.every(snippet => {
          const typingDuration = snippet.code.length / snippet.typingSpeed;
          return typingDuration <= snippet.segmentDuration;
        });
      },
      severity: 'DEGRADED'
    }
  }
};
```

---

## Updated Acceptance Criteria (F4 Fix)

### Timestamp Extraction (Revised)

- [ ] **AC4:** Given TTS audio output and 5 reference test files with manually annotated word boundaries, when timestamp-extraction runs, then 95% of extracted word start times are within 100ms of manual annotations
- [ ] **AC4b:** Given a new audio file, when timestamps extracted, then word count matches segment word count within 10% tolerance
- [ ] **AC5:** Given timestamp-extraction failure (STT error, timeout, or <80% confidence), when stage catches error, then:
  - Pipeline continues with estimated timings using character-weighted distribution
  - `timingMetadata.source` is set to `'estimated'`
  - Quality gate returns DEGRADED status with flag `'timing-estimated'`
  - Warning logged with STT error details
- [ ] **AC6:** Given a 5-minute audio file, when timestamps extracted, then processing completes in <60 seconds (measured via stage durationMs)

### Component Backward Compatibility (F12 Improved)

- [ ] **AC8:** Given a component without motion prop, when rendered, then:
  - Component displays correctly (visual snapshot matches baseline)
  - No console errors or warnings
  - useMotion hook returns neutral styles (opacity: 1, transform: none)
- [ ] **AC8b:** Given motion prop with only `preset: 'subtle'`, when rendered, then motion expands to full MotionConfig from MOTION_PRESETS

---

## Implementation Plan

### Phase 1: Director Layer (Content/Direction Separation)

### Phase 1: Director Layer (Content/Direction Separation)

#### Task 1.1: Define Direction Document Schema
- **File:** `packages/script-gen/src/types.ts`
- **Action:** Add complete DirectionDocument schema (see Schema Definitions section above)
- **Details:** Implement full schema including:
  - `DirectionDocument` with version, metadata, segments, globalAudio
  - `DirectionSegment` with timing (estimated/actual), content, visual, audio
  - `MotionConfig` with presets and full entrance/emphasis/exit specs
  - `BRollSpec` with code, browser, diagram, animation, static types
  - `WordTiming` with segment linking
  - `SFXCue` with trigger types
  - Type guards: `isV2Output()` for version detection

#### Task 1.1b: Implement Backward Compatibility Layer
- **File:** `packages/script-gen/src/compatibility.ts`
- **Action:** Create migration utilities for V1 → V2 transition
- **Details:**
  ```typescript
  // Export utilities for downstream stages
  export function isV2Output(output: ScriptGenOutput): output is ScriptGenOutputV2;
  export function getScriptText(output: ScriptGenOutput): string;
  export function getDirectionDocument(
    output: ScriptGenOutput,
    audioDurationSec: number
  ): DirectionDocument;
  export function parseLegacyVisualCues(
    script: string,
    audioDurationSec: number
  ): DirectionDocument;
  ```

#### Task 1.2: Update Script Generation to Output Dual Files
- **File:** `packages/script-gen/src/script-gen.ts`
- **Action:** Modify multi-agent pipeline to output script.md + direction.json separately
- **Details:**
  - Add new agent prompt to separate content from direction
  - Script.md contains ONLY narration text (no brackets, no stage directions)
  - Direction.json contains visual/audio cues with segment timing
  - Update `ScriptGenOutput` to include both artifacts

#### Task 1.3: Update ScriptGenOutput Type
- **File:** `packages/script-gen/src/types.ts`
- **Action:** Add new output fields for dual-file output
- **Details:**
  ```typescript
  interface ScriptGenOutput {
    // ... existing fields ...
    scriptUrl: string;        // GCS URL to script.md (narration only)
    directionUrl: string;     // GCS URL to direction.json
    directionDocument: DirectionDocument;  // Parsed direction for downstream
  }
  ```

#### Task 1.4: Update TTS Input to Use Script.md Only
- **File:** `packages/tts/src/types.ts`
- **Action:** Ensure TTS reads only from script content, not direction
- **Details:**
  - TTSInput should receive `scriptText` (plain narration)
  - Remove any visual cue bracket parsing from TTS stage
  - TTS output unchanged (audioUrl, durationSec)

---

### Phase 2: Timestamp Extraction Stage

#### Task 2.1: Create timestamp-extraction Package Structure
- **Files to Create:**
  - `packages/timestamp-extraction/package.json`
  - `packages/timestamp-extraction/tsconfig.json`
  - `packages/timestamp-extraction/src/index.ts`
  - `packages/timestamp-extraction/src/types.ts`
  - `packages/timestamp-extraction/src/__tests__/timestamp-extraction.test.ts`
- **Action:** Initialize new package with standard NEXUS structure
- **Details:** Follow existing package patterns (see `packages/tts/` for reference)

#### Task 2.2: Implement Google Cloud STT Word Timestamp Extraction
- **File:** `packages/timestamp-extraction/src/index.ts`
- **Action:** Implement `executeTimestampExtraction()` stage function
- **Details:**
  ```typescript
  async function executeTimestampExtraction(
    input: StageInput<TimestampExtractionInput>
  ): Promise<StageOutput<TimestampExtractionOutput>> {
    // 1. Download audio from GCS (input.data.audioUrl)
    // 2. Convert to LINEAR16 format if needed
    // 3. Call Google Cloud STT with enableWordTimeOffsets: true
    // 4. Parse response into WordTiming[] array
    // 5. Merge with DirectionDocument segments
    // 6. Return enriched direction document with word timings
  }
  ```

#### Task 2.3: Define Timestamp Types
- **File:** `packages/timestamp-extraction/src/types.ts`
- **Action:** Define input/output types for the stage
- **Details:**
  ```typescript
  interface TimestampExtractionInput {
    audioUrl: string;
    audioDurationSec: number;
    directionDocument: DirectionDocument;
    topicData?: TopicData;
  }

  interface TimestampExtractionOutput {
    directionDocument: DirectionDocument;  // Enriched with word timings
    wordTimings: WordTiming[];
    audioUrl: string;  // Pass through
    audioDurationSec: number;
    topicData?: TopicData;
  }

  interface WordTiming {
    word: string;
    startTime: number;  // seconds
    endTime: number;    // seconds
    segmentId: string;  // Links to DirectionSegment.id
  }
  ```

#### Task 2.4: Register Stage in Orchestrator
- **File:** `apps/orchestrator/src/stages.ts`
- **Action:** Add timestamp-extraction to stage registry and order
- **Details:**
  ```typescript
  import { executeTimestampExtraction } from '@nexus-ai/timestamp-extraction';

  export const stageRegistry = {
    // ... existing stages ...
    'timestamp-extraction': executeTimestampExtraction,
  };

  export const stageOrder = [
    'news-sourcing', 'research', 'script-gen', 'pronunciation', 'tts',
    'timestamp-extraction',  // NEW: Insert here
    'visual-gen', 'thumbnail', 'youtube', 'twitter', 'notifications',
  ];
  ```

#### Task 2.5: Configure Stage Retry and Criticality
- **File:** `apps/orchestrator/src/pipeline.ts`
- **Action:** Add retry config and criticality for new stage
- **Details:**
  ```typescript
  const STAGE_RETRY_CONFIG = {
    // ... existing ...
    'timestamp-extraction': { maxRetries: 3, baseDelay: 2000 },
  };

  const STAGE_CRITICALITY = {
    // ... existing ...
    'timestamp-extraction': 'DEGRADED',  // Continue if fails, use estimated timings
  };
  ```

#### Task 2.6: Implement Estimated Timing Fallback
- **File:** `packages/timestamp-extraction/src/fallback.ts`
- **Action:** Implement character-weighted timing estimation for STT failures
- **Details:**
  ```typescript
  // See "Timestamp Fallback Strategy" section for full algorithm
  export function estimateWordTimings(
    segment: DirectionSegment,
    segmentStartSec: number,
    config?: EstimatedTimingConfig
  ): WordTiming[];

  export function applyEstimatedTimings(
    document: DirectionDocument,
    audioDurationSec: number
  ): DirectionDocument;
  ```
- **Fallback triggers:**
  - Google Cloud STT API error (timeout, quota, auth)
  - STT confidence < 80%
  - Word count mismatch > 20%

#### Task 2.7: Create Reference Test Audio Files
- **Location:** `packages/timestamp-extraction/src/__tests__/fixtures/`
- **Action:** Create 5 reference audio files with manual word boundary annotations
- **Details:**
  - `test-audio-01.wav` - 30 seconds, normal pace (150 WPM)
  - `test-audio-02.wav` - 30 seconds, fast pace (180 WPM)
  - `test-audio-03.wav` - 30 seconds, slow pace (120 WPM)
  - `test-audio-04.wav` - 60 seconds, mixed pace with pauses
  - `test-audio-05.wav` - 60 seconds, technical terms and numbers
  - Each file has corresponding `test-audio-XX.annotations.json`:
    ```json
    {
      "words": [
        { "word": "hello", "startMs": 0, "endMs": 450 },
        { "word": "world", "startMs": 500, "endMs": 920 }
      ]
    }
    ```
- **Use in tests:** Compare STT output to annotations, verify 95% within 100ms

#### Task 2.8: Implement Quality Gate for Timestamp Extraction
- **File:** `packages/timestamp-extraction/src/quality-gate.ts`
- **Action:** Implement stage-specific quality validation
- **Details:**
  - Validate word count match (90% threshold)
  - Validate no timing gaps > 500ms
  - Validate monotonic timing (no overlaps)
  - Validate processing time < 60 seconds
  - Return DEGRADED status with specific flags on failure

---

### Phase 3: Kinetic Layer (Motion Props)

#### Task 3.1: Define MotionConfig Interface
- **File:** `apps/video-studio/src/types.ts`
- **Action:** Add standardized motion configuration interface
- **Details:**
  ```typescript
  interface MotionConfig {
    entrance?: {
      type: 'fade' | 'slide' | 'pop' | 'scale' | 'none';
      direction?: 'left' | 'right' | 'up' | 'down';
      delay?: number;      // frames
      duration?: number;   // frames
    };
    emphasis?: {
      type: 'pulse' | 'shake' | 'glow' | 'underline' | 'none';
      trigger?: 'onWord' | 'onSegment' | 'continuous';
      intensity?: number;  // 0-1
    };
    exit?: {
      type: 'fade' | 'slide' | 'shrink' | 'none';
      direction?: 'left' | 'right' | 'up' | 'down';
      duration?: number;   // frames
    };
  }
  ```

#### Task 3.2: Create useMotion Hook
- **File:** `apps/video-studio/src/hooks/useMotion.ts`
- **Action:** Create shared hook for motion calculations
- **Details:**
  ```typescript
  function useMotion(config: MotionConfig, segmentDuration: number) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Calculate entrance animation progress
    // Calculate emphasis animation state
    // Calculate exit animation progress

    return {
      entranceStyle: { opacity, transform },
      emphasisStyle: { filter, transform },
      exitStyle: { opacity, transform },
      isEntering: boolean,
      isExiting: boolean,
    };
  }
  ```

#### Task 3.3: Update Component Prop Interfaces
- **File:** `apps/video-studio/src/types.ts`
- **Action:** Add `motion` prop to all component interfaces
- **Details:** Add to each existing interface:
  ```typescript
  interface NeuralNetworkAnimationProps {
    // ... existing props ...
    motion?: MotionConfig;
  }
  // Repeat for all 8 components
  ```

#### Task 3.4: Refactor Components to Use Motion Props
- **Files:** `apps/video-studio/src/components/*.tsx` (8 files)
- **Action:** Add motion support to each component with backward compatibility
- **Details per component:**
  1. Import `useMotion` hook
  2. Call hook with `props.motion ?? undefined` (explicit null check)
  3. Apply `entranceStyle` to container (neutral if no motion)
  4. Apply `emphasisStyle` to key elements
  5. Apply `exitStyle` at end of segment
  6. **Backward compatibility requirements:**
     - Component MUST render correctly when `motion` is undefined
     - `useMotion(undefined, duration)` returns neutral styles
     - No console warnings when motion prop omitted
     - Visual output identical to current behavior when no motion

- **Testing requirement per component:**
  ```typescript
  // In __tests__/{ComponentName}.test.tsx
  describe('backward compatibility', () => {
    it('renders without motion prop', async () => {
      const frame = await renderFrames({
        component: <ComponentName title="Test" />,  // No motion prop
        frames: [0, 15, 30]
      });
      expect(frame).toMatchSnapshot();  // Baseline snapshot
    });

    it('renders with motion prop', async () => {
      const frame = await renderFrames({
        component: <ComponentName title="Test" motion={{ preset: 'standard' }} />,
        frames: [0, 15, 30]
      });
      // Should differ from baseline due to animation
    });
  });
  ```

#### Task 3.5: Create KineticText Component
- **File:** `apps/video-studio/src/components/KineticText.tsx`
- **Action:** Create word-by-word animated text component
- **Details:**
  ```typescript
  interface KineticTextProps {
    text: string;
    wordTimings: WordTiming[];
    emphasis?: string[];       // Words to highlight
    emphasisEffect?: 'scale' | 'glow' | 'underline';
    style?: TextStyle;
  }

  // Each word appears at its wordTiming.startTime
  // Emphasized words get extra animation
  ```

#### Task 3.6: Update TechExplainer to Pass Motion Config
- **File:** `apps/video-studio/src/compositions/TechExplainer.tsx`
- **Action:** Wire motion config from direction.json to components
- **Details:**
  - Update TechExplainerSchema to accept direction document
  - Pass `segment.visual.motion` to each component
  - Pass word timings to KineticText components

---

### Phase 4: Immersion Layer (Audio)

#### Task 4.1: Create audio-mixer Package Structure
- **Files to Create:**
  - `packages/audio-mixer/package.json`
  - `packages/audio-mixer/tsconfig.json`
  - `packages/audio-mixer/src/index.ts`
  - `packages/audio-mixer/src/types.ts`
  - `packages/audio-mixer/src/ducking.ts`
  - `packages/audio-mixer/src/music-selector.ts`
  - `packages/audio-mixer/src/__tests__/ducking.test.ts`
- **Action:** Initialize package with audio processing utilities

#### Task 4.2: Implement Voice Activity Detection
- **File:** `packages/audio-mixer/src/ducking.ts`
- **Action:** Implement VAD-based ducking curve generation
- **Details:**
  ```typescript
  import { NonRealTimeVAD } from 'avr-vad';

  async function generateDuckingCurve(
    voiceAudioPath: string,
    config: DuckingConfig
  ): Promise<DuckingCurve> {
    // 1. Analyze voice track with avr-vad
    // 2. Detect speech segments
    // 3. Generate gain envelope (attack: 50ms, release: 300ms)
    // 4. Return time-indexed gain values
  }
  ```

#### Task 4.3: Implement Music Selection
- **File:** `packages/audio-mixer/src/music-selector.ts`
- **Action:** Mood-based music track selection using complete MusicLibrary schema
- **Details:** (See "Music Library Schema" section for full types)
  ```typescript
  // Load library from GCS
  export async function loadMusicLibrary(): Promise<MusicLibrary>;

  // Select optimal track
  export async function selectMusic(
    criteria: MusicSelectionCriteria,
    library?: MusicLibrary
  ): Promise<MusicTrack | null>;

  // Score tracks for selection
  function calculateTrackScore(
    track: MusicTrack,
    criteria: MusicSelectionCriteria
  ): number;

  // Handle looping for tracks shorter than target duration
  function prepareLoopedTrack(
    track: MusicTrack,
    targetDurationSec: number
  ): PreparedTrack;
  ```

#### Task 4.3b: Initialize Music Library Seed Data
- **Location:** `gs://nexus-ai-assets/music/library.json`
- **Action:** Create initial music library with placeholder tracks
- **Details:**
  - Minimum 3 tracks per mood (energetic, contemplative, urgent, neutral)
  - Include track metadata (see MusicLibrary schema)
  - Source royalty-free tracks from approved sources
  - Document licensing in each track entry
  - Create `library.json` index file:
    ```json
    {
      "version": "1.0.0",
      "updatedAt": "2026-01-27T00:00:00Z",
      "tracks": [
        {
          "id": "energetic-001",
          "filename": "energetic-tech-01.mp3",
          "mood": "energetic",
          "energy": "high",
          "tempo": { "bpm": 128, "timeSignature": "4/4" },
          "durationSec": 180,
          "hasLoop": true,
          "loopPoints": { "startSec": 8, "endSec": 172 },
          "format": "mp3",
          "sampleRate": 44100,
          "channels": 2,
          "peakDb": -1.2,
          "license": { "type": "royalty-free", "attribution": "AudioLibrary" },
          "gcsPath": "gs://nexus-ai-assets/music/energetic/energetic-tech-01.mp3",
          "tags": ["tech", "corporate", "upbeat"],
          "usageCount": 0
        }
      ]
    }
    ```

#### Task 4.3c: Implement SFX Library
- **Location:** `gs://nexus-ai-assets/sfx/library.json`
- **Action:** Create SFX library with categorized sound effects
- **Details:**
  ```typescript
  interface SFXLibrary {
    version: string;
    categories: {
      transitions: SFXTrack[];    // whoosh, swoosh, slide
      ui: SFXTrack[];             // click, beep, notification
      emphasis: SFXTrack[];       // pop, ding, reveal
      ambient: SFXTrack[];        // subtle background
    };
  }

  interface SFXTrack {
    id: string;
    filename: string;
    category: string;
    durationSec: number;
    gcsPath: string;
    tags: string[];
  }
  ```

#### Task 4.4: Implement Audio Mix Pipeline
- **File:** `packages/audio-mixer/src/index.ts`
- **Action:** FFmpeg-based audio mixing with ducking
- **Details:**
  ```typescript
  async function mixAudio(
    voiceTrackUrl: string,
    musicTrackUrl: string,
    duckingCurve: DuckingCurve,
    sfxTriggers: SFXTrigger[],
    outputPath: string
  ): Promise<MixedAudioResult> {
    // Use ffmpeg-static to:
    // 1. Apply ducking curve to music track
    // 2. Mix voice + ducked music
    // 3. Insert SFX at trigger points
    // 4. Normalize output levels
  }
  ```

#### Task 4.4b: Implement Quality Gate for Audio Mixer
- **File:** `packages/audio-mixer/src/quality-gate.ts`
- **Action:** Implement stage-specific audio quality validation
- **Details:**
  - Validate output duration matches input (< 1% difference)
  - Validate no clipping (peak < -0.5dB)
  - Validate voice levels (-9dB to -3dB peak)
  - Validate ducking applied (music < -18dB during speech)
  - Return audio analysis metrics for debugging

#### Task 4.5: Integrate Audio Mixer into Visual-Gen
- **File:** `packages/visual-gen/src/visual-gen.ts`
- **Action:** Call audio mixer before render, handle audio URL handoff
- **Details:** (See "Audio URL Flow" in Data Flow section)
  - Check if audio mixing is enabled for this pipeline
  - Select music based on `directionDocument.globalAudio.defaultMood`
  - Extract SFX cues from all segments
  - Generate ducking curve from voice track
  - Mix audio and store `mixedAudioUrl`
  - Pass `finalAudioUrl` (mixed or original) to render service
  - Handle fallback: if mixing fails, use original TTS audio

---

### Phase 5: Reality Layer (B-Roll)

#### Task 5.1: Create broll-engine Package Structure
- **Files to Create:**
  - `packages/broll-engine/package.json`
  - `packages/broll-engine/tsconfig.json`
  - `packages/broll-engine/src/index.ts`
  - `packages/broll-engine/src/types.ts`
  - `packages/broll-engine/src/code-renderer.ts`
  - `packages/broll-engine/src/browser-demo.ts`
- **Action:** Initialize B-Roll generation package

#### Task 5.2: Implement Code Snippet Renderer
- **File:** `packages/broll-engine/src/code-renderer.ts`
- **Action:** Generate typing-animation code snippets
- **Details:**
  ```typescript
  interface CodeSnippetConfig {
    code: string;
    language: string;
    highlightLines?: number[];
    typingSpeed?: number;  // chars per second
    theme?: 'dark' | 'light';
  }

  // Returns Remotion component props for animated code reveal
  function generateCodeSnippetProps(
    config: CodeSnippetConfig,
    duration: number
  ): CodeHighlightProps
  ```

#### Task 5.3: Implement Browser Demo Templates
- **File:** `packages/broll-engine/src/browser-demo.ts`
- **Action:** Generate simulated browser interaction sequences
- **Details:**
  ```typescript
  interface BrowserDemoConfig {
    url: string;
    actions: BrowserAction[];  // click, type, scroll, highlight
    viewport?: { width: number; height: number };
  }

  // Pre-defined templates for common demos:
  // - API request/response
  // - Form submission
  // - Dashboard interaction
  ```

#### Task 5.4: Update CodeHighlight Component for Typing Animation
- **File:** `apps/video-studio/src/components/CodeHighlight.tsx`
- **Action:** Add typing effect mode
- **Details:**
  - Add `typingEffect: boolean` prop
  - Add `typingSpeed: number` prop
  - Calculate visible characters based on frame
  - Add blinking cursor during typing

#### Task 5.5: Create BrowserFrame Component
- **File:** `apps/video-studio/src/components/BrowserFrame.tsx`
- **Action:** New component for browser simulation B-Roll
- **Details:**
  - Chrome-style browser chrome (address bar, tabs)
  - Accepts content as children or screenshot
  - Supports cursor animation, click ripples, scroll

---

### Phase 6: Integration & Duration Scaling

#### Task 6.1: Update TimelineJSON Schema for Dynamic Duration
- **File:** `packages/visual-gen/src/types.ts`
- **Action:** Support variable video duration based on content
- **Details:**
  ```typescript
  interface TimelineJSON {
    audioDurationSec: number;  // Now drives total video length
    targetDuration: '30s' | '1min' | '5min' | '8min' | 'auto';
    scenes: Scene[];
  }
  ```

#### Task 6.2: Update Scene Duration Calculation
- **File:** `packages/visual-gen/src/timeline.ts`
- **Action:** Calculate scene durations from word timings
- **Details:**
  - Each segment's duration = endTime of last word - startTime of first word
  - Add padding for entrance/exit animations
  - Total video duration = sum of segment durations

#### Task 6.3: Update Remotion Composition for Dynamic Duration
- **File:** `apps/video-studio/src/Root.tsx`
- **Action:** Set composition duration from timeline
- **Details:**
  ```typescript
  <Composition
    id="TechExplainer"
    component={TechExplainer}
    durationInFrames={Math.ceil(timeline.audioDurationSec * fps)}
    // ... rest
  />
  ```

---

## Acceptance Criteria

### Director Layer
- [ ] **AC1:** Given a research brief, when script-gen completes, then two artifacts exist: `script.md` (narration only, no brackets/cues) and `direction.json` (visual/audio blueprint)
- [ ] **AC2:** Given a direction.json, when parsed, then it validates against DirectionDocument schema with zero errors
- [ ] **AC3:** Given script.md fed to TTS, when audio generates, then no stage directions or visual cues are spoken aloud

### Timestamp Extraction
- [ ] **AC4:** Given TTS audio output, when timestamp-extraction runs, then word-level timings are extracted with <150ms accuracy
- [ ] **AC5:** Given timestamp-extraction failure, when stage errors, then pipeline continues with estimated timings (DEGRADED status)
- [ ] **AC6:** Given a 5-minute audio file, when timestamps extracted, then processing completes in <60 seconds

### Kinetic Layer
- [ ] **AC7:** Given a component with `motion.entrance.type: 'slide'`, when rendered, then component slides in from specified direction
- [ ] **AC8:** Given a component without motion prop, when rendered, then component displays correctly (backward compatible)
- [ ] **AC9:** Given word timings and emphasis words, when KineticText renders, then emphasized words animate with configured effect
- [ ] **AC10:** Given a segment with exit animation, when segment ends, then component animates out before next segment

### Immersion Layer
- [ ] **AC11:** Given voice track and music track, when audio mixed, then music ducks to -20dB during speech and returns to -12dB during silence
- [ ] **AC12:** Given direction.json with SFX cues, when audio mixed, then sound effects play at specified trigger points
- [ ] **AC13:** Given mixed audio, when analyzed, then voice peaks at -6dB and no clipping detected

### Reality Layer
- [ ] **AC14:** Given code snippet in direction.json, when rendered, then code appears character-by-character with syntax highlighting
- [ ] **AC15:** Given browser demo config, when rendered, then simulated browser with actions displays correctly

### Duration Scaling
- [ ] **AC16:** Given a 1200-word script, when rendered, then video duration is approximately 5-6 minutes
- [ ] **AC17:** Given a 1800-word script, when rendered, then video duration is approximately 7-8 minutes

---

## Additional Context

### Dependencies

#### New NPM Packages Required
| Package | Version | Purpose | Layer |
| ------- | ------- | ------- | ----- |
| `@google-cloud/speech` | ^6.0.0 | Word-level timestamp extraction | Timestamp Stage |
| `avr-vad` | ^1.0.0 | Voice activity detection for ducking | Immersion Layer |
| `ffmpeg-static` | ^5.0.0 | Audio mixing and processing | Immersion Layer |
| `wavefile` | ^11.0.0 | PCM ↔ WAV conversion | Timestamp Stage |

#### Internal Package Dependencies
```
packages/timestamp-extraction
├── @nexus-ai/core (StageInput/Output, withRetry, logger)
├── @google-cloud/speech
└── wavefile

packages/audio-mixer
├── @nexus-ai/core
├── avr-vad
└── ffmpeg-static

packages/broll-engine
├── @nexus-ai/core
└── (internal only - no external deps for Phase 1)
```

#### GCP Resources Required
- Google Cloud Speech-to-Text API enabled
- Secret: `nexus-gcp-speech-credentials` (service account key)
- GCS bucket paths for:
  - Music library: `gs://nexus-ai-assets/music/`
  - SFX library: `gs://nexus-ai-assets/sfx/`

---

### Testing Strategy

#### Unit Tests

| Package | Test File | Coverage |
| ------- | --------- | -------- |
| script-gen | `__tests__/direction-schema.test.ts` | DirectionDocument validation, content/direction separation |
| timestamp-extraction | `__tests__/timestamp-extraction.test.ts` | STT integration mock, word timing parsing |
| audio-mixer | `__tests__/ducking.test.ts` | VAD detection, gain curve generation |
| audio-mixer | `__tests__/music-selector.test.ts` | Mood matching, duration selection |
| broll-engine | `__tests__/code-renderer.test.ts` | Typing animation props, highlight lines |
| video-studio | `__tests__/useMotion.test.ts` | Hook calculations for entrance/exit/emphasis |

#### Integration Tests

| Test | Scope | Approach |
| ---- | ----- | -------- |
| Pipeline stage wiring | Orchestrator | Mock stage executors, verify data flow |
| Timestamp → Visual-gen | Cross-package | Real audio file, verify timing propagation |
| Audio mix → Render | Cross-package | Verify mixed audio URL in render props |

#### Component Tests (Remotion)

| Component | Test Approach |
| --------- | ------------- |
| All 8 components + motion | Use `<Thumbnail>` to capture frames at entrance/emphasis/exit points |
| KineticText | Verify word visibility at specific frames matches word timings |
| BrowserFrame | Visual snapshot at key interaction points |

#### Manual Testing Checklist

- [ ] Generate full video with new pipeline, verify no stage directions spoken
- [ ] Compare audio levels: voice vs music vs SFX
- [ ] Review motion animations for natural feel (not too fast/slow)
- [ ] Verify video duration scales correctly with script length
- [ ] Check B-Roll code typing doesn't outpace narration

---

### Notes

#### High-Risk Items
1. **Google Cloud STT accuracy** - Word boundaries may drift on fast speech. Mitigation: Add 50ms padding to word timings.
2. **Audio sync drift** - Long videos may accumulate sync errors. Mitigation: Re-anchor timing every 30 seconds.
3. **Motion prop complexity** - Too many animation options can overwhelm. Mitigation: Start with 3 presets (subtle, standard, dramatic).

#### Known Limitations
- Music library is manually curated (no AI selection in Phase 1)
- Browser demos are template-based (not real browser capture)
- B-Roll limited to code + browser demos (no stock footage API yet)

#### Future Considerations (Out of Scope)
- AI-powered music generation (beyond mood selection)
- Real browser capture via Puppeteer for authentic demos
- Stock footage API integration (Pexels, Unsplash)
- Multi-language TTS with per-language word timing models

---

**Research Document:** See `_bmad-output/planning-artifacts/research/technical-remotion-cinematic-pipeline-research-2026-01-27.md` for detailed technical research including:
- Remotion animation APIs (interpolate, spring, Sequence, Series)
- Google Cloud STT word timestamp extraction code samples
- VAD libraries for Node.js (avr-vad recommended)
- Professional audio ducking parameters
- Kinetic typography design patterns
- Reference channel analysis (Fireship, Vox, Two Minute Papers)
