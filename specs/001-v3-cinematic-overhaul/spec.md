# Feature Specification: V3 Cinematic Engine Overhaul

**Feature Branch**: `001-v3-cinematic-overhaul`
**Created**: 2026-02-21
**Status**: Draft
**Input**: User description: "Nexus-AI V3 Overhaul — upgrade the automated video pipeline to a dynamic, retention-driven cinematic engine across 5 pillars: critical system fixes, Neon Hacker rebrand, visual sandwich mixing, contextual Playwright capture, and retention-driven script generation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Correct Audio Output (Priority: P0)

As a pipeline operator, I run the full local pipeline and receive a
rendered video where the narration audio plays at the correct pitch
and speed — no chipmunk effect, no distorted segments — and the
background music drops to complete silence for 1 second before
high-impact scenes (stat-callout, text-emphasis, full-screen-text,
cold-open), then smoothly fades back in.

**Why this priority**: Audio bugs are the single most obvious quality
defect. A chipmunk voice makes the entire video unusable regardless of
visual quality. Silence drops before impact scenes are a proven
retention technique used by Fireship and similar channels.

**Independent Test**: Run the pipeline with a 60-second test script
containing at least 3 segments. Play back the output MP4 and verify
narration pitch matches the original TTS source files. Confirm
silence drops are audible before tagged impact scenes.

**Acceptance Scenarios**:

1. **Given** a pipeline run with 10+ TTS segments at varying lengths,
   **When** the audio stitcher combines them,
   **Then** the output WAV header sample rate and channel count match
   the raw PCM data of every stitched segment (no resampling artifacts).
2. **Given** a scene classified as `stat-callout` with `pacing: punch`,
   **When** the audio mixer generates the ducking curve,
   **Then** music volume drops to 0 dB (silence) for 1 second before
   that scene's start time, then fades back to the configured music
   level over 300 ms.
3. **Given** a pipeline run in local mode,
   **When** the render completes,
   **Then** A/V sync deviation is less than 100 ms across the full
   video duration.

---

### User Story 2 — V2 Director Scenes Render in Production (Priority: P0)

As a pipeline operator, I deploy the render service and it fetches
the V2 Director scenes format (not just the V1 timeline), so that
all 16 scene types render with their enriched visual data — screenshots,
overlays, annotations, and AI backgrounds — instead of the legacy
component-mapped timeline.

**Why this priority**: The V2 path has been built across 10+ phases
but the render-service still only passes V1 timeline format. Every
enrichment feature (screenshots, annotations, overlays, maps) is
dead code in production until this disconnect is fixed.

**Independent Test**: Deploy the render service with a test payload
containing V2 Director scenes. Verify the output video contains
scene-type-specific visuals (e.g., MapAnimation with highlighted
countries, CodeBlock with syntax highlighting) rather than
fallback/unknown components.

**Acceptance Scenarios**:

1. **Given** a V2 Director payload with `version: 'v2-director'` and
   a `scenes` array,
   **When** the render service processes it,
   **Then** it passes the scenes array directly to TechExplainer
   (not the timeline format) and the composition renders via SceneRouter.
2. **Given** a V1 timeline payload (without `scenes` array),
   **When** the render service processes it,
   **Then** it continues to render via the legacy COMPONENT_MAP path
   with no regressions.
3. **Given** the V2 path is active,
   **When** `wordTimings` and `impactWords` are present in the payload,
   **Then** they are forwarded to SceneRouter for synchronized captions
   and impact flash effects.

---

### User Story 3 — Neon Hacker Visual Identity (Priority: P1)

As a viewer, I watch a Nexus-AI video and experience a cohesive
"Neon Hacker" aesthetic: deep black backgrounds (#0a0a0a–#111111),
neon green (#aaff00) accents on all text glows, particle effects,
grid overlays, and UI chrome. No cyan or violet colors appear anywhere
in the video.

**Why this priority**: Visual identity is the most recognizable quality
signal. Mixed or inconsistent palettes undermine brand recognition and
feel amateurish. This is the foundation for all subsequent visual work.

**Independent Test**: Render a 30-second test clip with at least 5
different scene types. Visually inspect for any cyan (#00d4ff) or
violet (#8b5cf6) remnants. Verify neon green is the dominant accent.

**Acceptance Scenarios**:

1. **Given** any scene type rendered by the pipeline,
   **When** it displays text with glow effects,
   **Then** the glow color derives from #aaff00 (neon green), not
   #00d4ff (cyan).
2. **Given** the ParticleField overlay,
   **When** it renders,
   **Then** particles are neon green on a deep black background.
3. **Given** the GridOverlay,
   **When** it renders the pulse animation,
   **Then** the bright traveling line uses neon green.
4. **Given** the three new cinematic components (GlassPanel,
   FloatingTerminal, HudOverlay),
   **When** they render,
   **Then** GlassPanel uses backdrop-filter blur with neon green
   borders, FloatingTerminal applies 2.5D perspective transforms for
   screenshot display, and HudOverlay shows corner crosshairs with a
   running timecode — all in the Neon Hacker palette.

---

### User Story 4 — Visual Sandwich Sequences (Priority: P2)

As a pipeline operator, I run the pipeline and the director agent
produces "visual sequences" that mix three visual layers across
segments: Abstract Concepts (AI-generated "Nano Banana" images with
cyberpunk aesthetic), Evidence (deep screenshots of relevant sources),
and Showcases (simulated scrolling captures of products/platforms).
The final video alternates between these layers to maintain visual
variety and viewer engagement.

**Why this priority**: Visual monotony (e.g., 30 consecutive
gradient backgrounds) is the #2 reason viewers click away after
audio quality. Mixing three distinct visual layers creates the
information-dense feel of Fireship-style content.

**Independent Test**: Run the pipeline with a tech topic that mentions
at least 3 companies and 2 statistics. Verify the output video
contains at least one of each visual layer type and that no more than
3 consecutive scenes share the same visual layer.

**Acceptance Scenarios**:

1. **Given** the director agent classifies 20 scenes,
   **When** it assigns visual sequences,
   **Then** each scene is tagged with a visual layer:
   `abstract-concept`, `evidence-screenshot`, or `showcase-scroll`.
2. **Given** a scene tagged `abstract-concept`,
   **When** the AI image enricher generates its background,
   **Then** it uses the Nano Banana prompt: "Cyberpunk, minimalist,
   strictly deep black background with bright neon green glowing
   accents, no text".
3. **Given** 10 consecutive narration scenes,
   **When** visual layers are assigned,
   **Then** no more than 3 consecutive scenes share the same layer type.

---

### User Story 5 — Contextual Playwright Capture (Priority: P2)

As a pipeline operator, I configure screenshot enrichment with optional
CSS selectors and text highlights. When screenshots are captured, the
system can crop to a specific page region and draw a neon green
highlight box around specified text. Full-page vertical captures are
supported and render as animated scrolling sequences in the video.

**Why this priority**: Generic full-page screenshots often show
irrelevant content (navigation bars, cookie banners). Targeted captures
with highlights direct viewer attention to the evidence that supports
the narration, matching Fireship's "show the proof" style.

**Acceptance Scenarios**:

1. **Given** a screenshot request with `cssSelector: '.pricing-table'`,
   **When** Playwright captures the page,
   **Then** the output image is cropped to the bounding box of that
   CSS selector (plus reasonable padding).
2. **Given** a screenshot request with `highlightText: 'GPT-4 Turbo'`,
   **When** the text exists on the page,
   **Then** Playwright draws a neon green (#aaff00) rectangle around
   the matched text region in the screenshot.
3. **Given** a full-page vertical screenshot of a long documentation page,
   **When** it renders as a ScrollingCapture scene,
   **Then** the scene animates a vertical pan (translateY) from top to
   bottom at a readable speed, simulating a screen recording scroll.
4. **Given** Playwright fails to find the CSS selector or highlight text,
   **When** the capture completes,
   **Then** it silently falls back to a standard viewport screenshot
   without crashing the pipeline.

---

### User Story 6 — Retention-Driven Script Structure (Priority: P3)

As a pipeline operator, I run the script generation step and the
output script follows YouTube retention psychology: a high-energy
pattern-interrupt hook in the first 0–15 seconds, contextual setup
in 15–45 seconds, and "open loop" unresolved questions sprinkled
throughout the script to sustain curiosity.

**Why this priority**: Script structure determines the video's
retention curve. The current script generation produces informative
but flat narration. Adding hook/context/open-loop psychology is the
highest-leverage improvement for YouTube audience retention.

**Independent Test**: Generate scripts for 3 different topics. Verify
each script's first segment is a hook (question, bold claim, or
surprising fact), the second segment provides context, and at least 2
open-loop markers appear before the script's midpoint.

**Acceptance Scenarios**:

1. **Given** a topic about a new AI model,
   **When** the script generator produces output,
   **Then** the first segment (0–15s) contains a pattern-interrupt
   hook: a provocative question, a surprising statistic, or a bold
   claim that creates curiosity.
2. **Given** the generated script,
   **When** the second and third segments render (15–45s),
   **Then** they provide context: what the topic is, why it matters
   now, and who is affected.
3. **Given** the full generated script,
   **When** analyzed for open loops,
   **Then** at least 2 unresolved questions or teases appear before
   the script's midpoint, each of which is eventually resolved
   later in the script.
4. **Given** the hook segment,
   **When** the director classifies it,
   **Then** it receives `pacing: punch` and an impactful scene type
   (stat-callout, text-emphasis, or full-screen-text).

---

### Edge Cases

- What happens when TTS segments have mixed sample rates (e.g., 24000 Hz
  from AI Studio TTS vs 44100 Hz from edge-tts)? The stitcher MUST
  resample all segments to a common rate before concatenation.
- What happens when Playwright times out on a screenshot capture?
  The enricher MUST skip that scene's screenshot and continue
  (silent fallback per Constitution Principle X).
- What happens when the Nano Banana prompt produces an image with
  unintended text? The AI image enricher MUST include "no text, no
  words, no letters" in the negative prompt.
- What happens when a topic has no companies to screenshot? The visual
  sandwich algorithm MUST increase the proportion of abstract-concept
  and showcase-scroll layers instead of leaving empty scenes.
- What happens when a scene's assigned visual layer cannot be fulfilled
  (e.g., no screenshot URL for `evidence-screenshot`)? The enricher
  MUST cascade: `evidence → showcase → abstract`. If screenshot fails,
  try scroll capture; if that also fails, generate a Nano Banana AI
  image. Every scene MUST have a visual — no empty gradient fallbacks.
- What happens when the script generator fails to produce open loops?
  The pipeline MUST still produce a valid script; open loops are a
  quality enhancement, not a hard requirement.

## Requirements *(mandatory)*

### Functional Requirements

**Pillar 1 — Critical System Fixes**

- **FR-001**: The audio stitcher MUST read each segment's actual sample
  rate from its WAV header and resample all segments to a common rate
  (44100 Hz) before concatenation.
- **FR-002**: The audio stitcher MUST write the output WAV header with
  channel count and sample rate matching the actual concatenated PCM data.
- **FR-003**: The render service MUST detect V2 Director payloads
  (presence of `scenes` array) and pass them to TechExplainer as
  `{ scenes, totalDurationFrames, audioUrl, wordTimings, impactWords }`.
- **FR-004**: The render service MUST continue to accept V1 timeline
  payloads and render them via the legacy COMPONENT_MAP path.
- **FR-005**: The audio mixer MUST support a "silence drop" ducking mode
  that mutes music to 0 dB for 1 second before scenes matching any of
  these 4 trigger conditions: scene type `stat-callout`, `text-emphasis`,
  `full-screen-text`, or `isColdOpen === true` (cold-open intro).
- **FR-006**: The silence drop MUST fade music back in over 300 ms after
  the 1-second silence window.

**Pillar 2 — Neon Hacker Rebrand**

- **FR-007**: The theme configuration MUST define primary accent as
  `#aaff00` and background range as `#0a0a0a` to `#111111`.
- **FR-008**: The `textGlow()` utility MUST produce glow effects using
  `#aaff00` as the default glow color.
- **FR-009**: ParticleField MUST render particles in neon green
  (`#aaff00`) on deep black backgrounds.
- **FR-010**: GridOverlay pulse animation MUST use neon green for the
  traveling bright line.
- **FR-011**: A GlassPanel component MUST be created that renders a
  translucent panel with backdrop-filter blur and neon green border.
- **FR-012**: A FloatingTerminal component MUST be created that displays
  screenshots with 2.5D perspective transforms (CSS perspective +
  rotateX/rotateY).
- **FR-013**: A HudOverlay component MUST be created that renders corner
  crosshairs and a running timecode counter in neon green.
- **FR-014**: No component in the video-studio app may reference the
  old cyan (`#00d4ff`) or violet (`#8b5cf6`) colors after migration.
  Migration strategy: big-bang update of `theme.ts` and `colors.ts`
  centralized constants in a single commit, followed by a sweep of
  all components for hardcoded hex remnants. Components that reference
  `COLORS.*` or `THEME.colors.*` inherit the new palette automatically.

**Pillar 3 — Visual Sandwich Mixing**

- **FR-015**: The director agent MUST assign a `visualLayer` field to
  each classified scene: `abstract-concept`, `evidence-screenshot`,
  or `showcase-scroll`.
- **FR-016**: The visual layer assignment MUST enforce a maximum of 3
  consecutive scenes with the same layer type.
- **FR-017**: Scenes tagged `abstract-concept` MUST use the Nano Banana
  prompt for AI image generation: "Cyberpunk, minimalist, strictly deep
  black background with bright neon green glowing accents, no text".
- **FR-018**: Scenes tagged `evidence-screenshot` MUST be prioritized
  for source/content/company screenshot enrichment.
- **FR-019**: Scenes tagged `showcase-scroll` MUST be prioritized for
  full-page scrolling capture.
- **FR-019a**: When an enricher cannot fulfill a scene's assigned
  `visualLayer`, it MUST cascade in fixed priority order:
  `evidence-screenshot → showcase-scroll → abstract-concept`. The
  final fallback (Nano Banana AI image) MUST always succeed. No scene
  may remain without a visual.

**Pillar 4 — Contextual Playwright Capture**

- **FR-020**: The Playwright screenshot function MUST accept an optional
  `cssSelector` parameter that crops the capture to the specified
  element's bounding box.
- **FR-020a**: The director agent MUST generate `cssSelector` and
  `highlightText` hints per scene as part of `visualData` for scenes
  tagged with `visualLayer: evidence-screenshot` or `showcase-scroll`.
  These are best-effort LLM suggestions — Playwright MUST silently
  ignore invalid selectors or unmatched text (FR-024).
- **FR-021**: The Playwright screenshot function MUST accept an optional
  `highlightText` parameter that draws a neon green (#aaff00) rectangle
  around matched text on the page before capture.
- **FR-022**: The Playwright screenshot function MUST support full-page
  vertical captures (beyond viewport height).
- **FR-023**: A ScrollingCapture scene component MUST be created that
  animates a vertical translateY pan over a full-page screenshot at a
  fixed scroll speed of 500 px/sec (approximately 17 px/frame at 30fps).
  For a 10,000px page this produces ~20 seconds of scroll animation.
- **FR-024**: All Playwright failures (timeout, selector not found,
  text not found) MUST fall back silently to a standard viewport
  screenshot or skip, per Constitution Principle X.

**Pillar 5 — Retention-Driven Script Generation**

- **FR-025**: The script generation prompt MUST instruct the LLM to
  structure the first segment (0–15s) as a pattern-interrupt hook
  (provocative question, surprising statistic, or bold claim).
- **FR-026**: The script generation prompt MUST instruct the LLM to
  structure segments 2–3 (15–45s) as context (what, why now, who).
- **FR-027**: The script generation prompt MUST instruct the LLM to
  include at least 2 "open loop" unresolved questions before the
  script's midpoint, each resolved later in the script.
- **FR-028**: The optimizer agent MUST tag hook segments with
  `type: hook` in the DirectionDocument output.

### Key Entities

- **Visual Layer**: A classification of a scene's primary visual
  strategy. One of `abstract-concept`, `evidence-screenshot`, or
  `showcase-scroll`. Assigned by the director agent after scene
  classification. Consumed by visual-gen enrichers to prioritize
  the appropriate visual source.
- **Silence Drop**: A 1-second music mute region inserted before
  high-impact scenes. Defined by a start time (scene start minus
  1 second) and a fade-back duration (300 ms). Generated by the
  audio mixer's ducking curve builder.
- **Nano Banana Prompt**: A fixed AI image generation prompt
  optimized for the Neon Hacker aesthetic. Used exclusively for
  scenes with `visualLayer: abstract-concept`.
- **Open Loop**: A narrative device where an unresolved question
  or tease is introduced early in the script and resolved later.
  Tagged in the DirectionDocument segment metadata.

### Assumptions

- The Gemini model for script generation remains `gemini-3.1-pro-preview`
  (the user mentioned "Gemini 3.1 Pro" which is assumed to be the
  same model family with updated prompts, not a new model endpoint).
- Full-page Playwright captures will produce images up to ~10,000px
  tall. These are materialized to disk (not data URIs) per existing
  Constitution Principle VI.
- The `audio-mixer` package already has the FFmpeg ducking
  infrastructure; silence drops extend the existing `generateDuckingCurve()`
  function rather than replacing it.
- ScrollingCapture is a new scene type (the 17th), requiring updates
  to `scenes.ts`, `SceneRouter.tsx`, and `scene-classifier.ts`.
- The Nano Banana prompt is hardcoded in the director agent, not
  configurable per-run.

## Clarifications

### Session 2026-02-21

- Q: What should happen when the assigned visual layer cannot be fulfilled? → A: Cascade in fixed priority: evidence → showcase → abstract. Nano Banana AI image is the terminal fallback. No scene may remain without a visual.
- Q: Where do `cssSelector` and `highlightText` values come from for each screenshot? → A: LLM-generated by the director agent per scene as part of `visualData`. Best-effort hints — Playwright silently ignores invalid selectors or unmatched text.
- Q: What scroll speed should ScrollingCapture use? → A: Fixed 500 px/sec (~17 px/frame at 30fps). A 10,000px page produces ~20 seconds of scroll animation.
- Q: Should the Neon Hacker palette migration be big-bang or incremental? → A: Big-bang at source. Update `theme.ts` + `colors.ts` constants in one commit, then sweep for hardcoded hex remnants. No feature flags or parallel palettes.
- Q: Which scene types should trigger a silence drop? → A: 4 types: `stat-callout`, `text-emphasis`, `full-screen-text`, and cold-open intro (`isColdOpen === true`). Moderate scope preserves dramatic impact without dilution.
- Q: What is the relationship between `scrolling-capture` (scene type) and `showcase-scroll` (visual layer)? → A: They serve different purposes. `showcase-scroll` is a visual LAYER assigned by `assignVisualLayers()` — it tells the enricher to prioritize a full-page screenshot as the scene's BACKGROUND (e.g., a `narration-default` scene with a scrolling page behind the narration). `scrolling-capture` is a scene TYPE — the entire scene IS a dedicated vertical pan over a full-page screenshot with no narration overlay, like a "let me show you this page" moment. The director classifies a scene as `scrolling-capture` when the segment is explicitly about showing/demonstrating a page rather than narrating over it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pipeline-rendered videos contain zero chipmunk/pitch
  artifacts in narration audio across 10 consecutive test runs.
- **SC-002**: V2 Director scenes render correctly in the render
  service, producing videos with all 16+ scene types visible
  (not fallback components).
- **SC-003**: 100% of rendered frames use the Neon Hacker palette
  (#aaff00 accent, #0a0a0a–#111111 backgrounds) with zero instances
  of the old cyan (#00d4ff) or violet (#8b5cf6).
- **SC-004**: In a 90-scene video, no more than 3 consecutive scenes
  share the same visual layer (abstract/evidence/showcase).
- **SC-005**: Playwright captures with `cssSelector` crop within ±20px
  of the target element's bounding box.
- **SC-006**: Playwright captures with `highlightText` correctly
  highlight the target text with a visible neon green rectangle in
  95%+ of cases where the text is present on the page.
- **SC-007**: Generated scripts contain a recognizable hook in the
  first 15 seconds and at least 2 open loops before the midpoint in
  80%+ of generations.
- **SC-008**: Full pipeline (script → render) completes within 150%
  of current pipeline duration (no more than 50% slower due to new
  enrichment steps).
- **SC-009**: All Playwright failures degrade silently — zero pipeline
  crashes caused by screenshot capture errors across 20 test runs.
