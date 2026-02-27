/**
 * Annotation Enricher — auto-generates hand-drawn SVG annotations for scenes.
 *
 * Analyzes scene type and content to add circles, arrows, underlines, and x-marks
 * that create the "someone annotated this while explaining" effect.
 *
 * @module @nexus-ai/visual-gen/annotation-enricher
 */

import type { Scene, SceneAnnotation, CircleAnnotation, ArrowAnnotation, UnderlineAnnotation, XMarkAnnotation } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Annotation Colors
// ---------------------------------------------------------------------------

/** Unified neon green — cyberpunk precision aesthetic */
const NEON_GREEN = '#aaff00';

export const ANNOTATION_COLORS = {
  emphasis: NEON_GREEN,
  brand: NEON_GREEN,
  warning: NEON_GREEN,
  success: NEON_GREEN,
} as const;

// ---------------------------------------------------------------------------
// Sentiment Detection
// ---------------------------------------------------------------------------

const POSITIVE_WORDS = [
  'growth', 'increase', 'success', 'grew', 'gained', 'improved', 'profit',
  'revenue', 'faster', 'better', 'upgrade', 'innovation', 'breakthrough',
  'doubled', 'tripled', 'surged', 'soared', 'risen', 'boost',
];

const NEGATIVE_WORDS = [
  'decline', 'loss', 'replaced', 'eliminated', 'obsolete', 'outdated',
  'deprecated', 'removed', 'failed', 'dropped', 'crashed', 'worse',
  'slower', 'decreased', 'shrunk', 'died', 'killed', 'destroyed',
];

const DRAMATIC_WORDS = [
  'biggest', 'revolutionary', 'disrupted', 'changed everything',
  'mind-blowing', 'insane', 'unbelievable', 'shocking', 'massive',
];

type Sentiment = 'positive' | 'negative' | 'dramatic' | 'neutral';

function detectSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;
  let dramaticCount = 0;

  for (const w of POSITIVE_WORDS) {
    if (lower.includes(w)) positiveCount++;
  }
  for (const w of NEGATIVE_WORDS) {
    if (lower.includes(w)) negativeCount++;
  }
  for (const w of DRAMATIC_WORDS) {
    if (lower.includes(w)) dramaticCount++;
  }

  if (dramaticCount > 0) return 'dramatic';
  if (negativeCount > positiveCount) return 'negative';
  if (positiveCount > 0) return 'positive';
  return 'neutral';
}

function colorForSentiment(sentiment: Sentiment): string {
  switch (sentiment) {
    case 'positive':
      return ANNOTATION_COLORS.success;
    case 'negative':
      return ANNOTATION_COLORS.warning;
    case 'dramatic':
      return ANNOTATION_COLORS.emphasis;
    case 'neutral':
    default:
      return ANNOTATION_COLORS.emphasis;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ANNOTATIONS_PER_SCENE = 2;

/** Max fraction of scenes that get annotations (70%) */
const MAX_ANNOTATION_RATIO = 0.7;

/** Scene types that never get annotations */
const EXCLUDED_TYPES = new Set([
  'intro', 'outro', 'cold-open', 'meme-reaction', 'chapter-break', 'code-block', 'map-animation',
]);

/** Max overlays before we skip annotations (too visually busy) */
const MAX_OVERLAYS_BEFORE_SKIP = 3;

// ---------------------------------------------------------------------------
// Scene text extraction
// ---------------------------------------------------------------------------

function extractText(scene: Scene): string {
  const parts: string[] = [scene.content];
  const vd = scene.visualData as Record<string, unknown>;
  for (const value of Object.values(vd)) {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') parts.push(item);
      }
    }
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Replacement-word detector for comparison x-marks
// ---------------------------------------------------------------------------

const REPLACEMENT_WORDS = ['replaced', 'obsolete', 'outdated', 'deprecated', 'eliminated', 'removed'];

function hasReplacementLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return REPLACEMENT_WORDS.some((w) => lower.includes(w));
}

// ---------------------------------------------------------------------------
// Main enrichment function
// ---------------------------------------------------------------------------

/**
 * Enrich scenes with hand-drawn SVG annotations based on scene content and type.
 *
 * Rules:
 * - stat-callout → circle around the number
 * - comparison → arrow left→right; x-mark if replacement language
 * - text-emphasis → underline (squiggly if dramatic)
 * - list-reveal → arrow pointing to first item
 * - All others: no annotations
 * - Max 2 annotations per scene, max 60% of scenes
 * - Skips scenes with 3+ overlays
 *
 * @param scenes Scene array (mutated in place)
 * @returns The enriched scene array
 */
export function enrichScenesWithAnnotations(scenes: Scene[]): Scene[] {
  const maxAnnotatedScenes = Math.max(1, Math.floor(scenes.length * MAX_ANNOTATION_RATIO));
  let annotatedCount = 0;

  for (const scene of scenes) {
    if (annotatedCount >= maxAnnotatedScenes) break;
    if (EXCLUDED_TYPES.has(scene.type)) continue;
    if (scene.isColdOpen) continue;
    if (scene.overlays && scene.overlays.length >= MAX_OVERLAYS_BEFORE_SKIP) continue;

    const annotations: SceneAnnotation[] = [];
    const text = extractText(scene);
    const sentiment = detectSentiment(text);

    switch (scene.type) {
      case 'stat-callout': {
        // StatCallout layout: number at center (~960, ~500) with fontSize 200
        // Comparison mode: two stats side-by-side, circle the main (right) stat
        const vd = scene.visualData as Record<string, unknown>;
        const numStr = (vd.number as string) || '';
        const isComparison = !!vd.comparison;

        // Dynamic circle width based on digit count
        const rx = Math.max(140, numStr.length * 60 + 40);
        const ry = 90;
        // Comparison mode: right stat centered ~1200px; normal: centered at 960
        const cx = isComparison ? 1200 : 960;
        // Number is vertically centered (540) minus slight offset for text baseline
        const cy = 480;

        const circle: CircleAnnotation = {
          type: 'circle',
          cx,
          cy,
          rx,
          ry,
          color: colorForSentiment(sentiment),
          delayFrames: 8,
          drawDurationFrames: 12,
          rotation: -5,
        };
        annotations.push(circle);
        break;
      }

      case 'comparison': {
        // Comparison layout: two panels side-by-side
        // Left panel: left 80 to ~48%, right panel: ~52% to right-80
        // Left center ~480, right center ~1440
        // Titles at top (~120px from top), items below
        const arrow: ArrowAnnotation = {
          type: 'arrow',
          fromX: 480,
          fromY: 540,
          toX: 1440,
          toY: 540,
          color: ANNOTATION_COLORS.brand,
          delayFrames: 10,
          drawDurationFrames: 12,
          curved: true,
        };
        annotations.push(arrow);

        // X-mark over left panel title if replacement language
        if (hasReplacementLanguage(text)) {
          const xMark: XMarkAnnotation = {
            type: 'x-mark',
            cx: 480,
            cy: 160,
            size: 30,
            color: ANNOTATION_COLORS.warning,
            delayFrames: 18,
            drawDurationFrames: 8,
          };
          annotations.push(xMark);
        }
        break;
      }

      case 'text-emphasis': {
        // TextEmphasis layout: centered at (960, 540), padding 80, maxWidth 70%
        // fontSize: phrase > 60 chars → 96, else 128
        const vd = scene.visualData as Record<string, unknown>;
        const phrase = (vd.phrase as string) || '';
        const fs = phrase.length > 60 ? 96 : 128;
        const charWidth = fs * 0.5;
        const estimatedWidth = Math.min(phrase.length * charWidth, 1344); // 70% of 1920
        const x = 960 - estimatedWidth / 2;
        const y = 540 + fs * 0.35; // just below text baseline

        const underlineStyle = sentiment === 'dramatic' ? 'squiggly' as const : 'single' as const;
        const underline: UnderlineAnnotation = {
          type: 'underline',
          x,
          y,
          width: estimatedWidth,
          color: colorForSentiment(sentiment),
          delayFrames: 6,
          drawDurationFrames: 10,
          style: underlineStyle,
        };
        annotations.push(underline);
        break;
      }

      case 'full-screen-text': {
        // FullScreenText layout: centered at (960, 540), width 70%, padding 80
        // fontSize: text > 100 chars → 64, else 84
        const vd = scene.visualData as Record<string, unknown>;
        const fsText = (vd.text as string) || '';
        const fs = fsText.length > 100 ? 64 : 84;
        const charWidth = fs * 0.5;
        const maxWidth = 1344; // 70% of 1920
        const estimatedWidth = Math.min(fsText.length * charWidth, maxWidth);
        const x = 960 - estimatedWidth / 2;
        const y = 540 + fs * 0.35;

        const underline: UnderlineAnnotation = {
          type: 'underline',
          x,
          y,
          width: estimatedWidth,
          color: colorForSentiment(sentiment),
          delayFrames: 6,
          drawDurationFrames: 10,
          style: sentiment === 'dramatic' ? 'squiggly' : 'single',
        };
        annotations.push(underline);
        break;
      }

      case 'list-reveal': {
        // ListReveal layout: paddingLeft 20% (384px), centered vertically
        // Arrow from margin into content area, pointing at first item
        const arrow: ArrowAnnotation = {
          type: 'arrow',
          fromX: 280,
          fromY: 340,
          toX: 384,
          toY: 400,
          color: ANNOTATION_COLORS.brand,
          delayFrames: 8,
          drawDurationFrames: 10,
          curved: true,
        };
        annotations.push(arrow);
        break;
      }

      case 'narration-default': {
        // Only annotate if scene has a foreground screenshot (otherwise underline floats on gradient)
        const ssDM = (scene as unknown as Record<string, unknown>).screenshotDisplayMode;
        if (ssDM !== 'foreground') break;

        const hasNumber = /\d+/.test(text);
        const hasEmphasis = /\b(critical|important|key|major|significant|massive|huge|revolutionary)\b/i.test(text);
        if (hasNumber || hasEmphasis) {
          const underline: UnderlineAnnotation = {
            type: 'underline',
            x: 400,
            y: 640,
            width: 1100,
            style: hasEmphasis ? 'squiggly' : 'single',
            color: sentiment === 'positive' ? ANNOTATION_COLORS.success : ANNOTATION_COLORS.brand,
            delayFrames: 6,
            drawDurationFrames: 10,
          };
          annotations.push(underline);
        }
        break;
      }

      // quote, diagram, timeline, logo-showcase: no annotations
      default:
        break;
    }

    // Enforce max per scene
    const trimmed = annotations.slice(0, MAX_ANNOTATIONS_PER_SCENE);

    if (trimmed.length > 0) {
      scene.annotations = trimmed;
      annotatedCount++;
    }
  }

  console.log(
    `Annotation enrichment: added annotations to ${annotatedCount}/${scenes.length} scenes`,
  );

  return scenes;
}
