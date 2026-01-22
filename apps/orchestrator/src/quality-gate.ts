// Pre-publish quality gate decision logic

import type { PipelineState } from './state.js';
import {
  hasPendingCriticalReviews,
  getPendingCriticalReviews,
  createLogger,
} from '@nexus-ai/core';

const logger = createLogger('nexus.orchestrator.quality-gate');

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
  /** Stage to pause before (only when HUMAN_REVIEW due to pending reviews) */
  pauseBeforeStage?: string;
}

/**
 * Quality gate check determines if video should be auto-published or needs review
 * Core Principle: NEVER publish low-quality content. Skip day > bad video.
 *
 * Quality Criteria:
 * - Pending critical review items → HUMAN_REVIEW (pause before youtube)
 * - TTS fallback used → HUMAN_REVIEW
 * - >30% visual fallbacks → HUMAN_REVIEW
 * - Word count outside range → HUMAN_REVIEW
 * - >3 pronunciation unknowns unresolved → HUMAN_REVIEW
 * - Thumbnail fallback + visual fallback → HUMAN_REVIEW
 * - Single minor issue → AUTO_PUBLISH_WITH_WARNING
 */
export async function qualityGateCheck(state: PipelineState): Promise<QualityGateResult> {
  const { qualityContext } = state;
  const issues: string[] = [];

  // AC10: Check for pending critical review items first
  try {
    if (await hasPendingCriticalReviews()) {
      const criticalReviews = await getPendingCriticalReviews();
      const reviewItemIds = criticalReviews.map((r) => r.id);

      logger.info(
        { pipelineId: state.pipelineId, reviewCount: criticalReviews.length },
        'Pending critical review items require attention'
      );

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
    logger.error({ error }, 'Failed to check pending reviews, continuing with other checks');
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
  ).length > 0.3 * 10; // Assuming ~10 visual elements
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
  if (hasPronunciationIssues)
    issues.push('>3 pronunciation unknowns unresolved');
  if (hasThumbnailAndVisualFallback)
    issues.push('Both thumbnail and visual fallbacks used');

  // HUMAN_REVIEW: Major quality compromises
  if (issues.length > 0) {
    return {
      decision: 'HUMAN_REVIEW',
      reason: 'Major quality issues detected',
      issues,
    };
  }

  // AUTO_PUBLISH_WITH_WARNING: Minor issues (≤2, no critical issues)
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
