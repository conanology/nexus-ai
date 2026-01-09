/**
 * Quality metrics and gate types for NEXUS-AI
 * Stage-specific quality measurements and validation results
 */

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
 * Quality gate validation result
 */
export interface QualityGateResult {
  /** Gate outcome */
  status: 'PASS' | 'WARN' | 'FAIL';
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
    /** Terms not in dictionary */
    unknownTerms: number;
    /** Accuracy percentage (MUST exceed 98%) */
    accuracyPct: number;
    /** Whether flagged for review (>3 unknown terms) */
    flaggedForReview: boolean;
    /** New dictionary entries added */
    termsAdded: number;
  };
}

/**
 * Pre-publish quality gate decision
 * Determines whether video can auto-publish or needs human review
 */
export interface PrePublishQualityGate {
  /** Final decision */
  decision: 'AUTO_PUBLISH' | 'AUTO_PUBLISH_WITH_WARNING' | 'HUMAN_REVIEW';
  /** Quality issues detected */
  issues: Array<{
    /** Stage where issue occurred */
    stage: string;
    /** Issue severity */
    severity: 'warning' | 'error';
    /** Issue description */
    message: string;
  }>;
  /** Fallback providers used (format: "stage:provider") */
  fallbacksUsed: string[];
  /** Stages that experienced degradation */
  degradedStages: string[];
  /** Human review instructions */
  recommendedAction?: string;
}
