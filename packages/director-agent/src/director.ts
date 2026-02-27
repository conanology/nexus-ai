/**
 * Director Agent — Main Orchestrator
 *
 * Ties together script parsing, LLM classification, and validation
 * to produce a complete Scene[] array for SceneRouter.
 *
 * @module @nexus-ai/director-agent/director
 */

import { parseScript } from './script-parser.js';
import { classifyScenes, assignVisualLayers } from './scene-classifier.js';
import { validateScenes } from './validator.js';
import { applyPacing } from './pacing-engine.js';
import { extractColdOpenHook } from './hook-extractor.js';
import { DEFAULT_SCENE_PACING } from './types.js';
import type {
  DirectorInput,
  DirectorOutput,
  Scene,
  SceneType,
  ScenePacing,
  ClassifiedSegment,
  WordTiming,
} from './types.js';

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Generates a complete scene direction from a script.
 *
 * Pipeline:
 * 1. Parse script into 2-3 sentence segments with proportional timing
 * 2. Classify each segment via Gemini LLM into scene types with visualData
 * 3. Validate and repair the classification against Director Rules
 * 4. Map to final Scene[] objects ready for SceneRouter
 *
 * @param input - Script text, total duration, fps, and optional metadata
 * @returns Scene array and accumulated warnings
 */
export async function generateSceneDirection(
  input: DirectorInput,
): Promise<DirectorOutput> {
  const warnings: string[] = [];

  // Step 1: Parse script into segments
  const segments = parseScript(input.script, input.totalDurationFrames);

  if (segments.length === 0) {
    warnings.push('Script produced no segments. Returning empty scene array.');
    return { scenes: [], warnings };
  }

  // Step 2: Classify segments via LLM
  let classified: ClassifiedSegment[];
  try {
    classified = await classifyScenes(segments, input.metadata);

    // Check for fallback warning from classifier
    const classifierWarning = (classified as ClassifiedSegment[] & { _warning?: string })
      ._warning;
    if (classifierWarning) {
      warnings.push(classifierWarning);
    }
  } catch (error) {
    // This shouldn't happen (classifyScenes catches internally), but just in case
    const message =
      error instanceof Error ? error.message : String(error);
    warnings.push(
      `Unexpected classifier error: ${message}. Using narration-default fallback.`,
    );

    classified = segments.map((seg, index) => {
      const sceneType =
        index === 0
          ? ('intro' as const)
          : index === segments.length - 1
            ? ('outro' as const)
            : ('narration-default' as const);
      return {
        ...seg,
        sceneType,
        visualData:
          index === 0
            ? buildIntroVisualData(input)
            : index === segments.length - 1
              ? {}
              : { backgroundVariant: 'gradient' },
        pacing: DEFAULT_SCENE_PACING[sceneType],
      };
    });
  }

  // Step 3: Validate and repair
  const validated = validateScenes(classified);
  warnings.push(...validated.warnings);

  // Step 3b: Assign visual layers (abstract-concept / evidence-screenshot / showcase-scroll)
  const layered = assignVisualLayers(validated.scenes);

  // Step 4: Map to final Scene[] objects with intelligent transitions
  let scenes: Scene[] = layered.map((seg, index) => ({
    id: `scene-${index}-${seg.sceneType}`,
    type: seg.sceneType,
    startFrame: seg.startFrame,
    endFrame: seg.endFrame,
    content: seg.text,
    visualData: seg.visualData as Scene['visualData'],
    pacing: seg.pacing,
    transition: assignTransition(seg.sceneType, seg.pacing, index),
    visualLayer: seg.visualLayer,
    cssSelector: seg.cssSelector,
    highlightText: seg.highlightText,
  }));

  // Step 5: Apply pacing — adjusts durations based on pacing values
  scenes = applyPacing(scenes, input.totalDurationFrames, input.fps);

  // Step 5b: Snap scene boundaries to word-timing boundaries (A/V sync correction)
  snapToWordBoundaries(scenes, input.wordTimings, input.fps);

  // Step 6: Cold Open Hook extraction
  const COLD_OPEN_FRAMES = 54; // ~1.8 seconds at 30fps (Fireship-style: hit fast)
  const hook = extractColdOpenHook(input.script, scenes);

  if (hook) {
    // Create cold-open scene at frame 0
    const coldOpenScene: Scene = {
      id: 'cold-open',
      type: hook.sceneType,
      startFrame: 0,
      endFrame: COLD_OPEN_FRAMES,
      content: hook.text,
      visualData: hook.visualData,
      transition: 'cut',
      sfx: ['impact-hard'],
      isColdOpen: true,
    };

    // Cold-open → intro: hard slam transition (Fireship-style, no soft dissolves)
    if (scenes.length > 0) {
      scenes[0].transition = 'slam';
    }

    // Shift all existing scenes forward by COLD_OPEN_FRAMES
    for (const scene of scenes) {
      scene.startFrame += COLD_OPEN_FRAMES;
      scene.endFrame += COLD_OPEN_FRAMES;
    }

    // Insert cold-open at the beginning
    scenes.unshift(coldOpenScene);

    warnings.push(
      `Cold open: extracted hook from scene ${hook.sourceSceneIndex}: '${hook.text}'`,
    );
  } else {
    warnings.push('Cold open: no suitable hook found, starting with intro');
  }

  return { scenes, warnings };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Assigns a kinetic transition type based on scene type, pacing, and position.
 *
 * Fireship-style: everything is fast and kinetic. Only quotes get soft dissolves.
 * Default is slide-left for continuous motion feel.
 */
function assignTransition(
  sceneType: SceneType,
  pacing: ScenePacing,
  index: number,
): Scene['transition'] {
  // First scene always cuts in clean
  if (index === 0) return 'cut';

  // Scene-type overrides — Fireship-style: hard cuts for impact scenes, kinetic for structure
  if (sceneType === 'stat-callout') return 'cut';     // component has built-in shake + scale-bounce
  if (sceneType === 'text-emphasis') return 'cut';     // component has built-in scale-bounce
  if (sceneType === 'chapter-break') return 'wipe-down';
  if (sceneType === 'comparison') return 'slam';
  if (sceneType === 'code-block') return 'slide-left';
  if (sceneType === 'quote') return 'slide-left';
  if (sceneType === 'meme-reaction') return 'cut';
  if (sceneType === 'logo-showcase') return 'pop-in';
  if (sceneType === 'outro') return 'wipe-down';

  // Punch pacing = instant cuts for impact
  if (pacing === 'punch') return 'cut';

  // Default: kinetic slide for everything else
  return 'slide-left';
}

/**
 * Builds intro visualData from input metadata.
 */
function buildIntroVisualData(
  input: DirectorInput,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (input.metadata?.episodeNumber !== undefined) {
    data.episodeNumber = input.metadata.episodeNumber;
  }
  if (input.metadata?.title) {
    data.episodeTitle = input.metadata.title;
  }
  return data;
}

// =============================================================================
// A/V Sync — Word-Timing Snap Correction
// =============================================================================

/** Minimum scene duration in frames — prevents snap from creating degenerate scenes */
const MIN_SCENE_FRAMES = 15;

/** Maximum snap distance in frames (~167ms at 30fps) */
const SNAP_TOLERANCE_FRAMES = 5;

/**
 * Snaps scene boundaries to the nearest word-timing boundary for tighter A/V sync.
 *
 * Character-weighted frame distribution drifts from actual speaking rate
 * (e.g., "AI" = 2 chars but ~0.5s, "Kubernetes" = 10 chars but ~0.5s).
 * This correction re-anchors scene end-frames to the nearest spoken-word
 * boundary, eliminating drift within the snap tolerance.
 *
 * @param scenes - Scene array (mutated in place)
 * @param wordTimings - Word-level timing data from STT or estimation
 * @param fps - Frames per second
 */
function snapToWordBoundaries(
  scenes: Scene[],
  wordTimings: WordTiming[] | undefined,
  fps: number,
): void {
  if (!wordTimings || wordTimings.length === 0 || scenes.length < 2) return;

  // Build sorted array of word-end frames (natural sentence/word boundaries)
  const wordEndFrames = wordTimings
    .map((wt) => Math.round(wt.endTime * fps))
    .sort((a, b) => a - b);

  let snappedCount = 0;

  // Snap all scene boundaries except the last scene's endFrame (must match totalDuration)
  for (let i = 0; i < scenes.length - 1; i++) {
    const scene = scenes[i];
    const nextScene = scenes[i + 1];
    const targetFrame = scene.endFrame;

    // Binary search for nearest word boundary
    const nearest = findNearestFrame(wordEndFrames, targetFrame);
    const distance = Math.abs(nearest - targetFrame);

    if (distance > 0 && distance <= SNAP_TOLERANCE_FRAMES) {
      // Guard: ensure snap doesn't create a scene shorter than MIN_SCENE_FRAMES
      const newDuration = nearest - scene.startFrame;
      const nextNewDuration = nextScene.endFrame - nearest;

      if (newDuration >= MIN_SCENE_FRAMES && nextNewDuration >= MIN_SCENE_FRAMES) {
        scene.endFrame = nearest;
        nextScene.startFrame = nearest;
        snappedCount++;
      }
    }
  }

  if (snappedCount > 0) {
    console.log(`  A/V sync: snapped ${snappedCount}/${scenes.length - 1} scene boundaries to word timings`);
  }
}

/**
 * Binary search for the frame in `sortedFrames` nearest to `target`.
 */
function findNearestFrame(sortedFrames: number[], target: number): number {
  if (sortedFrames.length === 0) return target;

  let lo = 0;
  let hi = sortedFrames.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedFrames[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  // lo is the first element >= target — check both lo and lo-1
  const candidates = [sortedFrames[lo]];
  if (lo > 0) candidates.push(sortedFrames[lo - 1]);

  return candidates.reduce((best, frame) =>
    Math.abs(frame - target) < Math.abs(best - target) ? frame : best,
  );
}
