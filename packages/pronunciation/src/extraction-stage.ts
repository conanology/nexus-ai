/**
 * Pronunciation extraction stage for NEXUS-AI
 *
 * Extracts technical terms from scripts and flags unknown ones for review
 *
 * @module @nexus-ai/pronunciation/extraction-stage
 */

import type { StageInput, StageOutput } from '@nexus-ai/core/types';
import { NexusError } from '@nexus-ai/core/errors';
import { logger, CostTracker } from '@nexus-ai/core/observability';
import { PronunciationClient } from './pronunciation-client.js';
import { ReviewQueueClient } from './review-queue.js';
import { extractTerms } from './extractor.js';

/**
 * Input for pronunciation extraction stage
 */
export interface PronunciationExtractionInput {
  /** Script text to extract terms from */
  script: string;
}

/**
 * Output for pronunciation extraction stage
 */
export interface PronunciationExtractionOutput {
  /** Number of terms extracted */
  termsExtracted: number;
  /** Number of known terms (found in dictionary) */
  knownTerms: number;
  /** List of unknown terms with context */
  unknownTerms: Array<{ term: string; context: string }>;
  /** Whether script was flagged for review (>3 unknown terms) */
  flaggedForReview: boolean;
  /** Review queue item IDs if items were added */
  reviewQueueIds?: string[];
}

/**
 * Execute pronunciation extraction stage
 *
 * Extracts technical terms from script, validates against dictionary,
 * and adds unknown terms to review queue if threshold exceeded.
 *
 * @param input - Stage input with script text
 * @returns Stage output with extraction results
 */
export async function executePronunciationExtraction(
  input: StageInput<PronunciationExtractionInput>
): Promise<StageOutput<PronunciationExtractionOutput>> {
  const startTime = Date.now();
  const tracker = new CostTracker(input.pipelineId, 'pronunciation-extraction');
  const log = logger.child({
    component: 'nexus.pronunciation.extraction',
    pipelineId: input.pipelineId,
    stage: 'pronunciation-extraction',
  });

  log.info('Starting pronunciation extraction');

  try {
    const { script } = input.data;

    // Extract terms with context
    const termsWithContext = extractTerms(script, { includeContext: true });

    log.info({ termsCount: termsWithContext.length }, 'Extracted terms from script');

    // Initialize clients
    const pronunciationClient = new PronunciationClient();
    const reviewQueueClient = new ReviewQueueClient();

    // Load dictionary for validation
    await pronunciationClient.getDictionary(tracker);

    // Validate terms against dictionary and collect unknowns
    const unknownTerms: Array<{ term: string; context: string }> = [];
    const seenTerms = new Set<string>();

    for (const { term, context } of termsWithContext) {
      // Skip duplicates
      if (seenTerms.has(term.toLowerCase())) {
        continue;
      }
      seenTerms.add(term.toLowerCase());

      // Check if term exists in dictionary
      const entry = await pronunciationClient.lookupTerm(term, tracker);

      if (!entry) {
        unknownTerms.push({ term, context });
      }
    }

    const knownCount = seenTerms.size - unknownTerms.length;

    log.info(
      {
        termsExtracted: seenTerms.size,
        knownTerms: knownCount,
        unknownTerms: unknownTerms.length,
      },
      'Term validation complete'
    );

    // Check if we should flag for review (>3 unknown terms)
    const flaggedForReview = reviewQueueClient.shouldFlagForReview(unknownTerms.length);

    // Add unknown terms to review queue if flagged
    const reviewQueueIds: string[] = [];
    if (flaggedForReview && unknownTerms.length > 0) {
      log.warn(
        { unknownCount: unknownTerms.length },
        'Script flagged for review - adding unknown terms to review queue'
      );

      for (const { term, context } of unknownTerms) {
        const item = await reviewQueueClient.addToReviewQueue({
          term,
          context,
          pipelineId: input.pipelineId,
        });
        reviewQueueIds.push(item.id);
      }
    }

    const accuracyPct = seenTerms.size > 0
      ? ((seenTerms.size - unknownTerms.length) / seenTerms.size) * 100
      : 100;

    const output: StageOutput<PronunciationExtractionOutput> = {
      success: true,
      data: {
        termsExtracted: seenTerms.size,
        knownTerms: knownCount,
        unknownTerms,
        flaggedForReview,
        ...(reviewQueueIds.length > 0 && { reviewQueueIds }),
      },
      quality: {
        stage: 'pronunciation-extraction',
        timestamp: new Date().toISOString(),
        measurements: {
          totalTerms: seenTerms.size,
          knownTerms: knownCount,
          unknownTerms: unknownTerms.length,
          accuracyPct,
          flaggedForReview,
          termsAdded: 0,
        },
      },
      cost: tracker.getSummary(),
      durationMs: Date.now() - startTime,
      provider: {
        name: 'firestore',
        tier: 'primary',
        attempts:1,
      },
      ...(flaggedForReview && {
        warnings: [`${unknownTerms.length} unknown terms require human review`],
      }),
    };

    log.info(
      {
        durationMs: output.durationMs,
        flaggedForReview,
      },
      'Pronunciation extraction complete'
    );

    return output;
  } catch (error) {
    log.error({ error }, 'Pronunciation extraction failed');
    throw NexusError.fromError(error, 'pronunciation-extraction');
  }
}
