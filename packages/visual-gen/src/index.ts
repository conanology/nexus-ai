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
export { generateDirectorScenes } from './director-bridge.js';
export type { DirectorBridgeInput, DirectorBridgeOutput } from './director-bridge.js';
export { enrichScenesWithOverlays } from './overlay-enricher.js';
export { enrichScenesWithMemes } from './meme-enricher.js';
export { enrichScenesWithScreenshots } from './screenshot-enricher.js';
export { enrichScenesWithAnnotations } from './annotation-enricher.js';
export { enrichScenesWithGeoData } from './geo-enricher.js';
export { enrichScenesWithSourceScreenshots } from './source-screenshot-enricher.js';
export type { SourceUrl } from './source-screenshot-enricher.js';
export { enrichScenesWithStock } from './stock-enricher.js';
export { enrichScenesWithCodeSnippets } from './code-snippet-generator.js';
export { detectImpactWords } from './impact-word-detector.js';
export type { ImpactWord } from './impact-word-detector.js';
export { buildNanoBananaPrompt, applyVisualLayerCascade } from './asset-fetcher.js';
export { captureWithAgenticBrowser } from './agentic-browser.js';
export type { AgenticCaptureResult } from './agentic-browser.js';

export { buildAssetCaptureStrategy } from './asset-intelligence.js';
export type { AssetCaptureStrategy, AssetSourceKind } from './asset-intelligence.js';
export { deriveSourceBadgeOverlay, sourceKindDisplayLabel } from './source-badge.js';
export { scoreVisualQuality } from './visual-quality-scorer.js';
export type { VisualQualityScore } from './visual-quality-scorer.js';
