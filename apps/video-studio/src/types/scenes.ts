/**
 * Scene System Type Definitions
 *
 * Defines the type-safe scene architecture per VIDEO_SYSTEM_SPEC.md Section 5.
 * All future visual components plug into this system via SceneType → VisualData mapping.
 */
import type { MotionConfig } from '../types';

// -----------------------------------------------------------------------------
// 5.1: Scene Types
// -----------------------------------------------------------------------------

export type SceneType =
  | 'intro'
  | 'chapter-break'
  | 'narration-default'
  | 'text-emphasis'
  | 'full-screen-text'
  | 'stat-callout'
  | 'comparison'
  | 'diagram'
  | 'logo-showcase'
  | 'timeline'
  | 'quote'
  | 'list-reveal'
  | 'code-block'
  | 'meme-reaction'
  | 'map-animation'
  | 'scrolling-capture'
  | 'dynamic-chart'
  | 'outro';

// -----------------------------------------------------------------------------
// 5.1b: Scene Pacing
// -----------------------------------------------------------------------------

export type ScenePacing = 'punch' | 'breathe' | 'dense' | 'normal';

/**
 * Returns an animation speed multiplier for a given pacing value.
 * Scene components can use this to adjust their animation speeds.
 *
 * - 'punch'  → 1.3 (animations run 30% faster)
 * - 'breathe' → 0.7 (animations run 30% slower)
 * - 'dense'   → 1.0 (normal speed)
 * - 'normal'  → 1.0 (normal speed)
 */
export function getPacingMultiplier(pacing: ScenePacing): number {
  switch (pacing) {
    case 'punch':
      return 1.3;
    case 'breathe':
      return 0.7;
    case 'dense':
    case 'normal':
    default:
      return 1.0;
  }
}

/** All valid scene type values as an array (useful for runtime validation) */
export const SCENE_TYPES: SceneType[] = [
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
  'scrolling-capture',
  'dynamic-chart',
  'outro',
];

// -----------------------------------------------------------------------------
// 5.3: Visual Data Payloads (one per scene type)
// -----------------------------------------------------------------------------

export interface IntroVisualData {
  episodeNumber?: number;
  episodeTitle?: string;
}

export interface ChapterBreakVisualData {
  title: string;
  subtitle?: string;
  chapterNumber?: number;
}

export interface NarrationDefaultVisualData {
  backgroundVariant?: 'gradient' | 'particles' | 'grid';
}

export interface TextEmphasisVisualData {
  phrase: string;
  highlightWords?: string[];
  style: 'fade' | 'slam' | 'typewriter';
}

export interface FullScreenTextVisualData {
  text: string;
  alignment?: 'center' | 'left';
}

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

export interface LogoShowcaseVisualData {
  logos: Array<{
    name: string;
    src?: string;
  }>;
  layout: 'grid' | 'sequential';
}

export interface TimelineVisualData {
  events: Array<{
    year: string;
    label: string;
    description?: string;
  }>;
}

export interface QuoteVisualData {
  text: string;
  attribution: string;
  role?: string;
}

export interface ListRevealVisualData {
  title?: string;
  items: string[];
  style: 'bullet' | 'numbered' | 'icon';
}

export interface CodeBlockVisualData {
  code: string;
  language?: string;
  highlightLines?: number[];
  filename?: string;
}

export interface MemeReactionVisualData {
  gifSrc: string;
  reactionType: string;
  description: string;
}

export interface MapAnimationVisualData {
  mapType: 'world' | 'region';
  highlightedCountries: string[];
  highlightColor?: string;
  label?: string;
  animationStyle: 'sequential' | 'pulse' | 'simultaneous';
  centerOn?: string;
}

export interface DynamicChartVisualData {
  chartType: 'bar' | 'line';
  title: string;
  data: Array<{ label: string; value: number }>;
  unit?: string;
  animationStyle?: 'sequential' | 'simultaneous';
}

export interface ScrollingCaptureVisualData {
  fullPageImageUrl: string;
  scrollSpeedPxPerSec?: number;
  label?: string;
}

export interface OutroVisualData {
  nextTopicTeaser?: string;
}

// -----------------------------------------------------------------------------
// Discriminated Union: SceneType → VisualData
// -----------------------------------------------------------------------------

export interface VisualDataMap {
  'intro': IntroVisualData;
  'chapter-break': ChapterBreakVisualData;
  'narration-default': NarrationDefaultVisualData;
  'text-emphasis': TextEmphasisVisualData;
  'full-screen-text': FullScreenTextVisualData;
  'stat-callout': StatCalloutVisualData;
  'comparison': ComparisonVisualData;
  'diagram': DiagramVisualData;
  'logo-showcase': LogoShowcaseVisualData;
  'timeline': TimelineVisualData;
  'quote': QuoteVisualData;
  'list-reveal': ListRevealVisualData;
  'code-block': CodeBlockVisualData;
  'meme-reaction': MemeReactionVisualData;
  'map-animation': MapAnimationVisualData;
  'scrolling-capture': ScrollingCaptureVisualData;
  'dynamic-chart': DynamicChartVisualData;
  'outro': OutroVisualData;
}

/** Union of all VisualData types */
export type AnyVisualData = VisualDataMap[SceneType];

// -----------------------------------------------------------------------------
// 5.4: Overlay Types (composite scene system)
// -----------------------------------------------------------------------------

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
  sourceKind?: 'tweet' | 'repository' | 'article' | 'paper' | 'app' | 'website' | 'video' | 'unknown';
  detail?: string;
  icon?: string;
  verified?: boolean;
}

export type SceneOverlay = CornerLogoOverlay | InfoBadgeOverlay | FloatingLabelOverlay | SourceCitationOverlay | KeyPhraseOverlay | SourceBadgeOverlay;

// -----------------------------------------------------------------------------
// 5.5: Annotation Types (hand-drawn SVG annotations)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 5.2: Scene Interface
// -----------------------------------------------------------------------------

export interface SceneSourceMetadata {
  sourceKind: 'tweet' | 'repository' | 'article' | 'paper' | 'app' | 'website' | 'video' | 'unknown';
  sourceName?: string;
  detail?: string;
  icon?: string;
  verified?: boolean;
  authorityScore?: number;
  stats?: Record<string, string | number>;
}

export interface Scene {
  id: string;
  type: SceneType;
  startFrame: number;
  endFrame: number;
  content: string;
  visualData: AnyVisualData;
  pacing?: ScenePacing;
  transition?: 'cut' | 'slide-left' | 'slam' | 'wipe-down' | 'split' | 'zoom-in' | 'pop-in';
  sfx?: string[];
  musicTrack?: string;
  backgroundImage?: string;
  screenshotImage?: string;
  screenshotDisplayMode?: 'background' | 'foreground';
  sourceUrl?: string;
  sourceMetadata?: SceneSourceMetadata;
  visualSource?: 'source-screenshot' | 'content-screenshot' | 'company-screenshot' | 'stock' | 'ai-generated' | 'programmatic' | 'gradient';
  overlays?: SceneOverlay[];
  annotations?: SceneAnnotation[];
  isColdOpen?: boolean;
  visualLayer?: 'abstract-concept' | 'evidence-screenshot' | 'showcase-scroll';
  cssSelector?: string;
  highlightText?: string;
  fullPageImage?: string;
}

// -----------------------------------------------------------------------------
// Scene Component Props
// -----------------------------------------------------------------------------

/** Props passed to every scene component by SceneRouter */
export interface SceneComponentProps<T extends SceneType = SceneType> {
  visualData: VisualDataMap[T];
  content: string;
  motion?: MotionConfig;
  backgroundImage?: string;
  screenshotImage?: string;
  screenshotDisplayMode?: 'background' | 'foreground';
  sourceMetadata?: SceneSourceMetadata;
  pacing?: 'punch' | 'breathe' | 'dense' | 'normal';
}
