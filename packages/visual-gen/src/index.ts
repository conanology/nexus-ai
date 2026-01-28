/**
 * Visual Generation Package
 * Converts scripts with visual cues to scene timelines for Remotion rendering
 */

export { executeVisualGen } from './visual-gen.js';
export type {
  VisualGenInput,
  VisualGenOutput,
  VisualCue,
  SceneMapping,
  TimelineJSON,
} from './types.js';
export { SceneMapper } from './scene-mapper.js';
export { generateTimeline, resolveSceneDuration, resolveSceneStartTime, validateTimeline } from './timeline.js';
export type { TimelineValidationResult } from './timeline.js';
export { parseVisualCues } from './visual-cue-parser.js';
