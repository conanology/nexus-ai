/**
 * V1 → V2 Compatibility Layer
 * Provides utilities for migrating between legacy V1 script output and V2 DirectionDocument format
 * @module @nexus-ai/script-gen/compatibility
 */

import {
  type ScriptGenOutput,
  type DirectionDocument,
  type DirectionSegment,
  type ComponentName,
  type SegmentType,
  type EmphasisWord,
  isV2Output,
  validateDirectionDocument,
  MOTION_PRESETS,
} from './types.js';

// =============================================================================
// Re-exports
// =============================================================================

// Re-export isV2Output type guard from types.ts
export { isV2Output } from './types.js';

// =============================================================================
// Regex Patterns for V1 Bracket Stripping
// =============================================================================

/** Pattern to match [VISUAL:...] tags */
const VISUAL_CUE = /\[VISUAL:[^\]]+\]\s*/g;

/** Pattern to match [PRONOUNCE:term:ipa] tags - captures the term for replacement */
const PRONOUNCE_CUE = /\[PRONOUNCE:([^:]+):[^\]]+\]/g;

/** Pattern to match [MUSIC:...] tags */
const MUSIC_CUE = /\[MUSIC:[^\]]+\]\s*/g;

/** Pattern to match [SFX:...] tags */
const SFX_CUE = /\[SFX:[^\]]+\]\s*/g;

// =============================================================================
// Component Name Mapping
// =============================================================================

/**
 * Mapping from V1 component hints to V2 ComponentName values
 * All keys are lowercase for case-insensitive lookup
 */
const V1_COMPONENT_MAP: Record<string, ComponentName> = {
  // Neural network variants
  neural_network: 'NeuralNetworkAnimation',
  neuralnetwork: 'NeuralNetworkAnimation',
  'neural-network': 'NeuralNetworkAnimation',

  // Data flow variants
  data_flow: 'DataFlowDiagram',
  dataflow: 'DataFlowDiagram',
  'data-flow': 'DataFlowDiagram',

  // Comparison variants
  comparison: 'ComparisonChart',
  chart: 'ComparisonChart',

  // Metrics variants
  metrics: 'MetricsCounter',
  counter: 'MetricsCounter',

  // Product variants
  product: 'ProductMockup',
  mockup: 'ProductMockup',

  // Code variants
  code: 'CodeHighlight',
  code_highlight: 'CodeHighlight',
  codehighlight: 'CodeHighlight',
  'code-highlight': 'CodeHighlight',

  // Transition
  transition: 'BrandedTransition',
  branded_transition: 'BrandedTransition',

  // Lower third variants
  lower_third: 'LowerThird',
  lowerthird: 'LowerThird',
  'lower-third': 'LowerThird',

  // Text
  text: 'TextOnGradient',
  textonGradient: 'TextOnGradient',

  // Kinetic text
  kinetic: 'KineticText',
  kinetictext: 'KineticText',
  'kinetic-text': 'KineticText',

  // Browser
  browser: 'BrowserFrame',
  browserframe: 'BrowserFrame',
  'browser-frame': 'BrowserFrame',
};

/**
 * Map a V1 component hint string to a V2 ComponentName
 * @param hint - V1 component hint (e.g., 'neural_network', 'NEURAL_NETWORK', 'code-highlight')
 * @returns ComponentName - Mapped V2 component name, or 'TextOnGradient' as fallback
 */
export function mapV1ComponentToV2(hint: string): ComponentName {
  if (!hint) {
    return 'TextOnGradient';
  }

  // Normalize: lowercase, replace hyphens with underscores, then try both formats
  const normalized = hint.toLowerCase().replace(/-/g, '_');
  const withoutUnderscore = normalized.replace(/_/g, '');

  return V1_COMPONENT_MAP[normalized] || V1_COMPONENT_MAP[withoutUnderscore] || 'TextOnGradient';
}

// =============================================================================
// Segment Type Detection
// =============================================================================

/** Keywords that indicate code_demo segment type */
const CODE_KEYWORDS = [
  'function',
  'class',
  'const',
  'let',
  'var',
  'import',
  'export',
  'api',
  'endpoint',
  'method',
  'parameter',
  'argument',
  'return',
  'async',
  'await',
];

/** Keywords that indicate comparison segment type */
const COMPARISON_KEYWORDS = ['vs', 'versus', 'compared', 'comparison', 'difference', 'differences', 'better', 'worse'];

/**
 * Detect segment type based on text content and position
 * @param text - Segment text content
 * @param index - Segment index (0-based)
 * @param totalSegments - Total number of segments
 * @returns SegmentType
 */
export function detectSegmentType(text: string, index: number, totalSegments: number): SegmentType {
  // First segment is intro
  if (index === 0) {
    return 'intro';
  }

  // Last segment is outro (unless it's also the first)
  if (index === totalSegments - 1 && totalSegments > 1) {
    return 'outro';
  }

  const lowerText = text.toLowerCase();

  // Check for code blocks
  if (text.includes('```') || text.includes('`')) {
    return 'code_demo';
  }

  // Check for code-related keywords
  for (const keyword of CODE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return 'code_demo';
    }
  }

  // Check for comparison keywords
  for (const keyword of COMPARISON_KEYWORDS) {
    // Use word boundary matching to avoid false positives
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(text)) {
      return 'comparison';
    }
  }

  // Default to explanation for middle segments
  return 'explanation';
}

// =============================================================================
// getScriptText - Extract plain narration text
// =============================================================================

/**
 * Extract plain narration text from script output
 * For V2: Returns scriptText directly
 * For V1: Strips all visual cue brackets
 *
 * @param output - Script generation output (V1 or V2)
 * @returns Plain narration text suitable for TTS
 */
export function getScriptText(output: ScriptGenOutput): string {
  // V2: Return scriptText directly
  if (isV2Output(output)) {
    return output.scriptText;
  }

  // V1: Strip all bracket patterns
  let text = output.script;

  // Strip [VISUAL:...] tags
  text = text.replace(VISUAL_CUE, '');

  // Replace [PRONOUNCE:term:ipa] with just the term
  text = text.replace(PRONOUNCE_CUE, '$1');

  // Strip [MUSIC:...] tags
  text = text.replace(MUSIC_CUE, '');

  // Strip [SFX:...] tags
  text = text.replace(SFX_CUE, '');

  // Normalize whitespace: collapse multiple spaces/newlines, trim
  text = text.replace(/[ \t]+/g, ' '); // Collapse horizontal whitespace
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  text = text.replace(/^ +| +$/gm, ''); // Trim line-level whitespace
  text = text.trim();

  return text;
}

// =============================================================================
// parseLegacyVisualCues - Convert V1 script to DirectionDocument
// =============================================================================

/**
 * Pattern to split V1 script into segments at visual cue boundaries
 * Captures: [1] component hint, [2] text until next cue or end
 */
const VISUAL_CUE_SPLIT = /\[VISUAL:([^\]]+)\]\s*/g;

/**
 * Pattern to find PRONOUNCE tags for emphasis extraction
 */
const PRONOUNCE_EXTRACT = /\[PRONOUNCE:([^:]+):[^\]]+\]/g;

/**
 * Extract keywords from a visual cue hint
 * @param hint - Visual cue content (e.g., 'neural_network')
 * @returns Array of keywords
 */
function extractKeywordsFromHint(hint: string): string[] {
  // Split on underscores, hyphens, and camelCase boundaries
  return hint
    .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase to snake_case
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter((word) => word.length > 0);
}

/**
 * Extract emphasis words from text containing PRONOUNCE tags
 * @param text - Text potentially containing [PRONOUNCE:term:ipa] tags
 * @returns Array of EmphasisWord objects
 */
function extractEmphasisFromText(text: string): EmphasisWord[] {
  const emphasis: EmphasisWord[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  PRONOUNCE_EXTRACT.lastIndex = 0;

  while ((match = PRONOUNCE_EXTRACT.exec(text)) !== null) {
    emphasis.push({
      word: match[1],
      effect: 'glow',
      intensity: 0.5,
    });
  }

  return emphasis;
}

/**
 * Count words in text (excluding bracket tags)
 */
function countWords(text: string): number {
  // Strip all bracket tags first
  const stripped = text
    .replace(VISUAL_CUE, '')
    .replace(PRONOUNCE_CUE, '$1')
    .replace(MUSIC_CUE, '')
    .replace(SFX_CUE, '')
    .trim();

  if (!stripped) return 0;

  return stripped.split(/\s+/).length;
}

/**
 * Interface for segment data before final assembly
 */
interface SegmentData {
  componentHint: string;
  text: string;
  wordCount: number;
  keywords: string[];
  emphasis: EmphasisWord[];
}

/**
 * Parse V1 script format into segment data
 */
function parseV1Script(script: string): SegmentData[] {
  const segments: SegmentData[] = [];

  // Reset regex lastIndex
  VISUAL_CUE_SPLIT.lastIndex = 0;

  // Find all visual cue positions
  const cues: Array<{ index: number; hint: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = VISUAL_CUE_SPLIT.exec(script)) !== null) {
    cues.push({
      index: match.index,
      hint: match[1],
    });
  }

  // If no cues found, treat entire script as one segment
  if (cues.length === 0) {
    const text = script.trim();
    return [
      {
        componentHint: 'text',
        text: text.replace(PRONOUNCE_CUE, '$1').replace(MUSIC_CUE, '').replace(SFX_CUE, '').trim(),
        wordCount: countWords(text),
        keywords: [],
        emphasis: extractEmphasisFromText(text),
      },
    ];
  }

  // Extract text between each cue
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const startIndex = cue.index + `[VISUAL:${cue.hint}]`.length;

    // Find end of this segment (start of next cue or end of script)
    let endIndex: number;
    if (i < cues.length - 1) {
      endIndex = cues[i + 1].index;
    } else {
      endIndex = script.length;
    }

    // Extract text for this segment
    let segmentText = script.slice(startIndex, endIndex).trim();

    // Store original for emphasis extraction
    const originalText = segmentText;

    // Clean text for display (strip other bracket tags)
    segmentText = segmentText.replace(PRONOUNCE_CUE, '$1').replace(MUSIC_CUE, '').replace(SFX_CUE, '').trim();

    segments.push({
      componentHint: cue.hint,
      text: segmentText,
      wordCount: countWords(originalText),
      keywords: extractKeywordsFromHint(cue.hint),
      emphasis: extractEmphasisFromText(originalText),
    });
  }

  return segments;
}

/**
 * Distribute timing across segments proportionally by word count
 */
function distributeTiming(
  segments: SegmentData[],
  totalDurationSec: number
): Array<{
  estimatedStartSec: number;
  estimatedEndSec: number;
  estimatedDurationSec: number;
}> {
  const totalWords = segments.reduce((sum, s) => sum + s.wordCount, 0);

  // Handle edge case: no words
  if (totalWords === 0) {
    const durationPerSegment = totalDurationSec / segments.length;
    return segments.map((_, i) => ({
      estimatedStartSec: i * durationPerSegment,
      estimatedEndSec: (i + 1) * durationPerSegment,
      estimatedDurationSec: durationPerSegment,
    }));
  }

  let currentTime = 0;

  return segments.map((segment) => {
    const proportion = segment.wordCount / totalWords;
    const duration = totalDurationSec * proportion;
    const timing = {
      estimatedStartSec: currentTime,
      estimatedEndSec: currentTime + duration,
      estimatedDurationSec: duration,
    };
    currentTime += duration;
    return timing;
  });
}

/**
 * Generate a URL-safe slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Convert V1 script with visual cues to a DirectionDocument
 *
 * @param script - V1 script string with [VISUAL:...] tags
 * @param audioDurationSec - Total audio duration in seconds (must be > 0)
 * @returns DirectionDocument - Complete video blueprint
 * @throws Error if audioDurationSec is not a positive number
 */
export function parseLegacyVisualCues(script: string, audioDurationSec: number): DirectionDocument {
  // Validate audioDurationSec
  if (typeof audioDurationSec !== 'number' || !Number.isFinite(audioDurationSec) || audioDurationSec <= 0) {
    throw new Error(`audioDurationSec must be a positive finite number, got: ${audioDurationSec}`);
  }

  // Parse script into segment data
  const segmentDataList = parseV1Script(script);

  // Handle empty script
  if (segmentDataList.length === 0) {
    segmentDataList.push({
      componentHint: 'text',
      text: '',
      wordCount: 0,
      keywords: [],
      emphasis: [],
    });
  }

  // Calculate timing distribution
  const timings = distributeTiming(segmentDataList, audioDurationSec);

  // Build segments
  const segments: DirectionSegment[] = segmentDataList.map((data, index) => {
    const timing = timings[index];

    return {
      id: crypto.randomUUID(),
      index,
      type: detectSegmentType(data.text, index, segmentDataList.length),
      content: {
        text: data.text,
        wordCount: data.wordCount,
        keywords: data.keywords,
        emphasis: data.emphasis,
      },
      timing: {
        estimatedStartSec: timing.estimatedStartSec,
        estimatedEndSec: timing.estimatedEndSec,
        estimatedDurationSec: timing.estimatedDurationSec,
        timingSource: 'estimated' as const,
      },
      visual: {
        template: mapV1ComponentToV2(data.componentHint),
        motion: { ...MOTION_PRESETS.standard },
      },
      audio: {
        mood: 'neutral',
      },
    };
  });

  // Build the complete DirectionDocument
  const document: DirectionDocument = {
    version: '2.0',
    metadata: {
      title: 'Converted from V1 Script',
      slug: generateSlug('converted-v1-script'),
      estimatedDurationSec: audioDurationSec,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      generatedAt: new Date().toISOString(),
    },
    segments,
    globalAudio: {
      defaultMood: 'neutral',
      musicTransitions: 'smooth',
    },
  };

  return document;
}

// =============================================================================
// getDirectionDocument - Universal accessor for DirectionDocument
// =============================================================================

/**
 * Get DirectionDocument from script output (V1 or V2)
 * For V2: Returns directionDocument after validation
 * For V1: Converts using parseLegacyVisualCues
 *
 * @param output - Script generation output (V1 or V2)
 * @param audioDurationSec - Total audio duration in seconds (must be > 0)
 * @returns DirectionDocument - Validated video blueprint
 * @throws Error if audioDurationSec is not a positive number
 */
export function getDirectionDocument(output: ScriptGenOutput, audioDurationSec: number): DirectionDocument {
  // Validate audioDurationSec
  if (typeof audioDurationSec !== 'number' || !Number.isFinite(audioDurationSec) || audioDurationSec <= 0) {
    throw new Error(`audioDurationSec must be a positive finite number, got: ${audioDurationSec}`);
  }

  // V2: Validate and return directionDocument
  if (isV2Output(output)) {
    validateDirectionDocument(output.directionDocument);
    return output.directionDocument;
  }

  // V1: Convert using parseLegacyVisualCues
  const document = parseLegacyVisualCues(output.script, audioDurationSec);

  // Validate the generated document
  validateDirectionDocument(document);

  return document;
}
