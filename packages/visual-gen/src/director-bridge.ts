/**
 * Director Agent Bridge
 *
 * Wraps @nexus-ai/director-agent for consumption by the visual-gen pipeline.
 * Converts pipeline-level inputs (audioDurationSec, metadata) into the
 * DirectorInput format and returns Scene[] with quality metrics.
 *
 * @module @nexus-ai/visual-gen/director-bridge
 */

import {
  generateSceneDirection,
} from '@nexus-ai/director-agent';
import type {
  Scene,
  DirectorInput,
  WordTiming,
} from '@nexus-ai/director-agent';

// =============================================================================
// Types
// =============================================================================

export interface DirectorBridgeInput {
  script: string;
  audioDurationSec: number;
  fps?: number;
  wordTimings?: WordTiming[];
  metadata?: {
    topic?: string;
    episodeNumber?: number;
    title?: string;
  };
}

export interface DirectorBridgeOutput {
  scenes: Scene[];
  warnings: string[];
  sceneCount: number;
  sceneTypeDistribution: Record<string, number>;
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Generates Scene[] using the Director Agent.
 *
 * Converts pipeline-level inputs into DirectorInput format,
 * calls generateSceneDirection(), and returns enriched output
 * with scene count and type distribution metrics.
 *
 * @param input - Script text, audio duration, and optional metadata
 * @returns Scene array with quality metrics and warnings
 */
export async function generateDirectorScenes(
  input: DirectorBridgeInput,
): Promise<DirectorBridgeOutput> {
  const fps = input.fps ?? 30;
  const totalDurationFrames = Math.ceil(input.audioDurationSec * fps);

  const directorInput: DirectorInput = {
    script: input.script,
    totalDurationFrames,
    fps,
    wordTimings: input.wordTimings,
    metadata: input.metadata,
  };

  const result = await generateSceneDirection(directorInput);

  // Compute scene type distribution
  const sceneTypeDistribution: Record<string, number> = {};
  for (const scene of result.scenes) {
    sceneTypeDistribution[scene.type] =
      (sceneTypeDistribution[scene.type] ?? 0) + 1;
  }

  // Log warnings to console for visibility
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`[director-agent] ${warning}`);
    }
  }

  return {
    scenes: result.scenes,
    warnings: result.warnings,
    sceneCount: result.scenes.length,
    sceneTypeDistribution,
  };
}
