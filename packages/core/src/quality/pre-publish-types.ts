/**
 * Pre-publish quality gate types for NEXUS-AI
 *
 * Defines comprehensive types for the pre-publish quality gate that evaluates
 * pipeline output before YouTube upload. Implements the "never publish garbage"
 * principle (NFR1-5) by providing structured quality decisions.
 *
 * @module @nexus-ai/core/quality/pre-publish-types
 */

import type { QualityContext, StageOutput } from '../types/pipeline.js';

// =============================================================================
// Enums and Constants
// =============================================================================

/**
 * Quality decision for pre-publish gate
 * Re-exported from types.ts for convenience, but used specifically for pre-publish context
 */
export { PublishDecision as QualityDecision } from './types.js';

/**
 * Severity levels for quality issues
 */
export type QualityIssueSeverity = 'minor' | 'major';

/**
 * Issue codes for major issues (trigger HUMAN_REVIEW)
 */
export const MAJOR_ISSUE_CODES = {
  /** Non-primary TTS provider used */
  TTS_FALLBACK: 'tts-provider-fallback',
  /** >30% fallback visuals */
  HIGH_VISUAL_FALLBACK: 'visual-fallback-30',
  /** Word count <1200 or >1800 */
  WORD_COUNT_OOB: 'word-count-out-of-bounds',
  /** >3 pronunciation unknowns unresolved */
  PRONUNCIATION_UNRESOLVED: 'pronunciation-unknown-3+',
  /** Thumbnail fallback + visual fallback combined */
  COMBINED_FALLBACK: 'combined-fallback',
} as const;

/**
 * Issue codes for minor issues (trigger AUTO_PUBLISH_WITH_WARNING if <=2)
 */
export const MINOR_ISSUE_CODES = {
  /** 1-30% fallback visuals */
  LOW_VISUAL_FALLBACK: 'visual-fallback-low',
  /** Word count within 5% of boundaries */
  WORD_COUNT_EDGE: 'word-count-edge',
  /** 1-3 pronunciation unknowns (handled) */
  PRONUNCIATION_FEW: 'pronunciation-unknown-1-3',
  /** Thumbnail fallback alone (no visual fallback) */
  THUMBNAIL_FALLBACK_ONLY: 'thumbnail-fallback',
  /** TTS succeeded but >2 retries */
  TTS_RETRY_HIGH: 'tts-retry-high',
} as const;

export type MajorIssueCode = (typeof MAJOR_ISSUE_CODES)[keyof typeof MAJOR_ISSUE_CODES];
export type MinorIssueCode = (typeof MINOR_ISSUE_CODES)[keyof typeof MINOR_ISSUE_CODES];
export type QualityIssueCode = MajorIssueCode | MinorIssueCode;

// =============================================================================
// Core Types
// =============================================================================

/**
 * A quality issue detected during pre-publish evaluation
 */
export interface QualityIssue {
  /** Issue code identifier */
  code: QualityIssueCode | string;
  /** Issue severity: major triggers HUMAN_REVIEW, minor triggers warning */
  severity: QualityIssueSeverity;
  /** Stage where the issue was detected */
  stage: string;
  /** Human-readable description of the issue */
  message: string;
}

/**
 * Aggregate quality metrics from all pipeline stages
 */
export interface QualityMetricsSummary {
  /** Total number of stages executed */
  totalStages: number;
  /** Number of stages that experienced degradation */
  degradedStages: number;
  /** Number of fallback providers used */
  fallbacksUsed: number;
  /** Total warnings across all stages */
  totalWarnings: number;
  /** Script word count from script-gen stage */
  scriptWordCount: number;
  /** Percentage of visual scenes using fallback (0-100) */
  visualFallbackPercent: number;
  /** Number of unresolved pronunciation unknowns */
  pronunciationUnknowns: number;
  /** TTS provider used (e.g., 'gemini-2.5-pro-tts', 'chirp3-hd') */
  ttsProvider: string;
  /** Whether thumbnail used fallback template */
  thumbnailFallback: boolean;
}

/**
 * Result of the pre-publish quality gate check
 * Stored at pipelines/{date}/quality-decision in Firestore
 */
export interface QualityDecisionResult {
  /** Final quality decision */
  decision: 'AUTO_PUBLISH' | 'AUTO_PUBLISH_WITH_WARNING' | 'HUMAN_REVIEW';
  /** Human-readable reasons explaining the decision */
  reasons: string[];
  /** All detected quality issues */
  issues: QualityIssue[];
  /** Aggregate metrics summary */
  metrics: QualityMetricsSummary;
  /** ISO 8601 UTC timestamp of the decision */
  timestamp: string;
  /** Summary of each stage's quality status */
  stageQualitySummary?: Record<string, {
    status: 'pass' | 'warn' | 'fail';
    provider: string;
    tier: 'primary' | 'fallback';
  }>;
  /** Review item ID if HUMAN_REVIEW decision was made */
  reviewItemId?: string;
}

// =============================================================================
// Pipeline Context Types
// =============================================================================

/**
 * Extended pipeline run context for quality gate evaluation
 * Contains all stage outputs and accumulated quality context
 */
export interface PipelineQualityContext {
  /** Pipeline ID in YYYY-MM-DD format */
  pipelineId: string;
  /** All stage outputs keyed by stage name */
  stages: Record<string, StageOutput<unknown>>;
  /** Accumulated quality context from pipeline execution */
  qualityContext: QualityContext;
}

/**
 * Preview URLs for human review
 */
export interface PreviewUrls {
  /** URL to the rendered video */
  video?: string;
  /** URL to the selected thumbnail */
  thumbnail?: string;
  /** URL to the generated script */
  script?: string;
}

/**
 * Content structure for pre-publish quality review items
 */
export interface PrePublishReviewItemContent {
  /** The quality decision that triggered review */
  decision: 'HUMAN_REVIEW';
  /** Major issues that triggered human review */
  issues: QualityIssue[];
  /** Preview URLs for operator review */
  previewUrls: PreviewUrls;
}

/**
 * Context structure for pre-publish quality review items
 */
export interface PrePublishReviewItemContext {
  /** Full quality decision result */
  qualityDecision: QualityDecisionResult;
  /** Stage quality summaries */
  stageQuality: Record<string, {
    status: 'pass' | 'warn' | 'fail';
    metrics: Record<string, unknown>;
  }>;
}

// =============================================================================
// Firestore Document Types
// =============================================================================

/**
 * Quality decision document stored in Firestore
 * Path: pipelines/{date}/quality-decision
 */
export interface QualityDecisionDocument extends QualityDecisionResult {
  /** Document version for future migrations */
  version: 1;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an issue code is a major issue
 */
export function isMajorIssueCode(code: string): code is MajorIssueCode {
  return Object.values(MAJOR_ISSUE_CODES).includes(code as MajorIssueCode);
}

/**
 * Check if an issue code is a minor issue
 */
export function isMinorIssueCode(code: string): code is MinorIssueCode {
  return Object.values(MINOR_ISSUE_CODES).includes(code as MinorIssueCode);
}

/**
 * Check if a quality decision requires human review
 */
export function requiresHumanReview(decision: QualityDecisionResult): boolean {
  return decision.decision === 'HUMAN_REVIEW';
}

/**
 * Check if a quality decision has warnings
 */
export function hasWarnings(decision: QualityDecisionResult): boolean {
  return decision.decision === 'AUTO_PUBLISH_WITH_WARNING';
}
