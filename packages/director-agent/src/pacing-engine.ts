/**
 * Pacing Engine
 *
 * Recalculates scene durations based on their pacing values ('punch', 'breathe',
 * 'dense', 'normal') to create rhythmic variation in the video timeline.
 *
 * @module @nexus-ai/director-agent/pacing-engine
 */

import type { Scene, ScenePacing } from './types.js';

// =============================================================================
// Constants
// =============================================================================

/** Pacing multipliers relative to baseDuration */
const PACING_MULTIPLIER: Record<ScenePacing, number> = {
  punch: 0.6,
  breathe: 1.5,
  dense: 1.2,
  normal: 1.0,
};

/** Duration constraints per pacing type (in frames) */
const PACING_CONSTRAINTS: Record<ScenePacing, { min: number; max: number }> = {
  punch: { min: 60, max: 90 },
  breathe: { min: 150, max: 270 },
  dense: { min: 150, max: 240 },
  normal: { min: 90, max: 180 },
};

/** Absolute limits for any scene */
const ABSOLUTE_MIN_FRAMES = 45; // 1.5 seconds at 30fps
const ABSOLUTE_MAX_FRAMES = 300; // 10 seconds at 30fps

// =============================================================================
// Main Export
// =============================================================================

/**
 * Applies pacing to scenes by recalculating durations based on pacing values.
 *
 * Steps:
 * 1. Calculate target durations using pacing multipliers
 * 2. Normalize to fit totalDurationFrames
 * 3. Enforce rhythm rules (no 3+ consecutive punch, etc.)
 * 4. Recalculate startFrame/endFrame
 *
 * Scenes with isColdOpen=true keep their original duration.
 * Scenes with type='meme-reaction' keep their 36-frame duration.
 */
export function applyPacing(
  scenes: Scene[],
  totalDurationFrames: number,
  _fps: number,
): Scene[] {
  if (scenes.length === 0) return [];

  // Separate fixed scenes (cold open, meme-reaction) from paced scenes
  const fixedFrames = scenes.reduce((sum, s) => {
    if (s.isColdOpen || s.type === 'meme-reaction') {
      return sum + (s.endFrame - s.startFrame);
    }
    return sum;
  }, 0);

  const pacedScenes = scenes.filter(
    (s) => !s.isColdOpen && s.type !== 'meme-reaction',
  );
  const availableFrames = totalDurationFrames - fixedFrames;

  if (pacedScenes.length === 0) {
    // All scenes are fixed — just recalculate start/end frames
    return recalculateFrames(scenes, totalDurationFrames);
  }

  // Step 0: Apply rhythm rules to pacing values
  applyRhythmRules(scenes);

  // Step 1: Calculate target durations
  const baseDuration = availableFrames / pacedScenes.length;
  const targets = new Map<Scene, number>();

  for (const scene of pacedScenes) {
    const pacing = scene.pacing ?? 'normal';
    const multiplier = PACING_MULTIPLIER[pacing];
    const constraints = PACING_CONSTRAINTS[pacing];
    const target = Math.round(baseDuration * multiplier);
    targets.set(scene, Math.max(constraints.min, Math.min(constraints.max, target)));
  }

  // Step 2: Normalize to fit available frames
  normalizeToFit(targets, pacedScenes, availableFrames);

  // Step 3: Apply absolute limits
  for (const scene of pacedScenes) {
    let dur = targets.get(scene)!;
    dur = Math.max(ABSOLUTE_MIN_FRAMES, Math.min(ABSOLUTE_MAX_FRAMES, dur));
    targets.set(scene, dur);
  }

  // Re-normalize after clamping
  normalizeToFit(targets, pacedScenes, availableFrames);

  // Step 4: Apply durations back to scenes (temporary — we'll recalculate frames next)
  for (const scene of pacedScenes) {
    const duration = targets.get(scene)!;
    scene.endFrame = scene.startFrame + duration;
  }

  // Step 5: Recalculate all start/end frames sequentially
  const result = recalculateFrames(scenes, totalDurationFrames);

  // Log pacing distribution
  logPacingDistribution(result);

  return result;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalizes target durations so they sum exactly to availableFrames.
 * Distributes rounding remainder to 'breathe' scenes (most flexible),
 * or falls back to the largest-duration scene.
 */
function normalizeToFit(
  targets: Map<Scene, number>,
  pacedScenes: Scene[],
  availableFrames: number,
): void {
  const sum = pacedScenes.reduce((s, scene) => s + targets.get(scene)!, 0);
  if (sum === availableFrames) return;

  if (sum === 0) {
    // Edge case: all zeros, distribute evenly
    const each = Math.floor(availableFrames / pacedScenes.length);
    for (const scene of pacedScenes) {
      targets.set(scene, each);
    }
    // Give remainder to first scene
    const remainder = availableFrames - each * pacedScenes.length;
    if (remainder > 0 && pacedScenes.length > 0) {
      targets.set(pacedScenes[0], each + remainder);
    }
    return;
  }

  // Scale proportionally
  const ratio = availableFrames / sum;
  let runningTotal = 0;

  for (let i = 0; i < pacedScenes.length; i++) {
    const scene = pacedScenes[i];
    if (i === pacedScenes.length - 1) {
      // Last scene gets whatever is left to ensure exact fit
      targets.set(scene, availableFrames - runningTotal);
    } else {
      const scaled = Math.round(targets.get(scene)! * ratio);
      targets.set(scene, scaled);
      runningTotal += scaled;
    }
  }
}

/**
 * Recalculates startFrame/endFrame for all scenes sequentially,
 * preserving each scene's duration.
 */
function recalculateFrames(scenes: Scene[], totalDurationFrames: number): Scene[] {
  let currentFrame = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const duration = scene.endFrame - scene.startFrame;
    scene.startFrame = currentFrame;
    scene.endFrame = currentFrame + duration;
    currentFrame = scene.endFrame;
  }

  // Fix any drift on the last scene
  if (scenes.length > 0) {
    const last = scenes[scenes.length - 1];
    const drift = totalDurationFrames - last.endFrame;
    if (drift !== 0) {
      last.endFrame = totalDurationFrames;
    }
  }

  return scenes;
}

/**
 * Enforces rhythm rules on pacing values (mutates scenes in place):
 * - No more than 2 consecutive 'punch' scenes → change middle to 'normal'
 * - No more than 4 consecutive non-'breathe' scenes → change one to 'breathe'
 */
function applyRhythmRules(scenes: Scene[]): void {
  const paced = scenes.filter(
    (s) => !s.isColdOpen && s.type !== 'meme-reaction',
  );

  // Rule 1: No 3+ consecutive 'punch'
  for (let i = 1; i < paced.length - 1; i++) {
    if (
      paced[i - 1].pacing === 'punch' &&
      paced[i].pacing === 'punch' &&
      paced[i + 1].pacing === 'punch'
    ) {
      paced[i].pacing = 'normal';
    }
  }

  // Rule 2: No 5+ consecutive non-'breathe'
  let streak = 0;
  for (let i = 0; i < paced.length; i++) {
    if (paced[i].pacing === 'breathe') {
      streak = 0;
    } else {
      streak++;
      if (streak >= 5) {
        // Change the middle scene of the streak to 'breathe'
        const midIndex = i - 2;
        if (midIndex >= 0) {
          paced[midIndex].pacing = 'breathe';
        }
        streak = 0;
      }
    }
  }
}

/**
 * Logs the pacing distribution to console.
 */
function logPacingDistribution(scenes: Scene[]): void {
  const paced = scenes.filter(
    (s) => !s.isColdOpen && s.type !== 'meme-reaction',
  );
  const total = paced.length || 1;

  const counts: Record<string, number> = { punch: 0, breathe: 0, dense: 0, normal: 0 };
  for (const scene of paced) {
    const p = scene.pacing ?? 'normal';
    counts[p] = (counts[p] || 0) + 1;
  }

  const pct = (n: number) => Math.round((n / total) * 100);
  console.log(
    `Pacing: ${pct(counts.punch)}% punch, ${pct(counts.breathe)}% breathe, ${pct(counts.dense)}% dense, ${pct(counts.normal)}% normal`,
  );
}
