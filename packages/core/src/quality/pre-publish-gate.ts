/**
 * Pre-publish quality gate for NEXUS-AI
 *
 * Evaluates pipeline output quality before YouTube upload to ensure
 * the "never publish garbage" principle (NFR1-5). Makes one of three decisions:
 * - AUTO_PUBLISH: No issues, proceed to publish
 * - AUTO_PUBLISH_WITH_WARNING: Minor issues (<=2), log warnings and publish
 * - HUMAN_REVIEW: Major issues, pause for operator review
 *
 * @module @nexus-ai/core/quality/pre-publish-gate
 */

import { createLogger } from '../observability/logger.js';
import { getSharedFirestoreClient } from '../buffer/client.js';
import { addToReviewQueue, resolveReviewItem, getReviewItem } from '../review/manager.js';
import { deployBuffer, listAvailableBuffers } from '../buffer/manager.js';
import type {
  QualityDecisionDocument,
  PrePublishReviewItemContent,
  PreviewUrls,
} from './pre-publish-types.js';
import {
  type QualityIssue,
  type QualityDecisionResult,
  type QualityMetricsSummary,
  type PipelineQualityContext,
  MAJOR_ISSUE_CODES,
  MINOR_ISSUE_CODES,
} from './pre-publish-types.js';
import type { StageOutput } from '../types/pipeline.js';

const logger = createLogger('nexus.core.quality.pre-publish');

// =============================================================================
// Issue Detection Functions
// =============================================================================

/**
 * Detect if TTS fallback provider was used
 * Major issue: Using non-primary TTS affects audio quality
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns QualityIssue if TTS fallback was used, null otherwise
 */
export function detectTTSFallback(pipelineRun: PipelineQualityContext): QualityIssue | null {
  const ttsStage = pipelineRun.stages['tts'] as StageOutput<unknown> | undefined;

  if (!ttsStage) {
    logger.debug({ pipelineId: pipelineRun.pipelineId }, 'No TTS stage output found');
    return null;
  }

  // Check provider tier
  if (ttsStage.provider?.tier === 'fallback') {
    const providerName = ttsStage.provider?.name || 'unknown';
    return {
      code: MAJOR_ISSUE_CODES.TTS_FALLBACK,
      severity: 'major',
      stage: 'tts',
      message: `TTS fallback provider used: ${providerName} (primary TTS unavailable)`,
    };
  }

  // Also check if fallback is indicated in qualityContext
  const fallbacksUsed = pipelineRun.qualityContext?.fallbacksUsed || [];
  const ttsFallback = fallbacksUsed.find((f) => f.startsWith('tts:'));
  if (ttsFallback) {
    const provider = ttsFallback.split(':')[1] || 'unknown';
    // Only flag as major if it's not the primary provider
    // Primary is gemini-2.5-pro-tts per project-context
    if (!provider.includes('gemini-2.5-pro-tts')) {
      return {
        code: MAJOR_ISSUE_CODES.TTS_FALLBACK,
        severity: 'major',
        stage: 'tts',
        message: `TTS fallback provider used: ${provider} (primary TTS unavailable)`,
      };
    }
  }

  return null;
}

/**
 * Detect TTS retry issues (minor if >2 retries but succeeded)
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns QualityIssue if high retry count, null otherwise
 */
export function detectTTSRetryIssues(pipelineRun: PipelineQualityContext): QualityIssue | null {
  const ttsStage = pipelineRun.stages['tts'] as StageOutput<unknown> | undefined;

  if (!ttsStage) {
    return null;
  }

  const attempts = ttsStage.provider?.attempts || 1;

  // Only flag if tier is primary (succeeded) but took multiple retries
  if (ttsStage.provider?.tier === 'primary' && attempts > 2) {
    return {
      code: MINOR_ISSUE_CODES.TTS_RETRY_HIGH,
      severity: 'minor',
      stage: 'tts',
      message: `TTS required ${attempts} attempts before succeeding`,
    };
  }

  return null;
}

/**
 * Detect visual fallback ratio issues
 * Major: >30% fallback visuals
 * Minor: 1-30% fallback visuals
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns QualityIssue if visual fallback threshold exceeded, null otherwise
 */
export function detectVisualFallbackRatio(pipelineRun: PipelineQualityContext): QualityIssue | null {
  const visualStage = pipelineRun.stages['visual-gen'] as StageOutput<unknown> | undefined;

  if (!visualStage) {
    logger.debug({ pipelineId: pipelineRun.pipelineId }, 'No visual-gen stage output found');
    return null;
  }

  // Extract quality metrics from visual stage
  const quality = visualStage.quality as { measurements?: { fallbackCount?: number; totalScenes?: number } } | undefined;
  const fallbackCount = quality?.measurements?.fallbackCount || 0;
  const totalScenes = quality?.measurements?.totalScenes || 1; // Avoid division by zero

  const fallbackPercent = (fallbackCount / totalScenes) * 100;

  if (fallbackPercent > 30) {
    return {
      code: MAJOR_ISSUE_CODES.HIGH_VISUAL_FALLBACK,
      severity: 'major',
      stage: 'visual-gen',
      message: `Visual fallback rate ${fallbackPercent.toFixed(1)}% exceeds 30% threshold (${fallbackCount}/${totalScenes} scenes)`,
    };
  }

  if (fallbackPercent > 0) {
    return {
      code: MINOR_ISSUE_CODES.LOW_VISUAL_FALLBACK,
      severity: 'minor',
      stage: 'visual-gen',
      message: `Visual fallback rate ${fallbackPercent.toFixed(1)}% (${fallbackCount}/${totalScenes} scenes)`,
    };
  }

  return null;
}

/**
 * Detect word count issues in script generation
 * Major: <1200 or >1800 words
 * Minor: Within 5% of boundaries (1140-1260 or 1710-1890)
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns QualityIssue if word count issues detected, null otherwise
 */
export function detectWordCountIssues(pipelineRun: PipelineQualityContext): QualityIssue | null {
  const scriptStage = pipelineRun.stages['script-gen'] as StageOutput<unknown> | undefined;

  if (!scriptStage) {
    logger.debug({ pipelineId: pipelineRun.pipelineId }, 'No script-gen stage output found');
    return null;
  }

  // Extract word count from quality metrics
  const quality = scriptStage.quality as { measurements?: { wordCount?: number } } | undefined;
  const wordCount = quality?.measurements?.wordCount;

  // Also check data object for wordCount
  const data = scriptStage.data as { wordCount?: number } | undefined;
  const finalWordCount = wordCount || data?.wordCount || 0;

  if (finalWordCount === 0) {
    logger.debug({ pipelineId: pipelineRun.pipelineId }, 'No word count data available');
    return null;
  }

  const MIN_WORDS = 1200;
  const MAX_WORDS = 1800;
  const EDGE_PERCENT = 0.05; // 5%

  // Major issue: out of bounds
  if (finalWordCount < MIN_WORDS || finalWordCount > MAX_WORDS) {
    return {
      code: MAJOR_ISSUE_CODES.WORD_COUNT_OOB,
      severity: 'major',
      stage: 'script-gen',
      message: `Word count ${finalWordCount} is outside acceptable range [${MIN_WORDS}, ${MAX_WORDS}]`,
    };
  }

  // Minor issue: within 5% of boundaries
  const lowerEdge = MIN_WORDS * (1 + EDGE_PERCENT); // 1260
  const upperEdge = MAX_WORDS * (1 - EDGE_PERCENT); // 1710

  if (finalWordCount < lowerEdge || finalWordCount > upperEdge) {
    const boundary = finalWordCount < lowerEdge ? 'minimum' : 'maximum';
    return {
      code: MINOR_ISSUE_CODES.WORD_COUNT_EDGE,
      severity: 'minor',
      stage: 'script-gen',
      message: `Word count ${finalWordCount} is near the ${boundary} boundary`,
    };
  }

  return null;
}

/**
 * Detect pronunciation issues
 * Major: >3 unresolved unknown terms
 * Minor: 1-3 unknown terms (flagged for review but handled)
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns QualityIssue if pronunciation issues detected, null otherwise
 */
export function detectPronunciationIssues(pipelineRun: PipelineQualityContext): QualityIssue | null {
  const pronunciationStage = pipelineRun.stages['pronunciation'] as StageOutput<unknown> | undefined;

  if (!pronunciationStage) {
    logger.debug({ pipelineId: pipelineRun.pipelineId }, 'No pronunciation stage output found');
    return null;
  }

  // Extract pronunciation metrics
  const quality = pronunciationStage.quality as {
    measurements?: { unknownCount?: number; unresolvedCount?: number };
  } | undefined;

  const unknownCount = quality?.measurements?.unknownCount || 0;
  const unresolvedCount = quality?.measurements?.unresolvedCount || unknownCount;

  // Major issue: >3 unresolved unknowns
  if (unresolvedCount > 3) {
    return {
      code: MAJOR_ISSUE_CODES.PRONUNCIATION_UNRESOLVED,
      severity: 'major',
      stage: 'pronunciation',
      message: `${unresolvedCount} pronunciation unknowns remain unresolved (threshold: 3)`,
    };
  }

  // Minor issue: 1-3 unknowns (but handled/flagged)
  if (unknownCount > 0 && unknownCount <= 3) {
    return {
      code: MINOR_ISSUE_CODES.PRONUNCIATION_FEW,
      severity: 'minor',
      stage: 'pronunciation',
      message: `${unknownCount} unknown term(s) flagged for pronunciation review`,
    };
  }

  return null;
}

/**
 * Detect thumbnail fallback issues
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns QualityIssue if thumbnail fallback used, null otherwise
 */
export function detectThumbnailIssues(pipelineRun: PipelineQualityContext): QualityIssue | null {
  const thumbnailStage = pipelineRun.stages['thumbnail'] as StageOutput<unknown> | undefined;

  if (!thumbnailStage) {
    logger.debug({ pipelineId: pipelineRun.pipelineId }, 'No thumbnail stage output found');
    return null;
  }

  // Check provider tier
  if (thumbnailStage.provider?.tier === 'fallback') {
    return {
      code: MINOR_ISSUE_CODES.THUMBNAIL_FALLBACK_ONLY,
      severity: 'minor',
      stage: 'thumbnail',
      message: `Thumbnail using fallback template (${thumbnailStage.provider.name})`,
    };
  }

  // Also check qualityContext for fallback indicators
  const fallbacksUsed = pipelineRun.qualityContext?.fallbacksUsed || [];
  const thumbnailFallback = fallbacksUsed.find((f) => f.startsWith('thumbnail:'));
  if (thumbnailFallback) {
    const provider = thumbnailFallback.split(':')[1] || 'template';
    return {
      code: MINOR_ISSUE_CODES.THUMBNAIL_FALLBACK_ONLY,
      severity: 'minor',
      stage: 'thumbnail',
      message: `Thumbnail using fallback: ${provider}`,
    };
  }

  return null;
}

/**
 * Detect combined fallback issues (thumbnail + visual fallback together)
 * Major issue: Using both fallbacks indicates significant quality degradation
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns QualityIssue if combined fallbacks detected, null otherwise
 */
export function detectCombinedIssues(pipelineRun: PipelineQualityContext): QualityIssue | null {
  const thumbnailIssue = detectThumbnailIssues(pipelineRun);

  // Only flag as major if BOTH have fallback issues
  const hasThumbnailFallback = thumbnailIssue !== null;

  // Check for any visual fallback (not just high percentage)
  const visualStage = pipelineRun.stages['visual-gen'] as StageOutput<unknown> | undefined;
  const quality = visualStage?.quality as { measurements?: { fallbackCount?: number } } | undefined;
  const hasAnyVisualFallback = (quality?.measurements?.fallbackCount || 0) > 0;

  if (hasThumbnailFallback && hasAnyVisualFallback) {
    return {
      code: MAJOR_ISSUE_CODES.COMBINED_FALLBACK,
      severity: 'major',
      stage: 'combined',
      message: 'Both thumbnail and visual generation used fallbacks - significant quality degradation',
    };
  }

  return null;
}

/**
 * Run all issue detectors and collect results
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns Array of all detected quality issues
 */
export function detectAllIssues(pipelineRun: PipelineQualityContext): QualityIssue[] {
  const issues: QualityIssue[] = [];

  logger.debug(
    { pipelineId: pipelineRun.pipelineId },
    'Starting quality issue detection'
  );

  // Run each detector and collect non-null results
  const detectors = [
    detectTTSFallback,
    detectTTSRetryIssues,
    detectVisualFallbackRatio,
    detectWordCountIssues,
    detectPronunciationIssues,
    detectThumbnailIssues,
    detectCombinedIssues,
  ];

  for (const detector of detectors) {
    try {
      const issue = detector(pipelineRun);
      if (issue) {
        // Avoid duplicate issues (e.g., combined already includes thumbnail)
        if (!issues.some((i) => i.code === issue.code)) {
          issues.push(issue);
        }
      }
    } catch (error) {
      logger.warn(
        { error, detector: detector.name, pipelineId: pipelineRun.pipelineId },
        'Issue detector failed'
      );
    }
  }

  logger.info(
    {
      pipelineId: pipelineRun.pipelineId,
      issueCount: issues.length,
      majorCount: issues.filter((i) => i.severity === 'major').length,
      minorCount: issues.filter((i) => i.severity === 'minor').length,
    },
    'Quality issue detection complete'
  );

  return issues;
}

// =============================================================================
// Metrics Calculation
// =============================================================================

/**
 * Calculate aggregate quality metrics from pipeline run
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns Aggregated quality metrics summary
 */
export function calculateMetrics(pipelineRun: PipelineQualityContext): QualityMetricsSummary {
  const stages = pipelineRun.stages || {};
  const qualityContext = pipelineRun.qualityContext || { degradedStages: [], fallbacksUsed: [], flags: [] };

  // Extract word count from script-gen
  const scriptStage = stages['script-gen'] as StageOutput<unknown> | undefined;
  const scriptQuality = scriptStage?.quality as { measurements?: { wordCount?: number } } | undefined;
  const scriptData = scriptStage?.data as { wordCount?: number } | undefined;
  const scriptWordCount = scriptQuality?.measurements?.wordCount || scriptData?.wordCount || 0;

  // Extract visual fallback info
  const visualStage = stages['visual-gen'] as StageOutput<unknown> | undefined;
  const visualQuality = visualStage?.quality as { measurements?: { fallbackCount?: number; totalScenes?: number } } | undefined;
  const fallbackCount = visualQuality?.measurements?.fallbackCount || 0;
  const totalScenes = visualQuality?.measurements?.totalScenes || 1;
  const visualFallbackPercent = (fallbackCount / totalScenes) * 100;

  // Extract pronunciation unknowns
  const pronunciationStage = stages['pronunciation'] as StageOutput<unknown> | undefined;
  const pronunciationQuality = pronunciationStage?.quality as { measurements?: { unresolvedCount?: number; unknownCount?: number } } | undefined;
  const pronunciationUnknowns = pronunciationQuality?.measurements?.unresolvedCount ||
    pronunciationQuality?.measurements?.unknownCount || 0;

  // Extract TTS provider info
  const ttsStage = stages['tts'] as StageOutput<unknown> | undefined;
  const ttsProvider = ttsStage?.provider?.name || 'unknown';

  // Check thumbnail fallback
  const thumbnailStage = stages['thumbnail'] as StageOutput<unknown> | undefined;
  const thumbnailFallback = thumbnailStage?.provider?.tier === 'fallback' ||
    qualityContext.fallbacksUsed.some((f) => f.startsWith('thumbnail:'));

  // Count total warnings across stages
  let totalWarnings = 0;
  for (const stage of Object.values(stages)) {
    const stageOutput = stage as StageOutput<unknown>;
    totalWarnings += stageOutput?.warnings?.length || 0;
  }

  return {
    totalStages: Object.keys(stages).length,
    degradedStages: qualityContext.degradedStages.length,
    fallbacksUsed: qualityContext.fallbacksUsed.length,
    totalWarnings,
    scriptWordCount,
    visualFallbackPercent: Math.round(visualFallbackPercent * 10) / 10,
    pronunciationUnknowns,
    ttsProvider,
    thumbnailFallback,
  };
}

// =============================================================================
// Decision Logic
// =============================================================================

/**
 * Main quality gate check function
 *
 * Evaluates all quality issues and makes a publishing decision:
 * - AUTO_PUBLISH: No issues detected
 * - AUTO_PUBLISH_WITH_WARNING: 1-2 minor issues, no major issues
 * - HUMAN_REVIEW: Any major issue OR >2 minor issues
 *
 * @param pipelineRun - Pipeline context with all stage outputs
 * @returns Quality decision result with decision, reasons, issues, and metrics
 */
export async function qualityGateCheck(
  pipelineRun: PipelineQualityContext
): Promise<QualityDecisionResult> {
  const startTime = Date.now();

  logger.info(
    { pipelineId: pipelineRun.pipelineId },
    'Starting pre-publish quality gate check'
  );

  // Detect all issues
  const issues = detectAllIssues(pipelineRun);

  // Separate major and minor issues
  const majorIssues = issues.filter((i) => i.severity === 'major');
  const minorIssues = issues.filter((i) => i.severity === 'minor');

  // Calculate metrics
  const metrics = calculateMetrics(pipelineRun);

  // Build reasons array
  const reasons: string[] = [];

  // Decision logic
  let decision: 'AUTO_PUBLISH' | 'AUTO_PUBLISH_WITH_WARNING' | 'HUMAN_REVIEW';

  if (majorIssues.length > 0) {
    // Any major issue triggers HUMAN_REVIEW
    decision = 'HUMAN_REVIEW';
    reasons.push(`${majorIssues.length} major issue(s) detected requiring human review`);
    for (const issue of majorIssues) {
      reasons.push(`[MAJOR] ${issue.stage}: ${issue.message}`);
    }
  } else if (minorIssues.length > 2) {
    // >2 minor issues also triggers HUMAN_REVIEW
    decision = 'HUMAN_REVIEW';
    reasons.push(`${minorIssues.length} minor issues exceed threshold (max: 2)`);
    for (const issue of minorIssues) {
      reasons.push(`[MINOR] ${issue.stage}: ${issue.message}`);
    }
  } else if (minorIssues.length > 0) {
    // 1-2 minor issues triggers AUTO_PUBLISH_WITH_WARNING
    decision = 'AUTO_PUBLISH_WITH_WARNING';
    reasons.push(`${minorIssues.length} minor issue(s) detected - publishing with warnings`);
    for (const issue of minorIssues) {
      reasons.push(`[WARNING] ${issue.stage}: ${issue.message}`);
    }
  } else {
    // No issues - AUTO_PUBLISH
    decision = 'AUTO_PUBLISH';
    reasons.push('All quality checks passed - no issues detected');
  }

  // Build stage quality summary
  const stageQualitySummary: Record<string, { status: 'pass' | 'warn' | 'fail'; provider: string; tier: 'primary' | 'fallback' }> = {};

  for (const [stageName, stageOutput] of Object.entries(pipelineRun.stages)) {
    const stage = stageOutput as StageOutput<unknown>;
    const stageIssues = issues.filter((i) => i.stage === stageName);
    const hasMajor = stageIssues.some((i) => i.severity === 'major');
    const hasMinor = stageIssues.some((i) => i.severity === 'minor');

    stageQualitySummary[stageName] = {
      status: hasMajor ? 'fail' : hasMinor ? 'warn' : 'pass',
      provider: stage.provider?.name || 'unknown',
      tier: stage.provider?.tier || 'primary',
    };
  }

  const result: QualityDecisionResult = {
    decision,
    reasons,
    issues,
    metrics,
    timestamp: new Date().toISOString(),
    stageQualitySummary,
  };

  const durationMs = Date.now() - startTime;

  logger.info(
    {
      pipelineId: pipelineRun.pipelineId,
      decision,
      majorIssues: majorIssues.length,
      minorIssues: minorIssues.length,
      durationMs,
    },
    'Pre-publish quality gate check complete'
  );

  return result;
}

// =============================================================================
// Decision Persistence
// =============================================================================

/**
 * Firestore collection path for quality decisions
 * Stored as sub-document under pipeline: pipelines/{date}/quality-decision
 */
const QUALITY_DECISION_DOC = 'quality-decision';

/**
 * Persist a quality decision to Firestore
 *
 * Stores the decision at pipelines/{pipelineId}/quality-decision
 * Uses structured logging and handles errors gracefully.
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD format)
 * @param decision - Quality decision result to persist
 */
export async function persistQualityDecision(
  pipelineId: string,
  decision: QualityDecisionResult
): Promise<void> {
  const client = getSharedFirestoreClient();

  const document: QualityDecisionDocument = {
    ...decision,
    version: 1,
  };

  try {
    // Store as sub-document under the pipeline document
    // Path: pipelines/{pipelineId}/quality-decision
    const parentPath = `pipelines/${pipelineId}`;

    await client.setDocument(parentPath, QUALITY_DECISION_DOC, document);

    logger.info(
      {
        pipelineId,
        decision: decision.decision,
        issueCount: decision.issues.length,
        path: `${parentPath}/${QUALITY_DECISION_DOC}`,
      },
      'Quality decision persisted to Firestore'
    );
  } catch (error) {
    logger.error(
      {
        error,
        pipelineId,
        decision: decision.decision,
      },
      'Failed to persist quality decision'
    );
    // Don't throw - persistence failure shouldn't block pipeline
    // The decision is still valid and returned to the caller
  }
}

/**
 * Retrieve a quality decision from Firestore
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD format)
 * @returns Quality decision document or null if not found
 */
export async function getQualityDecision(
  pipelineId: string
): Promise<QualityDecisionDocument | null> {
  const client = getSharedFirestoreClient();

  try {
    const parentPath = `pipelines/${pipelineId}`;
    const document = await client.getDocument<QualityDecisionDocument>(
      parentPath,
      QUALITY_DECISION_DOC
    );

    if (document) {
      logger.debug(
        { pipelineId, decision: document.decision },
        'Quality decision retrieved from Firestore'
      );
    }

    return document;
  } catch (error) {
    logger.error(
      { error, pipelineId },
      'Failed to retrieve quality decision'
    );
    return null;
  }
}

// =============================================================================
// Human Review Integration
// =============================================================================

/**
 * Extract preview URLs from pipeline stages
 *
 * @param pipelineRun - Pipeline context with stage outputs
 * @returns Preview URLs for video, thumbnail, and script
 */
function extractPreviewUrls(pipelineRun: PipelineQualityContext): PreviewUrls {
  const renderStage = pipelineRun.stages['render'] as StageOutput<unknown> | undefined;
  const thumbnailStage = pipelineRun.stages['thumbnail'] as StageOutput<unknown> | undefined;
  const scriptStage = pipelineRun.stages['script-gen'] as StageOutput<unknown> | undefined;

  return {
    video: renderStage?.artifacts?.find((a) => a.type === 'video')?.url,
    thumbnail: thumbnailStage?.artifacts?.[0]?.url,
    script: scriptStage?.artifacts?.find((a) => a.type === 'text')?.url,
  };
}

/**
 * Create a human review item for a HUMAN_REVIEW quality decision
 *
 * Creates a review item in the queue with:
 * - type: 'quality'
 * - stage: 'pre-publish'
 * - Full quality decision context
 * - Preview URLs for video, thumbnail, script
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD format)
 * @param decision - Quality decision result
 * @param pipelineRun - Pipeline context for extracting preview URLs
 * @returns Review item ID
 */
export async function createQualityReviewItem(
  pipelineId: string,
  decision: QualityDecisionResult,
  pipelineRun: PipelineQualityContext
): Promise<string> {
  const majorIssues = decision.issues.filter((i) => i.severity === 'major');
  const previewUrls = extractPreviewUrls(pipelineRun);

  const itemContent: PrePublishReviewItemContent = {
    decision: 'HUMAN_REVIEW',
    issues: majorIssues,
    previewUrls,
  };

  // Build stage quality map for context
  const stageQuality: Record<string, { status: 'pass' | 'warn' | 'fail'; metrics: Record<string, unknown> }> = {};

  for (const [stageName, stageOutput] of Object.entries(pipelineRun.stages)) {
    const stage = stageOutput as StageOutput<unknown>;
    const stageIssues = decision.issues.filter((i) => i.stage === stageName);
    const hasMajor = stageIssues.some((i) => i.severity === 'major');
    const hasMinor = stageIssues.some((i) => i.severity === 'minor');

    stageQuality[stageName] = {
      status: hasMajor ? 'fail' : hasMinor ? 'warn' : 'pass',
      metrics: (stage.quality as { measurements?: Record<string, unknown> })?.measurements || {},
    };
  }

  const reviewId = await addToReviewQueue({
    type: 'quality',
    pipelineId,
    stage: 'pre-publish',
    item: itemContent,
    context: {
      qualityDecision: decision,
      stageQuality,
    },
  });

  logger.info(
    {
      pipelineId,
      reviewId,
      issueCount: majorIssues.length,
    },
    'Quality review item created'
  );

  return reviewId;
}

/**
 * Handle approval of a quality review item
 *
 * When an operator approves the review:
 * 1. Mark the review item as resolved
 * 2. Return approval status so orchestrator can proceed to YouTube
 *
 * @param reviewId - Review item ID
 * @param resolvedBy - Operator identifier
 * @returns True if approval was successful
 */
export async function handleReviewApproval(
  reviewId: string,
  resolvedBy: string
): Promise<boolean> {
  try {
    const item = await getReviewItem(reviewId);

    if (!item) {
      logger.warn({ reviewId }, 'Review item not found for approval');
      return false;
    }

    if (item.status !== 'pending') {
      logger.warn(
        { reviewId, status: item.status },
        'Review item already resolved'
      );
      return false;
    }

    await resolveReviewItem(
      reviewId,
      'Quality review approved - proceeding to publish',
      resolvedBy
    );

    logger.info(
      {
        reviewId,
        pipelineId: item.pipelineId,
        resolvedBy,
      },
      'Quality review approved'
    );

    return true;
  } catch (error) {
    logger.error(
      { error, reviewId },
      'Failed to approve quality review'
    );
    return false;
  }
}

/**
 * Handle rejection of a quality review item
 *
 * When an operator rejects the review:
 * 1. Mark the review item as resolved with rejection
 * 2. Deploy a buffer video instead
 * 3. Return deployment result
 *
 * @param reviewId - Review item ID
 * @param resolvedBy - Operator identifier
 * @returns Buffer deployment result or null if no buffer available
 */
export async function handleReviewRejection(
  reviewId: string,
  resolvedBy: string
): Promise<{ success: boolean; bufferId?: string; videoId?: string; error?: string }> {
  try {
    const item = await getReviewItem(reviewId);

    if (!item) {
      logger.warn({ reviewId }, 'Review item not found for rejection');
      return { success: false, error: 'Review item not found' };
    }

    if (item.status !== 'pending') {
      logger.warn(
        { reviewId, status: item.status },
        'Review item already resolved'
      );
      return { success: false, error: 'Review item already resolved' };
    }

    // Get available buffers
    const availableBuffers = await listAvailableBuffers();

    if (availableBuffers.length === 0) {
      logger.error(
        { reviewId, pipelineId: item.pipelineId },
        'No buffer videos available for rejection fallback'
      );

      // Still mark as resolved but note the failure
      await resolveReviewItem(
        reviewId,
        'Quality review rejected - NO BUFFER AVAILABLE (CRITICAL)',
        resolvedBy
      );

      return {
        success: false,
        error: 'No buffer videos available',
      };
    }

    // Deploy the first available buffer
    const buffer = availableBuffers[0];
    const deployResult = await deployBuffer(buffer.id, item.pipelineId);

    if (!deployResult.success) {
      logger.error(
        { reviewId, bufferId: buffer.id, error: deployResult.error },
        'Failed to deploy buffer on rejection'
      );

      await resolveReviewItem(
        reviewId,
        `Quality review rejected - buffer deployment failed: ${deployResult.error}`,
        resolvedBy
      );

      return {
        success: false,
        error: deployResult.error,
      };
    }

    // Mark review as resolved with buffer info
    await resolveReviewItem(
      reviewId,
      `Quality review rejected - deployed buffer ${buffer.id} (video: ${deployResult.videoId})`,
      resolvedBy
    );

    logger.info(
      {
        reviewId,
        pipelineId: item.pipelineId,
        bufferId: buffer.id,
        videoId: deployResult.videoId,
        resolvedBy,
      },
      'Quality review rejected - buffer deployed'
    );

    return {
      success: true,
      bufferId: buffer.id,
      videoId: deployResult.videoId,
    };
  } catch (error) {
    logger.error(
      { error, reviewId },
      'Failed to reject quality review'
    );
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
