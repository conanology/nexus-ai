/**
 * Type definitions for visual generation stage
 */

/**
 * Input data for visual generation stage
 */
export interface VisualGenInput {
  script: string;
  audioUrl: string;
  audioDurationSec: number;
  /** Pass-through topic data for downstream stages (YouTube metadata) */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Output data from visual generation stage
 */
export interface VisualGenOutput {
  timelineUrl: string;
  sceneCount: number;
  fallbackUsage: number;
  videoPath: string;  // GCS path to rendered video from render-service
  /** Pass-through topic data for downstream stages (YouTube metadata) */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
  /** Pass-through script for YouTube metadata generation */
  script?: string;
  /** Pass-through audio duration for YouTube chapter markers */
  audioDurationSec?: number;
}

/**
 * Visual cue extracted from script
 */
export interface VisualCue {
  index: number;
  description: string;
  context: string;
  position: number;
}

/**
 * Scene mapping with component and timing
 */
export interface SceneMapping {
  component: string;
  props: {
    title?: string;
    text?: string;  // For TextOnGradient fallback
    data?: any;
    style?: any;
  };
  duration: number;
  startTime: number;
  endTime: number;
}

/**
 * Timeline JSON schema for Remotion consumption
 */
export interface TimelineJSON {
  audioDurationSec: number;
  scenes: Array<{
    component: string;
    props: {
      title?: string;
      text?: string;  // For TextOnGradient fallback
      data?: any;
      style?: any;
    };
    startTime: number;
    duration: number;
  }>;
}
