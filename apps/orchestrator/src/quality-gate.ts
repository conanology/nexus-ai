/**
 * Pre-publish quality gate integration for NEXUS-AI orchestrator
 *
 * Integrates with @nexus-ai/core pre-publish quality gate to evaluate
 * pipeline output before YouTube upload. Implements the "never publish garbage"
 * principle (NFR1-5).
 *
 * @module orchestrator/quality-gate
 */

import {
  createLogger,
  qualityGateCheck as coreQualityGateCheck,
  persistQualityDecision,
  createQualityReviewItem,
  handleReviewApproval,
  handleReviewRejection,
  hasPendingCriticalReviews,
  getPendingCriticalReviews,
  type QualityDecisionResult,
  type PipelineQualityContext,
  type StageOutput,
  type QualityContext,
} from '@nexus-ai/core';
import { sendDiscordAlert, type DiscordAlertConfig } from '@nexus-ai/notifications';

const logger = createLogger('nexus.orchestrator.quality-gate');

// =============================================================================
// Types (backwards compatibility)
// =============================================================================

export type QualityDecision =
  | 'AUTO_PUBLISH'
  | 'AUTO_PUBLISH_WITH_WARNING'
  | 'HUMAN_REVIEW';

export interface QualityGateResult {
  decision: QualityDecision;
  reason: string;
  issues: string[];
  /** Review item IDs that require attention (only when HUMAN_REVIEW) */
  reviewItemIds?: string[];
  /** Stage to pause before (only when HUMAN_REVIEW) */
  pauseBeforeStage?: string;
  /** Full quality decision result from core gate */
  coreDecision?: QualityDecisionResult;
}

// =============================================================================
// Main Quality Gate Function
// =============================================================================

/**
 * Quality gate check determines if video should be auto-published or needs review
 *
 * Core Principle: NEVER publish low-quality content. Skip day > bad video.
 *
 * Quality Criteria (from AC5):
 * - TTS fallback used → HUMAN_REVIEW
 * - >30% visual fallbacks → HUMAN_REVIEW
 * - Word count outside 1,200-1,800 range → HUMAN_REVIEW
 * - >3 pronunciation unknowns unresolved → HUMAN_REVIEW
 * - Thumbnail fallback + visual fallback combined → HUMAN_REVIEW
 * - 1-2 minor issues → AUTO_PUBLISH_WITH_WARNING
 * - No issues → AUTO_PUBLISH
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD format)
 * @param stageOutputs - All stage outputs from pipeline execution
 * @param qualityContext - Accumulated quality context from pipeline
 * @returns Quality gate result with decision and details
 */
export async function qualityGateCheck(
  pipelineId: string,
  stageOutputs: Record<string, StageOutput<unknown>>,
  qualityContext: QualityContext
): Promise<QualityGateResult> {
  const reviewItemIds: string[] = [];

  // AC10: Check for pending critical review items first
  try {
    if (await hasPendingCriticalReviews()) {
      const criticalReviews = await getPendingCriticalReviews();
      const ids = criticalReviews.map((r) => r.id);
      reviewItemIds.push(...ids);

      logger.info(
        { pipelineId, reviewCount: criticalReviews.length },
        'Pending critical review items require attention'
      );

      return {
        decision: 'HUMAN_REVIEW',
        reason: `${criticalReviews.length} pending review items require attention`,
        issues: criticalReviews.map(
          (r) => `Pending ${r.type} review from ${r.stage} stage`
        ),
        reviewItemIds: ids,
        pauseBeforeStage: 'youtube',
      };
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check pending reviews, continuing with other checks');
  }

  // Build pipeline quality context for core gate
  const pipelineQualityContext: PipelineQualityContext = {
    pipelineId,
    stages: stageOutputs,
    qualityContext,
  };

  // Call core quality gate check
  const coreDecision = await coreQualityGateCheck(pipelineQualityContext);

  // Persist the decision to Firestore (AC7)
  try {
    await persistQualityDecision(pipelineId, coreDecision);
  } catch (error) {
    logger.error({ error, pipelineId }, 'Failed to persist quality decision');
    // Continue - persistence failure shouldn't block the decision
  }

  // Map core decision to orchestrator result
  const result: QualityGateResult = {
    decision: coreDecision.decision,
    reason: coreDecision.reasons[0] || 'Quality gate evaluation complete',
    issues: coreDecision.issues.map((i) => `[${i.severity.toUpperCase()}] ${i.stage}: ${i.message}`),
    coreDecision,
  };

  // Handle HUMAN_REVIEW decision (AC4, AC8)
  if (coreDecision.decision === 'HUMAN_REVIEW') {
    result.pauseBeforeStage = 'youtube';

    // Create review item
    try {
      const reviewId = await createQualityReviewItem(
        pipelineId,
        coreDecision,
        pipelineQualityContext
      );
      result.reviewItemIds = [reviewId];

      // Update decision with review item ID
      coreDecision.reviewItemId = reviewId;

      // Send Discord alert for HUMAN_REVIEW
      try {
        const majorIssues = coreDecision.issues.filter((i) => i.severity === 'major');

        const alertConfig: DiscordAlertConfig = {
          severity: 'WARNING',
          title: '🔍 Human Review Required',
          description: `Pipeline ${pipelineId} requires manual review before publishing`,
          fields: [
            { name: 'Review ID', value: reviewId, inline: true },
            { name: 'Major Issues', value: String(majorIssues.length), inline: true },
            { name: 'Decision', value: coreDecision.decision, inline: true },
            ...majorIssues.slice(0, 3).map((issue) => ({
              name: `${issue.stage}`,
              value: issue.message,
              inline: false,
            })),
          ],
          timestamp: new Date().toISOString(),
        };

        await sendDiscordAlert(alertConfig);
        logger.info({ pipelineId, reviewId }, 'HUMAN_REVIEW Discord alert sent');
      } catch (alertError) {
        logger.warn(
          { error: alertError, pipelineId },
          'Failed to send HUMAN_REVIEW Discord alert'
        );
      }
    } catch (reviewError) {
      logger.error(
        { error: reviewError, pipelineId },
        'Failed to create quality review item'
      );
    }
  }

  // Log quality gate decision
  logger.info(
    {
      pipelineId,
      decision: coreDecision.decision,
      issueCount: coreDecision.issues.length,
      majorIssues: coreDecision.issues.filter((i) => i.severity === 'major').length,
      minorIssues: coreDecision.issues.filter((i) => i.severity === 'minor').length,
    },
    'Quality gate check complete'
  );

  return result;
}

// =============================================================================
// Review Handling Functions
// =============================================================================

/**
 * Handle operator approval of a quality review item
 *
 * When approved:
 * - Marks review as resolved
 * - Returns true to signal orchestrator to proceed to YouTube
 *
 * @param reviewId - Review item ID
 * @param resolvedBy - Operator identifier
 * @returns True if approval successful and pipeline should proceed
 */
export async function approveQualityReview(
  reviewId: string,
  resolvedBy: string
): Promise<boolean> {
  return handleReviewApproval(reviewId, resolvedBy);
}

/**
 * Handle operator rejection of a quality review item
 *
 * When rejected:
 * - Deploys buffer video instead
 * - Marks review as resolved with rejection details
 *
 * @param reviewId - Review item ID
 * @param resolvedBy - Operator identifier
 * @returns Deployment result with buffer info or error
 */
export async function rejectQualityReview(
  reviewId: string,
  resolvedBy: string
): Promise<{ success: boolean; bufferId?: string; videoId?: string; error?: string }> {
  return handleReviewRejection(reviewId, resolvedBy);
}

// =============================================================================
// Legacy Support (backwards compatibility)
// =============================================================================

/**
 * @deprecated Use qualityGateCheck with full stage outputs instead
 * Legacy quality gate check for PipelineState (backwards compatibility)
 */
export async function legacyQualityGateCheck(state: {
  pipelineId: string;
  qualityContext: QualityContext;
}): Promise<QualityGateResult> {
  const { qualityContext } = state;
  const issues: string[] = [];

  // Check for pending critical review items first
  try {
    if (await hasPendingCriticalReviews()) {
      const criticalReviews = await getPendingCriticalReviews();
      const reviewItemIds = criticalReviews.map((r) => r.id);

      return {
        decision: 'HUMAN_REVIEW',
        reason: `${criticalReviews.length} pending review items require attention`,
        issues: criticalReviews.map(
          (r) => `Pending ${r.type} review from ${r.stage} stage`
        ),
        reviewItemIds,
        pauseBeforeStage: 'youtube',
      };
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check pending reviews');
  }

  // AUTO_PUBLISH: No issues
  if (
    qualityContext.degradedStages.length === 0 &&
    qualityContext.fallbacksUsed.length === 0 &&
    qualityContext.flags.length === 0
  ) {
    return {
      decision: 'AUTO_PUBLISH',
      reason: 'No quality issues detected',
      issues: [],
    };
  }

  // Check for HUMAN_REVIEW conditions
  const hasTTSFallback = qualityContext.fallbacksUsed.some((fb) =>
    fb.startsWith('tts:')
  );
  const hasHighVisualFallback = qualityContext.fallbacksUsed.filter((fb) =>
    fb.startsWith('visual-gen:')
  ).length > 3;
  const hasWordCountIssue = qualityContext.flags.some((flag) =>
    flag.includes('word-count')
  );
  const hasPronunciationIssues = qualityContext.flags.some(
    (flag) => flag.includes('pronunciation') && flag.includes('>3')
  );
  const hasThumbnailAndVisualFallback =
    qualityContext.fallbacksUsed.some((fb) => fb.startsWith('thumbnail:')) &&
    qualityContext.fallbacksUsed.some((fb) => fb.startsWith('visual-gen:'));

  // Collect issues
  if (hasTTSFallback) issues.push('TTS fallback used');
  if (hasHighVisualFallback) issues.push('>30% visual fallbacks used');
  if (hasWordCountIssue) issues.push('Word count outside acceptable range');
  if (hasPronunciationIssues) issues.push('>3 pronunciation unknowns unresolved');
  if (hasThumbnailAndVisualFallback) issues.push('Both thumbnail and visual fallbacks used');

  // HUMAN_REVIEW: Major quality compromises
  if (issues.length > 0) {
    return {
      decision: 'HUMAN_REVIEW',
      reason: 'Major quality issues detected',
      issues,
    };
  }

  // AUTO_PUBLISH_WITH_WARNING: Minor issues
  if (
    qualityContext.degradedStages.length <= 2 ||
    qualityContext.fallbacksUsed.length <= 2
  ) {
    return {
      decision: 'AUTO_PUBLISH_WITH_WARNING',
      reason: 'Minor quality issues detected',
      issues: [
        ...qualityContext.degradedStages.map((s) => `Degraded stage: ${s}`),
        ...qualityContext.fallbacksUsed.map((fb) => `Fallback used: ${fb}`),
      ],
    };
  }

  // Default to HUMAN_REVIEW if uncertain
  return {
    decision: 'HUMAN_REVIEW',
    reason: 'Multiple quality concerns',
    issues: [
      `${qualityContext.degradedStages.length} degraded stages`,
      `${qualityContext.fallbacksUsed.length} fallbacks used`,
      `${qualityContext.flags.length} flags raised`,
    ],
  };
}
