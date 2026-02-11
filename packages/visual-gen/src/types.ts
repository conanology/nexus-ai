/**
 * Type definitions for visual generation stage
 */

import type { DirectionDocument } from '@nexus-ai/script-gen';
import type { WordTiming } from '@nexus-ai/timestamp-extraction';

/**
 * Input data for visual generation stage
 */
export interface VisualGenInput {
  /** Script text (optional in V2 - can be reconstructed from directionDocument) */
  script?: string;
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
  /** Direction document with segment timings (V2 path) */
  directionDocument?: DirectionDocument;
  /** Flat array of word-level timings from timestamp-extraction */
  wordTimings?: WordTiming[];
  /** Whether audio mixing is enabled (default: true when directionDocument present) */
  audioMixingEnabled?: boolean;
  /** Pipeline mode: 'v2-director' uses LLM Director Agent (default), 'legacy-timeline' uses keyword SceneMapper */
  mode?: 'v2-director' | 'legacy-timeline';
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
  /** Pass-through TTS audio URL */
  originalAudioUrl: string;
  /** Mixed audio URL (if mixing succeeded) */
  mixedAudioUrl?: string;
  /** The URL actually passed to render (mixed or original) */
  finalAudioUrl: string;
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
  totalDurationFrames: number;
  targetDuration?: '30s' | '1min' | '5min' | '8min' | 'auto';
  /** Validation warnings from segment-based timeline generation */
  validationWarnings?: string[];
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
