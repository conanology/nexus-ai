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
}

/**
 * Output data from visual generation stage
 */
export interface VisualGenOutput {
  timelineUrl: string;
  sceneCount: number;
  fallbackUsage: number;
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
