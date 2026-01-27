/**
 * @nexus-ai/script-gen
 * Multi-agent script generation stage for NEXUS-AI pipeline
 */

// Export main stage function
export { executeScriptGen } from './script-gen.js';

// Export internal functions for testing
export {
  parseDualOutput,
  generateSegmentsFromNarration,
  stripBrackets,
} from './script-gen.js';

// Export types
export type {
  ScriptGenInput,
  ScriptGenOutput,
  AgentProviderInfo,
  AgentDraft,
  MultiAgentResult,
  // Direction Document types (V2)
  DirectionDocument,
  DirectionSegment,
  DocumentMetadata,
  GlobalAudio,
  SegmentContent,
  SegmentTiming,
  SegmentVisual,
  SegmentAudio,
  MotionConfig,
  EntranceConfig,
  EmphasisConfig,
  ExitConfig,
  SpringConfig,
  EmphasisWord,
  WordTiming,
  SFXCue,
  // B-Roll discriminated union types
  BRollSpec,
  BRollBase,
  CodeBRoll,
  BrowserBRoll,
  DiagramBRoll,
  AnimationBRoll,
  StaticBRoll,
  // B-Roll config types
  CodeBRollConfig,
  BrowserBRollConfig,
  DiagramBRollConfig,
  AnimationBRollConfig,
  StaticBRollConfig,
  BrowserAction,
  VideoResolution,
  // Type aliases
  SegmentType,
  ComponentName,
  EntranceType,
  EmphasisType,
  ExitType,
  AnimationDirection,
  EasingType,
  EmphasisTrigger,
  EmphasisEffect,
  SFXTrigger,
  AudioMood,
  VoiceEmphasis,
  MusicTransitionType,
  BRollType,
  BrowserActionType,
  BrowserTemplateId,
  DiagramType,
  BRollPosition,
  MotionPreset,
  TimingSource,
  // V2 output types
  ScriptGenOutputV1,
  ScriptGenOutputV2,
} from './types.js';

// Export constants
export { MOTION_PRESETS } from './types.js';

// Export type guard
export { isV2Output } from './types.js';

// Export Zod schemas for runtime validation
export {
  DirectionDocumentSchema,
  DirectionSegmentSchema,
  DocumentMetadataSchema,
  GlobalAudioSchema,
  SegmentContentSchema,
  SegmentTimingSchema,
  SegmentVisualSchema,
  SegmentAudioSchema,
  MotionConfigSchema,
  EntranceConfigSchema,
  EmphasisConfigSchema,
  ExitConfigSchema,
  SpringConfigSchema,
  EmphasisWordSchema,
  WordTimingSchema,
  SFXCueSchema,
  BRollSpecSchema,
  CodeBRollConfigSchema,
  BrowserBRollConfigSchema,
  DiagramBRollConfigSchema,
  AnimationBRollConfigSchema,
  StaticBRollConfigSchema,
  BrowserActionSchema,
  VideoResolutionSchema,
  // Enum schemas
  SegmentTypeSchema,
  ComponentNameSchema,
  EntranceTypeSchema,
  EmphasisTypeSchema,
  ExitTypeSchema,
  AnimationDirectionSchema,
  EasingTypeSchema,
  EmphasisTriggerSchema,
  EmphasisEffectSchema,
  SFXTriggerSchema,
  AudioMoodSchema,
  VoiceEmphasisSchema,
  MusicTransitionTypeSchema,
  BRollTypeSchema,
  BrowserActionTypeSchema,
  BrowserTemplateIdSchema,
  DiagramTypeSchema,
  BRollPositionSchema,
  MotionPresetSchema,
  TimingSourceSchema,
} from './types.js';

// Export validation helpers
export { validateDirectionDocument, safeValidateDirectionDocument } from './types.js';

// Export prompts (for testing)
export {
  buildWriterPrompt,
  buildCriticPrompt,
  buildOptimizerPrompt,
  buildWordCountAdjustmentPrompt,
} from './prompts.js';

// Export compatibility utilities (V1 → V2 migration)
export {
  getScriptText,
  getDirectionDocument,
  parseLegacyVisualCues,
  mapV1ComponentToV2,
  detectSegmentType,
} from './compatibility.js';
