# Visual Rendering Stack

Every frame rendered by Remotion composites multiple visual layers. This document describes each layer from bottom to top.

## Layer Stack

| Z-Index | Layer | Component | File |
|---------|-------|-----------|------|
| 0 | Background gradient | Scene component | Per-scene (e.g., `NarrationDefault.tsx`) |
| 0 | Background image | `SceneBackgroundImage` | `components/shared/SceneBackgroundImage.tsx` |
| 0 | Particles | `ParticleField` | `components/shared/ParticleField.tsx` |
| 0 | Grid | `GridOverlay` | `components/shared/GridOverlay.tsx` |
| — | Scene content | Scene component | `components/scenes/*.tsx` |
| 1 | Screenshot overlay | `SceneBackgroundImage` | (screenshot-specific sub-layers) |
| 8 | Annotations | `AnnotationLayer` | `components/annotations/AnnotationLayer.tsx` |
| 10 | Branded overlays | `OverlayRenderer` | `components/overlays/OverlayRenderer.tsx` |
| top | Color grade | `ColorGrade` | `components/shared/ColorGrade.tsx` |

All file paths relative to `apps/video-studio/src/`.

## Layer Details

### Background Image (`SceneBackgroundImage`)

Renders the scene's background image (AI-generated, screenshot, or stock photo) with a slow zoom effect and an overlay mode.

| Property | Value |
|----------|-------|
| **Opacity** | 0.50 (default) |
| **Zoom** | 1.0 → 1.10 over scene duration |
| **Fade-in** | 12 frames (0.4s) |

**Overlay modes:**

| Mode | Effect |
|------|--------|
| `cinematic` | 40% dark + vignette + 3% cyan tint (default) |
| `dark` | 75% single dark layer |
| `vignette` | Radial gradient, 40% center → 90% edges |
| `gradient-bottom` | Linear gradient, 30% top → 95% bottom |
| `screenshot` | 55% dark + glow pulse (8-16%) + vignette + scanlines (2%) + blue tint (15%) |

### Particle Field (`ParticleField`)

Drifting SVG circles that add atmospheric depth.

| Property | Value |
|----------|-------|
| **Density** | sparse (30), normal (50), dense (70) particles |
| **Speed** | 0.3-1.0 px/frame |
| **Opacity** | 0.08-0.20 base, pulsing on ~50% of particles |
| **Burst mode** | 3x speed multiplier at frame 0, settles by frame 10 |
| **Default color** | Cyan (`#00d4ff`) |

### Grid Overlay (`GridOverlay`)

Perspective grid that scrolls vertically, adding a tech-aesthetic backdrop.

| Property | Value |
|----------|-------|
| **Grid spacing** | 80px |
| **Base opacity** | 0.05 |
| **Pulse line** | 60-frame cycle, 0.15 opacity, travels top → bottom |
| **Perspective fade** | Lines fade at top, brighten at bottom |
| **Default color** | Cyan (`#00d4ff`) |

### Annotation Layer (`AnnotationLayer`)

Hand-drawn SVG annotations (circles, arrows, underlines, x-marks) that appear to be sketched on screen.

| Property | Value |
|----------|-------|
| **Z-index** | 8 |
| **Viewport** | 1920 x 1080 SVG |
| **Stroke width** | 4px |

**Draw durations:**

| Type | Frames | Description |
|------|--------|-------------|
| Circle | 30 | 48-point ellipse, opacity ramp 0→0.85 over 5 frames |
| Underline | 24 | Wavy or straight line under text |
| Arrow | 28 | Curved arrow with head |
| X-mark | 20 | Two crossing strokes |

**Annotation colors (by sentiment):**

| Sentiment | Color |
|-----------|-------|
| Positive | `#00FF88` (green) |
| Negative | `#FFB800` (amber) |
| Dramatic | `#FF4444` (red) |
| Brand (arrows) | `#00D4FF` (cyan) |

### Branded Overlays (`OverlayRenderer`)

UI elements like corner logos, info badges, floating labels, and source citations.

| Property | Value |
|----------|-------|
| **Z-index** | 10 |
| **Pointer events** | none |

### Color Grade (`ColorGrade`)

Post-processing wrapper applied to the entire composition. All three effects are independently toggleable.

| Effect | Implementation | Intensity |
|--------|---------------|-----------|
| **Film grain** | `feTurbulence` fractalNoise, seed varies per frame | 0.04 opacity |
| **Vignette** | Radial gradient, transparent center → dark edges | 0.25 opacity at edges |
| **Color shift** | `feColorMatrix` teal-orange LUT | 0.12 opacity |

## Scene Transitions

Each scene is wrapped by `SceneEnvelope` which handles entrance and exit animations.

| Transition | Frames | Duration | Animation |
|-----------|--------|----------|-----------|
| `cut` | 0 | instant | No animation |
| `crossfade` | 8 | 0.27s | Opacity 0→1 (entrance), 1→0 (exit) |
| `dissolve` | 20 | 0.67s | Longer opacity fade |
| `wipe-left` | 10 | 0.33s | `clipPath` rectangle reveals from left |
| `slide-up` | 10 | 0.33s | Opacity + `translateY(8%)` → `translateY(0)` |

Exit animations only apply to opacity-based transitions (crossfade, dissolve). Wipe and slide rely on the next scene covering the previous one.

## Color Theme

| Role | Hex | Usage |
|------|-----|-------|
| **Primary (Cyan)** | `#00d4ff` | Particles, grid, glows, highlights, text glow |
| **Secondary (Violet)** | `#8b5cf6` | Secondary text emphasis |
| **Background** | `#0a0e1a` | All scene backgrounds, overlay bases |
| **Background Base** | `#111827` | Elevated surfaces |
| **Background Elevated** | `#1e293b` | Secondary surfaces |
| **Text Primary** | `#ffffff` | All body text |
| **Text Secondary** | `#94a3b8` | De-emphasized text |

### Text Effects

**`textGlow(color, intensity)`** — CSS text-shadow with configurable glow:

| Intensity | Layers |
|-----------|--------|
| `subtle` | 6px blur at 0.6 opacity |
| `medium` | 10px + 20px blur at 0.6/0.3 opacity |
| `strong` | 15px + 30px + 45px blur at 0.6/0.3/0.15 opacity |

**`TEXT_CONTRAST_SHADOW`** — `0 2px 4px rgba(0,0,0,0.8)` — applied to all text over images.

## Audio Layers

Audio is mixed into the composition at these volume levels:

| Layer | Volume | Source |
|-------|--------|--------|
| Narration | 1.0 | TTS-generated WAV |
| Background music | 0.12 | Ambient track, starts at intro scene |
| SFX | 0.4 | Per-scene sound effects |

## Composition Structure

```
TechExplainer (root)
  └─ ColorGrade (post-processing wrapper)
       └─ Audio (narration)
       └─ For each scene:
            └─ SceneEnvelope (transition)
                 └─ SceneBackgroundImage
                 └─ ParticleField / GridOverlay
                 └─ Scene Content Component
                 └─ AnnotationLayer
                 └─ OverlayRenderer
                 └─ Scene Audio (SFX + music)
```

## Related Documentation

- [Scene Types](SCENE-TYPES.md) — What each scene renders
- [Pipeline](PIPELINE.md) — How enrichment populates visual data
- [Architecture](ARCHITECTURE.md) — System overview
