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
  | 'outro';

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
  'outro': OutroVisualData;
}

/** Union of all VisualData types */
export type AnyVisualData = VisualDataMap[SceneType];

// -----------------------------------------------------------------------------
// 5.2: Scene Interface
// -----------------------------------------------------------------------------

export interface Scene {
  id: string;
  type: SceneType;
  startFrame: number;
  endFrame: number;
  content: string;
  visualData: AnyVisualData;
  transition?: 'cut' | 'fade' | 'slide';
}

// -----------------------------------------------------------------------------
// Scene Component Props
// -----------------------------------------------------------------------------

/** Props passed to every scene component by SceneRouter */
export interface SceneComponentProps<T extends SceneType = SceneType> {
  visualData: VisualDataMap[T];
  content: string;
  motion?: MotionConfig;
}
