// Pre-publish quality gate decision logic

import type { PipelineState } from './state.js';

export type QualityDecision =
  | 'AUTO_PUBLISH'
  | 'AUTO_PUBLISH_WITH_WARNING'
  | 'HUMAN_REVIEW';

export interface QualityGateResult {
  decision: QualityDecision;
  reason: string;
  issues: string[];
}

/**
 * Quality gate check determines if video should be auto-published or needs review
 * Core Principle: NEVER publish low-quality content. Skip day > bad video.
 *
 * Quality Criteria:
 * - TTS fallback used → HUMAN_REVIEW
 * - >30% visual fallbacks → HUMAN_REVIEW
 * - Word count outside range → HUMAN_REVIEW
 * - >3 pronunciation unknowns unresolved → HUMAN_REVIEW
 * - Thumbnail fallback + visual fallback → HUMAN_REVIEW
 * - Single minor issue → AUTO_PUBLISH_WITH_WARNING
 */
export function qualityGateCheck(state: PipelineState): QualityGateResult {
  const { qualityContext } = state;
  const issues: string[] = [];

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
