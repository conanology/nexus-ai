/**
 * Director Agent — Main Orchestrator
 *
 * Ties together script parsing, LLM classification, and validation
 * to produce a complete Scene[] array for SceneRouter.
 *
 * @module @nexus-ai/director-agent/director
 */

import { parseScript } from './script-parser.js';
import { classifyScenes } from './scene-classifier.js';
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

  // Step 4: Map to final Scene[] objects with intelligent transitions
  let scenes: Scene[] = validated.scenes.map((seg, index) => ({
    id: `scene-${index}-${seg.sceneType}`,
    type: seg.sceneType,
    startFrame: seg.startFrame,
    endFrame: seg.endFrame,
    content: seg.text,
    visualData: seg.visualData as Scene['visualData'],
    pacing: seg.pacing,
    transition: assignTransition(seg.sceneType, seg.pacing, index),
  }));

  // Step 5: Apply pacing — adjusts durations based on pacing values
  scenes = applyPacing(scenes, input.totalDurationFrames, input.fps);

  // Step 6: Cold Open Hook extraction
  const COLD_OPEN_FRAMES = 80; // ~2.7 seconds at 30fps
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

    // Cold-open → intro should dissolve through black
    if (scenes.length > 0) {
      scenes[0].transition = 'dissolve';
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
 * Assigns a transition type based on scene type, pacing, and position.
 *
 * Rules (ordered by specificity):
 * - First scene (intro) → 'cut' (clean start)
 * - 'punch' pacing → 'cut' (impactful, instant)
 * - meme-reaction → 'cut' (sharp in/out)
 * - chapter-break → 'dissolve' (fade through black)
 * - quote → 'crossfade' (soft entrance)
 * - 'breathe' pacing → 'crossfade' (gentle)
 * - Everything else → 'crossfade' (default smooth)
 */
function assignTransition(
  sceneType: SceneType,
  pacing: ScenePacing,
  index: number,
): Scene['transition'] {
  // First scene always cuts in clean
  if (index === 0) return 'cut';

  // Punch pacing = instant cuts for impact
  if (pacing === 'punch') return 'cut';

  // Scene-type overrides
  if (sceneType === 'meme-reaction') return 'cut';
  if (sceneType === 'chapter-break') return 'dissolve';
  if (sceneType === 'quote') return 'crossfade';
  if (sceneType === 'outro') return 'dissolve';

  // Breathe pacing = gentle crossfade
  if (pacing === 'breathe') return 'crossfade';

  // Default: smooth crossfade for everything else
  return 'crossfade';
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
