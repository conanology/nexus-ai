/**
 * Timeline generation implementation
 */

import type { DirectionSegment } from '@nexus-ai/script-gen';
import type { SceneMapping, TimelineJSON } from './types.js';

/** Entrance animation buffer in frames (0.5s at 30fps) */
const ENTRANCE_BUFFER_FRAMES = 15;

/** Exit animation buffer in frames (0.5s at 30fps) */
const EXIT_BUFFER_FRAMES = 15;

/** Maximum allowed overlap between adjacent scenes in frames */
const MAX_OVERLAP_FRAMES = 30;

/**
 * Resolve the duration of a scene from a direction segment's timing data.
 * Priority: wordTimings > actualDurationSec > estimatedDurationSec > undefined (fallback)
 *
 * Note: This differs from resolveSegmentDurationSec() in visual-gen.ts which takes
 * a partial timing object (for logging). This version takes a full DirectionSegment
 * and additionally considers wordTimings for highest precision.
 */
export function resolveSceneDuration(segment: DirectionSegment): number | undefined {
  const { timing } = segment;

  if (timing.wordTimings && timing.wordTimings.length > 0) {
    const firstWord = timing.wordTimings[0];
    const lastWord = timing.wordTimings[timing.wordTimings.length - 1];
    return lastWord.endTime - firstWord.startTime;
  }

  if (timing.actualDurationSec !== undefined) {
    return timing.actualDurationSec;
  }

  if (timing.estimatedDurationSec !== undefined) {
    return timing.estimatedDurationSec;
  }

  return undefined;
}

/**
 * Resolve the start time of a scene from a direction segment's timing data.
 * Priority: wordTimings[0].startTime > actualStartSec > estimatedStartSec
 */
export function resolveSceneStartTime(segment: DirectionSegment): number | undefined {
  const { timing } = segment;

  if (timing.wordTimings && timing.wordTimings.length > 0) {
    return timing.wordTimings[0].startTime;
  }

  return timing.actualStartSec ?? timing.estimatedStartSec;
}

/**
 * Validation result for a generated timeline
 */
export interface TimelineValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Validate a generated timeline for gaps, overlaps, and audio duration alignment.
 * Returns warnings (not errors) to avoid breaking the pipeline.
 */
export function validateTimeline(
  timeline: TimelineJSON,
  audioDurationSec: number,
  fps: number,
): TimelineValidationResult {
  const warnings: string[] = [];

  if (timeline.scenes.length === 0) {
    return { valid: true, warnings };
  }

  // Check total scene coverage vs audio duration (within 1 second tolerance)
  const lastScene = timeline.scenes[timeline.scenes.length - 1];
  const totalCoverage = lastScene.startTime + lastScene.duration;
  const durationDiff = Math.abs(totalCoverage - audioDurationSec);
  if (durationDiff > 1) {
    warnings.push(
      `Timeline coverage (${totalCoverage.toFixed(2)}s) differs from audio duration (${audioDurationSec}s) by ${durationDiff.toFixed(2)}s (exceeds 1s tolerance)`,
    );
  }

  // Check for gaps and excessive overlaps between adjacent scenes
  for (let i = 1; i < timeline.scenes.length; i++) {
    const prev = timeline.scenes[i - 1];
    const curr = timeline.scenes[i];
    const prevEnd = prev.startTime + prev.duration;
    const gap = curr.startTime - prevEnd;

    if (gap > 0) {
      warnings.push(
        `Gap of ${gap.toFixed(3)}s between scene ${i - 1} and scene ${i}`,
      );
    }

    if (gap < 0) {
      const overlapFrames = Math.round(Math.abs(gap) * fps);
      if (overlapFrames > MAX_OVERLAP_FRAMES) {
        warnings.push(
          `Excessive overlap of ${overlapFrames} frames (max ${MAX_OVERLAP_FRAMES}) between scene ${i - 1} and scene ${i}`,
        );
      }
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Generate timeline JSON from scene mappings
 * Aligns scene durations to match audio duration
 */
export function generateTimeline(
  sceneMappings: SceneMapping[],
  audioDurationSec: number,
  options?: {
    fps?: number;
    targetDuration?: '30s' | '1min' | '5min' | '8min' | 'auto';
    segments?: DirectionSegment[];
  },
): TimelineJSON {
  const fps = options?.fps && options.fps > 0 ? options.fps : 30;
  const totalDurationFrames = Math.ceil(audioDurationSec * fps);

  // Handle empty scenes - generate a fallback scene to prevent black screen
  if (sceneMappings.length === 0) {
    return {
      audioDurationSec,
      totalDurationFrames,
      targetDuration: options?.targetDuration,
      scenes: [{
        component: 'TextOnGradient',
        props: {
          text: 'Video Content',
          data: { text: 'Video Content' },
        },
        startTime: 0,
        duration: audioDurationSec,
      }],
    };
  }

  const segments = options?.segments;
  const hasUsableSegments = segments && segments.length > 0;

  // Try segment-based duration calculation
  if (hasUsableSegments) {
    const segmentResult = buildSegmentBasedTimeline(
      sceneMappings,
      segments,
      audioDurationSec,
      fps,
    );

    if (segmentResult) {
      const result: TimelineJSON = {
        audioDurationSec,
        totalDurationFrames,
        targetDuration: options?.targetDuration,
        scenes: segmentResult.scenes,
      };
      const validation = validateTimeline(result, audioDurationSec, fps);
      if (validation.warnings.length > 0) {
        result.validationWarnings = validation.warnings;
      }
      return result;
    }
  }

  // Fallback: proportional scaling (existing behavior)
  const scenes = buildProportionalTimeline(sceneMappings, audioDurationSec);

  const result: TimelineJSON = {
    audioDurationSec,
    totalDurationFrames,
    targetDuration: options?.targetDuration,
    scenes,
  };

  const validation = validateTimeline(result, audioDurationSec, fps);
  if (validation.warnings.length > 0) {
    result.validationWarnings = validation.warnings;
  }

  return result;
}

/**
 * Build timeline using segment timing data.
 * Returns null if all segments lack timing data (signals full fallback).
 */
function buildSegmentBasedTimeline(
  sceneMappings: SceneMapping[],
  segments: DirectionSegment[],
  audioDurationSec: number,
  fps: number,
): { scenes: TimelineJSON['scenes'] } | null {
  const entranceBufferSec = ENTRANCE_BUFFER_FRAMES / fps;
  const exitBufferSec = EXIT_BUFFER_FRAMES / fps;

  // Resolve durations and start times for each segment
  const resolved: Array<{
    duration: number | undefined;
    startTime: number | undefined;
    hasTimings: boolean;
  }> = [];

  for (let i = 0; i < sceneMappings.length; i++) {
    const segment = i < segments.length ? segments[i] : undefined;
    if (segment) {
      const duration = resolveSceneDuration(segment);
      const startTime = resolveSceneStartTime(segment);
      resolved.push({
        duration,
        startTime,
        hasTimings: duration !== undefined,
      });
    } else {
      resolved.push({ duration: undefined, startTime: undefined, hasTimings: false });
    }
  }

  // If ALL segments lack timing data, return null to trigger proportional fallback
  const anyHasTimings = resolved.some((r) => r.hasTimings);
  if (!anyHasTimings) {
    return null;
  }

  // Pre-compute time allocation for unresolved segments
  const totalResolvedDuration = resolved.reduce(
    (sum, r) => sum + (r.hasTimings && r.duration !== undefined
      ? r.duration + entranceBufferSec + exitBufferSec
      : 0),
    0,
  );
  const unresolvedCount = resolved.filter((r) => !r.hasTimings).length;
  const remainingForUnresolved = Math.max(0, audioDurationSec - totalResolvedDuration);
  const perUnresolvedDuration = unresolvedCount > 0 ? remainingForUnresolved / unresolvedCount : 0;

  // Build scenes with segment timings and animation buffers
  const scenes: TimelineJSON['scenes'] = [];
  let currentTime = 0;

  for (let i = 0; i < sceneMappings.length; i++) {
    const mapping = sceneMappings[i];
    const r = resolved[i];

    let sceneStartTime: number;
    let sceneDuration: number;

    if (r.hasTimings && r.duration !== undefined) {
      // Use segment timing with animation buffers
      const segmentStart = r.startTime ?? currentTime;
      sceneStartTime = Math.max(0, segmentStart - entranceBufferSec);
      sceneDuration = r.duration + entranceBufferSec + exitBufferSec;
    } else {
      // This segment has no timing - place contiguously after previous scene
      sceneStartTime = currentTime;
      sceneDuration = perUnresolvedDuration;
    }

    scenes.push({
      component: mapping.component,
      props: mapping.props,
      startTime: sceneStartTime,
      duration: sceneDuration,
    });

    currentTime = sceneStartTime + sceneDuration;
  }

  return { scenes };
}

/**
 * Build timeline using proportional scaling (original behavior).
 */
function buildProportionalTimeline(
  sceneMappings: SceneMapping[],
  audioDurationSec: number,
): TimelineJSON['scenes'] {
  const totalSceneDuration = sceneMappings.reduce((sum, scene) => sum + scene.duration, 0);
  const scaleFactor = audioDurationSec / totalSceneDuration;

  let currentTime = 0;
  return sceneMappings.map((mapping, index) => {
    let duration: number;

    // For last scene, adjust to exactly match audio duration (avoid floating-point drift)
    if (index === sceneMappings.length - 1) {
      duration = audioDurationSec - currentTime;
    } else {
      duration = mapping.duration * scaleFactor;
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
}
