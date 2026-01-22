/**
 * Controversial topic detection for NEXUS-AI news sourcing
 *
 * Identifies topics that may require human review before proceeding
 * with content production. Uses keyword matching across three categories:
 * - Political: Elections, government, policy content
 * - Sensitive: Ethics, bias, discrimination topics
 * - High-risk: Security vulnerabilities, data breaches, legal issues
 *
 * @module @nexus-ai/news-sourcing/controversial
 */

import { createLogger, addToReviewQueue } from '@nexus-ai/core';
import type { ControversialResult, ControversialCategory, ControversialItemContent } from '@nexus-ai/core';
import type { NewsItem } from './types.js';

const logger = createLogger('nexus.news-sourcing.controversial');

// =============================================================================
// Keyword Lists by Category
// =============================================================================

/**
 * Political keywords - proceed with caution
 */
const POLITICAL_KEYWORDS = [
  'election',
  'vote',
  'voting',
  'ballot',
  'candidate',
  'campaign',
  'policy',
  'legislation',
  'bill',
  'congress',
  'senate',
  'parliament',
  'president',
  'minister',
  'government',
  'administration',
  'partisan',
  'democrat',
  'republican',
  'conservative',
  'liberal',
  'political',
];

/**
 * Sensitive keywords - review recommended
 */
const SENSITIVE_KEYWORDS = [
  'bias',
  'discrimination',
  'prejudice',
  'racism',
  'sexism',
  'ethics',
  'ethical',
  'unethical',
  'controversial',
  'privacy',
  'surveillance',
  'tracking',
  'monitoring',
  'misinformation',
  'fake news',
  'propaganda',
  'censorship',
  'content moderation',
  'hate speech',
  'toxicity',
];

/**
 * High-risk keywords - always review
 */
const HIGH_RISK_KEYWORDS = [
  'security vulnerability',
  'cve',
  'exploit',
  'breach',
  'data leak',
  'exposed',
  'hack',
  'hacked',
  'ransomware',
  'malware',
  'lawsuit',
  'litigation',
  'sue',
  'sued',
  'legal action',
  'class action',
  'settlement',
  'regulatory',
  'fine',
  'penalty',
  'antitrust',
  'monopoly',
];

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Check a string against a keyword list
 *
 * @param text - Text to check
 * @param keywords - List of keywords to match
 * @returns Array of matched keywords (lowercase)
 */
function findMatches(text: string, keywords: readonly string[]): string[] {
  const lowerText = text.toLowerCase();
  return keywords.filter((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Check if a topic matches controversial keywords
 *
 * Examines the topic title and URL for controversial keyword matches.
 * Categories are checked in order of severity: high-risk, sensitive, political.
 *
 * @param topic - NewsItem to check
 * @returns ControversialResult with match details
 *
 * @example
 * ```typescript
 * const result = checkControversialTopics({
 *   title: 'Major Data Breach Exposes 10M Records',
 *   url: 'https://example.com/breach-news',
 *   source: 'hacker-news',
 *   publishedAt: '2026-01-22T10:00:00Z',
 *   viralityScore: 85
 * });
 * // result = {
 * //   isControversial: true,
 * //   matchedKeywords: ['breach', 'exposed'],
 * //   category: 'high-risk'
 * // }
 * ```
 */
export function checkControversialTopics(topic: NewsItem): ControversialResult {
  const textToCheck = `${topic.title} ${topic.url}`;

  // Check high-risk first (most severe)
  const highRiskMatches = findMatches(textToCheck, HIGH_RISK_KEYWORDS);
  if (highRiskMatches.length > 0) {
    logger.debug(
      { title: topic.title, matches: highRiskMatches, category: 'high-risk' },
      'High-risk controversial topic detected'
    );
    return {
      isControversial: true,
      matchedKeywords: highRiskMatches,
      category: 'high-risk',
    };
  }

  // Check sensitive keywords
  const sensitiveMatches = findMatches(textToCheck, SENSITIVE_KEYWORDS);
  if (sensitiveMatches.length > 0) {
    logger.debug(
      { title: topic.title, matches: sensitiveMatches, category: 'sensitive' },
      'Sensitive controversial topic detected'
    );
    return {
      isControversial: true,
      matchedKeywords: sensitiveMatches,
      category: 'sensitive',
    };
  }

  // Check political keywords
  const politicalMatches = findMatches(textToCheck, POLITICAL_KEYWORDS);
  if (politicalMatches.length > 0) {
    logger.debug(
      { title: topic.title, matches: politicalMatches, category: 'political' },
      'Political controversial topic detected'
    );
    return {
      isControversial: true,
      matchedKeywords: politicalMatches,
      category: 'political',
    };
  }

  // No matches
  return {
    isControversial: false,
    matchedKeywords: [],
  };
}

/**
 * Check topic for controversial content and add to review queue if needed
 *
 * This is the main integration function called during topic selection.
 * If controversial keywords are matched, creates a review item in Firestore.
 *
 * @param topic - NewsItem to check
 * @param pipelineId - Pipeline ID for review item tracking
 * @param freshnessScore - Topic freshness score (0-100)
 * @returns ControversialResult with match details
 *
 * @example
 * ```typescript
 * const result = await checkAndFlagControversialTopic(
 *   selectedTopic,
 *   '2026-01-22',
 *   85
 * );
 * if (result.isControversial) {
 *   // Topic flagged for review, but can still proceed
 *   logger.warn({ topic: selectedTopic.title }, 'Proceeding with flagged topic');
 * }
 * ```
 */
export async function checkAndFlagControversialTopic(
  topic: NewsItem,
  pipelineId: string,
  freshnessScore: number = 0
): Promise<ControversialResult> {
  const result = checkControversialTopics(topic);

  if (!result.isControversial) {
    return result;
  }

  // Create review item for controversial topic
  const itemContent: ControversialItemContent = {
    topic,
    matchedKeywords: result.matchedKeywords,
    category: result.category as ControversialCategory,
  };

  const itemContext: Record<string, unknown> = {
    sourceUrl: topic.url,
    sourceType: topic.source,
    freshnessScore,
  };

  try {
    await addToReviewQueue({
      type: 'controversial',
      pipelineId,
      stage: 'news-sourcing',
      item: itemContent,
      context: itemContext,
    });

    logger.info(
      {
        pipelineId,
        title: topic.title,
        category: result.category,
        matchedKeywords: result.matchedKeywords,
      },
      'Controversial topic flagged for review'
    );
  } catch (error) {
    logger.error({ error, topic: topic.title }, 'Failed to create controversial topic review item');
    // Don't throw - allow pipeline to continue even if review item creation fails
  }

  return result;
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Get all keyword lists for testing/debugging
 */
export const CONTROVERSIAL_KEYWORD_LISTS = {
  political: POLITICAL_KEYWORDS,
  sensitive: SENSITIVE_KEYWORDS,
  highRisk: HIGH_RISK_KEYWORDS,
} as const;
