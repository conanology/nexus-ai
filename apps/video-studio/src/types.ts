/**
 * Re-export motion and direction types from script-gen for video-studio consumers
 */
import type React from 'react';
import type { MotionConfig, WordTiming, EmphasisWord, EmphasisEffect, BrowserAction } from '@nexus-ai/script-gen';
import type { BrowserDemoContent, BrowserStyle } from '@nexus-ai/broll-engine';

export type {
  MotionConfig,
  EntranceConfig,
  EmphasisConfig,
  ExitConfig,
  SpringConfig,
  EntranceType,
  EmphasisType,
  ExitType,
  AnimationDirection,
  EasingType,
  EmphasisTrigger,
  MotionPreset,
  WordTiming,
  EmphasisWord,
  EmphasisEffect,
  DirectionDocument,
  DirectionSegment,
  SegmentTiming,
  SegmentVisual,
  SegmentContent,
  SegmentAudio,
  DocumentMetadata,
  GlobalAudio,
  BrowserAction,
} from '@nexus-ai/script-gen';

export type { BrowserDemoContent, BrowserStyle } from '@nexus-ai/broll-engine';

export { MOTION_PRESETS, DirectionDocumentSchema } from '@nexus-ai/script-gen';

/**
 * Component prop interfaces for visual components
 */

export interface NeuralNetworkAnimationProps {
  title?: string;
  nodeCount?: number;
  connectionCount?: number;
  data?: {
    nodes?: Array<{ id: string; label: string }>;
    edges?: Array<{ from: string; to: string }>;
  };
  style?: {
    nodeColor?: string;
    edgeColor?: string;
  };
  motion?: MotionConfig;
}

export interface DataFlowDiagramProps {
  title?: string;
  steps?: string[];
  data?: {
    nodes?: Array<{ id: string; label: string }>;
    flows?: Array<{ from: string; to: string }>;
  };
  style?: {
    primaryColor?: string;
    arrowColor?: string;
  };
  motion?: MotionConfig;
}

export interface ComparisonChartProps {
  title?: string;
  data?: {
    labels?: string[];
    values?: number[];
    comparison?: Array<{ label: string; value: number }>;
  };
  style?: {
    barColor?: string;
    comparisonColor?: string;
  };
  motion?: MotionConfig;
}

export interface MetricsCounterProps {
  title?: string;
  value?: number;
  unit?: string;
  data?: {
    start?: number;
    end?: number;
    label?: string;
  };
  style?: {
    fontSize?: number;
    color?: string;
  };
  motion?: MotionConfig;
}

export interface ProductMockupProps {
  title?: string;
  content?: string;
  data?: {
    imageUrl?: string;
    caption?: string;
  };
  style?: {
    backgroundColor?: string;
    borderColor?: string;
  };
  motion?: MotionConfig;
}

export interface CodeHighlightProps {
  title?: string;
  code?: string;
  language?: string;
  typingEffect?: boolean;
  typingSpeed?: number;
  visibleChars?: number;
  data?: {
    code?: string;
    language?: string;
    highlightLines?: number[];
  };
  style?: {
    theme?: 'dark' | 'light';
    fontSize?: number;
  };
  motion?: MotionConfig;
}

export interface BrandedTransitionProps {
  type?: 'wipe' | 'fade' | 'slide';
  direction?: 'left' | 'right' | 'up' | 'down';
  data?: {
    transitionType?: string;
  };
  style?: {
    color?: string;
  };
  motion?: MotionConfig;
}

export interface LowerThirdProps {
  text?: string;
  subtitle?: string;
  data?: {
    citation?: string;
    source?: string;
  };
  style?: {
    position?: 'bottom' | 'top';
    backgroundColor?: string;
  };
  motion?: MotionConfig;
}

export interface TextOnGradientProps {
  text?: string;
  data?: {
    text?: string;
  };
  style?: {
    fontSize?: number;
  };
  motion?: MotionConfig;
}

export interface KineticTextProps {
  text?: string;
  data?: {
    text?: string;
    wordTimings?: WordTiming[];
    emphasis?: EmphasisWord[];
  };
  style?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    fontWeight?: string | number;
  };
  motion?: MotionConfig;
  emphasisEffect?: EmphasisEffect;
}

export interface BrowserFrameData {
  url?: string;
  content?: BrowserDemoContent;
  actions?: BrowserAction[];
  viewport?: { width: number; height: number };
  style?: BrowserStyle;
}

export interface BrowserFrameProps {
  url?: string;
  content?: React.ReactNode;
  actions?: BrowserAction[];
  viewport?: { width: number; height: number };
  style?: BrowserStyle;
  data?: BrowserFrameData;
  motion?: MotionConfig;
}
