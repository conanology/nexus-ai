/**
 * Re-export motion types from script-gen for video-studio consumers
 */
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
} from '@nexus-ai/script-gen';

export { MOTION_PRESETS } from '@nexus-ai/script-gen';

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
}

export interface CodeHighlightProps {
  title?: string;
  code?: string;
  language?: string;
  data?: {
    code?: string;
    language?: string;
    highlightLines?: number[];
  };
  style?: {
    theme?: 'dark' | 'light';
    fontSize?: number;
  };
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
}

export interface TextOnGradientProps {
  text?: string;
  data?: {
    text?: string;
  };
  style?: {
    fontSize?: number;
  };
}
