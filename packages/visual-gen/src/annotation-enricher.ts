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

export const ANNOTATION_COLORS = {
  emphasis: '#FF4444',  // red — draws attention, "look here!"
  brand: '#00D4FF',     // cyan — matches video aesthetic
  warning: '#FFB800',   // amber — caution, negative
  success: '#00FF88',   // green — positive, growth
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

/** Max fraction of scenes that get annotations (60%) */
const MAX_ANNOTATION_RATIO = 0.6;

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
        // Circle around the main number (centered, above mid)
        const circle: CircleAnnotation = {
          type: 'circle',
          cx: 960,
          cy: 420,
          rx: 200,
          ry: 80,
          color: colorForSentiment(sentiment),
          delayFrames: 25,
          drawDurationFrames: 30,
          rotation: -5,
        };
        annotations.push(circle);
        break;
      }

      case 'comparison': {
        // Arrow from old (left) to new (right)
        const arrow: ArrowAnnotation = {
          type: 'arrow',
          fromX: 400,
          fromY: 540,
          toX: 1520,
          toY: 540,
          color: ANNOTATION_COLORS.brand,
          delayFrames: 35,
          drawDurationFrames: 28,
          curved: true,
        };
        annotations.push(arrow);

        // X-mark on old side if replacement language
        if (hasReplacementLanguage(text)) {
          const xMark: XMarkAnnotation = {
            type: 'x-mark',
            cx: 400,
            cy: 300,
            size: 30,
            color: ANNOTATION_COLORS.warning,
            delayFrames: 50,
            drawDurationFrames: 20,
          };
          annotations.push(xMark);
        }
        break;
      }

      case 'text-emphasis': {
        // Underline under the emphasized text
        const underlineStyle = sentiment === 'dramatic' ? 'squiggly' as const : 'single' as const;
        const underline: UnderlineAnnotation = {
          type: 'underline',
          x: 460,
          y: 620,
          width: 1000,
          color: colorForSentiment(sentiment),
          delayFrames: 20,
          drawDurationFrames: 24,
          style: underlineStyle,
        };
        annotations.push(underline);
        break;
      }

      case 'list-reveal': {
        // Arrow pointing to the first list item
        const arrow: ArrowAnnotation = {
          type: 'arrow',
          fromX: 200,
          fromY: 300,
          toX: 350,
          toY: 350,
          color: ANNOTATION_COLORS.brand,
          delayFrames: 30,
          drawDurationFrames: 24,
          curved: true,
        };
        annotations.push(arrow);
        break;
      }

      // quote, narration-default, full-screen-text, diagram, timeline, logo-showcase: no annotations
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
