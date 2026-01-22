/**
 * Review queue module for NEXUS-AI human review system
 *
 * Provides review item management following FR40-FR41 requirements:
 * - Create review items when content is flagged
 * - Query and filter review queue
 * - Resolve or dismiss items
 * - Topic management (skip, requeue, approve with modifications)
 *
 * @module @nexus-ai/core/review
 */

// Re-export types
export * from './types.js';

// Re-export manager functions
export {
  addToReviewQueue,
  getReviewQueue,
  getReviewItem,
  resolveReviewItem,
  dismissReviewItem,
  getPendingReviewCount,
  hasPendingCriticalReviews,
  getPendingCriticalReviews,
  skipTopic,
  requeueTopicFromReview,
  approveTopicWithModifications,
} from './manager.js';
