/**
 * Director Agent Type Definitions
 *
 * SYNC NOTE: Scene types mirror apps/video-studio/src/types/scenes.ts.
 * If scene types change in video-studio, update here as well.
 * The canonical source is VIDEO_SYSTEM_SPEC.md Section 5.
 *
 * @module @nexus-ai/director-agent/types
 */

import { z } from 'zod';

// =============================================================================
// Scene Types
// =============================================================================

export const SCENE_TYPES = [
  'intro',
  'chapter-break',
  'narration-default',
  'text-emphasis',
  'full-screen-text',
  'stat-callout',
  'comparison',
  'diagram',
  'logo-showcase',
  'timeline',
  'quote',
  'list-reveal',
  'code-block',
  'meme-reaction',
  'map-animation',
  'outro',
] as const;

export type SceneType = (typeof SCENE_TYPES)[number];

export const SceneTypeSchema = z.enum(SCENE_TYPES);

// =============================================================================
// Scene Pacing
// =============================================================================

export const SCENE_PACING_VALUES = ['punch', 'breathe', 'dense', 'normal'] as const;

export type ScenePacing = (typeof SCENE_PACING_VALUES)[number];

export const ScenePacingSchema = z.enum(SCENE_PACING_VALUES);

/** Default pacing per scene type when LLM doesn't specify one */
export const DEFAULT_SCENE_PACING: Record<SceneType, ScenePacing> = {
  'stat-callout': 'punch',
  'text-emphasis': 'normal',
  'full-screen-text': 'normal',
  comparison: 'dense',
  diagram: 'dense',
  timeline: 'dense',
  'list-reveal': 'dense',
  'code-block': 'dense',
  quote: 'breathe',
  'chapter-break': 'breathe',
  'logo-showcase': 'normal',
  'narration-default': 'normal',
  intro: 'normal',
  outro: 'breathe',
  'meme-reaction': 'normal',
  'map-animation': 'dense',
};

// =============================================================================
// VisualData Interfaces + Zod Schemas (one per scene type)
// =============================================================================

// --- intro ---
export interface IntroVisualData {
  episodeNumber?: number;
  episodeTitle?: string;
}
export const IntroVisualDataSchema = z.object({
  episodeNumber: z.number().optional(),
  episodeTitle: z.string().optional(),
});

// --- chapter-break ---
export interface ChapterBreakVisualData {
  title: string;
  subtitle?: string;
  chapterNumber?: number;
}
export const ChapterBreakVisualDataSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  chapterNumber: z.number().optional(),
});

// --- narration-default ---
export interface NarrationDefaultVisualData {
  backgroundVariant?: 'gradient' | 'particles' | 'grid';
}
export const NarrationDefaultVisualDataSchema = z.object({
  backgroundVariant: z.enum(['gradient', 'particles', 'grid']).optional(),
});

// --- text-emphasis ---
export interface TextEmphasisVisualData {
  phrase: string;
  highlightWords?: string[];
  style: 'fade' | 'slam' | 'typewriter';
}
export const TextEmphasisVisualDataSchema = z.object({
  phrase: z.string(),
  highlightWords: z.array(z.string()).optional(),
  style: z.enum(['fade', 'slam', 'typewriter']),
});

// --- full-screen-text ---
export interface FullScreenTextVisualData {
  text: string;
  alignment?: 'center' | 'left';
}
export const FullScreenTextVisualDataSchema = z.object({
  text: z.string(),
  alignment: z.enum(['center', 'left']).optional(),
});

// --- stat-callout ---
export interface StatCalloutVisualData {
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
export const StatCalloutVisualDataSchema = z.object({
  number: z.string(),
  label: z.string(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  countUp: z.boolean().optional(),
  comparison: z
    .object({
      number: z.string(),
      label: z.string(),
    })
    .optional(),
});

// --- comparison ---
export interface ComparisonVisualData {
  left: {
    title: string;
    items: string[];
  };
  right: {
    title: string;
    items: string[];
  };
}
export const ComparisonVisualDataSchema = z.object({
  left: z.object({
    title: z.string(),
    items: z.array(z.string()),
  }),
  right: z.object({
    title: z.string(),
    items: z.array(z.string()),
  }),
});

// --- diagram ---
export interface DiagramVisualData {
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
export const DiagramVisualDataSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      icon: z.string().optional(),
    }),
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      label: z.string().optional(),
    }),
  ),
  layout: z.enum(['horizontal', 'vertical', 'hub-spoke']),
});

// --- logo-showcase ---
export interface LogoShowcaseVisualData {
  logos: Array<{
    name: string;
    src?: string;
  }>;
  layout: 'grid' | 'sequential';
}
export const LogoShowcaseVisualDataSchema = z.object({
  logos: z.array(
    z.object({
      name: z.string(),
      src: z.string().optional(),
    }),
  ),
  layout: z.enum(['grid', 'sequential']),
});

// --- timeline ---
export interface TimelineVisualData {
  events: Array<{
    year: string;
    label: string;
    description?: string;
  }>;
}
export const TimelineVisualDataSchema = z.object({
  events: z.array(
    z.object({
      year: z.string(),
      label: z.string(),
      description: z.string().optional(),
    }),
  ),
});

// --- quote ---
export interface QuoteVisualData {
  text: string;
  attribution: string;
  role?: string;
}
export const QuoteVisualDataSchema = z.object({
  text: z.string(),
  attribution: z.string(),
  role: z.string().optional(),
});

// --- list-reveal ---
export interface ListRevealVisualData {
  title?: string;
  items: string[];
  style: 'bullet' | 'numbered' | 'icon';
}
export const ListRevealVisualDataSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.string()),
  style: z.enum(['bullet', 'numbered', 'icon']),
});

// --- code-block ---
export interface CodeBlockVisualData {
  code: string;
  language?: string;
  highlightLines?: number[];
  filename?: string;
}
export const CodeBlockVisualDataSchema = z.object({
  code: z.string(),
  language: z.string().optional(),
  highlightLines: z.array(z.number()).optional(),
  filename: z.string().optional(),
});

// --- meme-reaction ---
export interface MemeReactionVisualData {
  gifSrc: string;
  reactionType: string;
  description: string;
}
export const MemeReactionVisualDataSchema = z.object({
  gifSrc: z.string(),
  reactionType: z.string(),
  description: z.string(),
});

// --- map-animation ---
export interface MapAnimationVisualData {
  mapType: 'world' | 'region';
  highlightedCountries: string[];
  highlightColor?: string;
  label?: string;
  animationStyle: 'sequential' | 'pulse' | 'simultaneous';
  centerOn?: string;
}
export const MapAnimationVisualDataSchema = z.object({
  mapType: z.enum(['world', 'region']),
  highlightedCountries: z.array(z.string()),
  highlightColor: z.string().optional(),
  label: z.string().optional(),
  animationStyle: z.enum(['sequential', 'pulse', 'simultaneous']),
  centerOn: z.string().optional(),
});

// --- outro ---
export interface OutroVisualData {
  nextTopicTeaser?: string;
}
export const OutroVisualDataSchema = z.object({
  nextTopicTeaser: z.string().optional(),
});

// =============================================================================
// VisualData Map + Union
// =============================================================================

export interface VisualDataMap {
  intro: IntroVisualData;
  'chapter-break': ChapterBreakVisualData;
  'narration-default': NarrationDefaultVisualData;
  'text-emphasis': TextEmphasisVisualData;
  'full-screen-text': FullScreenTextVisualData;
  'stat-callout': StatCalloutVisualData;
  comparison: ComparisonVisualData;
  diagram: DiagramVisualData;
  'logo-showcase': LogoShowcaseVisualData;
  timeline: TimelineVisualData;
  quote: QuoteVisualData;
  'list-reveal': ListRevealVisualData;
  'code-block': CodeBlockVisualData;
  'meme-reaction': MemeReactionVisualData;
  'map-animation': MapAnimationVisualData;
  outro: OutroVisualData;
}

export type AnyVisualData = VisualDataMap[SceneType];

/** Map of SceneType → Zod schema for runtime validation of LLM output */
export const VISUAL_DATA_SCHEMAS: Record<SceneType, z.ZodType> = {
  intro: IntroVisualDataSchema,
  'chapter-break': ChapterBreakVisualDataSchema,
  'narration-default': NarrationDefaultVisualDataSchema,
  'text-emphasis': TextEmphasisVisualDataSchema,
  'full-screen-text': FullScreenTextVisualDataSchema,
  'stat-callout': StatCalloutVisualDataSchema,
  comparison: ComparisonVisualDataSchema,
  diagram: DiagramVisualDataSchema,
  'logo-showcase': LogoShowcaseVisualDataSchema,
  timeline: TimelineVisualDataSchema,
  quote: QuoteVisualDataSchema,
  'list-reveal': ListRevealVisualDataSchema,
  'code-block': CodeBlockVisualDataSchema,
  'meme-reaction': MemeReactionVisualDataSchema,
  'map-animation': MapAnimationVisualDataSchema,
  outro: OutroVisualDataSchema,
};

// =============================================================================
// Overlay Types (composite scene system)
// =============================================================================

export type OverlayType = 'corner-logo' | 'info-badge' | 'floating-label' | 'source-citation' | 'key-phrase' | 'source-badge';

export interface BaseOverlay {
  type: OverlayType;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  delayFrames?: number;
  durationFrames?: number;
}

export interface CornerLogoOverlay extends BaseOverlay {
  type: 'corner-logo';
  companyName: string;
  logoSrc?: string;
  brandColor: string;
}

export interface InfoBadgeOverlay extends BaseOverlay {
  type: 'info-badge';
  label: string;
  icon?: string;
  color?: string;
}

export interface FloatingLabelOverlay extends BaseOverlay {
  type: 'floating-label';
  text: string;
}

export interface SourceCitationOverlay extends BaseOverlay {
  type: 'source-citation';
  position: 'bottom-left';
  source: string;
}

export interface KeyPhraseOverlay extends BaseOverlay {
  type: 'key-phrase';
  phrase: string;
}

export interface SourceBadgeOverlay extends BaseOverlay {
  type: 'source-badge';
  position: 'bottom-left';
  sourceName: string;
}

export type SceneOverlay = CornerLogoOverlay | InfoBadgeOverlay | FloatingLabelOverlay | SourceCitationOverlay | KeyPhraseOverlay | SourceBadgeOverlay;

// =============================================================================
// Annotation Types (hand-drawn SVG annotations)
// =============================================================================

export type AnnotationType = 'circle' | 'arrow' | 'underline' | 'x-mark';

export interface BaseAnnotation {
  type: AnnotationType;
  color?: string;
  delayFrames?: number;
  drawDurationFrames?: number;
}

export interface CircleAnnotation extends BaseAnnotation {
  type: 'circle';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation?: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  curved?: boolean;
}

export interface UnderlineAnnotation extends BaseAnnotation {
  type: 'underline';
  x: number;
  y: number;
  width: number;
  style?: 'single' | 'double' | 'squiggly';
}

export interface XMarkAnnotation extends BaseAnnotation {
  type: 'x-mark';
  cx: number;
  cy: number;
  size?: number;
}

export type SceneAnnotation = CircleAnnotation | ArrowAnnotation | UnderlineAnnotation | XMarkAnnotation;

// =============================================================================
// Scene Interface
// =============================================================================

export interface Scene {
  id: string;
  type: SceneType;
  startFrame: number;
  endFrame: number;
  content: string;
  visualData: AnyVisualData;
  pacing?: ScenePacing;
  transition?: 'cut' | 'crossfade' | 'dissolve' | 'wipe-left' | 'slide-up';
  sfx?: string[];
  musicTrack?: string;
  backgroundImage?: string;
  screenshotImage?: string;
  sourceUrl?: string;
  visualSource?: 'source-screenshot' | 'content-screenshot' | 'company-screenshot' | 'stock' | 'ai-generated' | 'programmatic' | 'gradient';
  overlays?: SceneOverlay[];
  annotations?: SceneAnnotation[];
  isColdOpen?: boolean;
}

// =============================================================================
// Director Input / Output
// =============================================================================

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface DirectorInput {
  script: string;
  totalDurationFrames: number;
  fps: number;
  wordTimings?: WordTiming[];
  metadata?: {
    topic?: string;
    episodeNumber?: number;
    title?: string;
  };
}

export interface DirectorOutput {
  scenes: Scene[];
  warnings: string[];
}

// =============================================================================
// Internal Types
// =============================================================================

export interface ScriptSegment {
  index: number;
  text: string;
  startFrame: number;
  endFrame: number;
  sentenceCount: number;
}

export type ClassifiedSegment = ScriptSegment & {
  sceneType: SceneType;
  visualData: Record<string, unknown>;
  pacing: ScenePacing;
};

// =============================================================================
// LLM Response Schemas
// =============================================================================

/** Single scene entry returned by the LLM */
export const LLMSceneEntrySchema = z.object({
  sceneType: z.string(),
  visualData: z.record(z.unknown()),
  pacing: z.string().optional(),
});

export type LLMSceneEntry = z.infer<typeof LLMSceneEntrySchema>;

/** Full LLM response: JSON array of scene entries */
export const LLMDirectorResponseSchema = z.array(LLMSceneEntrySchema);

export type LLMDirectorResponse = z.infer<typeof LLMDirectorResponseSchema>;
