/**
 * Review queue types and constants for NEXUS-AI human review system
 *
 * Provides strongly-typed review item management following FR40-FR41 requirements:
 * - Review item document structure for Firestore
 * - Type-specific content structures for pronunciation, quality, controversial items
 * - Status tracking: pending, resolved, dismissed
 *
 * @module @nexus-ai/core/review/types
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Firestore collection name for review queue items
 */
export const REVIEW_QUEUE_COLLECTION = 'review-queue';

/**
 * Threshold for unknown pronunciation terms that triggers review
 * Per AC1: if unknown.length > 3, create review item
 */
export const PRONUNCIATION_UNKNOWN_THRESHOLD = 3;

/**
 * Valid review item types
 */
export const REVIEW_ITEM_TYPES = [
  'pronunciation',
  'quality',
  'controversial',
  'topic',
  'other',
] as const;

/**
 * Valid review item statuses
 */
export const REVIEW_ITEM_STATUSES = ['pending', 'resolved', 'dismissed'] as const;

/**
 * Controversial topic categories
 */
export const CONTROVERSIAL_CATEGORIES = ['political', 'sensitive', 'high-risk'] as const;

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Review item type
 * - pronunciation: Unknown terms flagged during pronunciation check
 * - quality: Failed quality gates (script, thumbnail, etc.)
 * - controversial: Topic matched controversial keywords
 * - topic: Generic topic-related issues
 * - other: Miscellaneous review items
 */
export type ReviewItemType = (typeof REVIEW_ITEM_TYPES)[number];

/**
 * Review item lifecycle status
 * - pending: Awaiting operator review
 * - resolved: Operator has addressed the issue
 * - dismissed: Operator has dismissed (false positive, not relevant)
 */
export type ReviewItemStatus = (typeof REVIEW_ITEM_STATUSES)[number];

/**
 * Category of controversial content
 */
export type ControversialCategory = (typeof CONTROVERSIAL_CATEGORIES)[number];

/**
 * Type guard to check if a string is a valid review item type
 */
export function isValidReviewItemType(type: string): type is ReviewItemType {
  return REVIEW_ITEM_TYPES.includes(type as ReviewItemType);
}

/**
 * Type guard to check if a string is a valid review item status
 */
export function isValidReviewItemStatus(status: string): status is ReviewItemStatus {
  return REVIEW_ITEM_STATUSES.includes(status as ReviewItemStatus);
}

// =============================================================================
// Review Item Document Interface
// =============================================================================

/**
 * Review queue item stored in Firestore at review-queue/{id}
 *
 * Review items are created when pipeline stages flag content for human review.
 * Operators can resolve or dismiss items through the CLI or API.
 */
export interface ReviewItem {
  /** UUID (auto-generated) */
  id: string;
  /** Type of review item */
  type: ReviewItemType;
  /** Pipeline date in YYYY-MM-DD format */
  pipelineId: string;
  /** Stage that created the review item */
  stage: string;
  /** The flagged content (type-specific structure) */
  item: unknown;
  /** Additional context for the review */
  context: Record<string, unknown>;
  /** ISO 8601 UTC timestamp when item was created */
  createdAt: string;
  /** Current status of the review item */
  status: ReviewItemStatus;
  /** How the item was resolved (if resolved/dismissed) */
  resolution: string | null;
  /** ISO 8601 UTC timestamp when resolved */
  resolvedAt: string | null;
  /** Operator identifier who resolved */
  resolvedBy: string | null;
}

// =============================================================================
// Type-Specific Item Content Interfaces
// =============================================================================

/**
 * Term location in script for pronunciation review
 */
export interface TermLocation {
  /** The term that was flagged */
  term: string;
  /** Line number in the script */
  lineNumber: number;
  /** Surrounding text for context */
  surroundingText: string;
}

/**
 * Content structure for pronunciation review items
 */
export interface PronunciationItemContent {
  /** Terms not found in pronunciation dictionary */
  unknownTerms: string[];
  /** Total terms extracted from script */
  totalTerms: number;
  /** Terms found in dictionary */
  knownTerms: number;
}

/**
 * Context structure for pronunciation review items
 */
export interface PronunciationItemContext {
  /** Excerpt of script containing the terms */
  scriptExcerpt: string;
  /** Location details for each unknown term */
  termLocations: TermLocation[];
}

/**
 * Content structure for quality review items (script)
 */
export interface ScriptQualityItemContent {
  /** Actual word count */
  wordCount: number;
  /** Expected minimum word count */
  expectedMin: number;
  /** Expected maximum word count */
  expectedMax: number;
  /** Reason for failure */
  failureReason: string;
}

/**
 * Context structure for quality review items (script)
 */
export interface ScriptQualityItemContext {
  /** First 500 characters of script */
  scriptExcerpt: string;
  /** Number of optimizer rewrite attempts */
  optimizerAttempts: number;
}

/**
 * Content structure for thumbnail quality review items
 */
export interface ThumbnailQualityItemContent {
  /** Number of variants generated */
  generatedCount: number;
  /** Expected number of variants */
  expectedCount: number;
  /** Which variants failed to generate */
  failedVariants: number[];
  /** Reasons for each failure */
  failureReasons: string[];
}

/**
 * Content structure for controversial topic review items
 */
export interface ControversialItemContent {
  /** Full topic object (NewsItem type from news-sourcing) */
  topic: unknown;
  /** Keywords that triggered the flag */
  matchedKeywords: string[];
  /** Category of controversial content */
  category: ControversialCategory;
}

/**
 * Context structure for controversial topic review items
 */
export interface ControversialItemContext {
  /** URL of the source */
  sourceUrl: string;
  /** Type of source (github, hackernews, reddit, etc.) */
  sourceType: string;
  /** Freshness score of the topic */
  freshnessScore: number;
}

// =============================================================================
// Operation Interfaces
// =============================================================================

/**
 * Input for adding a new review item (id and timestamps auto-generated)
 */
export interface AddReviewItemInput {
  /** Type of review item */
  type: ReviewItemType;
  /** Pipeline date in YYYY-MM-DD format */
  pipelineId: string;
  /** Stage that created the review item */
  stage: string;
  /** The flagged content */
  item: unknown;
  /** Additional context */
  context: Record<string, unknown>;
}

/**
 * Resolution details when resolving a review item
 */
export interface ReviewResolution {
  /** How the item was resolved */
  resolution: string;
  /** Operator identifier */
  resolvedBy: string;
}

/**
 * Filters for querying the review queue
 */
export interface ReviewQueueFilters {
  /** Filter by status */
  status?: ReviewItemStatus;
  /** Filter by type */
  type?: ReviewItemType;
  /** Filter by pipeline ID */
  pipelineId?: string;
}

/**
 * Result of checking for controversial keywords
 */
export interface ControversialResult {
  /** Whether the topic is controversial */
  isControversial: boolean;
  /** Keywords that matched (if any) */
  matchedKeywords: string[];
  /** Category of controversial content (if matched) */
  category?: ControversialCategory;
}
