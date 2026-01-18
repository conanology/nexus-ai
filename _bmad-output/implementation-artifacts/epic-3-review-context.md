# Epic 3: Media Production Pipeline

## Story

**Goal:** Transform scripts into professional video content with proper audio and original visuals.

**User Outcome:** Scripts become publish-ready videos with synthesized audio, animated visuals, and A/B thumbnail variants.

## Acceptance Criteria

### Story 3.1: Create TTS Package
**Given** SSML-tagged script from Epic 2
**When** I create the `@nexus-ai/tts` package
**Then** package structure follows architecture:
- `src/index.ts` exports public API
- `src/types.ts` defines TTS-specific types
- `src/tts.ts` for main stage logic
- `src/audio-quality.ts` for quality checks
- `src/chunker.ts` for script chunking
**And** `executeTTS()` stage function per FR16:
- Takes SSML-tagged script as input
- Uses TTS provider with fallback chain (Gemini → Chirp → WaveNet)
- Synthesizes audio at 44.1kHz WAV format
- Stores audio to Cloud Storage at `{date}/tts/audio.wav`
- Returns `StageOutput` with audio artifact reference
**And** TTS options include:
- Voice selection (configurable)
- Speaking rate (0.9-1.1x normal)
- Pitch adjustment
**And** stage uses `executeStage` wrapper
**And** stage tracks costs via `CostTracker`
**And** provider tier is tracked in output (primary vs fallback)

### Story 3.2: Implement Audio Chunking and Stitching
**Given** TTS package from Story 3.1
**When** I implement audio chunking and stitching per FR17
**Then** `chunkScript(script: string, maxChars: number)` splits scripts:
- Default maxChars = 5000 (API limit)
- Chunks at sentence boundaries (never mid-sentence)
- Preserves SSML tags across chunks
- Returns array of chunk strings with indices
**And** each chunk is synthesized independently
**And** `stitchAudio(segments: AudioSegment[])` combines:
- Concatenates WAV segments in order
- Adds configurable silence between segments (default: 200ms)
- Normalizes audio levels across segments
- Outputs single WAV file
**And** individual segments stored at `{date}/tts/audio-segments/{index}.wav`
**And** final stitched audio at `{date}/tts/audio.wav`
**And** quality checks per TTS quality gate:
- Silence detection: <5% of total duration
- Clipping detection: no samples at max amplitude
- Duration validation: matches expected from word count
**And** if quality check fails, stage returns DEGRADED status

### Story 3.3: Create Visual Generation Package
**Given** script with visual cues from Epic 2
**When** I create the `@nexus-ai/visual-gen` package
**Then** package structure follows architecture:
- `src/index.ts` exports public API
- `src/types.ts` defines visual-specific types
- `src/visual-gen.ts` for main stage logic
- `src/scene-mapper.ts` for cue-to-template mapping
- `src/timeline.ts` for timeline generation
**And** `SceneMapper` class per FR18:
- Parses `[VISUAL: description]` cues from script
- Maps descriptions to Remotion component names
- Uses keyword matching and LLM fallback for ambiguous cues
- Returns `SceneMapping[]` with component, props, duration
**And** visual cue types supported:
- `neural network` → NeuralNetworkAnimation
- `data flow` → DataFlowDiagram
- `comparison` → ComparisonChart
- `metrics` → MetricsCounter
- `product mockup` → ProductMockup
- `code block` → CodeHighlight
- `transition` → BrandedTransition
**And** `generateTimeline()` per FR19:
- Creates scene timeline JSON with timing
- Aligns scenes to audio duration
- Ensures scene change every ~30 seconds (NFR visual coverage)
- Outputs timeline to `{date}/visual-gen/scenes.json`

### Story 3.4: Implement Remotion Video Studio
**Given** visual generation package from Story 3.3
**When** I implement the Remotion video studio
**Then** `apps/video-studio/` is created via `npm create video@latest`
**And** Remotion project structure includes:
- `src/Root.tsx` with composition registration
- `src/compositions/TechExplainer.tsx` main video composition
- `src/components/` with 5-7 visual components per FR18-20
- `src/hooks/` for animation utilities
**And** visual components implemented:
1. `NeuralNetworkAnimation` - animated NN diagram
2. `DataFlowDiagram` - pipeline/flow visualization
3. `ComparisonChart` - side-by-side comparison
4. `MetricsCounter` - animated stat counters
5. `ProductMockup` - generic UI frame
6. `CodeHighlight` - syntax-highlighted code
7. `BrandedTransition` - NEXUS-AI branded wipes
**And** `LowerThird` component for source citations
**And** all components follow NEXUS visual language:
- Consistent color palette (defined in theme)
- Smooth animations (60fps capable)
- Responsive to props (duration, data)
**And** `TechExplainer` composition:
- Accepts timeline JSON and audio URL
- Renders scenes in sequence
- Syncs visuals to audio duration
- Outputs 1920x1080 @ 30fps per FR20
**And** local preview works via `pnpm dev` in video-studio

### Story 3.5: Implement Visual Fallbacks
**Given** Remotion components from Story 3.4
**When** I implement visual fallbacks per FR21
**Then** `TextOnGradient` fallback component is created:
- Displays key text from visual cue
- Uses NEXUS brand gradient background
- Animates text entrance/exit
- Works for any visual cue type
**And** scene mapper fallback logic:
- If no template matches cue, use `TextOnGradient`
- Log warning with unmapped cue for future template creation
- Include cue text as component prop
**And** fallback tracking in quality metrics:
- Count of scenes using fallback
- Percentage of fallback usage
- If >30% fallback, flag as DEGRADED quality
**And** `executeVisualGen()` stage function:
1. Parse visual cues from script
2. Map to components (with fallbacks)
3. Generate timeline JSON
4. Store timeline and track quality
5. Return `StageOutput` with timeline artifact

### Story 3.6: Create Render Service
**Given** Remotion video studio from Story 3.4
**When** I create the render service
**Then** `apps/render-service/` Cloud Run app is created
**And** service configuration per architecture:
- 4 CPU, 8GB RAM allocation
- Timeout: 45 minutes (NFR7)
- Concurrency: 1 (one render at a time)
- Min instances: 0 (scale to zero)
**And** render endpoint `/render` accepts:
- `pipelineId`: string (YYYY-MM-DD)
- `timelineUrl`: Cloud Storage URL to scenes.json
- `audioUrl`: Cloud Storage URL to audio.wav
**And** render process:
1. Download timeline and audio from Cloud Storage
2. Execute Remotion render with timeline data
3. Output MP4 1920x1080 @ 30fps
4. Upload to `{date}/render/video.mp4`
5. Return video URL and duration
**And** render quality gate checks per FR20:
- Zero frame drops
- Audio sync within 100ms
- File size reasonable for duration
**And** render logs progress percentage
**And** health endpoint `/health` for monitoring
**And** Dockerfile configured for Remotion rendering

### Story 3.7: Create Thumbnail Package
**Given** script and topic from Epic 2
**When** I create the `@nexus-ai/thumbnail` package
**Then** package structure includes:
- `src/index.ts` exports public API
- `src/thumbnail.ts` for main stage logic
- `src/template-fallback.ts` for fallback generation
**And** `executeThumbnail()` stage function per FR22:
- Takes topic title and key visual concept as input
- Uses Image provider (Gemini 3 Pro Image)
- Generates 3 A/B thumbnail variants
- Each variant: 1280x720 PNG
- Stores to `{date}/thumbnails/{1,2,3}.png`
**And** thumbnail prompts include:
- Topic title as text overlay area
- Key visual concept from script
- NEXUS-AI brand elements
- High contrast, YouTube-optimized
**And** thumbnail variations:
- Variant 1: Bold text focus
- Variant 2: Visual concept focus
- Variant 3: Mixed approach
**And** stage tracks costs via `CostTracker`
**And** quality gate verifies 3 variants generated (NFR22)
**And** output includes artifact references to all 3 thumbnails

### Story 3.8: Implement Thumbnail Fallbacks
**Given** thumbnail package from Story 3.7
**When** I implement thumbnail fallbacks per FR23
**Then** `generateTemplateThumbnail(title: string, variant: number)` function:
- Uses pre-designed template images
- Overlays topic title text
- Applies NEXUS-AI branding
- Outputs 1280x720 PNG
**And** template assets stored in `data/templates/thumbnails/`:
- `template-1.png` - Bold text template
- `template-2.png` - Visual focus template
- `template-3.png` - Mixed template

## Tasks / Subtasks

- [x] Story 3.1: Create TTS Package
- [x] Story 3.2: Implement Audio Chunking and Stitching
- [x] Story 3.3: Create Visual Generation Package
- [x] Story 3.4: Implement Remotion Video Studio
- [x] Story 3.5: Implement Visual Fallbacks
- [x] Story 3.6: Create Render Service
- [x] Story 3.7: Create Thumbnail Package
- [x] Story 3.8: Implement Thumbnail Fallbacks

## Dev Agent Record

### File List
- packages/tts/src/index.ts
- packages/tts/src/types.ts
- packages/tts/src/tts.ts
- packages/tts/src/audio-quality.ts
- packages/tts/src/chunker.ts
- packages/tts/src/__tests__/audio-quality.test.ts
- packages/tts/src/__tests__/chunker.test.ts
- packages/tts/src/__tests__/stitching.test.ts
- packages/tts/src/__tests__/tts-chunking-integration.test.ts
- packages/tts/src/__tests__/tts.test.ts
- packages/visual-gen/src/index.ts
- packages/visual-gen/src/types.ts
- packages/visual-gen/src/visual-gen.ts
- packages/visual-gen/src/scene-mapper.ts
- packages/visual-gen/src/timeline.ts
- packages/visual-gen/src/visual-cue-parser.ts
- packages/visual-gen/src/__tests__/scene-mapper.test.ts
- packages/visual-gen/src/__tests__/timeline.test.ts
- packages/visual-gen/src/__tests__/visual-cue-parser.test.ts
- apps/video-studio/src/Root.tsx
- apps/video-studio/src/index.ts
- apps/video-studio/src/compositions/TechExplainer.tsx
- apps/video-studio/src/components/NeuralNetworkAnimation.tsx
- apps/video-studio/src/components/DataFlowDiagram.tsx
- apps/video-studio/src/components/ComparisonChart.tsx
- apps/video-studio/src/components/MetricsCounter.tsx
- apps/video-studio/src/components/ProductMockup.tsx
- apps/video-studio/src/components/CodeHighlight.tsx
- apps/video-studio/src/components/BrandedTransition.tsx
- apps/video-studio/src/components/TextOnGradient.tsx
- apps/video-studio/src/__tests__/TechExplainer.test.tsx
- apps/render-service/src/index.ts
- apps/render-service/src/render.ts
- apps/render-service/src/index.test.ts
- apps/render-service/src/render.test.ts
- packages/thumbnail/src/index.ts
- packages/thumbnail/src/thumbnail.ts
- packages/thumbnail/src/prompts.ts
- packages/thumbnail/src/types.ts
- packages/thumbnail/src/thumbnail.test.ts
- packages/core/src/providers/tts/gemini-tts-provider.ts
- packages/core/src/providers/tts/chirp-provider.ts
- packages/core/src/providers/tts/wavenet-provider.ts
- packages/core/src/providers/image/gemini-image-provider.ts
- packages/core/src/providers/image/template-thumbnailer.ts
