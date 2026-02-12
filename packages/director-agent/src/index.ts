/**
 * @nexus-ai/director-agent
 *
 * LLM-powered Director Agent for scene classification and visual data generation.
 * Takes a raw script and produces a complete Scene[] array for SceneRouter.
 *
 * @example
 * ```typescript
 * import { generateSceneDirection } from '@nexus-ai/director-agent';
 *
 * const result = await generateSceneDirection({
 *   script: 'For the last twenty years...',
 *   totalDurationFrames: 9000,
 *   fps: 30,
 *   metadata: { title: 'AI Revolution', episodeNumber: 42 },
 * });
 *
 * console.log(result.scenes); // Scene[] ready for SceneRouter
 * console.log(result.warnings); // Any validation warnings
 * ```
 */

// Main entry point
export { generateSceneDirection } from './director.js';

// Pipeline components (exported for testing and advanced usage)
export { parseScript, splitIntoSentences } from './script-parser.js';
export { classifyScenes } from './scene-classifier.js';
export { validateScenes } from './validator.js';
export { applyPacing } from './pacing-engine.js';
export { extractColdOpenHook } from './hook-extractor.js';
export type { ColdOpenHook } from './hook-extractor.js';

// Prompts (exported for testing and debugging)
export { DIRECTOR_SYSTEM_PROMPT } from './prompts/director-system.js';
export { buildDirectorUserPrompt } from './prompts/director-user.js';

// Types
export type {
  ScenePacing,
  SceneType,
  Scene,
  DirectorInput,
  DirectorOutput,
  WordTiming,
  ScriptSegment,
  ClassifiedSegment,
  AnyVisualData,
  VisualDataMap,
  // Individual VisualData types
  IntroVisualData,
  ChapterBreakVisualData,
  NarrationDefaultVisualData,
  TextEmphasisVisualData,
  FullScreenTextVisualData,
  StatCalloutVisualData,
  ComparisonVisualData,
  DiagramVisualData,
  LogoShowcaseVisualData,
  TimelineVisualData,
  QuoteVisualData,
  ListRevealVisualData,
  CodeBlockVisualData,
  MemeReactionVisualData,
  OutroVisualData,
  // LLM response types
  LLMSceneEntry,
  LLMDirectorResponse,
  // Overlay types
  OverlayType,
  BaseOverlay,
  CornerLogoOverlay,
  InfoBadgeOverlay,
  FloatingLabelOverlay,
  SourceCitationOverlay,
  KeyPhraseOverlay,
  SourceBadgeOverlay,
  SceneOverlay,
  // Annotation types
  AnnotationType,
  BaseAnnotation,
  CircleAnnotation,
  ArrowAnnotation,
  UnderlineAnnotation,
  XMarkAnnotation,
  SceneAnnotation,
} from './types.js';

// Constants and schemas
export {
  SCENE_TYPES,
  SCENE_PACING_VALUES,
  DEFAULT_SCENE_PACING,
  VISUAL_DATA_SCHEMAS,
  SceneTypeSchema,
  ScenePacingSchema,
  LLMSceneEntrySchema,
  LLMDirectorResponseSchema,
  // Individual VisualData schemas
  IntroVisualDataSchema,
  ChapterBreakVisualDataSchema,
  NarrationDefaultVisualDataSchema,
  TextEmphasisVisualDataSchema,
  FullScreenTextVisualDataSchema,
  StatCalloutVisualDataSchema,
  ComparisonVisualDataSchema,
  DiagramVisualDataSchema,
  LogoShowcaseVisualDataSchema,
  TimelineVisualDataSchema,
  QuoteVisualDataSchema,
  ListRevealVisualDataSchema,
  CodeBlockVisualDataSchema,
  MemeReactionVisualDataSchema,
  OutroVisualDataSchema,
} from './types.js';
