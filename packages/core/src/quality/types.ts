/**
 * Quality gate interfaces and types
 */

/**
 * Status of a quality gate check
 */
export enum QualityStatus {
  PASS = 'PASS',
  WARN = 'WARN',
  FAIL = 'FAIL',
}

/**
 * Result of a quality gate execution
 */
export interface QualityGateResult {
  /** Gate outcome */
  status: QualityStatus;
  /** Stage measurements */
  metrics: Record<string, unknown>;
  /** Warning messages */
  warnings: string[];
  /** Failure reason if FAIL */
  reason?: string;
  /** Stage that was checked */
  stage: string;
}

/**
 * Interface for a quality gate
 */
export type QualityGateName = 'script-gen' | 'tts' | 'render' | 'thumbnail' | string;

/**
 * Context for quality gate check
 */
export interface QualityGateContext {
  /** Pipeline ID for review queue integration */
  pipelineId?: string;
  /** Script content for excerpt generation */
  scriptContent?: string;
  /** Optimizer attempts count */
  optimizerAttempts?: number;
}

export interface QualityGate {
  /**
   * Check quality for a specific stage
   * @param stageName Name of the stage
   * @param output Output data from the stage
   * @param context Optional context with pipelineId for review queue integration
   */
  check(stageName: string, output: any, context?: QualityGateContext): Promise<QualityGateResult>;
}

/**
 * Decision on whether to publish content
 */
export enum PublishDecision {
  /** No issues, publish immediately */
  AUTO_PUBLISH = 'AUTO_PUBLISH',
  /** Minor issues, publish but log warning */
  AUTO_PUBLISH_WITH_WARNING = 'AUTO_PUBLISH_WITH_WARNING',
  /** Major issues, require human review */
  HUMAN_REVIEW = 'HUMAN_REVIEW',
}

/**
 * Result of the pre-publish quality check
 */
export interface PrePublishResult {
  /** Final decision */
  decision: PublishDecision;
  /** Quality issues detected */
  issues: Array<{
    stage: string;
    severity: 'warning' | 'error';
    message: string;
  }>;
  /** Fallback providers used (format: "stage:provider") */
  fallbacksUsed: string[];
  /** Stages that experienced degradation */
  degradedStages: string[];
  /** Human review instructions */
  recommendedAction?: string;
}

/**
 * Base quality metrics interface
 */
export interface QualityMetrics {
  /** Stage name */
  stage: string;
  /** ISO 8601 UTC timestamp */
  timestamp: string;
  /** Stage-specific measurements */
  measurements: Record<string, unknown>;
}

/**
 * Script generation quality metrics
 * NFR21: Word count must be 1200-1800
 */
export interface ScriptQualityMetrics extends QualityMetrics {
  measurements: {
    /** Word count (MUST be 1200-1800) */
    wordCount: number;
    /** Estimated reading time in seconds */
    readingTimeSeconds: number;
    /** Number of sentences (pacing analysis) */
    sentenceCount: number;
    /** Count of technical terms (for pronunciation check) */
    technicalTermCount: number;
    /** Count of [VISUAL: ...] tags */
    visualCueCount: number;
  };
}

/**
 * TTS quality metrics
 */
export interface TTSQualityMetrics extends QualityMetrics {
  measurements: {
    /** Percentage of silence (MUST be <5%) */
    silencePct: number;
    /** Audio distortion detected (MUST be false) */
    clippingDetected: boolean;
    /** Average loudness in LUFS */
    averageLoudnessDb: number;
    /** Total audio duration in seconds */
    durationSec: number;
    /** Audio codec */
    codec: string;
    /** Sample rate in Hz */
    sampleRate: number;
    /** Number of segments if chunked */
    segmentCount?: number;
  };
}

/**
 * Render quality metrics
 * NFR7: Zero frame drops, audio sync <100ms
 */
export interface RenderQualityMetrics extends QualityMetrics {
  measurements: {
    /** Frame drops (MUST be 0) */
    frameDrops: number;
    /** Audio/video sync offset in milliseconds (<100ms) */
    audioSyncMs: number;
    /** Video duration in seconds (target: 5-8 min) */
    durationSec: number;
    /** Video resolution */
    resolution: string;
    /** Frame rate (fps) */
    frameRate: number;
    /** Bitrate in Mbps */
    bitrate: number;
    /** File size in bytes */
    fileSize: number;
  };
}

/**
 * Thumbnail quality metrics
 * NFR22: Must generate exactly 3 variants
 */
export interface ThumbnailQualityMetrics extends QualityMetrics {
  measurements: {
    /** Number of variants generated (MUST be exactly 3) */
    variantsGenerated: number;
    /** Text readability score (0-100) */
    textLegibility: number;
    /** Color contrast ratio (WCAG AA: >4.5:1) */
    colorContrast: number;
    /** Whether using template fallback */
    usingTemplates: boolean;
  };
}

/**
 * Pronunciation quality metrics
 * NFR18: >98% accuracy required
 */
export interface PronunciationQualityMetrics extends QualityMetrics {
  measurements: {
    /** Total terms found in script */
    totalTerms: number;
    /** Terms in dictionary */
    knownTerms: number;
    /** Terms in dictionary */
    unknownTerms: number;
    /** Accuracy percentage (MUST exceed 98%) */
    accuracyPct: number;
    /** Whether flagged for review (>3 unknown terms) */
    flaggedForReview: boolean;
    /** New dictionary entries added */
    termsAdded: number;
  };
}
