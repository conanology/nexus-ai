/**
 * Re-export motion and direction types from script-gen for video-studio consumers
 */
import type React from 'react';
import { z } from 'zod';
import type { MotionConfig, WordTiming, EmphasisWord, EmphasisEffect, BrowserAction, MotionPreset } from '@nexus-ai/script-gen';
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


/**
 * Browser-safe motion presets (kept local to avoid pulling server-only deps into Remotion bundle).
 */
export const MOTION_PRESETS: Record<MotionPreset, Omit<MotionConfig, 'preset'>> = {
  subtle: {
    entrance: { type: 'fade', delay: 0, duration: 20, easing: 'easeOut' },
    emphasis: { type: 'none', trigger: 'none', intensity: 0, duration: 0 },
    exit: { type: 'fade', duration: 15, startBeforeEnd: 15 },
  },
  standard: {
    entrance: { type: 'slide', direction: 'up', delay: 0, duration: 15, easing: 'spring' },
    emphasis: { type: 'pulse', trigger: 'onWord', intensity: 0.3, duration: 10 },
    exit: { type: 'fade', duration: 15, startBeforeEnd: 15 },
  },
  dramatic: {
    entrance: {
      type: 'pop',
      delay: 0,
      duration: 12,
      easing: 'spring',
      springConfig: { damping: 80, stiffness: 300, mass: 1 },
    },
    emphasis: { type: 'glow', trigger: 'onWord', intensity: 0.6, duration: 15 },
    exit: { type: 'shrink', duration: 15, startBeforeEnd: 15 },
  },
};

/**
 * Browser-safe direction document schema (subset needed by video-studio).
 */
const SpringConfigSchema = z.object({ damping: z.number(), stiffness: z.number(), mass: z.number() });
const EntranceSchema = z.object({
  type: z.enum(['fade','slide','pop','scale','blur','none']),
  direction: z.enum(['left','right','up','down']).optional(),
  delay: z.number(),
  duration: z.number(),
  easing: z.enum(['spring','linear','easeOut','easeInOut']),
  springConfig: SpringConfigSchema.optional(),
});
const EmphasisSchema = z.object({
  type: z.enum(['pulse','shake','glow','underline','scale','none']),
  trigger: z.enum(['onWord','onSegment','continuous','none']),
  intensity: z.number(),
  duration: z.number(),
});
const ExitSchema = z.object({
  type: z.enum(['fade','slide','shrink','blur','none']),
  direction: z.enum(['left','right','up','down']).optional(),
  duration: z.number(),
  startBeforeEnd: z.number(),
});

export const DirectionDocumentSchema = z.object({
  segments: z.array(
    z.object({
      id: z.string(),
      timing: z.object({
        estimatedStartSec: z.number().optional(),
        estimatedDurationSec: z.number().optional(),
        actualStartSec: z.number().optional(),
        actualDurationSec: z.number().optional(),
        wordTimings: z.array(
          z.object({
            word: z.string(),
            startTime: z.number(),
            endTime: z.number(),
            confidence: z.number().optional(),
          })
        ).optional(),
      }),
      visual: z.object({
        template: z.string(),
        templateProps: z.record(z.unknown()).optional(),
        motion: z.object({
          preset: z.enum(['subtle','standard','dramatic']).optional(),
          entrance: EntranceSchema,
          emphasis: EmphasisSchema,
          exit: ExitSchema,
        }),
      }),
      content: z.object({
        text: z.string(),
        emphasis: z.array(
          z.object({
            word: z.string(),
            effect: z.enum(['pulse','shake','glow','underline','scale']),
            intensity: z.enum(['low','medium','high']),
          })
        ).optional(),
      }),
      audio: z.object({
        voiceName: z.string().optional(),
      }).optional(),
    })
  ),
  metadata: z.record(z.unknown()).optional(),
  globalAudio: z.record(z.unknown()).optional(),
});


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
