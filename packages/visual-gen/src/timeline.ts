/**
 * Timeline generation implementation
 */

import type { SceneMapping, TimelineJSON } from './types.js';

/**
 * Generate timeline JSON from scene mappings
 * Aligns scene durations to match audio duration
 */
export function generateTimeline(
  sceneMappings: SceneMapping[],
  audioDurationSec: number
): TimelineJSON {
  // Handle empty scenes
  if (sceneMappings.length === 0) {
    return {
      audioDurationSec,
      scenes: [],
    };
  }

  // Calculate total duration of all scenes
  const totalSceneDuration = sceneMappings.reduce((sum, scene) => sum + scene.duration, 0);

  // Calculate scaling factor to align with audio duration
  const scaleFactor = audioDurationSec / totalSceneDuration;

  // Generate scenes with adjusted durations and timing
  let currentTime = 0;
  const scenes = sceneMappings.map((mapping, index) => {
    // Scale duration to fit audio
    let duration = Math.round(mapping.duration * scaleFactor);

    // For last scene, adjust to exactly match audio duration (avoid rounding errors)
    if (index === sceneMappings.length - 1) {
      duration = audioDurationSec - currentTime;
    }

    const scene = {
      component: mapping.component,
      props: mapping.props,
      startTime: currentTime,
      duration,
    };

    currentTime += duration;

    return scene;
  });

  return {
    audioDurationSec,
    scenes,
  };
}
