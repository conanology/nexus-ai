/**
 * Script generation stage types
 * @module @nexus-ai/script-gen/types
 */

import { z } from 'zod';

/**
 * Input data for the script generation stage
 */
export interface ScriptGenInput {
  /** Research brief (markdown format) from research stage */
  researchBrief: string;
  /** Target word count range (defaults to 1200-1800) */
  targetWordCount?: {
    min: number;
    max: number;
  };
  /** Pass-through topic data for downstream stages (YouTube metadata) */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}

// ScriptGenOutput is defined as a union type below (V1 | V2) for backward compatibility
// See ScriptGenOutputV1 and ScriptGenOutputV2 interfaces in the V2 Support section

/**
 * Provider info for a single agent execution
 */
export interface AgentProviderInfo {
  name: string;
  tier: 'primary' | 'fallback';
  attempts: number;
}

/**
 * Agent draft result
 */
export interface AgentDraft {
  /** Draft content */
  content: string;
  /** Word count */
  wordCount: number;
  /** Provider info */
  provider: AgentProviderInfo;
}

/**
 * Multi-agent execution result
 */
export interface MultiAgentResult {
  /** Writer draft */
  writerDraft: AgentDraft;
  /** Critic draft (includes critique + revised script) */
  criticDraft: AgentDraft;
  /** Optimizer draft (final optimized script) */
  optimizerDraft: AgentDraft;
}

// =============================================================================
// Direction Document Schema (V2) - Epic 6: Broadcast Quality Video Enhancement
// =============================================================================

// -----------------------------------------------------------------------------
// Type Aliases (String Literal Unions)
// -----------------------------------------------------------------------------

/**
 * Segment types for video content structure
 */
export type SegmentType =
  | 'intro'
  | 'hook'
  | 'explanation'
  | 'code_demo'
  | 'comparison'
  | 'example'
  | 'transition'
  | 'recap'
  | 'outro';

/**
 * Visual component names available in the video studio
 */
export type ComponentName =
  | 'NeuralNetworkAnimation'
  | 'DataFlowDiagram'
  | 'ComparisonChart'
  | 'MetricsCounter'
  | 'ProductMockup'
  | 'CodeHighlight'
  | 'BrandedTransition'
  | 'LowerThird'
  | 'TextOnGradient'
  | 'KineticText'
  | 'BrowserFrame';

/**
 * Entrance animation types
 */
export type EntranceType = 'fade' | 'slide' | 'pop' | 'scale' | 'blur' | 'none';

/**
 * Emphasis animation types
 */
export type EmphasisType = 'pulse' | 'shake' | 'glow' | 'underline' | 'scale' | 'none';

/**
 * Exit animation types
 */
export type ExitType = 'fade' | 'slide' | 'shrink' | 'blur' | 'none';

/**
 * Animation direction
 */
export type AnimationDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Easing types for animations
 */
export type EasingType = 'spring' | 'linear' | 'easeOut' | 'easeInOut';

/**
 * Emphasis trigger types
 */
export type EmphasisTrigger = 'onWord' | 'onSegment' | 'continuous' | 'none';

/**
 * Emphasis word effect types
 */
export type EmphasisEffect = 'scale' | 'glow' | 'underline' | 'color';

/**
 * SFX trigger types
 */
export type SFXTrigger = 'segment_start' | 'segment_end' | 'word' | 'timestamp';

/**
 * Audio mood types
 */
export type AudioMood = 'energetic' | 'contemplative' | 'urgent' | 'neutral';

/**
 * Voice emphasis types
 */
export type VoiceEmphasis = 'normal' | 'excited' | 'serious';

/**
 * Music transition types
 */
export type MusicTransitionType = 'continue' | 'fade' | 'cut' | 'smooth';

/**
 * B-Roll types
 */
export type BRollType = 'code' | 'browser' | 'diagram' | 'animation' | 'static';

/**
 * Browser action types
 */
export type BrowserActionType = 'click' | 'type' | 'scroll' | 'highlight' | 'wait';

/**
 * Browser template IDs
 */
export type BrowserTemplateId = 'api-request' | 'form-submit' | 'dashboard' | 'custom';

/**
 * Diagram types
 */
export type DiagramType = 'flowchart' | 'sequence' | 'architecture' | 'mindmap';

/**
 * B-Roll position types
 */
export type BRollPosition = 'full' | 'left' | 'right' | 'pip';

/**
 * Motion preset names
 */
export type MotionPreset = 'subtle' | 'standard' | 'dramatic';

/**
 * Timing source indicator
 */
export type TimingSource = 'estimated' | 'extracted';

// -----------------------------------------------------------------------------
// Core Interfaces
// -----------------------------------------------------------------------------

/**
 * Spring configuration for physics-based animations
 */
export interface SpringConfig {
  /** Damping factor (default: 100) */
  damping: number;
  /** Stiffness factor (default: 200) */
  stiffness: number;
  /** Mass factor (default: 1) */
  mass: number;
}

/**
 * Entrance animation configuration
 */
export interface EntranceConfig {
  /** Animation type */
  type: EntranceType;
  /** Direction for directional animations */
  direction?: AnimationDirection;
  /** Delay in frames before animation starts (default: 0) */
  delay: number;
  /** Duration in frames (default: 15 = 0.5s at 30fps) */
  duration: number;
  /** Easing function */
  easing: EasingType;
  /** Spring physics config (optional, for spring easing) */
  springConfig?: SpringConfig;
}

/**
 * Emphasis animation configuration
 */
export interface EmphasisConfig {
  /** Animation type */
  type: EmphasisType;
  /** What triggers the emphasis */
  trigger: EmphasisTrigger;
  /** Intensity from 0-1 (default: 0.5) */
  intensity: number;
  /** Duration in frames per pulse (default: 10) */
  duration: number;
}

/**
 * Exit animation configuration
 */
export interface ExitConfig {
  /** Animation type */
  type: ExitType;
  /** Direction for directional animations */
  direction?: AnimationDirection;
  /** Duration in frames (default: 15) */
  duration: number;
  /** Frames before segment end to start exit animation */
  startBeforeEnd: number;
}

/**
 * Complete motion configuration for a segment
 */
export interface MotionConfig {
  /** Use a preset (expands to full config) */
  preset?: MotionPreset;
  /** Entrance animation settings */
  entrance: EntranceConfig;
  /** Emphasis animation settings */
  emphasis: EmphasisConfig;
  /** Exit animation settings */
  exit: ExitConfig;
}

/**
 * Word with special emphasis for animation
 */
export interface EmphasisWord {
  /** The word to emphasize */
  word: string;
  /** Visual effect type */
  effect: EmphasisEffect;
  /** Intensity from 0-1 */
  intensity: number;
}

/**
 * Word-level timing information for kinetic typography
 */
export interface WordTiming {
  /** The word text */
  word: string;
  /** Position in segment (0-based) */
  index: number;
  /** Start time in seconds from video start */
  startTime: number;
  /** End time in seconds from video start */
  endTime: number;
  /** Duration in seconds (endTime - startTime) */
  duration: number;
  /** Links to DirectionSegment.id */
  segmentId: string;
  /** True if this word is in content.emphasis */
  isEmphasis: boolean;
}

/**
 * Sound effect cue configuration
 */
export interface SFXCue {
  /** What triggers the sound effect */
  trigger: SFXTrigger;
  /** Word or timestamp value (if applicable) */
  triggerValue?: string;
  /** SFX library ID */
  sound: string;
  /** Volume from 0-1 */
  volume: number;
}

// -----------------------------------------------------------------------------
// B-Roll Interfaces
// -----------------------------------------------------------------------------

/**
 * Code B-Roll configuration
 */
export interface CodeBRollConfig {
  /** Code content to display */
  content: string;
  /** Programming language */
  language: string;
  /** Lines to highlight */
  highlightLines?: number[];
  /** Enable character-by-character typing animation */
  typingEffect: boolean;
  /** Typing speed in characters per second (default: 30) */
  typingSpeed: number;
  /** Color theme */
  theme: 'dark' | 'light';
  /** Show line numbers */
  showLineNumbers: boolean;
}

/**
 * Browser action for simulated UI interactions
 */
export interface BrowserAction {
  /** Action type */
  type: BrowserActionType;
  /** CSS selector or coordinates */
  target?: string;
  /** Text to type or scroll amount */
  value?: string;
  /** Frames before action starts */
  delay: number;
  /** Frames for action animation */
  duration: number;
}

/**
 * Browser demo B-Roll configuration
 */
export interface BrowserBRollConfig {
  /** URL to display in address bar */
  url: string;
  /** Pre-built template ID */
  templateId: BrowserTemplateId;
  /** Sequence of simulated actions */
  actions: BrowserAction[];
  /** Browser viewport size */
  viewport: { width: number; height: number };
}

/**
 * Diagram B-Roll configuration
 */
export interface DiagramBRollConfig {
  /** Type of diagram */
  diagramType: DiagramType;
  /** Diagram-specific data structure */
  data: Record<string, unknown>;
  /** Animate diagram steps */
  animateSteps: boolean;
}

/**
 * Custom animation B-Roll configuration
 */
export interface AnimationBRollConfig {
  /** Reference to custom animation component */
  componentId: string;
  /** Component props */
  props: Record<string, unknown>;
}

/**
 * Static image B-Roll configuration
 */
export interface StaticBRollConfig {
  /** Image URL */
  imageUrl: string;
  /** Alt text for accessibility */
  alt: string;
  /** Ken Burns zoom effect */
  zoom?: { from: number; to: number };
}

/**
 * Common B-Roll properties shared by all types
 */
export interface BRollBase {
  /** Overlay on top of main content */
  overlay: boolean;
  /** Overlay opacity (0-1) if overlay is true */
  overlayOpacity?: number;
  /** Position on screen */
  position?: BRollPosition;
  /** Frames after segment start to begin B-Roll */
  startOffset: number;
  /** Duration in frames (0 = full segment) */
  duration: number;
}

/**
 * Code B-Roll specification
 */
export interface CodeBRoll extends BRollBase {
  type: 'code';
  code: CodeBRollConfig;
}

/**
 * Browser B-Roll specification
 */
export interface BrowserBRoll extends BRollBase {
  type: 'browser';
  browser: BrowserBRollConfig;
}

/**
 * Diagram B-Roll specification
 */
export interface DiagramBRoll extends BRollBase {
  type: 'diagram';
  diagram: DiagramBRollConfig;
}

/**
 * Animation B-Roll specification
 */
export interface AnimationBRoll extends BRollBase {
  type: 'animation';
  animation: AnimationBRollConfig;
}

/**
 * Static image B-Roll specification
 */
export interface StaticBRoll extends BRollBase {
  type: 'static';
  static: StaticBRollConfig;
}

/**
 * B-Roll specification - discriminated union by type field
 * Each type requires its corresponding config to be present
 */
export type BRollSpec = CodeBRoll | BrowserBRoll | DiagramBRoll | AnimationBRoll | StaticBRoll;

// -----------------------------------------------------------------------------
// Segment Interfaces
// -----------------------------------------------------------------------------

/**
 * Content within a segment (goes to TTS via script.md)
 */
export interface SegmentContent {
  /** Plain narration text */
  text: string;
  /** Word count for duration estimation */
  wordCount: number;
  /** Terms to emphasize visually */
  keywords: string[];
  /** Words with special animation */
  emphasis: EmphasisWord[];
}

/**
 * Timing information for a segment
 */
export interface SegmentTiming {
  /** Estimated start time in seconds (set by script-gen, before TTS) */
  estimatedStartSec?: number;
  /** Estimated end time in seconds (set by script-gen, before TTS) */
  estimatedEndSec?: number;
  /** Estimated duration in seconds (set by script-gen, before TTS) */
  estimatedDurationSec?: number;
  /** Actual start time in seconds (set by timestamp-extraction, after TTS) */
  actualStartSec?: number;
  /** Actual end time in seconds (set by timestamp-extraction, after TTS) */
  actualEndSec?: number;
  /** Actual duration in seconds (set by timestamp-extraction, after TTS) */
  actualDurationSec?: number;
  /** Word-level timings (set by timestamp-extraction) */
  wordTimings?: WordTiming[];
  /** Source of timing data */
  timingSource: TimingSource;
}

/**
 * Visual direction for a segment
 */
export interface SegmentVisual {
  /** Component to render */
  template: ComponentName;
  /** Component-specific props */
  templateProps?: Record<string, unknown>;
  /** Motion/animation configuration */
  motion: MotionConfig;
  /** B-Roll specification */
  broll?: BRollSpec;
}

/**
 * Audio direction for a segment
 */
export interface SegmentAudio {
  /** Mood for music selection */
  mood?: AudioMood;
  /** Sound effect cues */
  sfxCues?: SFXCue[];
  /** Music transition at segment boundary */
  musicTransition?: MusicTransitionType;
  /** Voice emphasis style */
  voiceEmphasis?: VoiceEmphasis;
}

/**
 * A single segment in the direction document
 */
export interface DirectionSegment {
  /** UUID for linking WordTimings */
  id: string;
  /** Order in sequence (0-based) */
  index: number;
  /** Segment type */
  type: SegmentType;
  /** Content for TTS */
  content: SegmentContent;
  /** Timing information */
  timing: SegmentTiming;
  /** Visual direction */
  visual: SegmentVisual;
  /** Audio direction */
  audio: SegmentAudio;
}

// -----------------------------------------------------------------------------
// Document-Level Interfaces
// -----------------------------------------------------------------------------

/**
 * Video resolution specification
 */
export interface VideoResolution {
  width: 1920;
  height: 1080;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  /** Video title */
  title: string;
  /** URL-safe slug */
  slug: string;
  /** Estimated duration before TTS (from word count / 150 WPM) */
  estimatedDurationSec: number;
  /** Actual duration after TTS (from audio duration) */
  actualDurationSec?: number;
  /** Frames per second */
  fps: 30;
  /** Video resolution */
  resolution: VideoResolution;
  /** ISO timestamp when generated */
  generatedAt: string;
}

/**
 * Global audio settings
 */
export interface GlobalAudio {
  /** Default mood for music selection */
  defaultMood: AudioMood;
  /** Transition style between music segments */
  musicTransitions: MusicTransitionType;
}

/**
 * Complete Direction Document - the video blueprint
 */
export interface DirectionDocument {
  /** Schema version for backward compatibility */
  version: '2.0';
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Ordered list of segments */
  segments: DirectionSegment[];
  /** Global audio settings */
  globalAudio: GlobalAudio;
}

// -----------------------------------------------------------------------------
// Motion Presets Constant
// -----------------------------------------------------------------------------

/**
 * Pre-defined motion configurations for common use cases
 */
export const MOTION_PRESETS: Record<MotionPreset, Omit<MotionConfig, 'preset'>> = {
  subtle: {
    entrance: {
      type: 'fade',
      delay: 0,
      duration: 20,
      easing: 'easeOut',
    },
    emphasis: {
      type: 'none',
      trigger: 'none',
      intensity: 0,
      duration: 0,
    },
    exit: {
      type: 'fade',
      duration: 15,
      startBeforeEnd: 15,
    },
  },
  standard: {
    entrance: {
      type: 'slide',
      direction: 'up',
      delay: 0,
      duration: 15,
      easing: 'spring',
    },
    emphasis: {
      type: 'pulse',
      trigger: 'onWord',
      intensity: 0.3,
      duration: 10,
    },
    exit: {
      type: 'fade',
      duration: 15,
      startBeforeEnd: 15,
    },
  },
  dramatic: {
    entrance: {
      type: 'pop',
      delay: 0,
      duration: 12,
      easing: 'spring',
      springConfig: {
        damping: 80,
        stiffness: 300,
        mass: 1,
      },
    },
    emphasis: {
      type: 'glow',
      trigger: 'onWord',
      intensity: 0.6,
      duration: 15,
    },
    exit: {
      type: 'shrink',
      duration: 10,
      startBeforeEnd: 10,
    },
  },
} as const;

// -----------------------------------------------------------------------------
// ScriptGenOutput V2 Support
// -----------------------------------------------------------------------------

/**
 * V1 ScriptGenOutput (legacy format)
 */
export interface ScriptGenOutputV1 {
  /** Final optimized script (markdown with visual cues and pronunciation hints) */
  script: string;
  /** Word count of the final script */
  wordCount: number;
  /** GCS URL where the final script is stored */
  artifactUrl: string;
  /** GCS URLs for all drafts (v1-writer, v2-critic, v3-optimizer) */
  draftUrls: {
    writer: string;
    critic: string;
    optimizer: string;
  };
  /** Number of regeneration attempts (max 3) */
  regenerationAttempts: number;
  /** Provider information for each agent */
  providers: {
    writer: AgentProviderInfo;
    critic: AgentProviderInfo;
    optimizer: AgentProviderInfo;
  };
  /** Quality assessment for the generated script */
  quality?: {
    metrics: {
      wordCount: number;
      targetMin: number;
      targetMax: number;
    };
    status: 'PASS' | 'DEGRADED';
    reason?: string;
  };
  /** Pass-through topic data for downstream stages */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}

/** V2 ScriptGenOutput (new dual-file format) */
export interface ScriptGenOutputV2 extends ScriptGenOutputV1 {
  /** Schema version flag */
  version: '2.0';
  /** Plain narration text (no visual cues) for TTS */
  scriptText: string;
  /** GCS URL to script.md (narration only) */
  scriptUrl: string;
  /** Direction document (video blueprint) */
  directionDocument: DirectionDocument;
  /** GCS URL to direction.json */
  directionUrl: string;
}

/**
 * Type guard to check if output is V2 format
 */
export function isV2Output(output: ScriptGenOutput): output is ScriptGenOutputV2 {
  return 'version' in output && output.version === '2.0';
}

/**
 * Union type for script generation output (supports both V1 legacy and V2 formats)
 * @description V1 is the original format, V2 adds DirectionDocument for video blueprint
 */
export type ScriptGenOutput = ScriptGenOutputV1 | ScriptGenOutputV2;

// -----------------------------------------------------------------------------
// Zod Validation Schemas
// -----------------------------------------------------------------------------

// --- Type Enum Schemas ---

export const SegmentTypeSchema = z.enum([
  'intro',
  'hook',
  'explanation',
  'code_demo',
  'comparison',
  'example',
  'transition',
  'recap',
  'outro',
]);

export const ComponentNameSchema = z.enum([
  'NeuralNetworkAnimation',
  'DataFlowDiagram',
  'ComparisonChart',
  'MetricsCounter',
  'ProductMockup',
  'CodeHighlight',
  'BrandedTransition',
  'LowerThird',
  'TextOnGradient',
  'KineticText',
  'BrowserFrame',
]);

export const EntranceTypeSchema = z.enum(['fade', 'slide', 'pop', 'scale', 'blur', 'none']);

export const EmphasisTypeSchema = z.enum(['pulse', 'shake', 'glow', 'underline', 'scale', 'none']);

export const ExitTypeSchema = z.enum(['fade', 'slide', 'shrink', 'blur', 'none']);

export const AnimationDirectionSchema = z.enum(['left', 'right', 'up', 'down']);

export const EasingTypeSchema = z.enum(['spring', 'linear', 'easeOut', 'easeInOut']);

export const EmphasisTriggerSchema = z.enum(['onWord', 'onSegment', 'continuous', 'none']);

export const EmphasisEffectSchema = z.enum(['scale', 'glow', 'underline', 'color']);

export const SFXTriggerSchema = z.enum(['segment_start', 'segment_end', 'word', 'timestamp']);

export const AudioMoodSchema = z.enum(['energetic', 'contemplative', 'urgent', 'neutral']);

export const VoiceEmphasisSchema = z.enum(['normal', 'excited', 'serious']);

export const MusicTransitionTypeSchema = z.enum(['continue', 'fade', 'cut', 'smooth']);

export const BRollTypeSchema = z.enum(['code', 'browser', 'diagram', 'animation', 'static']);

export const BrowserActionTypeSchema = z.enum(['click', 'type', 'scroll', 'highlight', 'wait']);

export const BrowserTemplateIdSchema = z.enum(['api-request', 'form-submit', 'dashboard', 'custom']);

export const DiagramTypeSchema = z.enum(['flowchart', 'sequence', 'architecture', 'mindmap']);

export const BRollPositionSchema = z.enum(['full', 'left', 'right', 'pip']);

export const MotionPresetSchema = z.enum(['subtle', 'standard', 'dramatic']);

export const TimingSourceSchema = z.enum(['estimated', 'extracted']);

// --- Core Schemas ---

export const SpringConfigSchema = z.object({
  damping: z.number(),
  stiffness: z.number(),
  mass: z.number(),
});

export const EntranceConfigSchema = z.object({
  type: EntranceTypeSchema,
  direction: AnimationDirectionSchema.optional(),
  delay: z.number(),
  duration: z.number(),
  easing: EasingTypeSchema,
  springConfig: SpringConfigSchema.optional(),
});

export const EmphasisConfigSchema = z.object({
  type: EmphasisTypeSchema,
  trigger: EmphasisTriggerSchema,
  intensity: z.number().min(0).max(1),
  duration: z.number(),
});

export const ExitConfigSchema = z.object({
  type: ExitTypeSchema,
  direction: AnimationDirectionSchema.optional(),
  duration: z.number(),
  startBeforeEnd: z.number(),
});

export const MotionConfigSchema = z.object({
  preset: MotionPresetSchema.optional(),
  entrance: EntranceConfigSchema,
  emphasis: EmphasisConfigSchema,
  exit: ExitConfigSchema,
});

export const EmphasisWordSchema = z.object({
  word: z.string(),
  effect: EmphasisEffectSchema,
  intensity: z.number().min(0).max(1),
});

export const WordTimingSchema = z.object({
  word: z.string(),
  index: z.number().int().min(0),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  duration: z.number().min(0),
  segmentId: z.string(),
  isEmphasis: z.boolean(),
});

export const SFXCueSchema = z.object({
  trigger: SFXTriggerSchema,
  triggerValue: z.string().optional(),
  sound: z.string(),
  volume: z.number().min(0).max(1),
});

// --- B-Roll Schemas ---

export const CodeBRollConfigSchema = z.object({
  content: z.string(),
  language: z.string(),
  highlightLines: z.array(z.number()).optional(),
  typingEffect: z.boolean(),
  typingSpeed: z.number(),
  theme: z.enum(['dark', 'light']),
  showLineNumbers: z.boolean(),
});

export const BrowserActionSchema = z.object({
  type: BrowserActionTypeSchema,
  target: z.string().optional(),
  value: z.string().optional(),
  delay: z.number(),
  duration: z.number(),
});

export const BrowserBRollConfigSchema = z.object({
  url: z.string(),
  templateId: BrowserTemplateIdSchema,
  actions: z.array(BrowserActionSchema),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

export const DiagramBRollConfigSchema = z.object({
  diagramType: DiagramTypeSchema,
  data: z.record(z.unknown()),
  animateSteps: z.boolean(),
});

export const AnimationBRollConfigSchema = z.object({
  componentId: z.string(),
  props: z.record(z.unknown()),
});

export const StaticBRollConfigSchema = z.object({
  imageUrl: z.string(),
  alt: z.string(),
  zoom: z
    .object({
      from: z.number(),
      to: z.number(),
    })
    .optional(),
});

// Base schema for common B-Roll properties
const BRollBaseSchema = z.object({
  overlay: z.boolean(),
  overlayOpacity: z.number().min(0).max(1).optional(),
  position: BRollPositionSchema.optional(),
  startOffset: z.number(),
  duration: z.number(),
});

// Discriminated union - each type requires its corresponding config
export const BRollSpecSchema = z.discriminatedUnion('type', [
  BRollBaseSchema.extend({
    type: z.literal('code'),
    code: CodeBRollConfigSchema,
  }),
  BRollBaseSchema.extend({
    type: z.literal('browser'),
    browser: BrowserBRollConfigSchema,
  }),
  BRollBaseSchema.extend({
    type: z.literal('diagram'),
    diagram: DiagramBRollConfigSchema,
  }),
  BRollBaseSchema.extend({
    type: z.literal('animation'),
    animation: AnimationBRollConfigSchema,
  }),
  BRollBaseSchema.extend({
    type: z.literal('static'),
    static: StaticBRollConfigSchema,
  }),
]);

// --- Segment Schemas ---

export const SegmentContentSchema = z.object({
  text: z.string(),
  wordCount: z.number().int().min(0),
  keywords: z.array(z.string()),
  emphasis: z.array(EmphasisWordSchema),
});

export const SegmentTimingSchema = z.object({
  estimatedStartSec: z.number().optional(),
  estimatedEndSec: z.number().optional(),
  estimatedDurationSec: z.number().optional(),
  actualStartSec: z.number().optional(),
  actualEndSec: z.number().optional(),
  actualDurationSec: z.number().optional(),
  wordTimings: z.array(WordTimingSchema).optional(),
  timingSource: TimingSourceSchema,
});

export const SegmentVisualSchema = z.object({
  template: ComponentNameSchema,
  templateProps: z.record(z.unknown()).optional(),
  motion: MotionConfigSchema,
  broll: BRollSpecSchema.optional(),
});

export const SegmentAudioSchema = z.object({
  mood: AudioMoodSchema.optional(),
  sfxCues: z.array(SFXCueSchema).optional(),
  musicTransition: MusicTransitionTypeSchema.optional(),
  voiceEmphasis: VoiceEmphasisSchema.optional(),
});

export const DirectionSegmentSchema = z.object({
  id: z.string(),
  index: z.number().int().min(0),
  type: SegmentTypeSchema,
  content: SegmentContentSchema,
  timing: SegmentTimingSchema,
  visual: SegmentVisualSchema,
  audio: SegmentAudioSchema,
});

// --- Document-Level Schemas ---

export const VideoResolutionSchema = z.object({
  width: z.literal(1920),
  height: z.literal(1080),
});

export const DocumentMetadataSchema = z.object({
  title: z.string(),
  slug: z.string(),
  estimatedDurationSec: z.number(),
  actualDurationSec: z.number().optional(),
  fps: z.literal(30),
  resolution: VideoResolutionSchema,
  generatedAt: z.string(),
});

export const GlobalAudioSchema = z.object({
  defaultMood: AudioMoodSchema,
  musicTransitions: MusicTransitionTypeSchema,
});

export const DirectionDocumentSchema = z.object({
  version: z.literal('2.0'),
  metadata: DocumentMetadataSchema,
  segments: z.array(DirectionSegmentSchema),
  globalAudio: GlobalAudioSchema,
});

// -----------------------------------------------------------------------------
// Validation Helper Function
// -----------------------------------------------------------------------------

/**
 * Validate a DirectionDocument at runtime
 * @param doc Unknown input to validate
 * @returns Validated DirectionDocument
 * @throws ZodError if validation fails
 */
export function validateDirectionDocument(doc: unknown): DirectionDocument {
  return DirectionDocumentSchema.parse(doc);
}

/**
 * Safely validate a DirectionDocument, returning a result object
 * @param doc Unknown input to validate
 * @returns Object with success boolean and either data or error
 */
export function safeValidateDirectionDocument(doc: unknown): z.SafeParseReturnType<unknown, DirectionDocument> {
  return DirectionDocumentSchema.safeParse(doc);
}
