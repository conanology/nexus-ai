/**
 * Image Generation — barrel export
 *
 * @module @nexus-ai/asset-library/image-gen
 */

export {
  IMAGE_STYLE_GUIDE,
  SCENE_VISUAL_LANGUAGE,
  classifySceneConcept,
  determineMood,
  buildMasterPrompt,
  buildPromptForScene,
} from './prompt-engine.js';

export type { ImagePromptParams, Mood } from './prompt-engine.js';

export {
  generateSceneImage,
  generateSceneImages,
} from './image-generator.js';

export type { ImageRequest } from './image-generator.js';
